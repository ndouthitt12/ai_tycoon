import {
  ARCHETYPES,
  BASE_OPS_COST,
  BASE_POD_COST,
  BOARD_DIRECTIVES,
  COMPETITOR_COMPANIES,
  COMPETITOR_STRATEGIES,
  createEmptyCohortSubscriberMap,
  RELIABILITY_TIER_IDS,
  RELIABILITY_TIERS,
  DATA_TIERS,
  DATASET_PACKS,
  DEFAULT_GOAL_ECONOMICS,
  GLOBAL_COHORT_IDS,
  GLOBAL_COHORTS,
  MODEL_SIZES,
  MONTHS,
  PRODUCT_TYPES,
  ROLE_LABELS,
  RIVALS,
  SALARIES,
  SURGE_POD_COST,
  UPGRADES,
} from "./defs";
import {
  ActiveRun,
  ArchetypeId,
  BoardDirectiveId,
  CompetitorCompanyDefinition,
  CohortDef,
  CohortId,
  CompetitorModelState,
  ModelState,
  ArchetypeModifiers,
  DataTierId,
  GameState,
  MarketModifier,
  MarketModifierId,
  ModelGoalId,
  NotificationTone,
  PendingBoardReview,
  PendingEvent,
  ProductState,
  SubscriptionPlan,
  ProductTypeId,
  RoleId,
  RivalId,
  ReliabilityTierId,
  TrainingConfig,
  UpgradeId,
} from "./types";
import { getMarketCompanyTable as getMarketCompanyTableSystem, getMarketComparison as getMarketComparisonSystem, getMarketModelTable as getMarketModelTableSystem, getProductComputeUsage as getProductComputeUsageSystem, getProjectedServingDemand as getProjectedServingDemandSystem, settleGlobalMarket as settleGlobalMarketSystem, updateModelPerformance as updateModelPerformanceSystem } from "./systems/market";
import { createInitialCompetitorCompanyState as createInitialCompetitorCompanyStateSystem, getCompetitorCompanyDefinition as getCompetitorCompanyDefinitionSystem, getCompetitorCompanyState as getCompetitorCompanyStateSystem, updateCompetitorCompanies as updateCompetitorCompaniesSystem } from "./systems/competitors";
import { calculateRunPreview as calculateRunPreviewSystem, getContextWindowLimit as getContextWindowLimitSystem, getDatasetPurchaseCost as getDatasetPurchaseCostSystem, getGoalCapabilityLift as getGoalCapabilityLiftSystem, getMemorySizeLimit as getMemorySizeLimitSystem, getResearchContribution as getResearchContributionSystem, launchRun as launchRunSystem } from "./systems/training";
import { copyGame as copyGameSystem } from "./systems/state";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

export function money(value: number) {
  if (isNaN(value)) return "$0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1000000000) return `${sign}$${(abs / 1000000000).toFixed(2)}B`;
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatPods(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
  if (abs >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value.toFixed(0)}`;
}

export function pct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

export function formatBigParams(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}Qi`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}Qa`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}T`;
  return `${value.toFixed(1)}B`;
}

export function formatBigMemory(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}EB`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}PB`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}TB`;
  return `${value.toFixed(0)} GB`;
}

export function formatBigContext(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}B`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}M`;
  return `${value.toFixed(0)}K`;
}

export function getLoanTerms(principal: number, term: number) {
  if (term <= 0) return { feePct: 0, totalRepayment: 0, monthlyPayment: 0 };
  if (term <= 6) {
    return {
      feePct: 0,
      totalRepayment: principal,
      monthlyPayment: principal / term,
    };
  }
  const feePct = Math.min(0.25, (term - 6) * (0.25 / 114));
  const totalRepayment = principal * (1 + feePct);
  const monthlyPayment = totalRepayment / term;
  return { feePct, totalRepayment, monthlyPayment };
}

function roundVersion(value: number) {
  return Number(value.toFixed(3));
}

export function formatVersion(value: number) {
  const rounded = roundVersion(value);
  return rounded.toFixed(3).replace(/\.?0+$/, (match) => (match.includes(".") ? ".0" : ""));
}

function getMinimumUpgradeVersion(baseVersion: number) {
  return roundVersion(baseVersion + 0.001);
}

function normalizeUpgradeVersion(value: number, baseVersion: number) {
  return Math.max(getMinimumUpgradeVersion(baseVersion), roundVersion(value));
}

export function getEngineerTrainingMultiplier(level: number) {
  return 1 + level * 0.1;
}

export function getEngineerTrainingCostRange(game: Pick<GameState, "headcount">) {
  const engineerCount = game.headcount.engineers;
  return {
    min: engineerCount * 8000,
    max: engineerCount * 15000,
  };
}

export function getEngineerFailureRiskReduction(game: Pick<GameState, "headcount" | "upgrades" | "engineerTrainingLevel">) {
  return game.headcount.engineers * 0.015 * getEngineerTrainingMultiplier(game.engineerTrainingLevel) + game.upgrades.training * 0.03;
}

export function monthLabel(turn: number) {
  const idx = (turn - 1) % 12;
  const year = 2026 + Math.floor((turn - 1) / 12);
  return `${MONTHS[idx]} ${year}`;
}

export function linePathFromPoints(points: number[], width = 320, height = 96) {
  if (!points.length) return "";
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(0.001, max - min);
  return points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function getQuarterNumber(turn: number) {
  return Math.floor((turn - 1) / 3) + 1;
}

export function copyGame(game: GameState): GameState {
  return copyGameSystem(game);
}

export function getArchetype(game: GameState) {
  return ARCHETYPES[game.archetype];
}

export function getDirective(game: GameState) {
  return game.currentDirective ? BOARD_DIRECTIVES[game.currentDirective] : null;
}

export function getHeadcountTotal(game: GameState) {
  return Object.values(game.headcount).reduce((sum, count) => sum + count, 0);
}

export function getPayroll(game: Pick<GameState, "headcount">) {
  return (Object.entries(game.headcount) as [RoleId, number][])
    .reduce((sum, [role, count]) => sum + count * SALARIES[role], 0);
}

export function getModelById(game: GameState, id: number | null) {
  return game.models.find((model) => model.id === id) || null;
}

function getProductModels(game: GameState, product: ProductState) {
  return product.modelIds
    .map((id) => getModelById(game, id))
    .filter((model): model is NonNullable<ReturnType<typeof getModelById>> => Boolean(model));
}

function getModelPrice(product: ProductState, modelId: number) {
  return product.modelPrices[String(modelId)] ?? product.price;
}

function getGoalTotal(goals: TrainingConfig["goals"]) {
  return Object.values(goals).reduce((sum, value) => sum + value, 0);
}

function getActiveGoalCount(goals: TrainingConfig["goals"]) {
  return Object.values(goals).filter((value) => value > 1).length;
}

function getGoalIntensity(goals: TrainingConfig["goals"], key: keyof TrainingConfig["goals"]) {
  return Math.sqrt(Math.max(1, goals[key]));
}

function getGoalShare(goals: TrainingConfig["goals"], key: keyof TrainingConfig["goals"]) {
  const total = Math.max(1, getGoalTotal(goals));
  return goals[key] / total;
}

function getGoalAverage(goals: TrainingConfig["goals"]) {
  return getGoalTotal(goals) / Object.keys(goals).length;
}

function getCapabilityFromCurrentRating(currentRating: number, goals: TrainingConfig["goals"]) {
  return Math.round(Math.max(1, currentRating + getGoalAverage(goals)));
}

function getDefaultCompetitorAdminState(competitorId?: string) {
  const company = competitorId ? getCompetitorCompanyDefinition(competitorId) : null;
  return {
    capitalAddedMillions: 0,
    behavior: company?.defaultBehavior ?? "balanced",
    strategy: company?.defaultStrategy ?? "balanced",
    capabilityModifier: company?.defaultCapabilityModifier ?? 1,
    goalModifiers: { ...(company?.defaultGoalModifiers ?? {}) },
  };
}

function createDefaultModelPerformance(): GameState["modelPerformance"][string] {
  return {
    totalRevenue: 0,
    lastMonthRevenue: 0,
    lastMonthAcquisition: 0,
    lastMonthChurn: 0,
    lastMonthUsers: 0,
  };
}

export function getMarketingSpendMultiplier(marketingBudgetMillions: number, alpha: number) {
  return 1 + Math.log1p(Math.max(0, marketingBudgetMillions) / Math.max(0.0001, alpha));
}

function getMonthlyUserMultiplier(game: Pick<GameState, "monthlyUserMultiplier">) {
  return clamp(Number(game.monthlyUserMultiplier) || 1, 0.1, 10);
}

function getCompetitorAdminState(game: GameState, competitorId: string) {
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

const COMPETITOR_RELEASE_FAMILIES = ["Core", "Nova", "Prime", "Vector", "Forge", "Pulse", "Halo", "Axis"];

function getCompetitorReleaseKind(releaseIndex: number): "new" | "upgrade" | "branch" {
  if (releaseIndex === 0) return "new";
  return releaseIndex % 4 === 1 ? "upgrade" : releaseIndex % 4 === 2 ? "branch" : "upgrade";
}

function getCompetitorEconomicGoals(
  goals: Record<ModelGoalId, number>,
  releaseKind: "new" | "upgrade" | "branch",
  modifiers?: Partial<Record<ModelGoalId, number>>
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

function getCompetitorCompanyDefinition(competitorId: string) {
  return getCompetitorCompanyDefinitionSystem(competitorId);
}

function getCompetitorCompanyState(
  game: GameState,
  competitorId: string,
  companyIndex?: number,
) {
  return getCompetitorCompanyStateSystem(game, competitorId, companyIndex);
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
  const memoryStepBudget = Math.max(0, availableBudget * 0.55); // Take 55% of remainder
  availableBudget -= memoryStepBudget;
  const contextStepBudget = availableBudget; // Remainder to context

  const maxMemorySize = getMemorySizeLimit(baseMemorySize, 6); // Forgiving level 6 cap
  const maxContextWindow = getContextWindowLimit(baseContextWindow, maxMemorySize, baseMemorySize) + 128; // Plus extra 128k generosity

  let rawParameterSteps = paramStepBudget / paramStepCost;
  let rawMemorySteps = memoryStepBudget / memoryStepCost;
  let rawContextSteps = contextStepBudget / contextStepCost;

  const parameterLimit = getParameterScaleLimit(company.sizeKey, baseParameterScale, trainingDataUnits);

  let targetParameterScale = baseParameterScale + rawParameterSteps * getParameterStep(company.sizeKey) * (releaseKind === "branch" ? 0.38 : 0.48);
  if (targetParameterScale > parameterLimit) {
    targetParameterScale = parameterLimit;
    rawParameterSteps = Math.max(0, (targetParameterScale - baseParameterScale)) / (getParameterStep(company.sizeKey) * (releaseKind === "branch" ? 0.38 : 0.48));
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
    (parameterScale - baseParameterScale) * 0.38 +
    (memorySize - baseMemorySize) * 0.32 +
    (contextWindow - baseContextWindow) * 0.12 +
    trainingDataUnits * DATA_TIERS[company.dataTier].quality * 0.9 +
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
      reliability: Object.fromEntries(RELIABILITY_TIER_IDS.map(tier => [tier, Math.min(0.9, competitor.releaseIndex * 0.15 + (admin.strategy === "balanced" ? 0.3 : 0.5))])) as Record<ReliabilityTierId, number>,
    },
    totalCost,
    currentFamilyName,
  };
}

function createInitialCompetitorCompanyState(
  goalEconomics: GameState["goalEconomics"],
  company: CompetitorCompanyDefinition,
  companyIndex: number,
): GameState["competitorCompanies"][string] {
  return createInitialCompetitorCompanyStateSystem(goalEconomics, company, companyIndex);
}

function updateCompetitorCompanies(game: GameState) {
  updateCompetitorCompaniesSystem(game, addNotification);
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

function getGoalDevelopmentCost(
  goalEconomics: GameState["goalEconomics"],
  goals: TrainingConfig["goals"],
  baseCost: number,
  baselineGoals?: Partial<TrainingConfig["goals"]> | null,
) {
  const fixedCost = Object.entries(goals).reduce((sum, [goalId, value]) => {
    const rule = goalEconomics[goalId as keyof typeof goalEconomics];
    const baselineValue = baselineGoals?.[goalId as keyof TrainingConfig["goals"]] ?? 0;
    const increase = Math.max(0, value - baselineValue);
    return sum + increase * rule.fixedCostMillions * 1000000;
  }, 0);
  const percentRate = Object.entries(goals).reduce((sum, [goalId, value]) => {
    const rule = goalEconomics[goalId as keyof typeof goalEconomics];
    const baselineValue = baselineGoals?.[goalId as keyof TrainingConfig["goals"]] ?? 0;
    const increase = Math.max(0, value - baselineValue);
    return sum + increase * rule.percentOfBaseCost;
  }, 0);
  const percentCost = baseCost * (percentRate / 100);

  return {
    fixedCost,
    percentCost,
    totalCost: fixedCost + percentCost,
  };
}

function getParameterCapacitySteps(size: keyof typeof BASE_PARAMETER_SCALE, trainingDataUnits: number) {
  const normalizedUnits = clamp(Math.round(trainingDataUnits), 1, 24);
  return 4 + normalizedUnits * (size === "frontier" ? 1.4 : size === "large" ? 1.7 : 2);
}

function getParameterScaleLimit(size: keyof typeof BASE_PARAMETER_SCALE, baseParameterScale: number, trainingDataUnits: number) {
  return baseParameterScale + getParameterStep(size) * getParameterCapacitySteps(size, trainingDataUnits);
}

const BASE_MEMORY_SIZE = {
  small: 8,
  medium: 16,
  large: 32,
  frontier: 64,
} as const;

const BASE_PARAMETER_SCALE = {
  small: 8,
  medium: 22,
  large: 56,
  frontier: 120,
} as const;

const BASE_CONTEXT_WINDOW = {
  small: 8,
  medium: 16,
  large: 32,
  frontier: 64,
} as const;

function getBaseMemorySize(size: keyof typeof BASE_MEMORY_SIZE) {
  return BASE_MEMORY_SIZE[size];
}

function getBaseParameterScale(size: keyof typeof BASE_PARAMETER_SCALE) {
  return BASE_PARAMETER_SCALE[size];
}

function getBaseContextWindow(size: keyof typeof BASE_CONTEXT_WINDOW) {
  return BASE_CONTEXT_WINDOW[size];
}

function getParameterStep(size: keyof typeof BASE_PARAMETER_SCALE) {
  if (size === "small") return 2;
  if (size === "medium") return 5;
  if (size === "large") return 12;
  return 24;
}

function getTrainingTargets(size: keyof typeof BASE_MEMORY_SIZE) {
  return {
    memorySize: getBaseMemorySize(size),
    parameterScale: getBaseParameterScale(size),
    contextWindow: getBaseContextWindow(size),
  };
}

function getModelGoalScores(model: GameState["models"][number]) {
  const capabilitySignal = model.capability;
  const speedSignal = clamp(100 - model.inferenceCost * 14, 20, 98);
  const contextSignal = clamp(20 + model.contextWindow * 0.9, 20, 98);
  const trustSignal = model.trust;

  return {
    speed: Math.max(15, 18 + speedSignal * 0.56 + capabilitySignal * 0.14 + getGoalShare(model.goals, "speed") * 26),
    accuracy: Math.max(15, 20 + capabilitySignal * 0.45 + trustSignal * 0.18 + getGoalShare(model.goals, "accuracy") * 28),
    reasoning: Math.max(15, 16 + capabilitySignal * 0.42 + contextSignal * 0.36 + getGoalShare(model.goals, "reasoning") * 30),
    agentic: Math.max(15, 14 + capabilitySignal * 0.32 + contextSignal * 0.32 + trustSignal * 0.12 + getGoalShare(model.goals, "agentic") * 32),
    coding: Math.max(15, 16 + capabilitySignal * 0.38 + contextSignal * 0.18 + getGoalShare(model.goals, "coding") * 30),
    multimodal: Math.max(15, 16 + capabilitySignal * 0.34 + contextSignal * 0.22 + getGoalShare(model.goals, "multimodal") * 28),
  };
}

function getGoalFitScore(goalScores: ReturnType<typeof getModelGoalScores>, productType: ProductTypeId) {
  if (productType === "chatbot") {
    return (
      goalScores.speed * 0.22 +
      goalScores.accuracy * 0.2 +
      goalScores.reasoning * 0.25 +
      goalScores.agentic * 0.13 +
      goalScores.coding * 0.05 +
      goalScores.multimodal * 0.15
    );
  }

  return (
    goalScores.speed * 0.24 +
    goalScores.accuracy * 0.21 +
    goalScores.reasoning * 0.14 +
    goalScores.agentic * 0.15 +
    goalScores.coding * 0.2 +
    goalScores.multimodal * 0.06
  );
}

export function getMarketComparison(capability: number, marketStandard: number) {
  return getMarketComparisonSystem(capability, marketStandard);
}

export function getUpgradeCost(key: UpgradeId, level: number) {
  const seedCosts = UPGRADES[key].costs;
  if (level < seedCosts.length) return seedCosts[level];

  let cost = seedCosts[seedCosts.length - 1];
  for (let currentLevel = seedCosts.length; currentLevel <= level; currentLevel += 1) {
    cost = Math.round(cost * 1.85);
  }
  return cost;
}

export function getMemorySizeLimit(baseMemorySize: number, inferenceUpgradeLevel: number, trainingDataUnits = 1) {
  return getMemorySizeLimitSystem(baseMemorySize, inferenceUpgradeLevel, trainingDataUnits);
}

export function getContextWindowLimit(baseContextWindow: number, targetMemorySize: number, baseMemorySize: number) {
  return getContextWindowLimitSystem(baseContextWindow, targetMemorySize, baseMemorySize);
}

function getBlendedModelMetrics(game: GameState, product: ProductState) {
  const models = getProductModels(game, product);
  if (!models.length) return null;

  const averageCapability = models.reduce((sum, model) => sum + model.capability, 0) / models.length;
  const bestCapability = Math.max(...models.map((model) => model.capability));
  const inferenceCost = models.reduce((sum, model) => sum + model.inferenceCost, 0) / models.length;
  const trust = models.reduce((sum, model) => sum + model.trust, 0) / models.length;
  const contextWindow = models.reduce((sum, model) => sum + model.contextWindow, 0) / models.length;
  const averagePrice = models.reduce((sum, model) => sum + getModelPrice(product, model.id), 0) / models.length;
  const averageAge = models.reduce((sum, model) => sum + Math.max(0, game.turn - model.monthBuilt), 0) / models.length;
  const recencyScore = models.reduce(
    (sum, model) => sum + clamp((18 - Math.max(0, game.turn - model.monthBuilt)) / 18, 0.2, 1),
    0,
  ) / models.length;
  const goalScores = models.reduce(
    (aggregate, model) => {
      const scores = getModelGoalScores(model);
      return {
        speed: aggregate.speed + scores.speed,
        accuracy: aggregate.accuracy + scores.accuracy,
        reasoning: aggregate.reasoning + scores.reasoning,
        agentic: aggregate.agentic + scores.agentic,
        coding: aggregate.coding + scores.coding,
        multimodal: aggregate.multimodal + scores.multimodal,
      };
    },
    { speed: 0, accuracy: 0, reasoning: 0, agentic: 0, coding: 0, multimodal: 0 },
  );
  const averagedGoalScores = {
    speed: goalScores.speed / models.length,
    accuracy: goalScores.accuracy / models.length,
    reasoning: goalScores.reasoning / models.length,
    agentic: goalScores.agentic / models.length,
    coding: goalScores.coding / models.length,
    multimodal: goalScores.multimodal / models.length,
  };

  return {
    models,
    averageCapability,
    bestCapability,
    inferenceCost,
    trust,
    contextWindow,
    averagePrice,
    averageAge,
    recencyScore,
    goalFit: getGoalFitScore(averagedGoalScores, product.type),
    goalScores: averagedGoalScores,
  };
}

export function getBestCapability(game: GameState) {
  return game.models.length ? Math.max(...game.models.map((model) => model.capability)) : 0;
}

export function getReservedCostPerPod(game: GameState) {
  return Math.max(2500, BASE_POD_COST - game.upgrades.cloud * 450);
}

// The going market rate competitors are willing to pay per pod per month.
// Priced below the player's own reserved cost so renting only makes sense
// when the player has genuine surplus, not as a primary business model.
export const CLOUD_RENTAL_MARKET_RATE = 2800;

function settleCloudRental(
  game: GameState,
  surplusPods: number,
): { revenue: number; podsRented: number } {
  const { pricePerPod } = game.cloudRental;
  if (pricePerPod <= 0 || surplusPods <= 0) return { revenue: 0, podsRented: 0 };

  // Competitor demand grows with game progression and the number of active models
  // they have in the market (more models = more serving needs).
  const totalCompetitorModels = Object.values(game.competitorCompanies).reduce(
    (sum, c) => sum + c.models.length,
    0,
  );
  const baseDemand = Math.round(game.turn * 10 + totalCompetitorModels * 30 + 60);

  // Price sensitivity: at or below market rate demand is fully met;
  // above market rate demand falls off exponentially.
  const ratio = pricePerPod / CLOUD_RENTAL_MARKET_RATE;
  const demandMultiplier = ratio <= 1 ? 1 : Math.exp(-3.5 * (ratio - 1));

  const podsRented = Math.min(surplusPods, Math.round(baseDemand * demandMultiplier));
  const revenue = podsRented * pricePerPod;
  return { revenue, podsRented };
}

export function updateCloudRentalPrice(game: GameState, pricePerPod: number): GameState {
  const next = copyGame(game);
  next.cloudRental.pricePerPod = Math.max(0, Math.round(pricePerPod));
  return next;
}

export function getDatacenterBuildCost(pods: number) {
  const normalizedPods = clamp(Math.round(pods), 8, 240);
  return 900000 + normalizedPods * 125000;
}

export function getDatasetPurchaseCost(tierKey: DataTierId, packId: keyof typeof DATASET_PACKS) {
  return getDatasetPurchaseCostSystem(tierKey, packId);
}

export function getResearchContribution(game: GameState) {
  return getResearchContributionSystem(game);
}

export function getRunwayMonths(game: GameState) {
  return game.lastMonth.profit < 0 ? game.cash / Math.max(1, -game.lastMonth.profit) : Infinity;
}

export function getProductComputeUsage(
  game: GameState,
  product: ProductState,
  metrics: ReturnType<typeof getBlendedModelMetrics>
): { demand: number; tokensMillions: number } {
  return getProductComputeUsageSystem(game, product, metrics);
}

export function getProjectedServingDemand(game: GameState) {
  return getProjectedServingDemandSystem(game);
}

export function getMarketModelTable(game: GameState) {
  return getMarketModelTableSystem(game);
}

export function getMarketCompanyTable(game: GameState) {
  return getMarketCompanyTableSystem(game);
}

function addNotification(game: GameState, text: string, tone: NotificationTone = "info") {
  game.notifications.unshift({ id: game.nextId++, text, tone });
  game.notifications = game.notifications.slice(0, 12);
}

function generateLossCurve(totalMonths: number, severity = 0) {
  const points: number[] = [];
  let current = rand(2.4, 3.2);
  for (let index = 0; index < totalMonths; index += 1) {
    const trend = 0.18 + index * 0.02;
    current -= trend * rand(0.7, 1.15);
    current += rand(-0.08, 0.12);
    if (severity > 0 && index === Math.max(1, Math.floor(totalMonths / 2))) {
      current += severity;
    }
    points.push(Math.max(0.35, Number(current.toFixed(2))));
  }
  return points;
}

function nextRivalCooldown(rivalId: RivalId) {
  const [min, max] = RIVALS[rivalId].cadence;
  return randInt(min, max);
}

function getDirectiveEffects(game: GameState) {
  return {
    chatbotAcquisitionMultiplier:
      game.currentDirective === "growth"
        ? 1.18
        : game.currentDirective === "profitability"
          ? 0.9
          : game.currentDirective === "enterprise_trust"
            ? 0.88
            : 1,
    apiAcquisitionMultiplier:
      game.currentDirective === "enterprise_trust"
        ? 1.08
        : game.currentDirective === "profitability"
          ? 0.92
          : 1,
    consumerDistributionMultiplier:
      game.currentDirective === "growth"
        ? 1.3
        : game.currentDirective === "enterprise_trust"
          ? 0.78
          : 1,
    enterpriseDistributionMultiplier: game.currentDirective === "enterprise_trust" ? 1.32 : 1,
    apiRetentionBonus: game.currentDirective === "enterprise_trust" ? 0.01 : 0,
    reservedCostMultiplier: game.currentDirective === "profitability" ? 0.9 : 1,
    overflowCostMultiplier: game.currentDirective === "profitability" ? 0.82 : 1,
    frontierCapabilityBonus: game.currentDirective === "frontier_research" ? 4 : 0,
    frontierRiskPenalty: game.currentDirective === "frontier_research" ? 0.06 : 0,
    fundingPrestigeBonus:
      game.currentDirective === "frontier_research"
        ? 8
        : game.currentDirective === "profitability"
          ? 4
          : 0,
  };
}

function getModifierIntensity(game: GameState, type: MarketModifierId) {
  const raw = game.marketModifiers
    .filter((modifier) => modifier.type === type)
    .reduce((sum, modifier) => sum + modifier.intensity, 0);

  if (type === "commoditization") {
    return raw * (1 - getArchetype(game).modifiers.commoditizationResistance);
  }

  return raw;
}

function upsertMarketModifier(game: GameState, modifier: Omit<MarketModifier, "id">) {
  const existing = game.marketModifiers.find(
    (entry) => entry.type === modifier.type && entry.source === modifier.source,
  );

  if (existing) {
    existing.turnsRemaining = modifier.turnsRemaining;
    existing.intensity = modifier.intensity;
    existing.title = modifier.title;
    existing.description = modifier.description;
    return;
  }

  game.marketModifiers.push({
    id: game.nextId++,
    ...modifier,
  });
}

function createPendingBoardReview(game: GameState): PendingBoardReview {
  const reasons: string[] = [];
  const runwayMonths = getRunwayMonths(game);

  if (runwayMonths < 8) reasons.push("Runway tightened and the board wants a cleaner operating stance.");
  if (game.trust < 50) reasons.push("Trust slipped and enterprise confidence needs attention.");
  if (game.boardPressure > 60) reasons.push("Board pressure is elevated after recent execution misses.");
  if (game.lastMonth.profit > 0) reasons.push("Margins improved, but the board wants a sharper strategy for the next quarter.");
  if (reasons.length === 0) reasons.push("The company is stable enough to choose its next strategic push deliberately.");

  return {
    quarter: getQuarterNumber(game.turn),
    reasons,
  };
}

function createDefaultProducts(): GameState["products"] {
  return {
    chatbot: {
      type: "chatbot",
      modelIds: [],
      modelPrices: {},
      activeUsers: 0,
      tokenUsageMillions: 0,
      price: PRODUCT_TYPES.chatbot.defaultPrice,
      revenue: 0,
      computeDemand: 0,
      computeCost: 0,
      churn: 0,
      acquisition: 0,
      trust: 50,
      lastLaunchMonth: 0,
      subscriptionPlans: [
        { id: "free_tier", name: "Free Tier", price: 0, tokenLimitMillions: 100, subscribers: 0, revenue: 0, profit: 0, tokenUsageMillions: 0 },
        { id: "pro_tier", name: "Pro Tier", price: 20, tokenLimitMillions: 5000, subscribers: 0, revenue: 0, profit: 0, tokenUsageMillions: 0 }
      ]
    },
    api: {
      type: "api",
      modelIds: [],
      modelPrices: {},
      activeUsers: 0,
      tokenUsageMillions: 0,
      price: PRODUCT_TYPES.api.defaultPrice,
      revenue: 0,
      computeDemand: 0,
      computeCost: 0,
      churn: 0,
      acquisition: 0,
      trust: 50,
      lastLaunchMonth: 0,
    },
  };
}

function updateModelPerformance(game: GameState) {
  const nextPerformance: GameState["modelPerformance"] = Object.fromEntries(
    game.models.map((model) => [String(model.id), { ...(game.modelPerformance[String(model.id)] ?? createDefaultModelPerformance()) }]),
  );
  const churnWeightByModel: Record<string, number> = {};
  const churnTotalByModel: Record<string, number> = {};
  const monthlyUserMultiplier = getMonthlyUserMultiplier(game);

  Object.keys(nextPerformance).forEach((modelId) => {
    nextPerformance[modelId].lastMonthRevenue = 0;
    nextPerformance[modelId].lastMonthAcquisition = 0;
    nextPerformance[modelId].lastMonthChurn = 0;
    nextPerformance[modelId].lastMonthUsers = 0;
  });

  Object.values(game.products).forEach((product) => {
    if (!product.modelIds.length) return;
    const modelCount = product.modelIds.length;
    const totalLinePrice = product.modelIds.reduce((sum, modelId) => sum + (product.modelPrices[String(modelId)] ?? product.price), 0);
    const rawEndingUsers = Math.max(0, product.activeUsers / monthlyUserMultiplier);
    const rawStartingUsers =
      product.churn < 0.999
        ? Math.max(0, (rawEndingUsers - product.acquisition) / Math.max(0.001, 1 - product.churn))
        : 0;

    const modelAges: Record<string, number> = {};
    product.modelIds.forEach((modelId) => {
      const model = game.models.find((m) => m.id === modelId);
      modelAges[String(modelId)] = model ? Math.max(0, game.turn - model.monthBuilt) : 999;
    });
    const avgAge = Object.values(modelAges).reduce((sum, a) => sum + a, 0) / modelCount;
    const storedPriorUsers: Record<string, number> = {};
    product.modelIds.forEach((modelId) => {
      storedPriorUsers[String(modelId)] = Math.max(0, game.modelPerformance[String(modelId)]?.lastMonthUsers ?? 0);
    });
    const totalStoredPriorUsers = Object.values(storedPriorUsers).reduce((sum, value) => sum + value, 0);
    const acquisitionDecay = product.type === "chatbot" ? 0.9 : 0.97;
    const ageChurnCoefficient = product.type === "chatbot" ? 0.0045 : 0.0022;

    // Exponential decay: each month of age reduces acquisition weight by 3%.
    // No floor — old models genuinely trail off and differentiate from each other.
    const acquisitionWeights: Record<string, number> = {};
    product.modelIds.forEach((modelId) => {
      acquisitionWeights[String(modelId)] = Math.pow(acquisitionDecay, modelAges[String(modelId)]);
    });
    const totalWeight = Object.values(acquisitionWeights).reduce((sum, w) => sum + w, 0);

    product.modelIds.forEach((modelId) => {
      const key = String(modelId);
      const performance = nextPerformance[key] ?? createDefaultModelPerformance();
      const modelPrice = product.modelPrices[key] ?? product.price;
      const modelRevenue =
        totalLinePrice > 0 ? product.revenue * (modelPrice / totalLinePrice) : product.revenue / Math.max(1, modelCount);
      const acquisitionShare = product.acquisition * (acquisitionWeights[key] / totalWeight);

      // Per-model churn: shift the product churn rate by how much older/newer this
      // model is relative to the product average, using the same 0.0022 coefficient
      // already in the churn formula.
      const churnDelta = (modelAges[key] - avgAge) * ageChurnCoefficient;
      const modelChurn = clamp(product.churn + churnDelta, 0.005, 0.50);
      const priorUserShare = totalStoredPriorUsers > 0 ? storedPriorUsers[key] / totalStoredPriorUsers : 1 / modelCount;
      const startingUsersForModel = rawStartingUsers * priorUserShare;
      const endingUsersForModel = (startingUsersForModel * (1 - modelChurn) + acquisitionShare) * monthlyUserMultiplier;

      performance.totalRevenue = Math.round(performance.totalRevenue + modelRevenue);
      performance.lastMonthRevenue = Math.round(performance.lastMonthRevenue + modelRevenue);
      performance.lastMonthAcquisition = Number((performance.lastMonthAcquisition + acquisitionShare).toFixed(1));
      performance.lastMonthUsers = Number((performance.lastMonthUsers + endingUsersForModel).toFixed(1));
      nextPerformance[key] = performance;

      churnWeightByModel[key] = (churnWeightByModel[key] ?? 0) + endingUsersForModel;
      churnTotalByModel[key] = (churnTotalByModel[key] ?? 0) + modelChurn * endingUsersForModel;
    });
  });

  Object.keys(nextPerformance).forEach((modelId) => {
    nextPerformance[modelId].lastMonthChurn =
      churnWeightByModel[modelId] && churnWeightByModel[modelId] > 0
        ? churnTotalByModel[modelId] / churnWeightByModel[modelId]
        : 0;
  });

  game.modelPerformance = nextPerformance;
}

export function createInitialGame(archetypeId: ArchetypeId): GameState {
  const archetype = ARCHETYPES[archetypeId];
  const reservedPods = archetypeId === "frontier_lab" ? 52 : archetypeId === "consumer_ai_product_company" ? 42 : 38;
  const initialDatacenter = {
    id: 1,
    name: "Founding Campus",
    pods: reservedPods,
    buildCost: 0,
    monthBuilt: 1,
  };

  return {
    turn: 1,
    status: "playing",
    engineerTrainingLevel: 0,
    archetype: archetypeId,
    marketingBudgetMillions: 0,
    monthlyUserMultiplier: 1,
    trust: archetype.startingTrust,
    distribution: { ...archetype.startingDistribution },
    boardPressure: archetype.modifiers.startingBoardPressure,
    currentDirective: null,
    directiveTurnsRemaining: 0,
    marketStandard: archetype.startingMarketStandard,
    competitorLaunchShock: 0,
    rivals: {
      frontier_rival: { id: "frontier_rival", cooldown: nextRivalCooldown("frontier_rival"), lastAction: null },
      platform_giant: { id: "platform_giant", cooldown: nextRivalCooldown("platform_giant"), lastAction: null },
      open_model_rival: { id: "open_model_rival", cooldown: nextRivalCooldown("open_model_rival"), lastAction: null },
    },
    marketModifiers: [],
    headcount: { ...archetype.startingHeadcount },
    dataInventory: { ...archetype.startingDataInventory },
    upgrades: { training: 0, inference: 0, gtm: 0, cloud: 0 },
    cloud: {
      reservedPods,
      trainingPct: 55,
      datacenters: [initialDatacenter],
      nextDatacenterId: 2,
    },
    cloudRental: {
      pricePerPod: 0,
    },
    globalCohorts: JSON.parse(JSON.stringify(GLOBAL_COHORTS)),
    products: createDefaultProducts(),
    trainingConfig: {
      ...archetype.startingTrainingConfig,
      goals: { ...archetype.startingTrainingConfig.goals },
    },
    deficitMonths: 0,
    loans: [],
    activeRuns: [],
    models: [],
    modelPerformance: {},
    pendingEvent: null,
    pendingBoardReview: null,
    funding: { available: false, offer: 0, dilution: 0, lastRaisedTurn: 0 },
    totalDilution: 0,
    history: { revenue: [], profit: [], arr: [], trust: [], boardPressure: [] },
    goalEconomics: JSON.parse(JSON.stringify(DEFAULT_GOAL_ECONOMICS)),
    competitorAdmin: Object.fromEntries(
      COMPETITOR_COMPANIES.map((company) => [company.id, getDefaultCompetitorAdminState(company.id)]),
    ),
    competitorCompanies: Object.fromEntries(
      COMPETITOR_COMPANIES.map((company, index) => [
        company.id,
        createInitialCompetitorCompanyState(JSON.parse(JSON.stringify(DEFAULT_GOAL_ECONOMICS)), company, index),
      ]),
    ),
    notifications: [
      { id: 1, text: `${archetype.name} selected. ${archetype.summary}`, tone: "good" },
      {
        id: 2,
        text: "Board brief: pick a strategy, survive the compute bill, and do not let rivals define your lane.",
        tone: "info",
      },
      {
        id: 3,
        text: `Starting posture: Trust ${archetype.startingTrust}, Consumer Dist ${archetype.startingDistribution.consumer}, Enterprise Dist ${archetype.startingDistribution.enterprise}.`,
        tone: "warning",
      },
    ],
    lastMonth: {
      revenue: 0,
      expenses: reservedPods * BASE_POD_COST + BASE_OPS_COST,
      profit: -(reservedPods * BASE_POD_COST + BASE_OPS_COST),
      users: 0,
      payroll: getPayroll({ headcount: archetype.startingHeadcount }),
      marketingSpend: 0,
      computeReservedCost: reservedPods * BASE_POD_COST,
      overflowCost: 0,
      servingDemand: 0,
      trainingDemand: 0,
      trustDelta: 0,
      distributionDelta: { consumer: 0, enterprise: 0 },
      cloudRentalRevenue: 0,
      cloudRentalPodsRented: 0,
    },
    cash: archetype.startingCash,
    nextId: 4,
  };
}

export function calculateRunPreview(game: GameState) {
  return calculateRunPreviewSystem(game);
}

function createRunEvent(run: ActiveRun): PendingEvent {
  const type = randInt(1, 3);

  if (type === 1) {
    return {
      type: "loss_spike",
      runId: run.id,
      title: "Loss Spike Detected",
      body: "Training destabilized and the infra team is asking for an immediate call.",
      choices: [
        { key: "stabilize", label: "Spend $500K To Stabilize", effect: "Lower failure risk sharply." },
        { key: "rideout", label: "Ride It Out", effect: "Keep cash, but risk corruption and trust damage." },
      ],
    };
  }

  if (type === 2) {
    return {
      type: "data_glitch",
      runId: run.id,
      title: "Data Pipeline Glitch",
      body: "Integrity checks caught malformed shards. You can pause for cleanup or push through now.",
      choices: [
        { key: "clean", label: "Pause And Clean For $250K", effect: "Adds one month, trims risk, preserves trust." },
        { key: "skip", label: "Skip QA", effect: "Saves time, boosts capability slightly, hurts trust." },
      ],
    };
  }

  return {
    type: "burst_window",
    runId: run.id,
    title: "Spot Compute Window Open",
    body: "Cheap burst capacity is briefly available. Use it or stay disciplined.",
    choices: [
      { key: "burst", label: "Spend $350K To Burst", effect: "Finish faster and raise capability a bit." },
      { key: "discipline", label: "Stay Disciplined", effect: "No spend, modest risk of being overtaken." },
    ],
  };
}

function applyEventChoice(game: GameState, event: PendingEvent, choiceKey: string) {
  const run = game.activeRuns.find((entry) => entry.id === event.runId);
  if (!run) return;

  if (event.type === "loss_spike") {
    if (choiceKey === "stabilize") {
      game.cash -= 500000;
      run.riskModifier -= 0.13;
      run.lossSeverity = Math.max(0, run.lossSeverity - 0.2);
      game.trust = clamp(game.trust + 1, 10, 99);
      addNotification(game, `${run.name}: the team spent $500K to stabilize a dangerous loss spike.`, "good");
    } else {
      run.riskModifier += 0.18;
      run.trustModifier -= 8;
      run.lossSeverity += 0.5;
      game.trust = clamp(game.trust - 2, 10, 99);
      addNotification(game, `${run.name}: leadership rode out a loss spike and trust took a hit.`, "bad");
    }
  }

  if (event.type === "data_glitch") {
    if (choiceKey === "clean") {
      game.cash -= 250000;
      run.totalMonths += 1;
      run.riskModifier -= 0.05;
      game.trust = clamp(game.trust + 1, 10, 99);
      addNotification(game, `${run.name}: data cleanup added a month but protected the run.`, "warning");
    } else {
      run.capabilityModifier += 4;
      run.riskModifier += 0.07;
      run.trustModifier -= 12;
      game.trust = clamp(game.trust - 3, 10, 99);
      addNotification(game, `${run.name}: QA was skipped to preserve momentum.`, "bad");
    }
  }

  if (event.type === "burst_window") {
    if (choiceKey === "burst") {
      game.cash -= 350000;
      run.capabilityModifier += 3;
      run.totalMonths = Math.max(2, run.totalMonths - 1);
      run.computeNeed += 4;
      addNotification(game, `${run.name}: burst capacity shaved time off the schedule.`, "good");
    } else {
      run.riskModifier += 0.03;
      addNotification(game, `${run.name}: the team stayed disciplined and kept burn under control.`, "info");
    }
  }
}

export function settleGlobalMarket(game: GameState, servingPressure: number) {
  settleGlobalMarketSystem(game, servingPressure);
}

export function calculateFundingOffer(game: GameState, monthlyRevenue: number) {
  const bestCapability = getBestCapability(game);
  const arr = monthlyRevenue * 12;
  const trailing = game.history.arr.slice(-3);
  const baseline = trailing.length ? trailing.reduce((sum, value) => sum + value, 0) / trailing.length : 0;
  const growth = Math.max(0, arr - baseline);
  const archetype = getArchetype(game);
  const effects = getDirectiveEffects(game);
  const commoditization = getModifierIntensity(game, "commoditization");
  const distributionScore = game.distribution.consumer * 85000 + game.distribution.enterprise * 115000;
  const trustScore = game.trust * 95000;
  const prestige =
    (archetype.modifiers.fundingPrestige + effects.fundingPrestigeBonus - commoditization * 40) * 300000;
  const boardPenalty = game.boardPressure * 125000;
  const offer = clamp(
    2500000 +
    arr * 0.62 +
    growth * 0.18 +
    bestCapability * 55000 +
    distributionScore +
    trustScore +
    prestige -
    boardPenalty,
    2000000,
    80000000,
  );

  let dilution =
    0.15 +
    offer / 90000000 -
    bestCapability / 1800 -
    game.trust / 1200 -
    (game.distribution.consumer + game.distribution.enterprise) / 2600 -
    archetype.modifiers.fundingPrestige / 1200 +
    game.boardPressure / 550;

  if (game.currentDirective === "profitability") {
    dilution -= 0.015;
  }

  dilution += commoditization * 0.02;

  return {
    offer: Math.round(offer),
    dilution: clamp(dilution, 0.07, 0.28),
  };
}

export function hire(game: GameState, role: RoleId, count: number = 1) {
  const next = copyGame(game);
  next.headcount[role] += count;
  addNotification(next, `Hired ${count} ${ROLE_LABELS[role]}. Monthly burn increased.`, "info");
  return next;
}

export function trainEngineers(game: GameState) {
  const next = copyGame(game);
  const engineerCount = next.headcount.engineers;
  if (engineerCount <= 0) return game;

  let totalCost = 0;
  for (let index = 0; index < engineerCount; index += 1) {
    totalCost += randInt(8000, 15000);
  }

  if (next.cash < totalCost) {
    addNotification(
      next,
      `Engineer training needed ${money(totalCost)}, but cash was too tight to run the program.`,
      "warning",
    );
    return next;
  }

  next.cash -= totalCost;
  next.engineerTrainingLevel += 1;
  addNotification(
    next,
    `Engineers completed reliability training for ${money(totalCost)}. Failure-risk reduction from engineers is now ${(getEngineerTrainingMultiplier(
      next.engineerTrainingLevel,
    ) * 100).toFixed(0)}% of base impact.`,
    "good",
  );
  return next;
}

export function addAdminCapital(game: GameState, millions: number) {
  const next = copyGame(game);
  const amount = Math.round(millions * 1000000);
  if (!Number.isFinite(amount) || amount === 0) return game;
  next.cash += amount;
  addNotification(next, `Admin adjusted capital by ${money(amount)}.`, amount > 0 ? "good" : "warning");
  return next;
}

export function updateMarketingBudget(game: GameState, millions: number) {
  const next = copyGame(game);
  next.marketingBudgetMillions = Math.max(0, Number(millions) || 0);
  return next;
}

export function updateCohortDef(game: GameState, cohortId: CohortId, patch: Partial<CohortDef>) {
  const next = copyGame(game);
  if (next.globalCohorts[cohortId]) {
    next.globalCohorts[cohortId] = {
      ...next.globalCohorts[cohortId],
      ...patch,
      weights: {
        ...next.globalCohorts[cohortId].weights,
        ...(patch.weights || {})
      }
    };
  }
  return next;
}

export function updateMonthlyUserMultiplier(game: GameState, multiplier: number) {
  const next = copyGame(game);
  const previousMultiplier = getMonthlyUserMultiplier(game);
  const nextMultiplier = clamp(Number(multiplier) || 1, 0.1, 10);
  const ratio = nextMultiplier / previousMultiplier;

  next.monthlyUserMultiplier = nextMultiplier;
  Object.values(next.products).forEach((product) => {
    product.activeUsers =
      product.type === "api"
        ? Number((product.activeUsers * ratio).toFixed(1))
        : Math.max(0, Math.round(product.activeUsers * ratio));
    product.tokenUsageMillions = Number((product.tokenUsageMillions * ratio).toFixed(2));
    product.revenue = Math.round(product.revenue * ratio);
    product.computeDemand = Number((product.computeDemand * ratio).toFixed(2));
    product.computeCost = Math.round(product.computeCost * ratio);
  });
  Object.values(next.modelPerformance).forEach((performance) => {
    performance.lastMonthUsers = Number((performance.lastMonthUsers * ratio).toFixed(1));
  });

  return next;
}

export function addCompetitorCapital(game: GameState, competitorId: string, millions: number) {
  const next = copyGame(game);
  const amount = Number(millions);
  if (!Number.isFinite(amount) || amount === 0) return game;
  const current = getCompetitorAdminState(next, competitorId);
  const company = getCompetitorCompanyDefinition(competitorId);
  const competitor = company ? getCompetitorCompanyState(next, competitorId, COMPETITOR_COMPANIES.findIndex((entry) => entry.id === competitorId)) : null;
  next.competitorAdmin[competitorId] = {
    ...current,
    capitalAddedMillions: Number((current.capitalAddedMillions + amount).toFixed(1)),
  };
  if (competitor) {
    competitor.cash = Math.round(competitor.cash + amount * 1000000);
    next.competitorCompanies[competitorId] = competitor;
  }
  addNotification(
    next,
    `Admin adjusted ${company?.name ?? competitorId} capital by ${money(amount * 1000000)}.`,
    amount > 0 ? "warning" : "info",
  );
  return next;
}

export function updateCompetitorAdmin(
  game: GameState,
  competitorId: string,
  patch: Partial<GameState["competitorAdmin"][string]>,
) {
  const next = copyGame(game);
  const adminState = getCompetitorAdminState(next, competitorId);
  const normalizedPatch = {
    ...patch,
    ...(patch.capabilityModifier === undefined
      ? {}
      : { capabilityModifier: Math.max(0.1, Number(patch.capabilityModifier) || 1) }),
  };
  next.competitorAdmin[competitorId] = {
    ...adminState,
    ...normalizedPatch,
    goalModifiers: {
      ...(adminState.goalModifiers ?? {}),
      ...(normalizedPatch.goalModifiers ?? {}),
    },
  };
  return next;
}

export function updateGoalEconomics(
  game: GameState,
  goalId: ModelGoalId,
  patch: Partial<GameState["goalEconomics"][ModelGoalId]>,
) {
  const next = copyGame(game);
  next.goalEconomics[goalId] = {
    ...next.goalEconomics[goalId],
    ...patch,
  };
  return next;
}

export function buyData(game: GameState, tierKey: DataTierId, units: number) {
  const next = copyGame(game);
  const tier = DATA_TIERS[tierKey];
  const normalizedUnits = Math.max(1, Math.round(units));
  const cost = Math.round(tier.cost * normalizedUnits);
  if (tierKey === "synthesized" && next.models.length === 0) return game;
  if (next.cash < cost) return game;
  next.cash -= cost;
  next.dataInventory[tierKey] += normalizedUnits;
  addNotification(
    next,
    `Purchased ${normalizedUnits} units of ${tier.name} data for ${money(cost)}.`,
    tierKey === "web" ? "warning" : "good",
  );
  return next;
}

export function buyUpgrade(game: GameState, key: UpgradeId) {
  const next = copyGame(game);
  const level = next.upgrades[key];
  const cost = getUpgradeCost(key, level);
  if (next.cash < cost) return game;
  next.cash -= cost;
  next.upgrades[key] += 1;
  addNotification(next, `Upgrade completed: ${UPGRADES[key].name} L${next.upgrades[key]}.`, "good");
  return next;
}

export function shutdownRun(game: GameState, runId: number) {
  const next = copyGame(game);
  const run = next.activeRuns.find((entry) => entry.id === runId);
  if (!run) return game;

  next.activeRuns = next.activeRuns.filter((entry) => entry.id !== runId);
  if (next.pendingEvent?.runId === runId) {
    next.pendingEvent = null;
  }
  addNotification(next, `Shut down ${run.name} in development. Compute demand dropped, but the burn is gone.`, "warning");
  return next;
}

export function updateTrainingConfig(game: GameState, patch: Partial<TrainingConfig>) {
  const next = copyGame(game);
  const previousMode = next.trainingConfig.mode;
  const enteringDerivedMode =
    (patch.mode === "upgrade" || patch.mode === "branch") &&
    previousMode !== patch.mode;
  next.trainingConfig = { ...next.trainingConfig, ...patch };

  if (next.trainingConfig.mode === "upgrade" || next.trainingConfig.mode === "branch") {
    if (!next.trainingConfig.baseModelId && next.models.length) {
      next.trainingConfig.baseModelId = next.models[0].id;
    }

    const baseModelChanged = "baseModelId" in patch && patch.baseModelId !== game.trainingConfig.baseModelId;
    const baseModel = getModelById(next, next.trainingConfig.baseModelId);

    if (baseModel) {
      next.trainingConfig.size = baseModel.sizeKey;
      next.trainingConfig.targetVersion = normalizeUpgradeVersion(
        next.trainingConfig.targetVersion || baseModel.version + 0.1,
        baseModel.version,
      );
      next.trainingConfig.targetMemorySize = Math.max(baseModel.memorySize, next.trainingConfig.targetMemorySize);
      next.trainingConfig.targetParameterScale = Math.max(baseModel.parameterScale, next.trainingConfig.targetParameterScale);
      next.trainingConfig.targetContextWindow = Math.max(baseModel.contextWindow, next.trainingConfig.targetContextWindow);
    }

    if (baseModel && (enteringDerivedMode || baseModelChanged)) {
      next.trainingConfig.name = next.trainingConfig.mode === "branch" ? `${baseModel.name} Branch` : baseModel.name;
      next.trainingConfig.targetVersion = roundVersion(baseModel.version + 0.1);
      next.trainingConfig.size = baseModel.sizeKey;
      next.trainingConfig.dataTier = baseModel.dataTier;
      next.trainingConfig.targetMemorySize = baseModel.memorySize;
      next.trainingConfig.targetParameterScale = baseModel.parameterScale;
      next.trainingConfig.targetContextWindow = baseModel.contextWindow;
      next.trainingConfig.goals = { ...baseModel.goals };
      next.trainingConfig.trainingDataUnits = baseModel.trainingDataUnits;
    }
  } else {
    next.trainingConfig.baseModelId = null;
    next.trainingConfig.targetVersion = 1;

    if (patch.size || enteringDerivedMode) {
      const baseTargets = getTrainingTargets(next.trainingConfig.size);
      next.trainingConfig.targetMemorySize = baseTargets.memorySize;
      next.trainingConfig.targetParameterScale = baseTargets.parameterScale;
      next.trainingConfig.targetContextWindow = baseTargets.contextWindow;
    } else {
      const baseTargets = getTrainingTargets(next.trainingConfig.size);
      next.trainingConfig.targetMemorySize = Math.max(baseTargets.memorySize, next.trainingConfig.targetMemorySize);
      next.trainingConfig.targetParameterScale = Math.max(baseTargets.parameterScale, next.trainingConfig.targetParameterScale);
      next.trainingConfig.targetContextWindow = Math.max(baseTargets.contextWindow, next.trainingConfig.targetContextWindow);
    }
  }

  const size = MODEL_SIZES[next.trainingConfig.size];
  const maxTrainingDataUnits = Math.max(1, next.dataInventory[next.trainingConfig.dataTier]);
  next.trainingConfig.trainingDataUnits = clamp(
    Math.round(next.trainingConfig.trainingDataUnits || 1),
    1,
    maxTrainingDataUnits,
  );
  const baseModel =
    next.trainingConfig.mode === "upgrade" || next.trainingConfig.mode === "branch"
      ? getModelById(next, next.trainingConfig.baseModelId)
      : null;
  const memoryBase = baseModel ? baseModel.memorySize : getBaseMemorySize(next.trainingConfig.size);
  next.trainingConfig.targetMemorySize = clamp(
    next.trainingConfig.targetMemorySize,
    memoryBase,
    getMemorySizeLimit(memoryBase, next.upgrades.inference, next.trainingConfig.trainingDataUnits),
  );
  const parameterBase = baseModel ? baseModel.parameterScale : getBaseParameterScale(next.trainingConfig.size);
  next.trainingConfig.targetParameterScale = clamp(
    next.trainingConfig.targetParameterScale,
    parameterBase,
    getParameterScaleLimit(next.trainingConfig.size, parameterBase, next.trainingConfig.trainingDataUnits),
  );
  const contextBase = baseModel ? baseModel.contextWindow : getBaseContextWindow(next.trainingConfig.size);
  next.trainingConfig.targetContextWindow = clamp(
    next.trainingConfig.targetContextWindow,
    contextBase,
    getContextWindowLimit(contextBase, next.trainingConfig.targetMemorySize, memoryBase),
  );
  next.trainingConfig.computeNeed = clamp(next.trainingConfig.computeNeed, size.minCompute, size.maxCompute);
  return next;
}

export function bumpTrainingVersionName(game: GameState) {
  const next = copyGame(game);
  next.trainingConfig.targetVersion = roundVersion(next.trainingConfig.targetVersion + 0.1);
  return next;
}

export function launchRun(game: GameState) {
  return launchRunSystem(game);
}

export function attachModelToProduct(game: GameState, productKey: ProductTypeId, modelId: string) {
  const next = copyGame(game);
  const product = next.products[productKey];

  if (!modelId) {
    product.modelIds = [];
    product.modelPrices = {};
    product.activeUsers = 0;
    product.tokenUsageMillions = 0;
    product.revenue = 0;
    product.computeDemand = 0;
    product.computeCost = 0;
    product.acquisition = 0;
    product.churn = 0;
    addNotification(next, `${PRODUCT_TYPES[productKey].name} was taken offline.`, "warning");
    return next;
  }

  const numericModelId = Number(modelId);
  const alreadyActive = product.modelIds.includes(numericModelId);

  if (alreadyActive) {
    product.modelIds = product.modelIds.filter((id) => id !== numericModelId);
    delete product.modelPrices[String(numericModelId)];
    if (product.modelIds.length === 0) {
      product.activeUsers = 0;
      product.tokenUsageMillions = 0;
      product.revenue = 0;
      product.computeDemand = 0;
      product.computeCost = 0;
      product.acquisition = 0;
      product.churn = 0;
      addNotification(next, `${PRODUCT_TYPES[productKey].name} no longer has any active models.`, "warning");
    } else {
      product.activeUsers = Math.round(product.activeUsers * 0.94);
      addNotification(next, `${PRODUCT_TYPES[productKey].name} removed model #${modelId} from its lineup.`, "info");
    }
    return next;
  }

  product.modelIds = [...product.modelIds, numericModelId];
  product.modelPrices[String(numericModelId)] = product.modelPrices[String(numericModelId)] ?? product.price;
  product.activeUsers = product.activeUsers > 0 ? Math.round(product.activeUsers * 0.97) : product.activeUsers;
  product.lastLaunchMonth = next.turn;
  addNotification(next, `${PRODUCT_TYPES[productKey].name} added model #${modelId} to its active lineup.`, "good");
  return next;
}

export function updateSubscriptionPlan(game: GameState, planId: string, patch: Partial<SubscriptionPlan>) {
  const next = copyGame(game);
  const product = next.products.chatbot;
  if (!product.subscriptionPlans) return game;
  const target = product.subscriptionPlans.find((plan) => plan.id === planId);
  if (target) Object.assign(target, patch);
  return next;
}

export function createSubscriptionPlan(game: GameState) {
  const next = copyGame(game);
  const product = next.products.chatbot;
  if (!product.subscriptionPlans) product.subscriptionPlans = [];
  const nextId = `plan_${Date.now()}`;
  product.subscriptionPlans.push({
    id: nextId,
    name: "New Tier",
    price: 0,
    tokenLimitMillions: 50,
    subscribers: 0,
    revenue: 0,
    profit: 0,
    tokenUsageMillions: 0
  });
  return next;
}

export function deleteSubscriptionPlan(game: GameState, planId: string) {
  const next = copyGame(game);
  const product = next.products.chatbot;
  if (!product.subscriptionPlans) return game;
  product.subscriptionPlans = product.subscriptionPlans.filter((plan) => plan.id !== planId);
  return next;
}

export function updateProductPrice(game: GameState, productKey: ProductTypeId, price: string, modelId?: string) {
  const next = copyGame(game);
  const numericPrice = Number(price);
  if (modelId) {
    next.products[productKey].modelPrices[modelId] = numericPrice;
  } else {
    next.products[productKey].price = numericPrice;
  }
  return next;
}

export function updateReservedPods(game: GameState, delta: number) {
  const next = copyGame(game);
  next.cloud.reservedPods = clamp(next.cloud.reservedPods + delta, 20, 220);
  return next;
}

export function buildDatacenter(game: GameState, pods: number, quantity = 1) {
  const next = copyGame(game);
  const normalizedPods = clamp(Math.round(pods), 8, 240);
  const normalizedQuantity = Math.max(1, Math.round(quantity));
  const buildCost = getDatacenterBuildCost(normalizedPods);
  const totalBuildCost = buildCost * normalizedQuantity;
  if (next.cash < totalBuildCost) return game;

  next.cash -= totalBuildCost;
  for (let index = 0; index < normalizedQuantity; index += 1) {
    const datacenterId = next.cloud.nextDatacenterId;
    next.cloud.datacenters.push({
      id: datacenterId,
      name: `Datacenter ${datacenterId}`,
      pods: normalizedPods,
      buildCost,
      monthBuilt: next.turn,
    });
    next.cloud.nextDatacenterId += 1;
  }
  next.cloud.reservedPods += normalizedPods * normalizedQuantity;
  addNotification(
    next,
    normalizedQuantity === 1
      ? `Built Datacenter ${next.cloud.nextDatacenterId - 1} with ${normalizedPods} cloud pods for ${money(buildCost)}.`
      : `Built ${normalizedQuantity} datacenters with ${normalizedPods} cloud pods each for ${money(totalBuildCost)}.`,
    "good",
  );
  return next;
}

export function sellDatacenters(game: GameState, pods: number, quantity = 1, pricePerDatacenter = 0) {
  const normalizedPods = clamp(Math.round(pods), 8, 240);
  const normalizedQuantity = Math.max(1, Math.round(quantity));
  const normalizedPrice = Math.max(0, Math.round(pricePerDatacenter));
  const matchingDatacenters = game.cloud.datacenters
    .filter((datacenter) => datacenter.pods === normalizedPods)
    .sort((left, right) => left.monthBuilt - right.monthBuilt || left.id - right.id);
  const sellCount = Math.min(normalizedQuantity, matchingDatacenters.length);
  if (sellCount <= 0) return game;

  const next = copyGame(game);
  const soldIds = new Set(matchingDatacenters.slice(0, sellCount).map((datacenter) => datacenter.id));
  next.cloud.datacenters = next.cloud.datacenters.filter((datacenter) => !soldIds.has(datacenter.id));
  next.cloud.reservedPods = Math.max(0, next.cloud.reservedPods - normalizedPods * sellCount);
  next.cash += normalizedPrice * sellCount;

  const totalProceeds = normalizedPrice * sellCount;
  addNotification(
    next,
    sellCount === 1
      ? `Sold a ${normalizedPods}-pod datacenter for ${money(totalProceeds)}.`
      : `Sold ${sellCount} datacenters with ${normalizedPods} pods each for ${money(totalProceeds)} total.`,
    totalProceeds > 0 ? "good" : "warning",
  );
  return next;
}

export function updateTrainingAllocation(game: GameState, value: number) {
  const next = copyGame(game);
  next.cloud.trainingPct = clamp(value, 15, 85);
  return next;
}

export function resolvePendingEvent(game: GameState, choiceKey: string) {
  const next = copyGame(game);
  if (!next.pendingEvent) return game;
  applyEventChoice(next, next.pendingEvent, choiceKey);
  next.pendingEvent = null;
  if (next.cash <= 0) {
    next.status = "lost";
  }
  return next;
}

export function chooseBoardDirective(game: GameState, directiveId: BoardDirectiveId) {
  const next = copyGame(game);
  const previousDirective = next.currentDirective;
  next.currentDirective = directiveId;
  next.directiveTurnsRemaining = 3;
  next.pendingBoardReview = null;
  addNotification(
    next,
    previousDirective === directiveId
      ? `Board directive refreshed: ${BOARD_DIRECTIVES[directiveId].name} for the next quarter.`
      : `Board directive set: ${BOARD_DIRECTIVES[directiveId].name} for the next quarter.`,
    "good",
  );
  return next;
}

export function raiseFunding(game: GameState) {
  const next = copyGame(game);
  if (!next.funding.available) return game;
  next.cash += next.funding.offer;
  next.totalDilution += next.funding.dilution;
  next.funding.lastRaisedTurn = next.turn;
  addNotification(
    next,
    `Raised ${money(next.funding.offer)} at ${pct(next.funding.dilution)} dilution. Total dilution is now ${pct(next.totalDilution)}.`,
    "good",
  );
  next.funding.available = false;
  next.funding.offer = 0;
  next.funding.dilution = 0;
  return next;
}

function processRivals(game: GameState) {
  let boardPressureDelta = 0;
  let trustPenalty = 0;

  (Object.keys(game.rivals) as RivalId[]).forEach((rivalId) => {
    const rival = game.rivals[rivalId];
    rival.cooldown -= 1;

    if (rival.cooldown > 0) {
      return;
    }

    if (rivalId === "frontier_rival") {
      const delta = randInt(5, 9);
      game.marketStandard += delta;
      rival.lastAction = `Raised the market standard by ${delta}.`;
      boardPressureDelta += 6;
      addNotification(game, `Frontier rival shipped a stronger model. Market standard rose by ${delta}.`, "warning");
    }

    if (rivalId === "platform_giant") {
      rival.lastAction = "Bundled AI deeper into the platform stack, cut price, and raised pricing pressure.";
      boardPressureDelta += 5;
      upsertMarketModifier(game, {
        type: "pricing_pressure",
        source: rivalId,
        title: "Pricing Pressure",
        description: "Bundling and aggressive discounting make premium pricing harder for 3 turns.",
        turnsRemaining: 3,
        intensity: 0.28,
      });
      addNotification(game, "Platform giant is compressing prices across both channels.", "warning");
    }

    if (rivalId === "open_model_rival") {
      rival.lastAction = "Released a stronger cheap open model and pushed commoditization harder.";
      boardPressureDelta += 4;
      trustPenalty += 2;
      upsertMarketModifier(game, {
        type: "commoditization",
        source: rivalId,
        title: "Commoditization",
        description: "Near-peer open models weaken pricing power and shave a bit off funding prestige.",
        turnsRemaining: 3,
        intensity: 0.24,
      });
      addNotification(game, "Open-model rival released a cheap near-peer and the market noticed.", "warning");
    }

    rival.cooldown = Math.max(2, nextRivalCooldown(rivalId) - 1);
  });

  return { boardPressureDelta, trustPenalty };
}

export function advanceMonth(game: GameState) {
  if (game.status !== "playing" || game.pendingEvent) {
    return game;
  }

  const next = copyGame(game);
  
  if (isNaN(next.cash)) next.cash = 1000000;
  if (isNaN(next.lastMonth.revenue)) next.lastMonth.revenue = 0;
  if (isNaN(next.lastMonth.profit)) next.lastMonth.profit = 0;
  if (isNaN(next.products.chatbot.revenue)) next.products.chatbot.revenue = 0;
  if (isNaN(next.products.api.revenue)) next.products.api.revenue = 0;
  next.history.revenue = next.history.revenue.map(r => isNaN(r) ? 0 : r);
  next.history.profit = next.history.profit.map(r => isNaN(r) ? 0 : r);
  next.history.arr = next.history.arr.map(r => isNaN(r) ? 0 : r);

  const archetype = getArchetype(next);
  const effects = getDirectiveEffects(next);

  const eventRun = next.activeRuns.find(
    (run) => !run.eventTriggered && run.monthsElapsed >= Math.max(1, Math.floor(run.totalMonths / 2) - 1),
  );

  if (eventRun && Math.random() < 0.58) {
    eventRun.eventTriggered = true;
    next.pendingEvent = createRunEvent(eventRun);
    addNotification(next, `Training alert: ${eventRun.name} needs executive intervention.`, "warning");
    return next;
  }

  const rivalImpact = processRivals(next);

  let provisionalServingDemand = next.products.chatbot.computeDemand + next.products.api.computeDemand;

  const allocatedServing = (next.cloud.reservedPods * (100 - next.cloud.trainingPct)) / 100;
  const servingPressure =
    provisionalServingDemand > allocatedServing
      ? (provisionalServingDemand - allocatedServing) / Math.max(1, provisionalServingDemand)
      : 0;

  settleGlobalMarket(next, servingPressure);

  let totalRevenue = next.products.chatbot.revenue + next.products.api.revenue;
  let servingDemand = next.products.chatbot.computeDemand + next.products.api.computeDemand;
  let totalUsers = next.products.chatbot.activeUsers + next.products.api.activeUsers;

  updateModelPerformance(next);

  const trainingDemand = next.activeRuns.reduce((sum, run) => sum + run.computeNeed, 0);
  const allocatedTraining = (next.cloud.reservedPods * next.cloud.trainingPct) / 100;
  const trainingOverflow = Math.max(0, trainingDemand - allocatedTraining);
  const servingOverflow = Math.max(0, servingDemand - allocatedServing);

  // Cloud rental: only unused pods (surplus beyond both serving and training demand) can be rented.
  const surplusPods = Math.max(0, allocatedServing - servingDemand) + Math.max(0, allocatedTraining - trainingDemand);
  const rentalResult = settleCloudRental(next, Math.floor(surplusPods));
  totalRevenue += rentalResult.revenue;
  const overflowTotal = trainingOverflow + servingOverflow;
  const reservedCost = Math.round(next.cloud.reservedPods * getReservedCostPerPod(next) * effects.reservedCostMultiplier);
  const overflowCost = Math.round(
    (trainingOverflow * 100000 + servingOverflow * 250000) * effects.overflowCostMultiplier,
  );
  const payrollCost = getPayroll(next);
  const marketingSpend = Math.round(next.marketingBudgetMillions * 1000000);
  const developmentCost = next.activeRuns.reduce((sum, run) => {
    if (run.remainingDevelopmentCost <= 0) return sum;
    const monthsRemaining = Math.max(1, Math.ceil(run.totalMonths - run.monthsElapsed));
    const installment = Math.min(run.remainingDevelopmentCost, Math.round(run.remainingDevelopmentCost / monthsRemaining));
    run.remainingDevelopmentCost -= installment;
    return sum + installment;
  }, 0);

  const loanPayments = next.loans.reduce((sum, loan) => sum + loan.monthlyPayment, 0);
  const expenses = reservedCost + overflowCost + payrollCost + marketingSpend + BASE_OPS_COST + developmentCost + loanPayments;
  const profit = Math.round(totalRevenue - expenses);
  next.cash += profit;

  next.loans = next.loans.filter((loan) => {
    loan.elapsed += 1;
    return loan.elapsed < loan.term;
  });

  const trainingPressure = trainingDemand > 0 ? trainingOverflow / trainingDemand : 0;
  const completedRuns = [] as GameState["models"];
  const failedRuns = [] as ActiveRun[];

  next.activeRuns.forEach((run) => {
    run.monthsElapsed += 1;
    run.lossCurve = generateLossCurve(run.totalMonths, run.lossSeverity > 0 ? run.lossSeverity * 0.5 : 0);

    if (run.monthsElapsed < run.totalMonths) return;

    const size = MODEL_SIZES[run.sizeKey];
    const data = DATA_TIERS[run.dataTier];
    const failureRoll = clamp(
      run.baseFailureRisk +
      run.riskModifier +
      trainingPressure * 0.22 +
      (servingPressure > 0.3 ? 0.03 : 0) +
      (next.currentDirective === "frontier_research" ? 0.04 : 0),
      0.02,
      0.9,
    );

    if (Math.random() < failureRoll) {
      failedRuns.push(run);
      return;
    }

    const baseModel = run.baseModelId ? getModelById(next, run.baseModelId) : null;
    const modelId = next.nextId++;
    const baseMemorySize = baseModel ? baseModel.memorySize : getBaseMemorySize(run.sizeKey);
    const baseParameterScale = baseModel ? baseModel.parameterScale : getBaseParameterScale(run.sizeKey);
    const baseContextWindow = baseModel ? baseModel.contextWindow : getBaseContextWindow(run.sizeKey);
    const memoryExpansion = Math.max(0, run.targetMemorySize - baseMemorySize);
    const parameterExpansion = Math.max(0, run.targetParameterScale - baseParameterScale);
    const contextExpansion = Math.max(0, run.targetContextWindow - baseContextWindow);
    const parameterSteps = parameterExpansion / getParameterStep(run.sizeKey);
    const memorySteps = memoryExpansion / 8;
    const contextSteps = contextExpansion / 8;
    const goals = run.goals;
    const dataContribution = run.trainingDataUnits * data.quality * 1.65;
    const researcherContribution = next.headcount.researchers * 2.2;
    const inheritedCapabilityBase = baseModel
      ? Math.max(size.baseCapability, baseModel.capability - getGoalAverage(baseModel.goals) + 2)
      : size.baseCapability;
    const currentCapabilityRating =
      inheritedCapabilityBase +
      data.capability +
      next.upgrades.training * 4 +
      run.capabilityModifier +
      archetype.modifiers.trainingCapabilityBonus +
      effects.frontierCapabilityBonus +
      parameterExpansion * 0.38 +
      memoryExpansion * 0.32 +
      contextExpansion * 0.12 +
      run.trainingDataUnits * data.quality * 0.9 +
      getGoalCapabilityLiftSystem(goals);
    const capability = getCapabilityFromCurrentRating(currentCapabilityRating, goals);
    const inferenceBase = baseModel
      ? Math.max(
        size.baseInference,
        baseModel.inferenceCost +
        parameterSteps * 0.18 +
        memorySteps * 0.1 +
        contextSteps * 0.04 -
        getGoalIntensity(goals, "speed") * 1.2 +
        getGoalIntensity(goals, "agentic") * 0.2,
      )
      : size.baseInference;
    const inferenceCost = Number(
      clamp(inferenceBase - next.headcount.engineers * 0.06 - next.upgrades.inference * 0.24 + rand(-0.12, 0.12), 0.45, 7).toFixed(2),
    );
    const trust = Math.round(
      clamp(
        (baseModel ? baseModel.trust : 48) +
        data.trust +
        next.headcount.engineers * 2 +
        next.upgrades.training * 2 +
        run.trustModifier +
        (next.trust - 50) * 0.15 -
        parameterSteps -
        contextSteps * 0.25 +
        run.trainingDataUnits * data.quality * 0.9 +
        getGoalIntensity(goals, "accuracy") * 8 +
        getGoalIntensity(goals, "reasoning") * 4 -
        getGoalIntensity(goals, "speed") * 2.4 +
        rand(-5, 5),
        10,
        99,
      ),
    );
    const model = {
      id: modelId,
      familyId: run.familyId ?? modelId,
      baseModelId: run.baseModelId,
      name: run.name,
      version: run.targetVersion,
      developmentCost: run.totalDevelopmentCost,
      capability,
      inferenceCost,
      trust,
      memorySize: run.targetMemorySize,
      parameterScale: Number(run.targetParameterScale.toFixed(1)),
      contextWindow: run.targetContextWindow,
      goals: { ...run.goals },
      trainingDataUnits: run.trainingDataUnits,
      monthBuilt: next.turn,
      sizeKey: run.sizeKey,
      dataTier: run.dataTier,
      subscribersByCohort: createEmptyCohortSubscriberMap(),
      reliability: { ...run.reliability },
    };
    next.models.unshift(model);
    next.modelPerformance[String(model.id)] = createDefaultModelPerformance();
    completedRuns.push(model);
  });

  next.activeRuns = next.activeRuns.filter((run) => run.monthsElapsed < run.totalMonths);

  completedRuns.forEach((model) => {
    addNotification(
      next,
      `${model.name} shipped. Capability ${model.capability}, Inference ${model.inferenceCost}, Trust ${model.trust}, Context ${model.contextWindow}K.`,
      "good",
    );
  });

  failedRuns.forEach((run) => {
    addNotification(next, `${run.name} failed during training. Burn was spent and no model shipped.`, "bad");
  });

  let trustDelta = 0;
  const liveProducts = Object.values(next.products).filter((product) => product.modelIds.length > 0).length;

  if (liveProducts > 0 && overflowTotal === 0) trustDelta += 2;
  else if (liveProducts > 0) trustDelta += 1;

  if (next.currentDirective === "enterprise_trust") trustDelta += 1;
  if (next.currentDirective === "growth" && overflowTotal > 0) trustDelta -= 2;
  if (overflowTotal > 0) trustDelta -= Math.min(7, Math.ceil(overflowTotal / 4));
  if (servingPressure > 0.25) trustDelta -= 3;
  trustDelta -= failedRuns.length * 6;
  trustDelta += completedRuns.filter((model) => model.trust >= 70).length;
  trustDelta -= rivalImpact.trustPenalty;

  if (archetype.modifiers.trustResilience > 0 && trustDelta < 0) {
    trustDelta = Math.min(0, trustDelta + archetype.modifiers.trustResilience);
  }

  next.trust = clamp(next.trust + trustDelta, 10, 99);

  let consumerDelta = 0;
  let enterpriseDelta = 0;

  if (next.products.chatbot.modelIds.length > 0) {
    consumerDelta =
      Math.max(0.4, next.products.chatbot.acquisition / 5000) *
      archetype.modifiers.consumerDistributionGrowthMultiplier *
      effects.consumerDistributionMultiplier;
    if (next.products.chatbot.trust > 60) consumerDelta += 0.5;
  }

  if (next.products.api.modelIds.length > 0) {
    enterpriseDelta =
      Math.max(0.3, next.products.api.acquisition / 4) *
      archetype.modifiers.enterpriseDistributionGrowthMultiplier *
      effects.enterpriseDistributionMultiplier;
    if (next.products.api.trust > 65) enterpriseDelta += 0.4;
  }

  if (servingPressure > 0.25) {
    consumerDelta = Math.max(0, consumerDelta - 0.6);
    enterpriseDelta = Math.max(0, enterpriseDelta - 0.6);
  }

  if (next.trust < 45) {
    enterpriseDelta = Math.max(0, enterpriseDelta - 0.4);
  }

  consumerDelta = Number(consumerDelta.toFixed(1));
  enterpriseDelta = Number(enterpriseDelta.toFixed(1));
  next.distribution.consumer = clamp(Number((next.distribution.consumer + consumerDelta).toFixed(1)), 0, 100);
  next.distribution.enterprise = clamp(Number((next.distribution.enterprise + enterpriseDelta).toFixed(1)), 0, 100);

  const runwayMonths = profit < 0 ? next.cash / Math.max(1, -profit) : Infinity;
  let boardPressureDelta = rivalImpact.boardPressureDelta;

  if (runwayMonths < 6) boardPressureDelta += 8;
  else if (runwayMonths < 12) boardPressureDelta += 4;

  if (profit < 0) boardPressureDelta += 3;
  else boardPressureDelta -= 2;

  if (next.trust < 45) boardPressureDelta += 3;
  else if (next.trust > 65) boardPressureDelta -= 2;

  boardPressureDelta += failedRuns.length * 5;
  if (completedRuns.some((model) => model.capability > next.marketStandard)) boardPressureDelta -= 2;
  if (next.currentDirective === "frontier_research") boardPressureDelta += 1;
  if (next.currentDirective === "profitability" && profit > 0) boardPressureDelta -= 2;

  next.boardPressure = clamp(next.boardPressure + boardPressureDelta, 0, 100);

  next.lastMonth = {
    revenue: Math.round(totalRevenue),
    expenses,
    profit,
    users: totalUsers,
    payroll: payrollCost,
    marketingSpend,
    computeReservedCost: reservedCost,
    overflowCost,
    servingDemand: Number(servingDemand.toFixed(2)),
    trainingDemand: Number(trainingDemand.toFixed(2)),
    trustDelta,
    distributionDelta: { consumer: consumerDelta, enterprise: enterpriseDelta },
    cloudRentalRevenue: rentalResult.revenue,
    cloudRentalPodsRented: rentalResult.podsRented,
  };

  next.history.revenue.push(Math.round(totalRevenue));
  next.history.revenue = next.history.revenue.slice(-24);
  next.history.profit.push(Math.round(profit));
  next.history.profit = next.history.profit.slice(-24);
  next.history.arr.push(Math.round(totalRevenue * 12));
  next.history.arr = next.history.arr.slice(-24);
  next.history.trust.push(next.trust);
  next.history.trust = next.history.trust.slice(-24);
  next.history.boardPressure.push(next.boardPressure);
  next.history.boardPressure = next.history.boardPressure.slice(-24);

  next.marketModifiers = next.marketModifiers
    .map((modifier) => ({ ...modifier, turnsRemaining: modifier.turnsRemaining - 1 }))
    .filter((modifier) => modifier.turnsRemaining > 0);

  if (next.currentDirective) {
    next.directiveTurnsRemaining -= 1;
    if (next.directiveTurnsRemaining <= 0) {
      addNotification(next, `Board directive expired: ${BOARD_DIRECTIVES[next.currentDirective].name}.`, "info");
      next.currentDirective = null;
      next.directiveTurnsRemaining = 0;
    }
  }

  // Yearly Cohort Scaling
  if (next.turn > 0 && next.turn % 12 === 0) {
    let shifted = false;
    Object.values(next.globalCohorts).forEach((cohort) => {
      // 10% chance to shrink, otherwise grow 1-3%
      if (Math.random() < 0.1) {
        const shrinkPercent = rand(0.01, 0.05);
        cohort.population = Math.max(100, Math.round(cohort.population * (1 - shrinkPercent)));
        shifted = true;
      } else {
        const growthPercent = rand(0.01, 0.03);
        cohort.population = Math.round(cohort.population * (1 + growthPercent));
        shifted = true;
      }
    });
    if (shifted) {
      addNotification(next, "New Year: Global demographics have naturally shifted in size.", "info");
    }
  }

  updateCompetitorCompanies(next);
  next.competitorLaunchShock = Number((next.competitorLaunchShock * 0.55).toFixed(4));
  next.turn += 1;

  if (next.turn - next.funding.lastRaisedTurn >= 12 && !next.funding.available) {
    const offer = calculateFundingOffer(next, totalRevenue);
    next.funding.available = true;
    next.funding.offer = offer.offer;
    next.funding.dilution = offer.dilution;
    addNotification(next, "Investors are back on the line with a fresh term sheet.", "good");
  }

  if (next.cash < 0) {
    next.deficitMonths += 1;
    if (next.deficitMonths === 6) addNotification(next, "Warning: Company has been operating in a deficit for 6 months.", "warning");
    if (next.deficitMonths === 9) addNotification(next, "Critical: 9 months of consecutive deficit. Solvency failure imminent.", "bad");
    if (next.deficitMonths === 11) addNotification(next, "Final Warning: 1 month left to secure positive cash balance or face liquidation.", "bad");

    if (next.deficitMonths >= 12) {
      next.status = "lost";
      addNotification(next, "Company liquidated. 12 consecutive months of deficit reached.", "bad");
    }
  } else {
    next.deficitMonths = 0;
  }

  if (next.status === "playing" && (next.turn - 1) % 3 === 0) {
    next.pendingBoardReview = createPendingBoardReview(next);
    addNotification(next, `Quarter ${next.pendingBoardReview.quarter} board memo updated. Review it in Strategy when needed.`, "info");
  }

  return next;
}

export function takeLoan(game: GameState, principal: number, term: number): GameState {
  const next = copyGame(game);
  const terms = getLoanTerms(principal, term);

  const newLoan: GameState["loans"][number] = {
    id: `loan-${Date.now()}`,
    principal,
    term,
    elapsed: 0,
    interestFeePct: terms.feePct,
    monthlyPayment: terms.monthlyPayment,
  };

  next.loans.push(newLoan);
  next.cash += principal;

  addNotification(next, `Secured capital loan of ${money(principal)} over ${term} months.`, "info");

  return next;
}
