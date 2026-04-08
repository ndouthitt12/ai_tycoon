import {
  BASE_POD_COST,
  COMPETITOR_COMPANIES,
  COMPETITOR_STRATEGIES,
  createEmptyCohortSubscriberMap,
  DATA_TIERS,
  MODEL_SIZES,
  RELIABILITY_TIER_IDS,
} from "../defs";
import {
  CompetitorCompanyDefinition,
  GameState,
  ModelGoalId,
  NotificationTone,
  ReliabilityTierId,
  TrainingConfig,
} from "../types";
import {
  COMPETITOR_RELEASE_SHOCK_COEFFICIENT,
  TRAINING_CONTEXT_EXPANSION_CAPABILITY,
  TRAINING_DATA_CAPABILITY,
  TRAINING_MEMORY_EXPANSION_CAPABILITY,
  TRAINING_PARAMETER_EXPANSION_CAPABILITY,
} from "./balance";
import {
  getBaseContextWindow,
  getBaseMemorySize,
  getBaseParameterScale,
  getContextWindowLimit,
  getDatasetPurchaseCost,
  getGoalDevelopmentCost,
  getMemorySizeLimit,
  getParameterScaleLimit,
  getParameterStep,
} from "./training";

const COMPETITOR_RELEASE_FAMILIES = ["Core", "Nova", "Prime", "Vector", "Forge", "Pulse", "Halo", "Axis"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundVersion(value: number) {
  return Number(value.toFixed(3));
}

function getMonthlyUserMultiplier(game: Pick<GameState, "monthlyUserMultiplier">) {
  return clamp(Number(game.monthlyUserMultiplier) || 1, 0.1, 10);
}

function getGoalTotal(goals: TrainingConfig["goals"]) {
  return Object.values(goals).reduce((sum, value) => sum + value, 0);
}

function getGoalAverage(goals: TrainingConfig["goals"]) {
  return getGoalTotal(goals) / Object.keys(goals).length;
}

function getBestCapability(game: GameState) {
  return game.models.length ? Math.max(...game.models.map((model) => model.capability)) : 0;
}

export function getCompetitorCompanyDefinition(competitorId: string) {
  return COMPETITOR_COMPANIES.find((company) => company.id === competitorId) ?? null;
}

export function getDefaultCompetitorAdminState(competitorId?: string) {
  const company = competitorId ? getCompetitorCompanyDefinition(competitorId) : null;
  return {
    capitalAddedMillions: 0,
    behavior: company?.defaultBehavior ?? "balanced",
    strategy: company?.defaultStrategy ?? "balanced",
    capabilityModifier: company?.defaultCapabilityModifier ?? 1,
    goalModifiers: { ...(company?.defaultGoalModifiers ?? {}) },
  };
}

export function getCompetitorAdminState(game: GameState, competitorId: string) {
  return game.competitorAdmin[competitorId] ?? getDefaultCompetitorAdminState(competitorId);
}

function getStrategicGoalOverlay(strategy: GameState["competitorAdmin"][string]["strategy"], goalId: ModelGoalId) {
  if (strategy === "balanced") return 0;
  if (strategy === "consumer") {
    if (goalId === "speed") return 28;
    if (goalId === "multimodal") return 24;
    if (goalId === "accuracy") return 10;
    return 0;
  }
  if (strategy === "enterprise") {
    if (goalId === "accuracy") return 18;
    if (goalId === "reasoning") return 24;
    if (goalId === "agentic") return 18;
    return 0;
  }
  return goalId === strategy ? 36 : 0;
}

function getCompetitorGoals(
  companyGoals: Record<ModelGoalId, number>,
  strategy: GameState["competitorAdmin"][string]["strategy"],
) {
  return (Object.keys(companyGoals) as ModelGoalId[]).reduce(
    (next, goalId) => ({
      ...next,
      [goalId]: companyGoals[goalId] + getStrategicGoalOverlay(strategy, goalId),
    }),
    {} as Record<ModelGoalId, number>,
  );
}

function getCompetitorBehaviorProfile(behavior: GameState["competitorAdmin"][string]["behavior"]) {
  if (behavior === "aggressive") {
    return {
      budgetGrowthMultiplier: 1.32,
      architectureSpendMultiplier: 1.2,
      revenueMultiplier: 1.16,
      profitMarginBonus: -0.04,
      capabilityMomentum: 10,
      versionPaceBonus: 0.12,
    };
  }
  if (behavior === "disciplined") {
    return {
      budgetGrowthMultiplier: 0.88,
      architectureSpendMultiplier: 0.92,
      revenueMultiplier: 0.94,
      profitMarginBonus: 0.05,
      capabilityMomentum: -4,
      versionPaceBonus: 0.03,
    };
  }
  return {
    budgetGrowthMultiplier: 1,
    architectureSpendMultiplier: 1,
    revenueMultiplier: 1,
    profitMarginBonus: 0,
    capabilityMomentum: 0,
    versionPaceBonus: 0.07,
  };
}

function getCompetitorCapabilityMultiplier(admin: Pick<GameState["competitorAdmin"][string], "capabilityModifier">) {
  return admin.capabilityModifier > 0 ? admin.capabilityModifier : 1;
}

function getCompetitorDevelopmentWindow(
  behavior: GameState["competitorAdmin"][string]["behavior"],
  releaseKind: "new" | "upgrade" | "branch",
) {
  if (releaseKind === "upgrade") {
    if (behavior === "aggressive") return [3, 12] as const;
    if (behavior === "disciplined") return [12, 16] as const;
    return [6, 16] as const;
  }
  if (releaseKind === "branch") {
    if (behavior === "aggressive") return [6, 12] as const;
    if (behavior === "disciplined") return [12, 16] as const;
    return [9, 16] as const;
  }
  if (behavior === "aggressive") return [12, 18] as const;
  if (behavior === "disciplined") return [16, 24] as const;
  return [14, 22] as const;
}

function getCompetitorDevelopmentMonths(
  behavior: GameState["competitorAdmin"][string]["behavior"],
  releaseKind: "new" | "upgrade" | "branch",
  companyIndex: number,
  releaseIndex: number,
) {
  const [min, max] = getCompetitorDevelopmentWindow(behavior, releaseKind);
  const spread = max - min;
  if (spread <= 0) return min;
  const offset = (companyIndex * 5 + releaseIndex * 7 + (releaseKind === "branch" ? 3 : releaseKind === "upgrade" ? 1 : 0)) % (spread + 1);
  return min + offset;
}

function getCompetitorReleaseKind(releaseIndex: number): "new" | "upgrade" | "branch" {
  if (releaseIndex === 0) return "new";
  return releaseIndex % 4 === 1 ? "upgrade" : releaseIndex % 4 === 2 ? "branch" : "upgrade";
}

function getCompetitorEconomicGoals(
  goals: Record<ModelGoalId, number>,
  releaseKind: "new" | "upgrade" | "branch",
  modifiers?: Partial<Record<ModelGoalId, number>>,
) {
  const total = Math.max(1, Object.values(goals).reduce((sum, value) => sum + value, 0));
  const targetIntensity = releaseKind === "new" ? 14 : releaseKind === "branch" ? 10 : 8;
  return (Object.keys(goals) as ModelGoalId[]).reduce(
    (next, goalId) => ({
      ...next,
      [goalId]: Number(Math.max(0.5, (goals[goalId] / total) * targetIntensity * (modifiers?.[goalId] ?? 1.0)).toFixed(1)),
    }),
    {} as Record<ModelGoalId, number>,
  );
}

function getCompetitorBaselineEconomicGoals(previousGoals: Record<ModelGoalId, number> | null, releaseKind: "new" | "upgrade" | "branch", modifiers?: Partial<Record<ModelGoalId, number>>) {
  if (!previousGoals || releaseKind === "new") return null;
  return getCompetitorEconomicGoals(previousGoals, releaseKind === "branch" ? "upgrade" : releaseKind, modifiers);
}

function getCompetitorBranchFocus(strategy: GameState["competitorAdmin"][string]["strategy"], releaseIndex: number) {
  if (strategy === "consumer") return releaseIndex % 2 === 0 ? "speed" : "multimodal";
  if (strategy === "enterprise") return releaseIndex % 2 === 0 ? "reasoning" : "accuracy";
  if (strategy === "speed") return "speed";
  if (strategy === "accuracy") return "accuracy";
  if (strategy === "reasoning") return "reasoning";
  if (strategy === "agentic") return "agentic";
  if (strategy === "coding") return "coding";
  if (strategy === "multimodal") return "multimodal";
  return releaseIndex % 2 === 0 ? "reasoning" : "speed";
}

function getCompetitorBranchGoals(
  baseGoals: Record<ModelGoalId, number>,
  strategy: GameState["competitorAdmin"][string]["strategy"],
  releaseIndex: number,
) {
  const focus = getCompetitorBranchFocus(strategy, releaseIndex);
  const next = Object.fromEntries(
    (Object.keys(baseGoals) as ModelGoalId[]).map((goalId) => [goalId, Math.max(1, Math.round(baseGoals[goalId] * 0.86))]),
  ) as Record<ModelGoalId, number>;
  next[focus] += 34;
  if (strategy === "consumer") {
    next.speed += 10;
    next.multimodal += 8;
  } else if (strategy === "enterprise") {
    next.reasoning += 10;
    next.accuracy += 8;
    next.agentic += 6;
  } else {
    const secondary = (Object.keys(baseGoals) as ModelGoalId[]).find((goalId) => goalId !== focus) || focus;
    next[secondary] += 8;
  }
  return next;
}

function getCompetitorUpgradeGoals(
  baseGoals: Record<ModelGoalId, number>,
  strategy: GameState["competitorAdmin"][string]["strategy"],
) {
  const next = { ...baseGoals };
  const focus = getCompetitorBranchFocus(strategy, 0);
  next[focus] = Math.max(1, Math.round(next[focus] + 6));
  return next;
}

function buildCompetitorRelease(
  goalEconomics: GameState["goalEconomics"],
  company: CompetitorCompanyDefinition,
  companyIndex: number,
  competitor: GameState["competitorCompanies"][string],
  admin: GameState["competitorAdmin"][string],
  monthBuilt: number,
) {
  const behavior = getCompetitorBehaviorProfile(admin.behavior);
  const strategyGoals = getCompetitorGoals(company.goals, admin.strategy);
  const capabilityMultiplier = getCompetitorCapabilityMultiplier(admin);
  const releaseKind = getCompetitorReleaseKind(competitor.releaseIndex);
  const previousRow = competitor.models[0] ?? null;
  const familyBaseName = `${company.name.split(" ")[0]} ${COMPETITOR_RELEASE_FAMILIES[companyIndex % COMPETITOR_RELEASE_FAMILIES.length]}`;
  const baseFamilyName = (competitor.currentFamilyName || familyBaseName).replace(/ [A-Za-z]+ Branch$/, "");
  const currentFamilyName =
    releaseKind === "new"
      ? `${company.name.split(" ")[0]} ${COMPETITOR_RELEASE_FAMILIES[(companyIndex + competitor.releaseIndex) % COMPETITOR_RELEASE_FAMILIES.length]}`
      : releaseKind === "branch"
        ? `${baseFamilyName} ${COMPETITOR_STRATEGIES[admin.strategy].label} Branch`
        : baseFamilyName;
  const baseMemorySize = previousRow ? previousRow.memorySize : getBaseMemorySize(company.sizeKey);
  const baseParameterScale = previousRow ? previousRow.parameterScale : getBaseParameterScale(company.sizeKey);
  const baseContextWindow = previousRow ? previousRow.contextWindow : getBaseContextWindow(company.sizeKey);
  const purePreviousGoals = previousRow
    ? (Object.keys(previousRow.goals) as ModelGoalId[]).reduce((acc, key) => {
      acc[key] = previousRow.goals[key] / (admin.goalModifiers?.[key] ?? 1.0);
      return acc;
    }, {} as Record<ModelGoalId, number>)
    : null;
  const pureDisplayGoals =
    releaseKind === "branch"
      ? getCompetitorBranchGoals(purePreviousGoals ?? strategyGoals, admin.strategy, competitor.releaseIndex)
      : releaseKind === "upgrade"
        ? getCompetitorUpgradeGoals(purePreviousGoals ?? strategyGoals, admin.strategy)
        : { ...strategyGoals };
  const displayGoals = (Object.keys(pureDisplayGoals) as ModelGoalId[]).reduce((acc, key) => {
    acc[key] = Number((pureDisplayGoals[key] * (admin.goalModifiers?.[key] ?? 1.0)).toFixed(1));
    return acc;
  }, {} as Record<ModelGoalId, number>);
  const economicGoals = getCompetitorEconomicGoals(pureDisplayGoals, releaseKind, admin.goalModifiers);
  const baselineGoals = getCompetitorBaselineEconomicGoals(purePreviousGoals ?? null, releaseKind, admin.goalModifiers);
  const anchorBudget =
    company.startingCapitalMillions *
    1000000 *
    (releaseKind === "new" ? 0.5 : releaseKind === "branch" ? 0.34 : 0.28) *
    behavior.budgetGrowthMultiplier;
  const spendCap = Math.min(
    competitor.cash,
    Math.max(
      8000000,
      anchorBudget + Math.max(0, competitor.cash - company.startingCapitalMillions * 1000000) * 0.16,
    ),
  );
  if (spendCap < 6000000) return null;

  const goalCost = getGoalDevelopmentCost(goalEconomics, economicGoals, Math.max(1, spendCap * 0.22), baselineGoals);
  const desiredArchitectureBudget =
    spendCap *
    behavior.architectureSpendMultiplier *
    (releaseKind === "new" ? 0.42 : releaseKind === "branch" ? 0.28 : 0.34);
  let availableBudget = Math.min(desiredArchitectureBudget, Math.max(0, spendCap - goalCost.totalCost));
  if (availableBudget < 1000000) return null;

  const dataStepCost = getDatasetPurchaseCost(company.dataTier, "small") + 2.8 * BASE_POD_COST * MODEL_SIZES[company.sizeKey].minCompute;
  const paramStepCost = 650000 + 10 * BASE_POD_COST * MODEL_SIZES[company.sizeKey].minCompute;
  const memoryStepCost = 325000 + 6 * BASE_POD_COST * MODEL_SIZES[company.sizeKey].minCompute;
  const contextStepCost = 180000 + 4 * BASE_POD_COST * MODEL_SIZES[company.sizeKey].minCompute;

  const targetDataUnits = clamp(
    Math.floor((availableBudget * 0.15) / Math.max(1, dataStepCost)),
    2,
    18,
  );
  const trainingDataUnits = releaseKind === "new" ? targetDataUnits : Math.max(2, Math.floor(targetDataUnits * 0.9));
  availableBudget -= trainingDataUnits * dataStepCost;

  const paramStepBudget = Math.max(0, availableBudget * 0.55);
  availableBudget -= paramStepBudget;
  const memoryStepBudget = Math.max(0, availableBudget * 0.55);
  availableBudget -= memoryStepBudget;
  const contextStepBudget = availableBudget;

  const maxMemorySize = getMemorySizeLimit(baseMemorySize, 6);
  const maxContextWindow = getContextWindowLimit(baseContextWindow, maxMemorySize, baseMemorySize) + 128;

  let rawParameterSteps = paramStepBudget / paramStepCost;
  let rawMemorySteps = memoryStepBudget / memoryStepCost;
  let rawContextSteps = contextStepBudget / contextStepCost;
  const parameterLimit = getParameterScaleLimit(company.sizeKey, baseParameterScale, trainingDataUnits);

  let targetParameterScale = baseParameterScale + rawParameterSteps * getParameterStep(company.sizeKey) * (releaseKind === "branch" ? 0.38 : 0.48);
  if (targetParameterScale > parameterLimit) {
    targetParameterScale = parameterLimit;
    rawParameterSteps = Math.max(0, targetParameterScale - baseParameterScale) / (getParameterStep(company.sizeKey) * (releaseKind === "branch" ? 0.38 : 0.48));
  }
  const parameterScale = clamp(Number(targetParameterScale.toFixed(1)), baseParameterScale, parameterLimit);

  let targetMemorySize = baseMemorySize + Math.max(1, Math.round(rawMemorySteps * (releaseKind === "branch" ? 0.45 : 0.55))) * 8;
  if (targetMemorySize > maxMemorySize) {
    targetMemorySize = maxMemorySize;
    rawMemorySteps = Math.max(0, (targetMemorySize - baseMemorySize) / 8 / (releaseKind === "branch" ? 0.45 : 0.55));
  }
  const memorySize = targetMemorySize;

  let targetContextWindow = baseContextWindow + Math.max(1, Math.round(rawContextSteps * (releaseKind === "branch" ? 0.75 : 0.62))) * 8;
  if (targetContextWindow > maxContextWindow) {
    targetContextWindow = maxContextWindow;
    rawContextSteps = Math.max(0, (targetContextWindow - baseContextWindow) / 8 / (releaseKind === "branch" ? 0.75 : 0.62));
  }
  const contextWindow = targetContextWindow;

  const actualArchitectureCost = (rawParameterSteps * paramStepCost) + (rawMemorySteps * memoryStepCost) + (rawContextSteps * contextStepCost) + (trainingDataUnits * dataStepCost);
  const totalCost = Math.round(goalCost.totalCost + actualArchitectureCost);
  if (totalCost > competitor.cash) return null;

  const lineageBaseCapability = previousRow
    ? Math.max(
      MODEL_SIZES[company.sizeKey].baseCapability,
      previousRow.capability - getGoalAverage(previousRow.goals) * 0.35 + (releaseKind === "branch" ? 2 : 4),
    )
    : MODEL_SIZES[company.sizeKey].baseCapability;
  const currentCapabilityRating =
    lineageBaseCapability +
    DATA_TIERS[company.dataTier].capability +
    (parameterScale - baseParameterScale) * TRAINING_PARAMETER_EXPANSION_CAPABILITY +
    (memorySize - baseMemorySize) * TRAINING_MEMORY_EXPANSION_CAPABILITY +
    (contextWindow - baseContextWindow) * TRAINING_CONTEXT_EXPANSION_CAPABILITY +
    trainingDataUnits * DATA_TIERS[company.dataTier].quality * TRAINING_DATA_CAPABILITY +
    behavior.capabilityMomentum;
  const capability = Math.max(1, Math.round(currentCapabilityRating * capabilityMultiplier));

  const priceMultiplier = admin.behavior === "aggressive" ? 0.8 : admin.behavior === "disciplined" ? 1.3 : 1.0;
  let hasChat = true;
  let hasAPI = true;
  if (admin.strategy === "enterprise" && releaseKind === "branch") hasChat = false;
  if (admin.strategy === "consumer" && releaseKind === "branch") hasAPI = false;

  const chatPrice = hasChat ? Math.max(10, Math.round(18 * priceMultiplier + capability * 0.005)) : null;
  const apiPrice = hasAPI ? Number(Math.max(0.5, 1.5 * priceMultiplier + parameterScale * 0.001).toFixed(2)) : null;

  return {
    model: {
      name: currentFamilyName,
      version: roundVersion(company.versionBase + monthBuilt / 12 + behavior.versionPaceBonus + competitor.releaseIndex * 0.04),
      developmentCost: totalCost,
      capability,
      memorySize,
      parameterScale,
      contextWindow,
      goals: { ...displayGoals },
      monthBuilt,
      releaseMonth: monthBuilt,
      chatPrice,
      apiPrice,
      subscribersByCohort: createEmptyCohortSubscriberMap(),
      reliability: Object.fromEntries(
        RELIABILITY_TIER_IDS.map((tier) => [tier, Math.min(0.9, competitor.releaseIndex * 0.15 + (admin.strategy === "balanced" ? 0.3 : 0.5))]),
      ) as Record<ReliabilityTierId, number>,
    },
    totalCost,
    currentFamilyName,
  };
}

export function createInitialCompetitorCompanyState(
  goalEconomics: GameState["goalEconomics"],
  company: CompetitorCompanyDefinition,
  companyIndex: number,
): GameState["competitorCompanies"][string] {
  const admin = getDefaultCompetitorAdminState(company.id);
  const baseState: GameState["competitorCompanies"][string] = {
    id: company.id,
    cash: company.startingCapitalMillions * 1000000,
    revenueHistory: [],
    profitHistory: [],
    models: [],
    releaseIndex: 0,
    nextReleaseMonth: 1,
    currentFamilyName: `${company.name.split(" ")[0]} ${COMPETITOR_RELEASE_FAMILIES[companyIndex % COMPETITOR_RELEASE_FAMILIES.length]}`,
  };
  const initialRelease = buildCompetitorRelease(goalEconomics, company, companyIndex, baseState, admin, 1);
  if (!initialRelease) return baseState;

  const nextReleaseIndex = 1;
  return {
    ...baseState,
    cash: baseState.cash - initialRelease.totalCost,
    models: [initialRelease.model],
    releaseIndex: nextReleaseIndex,
    nextReleaseMonth: 1 + getCompetitorDevelopmentMonths(admin.behavior, getCompetitorReleaseKind(nextReleaseIndex), companyIndex, nextReleaseIndex),
    currentFamilyName: initialRelease.currentFamilyName,
  };
}

export function getCompetitorCompanyState(
  game: GameState,
  competitorId: string,
  companyIndex?: number,
) {
  const existing = game.competitorCompanies[competitorId];
  if (existing) return existing;
  const company =
    getCompetitorCompanyDefinition(competitorId) ??
    COMPETITOR_COMPANIES[Math.max(0, companyIndex ?? 0)];
  const index = companyIndex ?? COMPETITOR_COMPANIES.findIndex((entry) => entry.id === company.id);
  return createInitialCompetitorCompanyState(game.goalEconomics, company, Math.max(0, index));
}

export function updateCompetitorCompanies(
  game: GameState,
  notify: (game: GameState, text: string, tone?: NotificationTone) => void,
) {
  const playerTopCapability = getBestCapability(game);
  const playerRevenuePenetration = clamp(
    (game.products.chatbot.activeUsers / 50000) * 0.4 +
    (game.products.api.activeUsers / 500) * 0.6,
    0,
    0.35,
  );

  COMPETITOR_COMPANIES.forEach((company, index) => {
    const admin = getCompetitorAdminState(game, company.id);
    const behavior = getCompetitorBehaviorProfile(admin.behavior);
    const competitor = getCompetitorCompanyState(game, company.id, index);
    const averageCapability = competitor.models.length
      ? competitor.models.reduce((sum, model) => sum + model.capability, 0) / competitor.models.length
      : MODEL_SIZES[company.sizeKey].baseCapability + DATA_TIERS[company.dataTier].capability;
    const topCapability = competitor.models.length
      ? Math.max(...competitor.models.map((model) => model.capability))
      : averageCapability;
    const capabilityPressure = clamp((playerTopCapability - topCapability) * 0.006, -0.05, 0.22);
    const competitorShareMultiplier = clamp(1 - capabilityPressure - playerRevenuePenetration, 0.5, 1.05);
    const monthlyRevenue = Math.round(
      ((company.startingCapitalMillions * 2800000 * behavior.revenueMultiplier + averageCapability * 420000 + topCapability * 180000) / 12) *
      (competitor.models.length ? 1 : 0.4) *
      competitorShareMultiplier *
      getMonthlyUserMultiplier(game),
    );
    const monthlyMargin = clamp(0.03 + averageCapability / 2600 + behavior.profitMarginBonus, 0.02, 0.26);
    const monthlyProfit = Math.round(monthlyRevenue * monthlyMargin);
    const monthlyOperatingCost = monthlyRevenue - monthlyProfit;

    competitor.cash = Math.round(competitor.cash + monthlyRevenue - monthlyOperatingCost);
    competitor.revenueHistory.push(monthlyRevenue);
    competitor.revenueHistory = competitor.revenueHistory.slice(-12);
    competitor.profitHistory.push(monthlyProfit);
    competitor.profitHistory = competitor.profitHistory.slice(-12);

    if (game.turn < competitor.nextReleaseMonth) {
      game.competitorCompanies[company.id] = competitor;
      return;
    }

    const release = buildCompetitorRelease(game.goalEconomics, company, index, competitor, admin, game.turn);
    if (!release) {
      competitor.nextReleaseMonth = game.turn + 1;
      game.competitorCompanies[company.id] = competitor;
      return;
    }

    competitor.cash = Math.round(competitor.cash - release.totalCost);
    competitor.models.unshift(release.model);
    const launchCapabilityLead = release.model.capability - game.marketStandard;
    if (launchCapabilityLead >= 10) {
      const shockMagnitude = clamp(launchCapabilityLead * COMPETITOR_RELEASE_SHOCK_COEFFICIENT, 0.02, 0.07);
      game.competitorLaunchShock = Math.min(0.12, game.competitorLaunchShock + shockMagnitude);
      notify(game, `${company.name} launched a powerful new model. Expect elevated user churn.`, "bad");
    }
    competitor.releaseIndex += 1;
    competitor.currentFamilyName = release.currentFamilyName;
    competitor.nextReleaseMonth =
      game.turn +
      getCompetitorDevelopmentMonths(admin.behavior, getCompetitorReleaseKind(competitor.releaseIndex), index, competitor.releaseIndex);
    game.competitorCompanies[company.id] = competitor;
  });
}
