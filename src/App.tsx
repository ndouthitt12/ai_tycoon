import { useMemo, useState } from "react";

import { ARCHETYPES, BOARD_DIRECTIVES } from "./game/defs";
import {
  addAdminCapital,
  addCompetitorCapital,
  advanceMonth,
  attachModelToProduct,
  buildDatacenter,
  buyData,
  buyUpgrade,
  bumpTrainingVersionName,
  calculateRunPreview,
  chooseBoardDirective,
  createInitialGame,
  getHeadcountTotal,
  getPayroll,
  getProjectedServingDemand,
  getRunwayMonths,
  money,
  monthLabel,
  raiseFunding,
  resolvePendingEvent,
  shutdownRun,
  trainEngineers,
  updateCompetitorAdmin,
  updateMarketingBudget,
  updateMonthlyUserMultiplier,
  updateCohortDef,
  updateGoalEconomics,
  updateProductPrice,
  updateTrainingAllocation,
  updateTrainingConfig,
  hire,
  launchRun,
  takeLoan,
} from "./game/sim";
import { AppState, ArchetypeId, BoardDirectiveId, DataTierId, RoleId, ScreenId, UpgradeId } from "./game/types";
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

export default function AICompanyTycoonStep2() {
  const [app, setApp] = useState<AppState>(INITIAL_STATE);
  const game = app.game;

  const preview = useMemo(() => (game ? calculateRunPreview(game) : null), [game]);
  const projectedServingDemand = useMemo(() => (game ? getProjectedServingDemand(game) : 0), [game]);

  const headcountTotal = game ? getHeadcountTotal(game) : 0;
  const payroll = game ? getPayroll(game) : 0;
  const runwayMonths = game ? getRunwayMonths(game) : 0;
  const arr = game ? game.lastMonth.revenue * 12 : 0;

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

  if (!game || !preview) {
    return (
      <AppShell>
        <ArchetypeSelection onSelect={selectArchetype} />
      </AppShell>
    );
  }

  const archetype = ARCHETYPES[game.archetype];
  const currentDirective = game.currentDirective ? BOARD_DIRECTIVES[game.currentDirective] : null;
  const advanceDisabled = Boolean(game.pendingEvent) || Boolean(game.pendingBoardReview) || game.status !== "playing";

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-6 md:py-6">
        <div className="sticky top-0 z-30 -mx-4 border-b border-slate-800/70 bg-slate-950/88 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/55 p-5 shadow-[0_18px_45px_rgba(2,6,23,0.35)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">AI Company Tycoon</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">Executive Command</div>
              <div className="mt-3 text-sm leading-6 text-slate-400">
                Monthly operations still matter, but Step 2 adds identity, trust, channel distribution,
                rival archetypes, and quarterly board pressure to the loop.
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="default">{archetype.name}</Badge>
                <Badge tone={currentDirective ? "good" : "default"}>
                  {currentDirective ? `Directive / ${currentDirective.name}` : "No active directive"}
                </Badge>
                <Badge tone="warning">{monthLabel(game.turn)}</Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Date</div>
                <div className="mt-1 font-mono text-xl font-semibold text-slate-50">{monthLabel(game.turn)}</div>
              </div>
              <Button onClick={() => updateGame(advanceMonth)} disabled={advanceDisabled} className="min-w-[160px]">
                Advance Month
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(["overview", "strategy", "lab", "compute", "market", "bank", "admin"] as ScreenId[]).map((screen) => (
              <NavTab key={screen} active={app.screen === screen} onClick={() => setScreen(screen)}>
                {screen === "overview"
                  ? "Overview"
                  : screen === "strategy"
                    ? "Strategy"
                    : screen === "lab"
                    ? "Lab"
                    : screen === "compute"
                    ? "Cloud Capacity"
                    : screen === "market"
                      ? "Global Market"
                      : screen === "bank"
                        ? "Capital Bank"
                        : "Admin Tools"}
              </NavTab>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <KpiCard label="Cash" value={money(game.cash)} tone={game.cash > 12000000 ? "good" : game.cash > 5000000 ? "warning" : "bad"} />
            <KpiCard label="ARR" value={money(arr)} tone={arr >= 10000000 ? "good" : "default"} />
            <KpiCard label="Monthly Profit" value={money(game.lastMonth.profit)} tone={game.lastMonth.profit > 0 ? "good" : game.lastMonth.profit < -500000 ? "bad" : "warning"} />
            <KpiCard label="Runway" value={runwayMonths === Infinity ? "Infinity" : `${runwayMonths.toFixed(1)} mo`} subvalue={`Payroll ${money(payroll)}`} tone={runwayMonths === Infinity ? "good" : runwayMonths > 10 ? "warning" : "bad"} />
            <KpiCard label="Trust" value={game.trust.toFixed(1)} subvalue={`Board ${game.boardPressure.toFixed(1)}`} tone={game.trust >= 60 ? "good" : game.trust >= 45 ? "warning" : "bad"} />
            <KpiCard label="Headcount" value={headcountTotal} subvalue={`Market Std ${game.marketStandard}`} tone="default" />
          </div>
        </div>
        </div>

        <div className="mt-6">
          {app.screen === "overview" ? (
            <OverviewScreen
              game={game}
              arr={arr}
              onAttachModel={(productKey, modelId) => updateGame((current) => attachModelToProduct(current, productKey, modelId))}
              onUpdateProductPrice={(productKey, value, modelId) =>
                updateGame((current) => updateProductPrice(current, productKey, value, modelId))
              }
              onRaiseFunding={() => updateGame(raiseFunding)}
              onRestart={restartToSelection}
            />
          ) : null}

          {app.screen === "strategy" ? <StrategyScreen game={game} onUpdateMarketingBudget={(value) => updateGame((current) => updateMarketingBudget(current, value))} /> : null}

          {app.screen === "lab" ? (
            <LabScreen
              game={game}
              preview={preview}
              onHire={(role: RoleId, count: number) => updateGame((current) => hire(current, role, count))}
              onTrainEngineers={() => updateGame(trainEngineers)}
              onBuyData={(tier, pack) => updateGame((current) => buyData(current, tier, pack))}
              onBuyUpgrade={(key: UpgradeId) => updateGame((current) => buyUpgrade(current, key))}
              onUpdateTrainingConfig={(patch) => updateGame((current) => updateTrainingConfig(current, patch))}
              onBumpVersion={() => updateGame(bumpTrainingVersionName)}
              onLaunchRun={() => updateGame(launchRun)}
            />
          ) : null}

          {app.screen === "compute" ? (
            <ComputeScreen
              game={game}
              projectedServingDemand={projectedServingDemand}
              onBuildDatacenter={(pods, quantity) => updateGame((current) => buildDatacenter(current, pods, quantity))}
              onUpdateTrainingAllocation={(value) => updateGame((current) => updateTrainingAllocation(current, value))}
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-amber-500/20 bg-slate-900 p-6 shadow-2xl shadow-black/40">
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-300">Training Event</div>
            <div className="mt-2 text-3xl font-semibold text-slate-50">{game.pendingEvent.title}</div>
            <div className="mt-3 text-slate-300">{game.pendingEvent.body}</div>
            <div className="mt-6 grid gap-3">
              {game.pendingEvent.choices.map((choice) => (
                <button
                  key={choice.key}
                  onClick={() => updateGame((current) => resolvePendingEvent(current, choice.key))}
                  className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-left transition hover:border-cyan-400/30 hover:bg-slate-950"
                >
                  <div className="text-lg font-semibold text-slate-50">{choice.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{choice.effect}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {game.pendingBoardReview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[28px] border border-cyan-500/20 bg-slate-900 p-6 shadow-2xl shadow-black/40">
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">Quarterly Board Review</div>
            <div className="mt-2 text-3xl font-semibold text-slate-50">Quarter {game.pendingBoardReview.quarter}</div>
            <div className="mt-4 grid gap-3">
              {game.pendingBoardReview.reasons.map((reason) => (
                <div key={reason} className="rounded-xl border border-slate-800 bg-slate-950/55 p-3 text-sm text-slate-300">
                  {reason}
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Object.values(BOARD_DIRECTIVES).map((directive) => (
                <button
                  key={directive.id}
                  onClick={() => updateGame((current) => chooseBoardDirective(current, directive.id as BoardDirectiveId))}
                  className="rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-left transition hover:border-cyan-400/30 hover:bg-slate-950"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-semibold text-slate-50">{directive.name}</div>
                    <Badge tone="default">{directive.id.split("_").join(" ")}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{directive.summary}</div>
                  <div className="mt-4 text-sm text-emerald-300">{directive.upside}</div>
                  <div className="mt-2 text-sm text-slate-500">{directive.downside}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {game.status !== "playing" ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl shadow-black/40">
            <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">Company Failed</div>
            <div className="mt-3 text-4xl font-semibold text-slate-50">The Company Lost Control</div>
            <div className="mt-3 text-slate-300">
              Cash, trust, or market pressure broke the company before the economics stabilized.
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <KpiCard label="Final ARR" value={money(game.lastMonth.revenue * 12)} />
              <KpiCard label="Final Cash" value={money(game.cash)} tone={game.cash > 0 ? "good" : "bad"} />
            </div>
            <div className="mt-6 flex justify-center">
              <Button onClick={restartToSelection}>Return To Archetypes</Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
