import { useState } from "react";

import { COMPETITOR_BEHAVIORS, COMPETITOR_COMPANIES, COMPETITOR_STRATEGIES, GLOBAL_COHORT_IDS, MODEL_GOALS, RELIABILITY_TIERS } from "../game/defs";
import { CohortDef, CohortId, CompetitorBehaviorId, CompetitorStrategyId, GameState, ModelGoalId, ReliabilityTierId } from "../game/types";
import { Button, Panel } from "../components/ui";

export function AdminScreen({
  game,
  onAddCapital,
  onAddCompetitorCapital,
  onUpdateCompetitorAdmin,
  onUpdateGoalEconomics,
  onUpdateCohortDef,
  onUpdateMonthlyUserMultiplier,
}: {
  game: GameState;
  onAddCapital: (millions: number) => void;
  onAddCompetitorCapital: (competitorId: string, millions: number) => void;
  onUpdateCompetitorAdmin: (
    competitorId: string,
    patch: Partial<GameState["competitorAdmin"][string]>,
  ) => void;
  onUpdateGoalEconomics: (
    goalId: ModelGoalId,
    field: "fixedCostMillions" | "percentOfBaseCost",
    value: number,
  ) => void;
  onUpdateCohortDef: (cohortId: CohortId, patch: Partial<CohortDef>) => void;
  onUpdateMonthlyUserMultiplier: (value: number) => void;
}) {
  const [capitalMillions, setCapitalMillions] = useState(10);
  const [capitalInput, setCapitalInput] = useState<Record<string, string>>({});
  const [cohortTab, setCohortTab] = useState<"Consumer" | "Business">("Consumer");

  const activeCohorts = GLOBAL_COHORT_IDS.map((id) => game.globalCohorts[id] as CohortDef).filter(
    (cohort) => cohort.category === cohortTab
  );

  return (
    <div className="space-y-6">
      <Panel title="Admin Controls" subtitle="These controls affect both your company and the competitor benchmark generator.">
        <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="text-sm font-medium text-slate-300">Capital Adjustment</div>
              <div className="mt-2 text-sm text-slate-500">Add a custom amount to company cash in millions.</div>
              <label className="mt-4 block text-sm">
                <div className="mb-1 text-slate-400">Amount ($M)</div>
                <input
                  type="number"
                  step={1}
                  value={capitalMillions}
                  onChange={(event) => setCapitalMillions(Number(event.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                />
              </label>
              <div className="mt-4">
                <Button onClick={() => onAddCapital(capitalMillions)} variant="primary">
                  Add Capital
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="text-sm font-medium text-slate-300">Monthly Users Multiplier</div>
              <div className="mt-2 text-sm text-slate-500">Scales monthly user and demand volume for the player and competitor revenue proxies.</div>
              <label className="mt-4 block text-sm">
                <div className="mb-1 text-slate-400">Multiplier</div>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  value={game.monthlyUserMultiplier}
                  onChange={(event) => onUpdateMonthlyUserMultiplier(Math.max(0.1, Number(event.target.value) || 1))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                />
              </label>
              <div className="mt-2 text-xs text-slate-500">1.0x is baseline.</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/45">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/85 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Goal</th>
                  <th className="px-4 py-3 text-left font-medium">Fixed Cost / Point ($M)</th>
                  <th className="px-4 py-3 text-left font-medium">% of Base Cost / Point</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(MODEL_GOALS) as ModelGoalId[]).map((goalId) => (
                  <tr key={goalId} className="border-t border-slate-800/80 text-slate-200">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-50">{MODEL_GOALS[goalId].name}</div>
                      <div className="mt-1 text-xs text-slate-500">{MODEL_GOALS[goalId].summary}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step={0.1}
                        value={game.goalEconomics[goalId].fixedCostMillions}
                        onChange={(event) =>
                          onUpdateGoalEconomics(goalId, "fixedCostMillions", Math.max(0, Number(event.target.value) || 0))
                        }
                        className="w-32 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step={0.1}
                        value={game.goalEconomics[goalId].percentOfBaseCost}
                        onChange={(event) =>
                          onUpdateGoalEconomics(goalId, "percentOfBaseCost", Math.max(0, Number(event.target.value) || 0))
                        }
                        className="w-32 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      <Panel title="Global Demographic Cohorts" subtitle="The deterministic market is driven by user demographics. Edit their population and what capabilities they prioritize when choosing a model.">
        <div className="mb-4 flex border-b border-slate-800">
          <button
            className={`px-4 py-2 font-medium ${cohortTab === "Consumer" ? "border-b-2 border-slate-200 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
            onClick={() => setCohortTab("Consumer")}
          >
            Consumer (Chatbots)
          </button>
          <button
            className={`px-4 py-2 font-medium ${cohortTab === "Business" ? "border-b-2 border-slate-200 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
            onClick={() => setCohortTab("Business")}
          >
            Business (APIs)
          </button>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {activeCohorts.map((cohort) => {
            return (
            <div key={cohort.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold text-slate-50">{cohort.name}</div>
              </div>
              <div className="grid gap-4 md:grid-cols-[1.5fr_2fr]">
                <div className="space-y-4">
                  <label className="block text-sm">
                    <div className="mb-1 text-slate-400">Total Population (Millions)</div>
                    <input
                      type="number"
                      step={0.1}
                      value={cohort.population / 1000000}
                      onChange={(e) => onUpdateCohortDef(cohort.id, { population: Math.max(0, (Number(e.target.value) || 0) * 1000000) })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                    />
                  </label>
                  <label className="block text-sm">
                    <div className="mb-1 text-slate-400">Price Sensitivity</div>
                    <input
                      type="number"
                      step={0.1}
                      value={cohort.priceSensitivity}
                      onChange={(e) => onUpdateCohortDef(cohort.id, { priceSensitivity: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                    />
                  </label>
                  <label className="block text-sm">
                    <div className="mb-1 text-slate-400">Base Capability Weight</div>
                    <input
                      type="number"
                      step={0.1}
                      value={cohort.baseCapabilityWeight}
                      onChange={(e) => onUpdateCohortDef(cohort.id, { baseCapabilityWeight: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                    />
                  </label>
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-2">Priority Weights</div>
                  <div className="grid gap-x-2 gap-y-1 grid-cols-2">
                    {(Object.keys(MODEL_GOALS) as ModelGoalId[]).map(goalId => (
                      <label key={`goal_${goalId}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-300">{MODEL_GOALS[goalId].name}</span>
                        <input
                          type="number"
                          step={0.1}
                          value={cohort.weights[goalId] ?? 0}
                          onChange={(e) => onUpdateCohortDef(cohort.id, { 
                            weights: { [goalId]: Math.max(0, Number(e.target.value) || 0) } 
                          })}
                          className="w-12 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-slate-100 outline-none text-right"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 mb-2 border-t border-slate-800 pt-2 text-sm text-slate-400">Reliability Demand</div>
                  <div className="grid gap-x-2 gap-y-1 grid-cols-2">
                    {(Object.keys(RELIABILITY_TIERS) as ReliabilityTierId[]).map(tierId => (
                      <label key={`rel_${tierId}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-300">{RELIABILITY_TIERS[tierId].name}</span>
                        <input
                          type="number"
                          step={0.1}
                          value={cohort.reliabilityWeights[tierId] ?? 0}
                          onChange={(e) => onUpdateCohortDef(cohort.id, { 
                            reliabilityWeights: { ...cohort.reliabilityWeights, [tierId]: Math.max(0, Number(e.target.value) || 0) } 
                          })}
                          className="w-12 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-slate-100 outline-none text-right"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )})}
        </div>
      </Panel>

      <Panel title="Competitor Controls" subtitle="Inject capital into specific companies and tune how aggressively they behave, what they prioritize, and how strong their generated models become.">
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/45">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/85 text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Capital Added ($M)</th>
                <th className="px-4 py-3 text-left font-medium">Inject Capital</th>
                <th className="px-4 py-3 text-left font-medium">Behavior</th>
                <th className="px-4 py-3 text-left font-medium">Strategy</th>
                <th className="px-4 py-3 text-left font-medium">Capability Multiplier</th>
                <th className="px-4 py-3 text-left font-medium">Goal Modifiers</th>
              </tr>
            </thead>
            <tbody>
              {COMPETITOR_COMPANIES.map((company) => {
                const admin = game.competitorAdmin[company.id];
                const pendingCapital = Number(capitalInput[company.id]) || 0;
                const capabilityMultiplier = admin.capabilityModifier > 0 ? admin.capabilityModifier : 1;
                return (
                  <tr key={company.id} className="border-t border-slate-800/80 text-slate-200">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-50">{company.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Added so far: {admin.capitalAddedMillions.toFixed(1)}M
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">{admin.capitalAddedMillions.toFixed(1)}M</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={1}
                          value={capitalInput[company.id] ?? ""}
                          onChange={(event) =>
                            setCapitalInput((current) => ({
                              ...current,
                              [company.id]: event.target.value,
                            }))
                          }
                          className="w-24 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                        />
                        <Button onClick={() => onAddCompetitorCapital(company.id, pendingCapital)} variant="secondary">
                          Add
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={admin.behavior}
                        onChange={(event) =>
                          onUpdateCompetitorAdmin(company.id, { behavior: event.target.value as CompetitorBehaviorId })
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                      >
                        {(Object.keys(COMPETITOR_BEHAVIORS) as CompetitorBehaviorId[]).map((behaviorId) => (
                          <option key={behaviorId} value={behaviorId}>
                            {COMPETITOR_BEHAVIORS[behaviorId].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={admin.strategy}
                        onChange={(event) =>
                          onUpdateCompetitorAdmin(company.id, { strategy: event.target.value as CompetitorStrategyId })
                        }
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                      >
                        {(Object.keys(COMPETITOR_STRATEGIES) as CompetitorStrategyId[]).map((strategyId) => (
                          <option key={strategyId} value={strategyId}>
                            {COMPETITOR_STRATEGIES[strategyId].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step={0.1}
                        min={0.1}
                        value={capabilityMultiplier}
                        onChange={(event) =>
                          onUpdateCompetitorAdmin(company.id, {
                            capabilityModifier: Math.max(0.1, Number(event.target.value) || 1),
                          })
                        }
                        className="w-28 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                      />
                      <div className="mt-1 text-xs text-slate-500">1.0x is baseline.</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid grid-cols-2 gap-2 min-w-[280px]">
                        {(Object.keys(MODEL_GOALS) as ModelGoalId[]).map((goalId) => (
                          <label key={goalId} className="flex items-center justify-between text-xs text-slate-400">
                            <span>{MODEL_GOALS[goalId].name}</span>
                            <input
                              type="number"
                              step={0.1}
                              min={0.1}
                              value={admin.goalModifiers?.[goalId] ?? 1.0}
                              onChange={(e) =>
                                onUpdateCompetitorAdmin(company.id, {
                                  goalModifiers: { [goalId]: Math.max(0.1, Number(e.target.value) || 1) },
                                })
                              }
                              className="w-14 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-100 outline-none text-right"
                            />
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
