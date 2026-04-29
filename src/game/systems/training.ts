import {
  ARCHETYPES,
  BASE_POD_COST,
  DATA_TIERS,
  DATASET_PACKS,
  MODEL_SIZES,
  RELIABILITY_TIER_IDS,
  RELIABILITY_TIERS,
  SURGE_POD_COST,
} from "../defs";
import { ActiveRun, DataTierId, GameState, NotificationTone, TrainingConfig } from "../types";
import {
  CONTEXT_STEP_BASE_COST,
  MEMORY_STEP_BASE_COST,
  PARAMETER_STEP_BASE_COST,
  RESEARCHER_DISCOUNT_MAX,
  RESEARCHER_DISCOUNT_MIN,
  TRAINING_ACCURACY_TRUST_BONUS,
  TRAINING_ACTIVE_GOAL_MONTHS,
  TRAINING_CONTEXT_EXPANSION_CAPABILITY,
  TRAINING_CONTEXT_STEP_FAILURE_RISK,
  TRAINING_CONTEXT_STEP_INFERENCE,
  TRAINING_CONTEXT_STEP_MONTHS,
  TRAINING_CONTEXT_STEP_TRUST,
  TRAINING_DATA_CAPABILITY,
  TRAINING_DATA_UNIT_FAILURE_RISK,
  TRAINING_DATA_UNIT_MONTHS,
  TRAINING_DERIVED_MODEL_MONTHS,
  TRAINING_GOAL_COMPLEXITY_FAILURE_RISK,
  TRAINING_GOAL_COMPLEXITY_MONTHS,
  TRAINING_LICENSED_DATA_FAILURE_RISK,
  TRAINING_MEMORY_EXPANSION_CAPABILITY,
  TRAINING_MEMORY_STEP_FAILURE_RISK,
  TRAINING_MEMORY_STEP_INFERENCE,
  TRAINING_MEMORY_STEP_MONTHS,
  TRAINING_PARAMETER_EXPANSION_CAPABILITY,
  TRAINING_PARAMETER_STEP_FAILURE_RISK,
  TRAINING_PARAMETER_STEP_INFERENCE,
  TRAINING_PARAMETER_STEP_MONTHS,
  TRAINING_REASONING_TRUST_BONUS,
  TRAINING_SPEED_TRUST_PENALTY,
  TRAINING_SYNTH_DATA_FAILURE_RISK,
  TRAINING_WEB_DATA_FAILURE_RISK,
} from "./balance";
import { copyGame } from "./state";
import { WEEKS_PER_MONTH } from "../time";

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function money(value: number) {
  if (isNaN(value)) return "$0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1000000000) return `${sign}$${(abs / 1000000000).toFixed(2)}B`;
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function addNotification(game: GameState, text: string, tone: NotificationTone = "info") {
  game.notifications.unshift({ id: game.nextId++, text, tone });
  game.notifications = game.notifications.slice(0, 12);
}

function getArchetype(game: GameState) {
  return ARCHETYPES[game.archetype];
}

function getDirectiveEffects(game: GameState) {
  return {
    frontierCapabilityBonus: game.currentDirective === "frontier_research" ? 4 : 0,
    frontierRiskPenalty: game.currentDirective === "frontier_research" ? 0.06 : 0,
  };
}

function getEngineerTrainingMultiplier(level: number) {
  return 1 + level * 0.1;
}

function getEngineerFailureRiskReduction(game: Pick<GameState, "headcount" | "upgrades" | "engineerTrainingLevel" | "departments">) {
  const departmentBonus = game.departments.engineering.managementQuality * 0.0008;
  return game.headcount.engineers * 0.015 * getEngineerTrainingMultiplier(game.engineerTrainingLevel) + game.upgrades.training * 0.03 + departmentBonus;
}

function getAssignedResearchers(game: GameState) {
  return game.trainingConfig.assignedResearcherIds
    .map((employeeId) => game.employees.find((employee) => employee.id === employeeId))
    .filter((employee): employee is NonNullable<GameState["employees"][number]> => Boolean(employee && employee.active && employee.departmentId === "research"));
}

function getResearchDepartmentBonus(game: GameState) {
  const department = game.departments.research;
  return department.managementQuality * 0.08 + department.morale * 0.06 - 6;
}

function getAssignedResearcherContribution(game: GameState) {
  return getAssignedResearchers(game).reduce((sum, researcher) => {
    const specialtyBonus =
      researcher.specialty === "reasoning"
        ? 8
        : researcher.specialty === "multimodal"
          ? 6
          : researcher.specialty === "agentic"
            ? 5
            : researcher.specialty === "safety"
              ? 4
              : researcher.specialty === "data"
                ? 4
                : 3;
    return sum + researcher.skill * 0.18 + specialtyBonus;
  }, 0);
}

function getAssignedResearcherRiskAdjustment(game: GameState) {
  return getAssignedResearchers(game).reduce((sum, researcher) => {
    const burnoutPenalty = researcher.burnout > 65 ? 0.014 : researcher.burnout > 45 ? 0.006 : 0;
    const leadershipShield = researcher.level === "director" || researcher.level === "executive" ? 0.004 : 0;
    return sum + burnoutPenalty - leadershipShield;
  }, 0);
}

function getKeyPersonRisk(game: GameState) {
  const assignedResearchers = getAssignedResearchers(game);
  if (!assignedResearchers.length) return 0;

  const totalPoach = assignedResearchers.reduce((sum, researcher) => sum + researcher.poachRisk, 0) / assignedResearchers.length;
  const totalBurnout = assignedResearchers.reduce((sum, researcher) => sum + researcher.burnout, 0) / assignedResearchers.length;
  return clamp((totalPoach * 0.003 + totalBurnout * 0.0025) / Math.max(1, Math.sqrt(assignedResearchers.length)), 0.02, 0.35);
}

function getModelById(game: GameState, id: number | null) {
  return game.models.find((model) => model.id === id) || null;
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

function getGoalAverage(goals: TrainingConfig["goals"]) {
  return getGoalTotal(goals) / Object.keys(goals).length;
}

function getCapabilityFromCurrentRating(currentRating: number, goals: TrainingConfig["goals"]) {
  return Math.round(Math.max(1, currentRating + getGoalAverage(goals)));
}

export function getGoalCapabilityLift(goals: TrainingConfig["goals"]) {
  const goalTotal = getGoalTotal(goals);
  const activeGoals = getActiveGoalCount(goals);
  const baselineTotal = Object.keys(goals).length;
  const extraIntensity = Math.max(0, goalTotal - baselineTotal);
  const goalComplexity = Math.log2(goalTotal + 1);

  return goalComplexity * 2.8 + activeGoals * 0.45 + extraIntensity * 0.085;
}

function generateLossCurve(totalWeeks: number, severity = 0) {
  const points: number[] = [];
  let current = rand(2.4, 3.2);
  for (let index = 0; index < totalWeeks; index += 1) {
    const trend = (0.18 + (index / WEEKS_PER_MONTH) * 0.02) / WEEKS_PER_MONTH;
    current -= trend * rand(0.7, 1.15);
    current += rand(-0.08, 0.12);
    if (severity > 0 && index === Math.max(1, Math.floor(totalWeeks / 2))) {
      current += severity;
    }
    points.push(Math.max(0.35, Number(current.toFixed(2))));
  }
  return points;
}

export function getBaseMemorySize(size: keyof typeof BASE_MEMORY_SIZE) {
  return BASE_MEMORY_SIZE[size];
}

export function getBaseParameterScale(size: keyof typeof BASE_PARAMETER_SCALE) {
  return BASE_PARAMETER_SCALE[size];
}

export function getBaseContextWindow(size: keyof typeof BASE_CONTEXT_WINDOW) {
  return BASE_CONTEXT_WINDOW[size];
}

export function getParameterStep(size: keyof typeof BASE_PARAMETER_SCALE) {
  if (size === "small") return 2;
  if (size === "medium") return 5;
  if (size === "large") return 12;
  return 24;
}

function getParameterCapacitySteps(size: keyof typeof BASE_PARAMETER_SCALE, trainingDataUnits: number) {
  const normalizedUnits = Math.max(1, Math.round(trainingDataUnits));
  const dataScale = Math.log2(normalizedUnits);
  return 4 + dataScale * (size === "frontier" ? 1.4 : size === "large" ? 1.7 : 2);
}

export function getParameterScaleLimit(size: keyof typeof BASE_PARAMETER_SCALE, baseParameterScale: number, trainingDataUnits: number) {
  return baseParameterScale + getParameterStep(size) * getParameterCapacitySteps(size, trainingDataUnits);
}

export function getTrainingTargets(size: keyof typeof BASE_MEMORY_SIZE) {
  return {
    memorySize: getBaseMemorySize(size),
    parameterScale: getBaseParameterScale(size),
    contextWindow: getBaseContextWindow(size),
  };
}

export function getMemorySizeLimit(baseMemorySize: number, inferenceUpgradeLevel: number, trainingDataUnits = 1) {
  const dataMemoryBonus = Math.floor(Math.log2(Math.max(1, trainingDataUnits))) * 8;
  return baseMemorySize + 64 + inferenceUpgradeLevel * 16 + dataMemoryBonus;
}

export function getContextWindowLimit(baseContextWindow: number, targetMemorySize: number, baseMemorySize: number) {
  const extraMemoryBlocks = Math.max(0, targetMemorySize - baseMemorySize) / 8;
  return baseContextWindow + 128 + extraMemoryBlocks * 16;
}

export function getDatasetPurchaseCost(tierKey: DataTierId, packId: keyof typeof DATASET_PACKS) {
  return Math.round(DATA_TIERS[tierKey].cost * DATASET_PACKS[packId].multiplier);
}

export function getResearchContribution(game: GameState) {
  const archetype = getArchetype(game);
  const effects = getDirectiveEffects(game);
  return Math.round(
    game.headcount.researchers * 2.2 +
    getResearchDepartmentBonus(game) +
    getAssignedResearcherContribution(game) +
    game.upgrades.training * 4 +
    archetype.modifiers.trainingCapabilityBonus +
    effects.frontierCapabilityBonus,
  );
}

export function getGoalDevelopmentCost(
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

export function calculateRunPreview(game: GameState) {
  const size = MODEL_SIZES[game.trainingConfig.size];
  const data = DATA_TIERS[game.trainingConfig.dataTier];
  const archetype = getArchetype(game);
  const effects = getDirectiveEffects(game);
  const baseModel =
    game.trainingConfig.mode === "upgrade" || game.trainingConfig.mode === "branch"
      ? getModelById(game, game.trainingConfig.baseModelId)
      : null;
  const goals = game.trainingConfig.goals;
  const goalTotal = getGoalTotal(goals);
  const activeGoals = getActiveGoalCount(goals);
  const goalComplexity = Math.log2(goalTotal + 1);
  const trainingDataUnits = clamp(game.trainingConfig.trainingDataUnits, 1, game.dataInventory[game.trainingConfig.dataTier]);
  const baseMemorySize = baseModel ? baseModel.memorySize : getBaseMemorySize(size.key);
  const baseParameterScale = baseModel ? baseModel.parameterScale : getBaseParameterScale(size.key);
  const baseContextWindow = baseModel ? baseModel.contextWindow : getBaseContextWindow(size.key);
  const maxMemorySize = getMemorySizeLimit(baseMemorySize, game.upgrades.inference, trainingDataUnits);
  const targetMemorySize = clamp(game.trainingConfig.targetMemorySize, baseMemorySize, maxMemorySize);
  const memoryExpansion = Math.max(0, targetMemorySize - baseMemorySize);
  const parameterLimit = getParameterScaleLimit(size.key, baseParameterScale, trainingDataUnits);
  const targetParameterScale = clamp(game.trainingConfig.targetParameterScale, baseParameterScale, parameterLimit);
  const parameterExpansion = Math.max(0, targetParameterScale - baseParameterScale);
  const maxContextWindow = getContextWindowLimit(baseContextWindow, targetMemorySize, baseMemorySize);
  const targetContextWindow = clamp(game.trainingConfig.targetContextWindow, baseContextWindow, maxContextWindow);
  const contextExpansion = Math.max(0, targetContextWindow - baseContextWindow);
  const parameterSteps = parameterExpansion / getParameterStep(size.key);
  const memorySteps = memoryExpansion / 8;
  const contextSteps = contextExpansion / 8;
  const computeNeed = clamp(game.trainingConfig.computeNeed, size.minCompute, size.maxCompute);
  const engineerDurationReduction = game.headcount.engineers * 0.1;
  const durationBeforeEngineerReduction =
    (size.baseWork +
      parameterSteps * TRAINING_PARAMETER_STEP_MONTHS +
      memorySteps * TRAINING_MEMORY_STEP_MONTHS +
      contextSteps * TRAINING_CONTEXT_STEP_MONTHS +
      trainingDataUnits * TRAINING_DATA_UNIT_MONTHS +
      goalComplexity * TRAINING_GOAL_COMPLEXITY_MONTHS +
      activeGoals * TRAINING_ACTIVE_GOAL_MONTHS +
      (baseModel ? TRAINING_DERIVED_MODEL_MONTHS : 0)) /
    computeNeed;
  const totalMonths = clamp(
    Number((durationBeforeEngineerReduction - engineerDurationReduction).toFixed(1)),
    1.5,
    16,
  );
  const engineerBonus = getEngineerFailureRiskReduction(game);
  const researcherContribution = getResearchContribution(game);
  const assignedResearchers = getAssignedResearchers(game);
  const dataContribution = trainingDataUnits * data.quality * 1.65;
  const dataRiskAdjustment =
    data.key === "web" ? TRAINING_WEB_DATA_FAILURE_RISK : data.key === "licensed" ? TRAINING_LICENSED_DATA_FAILURE_RISK : TRAINING_SYNTH_DATA_FAILURE_RISK;
  const failureRisk = clamp(
    size.baseRisk +
    dataRiskAdjustment -
    engineerBonus +
    parameterSteps * TRAINING_PARAMETER_STEP_FAILURE_RISK +
    memorySteps * TRAINING_MEMORY_STEP_FAILURE_RISK +
    contextSteps * TRAINING_CONTEXT_STEP_FAILURE_RISK +
    goalComplexity * TRAINING_GOAL_COMPLEXITY_FAILURE_RISK +
    trainingDataUnits * TRAINING_DATA_UNIT_FAILURE_RISK +
    getAssignedResearcherRiskAdjustment(game) +
    getKeyPersonRisk(game) * 0.28 +
    effects.frontierRiskPenalty,
    0.04,
    0.82,
  );
  const inheritedCapabilityBase = baseModel
    ? Math.max(size.baseCapability, baseModel.capability - getGoalAverage(baseModel.goals) + 2)
    : size.baseCapability;
  const currentCapabilityRating =
    inheritedCapabilityBase +
    data.capability +
    game.upgrades.training * 4 +
    archetype.modifiers.trainingCapabilityBonus +
    effects.frontierCapabilityBonus +
    parameterExpansion * TRAINING_PARAMETER_EXPANSION_CAPABILITY +
    memoryExpansion * TRAINING_MEMORY_EXPANSION_CAPABILITY +
    contextExpansion * TRAINING_CONTEXT_EXPANSION_CAPABILITY +
    trainingDataUnits * data.quality * TRAINING_DATA_CAPABILITY +
    getGoalCapabilityLift(goals) +
    (baseModel ? 2 : 0);
  const capability = getCapabilityFromCurrentRating(currentCapabilityRating, goals);
  const inferenceBase = baseModel
    ? Math.max(
      size.baseInference,
      baseModel.inferenceCost +
      parameterSteps * TRAINING_PARAMETER_STEP_INFERENCE +
      memorySteps * TRAINING_MEMORY_STEP_INFERENCE +
      contextSteps * TRAINING_CONTEXT_STEP_INFERENCE -
      getGoalIntensity(goals, "speed") * 1.2 +
      getGoalIntensity(goals, "agentic") * 0.2,
    )
    : size.baseInference;
  const inferenceCost = Number(
    clamp(inferenceBase - game.headcount.engineers * 0.05 - game.upgrades.inference * 0.22, 0.5, 7).toFixed(2),
  );
  const trust = Math.round(
    clamp(
      (baseModel ? baseModel.trust : 50) +
      data.trust +
      game.headcount.engineers * 2 +
      (game.trust - 50) * 0.2 -
      parameterSteps -
      contextSteps * TRAINING_CONTEXT_STEP_TRUST +
      trainingDataUnits * data.quality * 0.9 +
      getGoalIntensity(goals, "accuracy") * TRAINING_ACCURACY_TRUST_BONUS +
      getGoalIntensity(goals, "reasoning") * TRAINING_REASONING_TRUST_BONUS -
      getGoalIntensity(goals, "speed") * TRAINING_SPEED_TRUST_PENALTY +
      rand(-4, 4),
      20,
      98,
    ),
  );
  const baseDevelopmentCost =
    computeNeed * totalMonths * (BASE_POD_COST + SURGE_POD_COST * 0.35) +
    trainingDataUnits * getDatasetPurchaseCost(data.key, "small") +
    parameterSteps * PARAMETER_STEP_BASE_COST +
    memorySteps * MEMORY_STEP_BASE_COST +
    contextSteps * CONTEXT_STEP_BASE_COST +
    Math.max(0, goalTotal - Object.keys(goals).length) * 25000 +
    goalComplexity * 350000;
  const goalDevelopmentCost = getGoalDevelopmentCost(
    game.goalEconomics,
    goals,
    baseDevelopmentCost,
    baseModel?.goals ?? null,
  );

  let reliabilityDollarCost = 0;
  RELIABILITY_TIER_IDS.forEach((tierId) => {
    const tierDef = RELIABILITY_TIERS[tierId];
    const value = game.trainingConfig.reliability[tierId];
    if (value > 0) {
      reliabilityDollarCost += tierDef.baseConstantMillions * 1000000 * Math.pow(1 / (1 - value), tierDef.exponent);
    }
  });

  const expectedResearchDiscountRate = game.headcount.researchers * 0.00275;
  const projectedEquivalentCost = Math.round(
    (baseDevelopmentCost + goalDevelopmentCost.totalCost + reliabilityDollarCost) * Math.max(0.1, 1 - expectedResearchDiscountRate),
  );

  return {
    computeNeed,
    totalMonths,
    capability,
    inferenceCost,
    trust,
    failureRisk,
    projectedEquivalentCost,
    targetMemorySize,
    targetParameterScale,
    targetContextWindow,
    researcherContribution,
    trainingDataUnits,
    maxMemorySize,
    maxParameterScale: parameterLimit,
    maxContextWindow,
    engineerDurationReduction,
    engineerRiskReduction: engineerBonus,
    engineerTrainingMultiplier: getEngineerTrainingMultiplier(game.engineerTrainingLevel),
    dataContribution: Math.round(dataContribution),
    assignedResearchers,
    keyPersonRisk: getKeyPersonRisk(game),
  };
}

export function launchRun(game: GameState) {
  const next = copyGame(game);
  const size = MODEL_SIZES[next.trainingConfig.size];
  const dataTier = next.trainingConfig.dataTier;
  const estimate = calculateRunPreview(next);
  const baseModel =
    next.trainingConfig.mode === "upgrade" || next.trainingConfig.mode === "branch"
      ? getModelById(next, next.trainingConfig.baseModelId)
      : null;
  if (next.dataInventory[dataTier] < next.trainingConfig.trainingDataUnits) return game;
  if (next.activeRuns.length >= 3) return game;
  if ((next.trainingConfig.mode === "upgrade" || next.trainingConfig.mode === "branch") && !baseModel) return game;

  const runName = next.trainingConfig.name.trim() || baseModel?.name || "Model";
  const researcherDiscountPerResearcher = rand(RESEARCHER_DISCOUNT_MIN, RESEARCHER_DISCOUNT_MAX);
  const upfrontDevelopmentCost = Math.round(estimate.projectedEquivalentCost * 0.3);
  const remainingDevelopmentCost = Math.max(0, estimate.projectedEquivalentCost - upfrontDevelopmentCost);
  const totalWeeks = Math.ceil(estimate.totalMonths * WEEKS_PER_MONTH);
  if (next.cash < upfrontDevelopmentCost) return game;

  next.cash -= upfrontDevelopmentCost;
  const assignedResearcherIds = next.trainingConfig.assignedResearcherIds.filter((employeeId) => {
    const employee = next.employees.find((entry) => entry.id === employeeId);
    return Boolean(employee && employee.active && employee.departmentId === "research" && employee.assignedRunId === null);
  });
  const run: ActiveRun = {
    id: next.nextId++,
    mode: next.trainingConfig.mode,
    baseModelId: baseModel?.id ?? null,
    familyId: next.trainingConfig.mode === "branch" ? null : baseModel ? baseModel.familyId : null,
    name: runName,
    targetVersion: next.trainingConfig.mode === "new" ? 1 : next.trainingConfig.targetVersion,
    totalDevelopmentCost: estimate.projectedEquivalentCost,
    sizeKey: size.key,
    dataTier,
    computeNeed: estimate.computeNeed,
    totalWeeks,
    weeksElapsed: 0,
    totalMonths: estimate.totalMonths,
    monthsElapsed: 0,
    projectedCapability: estimate.capability,
    projectedInferenceCost: estimate.inferenceCost,
    projectedTrust: estimate.trust,
    baseFailureRisk: estimate.failureRisk,
    riskModifier: 0,
    capabilityModifier: 0,
    trustModifier: 0,
    targetMemorySize: estimate.targetMemorySize,
    targetParameterScale: estimate.targetParameterScale,
    targetContextWindow: estimate.targetContextWindow,
    goals: { ...next.trainingConfig.goals },
    trainingDataUnits: estimate.trainingDataUnits,
    remainingDevelopmentCost,
    researcherDiscountPerResearcher,
    lossSeverity: 0,
    eventTriggered: false,
    lossCurve: generateLossCurve(totalWeeks),
    reliability: { ...next.trainingConfig.reliability },
    assignedResearcherIds,
    keyPersonRisk: estimate.keyPersonRisk,
  };

  next.activeRuns.push(run);
  assignedResearcherIds.forEach((employeeId) => {
    const employee = next.employees.find((entry) => entry.id === employeeId);
    if (employee) employee.assignedRunId = run.id;
  });
  addNotification(
    next,
    `Launched ${run.name}: ${size.name} model on ${DATA_TIERS[dataTier].name}. Upfront spend ${money(
      upfrontDevelopmentCost,
    )}, remaining ${money(remainingDevelopmentCost)} over development. Projected risk ${pct(estimate.failureRisk)}. Research discount ${(
      researcherDiscountPerResearcher * 100
    ).toFixed(2)}% per researcher. Assigned researchers ${assignedResearcherIds.length}.`,
    "info",
  );
  return next;
}
