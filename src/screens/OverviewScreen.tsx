import React, { useState } from "react";

import { MODEL_GOALS, PRODUCT_TYPES } from "../game/defs";
import { formatVersion, getMarketComparison, getModelById, money, monthLabel, pct, formatPods } from "../game/sim";
import { CohortId, GameState, ProductTypeId } from "../game/types";
import { Badge, Button, EmptyState, MiniSparkline, Panel, SegmentedControl, StatRow, Tone } from "../components/ui";

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
        label: `${pctDelta >= 0 ? "+" : ""}${pctDelta.toFixed(0)}% MoM`,
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
    <div className="rounded-2xl bg-slate-950/55 p-4 ring-1 ring-inset ring-slate-800/70">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-300">{label}</div>
          <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-slate-50">{value}</div>
          <div
            className={`mt-2 text-xs ${
              deltaTone === "good"
                ? "text-emerald-300"
                : deltaTone === "bad"
                  ? "text-rose-300"
                  : deltaTone === "warning"
                    ? "text-amber-300"
                    : "text-slate-500"
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
    <div className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-inset ring-slate-800/60">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-base font-semibold text-slate-100">
            {name} v{formatVersion(version)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="default">#{modelId}</Badge>
            <Badge tone="default">Capability {capability}</Badge>
            <Badge tone={marketTone}>{marketLabel}</Badge>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {memorySize} GB / {parameterScale}B params / {contextWindow}K ctx
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
            <div className="mb-1 text-slate-500">Price ({priceUnitLabel})</div>
            <input
              type="number"
              step={step}
              value={priceValue}
              onChange={(event) => onPriceChange(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
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
  releaseMonth: number;
  developmentCost: number;
  totalRevenueGenerated: number;
  previousMonthRevenueGenerated: number;
  previousMonthUsers: number;
  previousMonthAcquisition: number;
  previousMonthChurn: number;
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

    return {
      id: model.id,
      name: model.name,
      releaseMonth: model.monthBuilt,
      developmentCost: model.developmentCost,
      totalRevenueGenerated: performance.totalRevenue,
      previousMonthRevenueGenerated: performance.lastMonthRevenue,
      previousMonthUsers: performance.lastMonthUsers,
      previousMonthAcquisition: performance.lastMonthAcquisition,
      previousMonthChurn: performance.lastMonthChurn,
      subscribersByCohort: model.subscribersByCohort,
    };
  });
}

export function OverviewScreen({
  game,
  arr,
  onAttachModel,
  onUpdateProductPrice,
  onRaiseFunding,
  onRestart,
}: {
  game: GameState;
  arr: number;
  onAttachModel: (productKey: ProductTypeId, modelId: string) => void;
  onUpdateProductPrice: (productKey: ProductTypeId, value: string, modelId?: string) => void;
  onRaiseFunding: () => void;
  onRestart: () => void;
}) {
  const [activeProduct, setActiveProduct] = useState<ProductTypeId>("chatbot");
  const [activeView, setActiveView] = useState<"dashboard" | "models">("dashboard");
  const [expandedModelKey, setExpandedModelKey] = useState<number | null>(null);
  const monthsUntilFunding = Math.max(0, 12 - (game.turn - game.funding.lastRaisedTurn));
  const product = game.products[activeProduct];
  const productDef = PRODUCT_TYPES[activeProduct];
  const attachedModels = product.modelIds
    .map((modelId) => getModelById(game, modelId))
    .filter((model): model is NonNullable<ReturnType<typeof getModelById>> => Boolean(model));
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

  return (
    <div className="space-y-6">
      <SegmentedControl
        options={[
          { key: "dashboard", label: "Overview" },
          { key: "models", label: "Released Models" },
        ]}
        activeKey={activeView}
        onChange={(key) => setActiveView(key)}
      />

      {activeView === "dashboard" ? (
        <div className="grid gap-6 xl:grid-cols-[1.52fr_0.82fr]">
      <div className="space-y-6">
        <Panel
          title="Product Portfolio"
          subtitle="Focus on one business line at a time, tune deployment pricing, and shape the lineup that actually wins its market."
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

            <div className="rounded-[24px] bg-slate-950/45 p-5 ring-1 ring-inset ring-slate-800/75">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xl font-semibold text-slate-50">{productDef.name}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {attachedModels.length
                      ? `${attachedModels.length} active model${attachedModels.length === 1 ? "" : "s"} shaping this line.`
                      : "No active lineup yet. Attach a model to bring this business online."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={attachedModels.length ? "default" : "warning"}>
                      {productDef.unitLabel}: {activeProduct === "api" ? product.activeUsers.toFixed(1) : product.activeUsers.toLocaleString()}
                    </Badge>
                    <Badge tone={attachedModels.length ? lineupComparison.tone : "default"}>
                      {attachedModels.length ? lineupComparison.label : "No market comparison yet"}
                    </Badge>
                    {attachedModels.length ? <Badge tone="default">Avg Capability {averageCapability}</Badge> : null}
                  </div>
                </div>

                <div className={`grid min-w-[240px] gap-3 sm:grid-cols-2 ${activeProduct === "api" ? "lg:w-[420px]" : "lg:w-[320px]"}`}>
                  <div className="rounded-2xl bg-slate-900/75 p-4 ring-1 ring-inset ring-slate-800/60">
                    <div className="text-sm font-medium text-slate-300">Revenue</div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-slate-50">{money(product.revenue)}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-900/75 p-4 ring-1 ring-inset ring-slate-800/60">
                    <div className="text-sm font-medium text-slate-300">Compute</div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-slate-50">{formatPods(product.computeDemand)} pods</div>
                  </div>
                  {activeProduct === "api" ? (
                    <div className="rounded-2xl bg-slate-900/75 p-4 ring-1 ring-inset ring-slate-800/60">
                      <div className="text-sm font-medium text-slate-300">Token Usage</div>
                      <div className="mt-2 font-mono text-2xl font-semibold text-slate-50">
                        {product.tokenUsageMillions.toLocaleString(undefined, { maximumFractionDigits: 2 })}M
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-2xl bg-slate-900/75 p-4 ring-1 ring-inset ring-slate-800/60">
                    <div className="text-sm font-medium text-slate-300">Acquisition</div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-slate-50">
                      {activeProduct === "api" ? product.acquisition.toFixed(1) : product.acquisition.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-900/75 p-4 ring-1 ring-inset ring-slate-800/60">
                    <div className="text-sm font-medium text-slate-300">Churn</div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-slate-50">{pct(product.churn)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
                <div className="space-y-4">
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-300">Active Lineup</div>
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
                      <div className="space-y-3">
                        {attachedModels.map((model) => {
                          const comparison = getMarketComparison(model.capability, game.marketStandard);
                          const goals = Object.entries(model.goals).filter(([, weight]) => weight > 0).slice(0, 3) as Array<[string, number]>;

                          return (
                            <ProductModelCard
                              key={model.id}
                              modelId={model.id}
                              name={model.name}
                              version={model.version}
                              capability={model.capability}
                              marketLabel={comparison.label}
                              marketTone={comparison.tone}
                              memorySize={model.memorySize}
                              parameterScale={model.parameterScale}
                              contextWindow={model.contextWindow}
                              goals={goals}
                              priceValue={product.modelPrices[String(model.id)] ?? product.price}
                              priceUnitLabel={productDef.priceUnitLabel}
                              step={productDef.step}
                              onPriceChange={(value) => onUpdateProductPrice(activeProduct, value, String(model.id))}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-slate-950/70 px-4 py-5 text-sm text-slate-500 ring-1 ring-inset ring-slate-800/60">
                        Product is offline until at least one model is active.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-slate-950/55 p-4 ring-1 ring-inset ring-slate-800/60">
                    <div className="text-sm font-medium text-slate-300">Available Models</div>
                    {game.models.length === 0 ? (
                      <div className="mt-3 text-sm text-slate-500">Ship a model from the Lab first.</div>
                    ) : (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {game.models.map((option) => {
                          const comparison = getMarketComparison(option.capability, game.marketStandard);
                          const goals = Object.entries(option.goals).filter(([, weight]) => weight > 0).slice(0, 3) as Array<[string, number]>;
                          const active = product.modelIds.includes(option.id);

                          return (
                            <button
                              key={option.id}
                              onClick={() => onAttachModel(activeProduct, String(option.id))}
                              className={`rounded-2xl p-4 text-left text-sm transition ${
                                active
                                  ? "bg-cyan-400/10 text-cyan-100 ring-1 ring-inset ring-cyan-400/35"
                                  : "bg-slate-900/85 text-slate-300 ring-1 ring-inset ring-slate-800/60 hover:bg-slate-900 hover:ring-slate-700"
                              }`}
                            >
                              <div className="font-medium text-slate-100">
                                {option.name} v{formatVersion(option.version)}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge tone="default">#{option.id}</Badge>
                                <Badge tone="default">Capability {option.capability}</Badge>
                                <Badge tone={comparison.tone}>{comparison.label}</Badge>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
                                {option.memorySize} GB / {option.parameterScale}B params / {option.contextWindow}K ctx
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {goals.map(([goalId, weight]) => (
                                  <Badge key={goalId} tone="default">
                                    {MODEL_GOALS[goalId as keyof typeof MODEL_GOALS].name} {weight}
                                  </Badge>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl bg-slate-950/55 p-4 ring-1 ring-inset ring-slate-800/60">
                    <div className="text-sm font-medium text-slate-300">Deployment Defaults</div>
                    <div className="mt-1 text-sm text-slate-500">New models inherit this price until you override them.</div>
                    <label className="mt-4 block text-sm">
                      <div className="mb-1 text-slate-400">Default Price For New Models ({productDef.priceUnitLabel})</div>
                      <input
                        type="number"
                        step={productDef.step}
                        value={product.price}
                        onChange={(event) => onUpdateProductPrice(activeProduct, event.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl bg-slate-950/55 p-4 ring-1 ring-inset ring-slate-800/60">
                    <div className="text-sm font-medium text-slate-300">Channel Readout</div>
                    <div className="mt-4 space-y-3">
                      <StatRow label="Line Revenue" value={money(product.revenue)} tone={product.revenue > product.computeCost ? "good" : "warning"} />
                      <StatRow label="Serving Cost" value={money(product.computeCost)} />
                      {activeProduct === "api" ? (
                        <StatRow
                          label="Monthly Token Usage"
                          value={`${product.tokenUsageMillions.toLocaleString(undefined, { maximumFractionDigits: 2 })}M`}
                        />
                      ) : null}
                      <StatRow label="Product Trust" value={product.trust.toFixed(1)} tone={product.trust >= 60 ? "good" : product.trust >= 45 ? "warning" : "bad"} />
                      <StatRow
                        label={activeProduct === "chatbot" ? "Consumer Reach" : "Enterprise Reach"}
                        value={activeProduct === "chatbot" ? game.distribution.consumer.toFixed(1) : game.distribution.enterprise.toFixed(1)}
                      />
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
              <div key={note.id} className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
                <div className="flex items-start gap-3">
                  <Badge tone={note.tone === "info" ? "default" : note.tone}>{note.tone}</Badge>
                  <div className="text-sm leading-6 text-slate-300">{note.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Company Health" subtitle="Financial momentum, operating pressure, and the next capital move in one place.">
          <div className="space-y-6">
            <div>
              <div className="text-sm font-medium text-slate-300">Financials</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <CompanyMetric
                  label="Revenue"
                  value={money(game.lastMonth.revenue)}
                  deltaLabel={revenueTrend.label}
                  deltaTone={revenueTrend.tone}
                  points={getTrendPoints(game.history.revenue, game.lastMonth.revenue)}
                />
                <CompanyMetric
                  label="Profit"
                  value={money(game.lastMonth.profit)}
                  deltaLabel={profitTrend.label}
                  deltaTone={profitTrend.tone}
                  points={getTrendPoints(game.history.profit, game.lastMonth.profit)}
                />
              </div>
              <div className="mt-4 space-y-3 rounded-2xl bg-slate-950/45 p-4 ring-1 ring-inset ring-slate-800/70">
                <StatRow label="ARR" value={money(arr)} tone={arr >= 10000000 ? "good" : "default"} />
                <StatRow label="Reserved Cloud Cost" value={money(game.lastMonth.computeReservedCost)} />
                <StatRow label="Overflow Cost" value={money(game.lastMonth.overflowCost)} tone={game.lastMonth.overflowCost > 0 ? "warning" : "default"} />
                <StatRow label="Payroll" value={money(game.lastMonth.payroll)} />
                <StatRow label="Marketing Spend" value={money(game.lastMonth.marketingSpend)} tone={game.lastMonth.marketingSpend > 0 ? "warning" : "default"} />
                <StatRow label="Funding Window" value={game.funding.available ? money(game.funding.offer) : `${monthsUntilFunding} mo`} />
                <StatRow label="Dilution" value={game.funding.available ? pct(game.funding.dilution) : pct(game.totalDilution)} />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-slate-300">Operating Metrics</div>
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
              <div className="mt-4 space-y-3 rounded-2xl bg-slate-950/45 p-4 ring-1 ring-inset ring-slate-800/70">
                <StatRow label="Consumer Distribution" value={game.distribution.consumer.toFixed(1)} />
                <StatRow label="Enterprise Distribution" value={game.distribution.enterprise.toFixed(1)} />
                <StatRow label="Market Standard" value={game.marketStandard} tone="warning" />
                <StatRow label="Best Model Vs Market" value={bestModelComparison ? bestModelComparison.label : "No models"} tone={bestModelComparison ? bestModelComparison.tone : "default"} />
                <StatRow label="Models Shipped" value={game.models.length} />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-slate-300">Actions</div>
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
            subtitle="Track every model your company has shipped with release timing, development cost, and current commercial performance."
          >
            {releasedModels.length === 0 ? (
              <EmptyState title="No released models yet" body="Launch a run in the Lab to populate this table." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/45">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/85 text-slate-300">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Release Month</th>
                      <th className="px-4 py-3 text-left font-medium">Dev Cost</th>
                      <th className="px-4 py-3 text-left font-medium">Total Revenue</th>
                      <th className="px-4 py-3 text-left font-medium">Prev Month Revenue</th>
                      <th className="px-4 py-3 text-left font-medium">Prev Month Users</th>
                      <th className="px-4 py-3 text-left font-medium">Prev Month Acquisition</th>
                      <th className="px-4 py-3 text-left font-medium">Prev Month Churn</th>
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
                          <tr onClick={toggleExpand} className="cursor-pointer border-t border-slate-800/80 text-slate-200 hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-medium text-slate-50">{model.name}</td>
                            <td className="px-4 py-3 font-mono">{monthLabel(model.releaseMonth)}</td>
                            <td className="px-4 py-3 font-mono">{money(model.developmentCost)}</td>
                            <td className="px-4 py-3 font-mono">{money(model.totalRevenueGenerated)}</td>
                            <td className="px-4 py-3 font-mono">{money(model.previousMonthRevenueGenerated)}</td>
                            <td className="px-4 py-3 font-mono">
                              {model.previousMonthUsers.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </td>
                            <td className="px-4 py-3 font-mono">
                              {model.previousMonthAcquisition.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            </td>
                            <td className="px-4 py-3 font-mono">{pct(model.previousMonthChurn)}</td>
                          </tr>
                          {isExpanded && model.subscribersByCohort && (
                            <tr className="bg-slate-900/60 transition-all">
                              <td colSpan={8} className="px-4 py-4 border-b border-slate-800">
                                <div className="flex flex-col gap-3">
                                  <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300">
                                    <div className="w-48 font-medium text-slate-50 uppercase tracking-widest text-[10px]">Subscriber Core Demographics</div>
                                    {totalSubscribers === 0 ? (
                                      <div className="text-slate-500 italic">No market penetration</div>
                                    ) : (
                                      Object.entries(model.subscribersByCohort).map(([cohortId, count]) => {
                                        const share = ((Number(count) / totalSubscribers) * 100).toFixed(1);
                                        const def = game.globalCohorts[cohortId as CohortId];
                                        if (!def) return null;
                                        return (
                                          <div key={`share-${cohortId}`} className="flex flex-col">
                                            <span className="font-medium">{def.name}</span>
                                            <span className="font-mono text-xs text-slate-400">
                                              {share}% ({Number(count).toLocaleString()})
                                            </span>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300 border-t border-slate-800/60 pt-2">
                                    <div className="w-48 font-medium text-slate-50 uppercase tracking-widest text-[10px]">Market Penetration</div>
                                    {Object.entries(model.subscribersByCohort).map(([cohortId, count]) => {
                                      const def = game.globalCohorts[cohortId as CohortId];
                                      if (!def) return null;
                                      const penetration = ((Number(count) / def.population) * 100).toFixed(2);
                                      return (
                                        <div key={`pen-${cohortId}`} className="flex flex-col">
                                          <span className="font-medium text-xs text-slate-400">{def.name} Penetration</span>
                                          <span className="font-mono text-xs text-amber-300/80">
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
