import { useState } from "react";

import { MODEL_GOALS } from "../game/defs";
import { formatVersion, getDatacenterBuildCost, getReservedCostPerPod, money, formatPods } from "../game/sim";
import { GameState } from "../game/types";
import { Badge, Button, EmptyState, KpiCard, LossCurve, Panel, StatRow } from "../components/ui";

export function ComputeScreen({
  game,
  projectedServingDemand,
  onBuildDatacenter,
  onUpdateTrainingAllocation,
  onShutdownRun,
}: {
  game: GameState;
  projectedServingDemand: number;
  onBuildDatacenter: (pods: number, quantity: number) => void;
  onUpdateTrainingAllocation: (value: number) => void;
  onShutdownRun: (runId: number) => void;
}) {
  const [buildPods, setBuildPods] = useState(24);
  const [buildQuantity, setBuildQuantity] = useState(1);
  const servingPct = 100 - game.cloud.trainingPct;
  const buildCost = getDatacenterBuildCost(buildPods);
  const totalBuildCost = buildCost * Math.max(1, Math.round(buildQuantity));

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <Panel title="Cloud Capacity" subtitle="Datacenter builds turn cloud capacity into a real capital allocation choice.">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <div className="text-sm text-slate-400">Installed Cloud Pods</div>
                <div className="mt-3 font-mono text-3xl font-semibold text-slate-50">{formatPods(game.cloud.reservedPods)}</div>
                <div className="mt-2 text-sm text-slate-500">Reserved cost per pod {money(getReservedCostPerPod(game))} / month</div>
                <div className="mt-4 rounded-2xl bg-slate-900/75 p-4 ring-1 ring-inset ring-slate-800/60">
                  <div className="text-sm font-medium text-slate-300">Build New Datacenter</div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-400">
                    <span>Pods</span>
                    <span>{buildPods}</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={240}
                    step={4}
                    value={buildPods}
                    onChange={(event) => setBuildPods(Number(event.target.value))}
                    className="mt-2 w-full"
                  />
                  <label className="mt-3 block text-sm">
                    <div className="mb-1 text-slate-500">Datacenters</div>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={buildQuantity}
                      onChange={(event) => setBuildQuantity(Math.max(1, Number(event.target.value) || 1))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                    />
                  </label>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">Capex</span>
                    <span className="font-mono text-slate-100">{money(totalBuildCost)}</span>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={() => onBuildDatacenter(buildPods, buildQuantity)}
                      variant="primary"
                      disabled={game.cash < totalBuildCost}
                    >
                      Build Datacenters
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-400">
                  <span>Training Allocation</span>
                  <span>{game.cloud.trainingPct}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={85}
                  value={game.cloud.trainingPct}
                  onChange={(event) => onUpdateTrainingAllocation(Number(event.target.value))}
                  className="w-full"
                />
                <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
                  <span>Training {formatPods(game.cloud.reservedPods * game.cloud.trainingPct / 100)} pods</span>
                  <span>Serving {formatPods(game.cloud.reservedPods * servingPct / 100)} pods</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <KpiCard label="Projected Serving Demand" value={`${formatPods(projectedServingDemand)} pods`} />
            <KpiCard label="Active Training Demand" value={`${formatPods(game.activeRuns.reduce((sum, run) => sum + run.computeNeed, 0))} pods`} />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
            <div className="text-sm font-medium text-slate-300">Datacenter Fleet</div>
            <div className="mt-3 rounded-2xl bg-slate-900/75 p-4 ring-1 ring-inset ring-slate-800/60">
              <div className="text-sm text-slate-400">Datacenters Owned</div>
              <div className="mt-2 font-mono text-3xl font-semibold text-slate-50">{game.cloud.datacenters.length}</div>
            </div>
          </div>
        </Panel>

        <Panel title="Serving Risk" subtitle="Great products still fail if serving weight outruns pricing discipline.">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
            <div className="space-y-3">
              <StatRow label="Reserved Serving Pods" value={formatPods(game.cloud.reservedPods * servingPct / 100)} />
              <StatRow label="Last Month Serving Demand" value={formatPods(game.lastMonth.servingDemand)} />
              <StatRow label="Last Month Overflow Cost" value={money(game.lastMonth.overflowCost)} tone={game.lastMonth.overflowCost > 0 ? "warning" : "good"} />
              <StatRow label="Training Demand" value={formatPods(game.lastMonth.trainingDemand)} />
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Active Training Runs" subtitle="Watch the graph, the risk curve, and the run count.">
          <div className="space-y-4">
            {game.activeRuns.length === 0 ? (
              <EmptyState title="No active runs" body="Head to the Lab and launch a run when the company is ready." />
            ) : (
              game.activeRuns.map((run) => {
                const visiblePoints = run.lossCurve.slice(0, Math.max(1, run.monthsElapsed + 1));
                return (
                  <div key={run.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-slate-50">
                          {run.name} v{formatVersion(run.targetVersion)}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">{formatPods(run.computeNeed)} pods / {run.monthsElapsed} of {run.totalMonths} months</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(run.goals)
                            .filter(([, weight]) => weight > 0)
                            .slice(0, 3)
                            .map(([goalId, weight]) => (
                              <Badge key={goalId} tone="default">
                                {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} {weight}
                              </Badge>
                            ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="default">Projected Cap {run.projectedCapability}</Badge>
                        <Badge tone={run.baseFailureRisk + run.riskModifier < 0.16 ? "good" : run.baseFailureRisk + run.riskModifier < 0.3 ? "warning" : "bad"}>
                          Risk {(Math.max(0, Math.min(1, run.baseFailureRisk + run.riskModifier)) * 100).toFixed(0)}%
                        </Badge>
                        <Button onClick={() => onShutdownRun(run.id)} variant="ghost">
                          Shut Down
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4">
                      <LossCurve points={visiblePoints} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        <Panel title="Fleet Status" subtitle="Useful readout for deciding whether to optimize serving or push another run.">
          <div className="grid gap-3 md:grid-cols-2">
            {game.models.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyState title="No shipped models" body="The compute layer gets more interesting once a model survives training." />
              </div>
            ) : (
              game.models.slice(0, 6).map((model) => (
                <div key={model.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <div className="text-base font-semibold text-slate-50">
                    #{model.id} / {model.name} v{formatVersion(model.version)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(model.goals)
                      .filter(([, weight]) => weight > 0)
                      .slice(0, 3)
                      .map(([goalId, weight]) => (
                        <Badge key={goalId} tone="default">
                          {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} {weight}
                        </Badge>
                      ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-slate-400">Cap</div>
                      <div className="mt-1 font-mono text-slate-100">{model.capability}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Infer</div>
                      <div className="mt-1 font-mono text-slate-100">{model.inferenceCost}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Trust</div>
                      <div className="mt-1 font-mono text-slate-100">{model.trust}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
