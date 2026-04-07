import { useState } from "react";

import { DATA_TIERS, MODEL_GOALS, MODEL_SIZES, RELIABILITY_TIERS, ROLE_LABELS, SALARIES, UPGRADES } from "../game/defs";
import {
  formatBigContext,
  formatBigMemory,
  formatBigParams,
  formatVersion,
  getEngineerFailureRiskReduction,
  getEngineerTrainingCostRange,
  getEngineerTrainingMultiplier,
  getMarketComparison,
  getModelById,
  getUpgradeCost,
  monthLabel,
  money,
  pct,
  formatPods,
} from "../game/sim";
import { DataTierId, GameState, RoleId, UpgradeId } from "../game/types";
import { Badge, Button, EmptyState, Panel } from "../components/ui";

const BASE_MEMORY = { small: 8, medium: 16, large: 32, frontier: 64 } as const;
const BASE_PARAMS = { small: 8, medium: 22, large: 56, frontier: 120 } as const;
const BASE_CONTEXT = { small: 8, medium: 16, large: 32, frontier: 64 } as const;
const PARAMETER_STEP = { small: 2, medium: 5, large: 12, frontier: 24 } as const;

export function LabScreen({
  game,
  preview,
  onHire,
  onTrainEngineers,
  onBuyData,
  onBuyUpgrade,
  onUpdateTrainingConfig,
  onBumpVersion,
  onLaunchRun,
}: {
  game: GameState;
  preview: {
    computeNeed: number;
    totalMonths: number;
    capability: number;
    inferenceCost: number;
    trust: number;
    failureRisk: number;
    projectedEquivalentCost: number;
    targetMemorySize: number;
    targetParameterScale: number;
    targetContextWindow: number;
    trainingDataUnits: number;
    maxMemorySize: number;
    maxParameterScale: number;
    maxContextWindow: number;
    researcherContribution: number;
    engineerDurationReduction: number;
    engineerRiskReduction: number;
    engineerTrainingMultiplier: number;
    dataContribution: number;
  };
  onHire: (role: RoleId, count: number) => void;
  onTrainEngineers: () => void;
  onBuyData: (tier: DataTierId, units: number) => void;
  onBuyUpgrade: (key: UpgradeId) => void;
  onUpdateTrainingConfig: (patch: Partial<GameState["trainingConfig"]>) => void;
  onBumpVersion: () => void;
  onLaunchRun: () => void;
}) {
  const [dataPurchaseUnits, setDataPurchaseUnits] = useState<Record<DataTierId, string>>({
    web: "1",
    licensed: "1",
    synthesized: "1",
  });
  const [hireAmounts, setHireAmounts] = useState<Record<RoleId, string>>({
    researchers: "1",
    engineers: "1",
    sales: "1",
  });
  const derivedMode = game.trainingConfig.mode === "upgrade" || game.trainingConfig.mode === "branch";
  const upgradeMode = game.trainingConfig.mode === "upgrade";
  const branchMode = game.trainingConfig.mode === "branch";
  const baseModel = getModelById(game, game.trainingConfig.baseModelId);
  const hasBaseModels = game.models.length > 0;
  const sizeKey = game.trainingConfig.size;
  const baseMemorySize = baseModel ? baseModel.memorySize : BASE_MEMORY[sizeKey];
  const baseParameterScale = baseModel ? baseModel.parameterScale : BASE_PARAMS[sizeKey];
  const baseContextWindow = baseModel ? baseModel.contextWindow : BASE_CONTEXT[sizeKey];
  const maxTrainingDataUnits = Math.max(1, game.dataInventory[game.trainingConfig.dataTier]);
  const maxMemorySize = preview.maxMemorySize;
  const maxParameterScale = preview.maxParameterScale;
  const maxContextWindow = preview.maxContextWindow;
  const previewMarket = getMarketComparison(preview.capability, game.marketStandard);
  const activeGoalEntries = Object.entries(game.trainingConfig.goals).filter(([, value]) => value > 1);
  const minimumUpgradeVersion = baseModel ? Number((baseModel.version + 0.001).toFixed(3)) : 1;
  const upfrontDevelopmentCost = Math.round(preview.projectedEquivalentCost * 0.3);
  const launchDisabled =
    game.dataInventory[game.trainingConfig.dataTier] < game.trainingConfig.trainingDataUnits ||
    game.activeRuns.length >= 3 ||
    game.cash < upfrontDevelopmentCost ||
    (derivedMode && !baseModel);
  const engineerTrainingCostRange = getEngineerTrainingCostRange(game);
  const engineerTrainingDisabled = game.headcount.engineers === 0 || game.cash < engineerTrainingCostRange.max;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <div className="space-y-6">
        <Panel title="Talent Pool" subtitle="Headcount still matters. Researchers lift capability. Engineers reduce weight and risk. Sales shapes demand.">
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(ROLE_LABELS) as RoleId[]).map((role) => (
              <div key={role} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="text-lg font-semibold text-slate-50">{ROLE_LABELS[role]}</div>
                <div className="mt-1 text-sm text-slate-400">{game.headcount[role]} hired</div>
                <div className="mt-2 text-sm text-slate-500">Monthly cost {money(SALARIES[role])}</div>
                {role === "engineers" ? (
                  <div className="mt-3 space-y-1 text-sm text-slate-400">
                    <div>Reliability training L{game.engineerTrainingLevel}</div>
                    <div>
                      Risk reduction {pct(getEngineerFailureRiskReduction(game))} total / x
                      {getEngineerTrainingMultiplier(game.engineerTrainingLevel).toFixed(2)} engineer impact
                    </div>
                    <div className="text-slate-500">
                      Training cost {money(engineerTrainingCostRange.min)}-{money(engineerTrainingCostRange.max)}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={hireAmounts[role]}
                      onChange={(e) => setHireAmounts((prev) => ({ ...prev, [role]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const count = Math.max(1, parseInt(hireAmounts[role], 10) || 1);
                          onHire(role, count);
                        }
                      }}
                      className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
                    />
                    <Button
                      onClick={() => {
                        const count = Math.max(1, parseInt(hireAmounts[role], 10) || 1);
                        onHire(role, count);
                      }}
                      variant="secondary"
                    >
                      Hire
                    </Button>
                    {role === "engineers" ? (
                      <Button onClick={onTrainEngineers} variant="ghost" disabled={engineerTrainingDisabled}>
                        Train Team
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Data Market" subtitle="Each training run consumes one dataset bundle, so portfolio quality matters.">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/45">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/85 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Source</th>
                  <th className="w-[140px] px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Owned Units</th>
                  <th className="px-4 py-3 text-left font-medium">Base Cost</th>
                  <th className="px-4 py-3 text-left font-medium">Purchase</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(DATA_TIERS).map((tier) => {
                  const unavailable = tier.key === "synthesized" && game.models.length === 0;
                  const selectedUnits = Math.max(1, Math.round(Number(dataPurchaseUnits[tier.key]) || 1));
                  const selectedCost = Math.round(tier.cost * selectedUnits);
                  return (
                    <tr key={tier.key} className="border-t border-slate-800/80 text-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-50">{tier.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {tier.key === "licensed" ? "Exp. / Clean" : tier.key === "synthesized" ? "Prior Model" : tier.tag}
                      </td>
                      <td className="px-4 py-3">{game.dataInventory[tier.key]} units</td>
                      <td className="px-4 py-3 font-mono">{money(tier.cost)}</td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[250px] flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={dataPurchaseUnits[tier.key]}
                            onChange={(event) =>
                              setDataPurchaseUnits((current) => ({
                                ...current,
                                [tier.key]: event.target.value,
                              }))
                            }
                            disabled={unavailable}
                            className="w-24 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <Button
                            onClick={() => onBuyData(tier.key, selectedUnits)}
                            variant="secondary"
                            disabled={unavailable || game.cash < selectedCost}
                          >
                            {unavailable ? "Locked" : `Purchase ${selectedUnits} Units`}
                          </Button>
                          <div className="text-sm font-mono text-slate-400">{money(selectedCost)}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Upgrade Paths" subtitle="Keep the tech tree shallow here and use it to support the strategic layer.">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.values(UPGRADES).map((upgrade) => {
              const level = game.upgrades[upgrade.key];
              const nextCost = getUpgradeCost(upgrade.key, level);
              return (
                <div key={upgrade.key} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-50">{upgrade.name}</div>
                      <div className="mt-1 text-sm text-slate-400">{upgrade.description}</div>
                    </div>
                    <Badge tone="default">L{level}</Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-500">Next {money(nextCost)}</div>
                    <Button onClick={() => onBuyUpgrade(upgrade.key)} variant="secondary" disabled={game.cash < nextCost}>
                      Upgrade
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Training Run Console" subtitle="The lab stays dramatic. Runs are still the emotional center of the loop.">
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm text-slate-400">Run Type</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => onUpdateTrainingConfig({ mode: "new" })}
                  variant={game.trainingConfig.mode === "new" ? "secondary" : "ghost"}
                >
                  New Model
                </Button>
                <Button
                  onClick={() => onUpdateTrainingConfig({ mode: "upgrade" })}
                  variant={upgradeMode ? "secondary" : "ghost"}
                  disabled={!hasBaseModels}
                >
                  Upgrade Existing
                </Button>
                <Button
                  onClick={() => onUpdateTrainingConfig({ mode: "branch" })}
                  variant={branchMode ? "secondary" : "ghost"}
                  disabled={!hasBaseModels}
                >
                  Branch Existing
                </Button>
              </div>
            </div>

            {derivedMode ? (
              hasBaseModels ? (
                <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                  <label className="text-sm">
                    <div className="mb-1 text-slate-400">Base Model</div>
                    <select
                      value={game.trainingConfig.baseModelId ?? ""}
                      onChange={(event) =>
                        onUpdateTrainingConfig({
                          baseModelId: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                    >
                      {game.models.map((model) => (
                        <option key={model.id} value={model.id}>
                          #{model.id} / {model.name} v{formatVersion(model.version)} / Cap {model.capability}
                        </option>
                      ))}
                    </select>
                  </label>

                  {baseModel ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-sm text-slate-400">{branchMode ? "Branch Architecture" : "Inherited Architecture"}</div>
                        <div className="mt-1 text-lg font-semibold text-slate-50">{MODEL_SIZES[baseModel.sizeKey].name}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {branchMode
                            ? "Branches inherit the base model, then fork into a new family you can rename and specialize."
                            : "Upgrades preserve size class and improve the existing family."}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                        <div className="text-sm text-slate-400">Base Snapshot</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge tone="good">v{formatVersion(baseModel.version)}</Badge>
                          <Badge tone="default">{formatBigMemory(baseModel.memorySize)}</Badge>
                          <Badge tone="warning">{formatBigParams(baseModel.parameterScale)} params</Badge>
                          <Badge tone="default">{formatBigContext(baseModel.contextWindow)} ctx</Badge>
                          <Badge tone="default">{baseModel.trainingDataUnits} data units</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(baseModel.goals)
                            .filter(([, weight]) => weight > 1)
                            .map(([goalId, weight]) => (
                              <Badge key={goalId} tone="default">
                                {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} {weight}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState title="No base models yet" body="Ship at least one model before upgrading or branching from it." />
              )
            ) : null}

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <label className="text-sm">
                <div className="mb-1 text-slate-400">
                  {branchMode ? "Branch Ship Name" : upgradeMode ? "Upgrade Ship Name" : "Internal Codename"}
                </div>
                <input
                  type="text"
                  value={game.trainingConfig.name}
                  onChange={(event) => onUpdateTrainingConfig({ name: event.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                />
              </label>
              <div className="self-end">
                <Button onClick={onBumpVersion} variant="ghost" disabled={!derivedMode}>
                  Increase Version +0.1
                </Button>
              </div>
            </div>

            {derivedMode ? (
              <label className="text-sm">
                <div className="mb-1 text-slate-400">Target Version</div>
                <input
                  type="number"
                  min={minimumUpgradeVersion}
                  step={0.001}
                  value={game.trainingConfig.targetVersion}
                  onChange={(event) =>
                    onUpdateTrainingConfig({
                      targetVersion: Math.max(
                        minimumUpgradeVersion,
                        Number(event.target.value) || 1,
                      ),
                    })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                />
                <div className="mt-1 text-xs text-slate-500">
                  Defaults to +0.1, but any version above v{baseModel ? formatVersion(baseModel.version) : "1.0"} is valid.
                </div>
              </label>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 text-slate-400">Model Size</div>
                <select
                  value={game.trainingConfig.size}
                  onChange={(event) => onUpdateTrainingConfig({ size: event.target.value as GameState["trainingConfig"]["size"] })}
                  disabled={derivedMode}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {Object.values(MODEL_SIZES).map((size) => (
                    <option key={size.key} value={size.key}>
                      {size.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-400">Data Tier</div>
                <select
                  value={game.trainingConfig.dataTier}
                  onChange={(event) => onUpdateTrainingConfig({ dataTier: event.target.value as DataTierId })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                >
                  {Object.values(DATA_TIERS).map((tier) => (
                    <option key={tier.key} value={tier.key}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="text-sm">
              <div className="mb-1 flex items-center justify-between text-slate-400">
                <span>Training Data Volume</span>
                <span>{game.trainingConfig.trainingDataUnits} / {maxTrainingDataUnits} units</span>
              </div>
              <input
                type="range"
                min={1}
                max={maxTrainingDataUnits}
                step={1}
                value={game.trainingConfig.trainingDataUnits}
                onChange={(event) => onUpdateTrainingConfig({ trainingDataUnits: Number(event.target.value) })}
                className="w-full"
              />
              <div className="mt-1 text-xs text-slate-500">
                More owned data raises the parameter ceiling and lifts capability potential. Upgrades start from the parent model's data volume.
              </div>
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm">
                <div className="mb-1 flex items-center justify-between text-slate-400">
                  <span>Memory</span>
                  <span>Limit {formatBigMemory(maxMemorySize)}</span>
                </div>
                <div className="mb-1 text-xs text-slate-500">Base {formatBigMemory(baseMemorySize)} / Target {formatBigMemory(game.trainingConfig.targetMemorySize)}</div>
                <input
                  type="number"
                  min={baseMemorySize}
                  max={maxMemorySize}
                  step={8}
                  value={game.trainingConfig.targetMemorySize}
                  onChange={(event) =>
                    onUpdateTrainingConfig({
                      targetMemorySize: Math.max(baseMemorySize, Math.min(maxMemorySize, Number(event.target.value) || baseMemorySize)),
                    })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 flex items-center justify-between text-slate-400">
                  <span>Parameters</span>
                  <span>Limit {formatBigParams(maxParameterScale)}</span>
                </div>
                <div className="mb-1 text-xs text-slate-500">
                  Base {formatBigParams(baseParameterScale)} / Target {formatBigParams(game.trainingConfig.targetParameterScale)}
                </div>
                <input
                  type="number"
                  min={baseParameterScale}
                  max={maxParameterScale}
                  step={PARAMETER_STEP[sizeKey]}
                  value={game.trainingConfig.targetParameterScale}
                  onChange={(event) =>
                    onUpdateTrainingConfig({
                      targetParameterScale: Math.max(
                        baseParameterScale,
                        Math.min(maxParameterScale, Number(event.target.value) || baseParameterScale),
                      ),
                    })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 flex items-center justify-between text-slate-400">
                  <span>Context Window</span>
                  <span>Limit {formatBigContext(maxContextWindow)}</span>
                </div>
                <div className="mb-1 text-xs text-slate-500">Base {formatBigContext(baseContextWindow)} / Target {formatBigContext(game.trainingConfig.targetContextWindow)}</div>
                <input
                  type="number"
                  min={baseContextWindow}
                  max={maxContextWindow}
                  step={8}
                  value={game.trainingConfig.targetContextWindow}
                  onChange={(event) =>
                    onUpdateTrainingConfig({
                      targetContextWindow: Math.max(
                        baseContextWindow,
                        Math.min(maxContextWindow, Number(event.target.value) || baseContextWindow),
                      ),
                    })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="text-sm text-slate-400">Model Goals</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {Object.values(MODEL_GOALS).map((goal) => (
                  <div key={goal.id} className="rounded-xl border border-slate-800/80 bg-slate-900/55 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-200">{goal.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{goal.summary}</div>
                      </div>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={game.trainingConfig.goals[goal.id]}
                        onChange={(event) =>
                          onUpdateTrainingConfig({
                            goals: {
                              ...game.trainingConfig.goals,
                              [goal.id]: Math.max(1, Number(event.target.value) || 1),
                            },
                          })
                        }
                        className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-right text-slate-100 outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeGoalEntries.length > 0 ? (
                  activeGoalEntries.map(([goalId, value]) => (
                    <Badge key={goalId} tone="default">
                      {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} {value}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Balanced baseline selected. Push one axis hard if you want a specialist model.</span>
                )}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                Goal ratings are uncapped. Higher values compound development cost through fixed dollar increases and percentage-based cost multipliers.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-200">Model Reliability</div>
                  <div className="mt-1 text-sm text-slate-400">Reduce hallucinations and failures. Expanding reliability past 0.90 is exponentially costly.</div>
                </div>
              </div>
              
              <div className="mt-4 space-y-4">
                {Object.values(RELIABILITY_TIERS).map((tier) => {
                  const val = game.trainingConfig.reliability[tier.id] || 0;
                  const estimatedCost = val > 0 
                    ? tier.baseConstantMillions * Math.pow(1 / (1 - val), tier.exponent)
                    : 0;
                    
                  return (
                    <div key={tier.id} className="rounded-xl border border-slate-800/80 bg-slate-900/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="w-48 text-sm font-medium text-slate-200">{tier.name}</div>
                        <div className="flex flex-1 items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max="0.99"
                            step="0.01"
                            value={val}
                            onChange={(e) => onUpdateTrainingConfig({
                              reliability: {
                                ...game.trainingConfig.reliability,
                                [tier.id]: Number(e.target.value)
                              }
                            })}
                            className="w-full"
                          />
                          <div className="w-12 text-right text-sm text-slate-400">
                            {val.toFixed(2)}
                          </div>
                        </div>
                        <div className="w-24 text-right text-sm text-slate-400">
                          {estimatedCost > 0 ? `+${money(estimatedCost * 1000000)}` : '-'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="text-sm">
              <div className="mb-1 flex items-center justify-between text-slate-400">
                <span>Compute Need</span>
                <span>{formatPods(preview.computeNeed)} pods</span>
              </div>
              <input
                type="range"
                min={MODEL_SIZES[game.trainingConfig.size].minCompute}
                max={MODEL_SIZES[game.trainingConfig.size].maxCompute}
                value={game.trainingConfig.computeNeed}
                onChange={(event) => onUpdateTrainingConfig({ computeNeed: Number(event.target.value) })}
                className="w-full"
              />
            </label>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="text-sm font-medium text-slate-300">Model Forecasts</div>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-800/80">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900/85 text-slate-300">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Metric</th>
                        <th className="px-4 py-3 text-left font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Duration</td>
                        <td className="px-4 py-3 text-slate-100">{preview.totalMonths} mo</td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Capability</td>
                        <td className="px-4 py-3 text-slate-100">{preview.capability}</td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Inference</td>
                        <td className="px-4 py-3 text-slate-100">{preview.inferenceCost} (Lower is better)</td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Trust</td>
                        <td className="px-4 py-3 text-slate-100">{preview.trust}</td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Failure Risk</td>
                        <td className="px-4 py-3 text-slate-100">{pct(preview.failureRisk)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <div className="text-sm font-medium text-slate-300">Resource Impact</div>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-800/80">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900/85 text-slate-300">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Metric</th>
                        <th className="px-4 py-3 text-left font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Research Lift</td>
                        <td className="px-4 py-3 text-slate-100">+{preview.researcherContribution} ({game.headcount.researchers} researchers)</td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Engineer Risk Guard</td>
                        <td className="px-4 py-3 text-slate-100">
                          -{(preview.engineerRiskReduction * 100).toFixed(1)}% (L{game.engineerTrainingLevel} / x
                          {preview.engineerTrainingMultiplier.toFixed(2)})
                        </td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Engineer Time Reduction</td>
                        <td className="px-4 py-3 text-slate-100">-{preview.engineerDurationReduction.toFixed(1)} mo</td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Data Lift</td>
                        <td className="px-4 py-3 text-slate-100">+{preview.dataContribution} ({preview.trainingDataUnits} units)</td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Target Memory</td>
                        <td className="px-4 py-3 text-slate-100">{preview.targetMemorySize} GB</td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Target Params</td>
                        <td className="px-4 py-3 text-slate-100">
                          {preview.targetParameterScale.toFixed(1)}B (Cap: {preview.maxParameterScale.toFixed(1)}B)
                        </td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Target Context</td>
                        <td className="px-4 py-3 text-slate-100">{preview.targetContextWindow}K</td>
                      </tr>
                      <tr className="border-t border-slate-800/80">
                        <td className="px-4 py-3 text-slate-400">Equivalent Cost</td>
                        <td className="px-4 py-3 text-slate-100">{money(preview.projectedEquivalentCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={previewMarket.tone}>{previewMarket.label}</Badge>
                  <Badge tone="default">Training Data {preview.trainingDataUnits} units</Badge>
                  <Badge tone="default">Data Available {game.dataInventory[game.trainingConfig.dataTier]} units</Badge>
                  <Badge tone={game.cash >= upfrontDevelopmentCost ? "good" : "bad"}>Launch Spend {money(upfrontDevelopmentCost)}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Badge tone={game.activeRuns.length >= 2 ? "warning" : "default"}>
                {game.activeRuns.length} active run(s)
              </Badge>
              <Button onClick={onLaunchRun} disabled={launchDisabled}>
                {branchMode ? "Launch Branch" : upgradeMode ? "Launch Upgrade" : "Launch Run"}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Model Shelf" subtitle="Freshly trained models can be attached to products from Overview.">
          <div className="space-y-3">
            {game.models.length === 0 ? (
              <EmptyState title="No shipped models" body="Buy data, launch a run, and survive long enough to put something on the shelf." />
            ) : (
              game.models.map((model) => {
                const parentModel = getModelById(game, model.baseModelId);
                const marketPosition = getMarketComparison(model.capability, game.marketStandard);
                return (
                  <div key={model.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-slate-50">
                          #{model.id} / {model.name} v{formatVersion(model.version)}
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          Built {monthLabel(model.monthBuilt)} / {MODEL_SIZES[model.sizeKey].name} / {DATA_TIERS[model.dataTier].name}
                        </div>
                        <div className="mt-2 text-sm text-slate-500">
                          {parentModel
                            ? `Upgraded from ${parentModel.name} v${formatVersion(parentModel.version)} / Family #${model.familyId}`
                            : `Foundation release / Family #${model.familyId}`}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="good">Capability {model.capability}</Badge>
                        <Badge tone={marketPosition.tone}>{marketPosition.label}</Badge>
                        <Badge tone="warning">Inference {model.inferenceCost}</Badge>
                        <Badge tone="default">Trust {model.trust}</Badge>
                        <Badge tone="default">{model.memorySize} GB</Badge>
                        <Badge tone="default">{model.parameterScale}B params</Badge>
                        <Badge tone="default">{model.contextWindow}K ctx</Badge>
                        <Badge tone="default">{model.trainingDataUnits} data units</Badge>
                        {Object.entries(model.goals)
                          .filter(([, weight]) => weight > 1)
                          .map(([goalId, weight]) => (
                            <Badge key={goalId} tone="default">
                              {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} {weight}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
