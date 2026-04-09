import { useState } from "react";

import { MODEL_GOALS } from "../game/defs";
import { CLOUD_RENTAL_MARKET_RATE, formatVersion, getDatacenterBuildCost, getReservedCostPerPod, money, formatPods } from "../game/sim";
import { GameState } from "../game/types";
import { Badge, Button, EmptyState, KpiCard, LossCurve, Panel, StatRow } from "../components/ui";

export function ComputeScreen({
  game,
  projectedServingDemand,
  onBuildDatacenter,
  onSellDatacenters,
  onUpdateTrainingAllocation,
  onUpdateCloudRentalPrice,
  onShutdownRun,
}: {
  game: GameState;
  projectedServingDemand: number;
  onBuildDatacenter: (pods: number, quantity: number) => void;
  onSellDatacenters: (pods: number, quantity: number, pricePerDatacenter: number) => void;
  onUpdateTrainingAllocation: (value: number) => void;
  onUpdateCloudRentalPrice: (price: number) => void;
  onShutdownRun: (runId: number) => void;
}) {
  const [buildPods, setBuildPods] = useState(24);
  const [buildQuantity, setBuildQuantity] = useState(1);
  const [rentalPriceInput, setRentalPriceInput] = useState(String(game.cloudRental.pricePerPod || ""));
  const [sellQuantityInputs, setSellQuantityInputs] = useState<Record<number, string>>({});
  const [sellPriceInputs, setSellPriceInputs] = useState<Record<number, string>>({});
  const servingPct = 100 - game.cloud.trainingPct;
  const buildCost = getDatacenterBuildCost(buildPods);
  const totalBuildCost = buildCost * Math.max(1, Math.round(buildQuantity));
  const datacenterGroups = Object.values(
    game.cloud.datacenters.reduce<Record<number, { pods: number; count: number; totalBuildCost: number }>>((groups, datacenter) => {
      const existing = groups[datacenter.pods];
      if (existing) {
        existing.count += 1;
        existing.totalBuildCost += datacenter.buildCost;
      } else {
        groups[datacenter.pods] = {
          pods: datacenter.pods,
          count: 1,
          totalBuildCost: datacenter.buildCost,
        };
      }
      return groups;
    }, {}),
  ).sort((left, right) => right.pods - left.pods);

  // Estimated surplus: pods not being consumed by serving or training demand
  const trainingDemand = game.activeRuns.reduce((sum, run) => sum + run.computeNeed, 0);
  const allocatedServing = game.cloud.reservedPods * servingPct / 100;
  const allocatedTraining = game.cloud.reservedPods * game.cloud.trainingPct / 100;
  const estimatedSurplus = Math.max(
    0,
    Math.floor((allocatedServing - projectedServingDemand) + (allocatedTraining - trainingDemand)),
  );

  const rentalPrice = game.cloudRental.pricePerPod;
  const rentalEnabled = rentalPrice > 0;
  const priceVsMarket = rentalEnabled ? rentalPrice / CLOUD_RENTAL_MARKET_RATE : 1;
  const rentalPriceTone =
    !rentalEnabled ? "default" :
    priceVsMarket <= 1 ? "good" :
    priceVsMarket <= 1.5 ? "warning" : "bad";

  function commitRentalPrice() {
    const parsed = parseInt(rentalPriceInput, 10);
    onUpdateCloudRentalPrice(isNaN(parsed) ? 0 : Math.max(0, parsed));
  }

  function getSellQuantityValue(pods: number) {
    return sellQuantityInputs[pods] ?? "1";
  }

  function getSellPriceValue(pods: number, fallbackPrice: number) {
    return sellPriceInputs[pods] ?? String(fallbackPrice);
  }

  function commitSell(pods: number, maxQuantity: number, fallbackPrice: number) {
    const parsedQuantity = parseInt(getSellQuantityValue(pods), 10);
    const parsedPrice = parseInt(getSellPriceValue(pods, fallbackPrice), 10);
    const quantity = Math.min(maxQuantity, Math.max(1, isNaN(parsedQuantity) ? 1 : parsedQuantity));
    const pricePerDatacenter = Math.max(0, isNaN(parsedPrice) ? fallbackPrice : parsedPrice);
    onSellDatacenters(pods, quantity, pricePerDatacenter);
  }

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

              <div className="space-y-4">
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

                {/* Cloud Rental Card */}
                <div className="rounded-2xl bg-slate-900/75 p-4 ring-1 ring-inset ring-slate-800/60">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-300">Rent Out Surplus Pods</div>
                    {rentalEnabled && (
                      <span className={`text-xs font-medium ${rentalPriceTone === "good" ? "text-emerald-400" : rentalPriceTone === "warning" ? "text-amber-400" : "text-red-400"}`}>
                        {priceVsMarket <= 1 ? "Below market" : priceVsMarket <= 1.5 ? "Above market" : "Overpriced"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Market rate {money(CLOUD_RENTAL_MARKET_RATE)}/pod/mo · Surplus {formatPods(estimatedSurplus)} pods
                  </div>

                  <label className="mt-3 block text-sm">
                    <div className="mb-1 text-slate-500">Price per pod / month ($)</div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={rentalPriceInput}
                        placeholder="0 = disabled"
                        onChange={(e) => setRentalPriceInput(e.target.value)}
                        onBlur={commitRentalPrice}
                        onKeyDown={(e) => e.key === "Enter" && commitRentalPrice()}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                      />
                    </div>
                  </label>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Pods rented last month</span>
                      <span className="font-mono text-slate-100">{formatPods(game.lastMonth.cloudRentalPodsRented)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Rental revenue last month</span>
                      <span className={`font-mono ${game.lastMonth.cloudRentalRevenue > 0 ? "text-emerald-400" : "text-slate-100"}`}>
                        {money(game.lastMonth.cloudRentalRevenue)}
                      </span>
                    </div>
                  </div>
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
            {datacenterGroups.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No datacenters online" body="Build cloud capacity first, then you can trim the fleet here." />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {datacenterGroups.map((group) => {
                  const averageBuildCost = Math.round(group.totalBuildCost / group.count);
                  const sellQuantityValue = getSellQuantityValue(group.pods);
                  const sellPriceValue = getSellPriceValue(group.pods, averageBuildCost);
                  return (
                    <div key={group.pods} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-base font-semibold text-slate-50">{group.pods}-Pod Datacenters</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {group.count} owned · Build cost basis {money(averageBuildCost)} each
                          </div>
                        </div>
                        <Badge tone="default">{formatPods(group.pods * group.count)} pods installed</Badge>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[0.8fr_1fr_auto]">
                        <label className="block text-sm">
                          <div className="mb-1 text-slate-500">Datacenters to sell</div>
                          <input
                            type="number"
                            min={1}
                            max={group.count}
                            step={1}
                            value={sellQuantityValue}
                            onChange={(event) =>
                              setSellQuantityInputs((current) => ({
                                ...current,
                                [group.pods]: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                          />
                        </label>

                        <label className="block text-sm">
                          <div className="mb-1 text-slate-500">Sale price per datacenter ($)</div>
                          <input
                            type="number"
                            min={0}
                            step={100000}
                            value={sellPriceValue}
                            onChange={(event) =>
                              setSellPriceInputs((current) => ({
                                ...current,
                                [group.pods]: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                          />
                        </label>

                        <div className="flex items-end">
                          <Button
                            onClick={() => commitSell(group.pods, group.count, averageBuildCost)}
                            variant="ghost"
                          >
                            Sell Datacenters
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
