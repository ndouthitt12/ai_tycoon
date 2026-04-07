import {
  ArchetypeId,
  ArchetypeDefinition,
  BoardDirectiveId,
  BoardDirectiveDefinition,
  CohortCategory,
  CohortDef,
  CohortId,
  CompetitorCompanyDefinition,
  CompetitorBehaviorId,
  CompetitorStrategyId,
  DataTierId,
  DataTierDefinition,
  DatasetPackDefinition,
  DatasetPackSizeId,
  GoalEconomicsRule,
  ModelGoalDefinition,
  ModelGoalId,
  ModelSizeId,
  ModelSizeDefinition,
  ProductTypeId,
  ProductDefinition,
  RivalId,
  RivalDefinition,
  RoleId,
  TrainingConfig,
  ReliabilityTierId,
  UpgradeId,
  UpgradeDefinition,
} from "./types";
import cohortsRaw from "./global-cohorts.csv?raw";
import competitorsRaw from "./competitors.csv?raw";
import startingModelsRaw from "./starting-models.csv?raw";

export const BASE_BOARD_PRESSURE = 18;
export const BASE_OPS_COST = 60000;
export const BASE_POD_COST = 4000;
export const SURGE_POD_COST = 8500;

export const SALARIES: Record<RoleId, number> = {
  researchers: 32000,
  engineers: 28000,
  sales: 24000,
};

export const ROLE_LABELS: Record<RoleId, string> = {
  researchers: "Researchers",
  engineers: "Engineers",
  sales: "Product / Sales",
};

export const DATA_TIERS: Record<DataTierId, DataTierDefinition> = {
  web: {
    key: "web",
    name: "Web Scrape",
    cost: 250000,
    quality: 0.9,
    trust: -4,
    capability: -4,
    tag: "Cheap / Noisy",
  },
  licensed: {
    key: "licensed",
    name: "Licensed",
    cost: 900000,
    quality: 1.15,
    trust: 8,
    capability: 4,
    tag: "Expensive / Clean",
  },
  synthesized: {
    key: "synthesized",
    name: "Synthesized",
    cost: 650000,
    quality: 1.22,
    trust: 4,
    capability: 8,
    tag: "Needs Prior Model",
  },
};

export const DATASET_PACKS: Record<DatasetPackSizeId, DatasetPackDefinition> = {
  small: {
    id: "small",
    name: "Small Batch",
    units: 1,
    multiplier: 1,
  },
  medium: {
    id: "medium",
    name: "Medium Batch",
    units: 3,
    multiplier: 2.7,
  },
  large: {
    id: "large",
    name: "Large Batch",
    units: 6,
    multiplier: 5.4,
  },
};

const CSV_MODEL_GOAL_IDS: ModelGoalId[] = [
  "speed",
  "accuracy",
  "reasoning",
  "agentic",
  "coding",
  "multimodal",
  "creativity",
  "alignment",
  "multilingual",
  "recall",
  "compression",
];

export interface ReliabilityTierDefinition {
  id: ReliabilityTierId;
  name: string;
  baseConstantMillions: number;
  exponent: number;
}

export const RELIABILITY_TIERS: Record<ReliabilityTierId, ReliabilityTierDefinition> = {
  syntax_extraction: { id: "syntax_extraction", name: "Syntax & Extraction", baseConstantMillions: 13, exponent: 1.0 },
  semantic_generation: { id: "semantic_generation", name: "Semantic Generation", baseConstantMillions: 21, exponent: 1.2 },
  analytical_reasoning: { id: "analytical_reasoning", name: "Analytical Reasoning", baseConstantMillions: 125, exponent: 2.2 },
  complex_synthesis: { id: "complex_synthesis", name: "Complex Synthesis", baseConstantMillions: 275, exponent: 2.5 },
  bounded_agency: { id: "bounded_agency", name: "Bounded Agency", baseConstantMillions: 400, exponent: 2.7 },
  autonomous_workflow: { id: "autonomous_workflow", name: "Autonomous Workflow", baseConstantMillions: 800, exponent: 3.0 },
  frontier_reasoning: { id: "frontier_reasoning", name: "Frontier Reasoning", baseConstantMillions: 3000, exponent: 3.8 },
};
export const RELIABILITY_TIER_IDS = Object.keys(RELIABILITY_TIERS) as ReliabilityTierId[];

export const MODEL_GOALS: Record<ModelGoalId, ModelGoalDefinition> = {
  speed: { id: "speed", name: "Speed", summary: "Lower latency and faster turns for high-volume workloads." },
  accuracy: { id: "accuracy", name: "Accuracy", summary: "Cleaner answers, better trust, and fewer obvious misses." },
  reasoning: { id: "reasoning", name: "Reasoning", summary: "Stronger chain-of-thought style depth and harder task solving." },
  agentic: { id: "agentic", name: "Agentic", summary: "Better multi-step execution and task autonomy." },
  coding: { id: "coding", name: "Coding", summary: "Improved developer utility, code generation, and API appeal." },
  multimodal: { id: "multimodal", name: "Multimodal", summary: "Broader file, image, and mixed-input handling." },
  creativity: { id: "creativity", name: "Creativity", summary: "Focuses on creative writing, prose, roleplay, and natural conversation." },
  alignment: { id: "alignment", name: "Alignment", summary: "Heavy guardrails, strict refusal rates, and bias mitigation." },
  multilingual: { id: "multilingual", name: "Multilingual", summary: "Training on dozens of global languages fluently." },
  recall: { id: "recall", name: "Recall", summary: "Perfectly retrieve facts from giant files within the context window." },
  compression: { id: "compression", name: "Compression", summary: "Pruning the model's footprint to heavily lower inference costs." },
};

export const MODEL_GOAL_IDS = [...CSV_MODEL_GOAL_IDS];

export const DEFAULT_GOAL_ECONOMICS: Record<ModelGoalId, GoalEconomicsRule> = {
  speed: { fixedCostMillions: 0.5, percentOfBaseCost: 0.5 },
  accuracy: { fixedCostMillions: 1.2, percentOfBaseCost: 1 },
  reasoning: { fixedCostMillions: 3.5, percentOfBaseCost: 3.5 },
  agentic: { fixedCostMillions: 5.5, percentOfBaseCost: 4 },
  coding: { fixedCostMillions: 1.8, percentOfBaseCost: 2 },
  multimodal: { fixedCostMillions: 4, percentOfBaseCost: 3 },
  creativity: { fixedCostMillions: 1.5, percentOfBaseCost: 1.5 },
  alignment: { fixedCostMillions: 2.0, percentOfBaseCost: 2.5 },
  multilingual: { fixedCostMillions: 4.5, percentOfBaseCost: 3 },
  recall: { fixedCostMillions: 3.0, percentOfBaseCost: 2.5 },
  compression: { fixedCostMillions: 6.0, percentOfBaseCost: 4.5 },
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseCsvRows(csv: string) {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const [headerLine, ...dataLines] = lines;
  const headers = parseCsvLine(headerLine).map((value) => value.trim());

  return dataLines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, (values[index] ?? "").trim()]),
    ) as Record<string, string>;
  });
}

function parseGoalRecord(
  row: Record<string, string>,
  prefix: string,
  fallback: number,
) {
  return Object.fromEntries(
    CSV_MODEL_GOAL_IDS.map((goalId) => [
      goalId,
      Number(row[`${prefix}${goalId}`] || fallback),
    ]),
  ) as Record<ModelGoalId, number>;
}

function parseCohorts(csv: string): CohortDef[] {
  return parseCsvRows(csv).map((row) => ({
    id: row.id as CohortId,
    name: row.name,
    category: (row.category || "Consumer") as CohortCategory,
    population: Number(row.population),
    priceSensitivity: Number(row.priceSensitivity),
    baseCapabilityWeight: Number(row.baseCapabilityWeight),
    weights: parseGoalRecord(row, "weight_", 0),
    reliabilityWeights: Object.fromEntries(
      RELIABILITY_TIER_IDS.map((tierId) => [
        tierId,
        Number(row[`weight_rel_${tierId}`] || 0),
      ])
    ) as Record<ReliabilityTierId, number>,
    sessionsPerMonth: Number(row.sessionsPerMonth),
    tokensPerSession: Number(row.tokensPerSession)
  }));
}

function parseCompetitors(csv: string): CompetitorCompanyDefinition[] {
  return parseCsvRows(csv).map((row) => ({
    id: row.id,
    name: row.name,
    startingCapitalMillions: Number(row.startingCapitalMillions),
    versionBase: Number(row.versionBase),
    sizeKey: row.sizeKey as CompetitorCompanyDefinition["sizeKey"],
    dataTier: row.dataTier as DataTierId,
    defaultBehavior: row.behavior as CompetitorBehaviorId,
    defaultStrategy: row.strategy as CompetitorStrategyId,
    defaultCapabilityModifier: Number(row.capabilityModifier || 1),
    defaultGoalModifiers: parseGoalRecord(row, "goalModifier_", 1),
    goals: parseGoalRecord(row, "goal_", 0),
  }));
}

function getEmptyReliability() {
  return Object.fromEntries(
    RELIABILITY_TIER_IDS.map((tierId) => [tierId, 0]),
  ) as Record<ReliabilityTierId, number>;
}

function parseStartingModelConfigs(csv: string) {
  return Object.fromEntries(
    parseCsvRows(csv).map((row) => [
      row.archetypeId as ArchetypeId,
      {
        mode: row.mode as TrainingConfig["mode"],
        baseModelId: null,
        targetVersion: Number(row.targetVersion),
        size: row.size as TrainingConfig["size"],
        dataTier: row.dataTier as DataTierId,
        computeNeed: Number(row.computeNeed),
        name: row.name,
        targetMemorySize: Number(row.targetMemorySize),
        targetParameterScale: Number(row.targetParameterScale),
        targetContextWindow: Number(row.targetContextWindow),
        goals: parseGoalRecord(row, "goal_", 0),
        trainingDataUnits: Number(row.trainingDataUnits),
        reliability: getEmptyReliability(),
      } satisfies TrainingConfig,
    ]),
  ) as Record<ArchetypeId, TrainingConfig>;
}

export const GLOBAL_COHORT_LIST: CohortDef[] = parseCohorts(cohortsRaw);
export const GLOBAL_COHORT_IDS: CohortId[] = GLOBAL_COHORT_LIST.map((cohort) => cohort.id);
export const COMPETITOR_COMPANIES: CompetitorCompanyDefinition[] = parseCompetitors(competitorsRaw);
export const STARTING_MODEL_CONFIGS = parseStartingModelConfigs(startingModelsRaw);

export const GLOBAL_COHORTS: Record<CohortId, CohortDef> = Object.fromEntries(
  GLOBAL_COHORT_LIST.map((cohort) => [cohort.id, cohort]),
) as Record<CohortId, CohortDef>;

export function createEmptyCohortSubscriberMap() {
  return Object.fromEntries(
    GLOBAL_COHORT_IDS.map((cohortId) => [cohortId, 0]),
  ) as Record<CohortId, number>;
}

export const COMPETITOR_BEHAVIORS: Record<CompetitorBehaviorId, { label: string; summary: string }> = {
  disciplined: {
    label: "Disciplined",
    summary: "Protects margins, invests more cautiously, and grows capability more slowly.",
  },
  balanced: {
    label: "Balanced",
    summary: "Keeps a normal spending profile and steady model progress.",
  },
  aggressive: {
    label: "Aggressive",
    summary: "Spends faster, pushes capability harder, and chases market share.",
  },
};

export const COMPETITOR_STRATEGIES: Record<CompetitorStrategyId, { label: string; summary: string }> = {
  balanced: { label: "Balanced", summary: "No additional specialization beyond the company baseline." },
  consumer: { label: "Consumer", summary: "Leans into speed and multimodal appeal for broad user adoption." },
  enterprise: { label: "Enterprise", summary: "Leans into accuracy, reasoning, and agentic enterprise utility." },
  speed: { label: "Speed", summary: "Pushes latency and throughput as the key differentiation axis." },
  accuracy: { label: "Accuracy", summary: "Focuses on cleaner answers and reliability." },
  reasoning: { label: "Reasoning", summary: "Targets harder task-solving and deeper capability." },
  agentic: { label: "Agentic", summary: "Optimizes for multi-step task execution." },
  coding: { label: "Coding", summary: "Pushes dev utility and software-generation strength." },
  multimodal: { label: "Multimodal", summary: "Optimizes for broad mixed-input handling." },
  creativity: { label: "Creativity", summary: "Focuses on creative writing, prose, and roleplay." },
  alignment: { label: "Alignment", summary: "Focuses on guardrails and enterprise-grade safety." },
  multilingual: { label: "Multilingual", summary: "Pushes global language support." },
  recall: { label: "Recall", summary: "Perfects large-context document retrieval." },
  compression: { label: "Compression", summary: "Prunes capability slightly to massively cut inference cost." },
};

export const MODEL_SIZES: Record<ModelSizeId, ModelSizeDefinition> = {
  small: {
    key: "small",
    name: "Small",
    baseCapability: 48,
    baseInference: 0.85,
    baseRisk: 0.1,
    baseWork: 30,
    minCompute: 4,
    maxCompute: 12,
  },
  medium: {
    key: "medium",
    name: "Medium",
    baseCapability: 60,
    baseInference: 1.45,
    baseRisk: 0.18,
    baseWork: 56,
    minCompute: 8,
    maxCompute: 20,
  },
  large: {
    key: "large",
    name: "Large",
    baseCapability: 74,
    baseInference: 2.35,
    baseRisk: 0.28,
    baseWork: 96,
    minCompute: 12,
    maxCompute: 32,
  },
  frontier: {
    key: "frontier",
    name: "Frontier",
    baseCapability: 88,
    baseInference: 3.7,
    baseRisk: 0.4,
    baseWork: 152,
    minCompute: 18,
    maxCompute: 44,
  },
};

export const PRODUCT_TYPES: Record<ProductTypeId, ProductDefinition> = {
  chatbot: {
    key: "chatbot",
    name: "Consumer Chatbot",
    unitLabel: "Users",
    priceUnitLabel: "$ / mo",
    defaultPrice: 18,
    minPrice: 5,
    maxPrice: 35,
    step: 1,
  },
  api: {
    key: "api",
    name: "B2B API",
    unitLabel: "Clients",
    priceUnitLabel: "$ / 1M tokens",
    defaultPrice: 9000,
    minPrice: 2000,
    maxPrice: 25000,
    step: 500,
  },
};

export const UPGRADES: Record<UpgradeId, UpgradeDefinition> = {
  training: {
    key: "training",
    name: "Training Techniques",
    description: "Lower run failure risk and lift capability outcomes.",
    costs: [500000, 1200000, 2500000],
  },
  inference: {
    key: "inference",
    name: "Inference Optimization",
    description: "Reduce serving weight, improve product margins, and expand memory headroom.",
    costs: [600000, 1400000, 2800000],
  },
  gtm: {
    key: "gtm",
    name: "Go-To-Market Engine",
    description: "Improve acquisition and soften churn.",
    costs: [450000, 1100000, 2200000],
  },
  cloud: {
    key: "cloud",
    name: "Cloud Ops",
    description: "Make reserved cloud capacity cheaper.",
    costs: [550000, 1250000, 2400000],
  },
};

export const BOARD_DIRECTIVES: Record<BoardDirectiveId, BoardDirectiveDefinition> = {
  growth: {
    id: "growth",
    name: "Growth",
    summary: "Press the market and let distribution outrun the benchmark.",
    upside: "Higher chatbot acquisition and faster consumer distribution gain.",
    downside: "Trust drops by 2 each month if overflow hits while this directive is active.",
  },
  profitability: {
    id: "profitability",
    name: "Profitability",
    summary: "Force discipline on cloud cost and pricing quality.",
    upside: "Lower reserved and overflow cost multipliers with better funding terms.",
    downside: "Lower acquisition across both products.",
  },
  frontier_research: {
    id: "frontier_research",
    name: "Frontier Research",
    summary: "Prioritize capability leadership and fundraising prestige.",
    upside: "Higher model capability and stronger funding narrative.",
    downside: "Higher run failure risk and board scrutiny.",
  },
  enterprise_trust: {
    id: "enterprise_trust",
    name: "Enterprise Trust",
    summary: "Stabilize the company around trust, reliability, and enterprise posture.",
    upside: "More trust gain, stronger enterprise distribution, and better API retention.",
    downside: "Weaker consumer growth.",
  },
};

export const RIVALS: Record<RivalId, RivalDefinition> = {
  frontier_rival: {
    id: "frontier_rival",
    name: "Frontier Rival",
    summary: "Moves the capability benchmark and keeps the market standard climbing.",
    cadence: [3, 5],
  },
  platform_giant: {
    id: "platform_giant",
    name: "Platform Giant",
    summary: "Uses bundling and scale to raise pricing pressure for three turns.",
    cadence: [4, 6],
  },
  open_model_rival: {
    id: "open_model_rival",
    name: "Open Model Rival",
    summary: "Releases cheap near-peer models that weaken premium pricing and funding narrative.",
    cadence: [5, 7],
  },
};

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDefinition> = {
  frontier_lab: {
    id: "frontier_lab",
    name: "Frontier Lab",
    summary: "High-research company with strong fundraising prestige and a harder path to distribution.",
    strengths: ["Top-end training ceiling", "Fundraising prestige", "Best capability upside"],
    weaknesses: ["Higher board pressure", "Weaker early distribution", "More fragile cash discipline"],
    winStyle: "Win by building benchmark leadership, then converting prestige into commercial leverage.",
    startingCash: 60000000,
    startingHeadcount: { researchers: 4, engineers: 3, sales: 0 },
    startingTrust: 52,
    startingDistribution: { consumer: 20, enterprise: 25 },
    startingMarketStandard: 58,
    startingDataInventory: { web: 4, licensed: 5, synthesized: 0 },
    startingTrainingConfig: STARTING_MODEL_CONFIGS.frontier_lab,
    modifiers: {
      fundingPrestige: 15,
      trainingCapabilityBonus: 6,
      startingBoardPressure: BASE_BOARD_PRESSURE + 8,
      chatbotAcquisitionMultiplier: 1,
      apiAcquisitionMultiplier: 1,
      consumerDistributionGrowthMultiplier: 1,
      enterpriseDistributionGrowthMultiplier: 1,
      trustResilience: 0,
      pricingPowerPenalty: 0,
      commoditizationResistance: 0,
    },
  },
  consumer_ai_product_company: {
    id: "consumer_ai_product_company",
    name: "Consumer AI Product Company",
    summary: "Fast distribution start built around user growth and product feedback loops.",
    strengths: ["Strong consumer reach", "Fast chatbot growth", "Efficient go-to-market posture"],
    weaknesses: ["More exposed to inference cost spikes", "Trust slips faster under overflow", "Benchmark gaps hurt harder"],
    winStyle: "Win by scaling the consumer surface before compute cost and trust collapse the margin story.",
    startingCash: 45000000,
    startingHeadcount: { researchers: 2, engineers: 3, sales: 3 },
    startingTrust: 48,
    startingDistribution: { consumer: 45, enterprise: 18 },
    startingMarketStandard: 56,
    startingDataInventory: { web: 5, licensed: 3, synthesized: 0 },
    startingTrainingConfig: STARTING_MODEL_CONFIGS.consumer_ai_product_company,
    modifiers: {
      fundingPrestige: 0,
      trainingCapabilityBonus: 0,
      startingBoardPressure: BASE_BOARD_PRESSURE,
      chatbotAcquisitionMultiplier: 1.2,
      apiAcquisitionMultiplier: 1,
      consumerDistributionGrowthMultiplier: 1.1,
      enterpriseDistributionGrowthMultiplier: 1,
      trustResilience: 0,
      pricingPowerPenalty: 0,
      commoditizationResistance: 0,
    },
  },
  enterprise_copilot_company: {
    id: "enterprise_copilot_company",
    name: "Enterprise Copilot Company",
    summary: "Trust-led operator with stronger enterprise posture and slower visible growth.",
    strengths: ["High starting trust", "Better enterprise distribution", "Stronger API retention"],
    weaknesses: ["Slower consumer growth", "Less research upside", "More sensitive to price discipline"],
    winStyle: "Win by compounding reliable API revenue and staying commercially sane while rivals overextend.",
    startingCash: 42000000,
    startingHeadcount: { researchers: 2, engineers: 3, sales: 2 },
    startingTrust: 62,
    startingDistribution: { consumer: 12, enterprise: 42 },
    startingMarketStandard: 55,
    startingDataInventory: { web: 3, licensed: 5, synthesized: 0 },
    startingTrainingConfig: STARTING_MODEL_CONFIGS.enterprise_copilot_company,
    modifiers: {
      fundingPrestige: 4,
      trainingCapabilityBonus: 0,
      startingBoardPressure: BASE_BOARD_PRESSURE - 3,
      chatbotAcquisitionMultiplier: 1,
      apiAcquisitionMultiplier: 1.18,
      consumerDistributionGrowthMultiplier: 0.9,
      enterpriseDistributionGrowthMultiplier: 1.05,
      trustResilience: 8,
      pricingPowerPenalty: 0,
      commoditizationResistance: 0,
    },
  },
  open_source_challenger: {
    id: "open_source_challenger",
    name: "Open-Source Challenger",
    summary: "Developer-led company with lower cash, weaker pricing power, and better resilience to commoditization.",
    strengths: ["Goodwill and API adoption", "Balanced starting trust", "Resilient against commoditization"],
    weaknesses: ["Lower pricing power", "Less cash", "Harder to turn momentum into premium margins"],
    winStyle: "Win by staying relevant through developer adoption and refusing to die when prices compress.",
    startingCash: 35000000,
    startingHeadcount: { researchers: 3, engineers: 3, sales: 1 },
    startingTrust: 55,
    startingDistribution: { consumer: 18, enterprise: 25 },
    startingMarketStandard: 56,
    startingDataInventory: { web: 5, licensed: 3, synthesized: 0 },
    startingTrainingConfig: STARTING_MODEL_CONFIGS.open_source_challenger,
    modifiers: {
      fundingPrestige: -2,
      trainingCapabilityBonus: 1,
      startingBoardPressure: BASE_BOARD_PRESSURE + 2,
      chatbotAcquisitionMultiplier: 1,
      apiAcquisitionMultiplier: 1.12,
      consumerDistributionGrowthMultiplier: 1,
      enterpriseDistributionGrowthMultiplier: 1,
      trustResilience: 2,
      pricingPowerPenalty: 0.1,
      commoditizationResistance: 0.5,
    },
  },
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
