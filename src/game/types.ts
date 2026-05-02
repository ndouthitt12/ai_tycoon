export type ScreenId = "overview" | "strategy" | "lab" | "compute" | "market" | "bank" | "admin";

export type NotificationTone = "info" | "good" | "warning" | "bad";
export type ProductTypeId = "chatbot" | "api";
export type ServingStrategyId = "flagship" | "tiered" | "cached" | "enterprise_sla";
export type RoleId = "researchers" | "engineers" | "sales";
export type DepartmentId = "research" | "engineering" | "go_to_market";
export type EmployeeLevelId = "staff" | "lead" | "director" | "executive";
export type EmployeeStatusId = "active" | "leave" | "departed";
export type ResearchSpecialtyId = "reasoning" | "multimodal" | "safety" | "inference" | "agentic" | "data";
export type DataTierId = "web" | "licensed" | "synthesized";
export type DatasetPackSizeId = "small" | "medium" | "large";
export type ModelSizeId = "small" | "medium" | "large" | "frontier";
export type UpgradeId = "training" | "inference" | "gtm" | "cloud";
export type TrainingMode = "new" | "upgrade" | "branch";
export type PostTrainingPhaseId = "rlhf" | "domain_finetune" | "red_team";
export type ModelGoalId =
  | "speed"
  | "accuracy"
  | "reasoning"
  | "agentic"
  | "coding"
  | "multimodal"
  | "creativity"
  | "alignment"
  | "multilingual"
  | "recall"
  | "compression";
export type CohortId = "casual" | "developer" | "global" | "power" | "efficiency" | "medical" | "law" | "government" | "education" | "tech" | "finance" | "manufacturing" | "retail";
export type ReliabilityTierId = "syntax_extraction" | "semantic_generation" | "analytical_reasoning" | "complex_synthesis" | "bounded_agency" | "autonomous_workflow" | "frontier_reasoning";
export type CohortCategory = "Consumer" | "Business";
export interface CohortDef {
  id: CohortId;
  name: string;
  category: CohortCategory;
  population: number;
  priceSensitivity: number;
  basePriceSensitivity: number;
  weights: Partial<Record<ModelGoalId, number>>;
  reliabilityWeights: Record<ReliabilityTierId, number>;
  baseCapabilityWeight: number;
  sessionsPerMonth: number;
  tokensPerSession: number;
  baseTokensPerMonthMillions: number;
  maxBudget: number;
  valueToPriceWeight: number;
}

export interface Loan {
  id: string;
  principal: number;
  term: number;
  elapsed: number;
  termWeeks?: number;
  elapsedWeeks?: number;
  interestFeePct: number;
  monthlyPayment: number;
  weeklyPayment?: number;
}

export type CompetitorBehaviorId = "disciplined" | "balanced" | "aggressive";
export type CompetitorStrategyId =
  | "balanced"
  | "consumer"
  | "enterprise"
  | "speed"
  | "accuracy"
  | "reasoning"
  | "agentic"
  | "coding"
  | "multimodal"
  | "creativity"
  | "alignment"
  | "multilingual"
  | "recall"
  | "compression";
export type ArchetypeId =
  | "frontier_lab"
  | "consumer_ai_product_company"
  | "enterprise_copilot_company"
  | "open_source_challenger";
export type BoardDirectiveId = "growth" | "profitability" | "frontier_research" | "enterprise_trust";
export type RivalId = "frontier_rival" | "platform_giant" | "open_model_rival";
export type MarketModifierId = "pricing_pressure" | "commoditization";
export type RunEventType = "loss_spike" | "data_glitch" | "burst_window" | "talent_poach" | "talent_breakthrough" | "talent_burnout";

export interface NotificationItem {
  id: number;
  text: string;
  tone: NotificationTone;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  tokenLimitMillions: number;
  subscribers: number;
  revenue: number;
  profit: number;
  tokenUsageMillions: number;
}

export interface ProductTrafficState {
  baselineTokensMillions: number;
  burstMultiplier: number;
  averageContextUtilization: number;
  batchingFriendliness: number;
  viralPressure: number;
}

export interface ProductServingState {
  effectiveTokensPerPod: number;
  contextPenalty: number;
  batchingEfficiency: number;
  modelWeightPenalty: number;
  hardwareEfficiency: number;
  strategyCapacityPenalty: number;
  burstPodsUsed: number;
  burstCost: number;
  overflowPods: number;
  capacityPressure: number;
}

export interface ProductState {
  type: ProductTypeId;
  modelIds: number[];
  modelPrices: Record<string, number>;
  activeUsers: number;
  tokenUsageMillions: number;
  price: number;
  revenue: number;
  computeDemand: number;
  computeCost: number;
  churn: number;
  acquisition: number;
  trust: number;
  lastLaunchMonth: number;
  servingStrategy: ServingStrategyId;
  traffic: ProductTrafficState;
  serving: ProductServingState;
  subscriptionPlans?: SubscriptionPlan[];
}

export interface ModelState {
  id: number;
  familyId: number;
  baseModelId: number | null;
  name: string;
  version: number;
  developmentCost: number;
  capability: number;
  trueCapability: number;
  demonstratedCapability: number;
  marketTrust: number;
  capabilityDrift: number;
  inferenceCost: number;
  trust: number;
  memorySize: number;
  parameterScale: number;
  contextWindow: number;
  goals: Record<ModelGoalId, number>;
  trainingDataUnits: number;
  weekBuilt?: number;
  monthBuilt: number;
  sizeKey: ModelSizeId;
  dataTier: DataTierId;
  subscribersByCohort: Record<CohortId, number>;
  cohortTenureWeeks: Record<CohortId, number>;
  reliability: Record<ReliabilityTierId, number>;
  postTrainingComplete: boolean;
  deprecated: boolean;
  deprecationStartWeek: number | null;
  retired: boolean;
  maintenanceCostPerMonth: number;
  pendingSafetyRisk: number;
}

export interface PostTrainingConfig {
  rlhf: boolean;
  domainFocus: ModelGoalId | null;
  redTeam: boolean;
  weeksAllocated: number;
}

export interface PostTrainingRun {
  id: number;
  modelId: number;
  config: PostTrainingConfig;
  weeksElapsed: number;
  weeksTotal: number;
  projectedTrustDelta: number;
  projectedGoalBoost: { goalId: ModelGoalId; delta: number } | null;
  projectedSafetyIncidentRisk: number;
}

export interface ModelPerformanceState {
  totalRevenue: number;
  totalProfit: number;
  totalTokenUsageMillions: number;
  totalComputeCost: number;
  lastWeekRevenue: number;
  lastWeekTokenUsageMillions: number;
  lastWeekComputeCost: number;
  lastWeekProfit: number;
  lastWeekAcquisition: number;
  lastWeekChurn: number;
  lastWeekUsers: number;
  lastMonthRevenue: number;
  lastMonthTokenUsageMillions: number;
  lastMonthComputeCost: number;
  lastMonthProfit: number;
  lastMonthAcquisition: number;
  lastMonthChurn: number;
  lastMonthUsers: number;
}

export interface EmployeeState {
  id: number;
  name: string;
  departmentId: DepartmentId;
  roleId: RoleId;
  title: string;
  level: EmployeeLevelId;
  salary: number;
  specialty: ResearchSpecialtyId | null;
  skill: number;
  leadership: number;
  loyalty: number;
  burnout: number;
  poachRisk: number;
  breakthroughChance: number;
  active: boolean;
  status: EmployeeStatusId;
  assignedRunId: number | null;
}

export interface HiringCandidateState {
  id: number;
  name: string;
  departmentId: DepartmentId;
  roleId: RoleId;
  title: string;
  level: EmployeeLevelId;
  salary: number;
  specialty: ResearchSpecialtyId | null;
  skill: number;
  leadership: number;
  loyalty: number;
  burnout: number;
  poachRisk: number;
  breakthroughChance: number;
  signingCost: number;
}

export interface DepartmentState {
  id: DepartmentId;
  name: string;
  roleId: RoleId;
  leadEmployeeId: number | null;
  morale: number;
  managementQuality: number;
}

export interface ActiveRun {
  id: number;
  mode: TrainingMode;
  baseModelId: number | null;
  familyId: number | null;
  name: string;
  targetVersion: number;
  totalDevelopmentCost: number;
  sizeKey: ModelSizeId;
  dataTier: DataTierId;
  computeNeed: number;
  totalWeeks: number;
  weeksElapsed: number;
  totalMonths?: number;
  monthsElapsed?: number;
  projectedCapability: number;
  projectedInferenceCost: number;
  projectedTrust: number;
  baseFailureRisk: number;
  riskModifier: number;
  capabilityModifier: number;
  trustModifier: number;
  targetMemorySize: number;
  targetParameterScale: number;
  targetContextWindow: number;
  goals: Record<ModelGoalId, number>;
  trainingDataUnits: number;
  remainingDevelopmentCost: number;
  researcherDiscountPerResearcher: number;
  lossSeverity: number;
  eventTriggered: boolean;
  lossCurve: number[];
  reliability: Record<ReliabilityTierId, number>;
  assignedResearcherIds: number[];
  keyPersonRisk: number;
}

export interface PendingEventChoice {
  key: string;
  label: string;
  effect: string;
}

export interface PendingEvent {
  type: RunEventType;
  runId: number | null;
  employeeId?: number | null;
  title: string;
  body: string;
  choices: PendingEventChoice[];
}

export interface FundingState {
  available: boolean;
  offer: number;
  dilution: number;
  lastRaisedWeek?: number;
  /** @deprecated Compatibility alias for old monthly saves. Use lastRaisedWeek. */
  lastRaisedTurn?: number;
}

export interface DatacenterState {
  id: number;
  name: string;
  pods: number;
  buildCost: number;
  weekBuilt?: number;
  monthBuilt: number;
}

export interface PlannedDatacenterState {
  id: number;
  name: string;
  pods: number;
  buildCost: number;
  weekOrdered?: number;
  weeksRemaining?: number;
  monthOrdered?: number;
  monthsRemaining?: number;
}

export interface RivalState {
  id: RivalId;
  cooldown: number;
  lastAction: string | null;
}

export interface MarketModifier {
  id: number;
  type: MarketModifierId;
  source: RivalId;
  title: string;
  description: string;
  weeksRemaining?: number;
  /** @deprecated Compatibility alias for old monthly saves. Use weeksRemaining. */
  turnsRemaining?: number;
  intensity: number;
}

export interface PendingBoardReview {
  quarter: number;
  reasons: string[];
}

export interface LastMonthSnapshot {
  revenue: number;
  expenses: number;
  profit: number;
  users: number;
  payroll: number;
  marketingSpend: number;
  baseOpsCost?: number;
  loanPayments?: number;
  computeReservedCost: number;
  burstCloudCost: number;
  overflowCost: number;
  servingDemand: number;
  trainingDemand: number;
  burstCloudPodsUsed: number;
  datacenterCapacityAdded: number;
  datacenterCapacityPending: number;
  trustDelta: number;
  distributionDelta: {
    consumer: number;
    enterprise: number;
  };
  cloudRentalRevenue: number;
  cloudRentalPodsRented: number;
  developmentCost?: number;
  maintenanceCost?: number;
  hiringSpend: number;
  severanceCost: number;
  products?: Record<ProductTypeId, ProductPeriodSnapshot>;
}

export interface OperatingCashflowSnapshot {
  payroll: number;
  marketingSpend: number;
  baseOpsCost: number;
  loanPayments: number;
  computeReservedCost: number;
  cloudRentalRevenue: number;
  cloudRentalPodsRented: number;
  developmentCost: number;
  maintenanceCost: number;
}

export interface ProductPeriodSnapshot {
  revenue: number;
  users: number;
  acquisition: number;
  churnedUsers: number;
  churn: number;
  tokenUsageMillions: number;
  computeDemand: number;
  computeCost: number;
}

export interface ProductReportingSnapshot {
  revenue: number;
  users: number;
  acquisition: number;
  churnedUsers: number;
  churn: number;
  tokenUsageMillions: number;
  computeDemand: number;
  computeCost: number;
  products: Record<ProductTypeId, ProductPeriodSnapshot>;
}

export interface GameHistory {
  revenue: number[];
  profit: number[];
  arr: number[];
  trust: number[];
  boardPressure: number[];
}

export interface TrainingConfig {
  mode: TrainingMode;
  baseModelId: number | null;
  targetVersion: number;
  size: ModelSizeId;
  dataTier: DataTierId;
  computeNeed: number;
  name: string;
  targetMemorySize: number;
  targetParameterScale: number;
  targetContextWindow: number;
  goals: Record<ModelGoalId, number>;
  trainingDataUnits: number;
  reliability: Record<ReliabilityTierId, number>;
  assignedResearcherIds: number[];
}

export interface GameState {
  /** @deprecated Compatibility alias for old monthly saves/UI. Use week for simulation time. */
  turn: number;
  week: number;
  status: "playing" | "lost";
  cash: number;
  engineerTrainingLevel: number;
  archetype: ArchetypeId;
  marketingBudgetMillions: number;
  monthlyUserMultiplier: number;
  trust: number;
  distribution: {
    consumer: number;
    enterprise: number;
  };
  boardPressure: number;
  currentDirective: BoardDirectiveId | null;
  /** @deprecated Compatibility alias for old monthly saves. Use directiveWeeksRemaining. */
  directiveTurnsRemaining: number;
  directiveWeeksRemaining?: number;
  marketStandard: number;
  competitorLaunchShock: number;
  rivals: Record<RivalId, RivalState>;
  marketModifiers: MarketModifier[];
  macroPressure: number;
  macroPressureWeeksRemaining: number;
  marketMaturityWeeks: number;
  lastMacroShockWeek: number;
  headcount: Record<RoleId, number>;
  dataInventory: Record<DataTierId, number>;
  upgrades: Record<UpgradeId, number>;
  cloud: {
    reservedPods: number;
    trainingPct: number;
    datacenters: DatacenterState[];
    plannedDatacenters: PlannedDatacenterState[];
    nextDatacenterId: number;
  };
  cloudRental: {
    pricePerPod: number;
  };
  departments: Record<DepartmentId, DepartmentState>;
  employees: EmployeeState[];
  hiringMarket: HiringCandidateState[];
  globalCohorts: Record<CohortId, CohortDef>;
  products: Record<ProductTypeId, ProductState>;
  trainingConfig: TrainingConfig;
  activeRuns: ActiveRun[];
  postTrainingRuns: PostTrainingRun[];
  models: ModelState[];
  modelPerformance: Record<string, ModelPerformanceState>;
  pendingEvent: PendingEvent | null;
  pendingBoardReview: PendingBoardReview | null;
  funding: FundingState;
  totalDilution: number;
  history: GameHistory;
  goalEconomics: Record<ModelGoalId, GoalEconomicsRule>;
  competitorAdmin: Record<string, CompetitorAdminState>;
  competitorCompanies: Record<string, CompetitorCompanyState>;
  notifications: NotificationItem[];
  deficitMonths: number;
  loans: Loan[];
  lastWeek: ProductReportingSnapshot;
  currentMonthToDate: ProductReportingSnapshot;
  lastWeekCashflow: OperatingCashflowSnapshot;
  currentMonthCashflow: OperatingCashflowSnapshot;
  lastWeekCompany: LastMonthSnapshot;
  currentMonthCompany: LastMonthSnapshot;
  lastMonth: LastMonthSnapshot;
  pendingSafetyRisk: number;
  nextId: number;
}

export interface AppState {
  screen: ScreenId;
  game: GameState | null;
}

export interface ArchetypeModifiers {
  fundingPrestige: number;
  trainingCapabilityBonus: number;
  startingBoardPressure: number;
  chatbotAcquisitionMultiplier: number;
  apiAcquisitionMultiplier: number;
  consumerDistributionGrowthMultiplier: number;
  enterpriseDistributionGrowthMultiplier: number;
  trustResilience: number;
  pricingPowerPenalty: number;
  commoditizationResistance: number;
}

export interface ArchetypeDefinition {
  id: ArchetypeId;
  name: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  winStyle: string;
  startingCash: number;
  startingHeadcount: Record<RoleId, number>;
  startingTrust: number;
  startingDistribution: {
    consumer: number;
    enterprise: number;
  };
  startingMarketStandard: number;
  startingDataInventory: Record<DataTierId, number>;
  startingTrainingConfig: TrainingConfig;
  modifiers: ArchetypeModifiers;
}

export interface BoardDirectiveDefinition {
  id: BoardDirectiveId;
  name: string;
  summary: string;
  upside: string;
  downside: string;
}

export interface RivalDefinition {
  id: RivalId;
  name: string;
  summary: string;
  cadence: [number, number];
}

export interface ProductDefinition {
  key: ProductTypeId;
  name: string;
  unitLabel: string;
  priceUnitLabel: string;
  defaultPrice: number;
  minPrice: number;
  maxPrice: number;
  step: number;
}

export interface UpgradeDefinition {
  key: UpgradeId;
  name: string;
  description: string;
  costs: number[];
}

export interface DataTierDefinition {
  key: DataTierId;
  name: string;
  cost: number;
  quality: number;
  trust: number;
  capability: number;
  tag: string;
}

export interface DatasetPackDefinition {
  id: DatasetPackSizeId;
  name: string;
  units: number;
  multiplier: number;
}

export interface ModelGoalDefinition {
  id: ModelGoalId;
  name: string;
  summary: string;
}

export interface GoalEconomicsRule {
  fixedCostMillions: number;
  percentOfBaseCost: number;
}

export interface ModelSizeDefinition {
  key: ModelSizeId;
  name: string;
  baseCapability: number;
  baseInference: number;
  baseRisk: number;
  baseWork: number;
  minCompute: number;
  maxCompute: number;
}

export interface CompetitorCompanyDefinition {
  id: string;
  name: string;
  startingCapitalMillions: number;
  versionBase: number;
  sizeKey: ModelSizeId;
  dataTier: DataTierId;
  defaultBehavior: CompetitorBehaviorId;
  defaultStrategy: CompetitorStrategyId;
  defaultCapabilityModifier: number;
  defaultGoalModifiers: Partial<Record<ModelGoalId, number>>;
  goals: Record<ModelGoalId, number>;
}

export interface CompetitorAdminState {
  capitalAddedMillions: number;
  behavior: CompetitorBehaviorId;
  strategy: CompetitorStrategyId;
  capabilityModifier: number; // Multiplier; 1.0 is baseline.
  goalModifiers: Partial<Record<ModelGoalId, number>>;
}

export interface CompetitorModelState {
  name: string;
  version: number;
  developmentCost: number;
  capability: number;
  memorySize: number;
  parameterScale: number;
  contextWindow: number;
  goals: Record<ModelGoalId, number>;
  weekBuilt?: number;
  monthBuilt: number;
  releaseWeek?: number;
  releaseMonth: number;
  apiPrice: number | null;
  chatPrice: number | null;
  launchChatPrice: number | null;
  launchApiPrice: number | null;
  chatPriceHistory: number[];
  apiPriceHistory: number[];
  subscribersByCohort: Record<CohortId, number>;
  cohortTenureWeeks: Record<CohortId, number>;
  reliability: Record<ReliabilityTierId, number>;
}

export interface CompetitorCompanyState {
  id: string;
  cash: number;
  revenueHistory: number[];
  profitHistory: number[];
  models: CompetitorModelState[];
  pricingCooldownWeeks: number;
  lastPriceReviewWeek: number;
  releaseIndex: number;
  nextReleaseWeek?: number;
  /** @deprecated Compatibility alias for old monthly saves. Use nextReleaseWeek. */
  nextReleaseMonth: number;
  currentFamilyName: string;
}
