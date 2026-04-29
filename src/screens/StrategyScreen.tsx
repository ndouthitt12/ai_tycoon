import { ARCHETYPES, BOARD_DIRECTIVES, DEPARTMENT_LABELS, RESEARCH_SPECIALTY_LABELS } from "../game/defs";
import { WEEKS_PER_MONTH, WEEKS_PER_QUARTER, getQuarterIndexFromWeek, getMarketingSpendMultiplier, money } from "../game/sim";
import { BoardDirectiveId, DepartmentId, GameState } from "../game/types";
import { Badge, Button, Meter, Panel } from "../components/ui";

const TH = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681] whitespace-nowrap";
const TD = "px-3 py-2.5 align-top text-sm text-[#e6edf3]";
const TR = "border-t border-[#21262d]";
const FIELD_ROW = "flex items-center justify-between gap-4 border-b border-[#161b22] py-2.5 last:border-0";

export function StrategyScreen({
  game,
  onUpdateMarketingBudget,
  onChooseBoardDirective,
  onHireCandidate,
  onFireEmployee,
}: {
  game: GameState;
  onUpdateMarketingBudget: (value: number) => void;
  onChooseBoardDirective: (directiveId: BoardDirectiveId) => void;
  onHireCandidate: (candidateId: number) => void;
  onFireEmployee: (employeeId: number) => void;
}) {
  const directiveWeeksRemaining = Math.max(0, Math.ceil(game.directiveWeeksRemaining ?? game.directiveTurnsRemaining * 4));
  const archetype = ARCHETYPES[game.archetype];
  const currentDirective = game.currentDirective ? BOARD_DIRECTIVES[game.currentDirective] : null;
  const currentWeek = typeof game.week === "number" && Number.isFinite(game.week) ? game.week : (game.turn - 1) * WEEKS_PER_MONTH + 1;
  const nextBoardReviewWeeks = WEEKS_PER_QUARTER - ((currentWeek - 1) % WEEKS_PER_QUARTER);
  const chatbotSpendMultiplier = getMarketingSpendMultiplier(game.marketingBudgetMillions, 1.0);
  const apiSpendMultiplier = getMarketingSpendMultiplier(game.marketingBudgetMillions, 3.0);

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">

      {/* ── LEFT COLUMN ── */}
      <div className="space-y-5">

        {/* Company Identity */}
        <Panel title="Company Identity">
          <div className="flex items-start justify-between gap-4 border-b border-[#21262d] pb-3">
            <div>
              <div className="text-base font-semibold text-[#e6edf3]">{archetype.name}</div>
              <div className="mt-1 text-sm text-[#8b949e]">{archetype.summary}</div>
            </div>
            <Badge tone="default">{archetype.winStyle}</Badge>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#21262d] pt-3">
            <div className="pr-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">Strengths</div>
              <div className="space-y-1.5">
                {archetype.strengths.map((item) => (
                  <div key={item} className="text-sm text-[#c9d1d9]">{item}</div>
                ))}
              </div>
            </div>
            <div className="pl-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">Weaknesses</div>
              <div className="space-y-1.5">
                {archetype.weaknesses.map((item) => (
                  <div key={item} className="text-sm text-[#c9d1d9]">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* Trust & Distribution — KPI cell row */}
        <Panel title="Trust & Distribution">
          <div className="grid grid-cols-3 divide-x divide-[#21262d]">
            <div className="pr-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">Company Trust</div>
              <div className={`mt-1.5 font-mono text-xl font-semibold ${game.trust >= 60 ? "text-[#3fb950]" : game.trust >= 45 ? "text-[#d29922]" : "text-[#f85149]"}`}>
                {game.trust.toFixed(1)}
              </div>
              <div className={`mt-1 font-mono text-xs ${game.lastMonth.trustDelta >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                {game.lastMonth.trustDelta >= 0 ? "+" : ""}{game.lastMonth.trustDelta} completed month
              </div>
              <div className="mt-2">
                <Meter label="" value={game.trust} tone={game.trust >= 60 ? "good" : game.trust >= 45 ? "warning" : "bad"} />
              </div>
            </div>
            <div className="px-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">Consumer Dist</div>
              <div className="mt-1.5 font-mono text-xl font-semibold text-[#e6edf3]">{game.distribution.consumer.toFixed(1)}</div>
              <div className="mt-1 font-mono text-xs text-[#484f58]">
                {game.lastMonth.distributionDelta.consumer >= 0 ? "+" : ""}{game.lastMonth.distributionDelta.consumer} completed month
              </div>
              <div className="mt-2"><Meter label="" value={game.distribution.consumer} /></div>
            </div>
            <div className="pl-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">Enterprise Dist</div>
              <div className="mt-1.5 font-mono text-xl font-semibold text-[#e6edf3]">{game.distribution.enterprise.toFixed(1)}</div>
              <div className="mt-1 font-mono text-xs text-[#484f58]">
                {game.lastMonth.distributionDelta.enterprise >= 0 ? "+" : ""}{game.lastMonth.distributionDelta.enterprise} completed month
              </div>
              <div className="mt-2"><Meter label="" value={game.distribution.enterprise} /></div>
            </div>
          </div>
        </Panel>

        {/* Commercial Controls */}
        <Panel title="Commercial Controls">
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">Marketing Budget <span className="text-[#484f58]">($M / month)</span></span>
            <input
              type="number"
              step={1}
              min={0}
              value={game.marketingBudgetMillions}
              onChange={(e) => onUpdateMarketingBudget(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-right font-mono text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
            />
          </div>
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">Marketing Spend / Month</span>
            <span className="font-mono text-sm text-[#e6edf3]">{money(game.marketingBudgetMillions * 1_000_000)}</span>
          </div>
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">Chatbot Demand Multiplier</span>
            <span className={`font-mono text-sm ${game.marketingBudgetMillions > 0 ? "text-[#3fb950]" : "text-[#484f58]"}`}>
              {chatbotSpendMultiplier.toFixed(2)}x
            </span>
          </div>
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">API Demand Multiplier</span>
            <span className={`font-mono text-sm ${game.marketingBudgetMillions > 0 ? "text-[#3fb950]" : "text-[#484f58]"}`}>
              {apiSpendMultiplier.toFixed(2)}x
            </span>
          </div>
        </Panel>

        {/* Departments */}
        <Panel title="Departments">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161b22]">
                  <th className={TH}>Department</th>
                  <th className={TH}>Bulk / Named</th>
                  <th className={TH}>Lead</th>
                  <th className={TH}>Morale</th>
                  <th className={TH}>Mgmt</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(game.departments) as DepartmentId[]).map((depId) => {
                  const dep = game.departments[depId];
                  const lead = game.employees.find((e) => e.id === dep.leadEmployeeId) ?? null;
                  const activeStaff = game.employees.filter((e) => e.active && e.departmentId === depId);
                  return (
                    <tr key={depId} className={TR}>
                      <td className={TD}>
                        <div className="font-medium text-[#e6edf3]">{DEPARTMENT_LABELS[depId]}</div>
                        <Badge tone="default">{dep.managementQuality} mgmt</Badge>
                      </td>
                      <td className={TD}>
                        <span className="font-mono">{game.headcount[dep.roleId]}</span>
                        <span className="text-xs text-[#484f58]"> / {activeStaff.length}</span>
                      </td>
                      <td className={TD}>
                        {lead ? (
                          <>
                            <div className="text-[#c9d1d9]">{lead.name}</div>
                            <div className="text-xs text-[#8b949e]">{lead.title}</div>
                          </>
                        ) : (
                          <span className="text-[#484f58]">Unassigned</span>
                        )}
                      </td>
                      <td className={TD}>
                        <div className={`font-mono text-sm ${dep.morale >= 65 ? "text-[#3fb950]" : dep.morale >= 50 ? "text-[#d29922]" : "text-[#f85149]"}`}>
                          {dep.morale.toFixed(0)}
                        </div>
                        <div className="mt-1 w-20">
                          <Meter label="" value={dep.morale} tone={dep.morale >= 65 ? "good" : dep.morale >= 50 ? "warning" : "bad"} />
                        </div>
                      </td>
                      <td className={TD}>
                        <span className="font-mono text-[#e6edf3]">{dep.managementQuality.toFixed(0)}</span>
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

        {/* Board Direction */}
        <Panel title="Board Direction">
          {/* Status rows */}
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">Current Quarter</span>
            <span className="font-mono text-sm text-[#e6edf3]">{getQuarterIndexFromWeek(currentWeek)}</span>
          </div>
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">Next Board Memo</span>
            <span className="font-mono text-sm text-[#e6edf3]">{nextBoardReviewWeeks} wk</span>
          </div>
          <div className={FIELD_ROW}>
            <span className="text-sm text-[#8b949e]">Board Pressure</span>
            <span className={`font-mono text-sm ${game.boardPressure < 40 ? "text-[#3fb950]" : game.boardPressure < 70 ? "text-[#d29922]" : "text-[#f85149]"}`}>
              {game.boardPressure.toFixed(1)}
            </span>
          </div>

          {/* Active directive summary */}
          {currentDirective ? (
            <div className="mt-3 rounded border border-[#2ea043]/20 bg-[#0d2619] px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-[#3fb950]">{currentDirective.name}</div>
                <Badge tone="good">{directiveWeeksRemaining} wk left</Badge>
              </div>
              <div className="mt-1 text-xs text-[#3fb950]/70">{currentDirective.upside}</div>
              <div className="mt-0.5 text-xs text-[#484f58]">{currentDirective.downside}</div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-[#484f58]">No active directive. Select one below.</div>
          )}

          {/* Directive picker — selectable table */}
          <div className="mt-4 overflow-hidden rounded-md border border-[#30363d]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161b22]">
                  <th className={TH}>Directive</th>
                  <th className={TH + " hidden lg:table-cell"}>Upside / Downside</th>
                  <th className={TH + " w-16"}></th>
                </tr>
              </thead>
              <tbody>
                {Object.values(BOARD_DIRECTIVES).map((directive) => {
                  const isActive = game.currentDirective === directive.id;
                  return (
                    <tr key={directive.id} className={`${TR} ${isActive ? "bg-[#0d2619]/50" : ""}`}>
                      <td className={TD}>
                        <div className={`font-medium ${isActive ? "text-[#3fb950]" : "text-[#e6edf3]"}`}>{directive.name}</div>
                        <div className="mt-0.5 text-xs text-[#484f58]">{directive.summary}</div>
                      </td>
                      <td className={TD + " hidden lg:table-cell"}>
                        <div className="text-xs text-[#3fb950]/80">{directive.upside}</div>
                        <div className="mt-0.5 text-xs text-[#484f58]">{directive.downside}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          onClick={() => onChooseBoardDirective(directive.id)}
                          variant={isActive ? "good" : "ghost"}
                        >
                          {isActive ? "Refresh" : "Set"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Board Readout */}
        <Panel title="Board Readout">
          {game.pendingBoardReview ? (
            <div>
              {game.pendingBoardReview.reasons.map((reason) => (
                <div key={reason} className="border-b border-[#161b22] py-2 text-sm text-[#c9d1d9] last:border-0">
                  {reason}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className={FIELD_ROW}>
                <span className="text-sm text-[#8b949e]">Trust Drift</span>
                <span className={`font-mono text-sm ${game.lastMonth.trustDelta >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                  {game.lastMonth.trustDelta >= 0 ? "+" : ""}{game.lastMonth.trustDelta}
                </span>
              </div>
              <div className={FIELD_ROW}>
                <span className="text-sm text-[#8b949e]">Consumer Dist Delta</span>
                <span className={`font-mono text-sm ${game.lastMonth.distributionDelta.consumer >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                  {game.lastMonth.distributionDelta.consumer >= 0 ? "+" : ""}{game.lastMonth.distributionDelta.consumer}
                </span>
              </div>
              <div className={FIELD_ROW}>
                <span className="text-sm text-[#8b949e]">Enterprise Dist Delta</span>
                <span className={`font-mono text-sm ${game.lastMonth.distributionDelta.enterprise >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                  {game.lastMonth.distributionDelta.enterprise >= 0 ? "+" : ""}{game.lastMonth.distributionDelta.enterprise}
                </span>
              </div>
              <div className={FIELD_ROW}>
                <span className="text-sm text-[#8b949e]">Current Directive</span>
                <span className="font-mono text-sm text-[#e6edf3]">{currentDirective ? currentDirective.name : "None"}</span>
              </div>
            </>
          )}
        </Panel>

        {/* Leadership & Hiring */}
        <Panel title="Leadership & Hiring">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">Current Staff</div>
          <div className="overflow-x-auto rounded-md border border-[#30363d]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161b22]">
                  <th className={TH}>Name / Role</th>
                  <th className={TH}>Skill / Lead</th>
                  <th className={TH}>Burnout</th>
                  <th className={TH}>Salary / yr</th>
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
                    </td>
                    <td className={TD + " font-mono text-[#8b949e]"}>{employee.skill} / {employee.leadership}</td>
                    <td className={TD}>
                      <span className={`font-mono text-xs ${employee.burnout < 40 ? "text-[#3fb950]" : employee.burnout < 65 ? "text-[#d29922]" : "text-[#f85149]"}`}>
                        {employee.burnout}
                      </span>
                    </td>
                    <td className={TD + " font-mono text-[#8b949e]"}>{money(employee.salary)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button onClick={() => onFireEmployee(employee.id)} variant="ghost">Fire</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">Hiring Market</div>
          <div className="overflow-x-auto rounded-md border border-[#30363d]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#161b22]">
                  <th className={TH}>Candidate / Role</th>
                  <th className={TH}>Skill / Lead</th>
                  <th className={TH}>Salary / yr</th>
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
                      <Button
                        onClick={() => onHireCandidate(candidate.id)}
                        variant="secondary"
                        disabled={game.cash < candidate.signingCost}
                      >
                        Hire
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

      </div>
    </div>
  );
}
