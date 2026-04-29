# Week-To-Week Simulation Migration Roadmap

This document lays out a phased plan for changing AI Tycoon from a month-to-month simulation into a week-to-week simulation.

The safest path is not to convert every system at once. The current game is deeply balanced around one turn equaling one month, so the migration should first introduce weekly time infrastructure while preserving monthly business settlement. After that, individual systems can be moved to weekly cadence one at a time.

## Current Situation

The current simulation treats `GameState.turn` as the current month. The main entry point is `advanceMonth()` in `src/game/sim.ts`.

Month-based concepts currently appear in:

- `GameState.turn`
- `advanceMonth()`
- `monthLabel()`
- `getQuarterNumber()`
- `lastMonth`
- `ModelState.monthBuilt`
- `ActiveRun.totalMonths`
- `ActiveRun.monthsElapsed`
- `PlannedDatacenterState.monthOrdered`
- `PlannedDatacenterState.monthsRemaining`
- `FundingState.lastRaisedTurn`
- `CompetitorCompanyState.nextReleaseMonth`
- `ModelPerformanceState.lastMonthRevenue`
- `ModelPerformanceState.lastMonthAcquisition`
- `ModelPerformanceState.lastMonthChurn`
- `ModelPerformanceState.lastMonthUsers`
- UI labels in App, Lab, Cloud, Market, Bank, Admin, Strategy, and Overview

Several systems also assume a monthly cadence even if the name does not say month:

- Payroll
- Marketing spend
- Cloud reserved cost
- Overflow cost
- Loan payments
- Development cost installment payments
- Product revenue
- User acquisition
- Churn
- Trust drift
- Board pressure drift
- Rival actions
- Competitor releases
- Hiring market refresh
- Funding availability
- Board reviews
- Cohort population growth

## Guiding Principle

Do not start by making the whole economy weekly.

The recommended migration is:

1. Add week-based time fields and helpers.
2. Let the player advance one week at a time.
3. Keep most business finances settling monthly at first.
4. Convert training and build timers to weeks.
5. Move product, market, and competitor systems to weekly rates after the game remains stable.

This avoids the biggest risk: accidentally multiplying revenue, cost, churn, events, or competitor launches by four.

## Phase 0: Audit And Time Vocabulary

Goal: make the existing time assumptions explicit before changing behavior.

### Tasks

- Search for all month/turn fields and labels.
- Document which fields are true simulation state and which are display labels.
- Decide on canonical time constants.

Suggested constants:

```ts
export const WEEKS_PER_MONTH = 4;
export const WEEKS_PER_QUARTER = WEEKS_PER_MONTH * 3;
export const WEEKS_PER_YEAR = WEEKS_PER_MONTH * 12;
```

Recommended helper functions:

```ts
export function getMonthIndexFromWeek(week: number) {
  return Math.floor((week - 1) / WEEKS_PER_MONTH) + 1;
}

export function isMonthEndWeek(week: number) {
  return week % WEEKS_PER_MONTH === 0;
}

export function isQuarterEndWeek(week: number) {
  return week % WEEKS_PER_QUARTER === 0;
}

export function isYearEndWeek(week: number) {
  return week % WEEKS_PER_YEAR === 0;
}
```

### Files To Inspect

- `src/game/types.ts`
- `src/game/sim.ts`
- `src/game/systems/training.ts`
- `src/game/systems/market.ts`
- `src/game/systems/competitors.ts`
- `src/App.tsx`
- `src/screens/LabScreen.tsx`
- `src/screens/ComputeScreen.tsx`
- `src/screens/OverviewScreen.tsx`
- `src/screens/MarketScreen.tsx`
- `src/screens/StrategyScreen.tsx`
- `src/screens/BankScreen.tsx`
- `src/screens/AdminScreen.tsx`

### Acceptance Criteria

- There is a clear list of month-based fields.
- There is a decision on whether week numbers start at 1.
- There is a decision on whether one in-game month is exactly 4 weeks or calendar-like 4.33 weeks.

Recommendation: use 4 weeks per month for gameplay clarity. That means the game's fiscal year is 48 simulation weeks, not a real-world 52-week calendar year.

## Phase 1: Add Weekly Time Infrastructure Without Changing Balance

Goal: introduce weeks while preserving old behavior as much as possible.

### Data Model Changes

Add new fields while keeping old fields temporarily:

```ts
export interface GameState {
  turn: number; // temporarily still present for compatibility
  week: number;
  currentMonth: number;
  currentQuarter: number;
  currentYear: number;
}
```

Alternative:

```ts
export interface GameState {
  turn: number; // reinterpret as week after migration
  time: {
    week: number;
    month: number;
    quarter: number;
    year: number;
  };
}
```

Recommended path:

- Add `week`.
- Keep `turn` as a compatibility alias during the migration.
- Later rename or remove `turn`.

### Helper Function Changes

Add new labels:

```ts
export function weekLabel(week: number) {
  // Example: "Week 1, Jan 2026"
}

export function monthLabelFromWeek(week: number) {
  // Uses getMonthIndexFromWeek()
}
```

Keep `monthLabel(turn)` alive for older UI during the transition.

### Advance Function

Add:

```ts
export function advanceWeek(game: GameState) {
  // Initially calls weekly scaffolding, then monthly settlement every 4 weeks.
}
```

Do not delete `advanceMonth()` yet. Make it call `advanceWeek()` four times only after weekly behavior is stable.

### Acceptance Criteria

- New games initialize with `week: 1`.
- UI can show a week label without breaking existing month labels.
- No economic numbers change yet.
- Build passes.

## Phase 2: Weekly Turn Button, Monthly Settlement

Goal: let the player click through weeks, but only settle major finances at month end.

### Recommended Design

Every week:

- Increment active run progress.
- Update run loss curves.
- Check limited weekly training events.
- Update datacenter construction progress.
- Show weekly status changes.

Every 4th week:

- Run the existing monthly revenue/cost settlement.
- Update `lastMonth`.
- Update history arrays.
- Charge payroll.
- Charge cloud reserved cost.
- Charge marketing spend.
- Charge loan payments.
- Apply product churn/acquisition.
- Apply trust and board pressure deltas.
- Refresh hiring market if due.
- Check funding availability if due.

### Implementation Shape

Split the current `advanceMonth()` into smaller units:

```ts
function advanceWeeklyOperations(next: GameState) {
  // training progress, construction progress, weekly events
}

function settleMonthlyBusiness(next: GameState) {
  // most of current advanceMonth economics
}

export function advanceWeek(game: GameState) {
  const next = copyGame(game);
  advanceWeeklyOperations(next);

  if (isMonthEndWeek(next.week)) {
    settleMonthlyBusiness(next);
  }

  next.week += 1;
  return next;
}
```

### Important Rule

Do not divide all monthly values by 4 yet.

In this phase, the economy still resolves monthly. The weekly loop creates pacing and visibility, not a full weekly economy.

### UI Changes

Update the top bar:

- Button: `Advance Week`
- Date label: `Week X / Month Y`
- Keep monthly profit/runway cards as monthly metrics.

Suggested labels:

- `Monthly Profit`
- `Runway`
- `Last Month Revenue`
- `This Week`
- `Next Month-End`

### Acceptance Criteria

- Clicking advance week does not charge payroll four times per month.
- `lastMonth` changes only at month-end.
- Top bar clearly communicates current week.
- Existing monthly reports still make sense.

## Phase 3: Convert Training Runs To Weekly Progress

Goal: make model development benefit from weekly cadence first, because training is the most natural place for finer time resolution.

### Data Model Changes

Temporarily keep old fields but add weekly fields:

```ts
export interface ActiveRun {
  totalWeeks: number;
  weeksElapsed: number;
  totalMonths?: number;
  monthsElapsed?: number;
}
```

After migration, remove or stop using:

- `totalMonths`
- `monthsElapsed`

### Conversion Rules

When launching a run:

```ts
const totalWeeks = Math.ceil(estimate.totalMonths * WEEKS_PER_MONTH);
```

Or better, after balance cleanup:

```ts
const totalWeeks = calculateRunDurationWeeks(game);
```

Weekly progress:

```ts
run.weeksElapsed += 1;
if (run.weeksElapsed >= run.totalWeeks) completeRun(run);
```

### Cost Installments

Current behavior spreads remaining development cost across remaining months. In weekly mode, use:

```ts
const weeksRemaining = Math.max(1, Math.ceil(run.totalWeeks - run.weeksElapsed));
const installment = Math.min(run.remainingDevelopmentCost, Math.round(run.remainingDevelopmentCost / weeksRemaining));
```

In Phase 3, development cost can be charged weekly while payroll and revenue remain monthly. This is acceptable because training burn is operationally continuous.

### Event Timing

Current mid-run event logic:

```ts
run.monthsElapsed >= Math.max(1, Math.floor(run.totalMonths / 2) - 1)
```

Weekly version:

```ts
run.weeksElapsed >= Math.max(1, Math.floor(run.totalWeeks / 2) - 1)
```

But weekly checks need lower probabilities. A monthly 58% chance is too frequent if checked weekly.

Suggested conversion:

```ts
weeklyProbability = 1 - Math.pow(1 - monthlyProbability, 1 / WEEKS_PER_MONTH);
```

For 58% monthly:

- Weekly equivalent is about 19.5%.

### Acceptance Criteria

- Training durations display in weeks.
- Active run progress advances every week.
- Development cost burn feels continuous.
- Training event frequency does not quadruple.
- Failed and completed runs still release assigned researchers correctly.

## Phase 4: Convert Datacenter Builds, Cooldowns, And Timers

Goal: move non-economic timers from month units to week units.

### Convert Datacenter Construction

Current fields:

- `monthOrdered`
- `monthsRemaining`

New fields:

- `weekOrdered`
- `weeksRemaining`

Conversion:

```ts
weeksRemaining = monthsRemaining * WEEKS_PER_MONTH;
```

### Convert Board Directive Duration

Current:

- `directiveTurnsRemaining`

If directives are quarterly, use:

```ts
directiveWeeksRemaining = WEEKS_PER_QUARTER;
```

### Convert Rival And Modifier Timers

Current:

- `RivalState.cooldown`
- `MarketModifier.turnsRemaining`

Recommended:

- Rename to `weeksRemaining`.
- Convert old values using `oldTurns * WEEKS_PER_MONTH` if they were monthly.

### Acceptance Criteria

- Datacenter builds complete after the intended number of weeks.
- Board directives last roughly one quarter.
- Market modifiers do not expire four times too quickly.
- Rival cooldowns remain balanced.

## Phase 5: Weekly Product And Market Simulation

Goal: move product usage, revenue, churn, and acquisition from monthly settlement to weekly flow.

This is the first truly risky phase for balance.

### Convert Monthly Rates To Weekly Rates

For simple linear costs:

```ts
weeklyCost = monthlyCost / WEEKS_PER_MONTH;
```

For churn and retention:

Do not divide churn directly if churn is a percentage. Convert it:

```ts
weeklyChurn = 1 - Math.pow(1 - monthlyChurn, 1 / WEEKS_PER_MONTH);
```

For growth/acquisition:

If monthly acquisition is an absolute user count:

```ts
weeklyAcquisition = monthlyAcquisition / WEEKS_PER_MONTH;
```

If monthly growth is a percentage:

```ts
weeklyGrowth = Math.pow(1 + monthlyGrowth, 1 / WEEKS_PER_MONTH) - 1;
```

### Product State Naming

Keep monthly metrics for reporting, but add weekly state:

```ts
lastWeek: LastWeekSnapshot;
currentMonthToDate: MonthToDateSnapshot;
lastMonth: LastMonthSnapshot;
```

Recommended minimum:

- Add `lastWeek`.
- Add month-to-date accumulators.
- Keep `lastMonth` for summary panels and ARR.

### Monthly Reporting

At month-end:

- Roll current month-to-date into `lastMonth`.
- Reset month-to-date counters.
- Push monthly totals into history arrays.

### Acceptance Criteria

- Weekly revenue adds up to approximately the old monthly revenue after four weeks.
- Weekly churn over four weeks matches old monthly churn.
- Weekly acquisition over four weeks matches old monthly acquisition.
- ARR remains annualized from monthly or trailing 4-week revenue.

## Phase 6: Weekly Payroll, Cloud Cost, Loans, And Cashflow

Goal: make company cash move every week instead of in monthly jumps.

### Cost Conversion

Convert:

- Payroll
- Marketing spend
- Base operations cost
- Reserved cloud cost
- Loan payments
- Cloud rental revenue

Suggested rules:

```ts
weeklyPayroll = monthlyPayroll / WEEKS_PER_MONTH;
weeklyMarketingSpend = monthlyMarketingSpend / WEEKS_PER_MONTH;
weeklyReservedCloudCost = monthlyReservedCloudCost / WEEKS_PER_MONTH;
weeklyLoanPayment = monthlyLoanPayment / WEEKS_PER_MONTH;
```

### Loans

Current loans use:

- `term`
- `elapsed`
- `monthlyPayment`

Recommended new fields:

```ts
termWeeks: number;
elapsedWeeks: number;
weeklyPayment: number;
```

Keep display labels in months if useful:

- "12 months"
- "48 weeks"

### Deficit Tracking

Current:

- `deficitMonths`

New:

- `deficitWeeks`
- Lose after 48 consecutive deficit weeks, or keep the old 12-month logic using month-end checks.

Recommendation:

Keep solvency based on month-end cash during Phase 6. Later, switch to weekly deficit warnings if the pacing feels good.

### Acceptance Criteria

- Cash changes weekly.
- Four weekly payroll charges equal the old monthly payroll.
- Four weekly cloud charges equal the old monthly cloud cost.
- Loan payoff timing remains equivalent.
- Runway display still uses months for readability.

## Phase 7: Weekly Competitor And Market Cadence

Goal: convert competitor releases, rival shocks, market modifiers, and market standard growth to weekly timing.

### Competitor Releases

Current competitor cadence is based on month ranges:

- Aggressive upgrades: 3-12 months
- Balanced upgrades: 6-16 months
- Disciplined upgrades: 12-16 months

Convert to weeks:

```ts
weeks = months * WEEKS_PER_MONTH;
```

Fields to migrate:

- `nextReleaseMonth` -> `nextReleaseWeek`
- `releaseMonth` -> `releaseWeek`
- `monthBuilt` -> `weekBuilt`

### Model Age

Current model recency uses:

```ts
game.turn - model.monthBuilt
```

Weekly version:

```ts
weeksSinceRelease = game.week - model.weekBuilt;
monthsSinceRelease = weeksSinceRelease / WEEKS_PER_MONTH;
```

Keep recency balance in months, but compute from weeks.

### Market Standard

If market standard currently changes monthly, either:

- Update only at month-end, or
- Apply weekly equivalent growth.

Recommendation: update at month-end until product and competitor systems are fully weekly.

### Acceptance Criteria

- Competitors do not release four times too often.
- Model recency remains comparable to old balance.
- Market shock decay feels similar over one month.
- Market table can display either release week or release month.

## Phase 8: Rename Monthly Fields And Clean Compatibility

Goal: remove confusing compatibility names once weekly behavior is stable.

### Rename Fields

Recommended migration:

- `turn` -> `week`
- `lastMonth` remains if it is truly the last completed month.
- `monthBuilt` -> `weekBuilt`
- `releaseMonth` -> `releaseWeek`
- `monthsElapsed` -> `weeksElapsed`
- `totalMonths` -> `totalWeeks`
- `monthsRemaining` -> `weeksRemaining`
- `monthOrdered` -> `weekOrdered`
- `lastRaisedTurn` -> `lastRaisedWeek`
- `nextReleaseMonth` -> `nextReleaseWeek`
- `directiveTurnsRemaining` -> `directiveWeeksRemaining`
- `MarketModifier.turnsRemaining` -> `weeksRemaining`

### Backward Compatibility

If save files matter, add a migration function:

```ts
function migrateMonthlySaveToWeekly(game: unknown): GameState {
  // If week missing, derive it from turn:
  // week = (turn - 1) * WEEKS_PER_MONTH + 1
}
```

### Acceptance Criteria

- New code no longer treats `turn` as an ambiguous unit.
- The UI language distinguishes week, month, quarter, and year.
- Old saves either migrate or fail gracefully.

## Phase 9: UI Copy And Reporting Polish

Goal: make the weekly cadence understandable to the player.

### Top Bar

Replace:

- `Advance Month`

With:

- `Advance Week`

Show:

- Current week
- Current month
- Month-end status

Example:

- `Week 7 / Feb 2026`
- `Month-end in 1 week`

### Screen Labels

Use weekly labels for:

- Training progress
- Datacenter progress
- Immediate events
- Cashflow if converted

Keep monthly labels for:

- ARR
- Monthly revenue
- Monthly profit
- Payroll per month
- Marketing budget per month
- Subscription price per month
- Runway in months

### History Charts

Recommended:

- Keep monthly history charts for readability.
- Add weekly sparklines only where useful, such as cash or training progress.

### Acceptance Criteria

- The player always knows what settles weekly and what settles monthly.
- No labels say "monthly" for values that now settle weekly.
- Business dashboards remain readable.

## Phase 10: Rebalance And Tuning

Goal: tune the game for better weekly pacing, not just equivalent math.

### Systems To Rebalance

- Training event probability
- Talent event probability
- Trust drift
- Product churn
- Acquisition
- Competitor release shock decay
- Funding cadence
- Board pressure
- Hiring market refresh
- Datacenter construction speed
- Run failure risk
- Run duration

### Recommended Tuning Tests

Create repeatable test saves or scripted scenarios:

1. No model, no revenue, advance 16 weeks.
2. One active model, stable capacity, advance 16 weeks.
3. One active training run, advance until completion.
4. Overloaded serving capacity, advance 8 weeks.
5. Competitor-heavy market, advance 48 weeks.
6. Negative cash, advance until liquidation.
7. Datacenter build queued, advance until completion.

Current scripted coverage lives in `scripts/weekly-scenario-check.mjs` and can be run with:

```bash
npm run check:weekly
```

The checker seeds `Math.random`, advances the live simulation code, auto-resolves blocking training/talent events with the first available choice, and verifies the seven Phase 10 pacing scenarios above.

### Acceptance Criteria

- Four weekly turns roughly match one old monthly turn where intended.
- Weekly events add pacing without becoming spam.
- Training feels more alive but not too slow.
- The player does not need excessive clicks for low-value weeks.

## Recommended Implementation Order

1. Add week constants and time helpers.
2. Add `week` to `GameState` while keeping `turn`.
3. Add `advanceWeek()` and keep monthly settlement gated behind `isMonthEndWeek()`.
4. Update top bar to advance weeks.
5. Convert active training runs to weeks.
6. Convert datacenter and modifier timers to weeks.
7. Add `lastWeek` and month-to-date reporting.
8. Convert product economics to weekly rates.
9. Convert payroll, cloud, loans, and cashflow to weekly rates.
10. Convert competitors and model recency to weekly timing.
11. Rename fields and remove compatibility shims.
12. Rebalance event rates, churn, acquisition, and competitor cadence.

## Biggest Risks

### Event Spam

Monthly event checks cannot simply run weekly with the same probability. Use probability conversion:

```ts
weeklyProbability = 1 - Math.pow(1 - monthlyProbability, 1 / 4);
```

### Economy Multiplication

Monthly revenue and monthly costs cannot be applied every week unchanged. Either keep them month-end only or divide by 4.

### Ambiguous `turn`

`turn` is currently month-shaped. During migration, ambiguity will create bugs. Add helpers and eventually rename it.

### UI Confusion

Some values should stay monthly even in a weekly sim. Subscription price, payroll, ARR, and runway are naturally monthly or annual business metrics.

### Save Compatibility

If saves are persisted, old states need migration from month fields to week fields.

## Recommended MVP

The best first playable version is:

- The top bar advances one week.
- Training runs progress weekly.
- Training events can happen weekly with converted probabilities.
- Datacenter builds progress weekly.
- Financial settlement still happens every 4 weeks.
- UI clearly says when the next month-end settlement will happen.

This gives the game a more active cadence without requiring a full economic rebalance on day one.

## Final Target

The final version should feel like:

- Weekly operational decisions.
- Monthly business reporting.
- Quarterly board pressure.
- Annual market and cohort shifts.

That cadence is realistic for an AI company sim. The player should manage weekly execution while still thinking in monthly burn, quarterly board expectations, and annual competitive positioning.
