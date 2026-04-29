import {
  ARCHETYPES,
  BASE_OPS_COST,
  BASE_POD_COST,
  BOARD_DIRECTIVES,
  COMPETITOR_COMPANIES,
  COMPETITOR_STRATEGIES,
  createArchetypeEmployees,
  createDefaultDepartments,
  createEmptyCohortSubscriberMap,
  createHiringCandidates,
  DEPARTMENT_LABELS,
  DEPARTMENT_ROLE_MAP,
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
  RESEARCH_SPECIALTY_LABELS,
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
  DepartmentId,
  ModelState,
  ArchetypeModifiers,
  DataTierId,
  EmployeeState,
  GameState,
  HiringCandidateState,
  MarketModifier,
  MarketModifierId,
  ModelGoalId,
  NotificationTone,
  PendingBoardReview,
  PendingEvent,
  ProductPeriodSnapshot,
  ProductReportingSnapshot,
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
import {
  BURST_CLOUD_CAPACITY_RATIO,
  BURST_CLOUD_COST_PER_POD,
  BURST_CLOUD_MIN_PODS,
  COMPETITOR_PRICE_REVIEW_INTERVAL_WEEKS,
  DATACENTER_PROVISIONING_MONTHS,
  DATACENTER_PROVISIONING_WEEKS,
} from "./systems/balance";
import { WEEKS_PER_MONTH, WEEKS_PER_QUARTER, getMonthIndexFromWeek, isMonthEndWeek, weekLabel as formatWeekLabel } from "./time";
export {
  WEEKS_PER_MONTH,
  WEEKS_PER_QUARTER,
  WEEKS_PER_YEAR,
  getMonthIndexFromWeek,
  getQuarterIndexFromWeek,
  getYearFromWeek,
  isMonthEndWeek,
  isQuarterEndWeek,
  isYearEndWeek,
  monthLabelFromWeek,
} from "./time";

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
  if (term <= 0) return { feePct: 0, totalRepayment: 0, monthlyPayment: 0, termWeeks: 0, weeklyPayment: 0 };
  if (term <= 6) {
    const monthlyPayment = principal / term;
    return {
      feePct: 0,
      totalRepayment: principal,
      monthlyPayment,
      termWeeks: term * WEEKS_PER_MONTH,
      weeklyPayment: monthlyPayment / WEEKS_PER_MONTH,
    };
  }
  const feePct = Math.min(0.25, (term - 6) * (0.25 / 114));
  const totalRepayment = principal * (1 + feePct);
  const monthlyPayment = totalRepayment / term;
  return {
    feePct,
    totalRepayment,
    monthlyPayment,
    termWeeks: term * WEEKS_PER_MONTH,
    weeklyPayment: monthlyPayment / WEEKS_PER_MONTH,
  };
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

export function getEngineerFailureRiskReduction(game: Pick<GameState, "headcount" | "upgrades" | "engineerTrainingLevel" | "departments">) {
  return game.headcount.engineers * 0.015 * getEngineerTrainingMultiplier(game.engineerTrainingLevel) + game.upgrades.training * 0.03 + game.departments.engineering.managementQuality * 0.0008;
}

export function monthLabel(turn: number) {
  const idx = (turn - 1) % 12;
  const year = 2026 + Math.floor((turn - 1) / 12);
  return `${MONTHS[idx]} ${year}`;
}

export function weekLabel(week: number) {
  return formatWeekLabel(week);
}

function getCompatibleWeek(game: GameState) {
  const week = (game as Partial<GameState>).week;
  return typeof week === "number" && Number.isFinite(week)
    ? Math.max(1, Math.floor(week))
    : (game.turn - 1) * WEEKS_PER_MONTH + 1;
}

function getCompatibleMonthIndex(game: GameState) {
  return getMonthIndexFromWeek(getCompatibleWeek(game));
}

function getModelBuiltWeek(model: Pick<ModelState, "weekBuilt" | "monthBuilt">) {
  return typeof model.weekBuilt === "number" && Number.isFinite(model.weekBuilt)
    ? Math.max(1, Math.floor(model.weekBuilt))
    : legacyMonthToWeek(model.monthBuilt);
}

function legacyMonthToWeek(month: number) {
  return Math.max(1, Math.floor((month - 1) * WEEKS_PER_MONTH + 1));
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

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getLegacyMonthField(record: Record<string, any>, key: string, fallback = 1) {
  return Math.max(1, Math.floor(readFiniteNumber(record[key]) ?? fallback));
}

export function migrateMonthlySaveToWeekly(value: unknown): GameState | null {
  if (!isRecord(value)) return null;

  const game = value as GameState;
  const legacyMonth = getLegacyMonthField(game, "turn", 1);
  const currentWeek = Math.max(1, Math.floor(readFiniteNumber(game.week) ?? legacyMonthToWeek(legacyMonth)));
  game.week = currentWeek;
  game.turn = getMonthIndexFromWeek(currentWeek);

  if (isRecord(game.funding)) {
    const funding = game.funding as Record<string, any>;
    const lastRaisedWeek = readFiniteNumber(funding.lastRaisedWeek);
    const lastRaisedMonth = readFiniteNumber(funding.lastRaisedTurn);
    funding.lastRaisedWeek = Math.max(
      0,
      Math.floor(lastRaisedWeek ?? (lastRaisedMonth && lastRaisedMonth > 0 ? legacyMonthToWeek(lastRaisedMonth) : 0)),
    );
    funding.lastRaisedTurn = getMonthIndexFromWeek(Math.max(1, funding.lastRaisedWeek));
  }

  const directiveWeeks = readFiniteNumber(game.directiveWeeksRemaining);
  game.directiveWeeksRemaining = Math.max(0, Math.ceil(directiveWeeks ?? (readFiniteNumber(game.directiveTurnsRemaining) ?? 0) * WEEKS_PER_MONTH));
  game.directiveTurnsRemaining = Math.ceil(game.directiveWeeksRemaining / WEEKS_PER_MONTH);

  game.models?.forEach((model: any) => {
    const weekBuilt = readFiniteNumber(model.weekBuilt);
    model.weekBuilt = Math.max(1, Math.floor(weekBuilt ?? legacyMonthToWeek(getLegacyMonthField(model, "monthBuilt", 1))));
    model.monthBuilt = getMonthIndexFromWeek(model.weekBuilt);
    if (!isRecord(model.cohortTenureWeeks)) {
      model.cohortTenureWeeks = createEmptyCohortSubscriberMap();
    } else {
      GLOBAL_COHORT_IDS.forEach((cohortId) => {
        model.cohortTenureWeeks[cohortId] = Math.max(0, Math.floor(readFiniteNumber(model.cohortTenureWeeks[cohortId]) ?? 0));
      });
    }
  });

  game.activeRuns?.forEach((run: any) => {
    run.totalWeeks = Math.max(1, Math.ceil(readFiniteNumber(run.totalWeeks) ?? (readFiniteNumber(run.totalMonths) ?? 1) * WEEKS_PER_MONTH));
    run.weeksElapsed = Math.max(0, Math.floor(readFiniteNumber(run.weeksElapsed) ?? (readFiniteNumber(run.monthsElapsed) ?? 0) * WEEKS_PER_MONTH));
    run.totalMonths = Number((run.totalWeeks / WEEKS_PER_MONTH).toFixed(2));
    run.monthsElapsed = Number((run.weeksElapsed / WEEKS_PER_MONTH).toFixed(2));
  });

  game.cloud?.datacenters?.forEach((datacenter: any) => {
    const weekBuilt = readFiniteNumber(datacenter.weekBuilt);
    datacenter.weekBuilt = Math.max(1, Math.floor(weekBuilt ?? legacyMonthToWeek(getLegacyMonthField(datacenter, "monthBuilt", 1))));
    datacenter.monthBuilt = getMonthIndexFromWeek(datacenter.weekBuilt);
  });

  game.cloud?.plannedDatacenters?.forEach((datacenter: any) => {
    const weekOrdered = readFiniteNumber(datacenter.weekOrdered);
    datacenter.weekOrdered = Math.max(1, Math.floor(weekOrdered ?? legacyMonthToWeek(getLegacyMonthField(datacenter, "monthOrdered", legacyMonth))));
    datacenter.monthOrdered = getMonthIndexFromWeek(datacenter.weekOrdered);
    datacenter.weeksRemaining = Math.max(0, Math.ceil(readFiniteNumber(datacenter.weeksRemaining) ?? (readFiniteNumber(datacenter.monthsRemaining) ?? DATACENTER_PROVISIONING_MONTHS) * WEEKS_PER_MONTH));
    datacenter.monthsRemaining = Math.ceil(datacenter.weeksRemaining / WEEKS_PER_MONTH);
  });

  game.marketModifiers?.forEach((modifier: any) => {
    modifier.weeksRemaining = Math.max(0, Math.ceil(readFiniteNumber(modifier.weeksRemaining) ?? (readFiniteNumber(modifier.turnsRemaining) ?? 0) * WEEKS_PER_MONTH));
    modifier.turnsRemaining = Math.ceil(modifier.weeksRemaining / WEEKS_PER_MONTH);
  });

  Object.values(game.competitorCompanies ?? {}).forEach((competitor: any) => {
    competitor.nextReleaseWeek = Math.max(1, Math.floor(readFiniteNumber(competitor.nextReleaseWeek) ?? legacyMonthToWeek(getLegacyMonthField(competitor, "nextReleaseMonth", 1))));
    competitor.nextReleaseMonth = getMonthIndexFromWeek(competitor.nextReleaseWeek);
    competitor.lastPriceReviewWeek = Math.max(0, Math.floor(readFiniteNumber(competitor.lastPriceReviewWeek) ?? 0));
    competitor.pricingCooldownWeeks = Math.max(
      0,
      Math.floor(
        readFiniteNumber(competitor.pricingCooldownWeeks) ??
          competitor.lastPriceReviewWeek + COMPETITOR_PRICE_REVIEW_INTERVAL_WEEKS - currentWeek,
      ),
    );
    competitor.models?.forEach((model: any) => {
      model.weekBuilt = Math.max(1, Math.floor(readFiniteNumber(model.weekBuilt) ?? legacyMonthToWeek(getLegacyMonthField(model, "monthBuilt", 1))));
      model.monthBuilt = getMonthIndexFromWeek(model.weekBuilt);
      model.releaseWeek = Math.max(1, Math.floor(readFiniteNumber(model.releaseWeek) ?? legacyMonthToWeek(getLegacyMonthField(model, "releaseMonth", model.monthBuilt))));
      model.releaseMonth = getMonthIndexFromWeek(model.releaseWeek);
      const chatPriceHistory = Array.isArray(model.chatPriceHistory)
        ? model.chatPriceHistory.filter((price: unknown) => readFiniteNumber(price) !== null)
        : [];
      const apiPriceHistory = Array.isArray(model.apiPriceHistory)
        ? model.apiPriceHistory.filter((price: unknown) => readFiniteNumber(price) !== null)
        : [];
      model.chatPriceHistory = model.chatPrice === null ? [] : (chatPriceHistory.length ? chatPriceHistory : [model.chatPrice]).slice(-4);
      model.apiPriceHistory = model.apiPrice === null ? [] : (apiPriceHistory.length ? apiPriceHistory : [model.apiPrice]).slice(-4);
      model.launchChatPrice = model.chatPrice === null
        ? null
        : readFiniteNumber(model.launchChatPrice) ?? model.chatPriceHistory[0] ?? model.chatPrice;
      model.launchApiPrice = model.apiPrice === null
        ? null
        : readFiniteNumber(model.launchApiPrice) ?? model.apiPriceHistory[0] ?? model.apiPrice;
      if (!isRecord(model.cohortTenureWeeks)) {
        model.cohortTenureWeeks = createEmptyCohortSubscriberMap();
      } else {
        GLOBAL_COHORT_IDS.forEach((cohortId) => {
          model.cohortTenureWeeks[cohortId] = Math.max(0, Math.floor(readFiniteNumber(model.cohortTenureWeeks[cohortId]) ?? 0));
        });
      }
    });
  });

  game.loans?.forEach((loan: any) => {
    loan.termWeeks = Math.max(0, Math.ceil(readFiniteNumber(loan.termWeeks) ?? (readFiniteNumber(loan.term) ?? 0) * WEEKS_PER_MONTH));
    loan.elapsedWeeks = Math.max(0, Math.ceil(readFiniteNumber(loan.elapsedWeeks) ?? (readFiniteNumber(loan.elapsed) ?? 0) * WEEKS_PER_MONTH));
    loan.weeklyPayment = readFiniteNumber(loan.weeklyPayment) ?? (readFiniteNumber(loan.monthlyPayment) ?? 0) / WEEKS_PER_MONTH;
  });

  return game;
}

export function copyGame(game: GameState): GameState {
  const next = copyGameSystem(game);
  migrateMonthlySaveToWeekly(next);
  return next;
}

export function getArchetype(game: GameState) {
  return ARCHETYPES[game.archetype];
}

export function getDirective(game: GameState) {
  return game.currentDirective ? BOARD_DIRECTIVES[game.currentDirective] : null;
}

export function getHeadcountTotal(game: GameState) {
  return Object.values(game.headcount).reduce((sum, count) => sum + count, 0) + game.employees.filter((employee) => employee.active).length;
}

function getNamedPayroll(game: Pick<GameState, "employees">) {
  return game.employees
    .filter((employee) => employee.active)
    .reduce((sum, employee) => sum + employee.salary / 12, 0);
}

export function getPayroll(game: Pick<GameState, "headcount" | "employees">) {
  return (Object.entries(game.headcount) as [RoleId, number][])
    .reduce((sum, [role, count]) => sum + count * SALARIES[role], 0) + getNamedPayroll(game);
}

function getActiveEmployees(game: Pick<GameState, "employees">) {
  return game.employees.filter((employee) => employee.active);
}

function getEmployeeById(game: Pick<GameState, "employees">, employeeId: number | null | undefined) {
  return game.employees.find((employee) => employee.id === employeeId) ?? null;
}

function getAssignedResearchers(game: Pick<GameState, "employees" | "trainingConfig">) {
  return game.trainingConfig.assignedResearcherIds
    .map((employeeId) => getEmployeeById(game, employeeId))
    .filter((employee): employee is NonNullable<ReturnType<typeof getEmployeeById>> => Boolean(employee && employee.active && employee.departmentId === "research"));
}

function getLevelWeight(level: EmployeeState["level"]) {
  if (level === "executive") return 4;
  if (level === "director") return 3;
  if (level === "lead") return 2;
  return 1;
}

function refreshDepartmentLeads(game: Pick<GameState, "departments" | "employees">) {
  (Object.keys(game.departments) as DepartmentId[]).forEach((departmentId) => {
    const members = game.employees
      .filter((employee) => employee.active && employee.departmentId === departmentId)
      .sort((left, right) => getLevelWeight(right.level) - getLevelWeight(left.level) || right.leadership - left.leadership || right.skill - left.skill);
    const lead = members[0] ?? null;
    const managementQuality = members.length
      ? Math.round(members.reduce((sum, employee) => sum + employee.leadership, 0) / members.length)
      : 35;
    const morale = members.length
      ? Math.round(
        clamp(
          48 +
            managementQuality * 0.32 +
            members.reduce((sum, employee) => sum + employee.loyalty - employee.burnout, 0) / members.length * 0.28,
          25,
          92,
        ),
      )
      : 45;
    game.departments[departmentId] = {
      ...game.departments[departmentId],
      leadEmployeeId: lead?.id ?? null,
      managementQuality,
      morale,
    };
  });
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
    lastWeekRevenue: 0,
    lastWeekAcquisition: 0,
    lastWeekChurn: 0,
    lastWeekUsers: 0,
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
      launchChatPrice: chatPrice,
      launchApiPrice: apiPrice,
      chatPriceHistory: chatPrice === null ? [] : [chatPrice],
      apiPriceHistory: apiPrice === null ? [] : [apiPrice],
      subscribersByCohort: createEmptyCohortSubscriberMap(),
      cohortTenureWeeks: createEmptyCohortSubscriberMap(),
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
  const currentWeek = getCompatibleWeek(game);
  const averageAge = models.reduce((sum, model) => sum + Math.max(0, (currentWeek - getModelBuiltWeek(model)) / WEEKS_PER_MONTH), 0) / models.length;
  const recencyScore = models.reduce(
    (sum, model) => sum + clamp((18 - Math.max(0, (currentWeek - getModelBuiltWeek(model)) / WEEKS_PER_MONTH)) / 18, 0.2, 1),
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
  const baseDemand = Math.round(getCompatibleMonthIndex(game) * 10 + totalCompetitorModels * 30 + 60);

  // Price sensitivity: at or below market rate demand is fully met;
  // above market rate demand falls off exponentially.
  const ratio = pricePerPod / CLOUD_RENTAL_MARKET_RATE;
  const demandMultiplier = ratio <= 1 ? 1 : Math.exp(-3.5 * (ratio - 1));

  const podsRented = Math.min(surplusPods, Math.round(baseDemand * demandMultiplier));
  const revenue = podsRented * pricePerPod;
  return { revenue, podsRented };
}

function getLoanTermWeeks(loan: GameState["loans"][number]) {
  return loan.termWeeks ?? loan.term * WEEKS_PER_MONTH;
}

function getLoanElapsedWeeks(loan: GameState["loans"][number]) {
  return loan.elapsedWeeks ?? loan.elapsed * WEEKS_PER_MONTH;
}

function getWeeklyLoanPayment(loan: GameState["loans"][number], week: number) {
  return loan.weeklyPayment !== undefined
    ? getWeeklyPortion(loan.weeklyPayment * WEEKS_PER_MONTH, week)
    : getWeeklyPortion(loan.monthlyPayment, week);
}

function settleWeeklyOperatingCashflow(next: GameState, week: number) {
  ensureOperatingCashflowState(next);

  const effects = getDirectiveEffects(next);
  const trainingDemand = next.activeRuns.reduce((sum, run) => sum + run.computeNeed, 0);
  const allocatedTraining = (next.cloud.reservedPods * next.cloud.trainingPct) / 100;
  const allocatedServing = (next.cloud.reservedPods * (100 - next.cloud.trainingPct)) / 100;
  const servingDemand = next.products.chatbot.computeDemand + next.products.api.computeDemand;
  const surplusPods = Math.max(0, allocatedServing - servingDemand) + Math.max(0, allocatedTraining - trainingDemand);
  const rentalResult = settleCloudRental(next, Math.floor(surplusPods));

  const loanPayments = next.loans.reduce((sum, loan) => sum + getWeeklyLoanPayment(loan, week), 0);
  const payroll = getWeeklyPortion(getPayroll(next), week);
  const marketingSpend = getWeeklyPortion(next.marketingBudgetMillions * 1000000, week);
  const baseOpsCost = getWeeklyPortion(BASE_OPS_COST, week);
  const computeReservedCost = getWeeklyPortion(next.cloud.reservedPods * getReservedCostPerPod(next) * effects.reservedCostMultiplier, week);
  const cloudRentalRevenue = getWeeklyPortion(rentalResult.revenue, week);
  const weeklySnapshot = {
    payroll,
    marketingSpend,
    baseOpsCost,
    loanPayments,
    computeReservedCost,
    cloudRentalRevenue,
    cloudRentalPodsRented: rentalResult.podsRented,
    developmentCost: 0,
  };

  next.cash += cloudRentalRevenue - payroll - marketingSpend - baseOpsCost - computeReservedCost - loanPayments;
  next.currentMonthCashflow = addOperatingCashflowSnapshot(next.currentMonthCashflow, weeklySnapshot);
  next.loans = next.loans.filter((loan) => {
    const elapsedWeeks = getLoanElapsedWeeks(loan) + 1;
    const termWeeks = getLoanTermWeeks(loan);
    loan.termWeeks = termWeeks;
    loan.elapsedWeeks = elapsedWeeks;
    loan.elapsed = Math.min(loan.term, Math.floor(elapsedWeeks / WEEKS_PER_MONTH));
    loan.weeklyPayment = loan.weeklyPayment ?? loan.monthlyPayment / WEEKS_PER_MONTH;
    return elapsedWeeks < termWeeks;
  });

  return weeklySnapshot;
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

function getPlannedDatacenterWeeksRemaining(datacenter: GameState["cloud"]["plannedDatacenters"][number]) {
  if (typeof datacenter.weeksRemaining === "number" && Number.isFinite(datacenter.weeksRemaining)) {
    return Math.max(0, Math.ceil(datacenter.weeksRemaining));
  }
  return Math.max(0, Math.ceil((datacenter.monthsRemaining ?? DATACENTER_PROVISIONING_MONTHS) * WEEKS_PER_MONTH));
}

function resolvePlannedDatacenters(game: GameState) {
  let capacityAdded = 0;
  const activated: GameState["cloud"]["datacenters"] = [];

  game.cloud.plannedDatacenters = game.cloud.plannedDatacenters.reduce((pending, datacenter) => {
    const weeksRemaining = getPlannedDatacenterWeeksRemaining(datacenter) - 1;
    if (weeksRemaining <= 0) {
      const activatedDatacenter = {
        id: datacenter.id,
        name: datacenter.name,
        pods: datacenter.pods,
        buildCost: datacenter.buildCost,
        weekBuilt: getCompatibleWeek(game),
        monthBuilt: getMonthIndexFromWeek(getCompatibleWeek(game)),
      };
      activated.push(activatedDatacenter);
      capacityAdded += datacenter.pods;
      return pending;
    }

    pending.push({
      ...datacenter,
      weeksRemaining,
      monthsRemaining: Math.ceil(weeksRemaining / WEEKS_PER_MONTH),
    });
    return pending;
  }, [] as GameState["cloud"]["plannedDatacenters"]);

  if (activated.length > 0) {
    game.cloud.datacenters.push(...activated);
    game.cloud.reservedPods += capacityAdded;
    addNotification(
      game,
      activated.length === 1
        ? `${activated[0].name} came online with ${activated[0].pods} pods.`
        : `${activated.length} datacenters came online with ${capacityAdded} total pods.`,
      "good",
    );
  }

  return capacityAdded;
}

function getBurstCloudCapacity(game: GameState, allocatedServing: number) {
  return Math.max(
    BURST_CLOUD_MIN_PODS,
    Math.round(allocatedServing * BURST_CLOUD_CAPACITY_RATIO + game.upgrades.cloud * 6),
  );
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
): ReturnType<typeof getProductComputeUsageSystem> {
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

function getRunTotalWeeks(run: ActiveRun) {
  if (typeof run.totalWeeks === "number" && Number.isFinite(run.totalWeeks)) {
    return Math.max(1, Math.ceil(run.totalWeeks));
  }
  return Math.max(1, Math.ceil((run.totalMonths ?? 1) * WEEKS_PER_MONTH));
}

function getRunWeeksElapsed(run: ActiveRun) {
  if (typeof run.weeksElapsed === "number" && Number.isFinite(run.weeksElapsed)) {
    return Math.max(0, Math.floor(run.weeksElapsed));
  }
  return Math.max(0, Math.ceil((run.monthsElapsed ?? 0) * WEEKS_PER_MONTH));
}

function syncRunWeekFields(run: ActiveRun) {
  run.totalWeeks = getRunTotalWeeks(run);
  run.weeksElapsed = Math.min(getRunWeeksElapsed(run), run.totalWeeks);
  run.totalMonths = Number((run.totalWeeks / WEEKS_PER_MONTH).toFixed(2));
  run.monthsElapsed = Number((run.weeksElapsed / WEEKS_PER_MONTH).toFixed(2));
}

function addRunWeeks(run: ActiveRun, weeks: number) {
  syncRunWeekFields(run);
  run.totalWeeks = Math.max(1, Math.ceil(run.totalWeeks + weeks));
  run.totalMonths = Number((run.totalWeeks / WEEKS_PER_MONTH).toFixed(2));
}

function monthlyProbabilityToWeekly(monthlyProbability: number) {
  return 1 - Math.pow(1 - clamp(monthlyProbability, 0, 0.999), 1 / WEEKS_PER_MONTH);
}

const WEEKLY_TRAINING_EVENT_PROBABILITY = monthlyProbabilityToWeekly(0.52);
const WEEKLY_TALENT_EVENT_FINAL_PROBABILITY = monthlyProbabilityToWeekly(0.45);
const WEEKLY_TALENT_BREAKTHROUGH_DENOMINATOR = 120 * WEEKS_PER_MONTH;

function nextRivalCooldown(rivalId: RivalId) {
  const [min, max] = RIVALS[rivalId].cadence;
  return randInt(min * WEEKS_PER_MONTH, max * WEEKS_PER_MONTH);
}

function getMarketModifierWeeksRemaining(modifier: MarketModifier) {
  if (typeof modifier.weeksRemaining === "number" && Number.isFinite(modifier.weeksRemaining)) {
    return Math.max(0, Math.ceil(modifier.weeksRemaining));
  }
  return Math.max(0, Math.ceil((modifier.turnsRemaining ?? 0) * WEEKS_PER_MONTH));
}

function syncMarketModifierWeeks(modifier: MarketModifier, weeksRemaining: number) {
  modifier.weeksRemaining = Math.max(0, weeksRemaining);
  modifier.turnsRemaining = Math.ceil(modifier.weeksRemaining / WEEKS_PER_MONTH);
}

function getDirectiveWeeksRemaining(game: GameState) {
  if (typeof game.directiveWeeksRemaining === "number" && Number.isFinite(game.directiveWeeksRemaining)) {
    return Math.max(0, Math.ceil(game.directiveWeeksRemaining));
  }
  return Math.max(0, Math.ceil(game.directiveTurnsRemaining * WEEKS_PER_MONTH));
}

function syncDirectiveWeeks(game: GameState, weeksRemaining: number) {
  game.directiveWeeksRemaining = Math.max(0, weeksRemaining);
  game.directiveTurnsRemaining = Math.ceil(game.directiveWeeksRemaining / WEEKS_PER_MONTH);
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
    syncMarketModifierWeeks(existing, getMarketModifierWeeksRemaining(modifier));
    existing.intensity = modifier.intensity;
    existing.title = modifier.title;
    existing.description = modifier.description;
    return;
  }

  const weeksRemaining = getMarketModifierWeeksRemaining(modifier);
  game.marketModifiers.push({
    id: game.nextId++,
    ...modifier,
    weeksRemaining,
    turnsRemaining: Math.ceil(weeksRemaining / WEEKS_PER_MONTH),
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
    quarter: getQuarterNumber(getCompatibleMonthIndex(game)),
    reasons,
  };
}

function createEmptyProductTraffic(): ProductState["traffic"] {
  return {
    baselineTokensMillions: 0,
    burstMultiplier: 1,
    averageContextUtilization: 0.2,
    batchingFriendliness: 1,
    viralPressure: 0,
  };
}

function createEmptyProductServing(): ProductState["serving"] {
  return {
    effectiveTokensPerPod: 750,
    contextPenalty: 1,
    batchingEfficiency: 1,
    modelWeightPenalty: 1,
    hardwareEfficiency: 1,
    strategyCapacityPenalty: 1,
    burstPodsUsed: 0,
    burstCost: 0,
    overflowPods: 0,
    capacityPressure: 0,
  };
}

function createEmptyProductPeriodSnapshot(): ProductPeriodSnapshot {
  return {
    revenue: 0,
    users: 0,
    acquisition: 0,
    churnedUsers: 0,
    churn: 0,
    tokenUsageMillions: 0,
    computeDemand: 0,
    computeCost: 0,
  };
}

function createEmptyProductReportingSnapshot(): ProductReportingSnapshot {
  const products = {
    chatbot: createEmptyProductPeriodSnapshot(),
    api: createEmptyProductPeriodSnapshot(),
  };

  return {
    revenue: 0,
    users: 0,
    acquisition: 0,
    churnedUsers: 0,
    churn: 0,
    tokenUsageMillions: 0,
    computeDemand: 0,
    computeCost: 0,
    products,
  };
}

function summarizeProductSnapshot(products: Record<ProductTypeId, ProductPeriodSnapshot>): ProductReportingSnapshot {
  const totals = (Object.keys(products) as ProductTypeId[]).reduce(
    (summary, type) => {
      const product = products[type];
      summary.revenue += product.revenue;
      summary.users += product.users;
      summary.acquisition += product.acquisition;
      summary.churnedUsers += product.churnedUsers;
      summary.tokenUsageMillions += product.tokenUsageMillions;
      summary.computeDemand += product.computeDemand;
      summary.computeCost += product.computeCost;
      return summary;
    },
    {
      revenue: 0,
      users: 0,
      acquisition: 0,
      churnedUsers: 0,
      tokenUsageMillions: 0,
      computeDemand: 0,
      computeCost: 0,
    },
  );
  const churn = totals.users + totals.churnedUsers > 0 ? totals.churnedUsers / (totals.users + totals.churnedUsers) : 0;

  return {
    revenue: Math.round(totals.revenue),
    users: Math.round(totals.users),
    acquisition: Math.round(totals.acquisition),
    churnedUsers: Math.round(totals.churnedUsers),
    churn: Number(churn.toFixed(3)),
    tokenUsageMillions: Number(totals.tokenUsageMillions.toFixed(2)),
    computeDemand: Number(totals.computeDemand.toFixed(2)),
    computeCost: Math.round(totals.computeCost),
    products,
  };
}

function ensureProductReportingState(game: GameState) {
  if (!game.lastWeek) {
    game.lastWeek = createEmptyProductReportingSnapshot();
  }
  if (!game.currentMonthToDate) {
    game.currentMonthToDate = createEmptyProductReportingSnapshot();
  }
}

function createEmptyOperatingCashflowSnapshot(): GameState["currentMonthCashflow"] {
  return {
    payroll: 0,
    marketingSpend: 0,
    baseOpsCost: 0,
    loanPayments: 0,
    computeReservedCost: 0,
    cloudRentalRevenue: 0,
    cloudRentalPodsRented: 0,
    developmentCost: 0,
  };
}

function ensureOperatingCashflowState(game: GameState) {
  if (!game.currentMonthCashflow) {
    game.currentMonthCashflow = createEmptyOperatingCashflowSnapshot();
  } else {
    game.currentMonthCashflow.developmentCost = game.currentMonthCashflow.developmentCost ?? 0;
  }
}

function getWeekOfMonth(week: number) {
  return ((Math.max(1, Math.floor(week)) - 1) % WEEKS_PER_MONTH) + 1;
}

function getWeeklyPortion(monthlyAmount: number, week: number) {
  const total = Math.round(monthlyAmount);
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / WEEKS_PER_MONTH);
  const remainder = abs - base * WEEKS_PER_MONTH;
  return sign * (base + (getWeekOfMonth(week) <= remainder ? 1 : 0));
}

function addOperatingCashflowSnapshot(
  current: GameState["currentMonthCashflow"],
  addition: GameState["currentMonthCashflow"],
): GameState["currentMonthCashflow"] {
  return {
    payroll: current.payroll + addition.payroll,
    marketingSpend: current.marketingSpend + addition.marketingSpend,
    baseOpsCost: current.baseOpsCost + addition.baseOpsCost,
    loanPayments: current.loanPayments + addition.loanPayments,
    computeReservedCost: current.computeReservedCost + addition.computeReservedCost,
    cloudRentalRevenue: current.cloudRentalRevenue + addition.cloudRentalRevenue,
    cloudRentalPodsRented: current.cloudRentalPodsRented + addition.cloudRentalPodsRented,
    developmentCost: (current.developmentCost ?? 0) + (addition.developmentCost ?? 0),
  };
}

function addProductPeriodSnapshot(
  current: ProductPeriodSnapshot,
  addition: ProductPeriodSnapshot,
): ProductPeriodSnapshot {
  const users = addition.users;
  const churnedUsers = current.churnedUsers + addition.churnedUsers;
  return {
    revenue: current.revenue + addition.revenue,
    users,
    acquisition: current.acquisition + addition.acquisition,
    churnedUsers,
    churn: users + churnedUsers > 0 ? Number((churnedUsers / (users + churnedUsers)).toFixed(3)) : 0,
    tokenUsageMillions: current.tokenUsageMillions + addition.tokenUsageMillions,
    computeDemand: addition.computeDemand,
    computeCost: current.computeCost + addition.computeCost,
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
      servingStrategy: "flagship",
      traffic: createEmptyProductTraffic(),
      serving: createEmptyProductServing(),
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
      servingStrategy: "enterprise_sla",
      traffic: createEmptyProductTraffic(),
      serving: createEmptyProductServing(),
    },
  };
}

function updateModelPerformance(
  game: GameState,
  periodProducts?: Partial<Record<ProductTypeId, ProductPeriodSnapshot>>,
  options?: { rollupMonth?: boolean },
) {
  updateModelPerformanceSystem(game, periodProducts, options);
  return;

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
      modelAges[String(modelId)] = model ? Math.max(0, (getCompatibleWeek(game) - getModelBuiltWeek(model)) / WEEKS_PER_MONTH) : 999;
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
    weekBuilt: 1,
    monthBuilt: 1,
  };
  const employees = createArchetypeEmployees(archetypeId).map((employee, index) => ({
    ...employee,
    id: index + 1,
    assignedRunId: null,
  }));
  const nextBaseId = employees.length + 4;
  const departments = createDefaultDepartments();
  const baseState = {
    turn: 1,
    week: 1,
    status: "playing" as const,
    engineerTrainingLevel: 0,
    archetype: archetypeId,
    marketingBudgetMillions: 0,
    monthlyUserMultiplier: 1,
    trust: archetype.startingTrust,
    distribution: { ...archetype.startingDistribution },
    boardPressure: archetype.modifiers.startingBoardPressure,
    currentDirective: null,
    directiveTurnsRemaining: 0,
    directiveWeeksRemaining: 0,
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
      plannedDatacenters: [],
      nextDatacenterId: 2,
    },
    cloudRental: {
      pricePerPod: 0,
    },
    departments,
    employees,
    hiringMarket: createHiringCandidates(`${archetypeId}:market`).map((candidate, index) => ({
      ...candidate,
      id: nextBaseId + index,
    })),
    globalCohorts: JSON.parse(JSON.stringify(GLOBAL_COHORTS)),
    products: createDefaultProducts(),
    trainingConfig: {
      ...archetype.startingTrainingConfig,
      goals: { ...archetype.startingTrainingConfig.goals },
      assignedResearcherIds: [],
    },
    deficitMonths: 0,
    loans: [],
    activeRuns: [],
    models: [],
    modelPerformance: {},
    pendingEvent: null,
    pendingBoardReview: null,
    funding: { available: false, offer: 0, dilution: 0, lastRaisedWeek: 0, lastRaisedTurn: 0 },
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
      { id: 1, text: `${archetype.name} selected. ${archetype.summary}`, tone: "good" as const },
      {
        id: 2,
        text: "Board brief: pick a strategy, survive the compute bill, and do not let rivals define your lane.",
        tone: "info" as const,
      },
      {
        id: 3,
        text: `Starting posture: Trust ${archetype.startingTrust}, Consumer Dist ${archetype.startingDistribution.consumer}, Enterprise Dist ${archetype.startingDistribution.enterprise}.`,
        tone: "warning" as const,
      },
    ],
    lastWeek: createEmptyProductReportingSnapshot(),
    currentMonthToDate: createEmptyProductReportingSnapshot(),
    currentMonthCashflow: createEmptyOperatingCashflowSnapshot(),
    lastMonth: {
      revenue: 0,
      expenses: reservedPods * BASE_POD_COST + BASE_OPS_COST,
      profit: -(reservedPods * BASE_POD_COST + BASE_OPS_COST),
      users: 0,
      payroll: 0,
      marketingSpend: 0,
      baseOpsCost: BASE_OPS_COST,
      loanPayments: 0,
      computeReservedCost: reservedPods * BASE_POD_COST,
      burstCloudCost: 0,
      overflowCost: 0,
      servingDemand: 0,
      trainingDemand: 0,
      burstCloudPodsUsed: 0,
      datacenterCapacityAdded: 0,
      datacenterCapacityPending: 0,
      trustDelta: 0,
      distributionDelta: { consumer: 0, enterprise: 0 },
      cloudRentalRevenue: 0,
      cloudRentalPodsRented: 0,
      developmentCost: 0,
      hiringSpend: 0,
      severanceCost: 0,
    },
    cash: archetype.startingCash,
    nextId: nextBaseId + 6,
  };
  refreshDepartmentLeads(baseState);
  baseState.lastMonth.payroll = getPayroll(baseState);

  return baseState;
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
        { key: "clean", label: "Pause And Clean For $250K", effect: "Adds four weeks, trims risk, preserves trust." },
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

function createTalentEvent(run: ActiveRun, employee: EmployeeState): PendingEvent {
  const roll = randInt(1, 3);

  if (roll === 1) {
    return {
      type: "talent_poach",
      runId: run.id,
      employeeId: employee.id,
      title: `${employee.name} Has A Competing Offer`,
      body: `${employee.name}, your ${employee.title.toLowerCase()}, is being poached mid-run. Losing them would weaken ${run.name} and shake the ${DEPARTMENT_LABELS[employee.departmentId]} org.`,
      choices: [
        { key: "retain", label: "Match And Retain", effect: "Pay retention cash, reduce poach risk, protect the run." },
        { key: "let_go", label: "Let Them Walk", effect: "Save cash now, but hurt the run and department morale." },
      ],
    };
  }

  if (roll === 2) {
    return {
      type: "talent_breakthrough",
      runId: run.id,
      employeeId: employee.id,
      title: `${employee.name} Found A Breakthrough`,
      body: `${employee.name} thinks they found a real ${RESEARCH_SPECIALTY_LABELS[employee.specialty ?? "reasoning"].toLowerCase()} advance for ${run.name}. You can chase upside or fold it in carefully.`,
      choices: [
        { key: "push_breakthrough", label: "Push It Into The Run", effect: "Raise capability more, with a bit more execution risk." },
        { key: "bank_breakthrough", label: "Bank It Carefully", effect: "Smaller upside, lower downside, morale boost." },
      ],
    };
  }

  return {
    type: "talent_burnout",
    runId: run.id,
    employeeId: employee.id,
    title: `${employee.name} Is Burning Out`,
    body: `${employee.name} is showing visible burnout on ${run.name}. You can protect them, or squeeze for schedule at the risk of losing them.`,
    choices: [
      { key: "give_relief", label: "Give Relief Time", effect: "Protects the person, slows the run slightly." },
      { key: "push_through", label: "Push Through", effect: "Keeps tempo, but raises departure and failure risk." },
    ],
  };
}

function applyEventChoice(game: GameState, event: PendingEvent, choiceKey: string) {
  const run = event.runId !== null ? game.activeRuns.find((entry) => entry.id === event.runId) : null;
  const employee = event.employeeId ? getEmployeeById(game, event.employeeId) : null;
  if (!run && event.runId !== null) return;

  if (run && event.type === "loss_spike") {
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

  if (run && event.type === "data_glitch") {
    if (choiceKey === "clean") {
      game.cash -= 250000;
      addRunWeeks(run, WEEKS_PER_MONTH);
      run.riskModifier -= 0.05;
      game.trust = clamp(game.trust + 1, 10, 99);
      addNotification(game, `${run.name}: data cleanup added four weeks but protected the run.`, "warning");
    } else {
      run.capabilityModifier += 4;
      run.riskModifier += 0.07;
      run.trustModifier -= 12;
      game.trust = clamp(game.trust - 3, 10, 99);
      addNotification(game, `${run.name}: QA was skipped to preserve momentum.`, "bad");
    }
  }

  if (run && event.type === "burst_window") {
    if (choiceKey === "burst") {
      game.cash -= 350000;
      run.capabilityModifier += 3;
      addRunWeeks(run, -WEEKS_PER_MONTH);
      run.computeNeed += 4;
      addNotification(game, `${run.name}: burst capacity shaved time off the schedule.`, "good");
    } else {
      run.riskModifier += 0.03;
      addNotification(game, `${run.name}: the team stayed disciplined and kept burn under control.`, "info");
    }
  }

  if (run && employee && event.type === "talent_poach") {
    if (choiceKey === "retain") {
      const retentionCost = Math.round(employee.salary * 0.2);
      game.cash -= retentionCost;
      employee.loyalty = clamp(employee.loyalty + 16, 0, 100);
      employee.poachRisk = clamp(employee.poachRisk - 12, 0, 100);
      run.riskModifier -= 0.03;
      addNotification(game, `${employee.name} stayed after a ${money(retentionCost)} retention package.`, "good");
    } else {
      employee.active = false;
      employee.status = "departed";
      employee.assignedRunId = null;
      run.assignedResearcherIds = run.assignedResearcherIds.filter((id) => id !== employee.id);
      run.capabilityModifier -= employee.specialty === "reasoning" ? 6 : 4;
      run.riskModifier += 0.06;
      game.departments[employee.departmentId].morale = clamp(game.departments[employee.departmentId].morale - 6, 20, 95);
      addNotification(game, `${employee.name} left for a rival and ${run.name} lost momentum.`, "bad");
    }
  }

  if (run && employee && event.type === "talent_breakthrough") {
    employee.burnout = clamp(employee.burnout + 4, 0, 100);
    if (choiceKey === "push_breakthrough") {
      run.capabilityModifier += employee.specialty === "reasoning" ? 7 : 5;
      run.riskModifier += 0.04;
      addNotification(game, `${employee.name}'s breakthrough was pushed directly into ${run.name}.`, "good");
    } else {
      run.capabilityModifier += 3;
      run.trustModifier += 3;
      employee.loyalty = clamp(employee.loyalty + 6, 0, 100);
      addNotification(game, `${employee.name}'s breakthrough was incorporated carefully and the team stayed stable.`, "good");
    }
  }

  if (run && employee && event.type === "talent_burnout") {
    if (choiceKey === "give_relief") {
      employee.burnout = clamp(employee.burnout - 18, 0, 100);
      employee.loyalty = clamp(employee.loyalty + 5, 0, 100);
      addRunWeeks(run, Math.ceil(WEEKS_PER_MONTH / 2));
      addNotification(game, `${employee.name} got relief time. ${run.name} slowed slightly, but the team stabilized.`, "warning");
    } else {
      employee.burnout = clamp(employee.burnout + 14, 0, 100);
      employee.poachRisk = clamp(employee.poachRisk + 8, 0, 100);
      run.riskModifier += 0.05;
      addNotification(game, `${employee.name} was pushed harder and burnout risk climbed on ${run.name}.`, "bad");
    }
  }

  refreshDepartmentLeads(game);
}

export function settleGlobalMarket(game: GameState, servingPressure: number, cadence: "week" | "month" = "month") {
  settleGlobalMarketSystem(game, servingPressure, cadence);
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

function replenishHiringMarket(game: GameState, count = 6) {
  game.hiringMarket = createHiringCandidates(`${game.archetype}:week-${getCompatibleWeek(game)}:${game.nextId}`, count).map((candidate) => ({
    ...candidate,
    id: game.nextId++,
  }));
}

export function hire(game: GameState, role: RoleId, count: number = 1) {
  const next = copyGame(game);
  next.headcount[role] += count;
  addNotification(next, `Hired ${count} ${ROLE_LABELS[role]}. Monthly burn increased.`, "info");
  return next;
}

export function fire(game: GameState, role: RoleId, count: number = 1) {
  const next = copyGame(game);
  const actualCount = Math.min(next.headcount[role], Math.max(1, Math.round(count)));
  if (actualCount <= 0) return game;
  next.headcount[role] -= actualCount;
  const severance = Math.round(SALARIES[role] * actualCount * 1.5);
  next.cash -= severance;
  addNotification(next, `Laid off ${actualCount} ${ROLE_LABELS[role]} for ${money(severance)} in severance.`, "warning");
  return next;
}

export function hireCandidate(game: GameState, candidateId: number) {
  const next = copyGame(game);
  const candidateIndex = next.hiringMarket.findIndex((candidate) => candidate.id === candidateId);
  if (candidateIndex < 0) return game;
  const candidate = next.hiringMarket[candidateIndex];
  if (next.cash < candidate.signingCost) return game;
  next.cash -= candidate.signingCost;
  next.employees.push({
    ...candidate,
    active: true,
    status: "active",
    assignedRunId: null,
  });
  next.hiringMarket.splice(candidateIndex, 1);
  refreshDepartmentLeads(next);
  addNotification(next, `Hired ${candidate.name} (${candidate.title}) into ${DEPARTMENT_LABELS[candidate.departmentId]} for ${money(candidate.signingCost)} upfront.`, "good");
  return next;
}

export function fireEmployee(game: GameState, employeeId: number) {
  const next = copyGame(game);
  const employee = next.employees.find((entry) => entry.id === employeeId && entry.active);
  if (!employee) return game;
  const severance = Math.round(employee.salary * 0.25);
  next.cash -= severance;
  employee.active = false;
  employee.status = "departed";
  if (employee.assignedRunId) {
    const run = next.activeRuns.find((entry) => entry.id === employee.assignedRunId);
    if (run) {
      run.assignedResearcherIds = run.assignedResearcherIds.filter((id) => id !== employee.id);
      run.capabilityModifier -= 3;
      run.riskModifier += 0.04;
    }
  }
  employee.assignedRunId = null;
  next.trainingConfig.assignedResearcherIds = next.trainingConfig.assignedResearcherIds.filter((id) => id !== employeeId);
  refreshDepartmentLeads(next);
  addNotification(next, `Fired ${employee.name} (${employee.title}) with ${money(severance)} severance.`, "warning");
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

  next.employees.forEach((employee) => {
    if (employee.assignedRunId === runId) employee.assignedRunId = null;
  });
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
  next.trainingConfig.assignedResearcherIds = next.trainingConfig.assignedResearcherIds.filter((employeeId) => {
    const employee = next.employees.find((entry) => entry.id === employeeId);
    return Boolean(employee && employee.active && employee.departmentId === "research" && (employee.assignedRunId === null || employee.assignedRunId === next.pendingEvent?.runId));
  });
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
    product.traffic = createEmptyProductTraffic();
    product.serving = createEmptyProductServing();
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
      product.traffic = createEmptyProductTraffic();
      product.serving = createEmptyProductServing();
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
  product.lastLaunchMonth = getMonthIndexFromWeek(getCompatibleWeek(next));
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

export function updateProductServingStrategy(game: GameState, productKey: ProductTypeId, strategy: ProductState["servingStrategy"]) {
  const next = copyGame(game);
  next.products[productKey].servingStrategy = strategy;
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
    next.cloud.plannedDatacenters.push({
      id: datacenterId,
      name: `Datacenter ${datacenterId}`,
      pods: normalizedPods,
      buildCost,
      weekOrdered: getCompatibleWeek(next),
      weeksRemaining: DATACENTER_PROVISIONING_WEEKS,
      monthOrdered: getCompatibleMonthIndex(next),
      monthsRemaining: DATACENTER_PROVISIONING_MONTHS,
    });
    next.cloud.nextDatacenterId += 1;
  }
  addNotification(
    next,
    normalizedQuantity === 1
      ? `Ordered Datacenter ${next.cloud.nextDatacenterId - 1} with ${normalizedPods} pods for ${money(buildCost)}. Delivery in ${DATACENTER_PROVISIONING_WEEKS} weeks.`
      : `Ordered ${normalizedQuantity} datacenters with ${normalizedPods} pods each for ${money(totalBuildCost)}. Delivery in ${DATACENTER_PROVISIONING_WEEKS} weeks.`,
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
    .sort((left, right) => getModelBuiltWeek(left) - getModelBuiltWeek(right) || left.id - right.id);
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
  syncDirectiveWeeks(next, WEEKS_PER_QUARTER);
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
  next.funding.lastRaisedWeek = getCompatibleWeek(next);
  next.funding.lastRaisedTurn = getCompatibleMonthIndex(next);
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
        description: "Bundling and aggressive discounting make premium pricing harder for roughly one quarter.",
        weeksRemaining: WEEKS_PER_QUARTER,
        turnsRemaining: Math.ceil(WEEKS_PER_QUARTER / WEEKS_PER_MONTH),
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
        weeksRemaining: WEEKS_PER_QUARTER,
        turnsRemaining: Math.ceil(WEEKS_PER_QUARTER / WEEKS_PER_MONTH),
        intensity: 0.24,
      });
      addNotification(game, "Open-model rival released a cheap near-peer and the market noticed.", "warning");
    }

    rival.cooldown = nextRivalCooldown(rivalId);
  });

  return { boardPressureDelta, trustPenalty };
}

function advanceWeeklyTraining(next: GameState) {
  const archetype = getArchetype(next);
  const effects = getDirectiveEffects(next);
  const allocatedServing = (next.cloud.reservedPods * (100 - next.cloud.trainingPct)) / 100;
  const servingDemand = next.products.chatbot.computeDemand + next.products.api.computeDemand;
  const servingPressure =
    servingDemand > allocatedServing
      ? (servingDemand - allocatedServing) / Math.max(1, servingDemand)
      : 0;
  const trainingDemand = next.activeRuns.reduce((sum, run) => sum + run.computeNeed, 0);
  const allocatedTraining = (next.cloud.reservedPods * next.cloud.trainingPct) / 100;
  const trainingOverflow = Math.max(0, trainingDemand - allocatedTraining);
  const trainingPressure = trainingDemand > 0 ? trainingOverflow / trainingDemand : 0;
  const completedRuns = [] as GameState["models"];
  const failedRuns = [] as ActiveRun[];

  next.activeRuns.forEach(syncRunWeekFields);

  const developmentCost = next.activeRuns.reduce((sum, run) => {
    if (run.remainingDevelopmentCost <= 0) return sum;
    const weeksRemaining = Math.max(1, Math.ceil(run.totalWeeks - run.weeksElapsed));
    const installment = Math.min(run.remainingDevelopmentCost, Math.round(run.remainingDevelopmentCost / weeksRemaining));
    run.remainingDevelopmentCost -= installment;
    return sum + installment;
  }, 0);
  next.cash -= developmentCost;
  ensureOperatingCashflowState(next);
  next.currentMonthCashflow.developmentCost = (next.currentMonthCashflow.developmentCost ?? 0) + developmentCost;

  next.activeRuns.forEach((run) => {
    run.weeksElapsed = Math.min(run.totalWeeks, run.weeksElapsed + 1);
    run.monthsElapsed = Number((run.weeksElapsed / WEEKS_PER_MONTH).toFixed(2));
    run.lossCurve = generateLossCurve(run.totalWeeks, run.lossSeverity > 0 ? run.lossSeverity * 0.5 : 0);

    if (run.weeksElapsed < run.totalWeeks) return;

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
    const assignedResearchers = run.assignedResearcherIds
      .map((employeeId) => getEmployeeById(next, employeeId))
      .filter((employee): employee is EmployeeState => Boolean(employee && employee.active));
    const specialtyCapabilityBonus = assignedResearchers.reduce((sum, researcher) => {
      if (researcher.specialty === "reasoning" && goals.reasoning > 1) return sum + 4;
      if (researcher.specialty === "multimodal" && goals.multimodal > 1) return sum + 4;
      if (researcher.specialty === "agentic" && goals.agentic > 1) return sum + 3;
      if (researcher.specialty === "data") return sum + 2;
      return sum + 1;
    }, 0);
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
      specialtyCapabilityBonus +
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
          assignedResearchers.reduce((sum, researcher) => sum + (researcher.specialty === "safety" ? 2 : 0), 0) +
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
      weekBuilt: getCompatibleWeek(next),
      monthBuilt: getMonthIndexFromWeek(getCompatibleWeek(next)),
      sizeKey: run.sizeKey,
      dataTier: run.dataTier,
      subscribersByCohort: createEmptyCohortSubscriberMap(),
      cohortTenureWeeks: createEmptyCohortSubscriberMap(),
      reliability: { ...run.reliability },
    };
    next.models.unshift(model);
    next.modelPerformance[String(model.id)] = createDefaultModelPerformance();
    assignedResearchers.forEach((researcher) => {
      researcher.assignedRunId = null;
      researcher.loyalty = clamp(researcher.loyalty + 2, 0, 100);
      researcher.burnout = clamp(researcher.burnout + 4, 0, 100);
    });
    completedRuns.push(model);
  });

  next.activeRuns = next.activeRuns.filter((run) => run.weeksElapsed < run.totalWeeks && !failedRuns.includes(run));

  completedRuns.forEach((model) => {
    addNotification(
      next,
      `${model.name} shipped. Capability ${model.capability}, Inference ${model.inferenceCost}, Trust ${model.trust}, Context ${model.contextWindow}K.`,
      "good",
    );
  });

  failedRuns.forEach((run) => {
    run.assignedResearcherIds.forEach((employeeId) => {
      const employee = getEmployeeById(next, employeeId);
      if (employee) {
        employee.assignedRunId = null;
        employee.burnout = clamp(employee.burnout + 8, 0, 100);
      }
    });
    addNotification(next, `${run.name} failed during training. Burn was spent and no model shipped.`, "bad");
  });

  if (failedRuns.length > 0 || completedRuns.length > 0) {
    next.trust = clamp(
      next.trust - failedRuns.length * 6 + completedRuns.filter((model) => model.trust >= 70).length,
      10,
      99,
    );
    next.boardPressure = clamp(
      next.boardPressure +
        failedRuns.length * 5 -
        (completedRuns.some((model) => model.capability > next.marketStandard) ? 2 : 0),
      0,
      100,
    );
  }

  const talentRun = next.activeRuns.find((run) => run.assignedResearcherIds.length > 0);
  if (talentRun && !next.pendingEvent) {
    const assignedTalent = talentRun.assignedResearcherIds
      .map((employeeId) => getEmployeeById(next, employeeId))
      .filter((employee): employee is EmployeeState => Boolean(employee && employee.active));
    const volatileTalent = assignedTalent.find((employee) => employee.poachRisk + employee.burnout > 95);
    const breakthroughTalent = assignedTalent.find(
      (employee) => employee.breakthroughChance > 0 && Math.random() < employee.breakthroughChance / WEEKLY_TALENT_BREAKTHROUGH_DENOMINATOR,
    );
    const selectedTalent = volatileTalent ?? breakthroughTalent ?? null;
    if (selectedTalent && Math.random() < WEEKLY_TALENT_EVENT_FINAL_PROBABILITY) {
      next.pendingEvent = createTalentEvent(talentRun, selectedTalent);
      addNotification(next, `Talent alert: ${selectedTalent.name} has become a live issue on ${talentRun.name}.`, "warning");
    }
  }

  next.employees.forEach((employee) => {
    if (!employee.active) return;
    if (employee.assignedRunId !== null) {
      employee.burnout = clamp(employee.burnout + 0.6 + (employee.level === "lead" || employee.level === "director" ? 0.25 : 0), 0, 100);
    } else {
      employee.burnout = clamp(employee.burnout - 0.35, 0, 100);
    }
    employee.poachRisk = clamp(
      employee.poachRisk + (employee.skill > 78 ? 0.25 : 0) - (employee.loyalty > 72 ? 0.25 : 0),
      0,
      100,
    );
  });

  const eventRun = next.activeRuns.find(
    (run) => !run.eventTriggered && run.weeksElapsed >= Math.max(1, Math.floor(run.totalWeeks / 2) - 1),
  );

  if (!next.pendingEvent && eventRun && Math.random() < WEEKLY_TRAINING_EVENT_PROBABILITY) {
    eventRun.eventTriggered = true;
    next.pendingEvent = createRunEvent(eventRun);
    addNotification(next, `Training alert: ${eventRun.name} needs executive intervention.`, "warning");
  }

  return { developmentCost };
}

function advanceWeeklyTimers(next: GameState) {
  const datacenterCapacityAdded = resolvePlannedDatacenters(next);
  const rivalImpact = processRivals(next);
  updateCompetitorCompanies(next);

  if (rivalImpact.trustPenalty !== 0) {
    next.trust = clamp(next.trust - rivalImpact.trustPenalty, 10, 99);
  }
  if (rivalImpact.boardPressureDelta !== 0) {
    next.boardPressure = clamp(next.boardPressure + rivalImpact.boardPressureDelta, 0, 100);
  }

  next.marketModifiers = next.marketModifiers
    .map((modifier) => {
      const weeksRemaining = getMarketModifierWeeksRemaining(modifier) - 1;
      return {
        ...modifier,
        weeksRemaining,
        turnsRemaining: Math.ceil(Math.max(0, weeksRemaining) / WEEKS_PER_MONTH),
      };
    })
    .filter((modifier) => getMarketModifierWeeksRemaining(modifier) > 0);

  if (next.currentDirective) {
    const directiveWeeksRemaining = getDirectiveWeeksRemaining(next) - 1;
    syncDirectiveWeeks(next, directiveWeeksRemaining);
    if (directiveWeeksRemaining <= 0) {
      addNotification(next, `Board directive expired: ${BOARD_DIRECTIVES[next.currentDirective].name}.`, "info");
      next.currentDirective = null;
      syncDirectiveWeeks(next, 0);
    }
  } else {
    syncDirectiveWeeks(next, 0);
  }

  return { datacenterCapacityAdded };
}

function settleWeeklyProductMarket(next: GameState) {
  ensureProductReportingState(next);

  const allocatedServing = (next.cloud.reservedPods * (100 - next.cloud.trainingPct)) / 100;
  const provisionalServingDemand = next.products.chatbot.computeDemand + next.products.api.computeDemand;
  const servingPressure =
    provisionalServingDemand > allocatedServing
      ? (provisionalServingDemand - allocatedServing) / Math.max(1, provisionalServingDemand)
      : 0;

  settleGlobalMarket(next, servingPressure, "week");

  const products = (["chatbot", "api"] as ProductTypeId[]).reduce(
    (snapshots, type) => {
      const product = next.products[type];
      const churnedUsers =
        product.churn < 0.999
          ? Math.max(0, product.activeUsers / Math.max(0.001, 1 - product.churn) - product.activeUsers)
          : 0;
      snapshots[type] = {
        revenue: Math.round(product.revenue),
        users: product.activeUsers,
        acquisition: product.acquisition,
        churnedUsers: Math.round(churnedUsers),
        churn: product.churn,
        tokenUsageMillions: Number(product.tokenUsageMillions.toFixed(2)),
        computeDemand: Number(product.computeDemand.toFixed(2)),
        computeCost: Math.round(product.computeCost),
      };
      return snapshots;
    },
    {} as Record<ProductTypeId, ProductPeriodSnapshot>,
  );

  next.lastWeek = summarizeProductSnapshot(products);
  updateModelPerformance(next, next.lastWeek.products);

  const monthToDateProducts = (["chatbot", "api"] as ProductTypeId[]).reduce(
    (snapshots, type) => {
      snapshots[type] = addProductPeriodSnapshot(next.currentMonthToDate.products[type] ?? createEmptyProductPeriodSnapshot(), products[type]);
      return snapshots;
    },
    {} as Record<ProductTypeId, ProductPeriodSnapshot>,
  );
  next.currentMonthToDate = summarizeProductSnapshot(monthToDateProducts);
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
  ensureProductReportingState(next);
  ensureOperatingCashflowState(next);

  const archetype = getArchetype(next);
  const effects = getDirectiveEffects(next);
  refreshDepartmentLeads(next);
  if (
    next.currentMonthCashflow.payroll === 0 &&
    next.currentMonthCashflow.marketingSpend === 0 &&
    next.currentMonthCashflow.baseOpsCost === 0 &&
    next.currentMonthCashflow.loanPayments === 0 &&
    next.currentMonthCashflow.computeReservedCost === 0 &&
    next.currentMonthCashflow.cloudRentalRevenue === 0 &&
    (next.currentMonthCashflow.developmentCost ?? 0) === 0
  ) {
    const loanPayments = next.loans.reduce((sum, loan) => sum + Math.round(loan.monthlyPayment), 0);
    next.currentMonthCashflow = {
      payroll: getPayroll(next),
      marketingSpend: Math.round(next.marketingBudgetMillions * 1000000),
      baseOpsCost: BASE_OPS_COST,
      loanPayments,
      computeReservedCost: Math.round(next.cloud.reservedPods * getReservedCostPerPod(next) * effects.reservedCostMultiplier),
      cloudRentalRevenue: 0,
      cloudRentalPodsRented: 0,
      developmentCost: 0,
    };
    next.cash -= next.currentMonthCashflow.payroll + next.currentMonthCashflow.marketingSpend + next.currentMonthCashflow.baseOpsCost + next.currentMonthCashflow.loanPayments + next.currentMonthCashflow.computeReservedCost;
    next.loans = next.loans.filter((loan) => {
      loan.elapsed += 1;
      loan.elapsedWeeks = (loan.elapsedWeeks ?? (loan.elapsed - 1) * WEEKS_PER_MONTH) + WEEKS_PER_MONTH;
      loan.termWeeks = getLoanTermWeeks(loan);
      loan.weeklyPayment = loan.weeklyPayment ?? loan.monthlyPayment / WEEKS_PER_MONTH;
      return loan.elapsed < loan.term;
    });
  }

  const rivalImpact = { boardPressureDelta: 0, trustPenalty: 0 };
  const datacenterCapacityAdded = 0;

  let provisionalServingDemand = next.products.chatbot.computeDemand + next.products.api.computeDemand;

  const allocatedServing = (next.cloud.reservedPods * (100 - next.cloud.trainingPct)) / 100;
  const servingPressure =
    provisionalServingDemand > allocatedServing
      ? (provisionalServingDemand - allocatedServing) / Math.max(1, provisionalServingDemand)
      : 0;

  const productMonthToDate = next.currentMonthToDate;
  let totalRevenue = productMonthToDate.revenue;
  let servingDemand = next.products.chatbot.computeDemand + next.products.api.computeDemand;
  let totalUsers = next.products.chatbot.activeUsers + next.products.api.activeUsers;

  updateModelPerformance(next, productMonthToDate.products, { rollupMonth: true });

  const trainingDemand = next.activeRuns.reduce((sum, run) => sum + run.computeNeed, 0);
  const allocatedTraining = (next.cloud.reservedPods * next.cloud.trainingPct) / 100;
  const trainingOverflow = Math.max(0, trainingDemand - allocatedTraining);
  const burstCloudCapacity = getBurstCloudCapacity(next, allocatedServing);
  const servingShortfall = Math.max(0, servingDemand - allocatedServing);
  const burstCloudPodsUsed = Math.min(servingShortfall, burstCloudCapacity);
  const servingOverflow = Math.max(0, servingShortfall - burstCloudPodsUsed);
  const burstCloudCost = Math.round(burstCloudPodsUsed * BURST_CLOUD_COST_PER_POD);

  const computeDemandTotal = Math.max(0.0001, next.products.chatbot.computeDemand + next.products.api.computeDemand);
  (["chatbot", "api"] as ProductTypeId[]).forEach((type) => {
    const product = next.products[type];
    const demandShare = product.computeDemand / computeDemandTotal;
    const productBurstPods = Number((burstCloudPodsUsed * demandShare).toFixed(2));
    const productOverflowPods = Number((servingOverflow * demandShare).toFixed(2));
    const productBurstCost = Math.round(burstCloudCost * demandShare);
    const capacityPressure = Number(
      clamp(
        (product.computeDemand - allocatedServing * demandShare) / Math.max(1, product.computeDemand),
        0,
        1.5,
      ).toFixed(3),
    );

    product.serving = {
      ...product.serving,
      burstPodsUsed: productBurstPods,
      burstCost: productBurstCost,
      overflowPods: productOverflowPods,
      capacityPressure,
    };
    product.computeCost = Math.round(product.computeCost + productBurstCost);
  });

  const overflowTotal = trainingOverflow + servingOverflow;
  const overflowCost = Math.round(
    (trainingOverflow * 100000 + servingOverflow * 250000) * effects.overflowCostMultiplier,
  );
  const reservedCost = next.currentMonthCashflow.computeReservedCost;
  const payrollCost = next.currentMonthCashflow.payroll;
  const marketingSpend = next.currentMonthCashflow.marketingSpend;
  const baseOpsCost = next.currentMonthCashflow.baseOpsCost;
  const loanPayments = next.currentMonthCashflow.loanPayments;
  totalRevenue += next.currentMonthCashflow.cloudRentalRevenue;
  const hiringSpend = 0;
  const severanceCost = 0;
  const developmentCost = next.currentMonthCashflow.developmentCost ?? 0;

  const expenses = reservedCost + burstCloudCost + overflowCost + payrollCost + marketingSpend + baseOpsCost + developmentCost + loanPayments;
  const profit = Math.round(totalRevenue - expenses);
  next.cash += Math.round(productMonthToDate.revenue - burstCloudCost - overflowCost);

  const completedRuns = [] as GameState["models"];
  const failedRuns = [] as ActiveRun[];

  let trustDelta = 0;
  const liveProducts = Object.values(next.products).filter((product) => product.modelIds.length > 0).length;

  if (liveProducts > 0 && overflowTotal === 0) trustDelta += 2;
  else if (liveProducts > 0) trustDelta += 1;

  if (next.currentDirective === "enterprise_trust") trustDelta += 1;
  if (next.currentDirective === "growth" && overflowTotal > 0) trustDelta -= 2;
  if (overflowTotal > 0) trustDelta -= Math.min(7, Math.ceil(overflowTotal / 4));
  if (burstCloudPodsUsed > 0) trustDelta -= Math.min(3, Math.ceil(burstCloudPodsUsed / 20));
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
  if (burstCloudCost > 0) boardPressureDelta += Math.min(5, Math.ceil(burstCloudCost / 300000));

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
    baseOpsCost,
    loanPayments,
    computeReservedCost: reservedCost,
    burstCloudCost,
    overflowCost,
    servingDemand: Number(servingDemand.toFixed(2)),
    trainingDemand: Number(trainingDemand.toFixed(2)),
    burstCloudPodsUsed: Number(burstCloudPodsUsed.toFixed(2)),
    datacenterCapacityAdded,
    datacenterCapacityPending: next.cloud.plannedDatacenters.reduce((sum, datacenter) => sum + datacenter.pods, 0),
    trustDelta,
    distributionDelta: { consumer: consumerDelta, enterprise: enterpriseDelta },
    cloudRentalRevenue: next.currentMonthCashflow.cloudRentalRevenue,
    cloudRentalPodsRented: Math.round(next.currentMonthCashflow.cloudRentalPodsRented / WEEKS_PER_MONTH),
    developmentCost,
    hiringSpend,
    severanceCost,
    products: productMonthToDate.products,
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
  next.currentMonthToDate = createEmptyProductReportingSnapshot();
  next.currentMonthCashflow = createEmptyOperatingCashflowSnapshot();

  const settledWeek = getCompatibleWeek(next);
  const settledMonthIndex = getMonthIndexFromWeek(settledWeek);

  // Yearly Cohort Scaling
  if (settledMonthIndex > 0 && settledMonthIndex % 12 === 0) {
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

  if (settledMonthIndex === 1 || next.hiringMarket.length < 3 || settledMonthIndex % 4 === 0) {
    replenishHiringMarket(next);
  }

  next.competitorLaunchShock = Number((next.competitorLaunchShock * 0.55).toFixed(4));
  next.turn = settledMonthIndex + 1;

  const lastRaisedWeek = next.funding.lastRaisedWeek ?? (next.funding.lastRaisedTurn && next.funding.lastRaisedTurn > 0 ? legacyMonthToWeek(next.funding.lastRaisedTurn) : 0);
  if (settledWeek - lastRaisedWeek >= 12 * WEEKS_PER_MONTH && !next.funding.available) {
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

  if (next.status === "playing" && settledMonthIndex % 3 === 0) {
    next.pendingBoardReview = createPendingBoardReview(next);
    addNotification(next, `Quarter ${next.pendingBoardReview.quarter} board memo updated. Review it in Strategy when needed.`, "info");
  }

  return next;
}

export function advanceWeek(game: GameState) {
  if (game.status !== "playing" || game.pendingEvent) {
    return game;
  }

  const currentWeek = getCompatibleWeek(game);

  if (isMonthEndWeek(currentWeek)) {
    const monthEndInput = {
      ...copyGame(game),
      week: currentWeek,
    };
    settleWeeklyProductMarket(monthEndInput);
    settleWeeklyOperatingCashflow(monthEndInput, currentWeek);
    const monthEndNext = advanceMonth(monthEndInput);

    if (monthEndNext === monthEndInput || monthEndNext.turn === monthEndInput.turn) {
      return {
        ...monthEndNext,
        week: currentWeek,
      };
    }

    const timerResult = advanceWeeklyTimers(monthEndNext);
    const trainingResult = advanceWeeklyTraining(monthEndNext);
    monthEndNext.lastMonth.datacenterCapacityAdded += timerResult.datacenterCapacityAdded;
    if (trainingResult.developmentCost > 0) {
      monthEndNext.lastMonth.developmentCost = (monthEndNext.lastMonth.developmentCost ?? 0) + trainingResult.developmentCost;
      monthEndNext.lastMonth.expenses += trainingResult.developmentCost;
      monthEndNext.lastMonth.profit -= trainingResult.developmentCost;
      const lastProfitIndex = monthEndNext.history.profit.length - 1;
      if (lastProfitIndex >= 0) {
        monthEndNext.history.profit[lastProfitIndex] = monthEndNext.lastMonth.profit;
      }
    }

    const lastTrustIndex = monthEndNext.history.trust.length - 1;
    if (lastTrustIndex >= 0) {
      monthEndNext.history.trust[lastTrustIndex] = monthEndNext.trust;
    }
    const lastBoardIndex = monthEndNext.history.boardPressure.length - 1;
    if (lastBoardIndex >= 0) {
      monthEndNext.history.boardPressure[lastBoardIndex] = monthEndNext.boardPressure;
    }

    return {
      ...monthEndNext,
      week: currentWeek + 1,
    };
  }

  const weeklyNext = copyGame(game);
  weeklyNext.week = currentWeek;
  settleWeeklyProductMarket(weeklyNext);
  settleWeeklyOperatingCashflow(weeklyNext, currentWeek);
  advanceWeeklyTimers(weeklyNext);
  advanceWeeklyTraining(weeklyNext);

  return {
    ...weeklyNext,
    week: currentWeek + 1,
  };
}

export function takeLoan(game: GameState, principal: number, term: number): GameState {
  const next = copyGame(game);
  const terms = getLoanTerms(principal, term);

  const newLoan: GameState["loans"][number] = {
    id: `loan-${Date.now()}`,
    principal,
    term,
    elapsed: 0,
    termWeeks: terms.termWeeks,
    elapsedWeeks: 0,
    interestFeePct: terms.feePct,
    monthlyPayment: terms.monthlyPayment,
    weeklyPayment: terms.weeklyPayment,
  };

  next.loans.push(newLoan);
  next.cash += principal;

  addNotification(next, `Secured capital loan of ${money(principal)} over ${term} months.`, "info");

  return next;
}
