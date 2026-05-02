import { useState } from "react";

import { WEEKS_PER_MONTH, money, pct, getLoanTerms } from "../game/sim";
import { GameState } from "../game/types";
import { Badge, Button, EmptyState, Panel, StatRow } from "../components/ui";

export function BankScreen({
  game,
  onTakeLoan,
}: {
  game: GameState;
  onTakeLoan: (principal: number, term: number) => void;
}) {
  const [requestBillions, setRequestBillions] = useState(1);
  const [termMonths, setTermMonths] = useState(24);

  const principalAmount = Math.max(0, requestBillions * 1000000000);
  const loanPreview = getLoanTerms(principalAmount, termMonths);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        {game.deficitMonths > 0 ? (
          <Panel title="Liquidity Crisis" subtitle="Deficit status is checked after each completed month.">
            <div className="rounded-2xl border border-rose-900/50 bg-rose-950/30 p-5 ring-1 ring-inset ring-rose-500/20">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xl font-bold tracking-tight text-rose-500">
                    Completed-Month Deficit {game.deficitMonths} / 12
                  </div>
                  <div className="mt-1 text-sm leading-6 text-rose-300">
                    Your company is operating at a negative cash balance. If you cannot secure positive liquidity
                    before 12 consecutive completed-month deficits elapse, the board will liquidate your operations.
                  </div>
                </div>
                <div className="mt-4 shrink-0 md:mt-0">
                  <Badge tone="bad">
                    {12 - game.deficitMonths} Month{12 - game.deficitMonths !== 1 ? "s" : ""} Left
                  </Badge>
                </div>
              </div>
            </div>
          </Panel>
        ) : null}

        <Panel
          title="Capital Request"
          subtitle="Generate liquidity instantly to fund massive model runs, outlast competitors, or avoid liquidation."
        >
          <div className="rounded-2xl bg-slate-950/45 p-5 ring-1 ring-inset ring-slate-800/70">
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="block text-sm">
                <div className="mb-2 text-slate-400">Requested Principal (Billions)</div>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={requestBillions}
                  onChange={(e) => setRequestBillions(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-lg font-semibold text-slate-50 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </label>

              <label className="block text-sm">
                <div className="mb-2 flex items-center justify-between text-slate-400">
                  <span>Repayment Term</span>
                  <span className="font-mono text-cyan-300">{termMonths} months</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={120}
                  step={1}
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  className="w-full"
                />
                <div className="mt-2 text-xs text-slate-500">
                  Loans under 6 months carry 0% interest penalty.
                </div>
              </label>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-900/60 p-4 ring-1 ring-inset ring-slate-800/80">
              <div className="text-sm font-medium text-slate-300">Term Sheet Preview</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <StatRow label="Principal" value={money(principalAmount)} />
                <StatRow
                  label="Flat Interest Fee"
                  value={pct(loanPreview.feePct)}
                  tone={loanPreview.feePct === 0 ? "good" : loanPreview.feePct >= 0.2 ? "bad" : "warning"}
                />
                <StatRow label="Weekly Payment" value={money(loanPreview.weeklyPayment)} />
                <StatRow label="Total Repayment" value={money(loanPreview.totalRepayment)} />
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="primary"
                onClick={() => {
                  if (principalAmount > 0 && termMonths > 0) {
                    onTakeLoan(principalAmount, termMonths);
                    setRequestBillions(1);
                    setTermMonths(24);
                  }
                }}
                disabled={principalAmount <= 0}
                className="w-full py-3 text-base"
              >
                Sign Term Sheet for {money(principalAmount)}
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel
          title="Active Liabilities"
          subtitle="Your outstanding loans. Weekly payments are deducted automatically from cash."
        >
          {game.loans.length === 0 ? (
            <EmptyState
              title="No active debt"
              body="The company's balance sheet is clean. All operations are funded by equity and revenue."
            />
          ) : (
            <div className="space-y-4">
              {game.loans.map((loan) => {
                const termWeeks = loan.termWeeks ?? loan.term * WEEKS_PER_MONTH;
                const elapsedWeeks = loan.elapsedWeeks ?? loan.elapsed * WEEKS_PER_MONTH;
                const remainingWeeks = Math.max(0, termWeeks - elapsedWeeks);
                const weeklyPayment = loan.weeklyPayment ?? loan.monthlyPayment / WEEKS_PER_MONTH;
                const totalProgress = (elapsedWeeks / Math.max(1, termWeeks)) * 100;

                return (
                  <div key={loan.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-50">
                          {money(loan.principal)} Principal over {loan.term} mo
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          {elapsedWeeks} weeks paid / {remainingWeeks} remaining
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="default">Fee {pct(loan.interestFeePct)}</Badge>
                        <Badge tone="warning">Burn {money(weeklyPayment)}/wk</Badge>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Repayment Progress</span>
                        <span>{pct(elapsedWeeks / Math.max(1, termWeeks))}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                        <div
                          className="h-full bg-amber-400/80 transition-all duration-300"
                          style={{ width: `${totalProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
