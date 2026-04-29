import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const esbuildScript = path.join(repoRoot, "node_modules", "esbuild", "bin", "esbuild");
const tempDir = path.join(tmpdir(), `ai-tycoon-weekly-${process.pid}`);
const entryPath = path.join(tempDir, "weekly-scenarios.ts");
const bundlePath = path.join(tempDir, "weekly-scenarios.mjs");
const simImportPath = path.relative(tempDir, path.join(repoRoot, "src", "game", "sim.ts")).replace(/\\/g, "/");

if (!existsSync(esbuildScript)) {
  console.error("esbuild was not found. Run npm install before npm run check:weekly.");
  process.exit(1);
}

mkdirSync(tempDir, { recursive: true });

writeFileSync(
  entryPath,
  `
import {
  WEEKS_PER_MONTH,
  advanceWeek,
  attachModelToProduct,
  buildDatacenter,
  createInitialGame,
  launchRun,
  resolvePendingEvent,
  settleGlobalMarket,
  updateCompetitorAdmin,
  updateReservedPods,
  updateSubscriptionPlan,
  updateTrainingConfig,
} from "./${simImportPath}";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function withSeed<T>(seed: number, fn: () => T) {
  const originalRandom = Math.random;
  Math.random = makeRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

function clearBlockingEvent(game: any) {
  let next = game;
  let guard = 0;
  while (next.pendingEvent && guard < 8) {
    const choice = next.pendingEvent.choices[0]?.key;
    assert(choice, "Pending event had no choices to resolve.");
    next = resolvePendingEvent(next, choice);
    guard += 1;
  }
  return next;
}

function advanceWeeks(game: any, weeks: number) {
  let next = game;
  for (let index = 0; index < weeks; index += 1) {
    next = clearBlockingEvent(next);
    next = advanceWeek(next);
    next = clearBlockingEvent(next);
    if (next.status !== "playing") break;
  }
  return next;
}

function emptyCohortSubscribers(game: any) {
  return Object.fromEntries(Object.keys(game.globalCohorts).map((cohortId) => [cohortId, 0]));
}

function seedModel(game: any, id = 9001) {
  game.models.unshift({
    id,
    familyId: id,
    baseModelId: null,
    name: "Scenario Model",
    version: 1,
    developmentCost: 1000000,
    capability: Math.max(72, game.marketStandard + 8),
    inferenceCost: 1.1,
    trust: 76,
    memorySize: 16,
    parameterScale: 18,
    contextWindow: 32,
    goals: { ...game.trainingConfig.goals },
    trainingDataUnits: 2,
    weekBuilt: game.week,
    monthBuilt: game.turn,
    sizeKey: game.trainingConfig.size,
    dataTier: game.trainingConfig.dataTier,
    subscribersByCohort: emptyCohortSubscribers(game),
    cohortTenureWeeks: emptyCohortSubscribers(game),
    reliability: { uptime: 0.72, latency: 0.7, safety: 0.7 },
  });
  game.modelPerformance[String(id)] = {
    totalRevenue: 0,
    lastWeekRevenue: 0,
    lastWeekAcquisition: 0,
    lastWeekChurn: 0,
    lastWeekUsers: 0,
    lastMonthRevenue: 0,
    lastMonthAcquisition: 0,
    lastMonthChurn: 0,
    lastMonthUsers: 0,
  };
  let next = attachModelToProduct(game, "chatbot", String(id));
  next = attachModelToProduct(next, "api", String(id));
  next.products.chatbot.price = 20;
  next.products.api.price = 2;
  return next;
}

const scenarios = [
  {
    name: "No model, no revenue, 16 weeks",
    run: () => withSeed(1001, () => {
      const game = advanceWeeks(createInitialGame("frontier_lab"), 16);
      assert(game.week === 17, "Expected week 17 after 16 weekly turns, got week " + game.week + ".");
      assert(game.turn === 5, "Expected four month-end settlements after 16 weeks, got turn " + game.turn + ".");
      assert(game.history.revenue.length === 4, "Expected four monthly revenue history entries.");
      assert(game.history.revenue.every((value: number) => value === 0), "No-model scenario should not create player revenue.");
      return { week: game.week, turn: game.turn, cash: game.cash };
    }),
  },
  {
    name: "One active model, stable capacity, 16 weeks",
    run: () => withSeed(1002, () => {
      let game = createInitialGame("consumer_ai_product_company");
      game = seedModel(game);
      game = updateReservedPods(game, 120);
      game = advanceWeeks(game, 16);
      assert(game.status === "playing", "Stable active-model scenario should keep playing.");
      assert(game.history.revenue.length === 4, "Expected four month-end reports.");
      assert(game.history.revenue.some((value: number) => value > 0), "Active model should produce revenue.");
      assert(game.products.chatbot.activeUsers + game.products.api.activeUsers > 0, "Active model should retain users.");
      return { revenue: game.history.revenue.at(-1), users: game.products.chatbot.activeUsers + game.products.api.activeUsers };
    }),
  },
  {
    name: "One active training run reaches completion",
    run: () => withSeed(1003, () => {
      let game = createInitialGame("frontier_lab");
      const assignedResearcherIds = game.employees
        .filter((employee: any) => employee.active && employee.departmentId === "research")
        .slice(0, 2)
        .map((employee: any) => employee.id);
      game = updateTrainingConfig(game, { name: "Scenario Run", assignedResearcherIds });
      game = launchRun(game);
      assert(game.activeRuns.length === 1, "Scenario run failed to launch.");
      game.activeRuns[0].totalWeeks = 6;
      game.activeRuns[0].totalMonths = 6 / WEEKS_PER_MONTH;
      game.activeRuns[0].remainingDevelopmentCost = Math.min(game.activeRuns[0].remainingDevelopmentCost, 600000);
      game = advanceWeeks(game, 10);
      assert(game.activeRuns.length === 0, "Training run should have completed or failed by 10 weeks.");
      assert(game.models.some((model: any) => model.name === "Scenario Run"), "Training run should ship a model under deterministic seed.");
      return { models: game.models.length, week: game.week };
    }),
  },
  {
    name: "Weekly training burn rolls into monthly report",
    run: () => withSeed(1008, () => {
      let game = createInitialGame("frontier_lab");
      game = updateTrainingConfig(game, { name: "Burn Report Run" });
      game = launchRun(game);
      assert(game.activeRuns.length === 1, "Training burn report run failed to launch.");
      game.activeRuns[0].totalWeeks = 8;
      game.activeRuns[0].totalMonths = 2;
      game.activeRuns[0].remainingDevelopmentCost = 800000;
      game = advanceWeeks(game, 4);
      assert(game.history.profit.length === 1, "Expected one completed monthly report after four weeks.");
      assert(game.lastMonth.developmentCost === 400000, "Expected completed-month training burn of 400000, got " + game.lastMonth.developmentCost + ".");
      assert(game.lastMonth.expenses >= game.lastMonth.developmentCost, "Training burn should be included in completed-month expenses.");
      return { developmentCost: game.lastMonth.developmentCost, profit: game.lastMonth.profit };
    }),
  },
  {
    name: "Overloaded serving capacity, 8 weeks",
    run: () => withSeed(1004, () => {
      let game = createInitialGame("consumer_ai_product_company");
      game = seedModel(game);
      game.cloud.reservedPods = 20;
      game.products.chatbot.activeUsers = 400000;
      game.products.chatbot.computeDemand = 140;
      game = advanceWeeks(game, 8);
      assert(game.history.profit.length === 2, "Expected two monthly reports for 8 weeks.");
      assert(game.lastMonth.overflowCost > 0 || game.lastMonth.burstCloudCost > 0 || game.products.chatbot.serving.capacityPressure > 0, "Overload scenario should register serving pressure.");
      return { overflowCost: game.lastMonth.overflowCost, burstCloudCost: game.lastMonth.burstCloudCost };
    }),
  },
  {
    name: "Competitor-heavy market, 48 weeks",
    run: () => withSeed(1005, () => {
      let game = createInitialGame("enterprise_copilot_company");
      const startingReleases = Object.values(game.competitorCompanies).reduce((sum: number, company: any) => sum + company.models.length, 0);
      Object.values(game.competitorCompanies).forEach((company: any) => {
        company.cash += 500000000;
        company.nextReleaseWeek = game.week;
        company.nextReleaseMonth = game.turn;
      });
      game = advanceWeeks(game, 48);
      const endingReleases = Object.values(game.competitorCompanies).reduce((sum: number, company: any) => sum + company.models.length, 0);
      assert(endingReleases > startingReleases, "Competitor-heavy scenario should add competitor releases.");
      assert(game.history.revenue.length === 12, "Expected twelve monthly reports after 48 weeks.");
      return { competitorModels: endingReleases, marketStandard: game.marketStandard };
    }),
  },
  {
    name: "Competitor pricing responds without drifting below launch floor",
    run: () => withSeed(1009, () => {
      let game = createInitialGame("consumer_ai_product_company");
      game = updateCompetitorAdmin(game, "titan", { behavior: "aggressive" });
      game = updateSubscriptionPlan(game, "pro_tier", { price: 5 });
      game.competitorCompanies.titan.nextReleaseWeek = 999;
      const initialModel = game.competitorCompanies.titan.models[0];
      const launchPrice = initialModel.launchChatPrice ?? initialModel.chatPrice;
      assert(launchPrice !== null, "Titan initial model should have a chat price.");
      game = advanceWeeks(game, 8);
      const cutModel = game.competitorCompanies.titan.models[0];
      const floor = (cutModel.launchChatPrice ?? launchPrice) * 0.55;
      assert(cutModel.chatPrice < launchPrice, "Competitor should cut chat price after review.");
      assert(cutModel.chatPrice >= floor, "Competitor chat price should respect launch floor.");
      assert(cutModel.chatPriceHistory.length <= 4, "Competitor price history should stay rolling.");
      game = advanceWeeks(game, 32);
      const laterModel = game.competitorCompanies.titan.models[0];
      assert(laterModel.launchChatPrice === launchPrice, "Launch price anchor should remain stable across rolling history.");
      assert(laterModel.chatPrice >= floor, "Repeated reviews should not ratchet below launch floor.");
      return { launchPrice, currentPrice: laterModel.chatPrice, history: laterModel.chatPriceHistory.length };
    }),
  },
  {
    name: "Cohort tenure slows switching churn",
    run: () => withSeed(1010, () => {
      let game = createInitialGame("enterprise_copilot_company");
      game = seedModel(game);
      const modelId = 9001;
      const cohortId = "finance";
      const baseUsers = 10000;
      const model = game.models.find((entry: any) => entry.id === modelId);
      assert(model, "Seeded model was missing.");
      model.capability = 1;
      model.goals = Object.fromEntries(Object.keys(model.goals).map((goalId) => [goalId, 1]));
      model.subscribersByCohort[cohortId] = baseUsers;
      game.products.api.modelIds = [modelId];
      game.products.api.modelPrices[String(modelId)] = 25000;

      const fluid = JSON.parse(JSON.stringify(game));
      const sticky = JSON.parse(JSON.stringify(game));
      fluid.models[0].cohortTenureWeeks[cohortId] = 0;
      sticky.models[0].cohortTenureWeeks[cohortId] = 52;

      settleGlobalMarket(fluid, 0, "week");
      settleGlobalMarket(sticky, 0, "week");

      const fluidUsers = fluid.models[0].subscribersByCohort[cohortId];
      const stickyUsers = sticky.models[0].subscribersByCohort[cohortId];
      assert(stickyUsers > fluidUsers, "High-tenure cohort should churn more slowly than low-tenure cohort.");
      assert(sticky.models[0].cohortTenureWeeks[cohortId] > fluid.models[0].cohortTenureWeeks[cohortId], "Tenure should continue tracking retained cohorts.");
      return { fluidUsers: Math.round(fluidUsers), stickyUsers: Math.round(stickyUsers) };
    }),
  },
  {
    name: "Negative cash liquidates after sustained deficit",
    run: () => withSeed(1006, () => {
      let game = createInitialGame("frontier_lab");
      game.cash = -1000000;
      game = advanceWeeks(game, 52);
      assert(game.status === "lost", "Negative-cash scenario should liquidate.");
      assert(game.deficitMonths >= 12, "Liquidation should require twelve deficit month-end checks.");
      return { week: game.week, deficitMonths: game.deficitMonths };
    }),
  },
  {
    name: "Datacenter build completes on weekly timer",
    run: () => withSeed(1007, () => {
      let game = createInitialGame("frontier_lab");
      const startingPods = game.cloud.reservedPods;
      game.cash += 50000000;
      game = buildDatacenter(game, 16);
      assert(game.cloud.plannedDatacenters.length === 1, "Datacenter order should be queued.");
      const orderedWeeks = game.cloud.plannedDatacenters[0].weeksRemaining;
      game = advanceWeeks(game, orderedWeeks);
      assert(game.cloud.plannedDatacenters.length === 0, "Datacenter should no longer be pending.");
      assert(game.cloud.reservedPods === startingPods + 16, "Datacenter capacity should be added after weekly timer.");
      return { week: game.week, reservedPods: game.cloud.reservedPods };
    }),
  },
];

const results = scenarios.map((scenario) => {
  const details = scenario.run();
  return { name: scenario.name, details };
});

console.log("Weekly scenario checks passed:");
results.forEach((result) => {
  console.log(" - " + result.name + " " + JSON.stringify(result.details));
});
`,
  "utf8",
);

try {
  const build = spawnSync(
    process.execPath,
    [esbuildScript, entryPath, "--bundle", "--platform=node", "--format=esm", `--outfile=${bundlePath}`, "--loader:.csv=text", "--log-level=warning"],
    { cwd: repoRoot, encoding: "utf8" },
  );

  if (build.status !== 0) {
    process.stderr.write(build.stdout);
    process.stderr.write(build.stderr);
    process.exit(build.status ?? 1);
  }

  const run = spawnSync(process.execPath, [bundlePath], { cwd: repoRoot, encoding: "utf8" });
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
