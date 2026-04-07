import {
  ArchetypeId,
  ArchetypeDefinition,
  BoardDirectiveId,
  BoardDirectiveDefinition,
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
  UpgradeId,
  UpgradeDefinition,
} from "./types";
import competitorsRaw from "./competitors.csv?raw";

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

function parseCompetitors(csv: string): CompetitorCompanyDefinition[] {
  const lines = csv.trim().split("\n");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return {
      id: values[0].trim(),
      name: values[1].trim(),
      budgetMillions: Number(values[2].trim()),
      versionBase: Number(values[3].trim()),
      sizeKey: values[4].trim() as CompetitorCompanyDefinition["sizeKey"],
      dataTier: values[5].trim() as DataTierId,
      goals: {
        speed: Number(values[6].trim()),
        accuracy: Number(values[7].trim()),
        reasoning: Number(values[8].trim()),
        agentic: Number(values[9].trim()),
        coding: Number(values[10].trim()),
        multimodal: Number(values[11].trim()),
        creativity: Number(values[12].trim() || 0),
        alignment: Number(values[13].trim() || 0),
        multilingual: Number(values[14].trim() || 0),
        recall: Number(values[15].trim() || 0),
        compression: Number(values[16].trim() || 0),
      },
    };
  });
}

export const COMPETITOR_COMPANIES: CompetitorCompanyDefinition[] = parseCompetitors(competitorsRaw);

export const GLOBAL_COHORTS: Record<CohortId, { id: CohortId; name: string; population: number; priceSensitivity: number; weights: Partial<Record<ModelGoalId, number>>; baseCapabilityWeight: number; }> = {
  casual: { id: "casual", name: "Casual Consumers", population: 3500000, priceSensitivity: 1.8, baseCapabilityWeight: 0.8, weights: { speed: 1.5, creativity: 1.8 } },
  developer: { id: "developer", name: "Developers", population: 900000, priceSensitivity: 1.0, baseCapabilityWeight: 1.1, weights: { coding: 2.2, reasoning: 1.2, recall: 0.8 } },
  enterprise: { id: "enterprise", name: "Enterprise B2B", population: 450000, priceSensitivity: 0.4, baseCapabilityWeight: 1.2, weights: { accuracy: 1.5, alignment: 2.0, agentic: 1.4 } },
  global: { id: "global", name: "Multinational", population: 1800000, priceSensitivity: 1.2, baseCapabilityWeight: 0.9, weights: { multilingual: 2.5, speed: 1.1 } },
  power: { id: "power", name: "Power Users", population: 600000, priceSensitivity: 0.7, baseCapabilityWeight: 1.5, weights: { reasoning: 1.8, recall: 1.8, multimodal: 1.4 } },
  efficiency: { id: "efficiency", name: "Cost-Optimizers", population: 1200000, priceSensitivity: 2.5, baseCapabilityWeight: 0.8, weights: { compression: 2.5, speed: 1.5 } },
};

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
    startingTrainingConfig: {
      mode: "new",
      baseModelId: null,
      targetVersion: 1,
      size: "large",
      dataTier: "licensed",
      computeNeed: 16,
      name: "Atlas",
      targetMemorySize: 32,
      targetParameterScale: 56,
      targetContextWindow: 32,
      goals: { speed: 1, accuracy: 1, reasoning: 1, agentic: 1, coding: 1, multimodal: 1, creativity: 1, alignment: 1, multilingual: 1, recall: 1, compression: 1 },
      trainingDataUnits: 3,
    },
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
    startingTrainingConfig: {
      mode: "new",
      baseModelId: null,
      targetVersion: 1,
      size: "medium",
      dataTier: "licensed",
      computeNeed: 12,
      name: "Pulse",
      targetMemorySize: 16,
      targetParameterScale: 22,
      targetContextWindow: 16,
      goals: { speed: 1, accuracy: 1, reasoning: 1, agentic: 1, coding: 1, multimodal: 1, creativity: 1, alignment: 1, multilingual: 1, recall: 1, compression: 1 },
      trainingDataUnits: 2,
    },
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
    startingTrainingConfig: {
      mode: "new",
      baseModelId: null,
      targetVersion: 1,
      size: "medium",
      dataTier: "licensed",
      computeNeed: 10,
      name: "Anchor",
      targetMemorySize: 16,
      targetParameterScale: 22,
      targetContextWindow: 16,
      goals: { speed: 1, accuracy: 1, reasoning: 1, agentic: 1, coding: 1, multimodal: 1, creativity: 1, alignment: 1, multilingual: 1, recall: 1, compression: 1 },
      trainingDataUnits: 3,
    },
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
    startingTrainingConfig: {
      mode: "new",
      baseModelId: null,
      targetVersion: 1,
      size: "medium",
      dataTier: "web",
      computeNeed: 12,
      name: "Relay",
      targetMemorySize: 16,
      targetParameterScale: 22,
      targetContextWindow: 16,
      goals: { speed: 1, accuracy: 1, reasoning: 1, agentic: 1, coding: 1, multimodal: 1, creativity: 1, alignment: 1, multilingual: 1, recall: 1, compression: 1 },
      trainingDataUnits: 2,
    },
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
