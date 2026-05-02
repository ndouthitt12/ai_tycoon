import React, { useState } from "react";

import { MODEL_GOALS, PRODUCT_TYPES } from "../game/defs";
import { WEEKS_PER_MONTH, formatVersion, getMarketComparison, getModelById, money, monthLabelFromWeek, pct, formatPods, formatBigParams, formatBigMemory, formatBigContext } from "../game/sim";
import { CohortId, GameState, ProductTypeId, ServingStrategyId, SubscriptionPlan } from "../game/types";
import { Badge, Button, EmptyState, MiniSparkline, Panel, SegmentedControl, StatRow, Tone } from "../components/ui";

const TH = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681] whitespace-nowrap";
const TD = "px-3 py-2.5 align-top text-sm text-[#e6edf3]";
const TR = "border-t border-[#21262d]";
const FIELD_ROW = "flex items-center justify-between gap-4 border-b border-[#161b22] py-2.5 last:border-0";
const INPUT_CLS = "w-full rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]";
const SECTION_LABEL = "mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]";

function getTrendPoints(points: number[], current: number) {
  return points.length ? points : [current, current];
}

function getMoneyTrend(points: number[]) {
  if (points.length < 2) {
    return { label: "Awaiting trend", tone: "default" as Tone };
  }

  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  const delta = current - previous;

  if (Math.abs(previous) >= 1) {
    const pctDelta = (delta / Math.abs(previous)) * 100;
    if (Number.isFinite(pctDelta) && Math.abs(pctDelta) < 1000) {
      return {
        label: `${pctDelta >= 0 ? "+" : ""}${pctDelta.toFixed(0)}% vs prior completed month`,
        tone: (delta > 0 ? "good" : delta < 0 ? "bad" : "default") as Tone,
      };
    }
  }

  return {
    label: `${delta >= 0 ? "+" : ""}${money(delta)} vs last month`,
    tone: (delta > 0 ? "good" : delta < 0 ? "bad" : "default") as Tone,
  };
}

function getDirectionalTrend(points: number[], inverse = false) {
  if (points.length < 2) {
    return { label: "Awaiting trend", tone: "default" as Tone };
  }

  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  const delta = Number((current - previous).toFixed(1));
  const positiveTone: Tone = inverse ? "bad" : "good";
  const negativeTone: Tone = inverse ? "good" : "bad";

  return {
    label: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pts vs last month`,
    tone: (delta > 0 ? positiveTone : delta < 0 ? negativeTone : "default") as Tone,
  };
}

const SERVING_STRATEGY_OPTIONS: { key: ServingStrategyId; label: string }[] = [
  { key: "flagship", label: "Flagship" },
  { key: "tiered", label: "Tiered" },
  { key: "cached", label: "Cached" },
  { key: "enterprise_sla", label: "Enterprise SLA" },
];

function getServingStrategyLabel(strategy: ServingStrategyId) {
  return SERVING_STRATEGY_OPTIONS.find((option) => option.key === strategy)?.label ?? strategy;
}

function getComputeDemandChangeLabel(product: GameState["products"][ProductTypeId]) {
  const baseline = product.traffic?.baselineTokensMillions ?? 0;
  const served = product.tokenUsageMillions ?? 0;
  const multiplier = product.traffic?.burstMultiplier ?? 1;
  if (baseline <= 0 || served <= 0) return "Demand is waiting on an active lineup.";

  const delta = served - baseline;
  if (Math.abs(delta) < 0.05) {
    return `Traffic is tracking baseline demand at ${baseline.toFixed(1)}M tokens.`;
  }

  const direction = delta > 0 ? "above" : "below";
  return `${served.toFixed(1)}M tokens last week, ${Math.abs(delta).toFixed(1)}M ${direction} baseline (${multiplier.toFixed(2)}x burst).`;
}

function getCostDriverLabel(product: GameState["products"][ProductTypeId]) {
  const contextPenalty = product.serving?.contextPenalty ?? 1;
  const batchingEfficiency = product.serving?.batchingEfficiency ?? 1;
  const pressure = product.serving?.capacityPressure ?? 0;

  if (pressure >= 0.35) return "Capacity pressure is the main cost driver right now.";
  if (contextPenalty >= 1.45) return "Long context load is dragging serving efficiency.";
  if (batchingEfficiency <= 0.9) return "Weak batching efficiency is making each pod less productive.";
  if ((product.traffic?.burstMultiplier ?? 1) >= 1.2) return "Burst demand is inflating serving cost ahead of capacity.";
  return "Serving cost is mostly being driven by normal model weight and baseline traffic.";
}

type LooseRecord = Record<string, unknown>;

function isLooseRecord(value: unknown): value is LooseRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPathValue(source: unknown, path: readonly string[]) {
  let current: unknown = source;

  for (const key of path) {
    if (!isLooseRecord(current)) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

function readFirstValue(sources: unknown[], paths: ReadonlyArray<readonly string[]>) {
  for (const source of sources) {
    for (const path of paths) {
      const value = getPathValue(source, path);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }

  return undefined;
}

function readNumberValue(sources: unknown[], paths: ReadonlyArray<readonly string[]>) {
  const value = readFirstValue(sources, paths);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readOperatingCashflowTotal(source: unknown) {
  if (!isLooseRecord(source)) return null;
  const direct = readNumberValue([source], [["netCashflow"], ["cashflow"], ["profit"]]);
  if (direct !== null) return direct;

  const cloudRentalRevenue = readNumberValue([source], [["cloudRentalRevenue"]]) ?? 0;
  const payroll = readNumberValue([source], [["payroll"]]) ?? 0;
  const marketingSpend = readNumberValue([source], [["marketingSpend"]]) ?? 0;
  const baseOpsCost = readNumberValue([source], [["baseOpsCost"]]) ?? 0;
  const loanPayments = readNumberValue([source], [["loanPayments"]]) ?? 0;
  const computeReservedCost = readNumberValue([source], [["computeReservedCost"]]) ?? 0;
  const developmentCost = readNumberValue([source], [["developmentCost"]]) ?? 0;
  const maintenanceCost = readNumberValue([source], [["maintenanceCost"]]) ?? 0;

  return cloudRentalRevenue - payroll - marketingSpend - baseOpsCost - loanPayments - computeReservedCost - developmentCost - maintenanceCost;
}

function readTextValue(sources: unknown[], paths: ReadonlyArray<readonly string[]>) {
  const value = readFirstValue(sources, paths);
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
}

function toTextList(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|[;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "string") {
        return entry.trim() ? [entry.trim()] : [];
      }
      if (isLooseRecord(entry)) {
        const nested = entry.label ?? entry.reason ?? entry.text ?? entry.name;
        return typeof nested === "string" && nested.trim() ? [nested.trim()] : [];
      }
      return [];
    });
  }
  return [];
}

function collectTextValues(sources: unknown[], paths: ReadonlyArray<readonly string[]>) {
  const values: string[] = [];

  for (const source of sources) {
    for (const path of paths) {
      values.push(...toTextList(getPathValue(source, path)));
    }
  }

  return Array.from(new Set(values));
}

function formatSurfaceLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPercentValue(value: number, digits = 0) {
  const percentValue = Math.abs(value) <= 1.5 ? value * 100 : value;
  return `${percentValue.toFixed(digits)}%`;
}

function formatSignedPercentValue(value: number, digits = 0) {
  const percentValue = Math.abs(value) <= 1.5 ? value * 100 : value;
  return `${percentValue >= 0 ? "+" : ""}${percentValue.toFixed(digits)}%`;
}

function formatMultiplier(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 2)}x`;
}

function formatSurfaceNumber(value: number) {
  if (Math.abs(value) >= 100) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (Math.abs(value) >= 10) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getProductSnapshot(lastMonth: unknown, productKey: ProductTypeId) {
  const paths: Array<readonly string[]> = [
    ["productEconomics", productKey],
    ["channelEconomics", productKey],
    ["productSurface", productKey],
    ["productBreakdown", productKey],
    ["channels", productKey],
    ["products", productKey],
    [productKey],
  ];

  for (const path of paths) {
    const value = getPathValue(lastMonth, path);
    if (isLooseRecord(value)) {
      return value;
    }
  }

  return null;
}

function CompanyMetric({
  label,
  value,
  deltaLabel,
  deltaTone,
  points,
}: {
  label: string;
  value: string;
  deltaLabel: string;
  deltaTone: Tone;
  points: number[];
}) {
  return (
    <div className="rounded-md bg-[#0d1117] p-4 border border-[#30363d]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[#c9d1d9]">{label}</div>
          <div className="mt-2 font-mono text-xl font-semibold tracking-tight text-[#e6edf3]">{value}</div>
          <div
            className={`mt-2 text-xs ${
              deltaTone === "good"
                ? "text-[#3fb950]"
                : deltaTone === "bad"
                  ? "text-[#f85149]"
                  : deltaTone === "warning"
                    ? "text-[#d29922]"
                    : "text-[#484f58]"
            }`}
          >
            {deltaLabel}
          </div>
        </div>
        <MiniSparkline points={points} tone={deltaTone} className="shrink-0" />
      </div>
    </div>
  );
}

function SurfaceMetricCard({
  label,
  value,
  tone = "default",
  helper,
}: {
  label: string;
  value: string;
  tone?: Tone;
  helper?: string;
}) {
  return (
    <div className="rounded-md bg-[#161b22] p-4 border border-[#30363d]">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#484f58]">{label}</div>
      <div
        className={`mt-2 font-mono text-xl font-semibold ${
          tone === "good"
            ? "text-[#3fb950]"
            : tone === "bad"
              ? "text-[#f85149]"
              : tone === "warning"
                ? "text-[#d29922]"
                : "text-[#e6edf3]"
        }`}
      >
        {value}
      </div>
      {helper ? <div className="mt-1 text-xs text-[#484f58]">{helper}</div> : null}
    </div>
  );
}

function ProductModelCard({
  modelId,
  name,
  version,
  capability,
  marketLabel,
  marketTone,
  memorySize,
  parameterScale,
  contextWindow,
  goals,
  priceValue,
  priceUnitLabel,
  step,
  onPriceChange,
}: {
  modelId: number;
  name: string;
  version: number;
  capability: number;
  marketLabel: string;
  marketTone: Tone;
  memorySize: number;
  parameterScale: number;
  contextWindow: number;
  goals: Array<[string, number]>;
  priceValue: number;
  priceUnitLabel: string;
  step: number;
  onPriceChange?: (value: string) => void;
}) {
  return (
    <div className="rounded-md bg-[#161b22] p-4 border border-[#30363d]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-base font-semibold text-[#e6edf3]">
            {name} v{formatVersion(version)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="default">#{modelId}</Badge>
            <Badge tone="default">Capability {capability}</Badge>
            <Badge tone={marketTone}>{marketLabel}</Badge>
          </div>
          <div className="mt-2 text-xs text-[#484f58]">
            {formatBigMemory(memorySize)} / {formatBigParams(parameterScale)} params / {formatBigContext(contextWindow)} ctx
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {goals.map(([goalId, weight]) => (
              <Badge key={goalId} tone="default">
                {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} {weight}
              </Badge>
            ))}
          </div>
        </div>

        {onPriceChange ? (
          <label className="text-xs sm:w-32">
            <div className="mb-1 text-[#484f58]">Price ({priceUnitLabel})</div>
            <input
              type="number"
              step={step}
              value={priceValue}
              onChange={(event) => onPriceChange(event.target.value)}
              className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

type ReleasedModelRow = {
  id: number;
  name: string;
  releaseWeek: number;
  releaseMonth: number;
  developmentCost: number;
  totalRevenueGenerated: number;
  totalProfitGenerated: number | null;
  lastWeekRevenueGenerated: number;
  lastWeekUsers: number;
  lastWeekAcquisition: number;
  lastWeekChurn: number;
  lastWeekTokenUsageMillions: number | null;
  lastWeekProfit: number | null;
  lastWeekCost: number | null;
  subscribersByCohort?: Record<CohortId, number>;
};

function getReleasedModelRows(game: GameState): ReleasedModelRow[] {
  return game.models.map((model) => {
    const performance = game.modelPerformance[String(model.id)] ?? {
      totalRevenue: 0,
      lastMonthRevenue: 0,
      lastMonthAcquisition: 0,
      lastMonthChurn: 0,
      lastMonthUsers: 0,
    };
    const performanceSources: unknown[] = [performance];

    return {
      id: model.id,
      name: model.name,
      releaseWeek: model.weekBuilt ?? (model.monthBuilt - 1) * WEEKS_PER_MONTH + 1,
      releaseMonth: model.monthBuilt,
      developmentCost: model.developmentCost,
      totalRevenueGenerated: readNumberValue(performanceSources, [["totalRevenue"], ["lifetimeRevenue"]]) ?? 0,
      totalProfitGenerated: readNumberValue(performanceSources, [["totalProfit"], ["lifetimeProfit"], ["profit"]]),
      lastWeekRevenueGenerated: readNumberValue(performanceSources, [["lastWeekRevenue"], ["weeklyRevenue"]]) ?? performance.lastMonthRevenue,
      lastWeekUsers: readNumberValue(performanceSources, [["lastWeekUsers"], ["weeklyUsers"]]) ?? performance.lastMonthUsers,
      lastWeekAcquisition: readNumberValue(performanceSources, [["lastWeekAcquisition"], ["weeklyAcquisition"]]) ?? performance.lastMonthAcquisition,
      lastWeekChurn: readNumberValue(performanceSources, [["lastWeekChurn"], ["weeklyChurn"]]) ?? performance.lastMonthChurn,
      lastWeekTokenUsageMillions: readNumberValue(performanceSources, [
        ["lastWeekTokenUsageMillions"],
        ["lastWeekTokensMillions"],
        ["weeklyTokenUsageMillions"],
        ["weeklyUsageMillions"],
      ]),
      lastWeekProfit: readNumberValue(performanceSources, [["lastWeekProfit"], ["weeklyProfit"]]),
      lastWeekCost: readNumberValue(performanceSources, [
        ["lastWeekCost"],
        ["lastWeekComputeCost"],
        ["lastWeekServingCost"],
        ["weeklyCost"],
        ["weeklyComputeCost"],
      ]),
      subscribersByCohort: model.subscribersByCohort,
    };
  });
}

export function OverviewScreen({
  game,
  arr,
  onAttachModel,
  onUpdateProductPrice,
  onUpdateProductServingStrategy,
  onUpdateSubscriptionPlan,
  onCreateSubscriptionPlan,
  onDeleteSubscriptionPlan,
  onRaiseFunding,
  onRestart,
}: {
  game: GameState;
  arr: number;
  onAttachModel: (productKey: ProductTypeId, modelId: string) => void;
  onUpdateProductPrice: (productKey: ProductTypeId, value: string, modelId?: string) => void;
  onUpdateProductServingStrategy: (productKey: ProductTypeId, strategy: ServingStrategyId) => void;
  onUpdateSubscriptionPlan: (planId: string, patch: Partial<SubscriptionPlan>) => void;
  onCreateSubscriptionPlan: () => void;
  onDeleteSubscriptionPlan: (planId: string) => void;
  onRaiseFunding: () => void;
  onRestart: () => void;
}) {
  const [activeProduct, setActiveProduct] = useState<ProductTypeId>("chatbot");
  const [activeView, setActiveView] = useState<"dashboard" | "models">("dashboard");
  const [expandedModelKey, setExpandedModelKey] = useState<number | null>(null);
  const currentWeek = typeof game.week === "number" && Number.isFinite(game.week) ? game.week : (game.turn - 1) * WEEKS_PER_MONTH + 1;
  const lastRaisedWeek = game.funding.lastRaisedWeek ?? ((game.funding.lastRaisedTurn ?? 0) > 0 ? ((game.funding.lastRaisedTurn ?? 0) - 1) * WEEKS_PER_MONTH + 1 : 0);
  const monthsUntilFunding = Math.max(0, Math.ceil((12 * WEEKS_PER_MONTH - (currentWeek - lastRaisedWeek)) / WEEKS_PER_MONTH));
  const product = game.products[activeProduct];
  const productDef = PRODUCT_TYPES[activeProduct];
  const attachedModels = product.modelIds
    .map((modelId) => getModelById(game, modelId))
    .filter((model): model is NonNullable<ReturnType<typeof getModelById>> => Boolean(model && model.postTrainingComplete !== false && model.retired !== true));
  const deployableModels = game.models.filter(
    (model) => model.postTrainingComplete !== false && model.retired !== true && model.deprecated !== true,
  );
  const averageCapability = attachedModels.length
    ? Math.round(attachedModels.reduce((sum, model) => sum + model.capability, 0) / attachedModels.length)
    : 0;
  const lineupComparison = getMarketComparison(averageCapability, game.marketStandard);
  const revenueTrend = getMoneyTrend(game.history.revenue);
  const profitTrend = getMoneyTrend(game.history.profit);
  const trustTrend = getDirectionalTrend(game.history.trust);
  const boardPressureTrend = getDirectionalTrend(game.history.boardPressure, true);
  const bestModelComparison = game.models.length
    ? getMarketComparison(Math.max(...game.models.map((model) => model.capability)), game.marketStandard)
    : null;
  const releasedModels = getReleasedModelRows(game);
  const showModelTotalProfit = releasedModels.some((model) => model.totalProfitGenerated !== null);
  const showModelUsage = releasedModels.some((model) => model.lastWeekTokenUsageMillions !== null);
  const showModelWeeklyProfit = releasedModels.some((model) => model.lastWeekProfit !== null);
  const showModelWeeklyCost = releasedModels.some((model) => model.lastWeekCost !== null);
  const maintenanceCost = readNumberValue([game.lastMonth, game.currentMonthCashflow], [
    ["maintenanceCost"],
    ["modelMaintenanceCost"],
    ["maintenance"],
  ]);
  const lastWeekRevenue = readNumberValue([game, game.lastWeek], [["lastWeekRevenue"], ["weeklyRevenue"], ["revenue"]]) ?? 0;
  const lastWeekComputeCost = readNumberValue([game, game.lastWeek], [["lastWeekComputeCost"], ["weeklyComputeCost"], ["computeCost"]]) ?? 0;
  const lastWeekProfit = readNumberValue([game, game.lastWeek], [["lastWeekProfit"], ["weeklyProfit"], ["profit"]]) ?? Math.round(lastWeekRevenue - lastWeekComputeCost);
  const currentMonthRevenue = readNumberValue([game, game.currentMonthToDate], [["currentMonthRevenue"], ["monthToDateRevenue"], ["revenue"]]) ?? lastWeekRevenue;
  const currentMonthComputeCost = readNumberValue([game, game.currentMonthToDate], [["currentMonthComputeCost"], ["monthToDateComputeCost"], ["computeCost"]]) ?? 0;
  const currentMonthProductProfit = Math.round(currentMonthRevenue - currentMonthComputeCost);
  const currentMonthOperatingCashflow = game.currentMonthCashflow.cloudRentalRevenue
    - game.currentMonthCashflow.payroll
    - game.currentMonthCashflow.marketingSpend
    - game.currentMonthCashflow.baseOpsCost
    - game.currentMonthCashflow.loanPayments
    - game.currentMonthCashflow.computeReservedCost
    - (game.currentMonthCashflow.developmentCost ?? 0)
    - (game.currentMonthCashflow.maintenanceCost ?? 0);
  const lastWeekCashflowSource = getPathValue(game, ["lastWeekCashflow"]) ?? getPathValue(game, ["weeklyCashflow"]);
  const lastWeekCashflow = readNumberValue([game, lastWeekCashflowSource], [
    ["lastWeekCashflow"],
    ["weeklyCashflow"],
    ["cashflow"],
    ["netCashflow"],
  ]) ?? readOperatingCashflowTotal(lastWeekCashflowSource);
  const weeklyRevenueTrend = {
    label: `${money(currentMonthRevenue)} MTD`,
    tone: (lastWeekRevenue >= game.lastMonth.revenue / WEEKS_PER_MONTH ? "good" : "default") as Tone,
  };
  const weeklyProfitTrend = {
    label: `${money(currentMonthProductProfit)} MTD product gross`,
    tone: (lastWeekProfit > 0 ? "good" : lastWeekProfit < 0 ? "bad" : "default") as Tone,
  };
  const productRecord = product as unknown as LooseRecord;
  const productSnapshot = getProductSnapshot(game.lastMonth, activeProduct);
  const productSources: unknown[] = [
    productRecord,
    getPathValue(productRecord, ["traffic"]),
    productSnapshot,
    getPathValue(productSnapshot, ["traffic"]),
    getPathValue(productSnapshot, ["serving"]),
    getPathValue(productSnapshot, ["economics"]),
    getPathValue(productSnapshot, ["surface"]),
  ];
  const lastMonthProductSources: unknown[] = [
    game.lastMonth,
    productSnapshot,
  ];
  const servingPosture = readTextValue(productSources, [
    ["servingStrategy"],
    ["servingPosture"],
    ["routingStrategy"],
    ["routingPosture"],
    ["posture"],
  ]);
  const servingPostureLabel = servingPosture ? formatSurfaceLabel(servingPosture) : null;
  const burstMultiplier = readNumberValue(productSources, [
    ["trafficSpikeMultiplier"],
    ["burstMultiplier"],
    ["demandSpikeMultiplier"],
    ["spikeMultiplier"],
    ["peakMultiplier"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["trafficSpikeMultiplier", activeProduct],
    ["trafficSpikeMultipliers", activeProduct],
    ["burstMultiplier", activeProduct],
    ["burstMultipliers", activeProduct],
  ]);
  const trafficSpikePctRaw = readNumberValue(productSources, [
    ["trafficSpikePct"],
    ["trafficSpikePercent"],
    ["burstPct"],
    ["trafficBurstPct"],
    ["demandSpikePct"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["trafficSpikePct", activeProduct],
    ["trafficSpikePercent", activeProduct],
    ["trafficSpikePcts", activeProduct],
  ]);
  const trafficSpikePct = trafficSpikePctRaw ?? (burstMultiplier !== null ? (burstMultiplier - 1) * 100 : null);
  const effectiveThroughput = readNumberValue(productSources, [
    ["effectiveThroughput"],
    ["effectiveTokensPerPod"],
    ["effectiveTokensMillionPerPod"],
    ["throughputPerPod"],
    ["tokensPerPod"],
    ["tokensPerPodMillions"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["effectiveThroughput", activeProduct],
    ["effectiveTokensPerPod", activeProduct],
  ]);
  const contextUtilization = readNumberValue(productSources, [
    ["averageContextUtilization"],
    ["contextUtilization"],
    ["averageContextLoad"],
    ["contextLoad"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["averageContextUtilization", activeProduct],
    ["contextUtilization", activeProduct],
  ]);
  const batchingEfficiency = readNumberValue(productSources, [
    ["batchingFriendliness"],
    ["batchingEfficiency"],
    ["batchEfficiency"],
    ["batchingScore"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["batchingEfficiency", activeProduct],
    ["batchingFriendliness", activeProduct],
  ]);
  const viralPressure = readNumberValue(productSources, [
    ["viralPressure"],
    ["viralityPressure"],
    ["demandPressure"],
    ["trafficPressure"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["viralPressure", activeProduct],
    ["viralityPressure", activeProduct],
  ]);
  const baselineTokens = readNumberValue(productSources, [
    ["baselineTokensMillions"],
    ["trafficBaselineTokensMillions"],
    ["baselineDemandMillions"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["baselineTokensMillions", activeProduct],
    ["trafficBaselineTokensMillions", activeProduct],
  ]);
  const grossMarginField = readNumberValue(productSources, [
    ["grossMarginPct"],
    ["grossMarginPercent"],
    ["grossMargin"],
    ["marginPct"],
    ["marginPercent"],
    ["margin"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["grossMarginPct", activeProduct],
    ["grossMargin", activeProduct],
  ]);
  const grossMarginPct = grossMarginField !== null
    ? (Math.abs(grossMarginField) <= 1.5 ? grossMarginField * 100 : grossMarginField)
    : product.revenue > 0
      ? ((product.revenue - product.computeCost) / product.revenue) * 100
      : null;
  const computeDemandDelta = readNumberValue(productSources, [
    ["computeDemandDelta"],
    ["computeDemandChange"],
    ["servingDemandDelta"],
    ["demandChange"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["computeDemandDelta", activeProduct],
    ["computeDemandChange", activeProduct],
    ["servingDemandDelta", activeProduct],
  ]);
  const computeDemandChangePctField = readNumberValue(productSources, [
    ["computeDemandChangePct"],
    ["computeDemandDeltaPct"],
    ["servingDemandChangePct"],
    ["demandChangePct"],
  ]) ?? readNumberValue(lastMonthProductSources, [
    ["computeDemandChangePct", activeProduct],
    ["computeDemandDeltaPct", activeProduct],
    ["servingDemandChangePct", activeProduct],
  ]);
  const computeDemandChangePct = computeDemandChangePctField !== null
    ? (Math.abs(computeDemandChangePctField) <= 1.5 ? computeDemandChangePctField * 100 : computeDemandChangePctField)
    : null;
  const explicitCostDrivers = collectTextValues(productSources, [
    ["costDrivers"],
    ["computeCostDrivers"],
    ["servingCostDrivers"],
    ["inferenceCostDrivers"],
  ]);
  const scopedCostDrivers = collectTextValues(lastMonthProductSources, [
    ["costDrivers", activeProduct],
    ["computeCostDrivers", activeProduct],
    ["servingCostDrivers", activeProduct],
    ["inferenceCostDrivers", activeProduct],
  ]);
  const explicitDemandDrivers = collectTextValues(productSources, [
    ["computeDemandDrivers"],
    ["computeDemandReasons"],
    ["demandDrivers"],
    ["demandChangeReasons"],
    ["whyComputeDemandChanged"],
    ["trafficDrivers"],
  ]);
  const scopedDemandDrivers = collectTextValues(lastMonthProductSources, [
    ["computeDemandDrivers", activeProduct],
    ["computeDemandReasons", activeProduct],
    ["demandChangeReasons", activeProduct],
    ["whyComputeDemandChanged", activeProduct],
    ["trafficDrivers", activeProduct],
  ]);
  const fallbackCostDrivers = [
    contextUtilization !== null && (Math.abs(contextUtilization) <= 1 ? contextUtilization * 100 : contextUtilization) >= 70
      ? "High context utilization is stretching serving weight."
      : null,
    batchingEfficiency !== null && (Math.abs(batchingEfficiency) <= 1 ? batchingEfficiency * 100 : batchingEfficiency) < 45
      ? "Weak batching efficiency is dragging throughput."
      : null,
    product.revenue > 0 && product.computeCost / product.revenue >= 0.6
      ? "Serving cost is absorbing an unusually large share of channel revenue."
      : null,
  ].filter((value): value is string => Boolean(value));
  const fallbackDemandDrivers = [
    trafficSpikePct !== null && trafficSpikePct >= 5
      ? `Traffic spiked ${formatSignedPercentValue(trafficSpikePct, 0)} versus the prior baseline.`
      : null,
    computeDemandChangePct !== null && Math.abs(computeDemandChangePct) >= 5
      ? `Compute demand moved ${formatSignedPercentValue(computeDemandChangePct, 0)} versus the prior weekly run rate.`
      : null,
    activeProduct === "api" && baselineTokens !== null
      ? `Baseline API load is running near ${formatSurfaceNumber(baselineTokens)}M tokens before burst traffic.`
      : null,
  ].filter((value): value is string => Boolean(value));
  const costDrivers = Array.from(new Set([...explicitCostDrivers, ...scopedCostDrivers])).slice(0, 3);
  const demandDrivers = Array.from(new Set([...explicitDemandDrivers, ...scopedDemandDrivers])).slice(0, 3);
  const displayedCostDrivers = (costDrivers.length ? costDrivers : fallbackCostDrivers).slice(0, 3);
  const displayedDemandDrivers = (demandDrivers.length ? demandDrivers : fallbackDemandDrivers).slice(0, 3);
  const inferenceSurfaceMetrics = [
    grossMarginPct !== null
      ? {
          label: "Gross Margin",
          value: formatPercentValue(grossMarginPct, 0),
          tone: (grossMarginPct >= 55 ? "good" : grossMarginPct >= 25 ? "warning" : "bad") as Tone,
          helper: product.revenue > 0 ? `${money(product.revenue - product.computeCost)} after serving` : undefined,
        }
      : null,
    trafficSpikePct !== null
      ? {
          label: "Traffic Spike",
          value: formatSignedPercentValue(trafficSpikePct, 0),
          tone: (trafficSpikePct >= 20 ? "warning" : trafficSpikePct > 0 ? "default" : "good") as Tone,
          helper: burstMultiplier !== null ? `${formatMultiplier(burstMultiplier)} burst vs baseline` : undefined,
        }
      : null,
    effectiveThroughput !== null
      ? {
          label: "Effective Throughput",
          value: formatSurfaceNumber(effectiveThroughput),
          tone: "default" as Tone,
          helper: "Observed serving efficiency",
        }
      : null,
    contextUtilization !== null
      ? {
          label: "Context Load",
          value: formatPercentValue(contextUtilization, 0),
          tone: ((Math.abs(contextUtilization) <= 1 ? contextUtilization * 100 : contextUtilization) >= 75 ? "warning" : "default") as Tone,
          helper: "Average context utilization",
        }
      : null,
    batchingEfficiency !== null
      ? {
          label: "Batching",
          value: formatPercentValue(batchingEfficiency, 0),
          tone: ((Math.abs(batchingEfficiency) <= 1 ? batchingEfficiency * 100 : batchingEfficiency) >= 65 ? "good" : (Math.abs(batchingEfficiency) <= 1 ? batchingEfficiency * 100 : batchingEfficiency) >= 40 ? "default" : "warning") as Tone,
          helper: "Serving friendliness",
        }
      : null,
    viralPressure !== null
      ? {
          label: "Demand Pressure",
          value: formatPercentValue(viralPressure, 0),
          tone: ((Math.abs(viralPressure) <= 1 ? viralPressure * 100 : viralPressure) >= 70 ? "warning" : "default") as Tone,
          helper: "Growth-driven compute stress",
        }
      : null,
    computeDemandChangePct !== null
      ? {
          label: "Demand Change",
          value: formatSignedPercentValue(computeDemandChangePct, 0),
          tone: (computeDemandChangePct >= 15 ? "warning" : computeDemandChangePct <= -10 ? "good" : "default") as Tone,
          helper: computeDemandDelta !== null ? `${formatSurfaceNumber(computeDemandDelta)} pod delta` : undefined,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; tone: Tone; helper?: string }>;
  const trafficSpikeBadgeLabel = trafficSpikePct !== null && Math.abs(trafficSpikePct) >= 5
    ? `${trafficSpikePct >= 0 ? "+" : ""}${Math.round(trafficSpikePct)}% traffic`
    : burstMultiplier !== null && Math.abs(burstMultiplier - 1) >= 0.05
      ? `${formatMultiplier(burstMultiplier)} burst`
      : null;

  return (
    <div className="space-y-5">
      <SegmentedControl
        options={[
          { key: "dashboard", label: "Overview" },
          { key: "models", label: "Released Models" },
        ]}
        activeKey={activeView}
        onChange={(key) => setActiveView(key)}
      />

      {activeView === "dashboard" ? (
        <div className="grid gap-5 xl:grid-cols-[1.52fr_0.82fr]">
      <div className="space-y-5">
        <Panel
          title="Product Portfolio"
          subtitle="Product users, revenue, cost, acquisition, and churn update every week."
          right={<Badge tone={arr >= 10000000 ? "good" : "default"}>ARR {money(arr)}</Badge>}
        >
          <div className="space-y-5">
            <SegmentedControl<ProductTypeId>
              options={[
                { key: "chatbot", label: "Consumer Chatbot" },
                { key: "api", label: "B2B API" },
              ]}
              activeKey={activeProduct}
              onChange={(key) => setActiveProduct(key)}
            />

            <div className="rounded-md bg-[#0d1117] p-4 border border-[#30363d]">
              <div className="overflow-hidden rounded-md border border-[#30363d]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#161b22]">
                      <th className={TH}>Product Line</th>
                      <th className={TH}>Users</th>
                      <th className={TH}>Market</th>
                      <th className={TH}>Last Week Revenue</th>
                      <th className={TH}>Compute</th>
                      <th className={TH}>Throughput</th>
                      <th className={TH}>Demand</th>
                      <th className={TH}>Weekly Acq / Churn</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={TR}>
                      <td className={TD}>
                        <div className="font-medium text-[#e6edf3]">{productDef.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {servingPostureLabel ? <Badge tone="default">{servingPostureLabel}</Badge> : null}
                          {trafficSpikeBadgeLabel ? <Badge tone={trafficSpikePct !== null && trafficSpikePct >= 20 ? "warning" : "default"}>{trafficSpikeBadgeLabel}</Badge> : null}
                        </div>
                      </td>
                      <td className={TD + " font-mono text-[#8b949e]"}>
                        {activeProduct === "api" ? product.activeUsers.toFixed(1) : product.activeUsers.toLocaleString()}
                      </td>
                      <td className={TD}>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={attachedModels.length ? lineupComparison.tone : "default"}>
                            {attachedModels.length ? lineupComparison.label : "No comparison"}
                          </Badge>
                          {attachedModels.length ? <Badge tone="default">Avg Cap {averageCapability}</Badge> : null}
                        </div>
                      </td>
                      <td className={TD + " font-mono text-[#3fb950]"}>{money(product.revenue)}</td>
                      <td className={TD + " font-mono text-[#8b949e]"}>{formatPods(product.computeDemand)} pods</td>
                      <td className={TD + " font-mono text-[#8b949e]"}>{(product.serving?.effectiveTokensPerPod ?? 0).toFixed(1)}M</td>
                      <td className={TD + " font-mono text-[#8b949e]"}>
                        {activeProduct === "api"
                          ? `${product.tokenUsageMillions.toLocaleString(undefined, { maximumFractionDigits: 2 })}M tokens`
                          : `${(product.traffic?.burstMultiplier ?? 1).toFixed(2)}x burst`}
                      </td>
                      <td className={TD}>
                        <div className="font-mono text-[#3fb950]">{activeProduct === "api" ? product.acquisition.toFixed(1) : product.acquisition.toLocaleString()}</div>
                        <div className="text-xs font-mono text-[#f85149]">{pct(product.churn)}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
                <div className="space-y-4">
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-[#c9d1d9]">Active Lineup</div>
                      <Button
                        onClick={() => onAttachModel(activeProduct, "")}
                        variant="ghost"
                        disabled={attachedModels.length === 0}
                        className="px-3 py-1.5 text-xs"
                      >
                        Clear Lineup
                      </Button>
                    </div>

                    {attachedModels.length > 0 ? (
                      <div className="overflow-x-auto rounded-md border border-[#30363d]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[#161b22]">
                              <th className={TH}>Model</th>
                              <th className={TH}>Capability</th>
                              <th className={TH}>Market</th>
                              <th className={TH}>Specs</th>
                              <th className={TH}>Goals</th>
                              <th className={TH}>Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attachedModels.map((model) => {
                              const comparison = getMarketComparison(model.capability, game.marketStandard);
                              const goals = Object.entries(model.goals).filter(([, weight]) => weight > 0).slice(0, 3) as Array<[string, number]>;

                              return (
                                <tr key={model.id} className={TR}>
                                  <td className={TD}>
                                    <div className="font-medium text-[#e6edf3]">{model.name}</div>
                                    <div className="text-xs text-[#8b949e]">#{model.id} / v{formatVersion(model.version)}</div>
                                  </td>
                                  <td className={TD + " font-mono text-[#3fb950]"}>{model.capability}</td>
                                  <td className={TD}><Badge tone={comparison.tone}>{comparison.label}</Badge></td>
                                  <td className={TD + " font-mono text-xs text-[#8b949e]"}>
                                    {formatBigMemory(model.memorySize)} / {formatBigParams(model.parameterScale)} / {formatBigContext(model.contextWindow)}
                                  </td>
                                  <td className={TD}>
                                    <div className="flex flex-wrap gap-1.5">
                                      {goals.map(([goalId, weight]) => (
                                        <Badge key={goalId} tone="default">
                                          {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} {weight}
                                        </Badge>
                                      ))}
                                    </div>
                                  </td>
                                  <td className={TD}>
                                    {activeProduct === "api" ? (
                                      <input
                                        type="number"
                                        step={productDef.step}
                                        value={product.modelPrices[String(model.id)] ?? product.price}
                                        onChange={(event) => onUpdateProductPrice(activeProduct, event.target.value, String(model.id))}
                                        className={INPUT_CLS + " w-24 text-right font-mono"}
                                      />
                                    ) : (
                                      <span className="font-mono text-[#8b949e]">{money(product.modelPrices[String(model.id)] ?? product.price)}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-md bg-[#161b22]/60 px-4 py-5 text-sm text-[#484f58] border border-[#30363d]">
                        Product is offline until at least one model is active.
                      </div>
                    )}
                  </div>

                  <div className="rounded-md bg-[#0d1117] p-4 border border-[#30363d]">
                    <div className="text-sm font-medium text-[#c9d1d9]">Available Models</div>
                    {deployableModels.length === 0 ? (
                      <div className="mt-3 text-sm text-[#484f58]">Complete post-training in the Lab before attaching a model.</div>
                    ) : (
                      <div className="mt-3 overflow-x-auto rounded-md border border-[#30363d]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[#161b22]">
                              <th className={TH}>Model</th>
                              <th className={TH}>Cap</th>
                              <th className={TH}>Specs</th>
                              <th className={TH}>Market</th>
                              <th className={TH}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {deployableModels.map((option) => {
                              const comparison = getMarketComparison(option.capability, game.marketStandard);
                              const active = product.modelIds.includes(option.id);

                              return (
                                <tr key={option.id} className={`${TR} ${active ? "bg-[#0d1a2e]/60" : ""}`}>
                                  <td className={TD}>
                                    <div className="font-medium text-[#e6edf3]">{option.name} v{formatVersion(option.version)}</div>
                                    <div className="text-xs text-[#8b949e]">#{option.id}</div>
                                  </td>
                                  <td className={TD + " font-mono text-[#3fb950]"}>{option.capability}</td>
                                  <td className={TD + " font-mono text-xs text-[#8b949e]"}>
                                    {formatBigMemory(option.memorySize)} / {formatBigParams(option.parameterScale)} / {formatBigContext(option.contextWindow)}
                                  </td>
                                  <td className={TD}><Badge tone={comparison.tone}>{comparison.label}</Badge></td>
                                  <td className="px-3 py-2 text-right">
                                    <Button onClick={() => onAttachModel(activeProduct, String(option.id))} variant={active ? "secondary" : "ghost"}>
                                      {active ? "Active" : "Attach"}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-md bg-[#0d1117] p-4 border border-[#30363d]">
                    <div className="text-sm font-medium text-[#c9d1d9]">Serving Posture</div>
                    <div className="mt-1 text-sm text-[#484f58]">Set the operating stance for quality, margin, and latency discipline.</div>
                    <label className="mt-4 block text-sm">
                      <div className="mb-1 text-[#8b949e]">Routing Strategy</div>
                      <select
                        value={product.servingStrategy}
                        onChange={(event) => onUpdateProductServingStrategy(activeProduct, event.target.value as ServingStrategyId)}
                        className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
                      >
                        {SERVING_STRATEGY_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone="default">{getServingStrategyLabel(product.servingStrategy)}</Badge>
                      <Badge tone={(product.serving?.capacityPressure ?? 0) > 0.3 ? "warning" : "default"}>
                        Pressure {(product.serving?.capacityPressure ?? 0).toFixed(2)}
                      </Badge>
                    </div>
                  </div>

                  {activeProduct === "api" ? (
                    <div className="rounded-md bg-[#0d1117] p-4 border border-[#30363d]">
                      <div className="text-sm font-medium text-[#c9d1d9]">Deployment Defaults</div>
                      <div className="mt-1 text-sm text-[#484f58]">New models inherit this price until you override them.</div>
                      <label className="mt-4 block text-sm">
                        <div className="mb-1 text-[#8b949e]">Default Price For New Models ({productDef.priceUnitLabel})</div>
                        <input
                          type="number"
                          step={productDef.step}
                          value={product.price}
                          onChange={(event) => onUpdateProductPrice(activeProduct, event.target.value)}
                          className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="rounded-md bg-[#0d1117] p-4 border border-[#30363d]">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-[#c9d1d9]">Subscription Plans</div>
                        <Button variant="ghost" onClick={onCreateSubscriptionPlan} className="px-2 py-1 text-xs">
                          + New Plan
                        </Button>
                      </div>
                      <div className="mt-4 space-y-4">
                        {product.subscriptionPlans?.map(plan => (
                          <div key={plan.id} className="rounded border border-[#30363d] bg-[#161b22]/70 p-3">
                            <div className="flex justify-between items-start mb-2">
                              <input
                                className="bg-transparent font-medium text-[#e6edf3] outline-none w-32 border-b border-transparent focus:border-[#58a6ff] focus:bg-[#0d1117]"
                                value={plan.name}
                                onChange={(e) => onUpdateSubscriptionPlan(plan.id, { name: e.target.value })}
                              />
                              <button onClick={() => onDeleteSubscriptionPlan(plan.id)} className="text-[#f85149] opacity-60 hover:opacity-100 text-xs">
                                Remove
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <label className="text-xs">
                                <div className="text-[#484f58] mb-1">Price/mo</div>
                                <input
                                  type="number"
                                  className="w-full rounded bg-[#0d1117] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] border border-[#30363d]"
                                  value={plan.price || 0}
                                  onChange={(e) => onUpdateSubscriptionPlan(plan.id, { price: Number(e.target.value) || 0 })}
                                />
                              </label>
                              <label className="text-xs">
                                <div className="text-[#484f58] mb-1">Tokens (K)</div>
                                <input
                                  type="number"
                                  className="w-full rounded bg-[#0d1117] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff] border border-[#30363d]"
                                  value={(plan.tokenLimitMillions || 0) * 1000}
                                  onChange={(e) => onUpdateSubscriptionPlan(plan.id, { tokenLimitMillions: (Number(e.target.value) || 0) / 1000 })}
                                />
                              </label>
                            </div>
                            <div className="mt-2 text-xs text-[#8b949e] space-y-1">
                              <div className="flex justify-between"><span>Subscribers</span><span className="text-[#c9d1d9]">{plan.subscribers.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></div>
                              <div className="flex justify-between"><span>Weekly Revenue</span><span className="text-[#c9d1d9]">{money(plan.revenue)}</span></div>
                              <div className="flex justify-between"><span>Usage (M)</span><span className="text-[#c9d1d9]">{plan.tokenUsageMillions.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-md bg-[#0d1117] p-4 border border-[#30363d]">
                    <div className="text-sm font-medium text-[#c9d1d9]">Channel Readout</div>
                    <div className="mt-4 space-y-3">
                      <StatRow label="Last Week Revenue" value={money(product.revenue)} tone={product.revenue > product.computeCost ? "good" : "warning"} />
                      <StatRow label="Serving Cost" value={money(product.computeCost)} />
                      {activeProduct === "api" ? (
                        <StatRow
                          label="Last Week Token Usage"
                          value={`${product.tokenUsageMillions.toLocaleString(undefined, { maximumFractionDigits: 2 })}M`}
                        />
                      ) : null}
                      <StatRow label="Product Trust" value={product.trust.toFixed(1)} tone={product.trust >= 60 ? "good" : product.trust >= 45 ? "warning" : "bad"} />
                      <StatRow
                        label={activeProduct === "chatbot" ? "Consumer Reach" : "Enterprise Reach"}
                        value={activeProduct === "chatbot" ? game.distribution.consumer.toFixed(1) : game.distribution.enterprise.toFixed(1)}
                      />
                    </div>

                    {inferenceSurfaceMetrics.length > 0 ? (
                      <div className="mt-4 border-t border-[#21262d] pt-4">
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#484f58]">Inference Surface</div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {inferenceSurfaceMetrics.map((metric) => (
                            <SurfaceMetricCard
                              key={metric.label}
                              label={metric.label}
                              value={metric.value}
                              tone={metric.tone}
                              helper={metric.helper}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 border-t border-[#21262d] pt-4 space-y-3">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#484f58]">Cost Drivers</div>
                        {displayedCostDrivers.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {displayedCostDrivers.map((driver) => (
                              <span
                                key={`cost-${driver}`}
                                className="rounded-full bg-[#161b22] px-3 py-1.5 text-xs text-[#c9d1d9] border border-[#30363d]"
                              >
                                {driver}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-[#484f58]">Detailed cost drivers will appear here as serving fields land.</div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#484f58]">Why Demand Changed</div>
                        {displayedDemandDrivers.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {displayedDemandDrivers.map((driver) => (
                              <div
                                key={`demand-${driver}`}
                                className="rounded-md bg-[#161b22]/70 px-3 py-2 text-sm text-[#c9d1d9] border border-[#30363d]"
                              >
                                {driver}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-[#484f58]">The sim has not exposed product-scoped demand-change reasons yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Alerts" subtitle="Recent product, training, market, and board updates.">
          <div className="space-y-3">
            {game.notifications.map((note) => (
              <div key={note.id} className="rounded border border-[#30363d] bg-[#0d1117] p-3">
                <div className="flex items-start gap-3">
                  <Badge tone={note.tone === "info" ? "default" : note.tone}>{note.tone}</Badge>
                  <div className="text-sm leading-6 text-[#c9d1d9]">{note.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel title="Company Health" subtitle="Last-week operating results lead; completed-month totals remain as planning context.">
          <div className="space-y-5">
            <div>
              <div className="text-sm font-medium text-[#c9d1d9]">Financials</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <CompanyMetric
                  label="Last Week Revenue"
                  value={money(lastWeekRevenue)}
                  deltaLabel={weeklyRevenueTrend.label}
                  deltaTone={weeklyRevenueTrend.tone}
                  points={[game.lastMonth.revenue / WEEKS_PER_MONTH, lastWeekRevenue]}
                />
                <CompanyMetric
                  label="Last Week Gross Profit"
                  value={money(lastWeekProfit)}
                  deltaLabel={weeklyProfitTrend.label}
                  deltaTone={weeklyProfitTrend.tone}
                  points={[game.lastMonth.profit / WEEKS_PER_MONTH, lastWeekProfit]}
                />
              </div>
              <div className="mt-4 space-y-3 rounded-md bg-[#0d1117] p-4 border border-[#30363d]">
                <StatRow label="ARR" value={money(arr)} tone={arr >= 10000000 ? "good" : "default"} />
                <StatRow label="Last Week Compute Cost" value={money(lastWeekComputeCost)} tone={lastWeekComputeCost > 0 ? "warning" : "default"} />
                {lastWeekCashflow !== null ? (
                  <StatRow label="Last Week Cashflow" value={money(lastWeekCashflow)} tone={lastWeekCashflow >= 0 ? "good" : "bad"} />
                ) : (
                  <StatRow label="Current Month Cashflow" value={money(currentMonthOperatingCashflow)} tone={currentMonthOperatingCashflow >= 0 ? "good" : "bad"} />
                )}
                <StatRow label="Current Month Revenue" value={money(currentMonthRevenue)} />
                <StatRow label="Current Month Gross Profit" value={money(currentMonthProductProfit)} tone={currentMonthProductProfit >= 0 ? "good" : "bad"} />
                <StatRow label="Completed Month Revenue" value={money(game.lastMonth.revenue)} />
                <StatRow label="Completed Month Profit" value={money(game.lastMonth.profit)} tone={game.lastMonth.profit >= 0 ? "good" : "bad"} />
                <StatRow label="Reserved Cloud Cost MTD" value={money(game.currentMonthCashflow.computeReservedCost)} />
                <StatRow label="Payroll MTD" value={money(game.currentMonthCashflow.payroll)} />
                <StatRow label="Marketing Spend MTD" value={money(game.currentMonthCashflow.marketingSpend)} tone={game.currentMonthCashflow.marketingSpend > 0 ? "warning" : "default"} />
                <StatRow label="Base Operations MTD" value={money(game.currentMonthCashflow.baseOpsCost ?? 0)} />
                <StatRow label="Training Burn MTD" value={money(game.currentMonthCashflow.developmentCost ?? 0)} tone={(game.currentMonthCashflow.developmentCost ?? 0) > 0 ? "warning" : "default"} />
                {maintenanceCost !== null ? (
                  <StatRow label="Maintenance MTD" value={money(game.currentMonthCashflow.maintenanceCost ?? maintenanceCost)} tone={(game.currentMonthCashflow.maintenanceCost ?? maintenanceCost) > 0 ? "warning" : "default"} />
                ) : null}
                <StatRow label="Loan Payments MTD" value={money(game.currentMonthCashflow.loanPayments ?? 0)} tone={(game.currentMonthCashflow.loanPayments ?? 0) > 0 ? "warning" : "default"} />
                <StatRow label="Funding Window" value={game.funding.available ? money(game.funding.offer) : `${monthsUntilFunding} mo`} />
                <StatRow label="Dilution" value={game.funding.available ? pct(game.funding.dilution) : pct(game.totalDilution)} />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-[#c9d1d9]">Operating Metrics</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <CompanyMetric
                  label="Company Trust"
                  value={game.trust.toFixed(1)}
                  deltaLabel={trustTrend.label}
                  deltaTone={trustTrend.tone}
                  points={getTrendPoints(game.history.trust, game.trust)}
                />
                <CompanyMetric
                  label="Board Pressure"
                  value={game.boardPressure.toFixed(1)}
                  deltaLabel={boardPressureTrend.label}
                  deltaTone={boardPressureTrend.tone}
                  points={getTrendPoints(game.history.boardPressure, game.boardPressure)}
                />
              </div>
              <div className="mt-4 space-y-3 rounded-md bg-[#0d1117] p-4 border border-[#30363d]">
                <StatRow label="Consumer Distribution" value={game.distribution.consumer.toFixed(1)} />
                <StatRow label="Enterprise Distribution" value={game.distribution.enterprise.toFixed(1)} />
                <StatRow label="Market Standard" value={game.marketStandard} tone="warning" />
                <StatRow label="Best Model Vs Market" value={bestModelComparison ? bestModelComparison.label : "No models"} tone={bestModelComparison ? bestModelComparison.tone : "default"} />
                <StatRow label="Models Shipped" value={game.models.length} />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-[#c9d1d9]">Actions</div>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button onClick={onRaiseFunding} variant="primary" disabled={!game.funding.available}>
                  Raise Round
                </Button>
                <Button onClick={onRestart} variant="ghost">
                  Return To Archetypes
                </Button>
              </div>
            </div>
          </div>
        </Panel>

        {game.models.length === 0 ? (
          <EmptyState
            title="No shipped models yet"
            body="Use the Lab to launch a run. Products stay offline until a model ships."
          />
        ) : null}
      </div>
      </div>
      ) : (
          <Panel
            title="Released Models"
            subtitle="Release timing and active model metrics are weekly; lifetime totals stay cumulative."
          >
            {releasedModels.length === 0 ? (
              <EmptyState title="No released models yet" body="Launch a run in the Lab to populate this table." />
            ) : (
              <div className="overflow-x-auto rounded-md border border-[#30363d] bg-[#0d1117]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#161b22] text-[#c9d1d9]">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Release Week</th>
                      <th className="px-4 py-3 text-left font-medium">Dev Cost</th>
                      <th className="px-4 py-3 text-left font-medium">Total Revenue</th>
                      {showModelTotalProfit ? <th className="px-4 py-3 text-left font-medium">Total Profit</th> : null}
                      <th className="px-4 py-3 text-left font-medium">Last Week Revenue</th>
                      {showModelWeeklyCost ? <th className="px-4 py-3 text-left font-medium">Last Week Cost</th> : null}
                      {showModelWeeklyProfit ? <th className="px-4 py-3 text-left font-medium">Last Week Profit</th> : null}
                      {showModelUsage ? <th className="px-4 py-3 text-left font-medium">Last Week Usage</th> : null}
                      <th className="px-4 py-3 text-left font-medium">Last Week Users</th>
                      <th className="px-4 py-3 text-left font-medium">Last Week Acquisition</th>
                      <th className="px-4 py-3 text-left font-medium">Last Week Churn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releasedModels.map((model) => {
                      const isExpanded = expandedModelKey === model.id;
                      const toggleExpand = () => setExpandedModelKey(isExpanded ? null : model.id);
                      
                      const totalSubscribers = model.subscribersByCohort
                        ? Object.values(model.subscribersByCohort).reduce((a, b) => a + Number(b), 0)
                        : 0;
                        
                      return (
                        <React.Fragment key={model.id}>
                          <tr onClick={toggleExpand} className="cursor-pointer border-t border-[#21262d] text-[#c9d1d9] hover:bg-[#161b22]/70">
                            <td className="px-4 py-3 font-medium text-[#e6edf3]">{model.name}</td>
                            <td className="px-4 py-3 font-mono">W{model.releaseWeek} / {monthLabelFromWeek(model.releaseWeek)}</td>
                            <td className="px-4 py-3 font-mono">{money(model.developmentCost)}</td>
                            <td className="px-4 py-3 font-mono">{money(model.totalRevenueGenerated)}</td>
                            {showModelTotalProfit ? <td className="px-4 py-3 font-mono">{model.totalProfitGenerated !== null ? money(model.totalProfitGenerated) : "Pending"}</td> : null}
                            <td className="px-4 py-3 font-mono">{money(model.lastWeekRevenueGenerated)}</td>
                            {showModelWeeklyCost ? <td className="px-4 py-3 font-mono">{model.lastWeekCost !== null ? money(model.lastWeekCost) : "Pending"}</td> : null}
                            {showModelWeeklyProfit ? <td className="px-4 py-3 font-mono">{model.lastWeekProfit !== null ? money(model.lastWeekProfit) : "Pending"}</td> : null}
                            {showModelUsage ? (
                              <td className="px-4 py-3 font-mono">
                                {model.lastWeekTokenUsageMillions !== null
                                  ? `${model.lastWeekTokenUsageMillions.toLocaleString(undefined, { maximumFractionDigits: 1 })}M`
                                  : "Pending"}
                              </td>
                            ) : null}
                            <td className="px-4 py-3 font-mono">
                              {model.lastWeekUsers.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </td>
                            <td className="px-4 py-3 font-mono">
                              {model.lastWeekAcquisition.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </td>
                            <td className="px-4 py-3 font-mono">{pct(model.lastWeekChurn)}</td>
                          </tr>
                          {isExpanded && model.subscribersByCohort && (
                            <tr className="bg-[#161b22]/70 transition-all">
                              <td colSpan={8 + (showModelTotalProfit ? 1 : 0) + (showModelWeeklyCost ? 1 : 0) + (showModelWeeklyProfit ? 1 : 0) + (showModelUsage ? 1 : 0)} className="px-4 py-4 border-b border-[#30363d]">
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-wrap items-center gap-5 text-sm text-[#c9d1d9]">
                                    <div className="w-48 font-medium text-[#e6edf3] uppercase tracking-widest text-[10px]">Subscriber Core Demographics</div>
                                    {totalSubscribers === 0 ? (
                                      <div className="text-[#484f58] italic">No market penetration</div>
                                    ) : (
                                      Object.entries(model.subscribersByCohort).map(([cohortId, count]) => {
                                        const share = ((Number(count) / totalSubscribers) * 100).toFixed(1);
                                        const def = game.globalCohorts[cohortId as CohortId];
                                        if (!def) return null;
                                        return (
                                          <div key={`share-${cohortId}`} className="flex flex-col">
                                            <span className="font-medium">{def.name}</span>
                                            <span className="font-mono text-xs text-[#8b949e]">
                                              {share}% ({Number(count).toLocaleString()})
                                            </span>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-5 text-sm text-[#c9d1d9] border-t border-[#21262d] pt-2">
                                    <div className="w-48 font-medium text-[#e6edf3] uppercase tracking-widest text-[10px]">Market Penetration</div>
                                    {Object.entries(model.subscribersByCohort).map(([cohortId, count]) => {
                                      const def = game.globalCohorts[cohortId as CohortId];
                                      if (!def) return null;
                                      const penetration = ((Number(count) / def.population) * 100).toFixed(2);
                                      return (
                                        <div key={`pen-${cohortId}`} className="flex flex-col">
                                          <span className="font-medium text-xs text-[#8b949e]">{def.name} Penetration</span>
                                          <span className="font-mono text-xs text-[#d29922]">
                                            {penetration}%
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}
    </div>
  );
}
