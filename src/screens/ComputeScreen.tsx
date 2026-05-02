import { Fragment, useState } from "react";

import { MODEL_GOALS } from "../game/defs";
import { CLOUD_RENTAL_MARKET_RATE, WEEKS_PER_MONTH, formatPods, formatVersion, getDatacenterBuildCost, getReservedCostPerPod, money } from "../game/sim";
import { GameState } from "../game/types";
import { Badge, Button, EmptyState, KpiCard, LossCurve, Panel, StatRow } from "../components/ui";

type Tone = "default" | "good" | "warning" | "bad";
type UnknownRecord = Record<string, unknown>;

const TH = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681] whitespace-nowrap";
const TD = "px-3 py-2.5 align-top text-sm text-[#e6edf3]";
const TR = "border-t border-[#21262d]";
const FIELD_ROW = "flex items-center justify-between gap-4 border-b border-[#161b22] py-2.5 last:border-0";
const INPUT_CLS = "w-full rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-[#58a6ff]";
const SECTION_LABEL = "mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]";

type PlannedDatacenterInfo = {
  id: string;
  pods: number;
  quantity: number;
  etaWeeks: number | null;
  buildCost: number | null;
};

type ServingProductInfo = {
  id: string;
  label: string;
  computeDemand: number;
  computeCost: number;
  revenue: number;
  trust: number;
  activeUsers: number;
  acquisition: number;
  churn: number;
  servingStrategy: string | null;
  assignedModels: string[];
  contextUtilizationPct: number | null;
  batchingEfficiencyPct: number | null;
  effectiveTokensPerPod: number | null;
  throughputEfficiencyPct: number | null;
  burstMultiplier: number | null;
  burstCloudPods: number | null;
  queuedCapacityPods: number | null;
  trafficPressurePct: number | null;
  viralPressurePct: number | null;
  provisioningLeadTimeMonths: number | null;
};

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? value as UnknownRecord : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function readNumber(source: unknown, ...keys: string[]) {
  const record = asRecord(source);
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function readString(source: unknown, ...keys: string[]) {
  const record = asRecord(source);
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function readRecord(source: unknown, ...keys: string[]) {
  const record = asRecord(source);
  if (!record) return null;

  for (const key of keys) {
    const nested = asRecord(record[key]);
    if (nested) return nested;
  }

  return null;
}

function readOperatingCashflowTotal(source: unknown) {
  const record = asRecord(source);
  if (!record) return null;
  const direct = readNumber(record, "netCashflow", "cashflow", "profit");
  if (direct !== null) return direct;

  const cloudRentalRevenue = readNumber(record, "cloudRentalRevenue") ?? 0;
  const payroll = readNumber(record, "payroll") ?? 0;
  const marketingSpend = readNumber(record, "marketingSpend") ?? 0;
  const baseOpsCost = readNumber(record, "baseOpsCost") ?? 0;
  const loanPayments = readNumber(record, "loanPayments") ?? 0;
  const computeReservedCost = readNumber(record, "computeReservedCost") ?? 0;
  const developmentCost = readNumber(record, "developmentCost") ?? 0;
  const maintenanceCost = readNumber(record, "maintenanceCost") ?? 0;

  return cloudRentalRevenue - payroll - marketingSpend - baseOpsCost - loanPayments - computeReservedCost - developmentCost - maintenanceCost;
}

function readArray(source: unknown, ...keys: string[]) {
  const record = asRecord(source);
  if (!record) return null;

  for (const key of keys) {
    const nested = asArray(record[key]);
    if (nested) return nested;
  }

  return null;
}

function normalizePercentLike(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  if (value <= 1) return value * 100;
  return value;
}

function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

function formatMetricMonths(value: number | null) {
  if (value === null) return "Unknown ETA";
  if (value <= 1) return "1 mo";
  return `${value.toFixed(0)} mo`;
}

function formatMetricWeeks(value: number | null) {
  if (value === null) return "Unknown ETA";
  if (value <= 1) return "1 wk";
  return `${value.toFixed(0)} wks`;
}

function getRunTotalWeeks(run: GameState["activeRuns"][number]) {
  if (typeof run.totalWeeks === "number" && Number.isFinite(run.totalWeeks)) {
    return Math.max(1, Math.ceil(run.totalWeeks));
  }
  return Math.max(1, Math.ceil((run.totalMonths ?? 1) * WEEKS_PER_MONTH));
}

function getRunWeeksElapsed(run: GameState["activeRuns"][number]) {
  if (typeof run.weeksElapsed === "number" && Number.isFinite(run.weeksElapsed)) {
    return Math.max(0, Math.floor(run.weeksElapsed));
  }
  return Math.max(0, Math.ceil((run.monthsElapsed ?? 0) * WEEKS_PER_MONTH));
}

function humanizeLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPressureTone(value: number | null): Tone {
  if (value === null) return "default";
  if (value < 10) return "good";
  if (value < 25) return "default";
  if (value < 45) return "warning";
  return "bad";
}

function getBalanceTone(value: number): Tone {
  if (value >= 0) return value > 0 ? "good" : "default";
  if (value > -10) return "warning";
  return "bad";
}

function weightedAverage(
  items: ServingProductInfo[],
  selector: (item: ServingProductInfo) => number | null,
  weightSelector: (item: ServingProductInfo) => number,
) {
  let weightTotal = 0;
  let weightedSum = 0;

  for (const item of items) {
    const value = selector(item);
    if (value === null) continue;

    const rawWeight = weightSelector(item);
    const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;
    weightTotal += weight;
    weightedSum += value * weight;
  }

  if (weightTotal <= 0) return null;
  return weightedSum / weightTotal;
}

function describeProductRisk(product: ServingProductInfo) {
  if ((product.trafficPressurePct ?? 0) >= 35) {
    return "Traffic is running ahead of comfortable capacity, so margin and trust are both exposed.";
  }
  if ((product.burstMultiplier ?? 0) >= 1.3) {
    return "Demand is peaky enough that burst coverage matters more than average utilization.";
  }
  if ((product.contextUtilizationPct ?? 0) >= 75) {
    return "Longer prompts are stretching throughput, which makes each serving pod feel smaller.";
  }
  if (product.batchingEfficiencyPct !== null && product.batchingEfficiencyPct <= 60) {
    return "Batching looks weak, so the route is probably leaving efficiency on the table.";
  }
  if ((product.queuedCapacityPods ?? 0) > 0 && product.provisioningLeadTimeMonths !== null) {
    return `More capacity is queued, but relief lands in about ${formatMetricMonths(product.provisioningLeadTimeMonths)}.`;
  }
  return "Current serving load looks manageable; unit economics are mostly about model efficiency and pricing discipline.";
}

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

  const trainingDemand = game.activeRuns.reduce((sum, run) => sum + run.computeNeed, 0);
  const allocatedServing = game.cloud.reservedPods * servingPct / 100;
  const allocatedTraining = game.cloud.reservedPods * game.cloud.trainingPct / 100;
  const estimatedSurplus = Math.max(
    0,
    Math.floor((allocatedServing - projectedServingDemand) + (allocatedTraining - trainingDemand)),
  );

  const projectedServingGap = allocatedServing - projectedServingDemand;
  const projectedServingPressurePct =
    projectedServingDemand > 0
      ? Math.max(0, projectedServingDemand - allocatedServing) / Math.max(1, projectedServingDemand) * 100
      : 0;
  const lastMonthServingGap = allocatedServing - game.lastMonth.servingDemand;
  const lastMonthServingPressurePct =
    game.lastMonth.servingDemand > 0
      ? Math.max(0, game.lastMonth.servingDemand - allocatedServing) / Math.max(1, game.lastMonth.servingDemand) * 100
      : 0;
  const lastWeekServingDemand = readNumber(game, "lastWeekServingDemand", "weeklyServingDemand")
    ?? readNumber(game.lastWeek, "servingDemand", "computeDemand")
    ?? game.lastWeek.computeDemand;
  const lastWeekServingGap = allocatedServing - lastWeekServingDemand;
  const lastWeekServingPressurePct =
    lastWeekServingDemand > 0
      ? Math.max(0, lastWeekServingDemand - allocatedServing) / Math.max(1, lastWeekServingDemand) * 100
      : 0;
  const lastWeekComputeCost = readNumber(game, "lastWeekComputeCost", "weeklyComputeCost")
    ?? readNumber(game.lastWeek, "computeCost")
    ?? game.lastWeek.computeCost;
  const lastWeekTrainingDemand = readNumber(game, "lastWeekTrainingDemand", "weeklyTrainingDemand")
    ?? readNumber(game.lastWeek, "trainingDemand");
  const lastWeekCashflowSource = readRecord(game, "lastWeekCashflow", "weeklyCashflow");
  const lastWeekCashflow = readNumber(game, "lastWeekCashflow", "weeklyCashflow")
    ?? readOperatingCashflowTotal(lastWeekCashflowSource);
  const currentMonthOperatingCashflow = game.currentMonthCashflow.cloudRentalRevenue
    - game.currentMonthCashflow.payroll
    - game.currentMonthCashflow.marketingSpend
    - game.currentMonthCashflow.baseOpsCost
    - game.currentMonthCashflow.loanPayments
    - game.currentMonthCashflow.computeReservedCost
    - (game.currentMonthCashflow.developmentCost ?? 0)
    - (game.currentMonthCashflow.maintenanceCost ?? 0);

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

  const rentalPrice = game.cloudRental.pricePerPod;
  const rentalEnabled = rentalPrice > 0;
  const priceVsMarket = rentalEnabled ? rentalPrice / CLOUD_RENTAL_MARKET_RATE : 1;
  const rentalPriceTone =
    !rentalEnabled ? "default" :
    priceVsMarket <= 1 ? "good" :
    priceVsMarket <= 1.5 ? "warning" : "bad";

  const plannedDatacenterSource = readArray(game, "plannedDatacenters")
    ?? readArray(game.cloud, "plannedDatacenters")
    ?? [];
  const plannedDatacenters = plannedDatacenterSource
    .map((entry, index) => {
      const etaFromExplicitWeeks =
        readNumber(entry, "weeksRemaining", "leadTimeWeeks", "etaWeeks", "provisioningLeadTimeWeeks");
      const etaFromExplicitMonths =
        readNumber(entry, "monthsRemaining", "leadTimeMonths", "etaMonths", "turnsRemaining", "provisioningLeadTimeMonths");
      const etaTurn =
        readNumber(entry, "readyTurn", "onlineTurn", "activationTurn", "monthReady", "monthOnline");
      const etaWeeks =
        etaFromExplicitWeeks !== null
          ? etaFromExplicitWeeks
          : etaFromExplicitMonths !== null
            ? etaFromExplicitMonths * WEEKS_PER_MONTH
            : etaTurn !== null
              ? Math.max(0, etaTurn - game.turn) * WEEKS_PER_MONTH
              : null;

      const info: PlannedDatacenterInfo = {
        id: String(readString(entry, "id", "name") ?? `planned-${index}`),
        pods: Math.max(0, readNumber(entry, "pods", "capacityPods", "reservedPods") ?? 0),
        quantity: Math.max(1, Math.round(readNumber(entry, "quantity", "count") ?? 1)),
        etaWeeks,
        buildCost: readNumber(entry, "buildCost", "capex", "cost"),
      };

      return info;
    })
    .filter((entry) => entry.pods > 0 || entry.etaWeeks !== null || entry.buildCost !== null);
  const queuedCapacityPods = plannedDatacenters.reduce((sum, entry) => sum + entry.pods * entry.quantity, 0);
  const nextQueuedEta = plannedDatacenters.reduce<number | null>((best, entry) => {
    if (entry.etaWeeks === null) return best;
    if (best === null) return entry.etaWeeks;
    return Math.min(best, entry.etaWeeks);
  }, null);

  const burstCloudPods =
    readNumber(game.lastWeek, "burstCloudPods", "burstPods", "cloudBurstPods", "burstCapacityPods", "burstCloudUsage")
    ?? readNumber(game.lastMonth, "burstCloudPods", "burstPods", "cloudBurstPods", "burstCapacityPods", "burstCloudUsage")
    ?? readNumber(game.cloud, "burstCloudPods", "burstPods", "cloudBurstPods", "burstCapacityPods");
  const burstCloudCost =
    readNumber(game.lastWeek, "burstCloudCost", "burstCost", "cloudBurstCost", "burstCapacityCost")
    ?? readNumber(game.lastMonth, "burstCloudCost", "burstCost", "cloudBurstCost", "burstCapacityCost")
    ?? readNumber(game.cloud, "burstCloudCost", "burstCost", "cloudBurstCost", "burstCapacityCost");

  const modelNamesById = new Map(game.models.map((model) => [model.id, `${model.name} v${formatVersion(model.version)}`]));
  const servingProducts: ServingProductInfo[] = [
    { id: "chatbot", label: "Chatbot", product: game.products.chatbot },
    { id: "api", label: "API", product: game.products.api },
  ].map(({ id, label, product }) => {
    const traffic = readRecord(product, "traffic");
    const serving = readRecord(product, "serving", "servingOps", "inference");

    return {
      id,
      label,
      computeDemand: product.computeDemand,
      computeCost: product.computeCost,
      revenue: product.revenue,
      trust: product.trust,
      activeUsers: product.activeUsers,
      acquisition: product.acquisition,
      churn: product.churn,
      servingStrategy: readString(product, "servingStrategy", "routingStrategy") ?? readString(serving, "strategy", "servingStrategy"),
      assignedModels: product.modelIds.map((modelId) => modelNamesById.get(modelId)).filter((value): value is string => Boolean(value)),
      contextUtilizationPct: normalizePercentLike(
        readNumber(traffic, "averageContextUtilization", "contextUtilization", "contextUtilizationPct")
        ?? readNumber(product, "averageContextUtilization", "contextUtilization", "contextUtilizationPct")
        ?? readNumber(serving, "averageContextUtilization", "contextUtilization", "contextUtilizationPct"),
      ),
      batchingEfficiencyPct: normalizePercentLike(
        readNumber(traffic, "batchingEfficiency", "batchingFriendliness", "batchingEfficiencyPct")
        ?? readNumber(product, "batchingEfficiency", "batchingFriendliness", "batchingEfficiencyPct")
        ?? readNumber(serving, "batchingEfficiency", "throughputEfficiency", "servingEfficiency"),
      ),
      effectiveTokensPerPod:
        readNumber(product, "effectiveTokensPerPod", "tokensPerPod", "throughputPerPod")
        ?? readNumber(serving, "effectiveTokensPerPod", "tokensPerPod", "throughputPerPod"),
      throughputEfficiencyPct: normalizePercentLike(
        readNumber(product, "throughputEfficiency", "servingEfficiency")
        ?? readNumber(serving, "throughputEfficiency", "servingEfficiency"),
      ),
      burstMultiplier:
        readNumber(traffic, "burstMultiplier")
        ?? readNumber(product, "burstMultiplier")
        ?? readNumber(serving, "burstMultiplier"),
      burstCloudPods:
        readNumber(product, "burstCloudPods", "burstPods")
        ?? readNumber(serving, "burstCloudPods", "burstPods"),
      queuedCapacityPods:
        readNumber(product, "queuedCapacityPods", "queuedPods")
        ?? readNumber(serving, "queuedCapacityPods", "queuedPods"),
      trafficPressurePct: normalizePercentLike(
        readNumber(product, "trafficPressure", "servingPressure")
        ?? readNumber(traffic, "trafficPressure", "servingPressure")
        ?? readNumber(serving, "trafficPressure", "servingPressure"),
      ),
      viralPressurePct: normalizePercentLike(
        readNumber(traffic, "viralPressure")
        ?? readNumber(product, "viralPressure")
        ?? readNumber(serving, "viralPressure"),
      ),
      provisioningLeadTimeMonths:
        readNumber(product, "provisioningLeadTimeMonths", "leadTimeMonths")
        ?? readNumber(serving, "provisioningLeadTimeMonths", "leadTimeMonths"),
    };
  });

  const liveServingProducts = servingProducts.filter((product) => product.computeDemand > 0 || product.assignedModels.length > 0);
  const weightedContextUtilization = weightedAverage(liveServingProducts, (product) => product.contextUtilizationPct, (product) => product.computeDemand);
  const weightedBatchingEfficiency = weightedAverage(liveServingProducts, (product) => product.batchingEfficiencyPct, (product) => product.computeDemand);
  const weightedTrafficPressure = weightedAverage(liveServingProducts, (product) => product.trafficPressurePct, (product) => product.computeDemand);
  const weightedThroughputEfficiency = weightedAverage(liveServingProducts, (product) => product.throughputEfficiencyPct, (product) => product.computeDemand);

  const riskDrivers = [
    projectedServingGap < 0
      ? `Projected serving is short by ${formatPods(Math.abs(projectedServingGap))} pods before any new capacity lands.`
      : `Projected serving still has ${formatPods(projectedServingGap)} pods of headroom at the current split.`,
    queuedCapacityPods > 0
      ? `Queued capacity adds ${formatPods(queuedCapacityPods)} pods, with the next tranche arriving in ${formatMetricWeeks(nextQueuedEta)}.`
      : "No additional datacenter capacity is queued, so any spike will lean on overflow or discipline.",
    (burstCloudPods ?? 0) > 0
      ? `Burst cloud covered ${formatPods(burstCloudPods ?? 0)} pods in the latest exposed period${burstCloudCost ? ` for ${money(burstCloudCost)}` : ""}.`
      : lastWeekServingGap < 0
        ? "Last week outran the reserved serving split, so future spikes need overflow coverage or capacity."
        : "Last week stayed inside the reserved serving split, so risk is mostly about keeping future spikes absorbed.",
  ];

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
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-5">
        <Panel title="Cloud Capacity" subtitle="Datacenter builds turn cloud capacity into a real capital allocation choice.">
          <div className="grid overflow-hidden rounded-md border border-[#30363d] md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Serving Allocation"
              value={`${formatPods(allocatedServing)} pods`}
              subvalue={`Training keeps ${formatPods(allocatedTraining)} pods`}
            />
            <KpiCard
              label={projectedServingGap >= 0 ? "Serving Headroom" : "Serving Shortfall"}
              value={`${formatPods(Math.abs(projectedServingGap))} pods`}
              subvalue={`Projected pressure ${formatPercent(projectedServingPressurePct)}`}
              tone={getBalanceTone(projectedServingGap)}
            />
            <KpiCard
              label={queuedCapacityPods > 0 ? "Queued Capacity" : "Active Training Demand"}
              value={`${formatPods(queuedCapacityPods > 0 ? queuedCapacityPods : trainingDemand)} pods`}
              subvalue={queuedCapacityPods > 0 ? `Next online ${formatMetricWeeks(nextQueuedEta)}` : `${game.activeRuns.length} active runs`}
              tone={queuedCapacityPods > 0 ? "default" : trainingDemand > allocatedTraining ? "warning" : "default"}
            />
            <KpiCard
              label={(burstCloudPods ?? 0) > 0 || burstCloudCost !== null ? "Burst Cloud Usage" : "Estimated Surplus"}
              value={(burstCloudPods ?? 0) > 0 ? `${formatPods(burstCloudPods ?? 0)} pods` : `${formatPods(estimatedSurplus)} pods`}
              subvalue={(burstCloudPods ?? 0) > 0 ? (burstCloudCost ? `Completed month ${money(burstCloudCost)}` : "Completed month") : "Pods available for rental or redeploy"}
              tone={(burstCloudPods ?? 0) > 0 ? "warning" : estimatedSurplus > 0 ? "good" : "default"}
            />
          </div>

          {(weightedContextUtilization !== null || weightedBatchingEfficiency !== null || weightedTrafficPressure !== null || weightedThroughputEfficiency !== null) && (
            <div className="mt-4 grid overflow-hidden rounded-md border border-[#30363d] md:grid-cols-2 xl:grid-cols-4">
              {weightedContextUtilization !== null && (
                <KpiCard
                  label="Avg Context Utilization"
                  value={formatPercent(weightedContextUtilization)}
                  subvalue="Weighted by live serving demand"
                  tone={weightedContextUtilization >= 75 ? "warning" : "default"}
                />
              )}
              {weightedBatchingEfficiency !== null && (
                <KpiCard
                  label="Batching Efficiency"
                  value={formatPercent(weightedBatchingEfficiency)}
                  subvalue="Higher means more tokens per reserved pod"
                  tone={weightedBatchingEfficiency >= 75 ? "good" : weightedBatchingEfficiency >= 60 ? "default" : "warning"}
                />
              )}
              {weightedThroughputEfficiency !== null && (
                <KpiCard
                  label="Throughput Efficiency"
                  value={formatPercent(weightedThroughputEfficiency)}
                  subvalue="Observed serving efficiency when exposed"
                  tone={weightedThroughputEfficiency >= 75 ? "good" : weightedThroughputEfficiency >= 55 ? "default" : "warning"}
                />
              )}
              {weightedTrafficPressure !== null && (
                <KpiCard
                  label="Traffic Pressure"
                  value={formatPercent(weightedTrafficPressure)}
                  subvalue="How hard the live routes are leaning on capacity"
                  tone={getPressureTone(weightedTrafficPressure)}
                />
              )}
            </div>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-md border border-[#30363d]">
              <div className="bg-[#161b22] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
                Fleet Plan
              </div>
              <div className="px-3">
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Installed Cloud Pods</span>
                  <span className="font-mono text-sm text-[#e6edf3]">{formatPods(game.cloud.reservedPods)}</span>
                </div>
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Reserved Cost / Pod</span>
                  <span className="font-mono text-sm text-[#e6edf3]">{money(getReservedCostPerPod(game))} / mo</span>
                </div>
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">New Build Size</span>
                  <span className="font-mono text-sm text-[#e6edf3]">{buildPods} pods</span>
                </div>
                <div className="border-b border-[#161b22] py-2.5">
                  <input
                    type="range"
                    min={8}
                    max={240}
                    step={4}
                    value={buildPods}
                    onChange={(event) => setBuildPods(Number(event.target.value))}
                    className="w-full"
                  />
                </div>
                <label className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Datacenters</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={buildQuantity}
                    onChange={(event) => setBuildQuantity(Math.max(1, Number(event.target.value) || 1))}
                    className={INPUT_CLS + " w-24 text-right font-mono"}
                  />
                </label>
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Build Capex</span>
                  <span className="font-mono text-sm text-[#d29922]">{money(totalBuildCost)}</span>
                </div>
                {plannedDatacenters.length > 0 ? (
                  <div className={FIELD_ROW}>
                    <span className="text-sm text-[#8b949e]">Queued Builds</span>
                    <span className="font-mono text-sm text-[#e6edf3]">{plannedDatacenters.length} / {formatPods(queuedCapacityPods)} pods</span>
                  </div>
                ) : null}
                <div className="py-3 text-right">
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

            <div className="overflow-hidden rounded-md border border-[#30363d]">
              <div className="bg-[#161b22] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
                Allocation & Rental
              </div>
              <div className="px-3">
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Training Allocation</span>
                  <span className="font-mono text-sm text-[#e6edf3]">{game.cloud.trainingPct}%</span>
                </div>
                <div className="border-b border-[#161b22] py-2.5">
                  <input
                    type="range"
                    min={15}
                    max={85}
                    value={game.cloud.trainingPct}
                    onChange={(event) => onUpdateTrainingAllocation(Number(event.target.value))}
                    className="w-full"
                  />
                  <div className="mt-1 flex items-center justify-between text-xs text-[#484f58]">
                    <span>Training {formatPods(allocatedTraining)} pods</span>
                    <span>Serving {formatPods(allocatedServing)} pods</span>
                  </div>
                </div>
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Rental Market</span>
                  <span className="font-mono text-sm text-[#e6edf3]">{money(CLOUD_RENTAL_MARKET_RATE)} / pod / mo</span>
                </div>
                <label className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Rental Price</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={rentalPriceInput}
                    placeholder="0 = disabled"
                    onChange={(event) => setRentalPriceInput(event.target.value)}
                    onBlur={commitRentalPrice}
                    onKeyDown={(event) => event.key === "Enter" && commitRentalPrice()}
                    className={INPUT_CLS + " w-32 text-right font-mono"}
                  />
                </label>
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Rental Position</span>
                  <span className={`font-mono text-sm ${rentalPriceTone === "good" ? "text-[#3fb950]" : rentalPriceTone === "warning" ? "text-[#d29922]" : rentalEnabled ? "text-[#f85149]" : "text-[#484f58]"}`}>
                    {!rentalEnabled ? "Disabled" : priceVsMarket <= 1 ? "Below market" : priceVsMarket <= 1.5 ? "Above market" : "Overpriced"}
                  </span>
                </div>
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Surplus Pods</span>
                  <span className="font-mono text-sm text-[#e6edf3]">{formatPods(estimatedSurplus)}</span>
                </div>
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Pods Rented MTD</span>
                  <span className="font-mono text-sm text-[#e6edf3]">{formatPods(game.currentMonthCashflow.cloudRentalPodsRented)}</span>
                </div>
                <div className={FIELD_ROW}>
                  <span className="text-sm text-[#8b949e]">Rental Revenue MTD</span>
                  <span className={`font-mono text-sm ${game.currentMonthCashflow.cloudRentalRevenue > 0 ? "text-[#3fb950]" : "text-[#e6edf3]"}`}>
                    {money(game.currentMonthCashflow.cloudRentalRevenue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {plannedDatacenters.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-md border border-[#30363d]">
              <div className="bg-[#161b22] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e7681]">
                Provisioning Queue
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0d1117]">
                    <th className={TH}>Build</th>
                    <th className={TH}>Pods</th>
                    <th className={TH}>Quantity</th>
                    <th className={TH}>ETA</th>
                    <th className={TH}>Capex</th>
                  </tr>
                </thead>
                <tbody>
                  {plannedDatacenters.slice(0, 6).map((entry) => (
                    <tr key={entry.id} className={TR}>
                      <td className={TD}>{entry.id}</td>
                      <td className={TD + " font-mono text-[#8b949e]"}>{formatPods(entry.pods * entry.quantity)}</td>
                      <td className={TD + " font-mono text-[#8b949e]"}>{entry.quantity} x {formatPods(entry.pods)}</td>
                      <td className={TD + " font-mono text-[#e6edf3]"}>{formatMetricWeeks(entry.etaWeeks)}</td>
                      <td className={TD + " font-mono text-[#8b949e]"}>{entry.buildCost !== null ? money(entry.buildCost) : "Pending"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-4 rounded-md border border-[#30363d] bg-[#0d1117] p-4">
            <div className={SECTION_LABEL}>Datacenter Fleet</div>
            <div className="overflow-hidden rounded-md border border-[#30363d]">
              <div className="grid md:grid-cols-2">
                <KpiCard label="Datacenters Owned" value={game.cloud.datacenters.length} />
                <KpiCard
                  label="Reserved Serving Headroom"
                  value={projectedServingGap >= 0 ? formatPods(projectedServingGap) : `-${formatPods(Math.abs(projectedServingGap))}`}
                  tone={getBalanceTone(projectedServingGap)}
                />
              </div>
            </div>
            {datacenterGroups.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No datacenters online" body="Build cloud capacity first, then you can trim the fleet here." />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-md border border-[#30363d]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#161b22]">
                      <th className={TH}>Fleet Type</th>
                      <th className={TH}>Owned</th>
                      <th className={TH}>Installed Pods</th>
                      <th className={TH}>Cost Basis</th>
                      <th className={TH}>Sell Qty</th>
                      <th className={TH}>Sale Price</th>
                      <th className={TH}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {datacenterGroups.map((group) => {
                      const averageBuildCost = Math.round(group.totalBuildCost / group.count);
                      const sellQuantityValue = getSellQuantityValue(group.pods);
                      const sellPriceValue = getSellPriceValue(group.pods, averageBuildCost);
                      return (
                        <tr key={group.pods} className={TR}>
                          <td className={TD}>
                            <div className="font-medium text-[#e6edf3]">{group.pods}-Pod Datacenters</div>
                          </td>
                          <td className={TD + " font-mono text-[#8b949e]"}>{group.count}</td>
                          <td className={TD + " font-mono text-[#8b949e]"}>{formatPods(group.pods * group.count)}</td>
                          <td className={TD + " font-mono text-[#8b949e]"}>{money(averageBuildCost)} each</td>
                          <td className={TD}>
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
                              className={INPUT_CLS + " w-20 text-right font-mono"}
                            />
                          </td>
                          <td className={TD}>
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
                              className={INPUT_CLS + " w-36 text-right font-mono"}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button onClick={() => commitSell(group.pods, group.count, averageBuildCost)} variant="ghost">
                              Sell
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
        </Panel>

        <Panel title="Serving Risk" subtitle="Projected and last-week demand lead; completed-month rows stay as closed-report context.">
          <div className="overflow-hidden rounded-md border border-[#30363d]">
            <div className="bg-[#161b22] px-3 py-2">
              <div className="text-sm font-medium text-[#c9d1d9]">
                {projectedServingGap < 0 ? "Projected demand is outrunning reserved serving capacity." : "Reserved capacity can absorb the current demand plan."}
              </div>
            </div>
            <div className="px-3">
              <StatRow label="Reserved Serving Pods" value={formatPods(allocatedServing)} />
              <StatRow label="Projected Serving Demand" value={formatPods(projectedServingDemand)} tone={getPressureTone(projectedServingPressurePct)} />
              <StatRow label="Projected Traffic Pressure" value={formatPercent(projectedServingPressurePct)} tone={getPressureTone(projectedServingPressurePct)} />
              <StatRow label="Last Week Serving Demand" value={formatPods(lastWeekServingDemand)} tone={getPressureTone(lastWeekServingPressurePct)} />
              <StatRow label="Last Week Headroom" value={`${lastWeekServingGap >= 0 ? "" : "-"}${formatPods(Math.abs(lastWeekServingGap))}`} tone={getBalanceTone(lastWeekServingGap)} />
              <StatRow label="Last Week Compute Cost" value={money(lastWeekComputeCost)} tone={lastWeekComputeCost > 0 ? "warning" : "default"} />
              {lastWeekCashflow !== null ? (
                <StatRow label="Last Week Cashflow" value={money(lastWeekCashflow)} tone={lastWeekCashflow >= 0 ? "good" : "bad"} />
              ) : (
                <StatRow label="Current Month Cashflow" value={money(currentMonthOperatingCashflow)} tone={currentMonthOperatingCashflow >= 0 ? "good" : "bad"} />
              )}
              {lastWeekTrainingDemand !== null ? (
                <StatRow label="Last Week Training Demand" value={formatPods(lastWeekTrainingDemand)} tone={lastWeekTrainingDemand > allocatedTraining ? "warning" : "default"} />
              ) : null}
              {burstCloudCost !== null && <StatRow label="Latest Burst Cloud Cost" value={money(burstCloudCost)} tone={burstCloudCost > 0 ? "warning" : "default"} />}
              <StatRow label="Completed Month Serving Demand" value={formatPods(game.lastMonth.servingDemand)} tone={getPressureTone(lastMonthServingPressurePct)} />
              <StatRow label="Completed Month Headroom" value={`${lastMonthServingGap >= 0 ? "" : "-"}${formatPods(Math.abs(lastMonthServingGap))}`} tone={getBalanceTone(lastMonthServingGap)} />
              <StatRow label="Completed Month Overflow Cost" value={money(game.lastMonth.overflowCost)} tone={game.lastMonth.overflowCost > 0 ? "warning" : "good"} />
              {queuedCapacityPods > 0 && <StatRow label="Queued Capacity" value={formatPods(queuedCapacityPods)} />}
            </div>
            <div className="border-t border-[#30363d] bg-[#0d1117] p-3">
              <div className={SECTION_LABEL}>Drivers</div>
              {riskDrivers.map((driver) => (
                <div key={driver} className="border-b border-[#161b22] py-2 text-sm text-[#c9d1d9] last:border-0">
                  {driver}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel title="Active Training Runs" subtitle="Watch the graph, the risk curve, and the run count.">
          {game.activeRuns.length === 0 ? (
            <EmptyState title="No active runs" body="Head to the Lab and launch a run when the company is ready." />
          ) : (
            <div className="overflow-x-auto rounded-md border border-[#30363d]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#161b22]">
                    <th className={TH}>Run</th>
                    <th className={TH}>Progress</th>
                    <th className={TH}>Pods</th>
                    <th className={TH}>Projected Cap</th>
                    <th className={TH}>Risk</th>
                    <th className={TH}>Goals</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {game.activeRuns.map((run) => {
                    const totalWeeks = getRunTotalWeeks(run);
                    const weeksElapsed = getRunWeeksElapsed(run);
                    const visiblePoints = run.lossCurve.slice(0, Math.max(1, weeksElapsed + 1));
                    const keyPersonRisk = readNumber(run, "keyPersonRisk");
                    const projectedThroughputLift = normalizePercentLike(readNumber(run, "projectedThroughputEfficiency", "throughputEfficiency"));
                    const totalRisk = Math.max(0, Math.min(1, run.baseFailureRisk + run.riskModifier));

                    return (
                      <Fragment key={run.id}>
                        <tr className={TR}>
                          <td className={TD}>
                            <div className="font-medium text-[#e6edf3]">{run.name}</div>
                            <div className="text-xs text-[#8b949e]">v{formatVersion(run.targetVersion)}</div>
                          </td>
                          <td className={TD + " font-mono text-[#8b949e]"}>{weeksElapsed} / {totalWeeks} wk</td>
                          <td className={TD + " font-mono text-[#8b949e]"}>{formatPods(run.computeNeed)}</td>
                          <td className={TD + " font-mono text-[#3fb950]"}>{run.projectedCapability}</td>
                          <td className={TD}>
                            <Badge tone={totalRisk < 0.16 ? "good" : totalRisk < 0.3 ? "warning" : "bad"}>
                              {(totalRisk * 100).toFixed(0)}%
                            </Badge>
                          </td>
                          <td className={TD}>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(run.goals)
                                .filter(([, weight]) => weight > 0)
                                .slice(0, 3)
                                .map(([goalId, weight]) => (
                                  <Badge key={goalId} tone="default">
                                    {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} {weight}
                                  </Badge>
                                ))}
                              {keyPersonRisk !== null ? (
                                <Badge tone={getPressureTone(normalizePercentLike(keyPersonRisk))}>
                                  Key {formatPercent(normalizePercentLike(keyPersonRisk) ?? 0)}
                                </Badge>
                              ) : null}
                              {projectedThroughputLift !== null ? (
                                <Badge tone={projectedThroughputLift >= 75 ? "good" : projectedThroughputLift >= 55 ? "default" : "warning"}>
                                  Throughput {formatPercent(projectedThroughputLift)}
                                </Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button onClick={() => onShutdownRun(run.id)} variant="ghost">Shut Down</Button>
                          </td>
                        </tr>
                        <tr className="border-t border-[#21262d] bg-[#0d1117]">
                          <td colSpan={7} className="px-3 py-3">
                            <LossCurve points={visiblePoints} />
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Serving Operations" subtitle="Useful readout for deciding whether to optimize serving, absorb a spike, or push another run.">
          {liveServingProducts.length === 0 ? (
            <EmptyState title="No live serving routes" body="The compute layer gets more interesting once a model is deployed into a product." />
          ) : (
            <div className="overflow-x-auto rounded-md border border-[#30363d]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#161b22]">
                    <th className={TH}>Route</th>
                    <th className={TH}>Models</th>
                    <th className={TH}>Demand</th>
                    <th className={TH}>Weekly Cost / Revenue</th>
                    <th className={TH}>Trust</th>
                    <th className={TH}>Weekly Acq / Churn</th>
                    <th className={TH}>Efficiency</th>
                    <th className={TH}>Pressure</th>
                  </tr>
                </thead>
                <tbody>
                  {liveServingProducts.map((product) => (
                    <tr key={product.id} className={TR}>
                      <td className={TD}>
                        <div className="font-medium text-[#e6edf3]">{product.label}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {product.servingStrategy ? <Badge tone="default">{humanizeLabel(product.servingStrategy)}</Badge> : null}
                          {product.burstMultiplier !== null ? (
                            <Badge tone={product.burstMultiplier >= 1.3 ? "warning" : "default"}>
                              Burst {product.burstMultiplier.toFixed(2)}x
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className={TD + " text-[#8b949e]"}>{product.assignedModels.length > 0 ? product.assignedModels.join(" / ") : "No model"}</td>
                      <td className={TD + " font-mono text-[#8b949e]"}>{formatPods(product.computeDemand)} pods</td>
                      <td className={TD}>
                        <div className={`font-mono ${product.revenue >= product.computeCost ? "text-[#e6edf3]" : "text-[#d29922]"}`}>{money(product.computeCost)}</div>
                        <div className="text-xs font-mono text-[#484f58]">{money(product.revenue)} rev</div>
                      </td>
                      <td className={TD}>
                        <span className={`font-mono ${product.trust >= 70 ? "text-[#3fb950]" : product.trust >= 55 ? "text-[#e6edf3]" : "text-[#d29922]"}`}>
                          {product.trust.toFixed(1)}
                        </span>
                      </td>
                      <td className={TD}>
                        <div className="font-mono text-[#3fb950]">{formatPods(product.acquisition)}</div>
                        <div className="text-xs font-mono text-[#f85149]">{formatPods(product.churn)}</div>
                      </td>
                      <td className={TD}>
                        <div className="space-y-1 text-xs font-mono text-[#8b949e]">
                          {product.contextUtilizationPct !== null ? <div>Ctx {formatPercent(product.contextUtilizationPct)}</div> : null}
                          {product.batchingEfficiencyPct !== null ? <div>Batch {formatPercent(product.batchingEfficiencyPct)}</div> : null}
                          {product.effectiveTokensPerPod !== null ? <div>{formatPods(product.effectiveTokensPerPod)} tok/pod</div> : null}
                          {product.throughputEfficiencyPct !== null ? <div>Thru {formatPercent(product.throughputEfficiencyPct)}</div> : null}
                        </div>
                      </td>
                      <td className={TD}>
                        <div className="space-y-1">
                          {product.trafficPressurePct !== null ? (
                            <Badge tone={getPressureTone(product.trafficPressurePct)}>Pressure {formatPercent(product.trafficPressurePct)}</Badge>
                          ) : null}
                          {product.queuedCapacityPods !== null ? <Badge tone="default">Queued {formatPods(product.queuedCapacityPods)}</Badge> : null}
                          {product.burstCloudPods !== null ? <Badge tone={product.burstCloudPods > 0 ? "warning" : "default"}>Burst {formatPods(product.burstCloudPods)}</Badge> : null}
                          {product.viralPressurePct !== null ? <Badge tone={getPressureTone(product.viralPressurePct)}>Viral {formatPercent(product.viralPressurePct)}</Badge> : null}
                          <div className="max-w-xs text-xs text-[#484f58]">{describeProductRisk(product)}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
