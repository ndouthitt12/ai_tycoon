import { useState } from "react";

import { ARCHETYPES, BOARD_DIRECTIVES } from "./game/defs";
import {
  addAdminCapital,
  addCompetitorCapital,
  advanceWeek,
  attachModelToProduct,
  buildDatacenter,
  buyData,
  buyUpgrade,
  bumpTrainingVersionName,
  calculateRunPreview,
  chooseBoardDirective,
  copyGame,
  createInitialGame,
  getHeadcountTotal,
  getPayroll,
  getProjectedServingDemand,
  getRunwayMonths,
  isMonthEndWeek,
  money,
  monthLabelFromWeek,
  raiseFunding,
  resolvePendingEvent,
  shutdownRun,
  sellDatacenters,
  trainEngineers,
  updateCompetitorAdmin,
  updateMarketingBudget,
  updateMonthlyUserMultiplier,
  updateCohortDef,
  updateGoalEconomics,
  updateProductPrice,
  updateProductServingStrategy,
  updateSubscriptionPlan,
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  fire,
  fireEmployee,
  updateCloudRentalPrice,
  updateTrainingAllocation,
  updateTrainingConfig,
  hire,
  hireCandidate,
  launchRun,
  takeLoan,
  WEEKS_PER_MONTH,
} from "./game/sim";
import * as simApi from "./game/sim";
import { startPostTraining } from "./game/systems/postTraining";
import * as modelSystems from "./game/systems/models";
import { AppState, ArchetypeId, BoardDirectiveId, DataTierId, PostTrainingConfig, RoleId, ScreenId, UpgradeId, SubscriptionPlan } from "./game/types";
import { AppShell, Badge, Button, KpiCard, NavTab } from "./components/ui";
import { AdminScreen } from "./screens/AdminScreen";
import { ArchetypeSelection } from "./screens/ArchetypeSelection";
import { ComputeScreen } from "./screens/ComputeScreen";
import { LabScreen } from "./screens/LabScreen";
import { MarketScreen } from "./screens/MarketScreen";
import { OverviewScreen } from "./screens/OverviewScreen";
import { StrategyScreen } from "./screens/StrategyScreen";
import { BankScreen } from "./screens/BankScreen";

const INITIAL_STATE: AppState = {
  screen: "overview",
  game: null,
};

function readNumberField(source: unknown, ...keys: string[]) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function readRecordField(source: unknown, ...keys: string[]) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

function readOperatingCashflowTotal(source: unknown) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const direct = readNumberField(record, "netCashflow", "cashflow", "profit");
  if (direct !== null) return direct;

  const cloudRentalRevenue = readNumberField(record, "cloudRentalRevenue") ?? 0;
  const payroll = readNumberField(record, "payroll") ?? 0;
  const marketingSpend = readNumberField(record, "marketingSpend") ?? 0;
  const baseOpsCost = readNumberField(record, "baseOpsCost") ?? 0;
  const loanPayments = readNumberField(record, "loanPayments") ?? 0;
  const computeReservedCost = readNumberField(record, "computeReservedCost") ?? 0;
  const developmentCost = readNumberField(record, "developmentCost") ?? 0;
  const maintenanceCost = readNumberField(record, "maintenanceCost") ?? 0;

  return cloudRentalRevenue - payroll - marketingSpend - baseOpsCost - loanPayments - computeReservedCost - developmentCost - maintenanceCost;
}

export default function AICompanyTycoonStep2() {
  const [app, setApp] = useState<AppState>(INITIAL_STATE);
  const game = app.game;

  const preview = game ? calculateRunPreview(game) : null;
  const projectedServingDemand = game ? getProjectedServingDemand(game) : 0;

  const headcountTotal = game ? getHeadcountTotal(game) : 0;
  const payroll = game ? getPayroll(game) : 0;
  const runwayMonths = game ? getRunwayMonths(game) : 0;
  const arr = game ? (game.lastMonth.revenue || 0) * 12 : 0;
  const lastWeekRevenue = game ? (readNumberField(game, "lastWeekRevenue", "weeklyRevenue") ?? readNumberField(game.lastWeek, "revenue") ?? 0) : 0;
  const lastWeekComputeCost = game ? (readNumberField(game, "lastWeekComputeCost", "weeklyComputeCost") ?? readNumberField(game.lastWeek, "computeCost") ?? 0) : 0;
  const lastWeekProfit = game ? (readNumberField(game, "lastWeekProfit", "weeklyProfit") ?? readNumberField(game.lastWeek, "profit") ?? Math.round(lastWeekRevenue - lastWeekComputeCost)) : 0;
  const lastWeekCashflowRecord = game ? readRecordField(game, "lastWeekCashflow", "weeklyCashflow") : null;
  const lastWeekCashflow = game
    ? readNumberField(game, "lastWeekCashflow", "weeklyCashflow")
      ?? readOperatingCashflowTotal(lastWeekCashflowRecord)
    : null;
  const currentMonthCashflow = game
    ? game.currentMonthCashflow.cloudRentalRevenue
      - game.currentMonthCashflow.payroll
      - game.currentMonthCashflow.marketingSpend
      - game.currentMonthCashflow.baseOpsCost
      - game.currentMonthCashflow.loanPayments
      - game.currentMonthCashflow.computeReservedCost
      - (game.currentMonthCashflow.developmentCost ?? 0)
      - (game.currentMonthCashflow.maintenanceCost ?? 0)
    : 0;

  function selectArchetype(archetypeId: ArchetypeId) {
    setApp({
      screen: "overview",
      game: createInitialGame(archetypeId),
    });
  }

  function setScreen(screen: ScreenId) {
    setApp((prev) => ({ ...prev, screen }));
  }

  function updateGame(transform: (current: NonNullable<AppState["game"]>) => NonNullable<AppState["game"]>) {
    setApp((prev) => {
      if (!prev.game) return prev;
      return {
        ...prev,
        game: transform(prev.game),
      };
    });
  }

  function restartToSelection() {
    setApp({
      screen: "overview",
      game: null,
    });
  }

  function handleStartPostTraining(modelId: number, config: PostTrainingConfig) {
    updateGame((current) => {
      const next = copyGame(current);
      startPostTraining(next, modelId, config);
      return next;
    });
  }

  function handleDeprecateModel(modelId: number) {
    updateGame((current) => {
      const next = copyGame(current);
      const deprecateModel =
        (modelSystems as unknown as { deprecateModel?: (game: typeof next, modelId: number) => void }).deprecateModel ??
        (simApi as unknown as { deprecateModel?: (game: typeof next, modelId: number) => void }).deprecateModel;

      if (deprecateModel) {
        deprecateModel(next, modelId);
        return next;
      }

      const model = next.models.find((entry) => entry.id === modelId) as (typeof next.models[number] & {
        deprecated?: boolean;
        deprecationStartWeek?: number | null;
      }) | undefined;
      if (!model || model.deprecated) return next;

      model.deprecated = true;
      model.deprecationStartWeek = next.week;
      next.notifications.unshift({
        id: next.nextId++,
        text: `${model.name} marked for deprecation. Users will migrate as lifecycle support lands.`,
        tone: "warning",
      });
      next.notifications = next.notifications.slice(0, 12);
      return next;
    });
  }

  if (!game || !preview) {
    return (
      <AppShell>
        <ArchetypeSelection onSelect={selectArchetype} />
      </AppShell>
    );
  }

  const archetype = ARCHETYPES[game.archetype];
  const currentDirective = game.currentDirective ? BOARD_DIRECTIVES[game.currentDirective] : null;
  const advanceDisabled = Boolean(game.pendingEvent) || game.status !== "playing";
  const currentWeek = typeof game.week === "number" && Number.isFinite(game.week) ? game.week : (game.turn - 1) * WEEKS_PER_MONTH + 1;
  const weeksUntilMonthEnd = WEEKS_PER_MONTH - (currentWeek % WEEKS_PER_MONTH);
  const currentMonth = monthLabelFromWeek(currentWeek);
  const monthEndTiming = isMonthEndWeek(currentWeek)
    ? "Month-end settlement this week"
    : `Month-end in ${weeksUntilMonthEnd} week${weeksUntilMonthEnd === 1 ? "" : "s"}`;
  const cadenceSummary = isMonthEndWeek(currentWeek)
    ? "Advance Week settles weekly cash, products, training, and builds, then closes the monthly report."
    : "Advance Week settles weekly cash, products, training, and builds; monthly reports close at month-end.";

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 md:px-6">
        {/* Spreadsheet header */}
        <div className="sticky top-0 z-30 -mx-4 border-b border-[#21262d] bg-[#0d1117]/96 backdrop-blur-sm md:-mx-6">

          {/* Brand & context strip */}
          <div className="flex items-center justify-between gap-4 border-b border-[#161b22] px-4 py-2 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] text-[#58a6ff]">AI Tycoon</span>
              <span className="shrink-0 text-[#30363d]">│</span>
              <span className="truncate text-sm font-semibold text-[#c9d1d9]">{archetype.name}</span>
              <div className="hidden items-center gap-2 sm:flex">
                <Badge tone={currentDirective ? "good" : "default"}>
                  {currentDirective ? currentDirective.name : "No directive"}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <div className="font-mono text-sm text-[#8b949e]">Week {currentWeek} / {currentMonth}</div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#58a6ff]">{monthEndTiming}</div>
              </div>
              <Button onClick={() => updateGame(advanceWeek)} disabled={advanceDisabled}>
                Advance Week
              </Button>
            </div>
          </div>

          {/* KPI row — spreadsheet frozen header cells */}
          <div className="grid grid-cols-3 border-b border-[#21262d] lg:grid-cols-6">
            <KpiCard label="Cash" value={money(game.cash)} tone={game.cash > 12000000 ? "good" : game.cash > 5000000 ? "warning" : "bad"} />
            <KpiCard label="ARR" value={money(arr)} tone={arr >= 10000000 ? "good" : "default"} />
            <KpiCard
              label="Last Week Gross Profit"
              value={money(lastWeekProfit)}
              subvalue={lastWeekCashflow !== null ? `Cashflow ${money(lastWeekCashflow)}` : `MTD cashflow ${money(currentMonthCashflow)}`}
              tone={lastWeekProfit > 0 ? "good" : lastWeekProfit < -500000 ? "bad" : "warning"}
            />
            <KpiCard label="Runway" value={runwayMonths === Infinity ? "∞" : `${runwayMonths.toFixed(1)} mo`} subvalue={`Payroll/mo ${money(payroll)}`} tone={runwayMonths === Infinity ? "good" : runwayMonths > 10 ? "warning" : "bad"} />
            <KpiCard label="Trust" value={game.trust.toFixed(1)} subvalue={`Board ${game.boardPressure.toFixed(1)}`} tone={game.trust >= 60 ? "good" : game.trust >= 45 ? "warning" : "bad"} />
            <KpiCard label="Headcount" value={headcountTotal} subvalue={`Std ${game.marketStandard}`} tone="default" />
          </div>

          <div className="border-b border-[#21262d] px-4 py-2 text-xs text-[#8b949e] md:px-6">
            {cadenceSummary}
          </div>

          {/* Sheet tab navigation */}
          <div className="flex overflow-x-auto px-4 md:px-6">
            {(["overview", "strategy", "lab", "compute", "market", "bank", "admin"] as ScreenId[]).map((screen) => (
              <NavTab key={screen} active={app.screen === screen} onClick={() => setScreen(screen)}>
                {screen === "overview"
                  ? "Overview"
                  : screen === "strategy"
                    ? "Strategy"
                    : screen === "lab"
                    ? "Lab"
                    : screen === "compute"
                    ? "Cloud"
                    : screen === "market"
                      ? "Market"
                      : screen === "bank"
                        ? "Bank"
                        : "Admin"}
              </NavTab>
            ))}
          </div>
        </div>

        <div className="py-5">
          {app.screen === "overview" ? (
            <OverviewScreen
              game={game}
              arr={arr}
              onAttachModel={(productKey, modelId) => updateGame((current) => attachModelToProduct(current, productKey, modelId))}
              onUpdateProductPrice={(productKey, value, modelId) =>
                updateGame((current) => updateProductPrice(current, productKey, value, modelId))
              }
              onUpdateProductServingStrategy={(productKey, strategy) =>
                updateGame((current) => updateProductServingStrategy(current, productKey, strategy))
              }
              onUpdateSubscriptionPlan={(planId, patch) => updateGame((current) => updateSubscriptionPlan(current, planId, patch))}
              onCreateSubscriptionPlan={() => updateGame(createSubscriptionPlan)}
              onDeleteSubscriptionPlan={(planId) => updateGame((current) => deleteSubscriptionPlan(current, planId))}
              onRaiseFunding={() => updateGame(raiseFunding)}
              onRestart={restartToSelection}
            />
          ) : null}

          {app.screen === "strategy" ? (
            <StrategyScreen
              game={game}
              onUpdateMarketingBudget={(value) => updateGame((current) => updateMarketingBudget(current, value))}
              onChooseBoardDirective={(directiveId) => updateGame((current) => chooseBoardDirective(current, directiveId))}
              onHireCandidate={(candidateId) => updateGame((current) => hireCandidate(current, candidateId))}
              onFireEmployee={(employeeId) => updateGame((current) => fireEmployee(current, employeeId))}
            />
          ) : null}

          {app.screen === "lab" ? (
            <LabScreen
              game={game}
              preview={preview}
              onHire={(role: RoleId, count: number) => updateGame((current) => hire(current, role, count))}
              onFire={(role: RoleId, count: number) => updateGame((current) => fire(current, role, count))}
              onHireCandidate={(candidateId) => updateGame((current) => hireCandidate(current, candidateId))}
              onFireEmployee={(employeeId) => updateGame((current) => fireEmployee(current, employeeId))}
              onTrainEngineers={() => updateGame(trainEngineers)}
              onBuyData={(tier, pack) => updateGame((current) => buyData(current, tier, pack))}
              onBuyUpgrade={(key: UpgradeId) => updateGame((current) => buyUpgrade(current, key))}
              onUpdateTrainingConfig={(patch) => updateGame((current) => updateTrainingConfig(current, patch))}
              onBumpVersion={() => updateGame(bumpTrainingVersionName)}
              onLaunchRun={() => updateGame(launchRun)}
              onStartPostTraining={handleStartPostTraining}
              onDeprecateModel={handleDeprecateModel}
            />
          ) : null}

          {app.screen === "compute" ? (
            <ComputeScreen
              game={game}
              projectedServingDemand={projectedServingDemand}
              onBuildDatacenter={(pods, quantity) => updateGame((current) => buildDatacenter(current, pods, quantity))}
              onSellDatacenters={(pods, quantity, pricePerDatacenter) =>
                updateGame((current) => sellDatacenters(current, pods, quantity, pricePerDatacenter))
              }
              onUpdateTrainingAllocation={(value) => updateGame((current) => updateTrainingAllocation(current, value))}
              onUpdateCloudRentalPrice={(price) => updateGame((current) => updateCloudRentalPrice(current, price))}
              onShutdownRun={(runId) => updateGame((current) => shutdownRun(current, runId))}
            />
          ) : null}

          {app.screen === "market" ? <MarketScreen game={game} /> : null}

          {app.screen === "bank" ? (
            <BankScreen game={game} onTakeLoan={(principal, term) => updateGame((g) => takeLoan(g, principal, term))} />
          ) : null}

          {app.screen === "admin" ? (
            <AdminScreen
              game={game}
              onAddCapital={(millions) => updateGame((current) => addAdminCapital(current, millions))}
              onAddCompetitorCapital={(competitorId, millions) =>
                updateGame((current) => addCompetitorCapital(current, competitorId, millions))
              }
              onUpdateCompetitorAdmin={(competitorId, patch) =>
                updateGame((current) => updateCompetitorAdmin(current, competitorId, patch))
              }
              onUpdateGoalEconomics={(goalId, field, value) =>
                updateGame((current) => updateGoalEconomics(current, goalId, { [field]: value }))
              }
              onUpdateCohortDef={(cohortId, patch) =>
                updateGame((current) => updateCohortDef(current, cohortId, patch))
              }
              onUpdateMonthlyUserMultiplier={(value) =>
                updateGame((current) => updateMonthlyUserMultiplier(current, value))
              }
            />
          ) : null}
        </div>
      </div>

      {game.pendingEvent ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0d1117]/85 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-md border border-[#d29922]/30 bg-[#161b22] shadow-2xl shadow-black/60">
            <div className="border-b border-[#30363d] bg-[#1f1a0d] px-5 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d29922]">Training Event</span>
            </div>
            <div className="p-5">
              <div className="text-xl font-semibold text-[#e6edf3]">{game.pendingEvent.title}</div>
              <div className="mt-2 text-sm leading-6 text-[#8b949e]">{game.pendingEvent.body}</div>
              <div className="mt-5 grid gap-2">
                {game.pendingEvent.choices.map((choice) => (
                  <button
                    key={choice.key}
                    onClick={() => updateGame((current) => resolvePendingEvent(current, choice.key))}
                    className="rounded border border-[#30363d] bg-[#0d1117] p-4 text-left transition-colors hover:border-[#58a6ff]/40 hover:bg-[#161b22]"
                  >
                    <div className="text-sm font-semibold text-[#e6edf3]">{choice.label}</div>
                    <div className="mt-0.5 text-xs text-[#8b949e]">{choice.effect}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {game.status !== "playing" ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0d1117]/90 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-md border border-[#f85149]/30 bg-[#161b22] shadow-2xl shadow-black/60">
            <div className="border-b border-[#30363d] bg-[#220d0d] px-5 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f85149]">Company Failed</span>
            </div>
            <div className="p-5 text-center">
              <div className="text-2xl font-semibold text-[#e6edf3]">The Company Lost Control</div>
              <div className="mt-2 text-sm text-[#8b949e]">
                Cash, trust, or market pressure broke the company before the economics stabilized.
              </div>
              <div className="mt-5 grid grid-cols-2 border border-[#21262d]">
                <KpiCard label="Final ARR" value={money(game.lastMonth.revenue * 12)} />
                <KpiCard label="Final Cash" value={money(game.cash)} tone={game.cash > 0 ? "good" : "bad"} />
              </div>
              <div className="mt-5 flex justify-center">
                <Button onClick={restartToSelection}>Return to Archetypes</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
