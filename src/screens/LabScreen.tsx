import { Fragment, useState } from "react";

import { DATA_TIERS, DEPARTMENT_LABELS, MODEL_GOALS, MODEL_SIZES, RELIABILITY_TIERS, RESEARCH_SPECIALTY_LABELS, ROLE_LABELS, SALARIES, UPGRADES } from "../game/defs";
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
  monthLabelFromWeek,
  money,
  pct,
  formatPods,
  WEEKS_PER_MONTH,
} from "../game/sim";
import { getPostTrainingEstimate } from "../game/systems/postTraining";
import { DataTierId, GameState, ModelGoalId, PostTrainingConfig, RoleId, UpgradeId } from "../game/types";
import { Badge, Button, EmptyState, Panel, Tone } from "../components/ui";

const BASE_MEMORY = { small: 8, medium: 16, large: 32, frontier: 64 } as const;
const BASE_PARAMS = { small: 8, medium: 22, large: 56, frontier: 120 } as const;
const BASE_CONTEXT = { small: 8, medium: 16, large: 32, frontier: 64 } as const;
const PARAMETER_STEP = { small: 2, medium: 5, large: 12, frontier: 24 } as const;

const TH = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681] whitespace-nowrap";
const TD = "px-3 py-2.5 align-top text-sm text-[#e6edf3]";
const TR = "border-t border-[#21262d]";
const FIELD_ROW = "flex items-center justify-between gap-4 border-b border-[#161b22] py-2.5 last:border-0";
const INPUT_CLS = "rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] w-full";
const SELECT_CLS = "rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] w-full disabled:cursor-not-allowed disabled:opacity-50";
const SECTION_LABEL = "mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]";

type LabModel = GameState["models"][number] & {
  deprecated?: boolean;
  deprecationStartWeek?: number | null;
  lifecycleStatus?: string;
  maintenanceCostPerMonth?: number;
  pendingSafetyRisk?: number;
  retired?: boolean;
  needsPostTrainingConfig?: boolean;
};

const DEFAULT_POST_TRAINING_CONFIG: PostTrainingConfig = {
  rlhf: true,
  domainFocus: null,
  redTeam: true,
  weeksAllocated: 7,
};

function getModelReleaseWeek(model: GameState["models"][number]) {
  return model.weekBuilt ?? (model.monthBuilt - 1) * WEEKS_PER_MONTH + 1;
}

function getModelLifecycleStatus(model: LabModel, postTrainingRuns: GameState["postTrainingRuns"]) {
  const explicitStatus = typeof model.lifecycleStatus === "string" ? model.lifecycleStatus.toLowerCase() : "";
  if (model.retired || explicitStatus === "retired") return "Retired";
  if (model.deprecated || explicitStatus === "deprecating") return "Deprecating";
  if (model.postTrainingComplete === false || postTrainingRuns.some((run) => run.modelId === model.id)) return "Post-Training";
  return "Active";
}

function getLifecycleTone(status: string): Tone {
  if (status === "Active") return "good";
  if (status === "Post-Training") return "warning";
  if (status === "Deprecating") return "bad";
  return "default";
}

function getCapabilityDriftLabel(model: LabModel) {
  const internal = model.trueCapability ?? model.capability;
  const benchmark = model.demonstratedCapability ?? model.capability;
  const drift = model.capabilityDrift ?? internal - benchmark;
  if (Math.abs(drift) < 0.1) return "stable";
  return drift > 0 ? `+${drift.toFixed(1)} / wk` : `${drift.toFixed(1)} / wk`;
}

function getHeldModelsNeedingConfig(game: GameState) {
  const postTrainingRuns = game.postTrainingRuns ?? [];
  return game.models.filter((entry) => {
    const model = entry as LabModel;
    const hasRun = postTrainingRuns.some((run) => run.modelId === model.id);
    return !hasRun && (model.needsPostTrainingConfig === true || model.postTrainingComplete === false);
  });
}

export function LabScreen({
  game,
  preview,
  onHire,
  onFire,
  onHireCandidate,
  onFireEmployee,
  onTrainEngineers,
  onBuyData,
  onBuyUpgrade,
  onUpdateTrainingConfig,
  onBumpVersion,
  onLaunchRun,
  onStartPostTraining,
  onDeprecateModel,
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
    assignedResearchers: GameState["employees"];
    keyPersonRisk: number;
  };
  onHire: (role: RoleId, count: number) => void;
  onFire: (role: RoleId, count: number) => void;
  onHireCandidate: (candidateId: number) => void;
  onFireEmployee: (employeeId: number) => void;
  onTrainEngineers: () => void;
  onBuyData: (tier: DataTierId, units: number) => void;
  onBuyUpgrade: (key: UpgradeId) => void;
  onUpdateTrainingConfig: (patch: Partial<GameState["trainingConfig"]>) => void;
  onBumpVersion: () => void;
  onLaunchRun: () => void;
  onStartPostTraining: (modelId: number, config: PostTrainingConfig) => void;
  onDeprecateModel?: (modelId: number) => void;
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
  const [expandedModelId, setExpandedModelId] = useState<number | null>(null);
  const [postTrainingModelId, setPostTrainingModelId] = useState<number | null>(null);
  const [postTrainingConfig, setPostTrainingConfig] = useState<PostTrainingConfig>(DEFAULT_POST_TRAINING_CONFIG);
  const [confirmDeprecateModelId, setConfirmDeprecateModelId] = useState<number | null>(null);

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
  const researchEmployees = game.employees.filter((e) => e.active && e.departmentId === "research");
  const unassignedResearchEmployees = researchEmployees.filter(
    (e) => e.assignedRunId === null || game.trainingConfig.assignedResearcherIds.includes(e.id),
  );
  const previewTotalWeeks = Math.ceil(preview.totalMonths * WEEKS_PER_MONTH);
  const postTrainingRuns = game.postTrainingRuns ?? [];
  const heldModelsNeedingConfig = getHeldModelsNeedingConfig(game);
  const modalModel =
    (postTrainingModelId !== null ? game.models.find((model) => model.id === postTrainingModelId) : null) ??
    heldModelsNeedingConfig[0] ??
    null;
  const postTrainingEstimate = getPostTrainingEstimate(postTrainingConfig);
  const confirmDeprecateModel = confirmDeprecateModelId !== null
    ? game.models.find((model) => model.id === confirmDeprecateModelId) ?? null
    : null;

  return (
    <>
    <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">

      {/* ── LEFT COLUMN ── */}
      <div className="space-y-5">

        {/* Talent Pool */}
        <Panel title="Talent Pool">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161b22]">
                  <th className={TH}>Role</th>
                  <th className={TH}>Count</th>
                  <th className={TH}>Monthly Cost</th>
                  <th className={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(ROLE_LABELS) as RoleId[]).map((role) => (
                  <tr key={role} className={TR}>
                    <td className={TD}>
                      <div className="font-medium text-[#e6edf3]">{ROLE_LABELS[role]}</div>
                      {role === "engineers" ? (
                        <div className="mt-1 space-y-0.5 text-xs text-[#8b949e]">
                          <div>L{game.engineerTrainingLevel} reliability training</div>
                          <div>Risk −{pct(getEngineerFailureRiskReduction(game))} / ×{getEngineerTrainingMultiplier(game.engineerTrainingLevel).toFixed(2)}</div>
                          <div className="text-[#484f58]">Train cost {money(engineerTrainingCostRange.min)}–{money(engineerTrainingCostRange.max)}</div>
                        </div>
                      ) : null}
                    </td>
                    <td className={TD}>
                      <span className="font-mono text-lg font-semibold text-[#e6edf3]">{game.headcount[role]}</span>
                    </td>
                    <td className={TD + " font-mono text-[#8b949e]"}>{money(SALARIES[role])}</td>
                    <td className={TD}>
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
                          className="w-14 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-center text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
                        />
                        <Button onClick={() => onHire(role, Math.max(1, parseInt(hireAmounts[role], 10) || 1))} variant="secondary">
                          Hire
                        </Button>
                        <Button onClick={() => onFire(role, Math.max(1, parseInt(hireAmounts[role], 10) || 1))} variant="ghost" disabled={game.headcount[role] <= 0}>
                          Fire
                        </Button>
                        {role === "engineers" ? (
                          <Button onClick={onTrainEngineers} variant="ghost" disabled={engineerTrainingDisabled}>
                            Train
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Leadership Bench */}
        <Panel title="Leadership Bench">
          <div className={SECTION_LABEL}>Active Staff</div>
          <div className="overflow-x-auto rounded-md border border-[#30363d]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161b22]">
                  <th className={TH}>Name / Role</th>
                  <th className={TH}>Skill / Lead</th>
                  <th className={TH}>Burnout</th>
                  <th className={TH}>Run</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {game.employees.filter((e) => e.active).map((employee) => (
                  <tr key={employee.id} className={TR}>
                    <td className={TD}>
                      <div className="font-medium text-[#e6edf3]">{employee.name}</div>
                      <div className="text-xs text-[#8b949e]">
                        {employee.title} · {DEPARTMENT_LABELS[employee.departmentId]}
                        {employee.specialty ? ` · ${RESEARCH_SPECIALTY_LABELS[employee.specialty]}` : ""}
                      </div>
                      <div className="mt-0.5 text-xs text-[#484f58]">{money(employee.salary)} / yr</div>
                    </td>
                    <td className={TD + " font-mono text-[#8b949e]"}>{employee.skill} / {employee.leadership}</td>
                    <td className={TD}>
                      <span className={`font-mono text-xs ${employee.burnout < 40 ? "text-[#3fb950]" : employee.burnout < 65 ? "text-[#d29922]" : "text-[#f85149]"}`}>
                        {employee.burnout}
                      </span>
                    </td>
                    <td className={TD}>
                      {employee.assignedRunId ? (
                        <Badge tone="warning">#{employee.assignedRunId}</Badge>
                      ) : (
                        <span className="text-xs text-[#484f58]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button onClick={() => onFireEmployee(employee.id)} variant="ghost">Fire</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={SECTION_LABEL + " mt-5"}>Hiring Market</div>
          <div className="overflow-x-auto rounded-md border border-[#30363d]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161b22]">
                  <th className={TH}>Candidate / Role</th>
                  <th className={TH}>Skill / Lead</th>
                  <th className={TH}>Salary</th>
                  <th className={TH}>Signing</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {game.hiringMarket.map((candidate) => (
                  <tr key={candidate.id} className={TR}>
                    <td className={TD}>
                      <div className="font-medium text-[#e6edf3]">{candidate.name}</div>
                      <div className="text-xs text-[#8b949e]">
                        {candidate.title} · {DEPARTMENT_LABELS[candidate.departmentId]}
                        {candidate.specialty ? ` · ${RESEARCH_SPECIALTY_LABELS[candidate.specialty]}` : ""}
                      </div>
                    </td>
                    <td className={TD + " font-mono text-[#8b949e]"}>{candidate.skill} / {candidate.leadership}</td>
                    <td className={TD + " font-mono text-[#8b949e]"}>{money(candidate.salary)}</td>
                    <td className={TD + " font-mono text-[#8b949e]"}>{money(candidate.signingCost)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button onClick={() => onHireCandidate(candidate.id)} variant="secondary" disabled={game.cash < candidate.signingCost}>
                        Hire
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Data Market */}
        <Panel title="Data Market">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161b22]">
                  <th className={TH}>Source</th>
                  <th className={TH}>Tag</th>
                  <th className={TH}>Owned</th>
                  <th className={TH}>Unit Cost</th>
                  <th className={TH}>Purchase</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(DATA_TIERS).map((tier) => {
                  const unavailable = tier.key === "synthesized" && game.models.length === 0;
                  const selectedUnits = Math.max(1, Math.round(Number(dataPurchaseUnits[tier.key]) || 1));
                  const selectedCost = Math.round(tier.cost * selectedUnits);
                  return (
                    <tr key={tier.key} className={TR}>
                      <td className={TD}>
                        <div className="font-medium text-[#e6edf3]">{tier.name}</div>
                      </td>
                      <td className={TD + " text-[#8b949e]"}>
                        {tier.key === "licensed" ? "Exp. / Clean" : tier.key === "synthesized" ? "Prior Model" : tier.tag}
                      </td>
                      <td className={TD}>
                        <span className="font-mono">{game.dataInventory[tier.key]}</span>
                        <span className="text-xs text-[#484f58]"> units</span>
                      </td>
                      <td className={TD + " font-mono text-[#8b949e]"}>{money(tier.cost)}</td>
                      <td className={TD}>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={dataPurchaseUnits[tier.key]}
                            onChange={(e) => setDataPurchaseUnits((cur) => ({ ...cur, [tier.key]: e.target.value }))}
                            disabled={unavailable}
                            className="w-16 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-center text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <Button onClick={() => onBuyData(tier.key, selectedUnits)} variant="secondary" disabled={unavailable || game.cash < selectedCost}>
                            {unavailable ? "Locked" : `Buy ×${selectedUnits}`}
                          </Button>
                          <span className="font-mono text-xs text-[#484f58]">{money(selectedCost)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Upgrade Paths */}
        <Panel title="Upgrade Paths">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161b22]">
                  <th className={TH}>Upgrade</th>
                  <th className={TH}>Level</th>
                  <th className={TH}>Next Cost</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {Object.values(UPGRADES).map((upgrade) => {
                  const level = game.upgrades[upgrade.key];
                  const nextCost = getUpgradeCost(upgrade.key, level);
                  return (
                    <tr key={upgrade.key} className={TR}>
                      <td className={TD}>
                        <div className="font-medium text-[#e6edf3]">{upgrade.name}</div>
                        <div className="text-xs text-[#8b949e]">{upgrade.description}</div>
                      </td>
                      <td className={TD}>
                        <span className="font-mono text-[#e6edf3]">L{level}</span>
                      </td>
                      <td className={TD + " font-mono text-[#8b949e]"}>{money(nextCost)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button onClick={() => onBuyUpgrade(upgrade.key)} variant="secondary" disabled={game.cash < nextCost}>
                          Upgrade
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="space-y-5">

        {/* Training Run Console */}
        <Panel title="Training Run Console">

          {/* Run type toggle */}
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">Run Type</span>
            <div className="flex gap-1.5">
              <Button onClick={() => onUpdateTrainingConfig({ mode: "new" })} variant={game.trainingConfig.mode === "new" ? "secondary" : "ghost"}>
                New
              </Button>
              <Button onClick={() => onUpdateTrainingConfig({ mode: "upgrade" })} variant={upgradeMode ? "secondary" : "ghost"} disabled={!hasBaseModels}>
                Upgrade
              </Button>
              <Button onClick={() => onUpdateTrainingConfig({ mode: "branch" })} variant={branchMode ? "secondary" : "ghost"} disabled={!hasBaseModels}>
                Branch
              </Button>
            </div>
          </div>

          {/* Base model selector */}
          {derivedMode && (
            hasBaseModels ? (
              <>
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Base Model</span>
                  <select
                    value={game.trainingConfig.baseModelId ?? ""}
                    onChange={(e) => onUpdateTrainingConfig({ baseModelId: e.target.value ? Number(e.target.value) : null })}
                    className="w-56 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
                  >
                    {game.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        #{model.id} {model.name} v{formatVersion(model.version)} cap={model.capability}
                      </option>
                    ))}
                  </select>
                </div>
                {baseModel && (
                  <div className="my-1 rounded border border-[#30363d] bg-[#161b22] px-3 py-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
                      {branchMode ? "Branch Architecture" : "Inherited Architecture"} — {MODEL_SIZES[baseModel.sizeKey].name}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="good">v{formatVersion(baseModel.version)}</Badge>
                      <Badge tone="default">{formatBigMemory(baseModel.memorySize)}</Badge>
                      <Badge tone="warning">{formatBigParams(baseModel.parameterScale)} params</Badge>
                      <Badge tone="default">{formatBigContext(baseModel.contextWindow)} ctx</Badge>
                      <Badge tone="default">{baseModel.trainingDataUnits} data units</Badge>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState title="No base models yet" body="Ship at least one model before upgrading or branching." />
            )
          )}

          {/* Codename */}
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">
              {branchMode ? "Branch Name" : upgradeMode ? "Upgrade Name" : "Codename"}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={game.trainingConfig.name}
                onChange={(e) => onUpdateTrainingConfig({ name: e.target.value })}
                className="w-40 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
              />
              <Button onClick={onBumpVersion} variant="ghost" disabled={!derivedMode}>+0.1</Button>
            </div>
          </div>

          {/* Target version */}
          {derivedMode && (
            <div className={FIELD_ROW}>
              <span className="text-sm text-[#8b949e]">Target Version</span>
              <input
                type="number"
                min={minimumUpgradeVersion}
                step={0.001}
                value={game.trainingConfig.targetVersion}
                onChange={(e) => onUpdateTrainingConfig({ targetVersion: Math.max(minimumUpgradeVersion, Number(e.target.value) || 1) })}
                className="w-28 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-right font-mono text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
              />
            </div>
          )}

          {/* Size & data tier */}
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">Model Size</span>
            <select value={game.trainingConfig.size} onChange={(e) => onUpdateTrainingConfig({ size: e.target.value as GameState["trainingConfig"]["size"] })} disabled={derivedMode} className="w-36 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] disabled:cursor-not-allowed disabled:opacity-50">
              {Object.values(MODEL_SIZES).map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">Data Tier</span>
            <select value={game.trainingConfig.dataTier} onChange={(e) => onUpdateTrainingConfig({ dataTier: e.target.value as DataTierId })} className="w-36 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]">
              {Object.values(DATA_TIERS).map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </div>

          {/* Training data volume */}
          <div className="border-b border-[#161b22] py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-[#8b949e]">Training Data Volume</span>
              <span className="font-mono text-xs text-[#e6edf3]">{game.trainingConfig.trainingDataUnits} / {maxTrainingDataUnits} units</span>
            </div>
            <input type="range" min={1} max={maxTrainingDataUnits} step={1} value={game.trainingConfig.trainingDataUnits} onChange={(e) => onUpdateTrainingConfig({ trainingDataUnits: Number(e.target.value) })} className="w-full" />
          </div>

          {/* Architecture — compact 3-column grid */}
          <div className="border-b border-[#161b22] py-3">
            <div className={SECTION_LABEL}>Architecture</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Memory", base: baseMemorySize, max: maxMemorySize, step: 8, key: "targetMemorySize" as const, fmt: formatBigMemory, val: game.trainingConfig.targetMemorySize },
                { label: "Parameters", base: baseParameterScale, max: maxParameterScale, step: PARAMETER_STEP[sizeKey], key: "targetParameterScale" as const, fmt: formatBigParams, val: game.trainingConfig.targetParameterScale },
                { label: "Context", base: baseContextWindow, max: maxContextWindow, step: 8, key: "targetContextWindow" as const, fmt: formatBigContext, val: game.trainingConfig.targetContextWindow },
              ].map(({ label, base, max, step, key, fmt, val }) => (
                <div key={key}>
                  <div className="mb-1 text-xs text-[#8b949e]">{label}</div>
                  <div className="mb-1 font-mono text-xs text-[#484f58]">{fmt(base)} → {fmt(val)}</div>
                  <input
                    type="number"
                    min={base}
                    max={max}
                    step={step}
                    value={val}
                    onChange={(e) => onUpdateTrainingConfig({ [key]: Math.max(base, Math.min(max, Number(e.target.value) || base)) })}
                    className="w-full rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-right font-mono text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
                  />
                  <div className="mt-0.5 text-right text-[10px] text-[#484f58]">max {fmt(max)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Goals — table */}
          <div className="border-b border-[#161b22] py-3">
            <div className={SECTION_LABEL}>Model Goals</div>
            <div className="overflow-hidden rounded-md border border-[#30363d]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#161b22]">
                    <th className={TH}>Goal</th>
                    <th className={TH + " hidden lg:table-cell"}>Summary</th>
                    <th className={TH + " w-20 text-right"}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(MODEL_GOALS).map((goal) => {
                    const w = game.trainingConfig.goals[goal.id];
                    return (
                      <tr key={goal.id} className={`${TR} ${w > 1 ? "bg-[#0d1a2e]/60" : ""}`}>
                        <td className={TD}>
                          <span className={w > 1 ? "font-medium text-[#58a6ff]" : "text-[#c9d1d9]"}>{goal.name}</span>
                        </td>
                        <td className={TD + " hidden text-xs text-[#8b949e] lg:table-cell"}>{goal.summary}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={w}
                            onChange={(e) => onUpdateTrainingConfig({ goals: { ...game.trainingConfig.goals, [goal.id]: Math.max(1, Number(e.target.value) || 1) } })}
                            className="w-16 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-right font-mono text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {activeGoalEntries.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeGoalEntries.map(([goalId, value]) => (
                  <Badge key={goalId} tone="default">
                    {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} ×{value}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Reliability — table with sliders */}
          <div className="border-b border-[#161b22] py-3">
            <div className={SECTION_LABEL}>Model Reliability</div>
            <div className="overflow-hidden rounded-md border border-[#30363d]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#161b22]">
                    <th className={TH + " w-32"}>Tier</th>
                    <th className={TH}>Slider</th>
                    <th className={TH + " w-16 text-right"}>Value</th>
                    <th className={TH + " w-24 text-right"}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(RELIABILITY_TIERS).map((tier) => {
                    const val = game.trainingConfig.reliability[tier.id] || 0;
                    const estimatedCost = val > 0 ? tier.baseConstantMillions * Math.pow(1 / (1 - val), tier.exponent) : 0;
                    return (
                      <tr key={tier.id} className={TR}>
                        <td className={TD + " font-medium text-[#c9d1d9]"}>{tier.name}</td>
                        <td className="px-3 py-2">
                          <input
                            type="range"
                            min="0"
                            max="0.99"
                            step="0.01"
                            value={val}
                            onChange={(e) => onUpdateTrainingConfig({ reliability: { ...game.trainingConfig.reliability, [tier.id]: Number(e.target.value) } })}
                            className="w-full"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm text-[#e6edf3]">{val.toFixed(2)}</td>
                        <td className={`px-3 py-2 text-right font-mono text-sm ${estimatedCost > 0 ? "text-[#d29922]" : "text-[#484f58]"}`}>
                          {estimatedCost > 0 ? `+${money(estimatedCost * 1_000_000)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assigned Researchers */}
          <div className="border-b border-[#161b22] py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className={SECTION_LABEL + " mb-0"}>Assigned Researchers</span>
              <Badge tone={preview.keyPersonRisk < 0.08 ? "good" : preview.keyPersonRisk < 0.16 ? "warning" : "bad"}>
                Key Risk {pct(preview.keyPersonRisk)}
              </Badge>
            </div>
            {unassignedResearchEmployees.length === 0 ? (
              <div className="text-sm text-[#484f58]">No unassigned research leaders available.</div>
            ) : (
              <div className="overflow-hidden rounded-md border border-[#30363d]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#161b22]">
                      <th className={TH}>Researcher</th>
                      <th className={TH}>Skill / Burnout</th>
                      <th className={TH + " w-24 text-right"}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {unassignedResearchEmployees.map((employee) => {
                      const selected = game.trainingConfig.assignedResearcherIds.includes(employee.id);
                      return (
                        <tr
                          key={employee.id}
                          className={`${TR} cursor-pointer ${selected ? "bg-[#0d1a2e]/60" : "hover:bg-[#161b22]/60"}`}
                          onClick={() =>
                            onUpdateTrainingConfig({
                              assignedResearcherIds: selected
                                ? game.trainingConfig.assignedResearcherIds.filter((id) => id !== employee.id)
                                : [...game.trainingConfig.assignedResearcherIds, employee.id],
                            })
                          }
                        >
                          <td className={TD}>
                            <div className={`font-medium ${selected ? "text-[#58a6ff]" : "text-[#e6edf3]"}`}>{employee.name}</div>
                            <div className="text-xs text-[#8b949e]">
                              {employee.title}{employee.specialty ? ` · ${RESEARCH_SPECIALTY_LABELS[employee.specialty]}` : ""}
                            </div>
                          </td>
                          <td className={TD + " font-mono text-[#8b949e]"}>
                            {employee.skill} / {employee.burnout}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Badge tone={selected ? "good" : "default"}>{selected ? "Assigned" : "Available"}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Compute need */}
          <div className="border-b border-[#161b22] py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-[#8b949e]">Compute Need</span>
              <span className="font-mono text-xs text-[#e6edf3]">{formatPods(preview.computeNeed)} pods</span>
            </div>
            <input
              type="range"
              min={MODEL_SIZES[game.trainingConfig.size].minCompute}
              max={MODEL_SIZES[game.trainingConfig.size].maxCompute}
              value={game.trainingConfig.computeNeed}
              onChange={(e) => onUpdateTrainingConfig({ computeNeed: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Forecasts — two compact tables */}
          <div className="grid gap-3 py-3 md:grid-cols-2">
            <div>
              <div className={SECTION_LABEL}>Model Forecasts</div>
              <div className="overflow-hidden rounded-md border border-[#30363d]">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      { label: "Duration", value: `${previewTotalWeeks} wk` },
                      { label: "Capability", value: String(preview.capability) },
                      { label: "Inference Cost", value: String(preview.inferenceCost) },
                      { label: "Trust", value: String(preview.trust) },
                      { label: "Failure Risk", value: pct(preview.failureRisk), bad: preview.failureRisk > 0.2 },
                    ].map(({ label, value, bad }) => (
                      <tr key={label} className={TR}>
                        <td className="px-3 py-2 text-xs text-[#8b949e]">{label}</td>
                        <td className={`px-3 py-2 text-right font-mono text-xs ${bad ? "text-[#f85149]" : "text-[#e6edf3]"}`}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className={SECTION_LABEL}>Resource Impact</div>
              <div className="overflow-hidden rounded-md border border-[#30363d]">
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      { label: "Research Lift", value: `+${preview.researcherContribution}` },
                      { label: "Engineer Risk Guard", value: `−${(preview.engineerRiskReduction * 100).toFixed(1)}%` },
                      { label: "Engineer Time Reduction", value: `−${Math.ceil(preview.engineerDurationReduction * WEEKS_PER_MONTH)} wk` },
                      { label: "Data Lift", value: `+${preview.dataContribution}` },
                      { label: "Target Memory", value: `${preview.targetMemorySize} GB` },
                      { label: "Target Params", value: `${preview.targetParameterScale.toFixed(1)}B` },
                      { label: "Target Context", value: `${preview.targetContextWindow}K` },
                      { label: "Equivalent Cost", value: money(preview.projectedEquivalentCost) },
                    ].map(({ label, value }) => (
                      <tr key={label} className={TR}>
                        <td className="px-3 py-2 text-xs text-[#8b949e]">{label}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-[#e6edf3]">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Badges & launch */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge tone={previewMarket.tone}>{previewMarket.label}</Badge>
            <Badge tone="default">Data {preview.trainingDataUnits} / {game.dataInventory[game.trainingConfig.dataTier]} units</Badge>
            <Badge tone={game.cash >= upfrontDevelopmentCost ? "good" : "bad"}>Launch {money(upfrontDevelopmentCost)}</Badge>
            <Badge tone={game.activeRuns.length >= 2 ? "warning" : "default"}>{game.activeRuns.length} active run(s)</Badge>
            <div className="ml-auto">
              <Button onClick={onLaunchRun} disabled={launchDisabled} variant="good">
                {branchMode ? "Launch Branch" : upgradeMode ? "Launch Upgrade" : "Launch Run"} ▶
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Post-Training Runs">
          {postTrainingRuns.length === 0 ? (
            <EmptyState title="No post-training work queued" body="Completed held models will appear here after you choose alignment, domain, and red-team scope." />
          ) : (
            <div className="space-y-3">
              {postTrainingRuns.map((run) => {
                const model = game.models.find((entry) => entry.id === run.modelId);
                const progress = run.weeksTotal > 0 ? Math.min(100, (run.weeksElapsed / run.weeksTotal) * 100) : 0;
                return (
                  <div key={run.id} className="rounded-md border border-[#30363d] bg-[#161b22] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-[#e6edf3]">
                          {model ? `${model.name} v${formatVersion(model.version)}` : `Model #${run.modelId}`}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge tone={run.config.rlhf ? "good" : "bad"}>{run.config.rlhf ? "RLHF" : "No RLHF"}</Badge>
                          <Badge tone={run.config.domainFocus ? "warning" : "default"}>
                            {run.config.domainFocus ? MODEL_GOALS[run.config.domainFocus].name : "No domain focus"}
                          </Badge>
                          <Badge tone={run.config.redTeam ? "good" : "bad"}>{run.config.redTeam ? "Red-team" : "No red-team"}</Badge>
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs text-[#8b949e]">
                        {run.weeksElapsed} / {run.weeksTotal} wk
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#21262d]">
                      <div className="h-1.5 rounded-full bg-[#d29922]" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#8b949e]">
                      <span>Trust {run.projectedTrustDelta >= 0 ? "+" : ""}{run.projectedTrustDelta}</span>
                      {run.projectedGoalBoost ? (
                        <span>{MODEL_GOALS[run.projectedGoalBoost.goalId].name} +{run.projectedGoalBoost.delta}</span>
                      ) : null}
                      {run.projectedSafetyIncidentRisk > 0 ? (
                        <span className="text-[#f85149]">Safety risk +{pct(run.projectedSafetyIncidentRisk)}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Model Shelf */}
        <Panel title="Model Shelf">
          {game.models.length === 0 ? (
            <EmptyState title="No shipped models" body="Buy data, launch a run, and survive long enough to put something on the shelf." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#161b22]">
                    <th className={TH}>Model</th>
                    <th className={TH}>Release Week</th>
                    <th className={TH}>Lifecycle</th>
                    <th className={TH}>Eval</th>
                    <th className={TH}>Inference</th>
                    <th className={TH}>Specs</th>
                    <th className={TH}>Market</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {game.models.map((model) => {
                    const labModel = model as LabModel;
                    const parentModel = getModelById(game, model.baseModelId);
                    const marketPosition = getMarketComparison(model.capability, game.marketStandard);
                    const releaseWeek = getModelReleaseWeek(model);
                    const lifecycle = getModelLifecycleStatus(labModel, postTrainingRuns);
                    const expanded = expandedModelId === model.id;
                    const maintenanceCost = labModel.maintenanceCostPerMonth ?? 0;
                    const deployed = Object.values(game.products).some((product) => product.modelIds.includes(model.id));
                    const canDeprecate = lifecycle === "Active" && deployed && Boolean(onDeprecateModel);
                    return (
                      <Fragment key={model.id}>
                      <tr className={`${TR} cursor-pointer hover:bg-[#161b22]/60`} onClick={() => setExpandedModelId(expanded ? null : model.id)}>
                        <td className={TD}>
                          <div className="font-medium text-[#e6edf3]">#{model.id} {model.name}</div>
                          <div className="text-xs text-[#8b949e]">v{formatVersion(model.version)} · {MODEL_SIZES[model.sizeKey].name}</div>
                          <div className="text-xs text-[#484f58]">
                            {parentModel ? `↑ from ${parentModel.name} v${formatVersion(parentModel.version)}` : `Foundation · Family #${model.familyId}`}
                          </div>
                        </td>
                        <td className={TD + " text-[#8b949e] whitespace-nowrap"}>
                          W{releaseWeek} / {monthLabelFromWeek(releaseWeek)}
                        </td>
                        <td className={TD}>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone={getLifecycleTone(lifecycle)}>{lifecycle}</Badge>
                            {maintenanceCost > 0 ? <Badge tone={deployed ? "warning" : "default"}>{money(maintenanceCost)} / mo</Badge> : null}
                          </div>
                        </td>
                        <td className={TD}>
                          <div className="font-mono text-[#3fb950]">{model.demonstratedCapability ?? model.capability}</div>
                          <div className="mt-0.5 text-xs text-[#484f58]">drift {getCapabilityDriftLabel(labModel)}</div>
                        </td>
                        <td className={TD}>
                          <span className="font-mono text-[#d29922]">{model.inferenceCost}</span>
                        </td>
                        <td className={TD}>
                          <div className="whitespace-nowrap font-mono text-xs text-[#8b949e]">
                            {model.memorySize}GB · {model.parameterScale}B · {model.contextWindow}K ctx
                          </div>
                          <div className="mt-0.5 font-mono text-xs text-[#484f58]">{model.trainingDataUnits} data units</div>
                        </td>
                        <td className={TD}>
                          <Badge tone={marketPosition.tone}>{marketPosition.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            disabled={!canDeprecate}
                            onClick={() => {
                              if (canDeprecate) setConfirmDeprecateModelId(model.id);
                            }}
                          >
                            Deprecate
                          </Button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-[#21262d] bg-[#161b22]/35">
                          <td colSpan={8} className="px-3 py-3">
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="rounded border border-[#30363d] bg-[#0d1117] p-3">
                                <div className={SECTION_LABEL}>Internal Evaluation Score</div>
                                <div className="font-mono text-xl text-[#e6edf3]">{labModel.trueCapability ?? model.capability}</div>
                              </div>
                              <div className="rounded border border-[#30363d] bg-[#0d1117] p-3">
                                <div className={SECTION_LABEL}>Benchmark Score</div>
                                <div className="font-mono text-xl text-[#3fb950]">{labModel.demonstratedCapability ?? model.capability}</div>
                              </div>
                              <div className="rounded border border-[#30363d] bg-[#0d1117] p-3">
                                <div className={SECTION_LABEL}>Market Trust</div>
                                <div className="font-mono text-xl text-[#d29922]">{(labModel.marketTrust ?? model.trust).toFixed(0)}</div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge tone={deployed ? "good" : "default"}>{deployed ? "Deployed" : "Not deployed"}</Badge>
                              <Badge tone="default">Model trust {model.trust}</Badge>
                              {labModel.pendingSafetyRisk && labModel.pendingSafetyRisk > 0 ? (
                                <Badge tone="bad">Safety risk {pct(labModel.pendingSafetyRisk)}</Badge>
                              ) : null}
                              {lifecycle === "Post-Training" && !postTrainingRuns.some((run) => run.modelId === model.id) ? (
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setPostTrainingModelId(model.id);
                                    setPostTrainingConfig(DEFAULT_POST_TRAINING_CONFIG);
                                  }}
                                >
                                  Configure
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

      </div>
    </div>

    {modalModel ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]/85 px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-xl overflow-hidden rounded-md border border-[#d29922]/30 bg-[#161b22] shadow-2xl shadow-black/60">
          <div className="border-b border-[#30363d] bg-[#1f1a0d] px-5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#d29922]">Post-Training Configuration</span>
          </div>
          <div className="p-5">
            <div className="text-xl font-semibold text-[#e6edf3]">{modalModel.name} v{formatVersion(modalModel.version)}</div>
            <div className="mt-1 text-sm text-[#8b949e]">Hold launch until alignment, domain tuning, and safety eval choices are set.</div>

            <div className="mt-5 space-y-3">
              <label className={FIELD_ROW}>
                <span className="text-sm text-[#8b949e]">RLHF / alignment pass</span>
                <input
                  type="checkbox"
                  checked={postTrainingConfig.rlhf}
                  onChange={(event) => setPostTrainingConfig((current) => ({ ...current, rlhf: event.target.checked }))}
                />
              </label>

              <div className={FIELD_ROW}>
                <span className="text-sm text-[#8b949e]">Domain fine-tune</span>
                <select
                  value={postTrainingConfig.domainFocus ?? ""}
                  onChange={(event) => setPostTrainingConfig((current) => ({ ...current, domainFocus: event.target.value ? event.target.value as ModelGoalId : null }))}
                  className="w-52 rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
                >
                  <option value="">None</option>
                  {Object.values(MODEL_GOALS).map((goal) => (
                    <option key={goal.id} value={goal.id}>{goal.name}</option>
                  ))}
                </select>
              </div>

              <label className={FIELD_ROW}>
                <span className="text-sm text-[#8b949e]">Red-team evaluation</span>
                <input
                  type="checkbox"
                  checked={postTrainingConfig.redTeam}
                  onChange={(event) => setPostTrainingConfig((current) => ({ ...current, redTeam: event.target.checked }))}
                />
              </label>

              <div className="border-b border-[#161b22] py-2.5">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-[#8b949e]">Weeks allocated</span>
                  <span className="font-mono text-xs text-[#e6edf3]">{postTrainingConfig.weeksAllocated} wk</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={postTrainingConfig.weeksAllocated}
                  onChange={(event) => setPostTrainingConfig((current) => ({ ...current, weeksAllocated: Number(event.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-2 rounded-md border border-[#30363d] bg-[#0d1117] p-3 text-sm md:grid-cols-3">
              <div>
                <div className="text-xs text-[#484f58]">Duration</div>
                <div className="font-mono text-[#e6edf3]">{postTrainingEstimate.weeksTotal} wk</div>
              </div>
              <div>
                <div className="text-xs text-[#484f58]">Trust</div>
                <div className={`font-mono ${postTrainingEstimate.trustDelta >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                  {postTrainingEstimate.trustDelta >= 0 ? "+" : ""}{postTrainingEstimate.trustDelta}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#484f58]">Safety risk</div>
                <div className={`font-mono ${postTrainingEstimate.safetyRisk > 0 ? "text-[#f85149]" : "text-[#3fb950]"}`}>
                  {pct(postTrainingEstimate.safetyRisk)}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="good"
                onClick={() => {
                  onStartPostTraining(modalModel.id, postTrainingConfig);
                  setPostTrainingModelId(null);
                  setPostTrainingConfig(DEFAULT_POST_TRAINING_CONFIG);
                }}
              >
                Start Post-Training
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null}

    {confirmDeprecateModel ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]/85 px-4 py-6 backdrop-blur-sm">
        <div className="w-full max-w-md overflow-hidden rounded-md border border-[#f85149]/30 bg-[#161b22] shadow-2xl shadow-black/60">
          <div className="border-b border-[#30363d] bg-[#220d0d] px-5 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f85149]">Deprecate Model</span>
          </div>
          <div className="p-5">
            <div className="text-lg font-semibold text-[#e6edf3]">{confirmDeprecateModel.name}</div>
            <div className="mt-2 text-sm leading-6 text-[#8b949e]">
              Deprecating stops new acquisition and begins migration away from this model.
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDeprecateModelId(null)}>Cancel</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  onDeprecateModel?.(confirmDeprecateModel.id);
                  setConfirmDeprecateModelId(null);
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
