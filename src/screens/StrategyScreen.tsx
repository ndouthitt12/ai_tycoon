import { ARCHETYPES, BOARD_DIRECTIVES } from "../game/defs";
import { getMarketingSpendMultiplier, getQuarterNumber, money } from "../game/sim";
import { GameState } from "../game/types";
import { Badge, Meter, Panel, StatRow } from "../components/ui";

export function StrategyScreen({ game, onUpdateMarketingBudget }: { game: GameState; onUpdateMarketingBudget: (value: number) => void }) {
  const archetype = ARCHETYPES[game.archetype];
  const currentDirective = game.currentDirective ? BOARD_DIRECTIVES[game.currentDirective] : null;
  const nextBoardReviewTurn = 3 - ((game.turn - 1) % 3);
  const chatbotSpendMultiplier = getMarketingSpendMultiplier(game.marketingBudgetMillions, 1.0);
  const apiSpendMultiplier = getMarketingSpendMultiplier(game.marketingBudgetMillions, 3.0);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-6">
        <Panel title="Company Identity" subtitle="Your archetype should dictate how you win, not just how you start.">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-2xl font-semibold text-slate-50">{archetype.name}</div>
                <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{archetype.summary}</div>
              </div>
              <Badge tone="default">{archetype.winStyle}</Badge>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Strengths</div>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  {archetype.strengths.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Weaknesses</div>
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  {archetype.weaknesses.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Trust And Distribution" subtitle="This is the layer that stops raw scale from being the only strategy.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="space-y-4">
                <Meter label="Company Trust" value={game.trust} tone={game.trust >= 60 ? "good" : game.trust >= 45 ? "warning" : "bad"} />
                <StatRow label="Last Month Delta" value={game.lastMonth.trustDelta >= 0 ? `+${game.lastMonth.trustDelta}` : game.lastMonth.trustDelta} tone={game.lastMonth.trustDelta >= 0 ? "good" : "bad"} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
              <div className="space-y-4">
                <Meter label="Consumer Distribution" value={game.distribution.consumer} tone="default" />
                <Meter label="Enterprise Distribution" value={game.distribution.enterprise} tone="default" />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Commercial Controls" subtitle="Recurring marketing spend can accelerate demand, but it hits profit every month.">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
            <label className="block text-sm">
              <div className="mb-1 text-slate-400">Marketing Budget ($M / month)</div>
              <input
                type="number"
                step={1}
                min={0}
                value={game.marketingBudgetMillions}
                onChange={(event) => onUpdateMarketingBudget(Math.max(0, Number(event.target.value) || 0))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
              />
            </label>
            <div className="mt-4 space-y-3">
              <StatRow label="Monthly Spend" value={money(game.marketingBudgetMillions * 1000000)} />
              <StatRow
                label="Spend Curve"
                value={`Chatbot ${chatbotSpendMultiplier.toFixed(2)}x / API ${apiSpendMultiplier.toFixed(2)}x`}
                tone={game.marketingBudgetMillions > 0 ? "good" : "default"}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Board Direction" subtitle="Quarterly reviews force a strategic decision instead of endless tactical tuning.">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
            <StatRow label="Current Quarter" value={getQuarterNumber(game.turn)} />
            <StatRow label="Months To Review" value={game.pendingBoardReview ? "Ready now" : nextBoardReviewTurn} />
            <StatRow label="Board Pressure" value={game.boardPressure.toFixed(1)} tone={game.boardPressure < 40 ? "good" : game.boardPressure < 70 ? "warning" : "bad"} />
            {currentDirective ? (
              <>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-50">{currentDirective.name}</div>
                      <div className="mt-1 text-sm text-slate-400">{currentDirective.summary}</div>
                    </div>
                    <Badge tone="good">{game.directiveTurnsRemaining} mo left</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div>{currentDirective.upside}</div>
                    <div className="text-slate-500">{currentDirective.downside}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-400">
                No active directive. The next board review will force a strategic stance.
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Board Readout" subtitle="Pressure responds to runway, trust, execution misses, and rival shocks.">
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
            {game.pendingBoardReview ? (
              game.pendingBoardReview.reasons.map((reason) => (
                <div key={reason} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
                  {reason}
                </div>
              ))
            ) : (
              <>
                <StatRow label="Trust Drift" value={game.lastMonth.trustDelta >= 0 ? `+${game.lastMonth.trustDelta}` : game.lastMonth.trustDelta} />
                <StatRow label="Consumer Distribution Delta" value={game.lastMonth.distributionDelta.consumer >= 0 ? `+${game.lastMonth.distributionDelta.consumer}` : game.lastMonth.distributionDelta.consumer} />
                <StatRow label="Enterprise Distribution Delta" value={game.lastMonth.distributionDelta.enterprise >= 0 ? `+${game.lastMonth.distributionDelta.enterprise}` : game.lastMonth.distributionDelta.enterprise} />
                <StatRow label="Current Directive" value={currentDirective ? currentDirective.name : "None"} />
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
