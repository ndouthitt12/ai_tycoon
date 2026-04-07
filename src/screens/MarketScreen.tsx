import React, { useState } from "react";

import { RIVALS } from "../game/defs";
import { formatVersion, getMarketCompanyTable, getMarketModelTable, money, monthLabel } from "../game/sim";
import { CohortId, GameState } from "../game/types";
import { Badge, EmptyState, Panel, SegmentedControl, StatRow } from "../components/ui";

type ModelSortKey =
  | "owner"
  | "name"
  | "releaseMonth"
  | "capability"
  | "marketDelta"
  | "developmentCost"
  | "memorySize"
  | "parameterScale"
  | "contextWindow"
  | "speed"
  | "accuracy"
  | "reasoning"
  | "agentic"
  | "coding"
  | "multimodal"
  | "creativity"
  | "alignment"
  | "multilingual"
  | "recall"
  | "compression";

function compareValues(left: string | number, right: string | number) {
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right);
  }
  return Number(left) - Number(right);
}

export function MarketScreen({ game }: { game: GameState }) {
  const [activeTab, setActiveTab] = useState<"forces" | "models" | "companies">("forces");
  const [expandedModelKey, setExpandedModelKey] = useState<string | null>(null);
  
  const [modelSort, setModelSort] = useState<{ key: ModelSortKey; direction: "asc" | "desc" }>({
    key: "capability",
    direction: "desc",
  });
  
  type CompanySortKey = "name" | "cash" | "priorYearRevenue" | "priorYearProfit" | "topModel" | "averageCapability";
  const [companySort, setCompanySort] = useState<{ key: CompanySortKey; direction: "asc" | "desc" }>({
    key: "averageCapability",
    direction: "desc",
  });
  const pricingPressure = game.marketModifiers
    .filter((modifier) => modifier.type === "pricing_pressure")
    .reduce((sum, modifier) => sum + modifier.intensity, 0);
  const commoditization = game.marketModifiers
    .filter((modifier) => modifier.type === "commoditization")
      .reduce((sum, modifier) => sum + modifier.intensity, 0);
  const marketModels = getMarketModelTable(game);
  const marketCompanies = getMarketCompanyTable(game);
  
  const sortedMarketCompanies = [...marketCompanies].sort((left, right) => {
    const leftValue = left[companySort.key];
    const rightValue = right[companySort.key];
    const comparison = compareValues(leftValue, rightValue);
    if (comparison !== 0) {
      return companySort.direction === "asc" ? comparison : -comparison;
    }
    return right.averageCapability - left.averageCapability;
  });
  const sortedMarketModels = [...marketModels].sort((left, right) => {
    const leftValue =
      modelSort.key === "owner"
        ? left.owner
        : modelSort.key === "name"
          ? `${left.name} ${formatVersion(left.version)}`
          : modelSort.key === "releaseMonth"
            ? left.releaseMonth
            : modelSort.key === "capability"
              ? left.capability
              : modelSort.key === "marketDelta"
                ? left.capability - game.marketStandard
                : modelSort.key === "developmentCost"
                  ? left.developmentCost
                  : modelSort.key === "memorySize"
                    ? left.memorySize
                    : modelSort.key === "parameterScale"
                      ? left.parameterScale
                      : modelSort.key === "contextWindow"
                        ? left.contextWindow
                        : modelSort.key === "speed"
                          ? left.goals.speed
                          : modelSort.key === "accuracy"
                            ? left.goals.accuracy
                            : modelSort.key === "reasoning"
                              ? left.goals.reasoning
                              : modelSort.key === "agentic"
                                ? left.goals.agentic
                                : modelSort.key === "coding"
                                  ? left.goals.coding
                                  : modelSort.key === "multimodal"
                                    ? left.goals.multimodal
                                    : modelSort.key === "creativity"
                                      ? left.goals.creativity
                                      : modelSort.key === "alignment"
                                        ? left.goals.alignment
                                        : modelSort.key === "multilingual"
                                          ? left.goals.multilingual
                                          : modelSort.key === "recall"
                                            ? left.goals.recall
                                            : left.goals.compression;
    const rightValue =
      modelSort.key === "owner"
        ? right.owner
        : modelSort.key === "name"
          ? `${right.name} ${formatVersion(right.version)}`
          : modelSort.key === "releaseMonth"
            ? right.releaseMonth
            : modelSort.key === "capability"
              ? right.capability
              : modelSort.key === "marketDelta"
                ? right.capability - game.marketStandard
                : modelSort.key === "developmentCost"
                  ? right.developmentCost
                  : modelSort.key === "memorySize"
                    ? right.memorySize
                    : modelSort.key === "parameterScale"
                      ? right.parameterScale
                      : modelSort.key === "contextWindow"
                        ? right.contextWindow
                        : modelSort.key === "speed"
                          ? right.goals.speed
                          : modelSort.key === "accuracy"
                            ? right.goals.accuracy
                            : modelSort.key === "reasoning"
                              ? right.goals.reasoning
                              : modelSort.key === "agentic"
                                ? right.goals.agentic
                                : modelSort.key === "coding"
                                  ? right.goals.coding
                                  : modelSort.key === "multimodal"
                                    ? right.goals.multimodal
                                    : modelSort.key === "creativity"
                                      ? right.goals.creativity
                                      : modelSort.key === "alignment"
                                        ? right.goals.alignment
                                        : modelSort.key === "multilingual"
                                          ? right.goals.multilingual
                                          : modelSort.key === "recall"
                                            ? right.goals.recall
                                            : right.goals.compression;
    const comparison = compareValues(leftValue, rightValue);
    if (comparison !== 0) {
      return modelSort.direction === "asc" ? comparison : -comparison;
    }
    return right.capability - left.capability;
  });

  function toggleModelSort(key: ModelSortKey) {
    setModelSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "owner" || key === "name" ? "asc" : "desc" },
    );
  }

  function renderSortLabel(label: string, key: ModelSortKey) {
    if (modelSort.key !== key) return `${label} <>`;
    return `${label} ${modelSort.direction === "asc" ? "^" : "v"}`;
  }

  function toggleCompanySort(key: CompanySortKey) {
    setCompanySort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "name" || key === "topModel" ? "asc" : "desc" },
    );
  }

  function renderCompanySortLabel(label: string, key: CompanySortKey) {
    if (companySort.key !== key) return `${label} <>`;
    return `${label} ${companySort.direction === "asc" ? "^" : "v"}`;
  }

  return (
    <div className="space-y-6">
      <SegmentedControl
        options={[
          { key: "forces", label: "Market Forces" },
          { key: "models", label: "Model Benchmarks" },
          { key: "companies", label: "Companies" },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
      />

      {activeTab === "forces" ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Panel title="Rival Map" subtitle="The benchmark no longer moves as a single hidden timer.">
              <div className="grid gap-4">
                {Object.values(RIVALS).map((rival) => {
                  const state = game.rivals[rival.id];
                  return (
                    <div key={rival.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-lg font-semibold text-slate-50">{rival.name}</div>
                          <div className="mt-1 text-sm text-slate-400">{rival.summary}</div>
                        </div>
                        <Badge tone="warning">{state.cooldown} mo</Badge>
                      </div>
                      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-300">
                        {state.lastAction ?? "No recent move. Monitor cooldown and prepare for the next shock."}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Market Modifiers" subtitle="Temporary channel pressure makes the strategic layer visible month to month.">
              <div className="space-y-3">
                {game.marketModifiers.length === 0 ? (
                  <EmptyState title="No active modifiers" body="The market is calm for now. That usually does not last." />
                ) : (
                  game.marketModifiers.map((modifier) => (
                    <div key={modifier.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-slate-50">{modifier.title}</div>
                          <div className="mt-1 text-sm text-slate-400">{modifier.description}</div>
                        </div>
                        <Badge tone={modifier.type === "pricing_pressure" ? "warning" : "bad"}>
                          {modifier.turnsRemaining} mo
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Channel Pressure" subtitle="A compact readout of the forces pushing against product economics.">
              <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                <StatRow label="Market Standard" value={game.marketStandard} tone="warning" />
                <StatRow label="Pricing Pressure" value={pricingPressure.toFixed(2)} tone={pricingPressure > 0 ? "warning" : "good"} />
                <StatRow label="Commoditization" value={commoditization.toFixed(2)} tone={commoditization > 0 ? "bad" : "good"} />
                <StatRow label="Consumer Distribution" value={game.distribution.consumer.toFixed(1)} />
                <StatRow label="Enterprise Distribution" value={game.distribution.enterprise.toFixed(1)} />
                <StatRow label="Board Pressure" value={game.boardPressure.toFixed(1)} tone={game.boardPressure < 40 ? "good" : game.boardPressure < 70 ? "warning" : "bad"} />
              </div>
            </Panel>
          </div>
        </div>
      ) : activeTab === "models" ? (
        <Panel title="Model Benchmarks" subtitle="Track your lineup against the models currently shaping the market.">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/45">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/85 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("owner")} className="transition hover:text-slate-100">
                      {renderSortLabel("Owner", "owner")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("name")} className="transition hover:text-slate-100">
                      {renderSortLabel("Model", "name")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("releaseMonth")} className="transition hover:text-slate-100">
                      {renderSortLabel("Release Month", "releaseMonth")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("capability")} className="transition hover:text-slate-100">
                      {renderSortLabel("Capability", "capability")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("marketDelta")} className="transition hover:text-slate-100">
                      {renderSortLabel("Vs Market", "marketDelta")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("developmentCost")} className="transition hover:text-slate-100">
                      {renderSortLabel("Dev Cost", "developmentCost")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Chat Price</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">API Price</th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("memorySize")} className="transition hover:text-slate-100">
                      {renderSortLabel("Memory", "memorySize")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("parameterScale")} className="transition hover:text-slate-100">
                      {renderSortLabel("Params", "parameterScale")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("contextWindow")} className="transition hover:text-slate-100">
                      {renderSortLabel("Context", "contextWindow")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("speed")} className="transition hover:text-slate-100">
                      {renderSortLabel("Speed", "speed")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("accuracy")} className="transition hover:text-slate-100">
                      {renderSortLabel("Accuracy", "accuracy")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("reasoning")} className="transition hover:text-slate-100">
                      {renderSortLabel("Reasoning", "reasoning")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("agentic")} className="transition hover:text-slate-100">
                      {renderSortLabel("Agentic", "agentic")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("coding")} className="transition hover:text-slate-100">
                      {renderSortLabel("Coding", "coding")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("multimodal")} className="transition hover:text-slate-100">
                      {renderSortLabel("Multimodal", "multimodal")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("creativity")} className="transition hover:text-slate-100">
                      {renderSortLabel("Creativity", "creativity")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("alignment")} className="transition hover:text-slate-100">
                      {renderSortLabel("Alignment", "alignment")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("multilingual")} className="transition hover:text-slate-100">
                      {renderSortLabel("Multilingual", "multilingual")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("recall")} className="transition hover:text-slate-100">
                      {renderSortLabel("Recall", "recall")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleModelSort("compression")} className="transition hover:text-slate-100">
                      {renderSortLabel("Compression", "compression")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMarketModels.map((model) => {
                  const rowKey = `${model.owner}-${model.name}-${model.version}`;
                  const isExpanded = expandedModelKey === rowKey;
                  const toggleExpand = () => setExpandedModelKey(isExpanded ? null : rowKey);

                  const totalSubscribers = model.subscribersByCohort
                    ? Object.values(model.subscribersByCohort).reduce((a, b) => a + Number(b), 0)
                    : 0;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        onClick={toggleExpand}
                        className="cursor-pointer border-t border-slate-800/80 text-slate-200 hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">{model.owner}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-50">
                            {model.name} v{formatVersion(model.version)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">{monthLabel(model.releaseMonth)}</td>
                        <td className="px-4 py-3 font-mono">{model.capability}</td>
                        <td className="px-4 py-3">
                          <Badge tone={model.marketTone}>{model.marketLabel}</Badge>
                        </td>
                        <td className="px-4 py-3 font-mono">{money(model.developmentCost)}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{model.owner === "Your Company" ? (game.products.chatbot.modelPrices[model.id as number] ? `$${game.products.chatbot.modelPrices[model.id as number]}/mo` : "---") : (model as any).chatPrice ? `$${(model as any).chatPrice}/mo` : "---"}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{model.owner === "Your Company" ? (game.products.api.modelPrices[model.id as number] ? `$${game.products.api.modelPrices[model.id as number].toFixed(2)}/1M` : "---") : (model as any).apiPrice ? `$${(model as any).apiPrice.toFixed(2)}/1M` : "---"}</td>
                        <td className="px-4 py-3 font-mono">{model.memorySize} GB</td>
                        <td className="px-4 py-3 font-mono">{model.parameterScale.toFixed(1)}B</td>
                        <td className="px-4 py-3 font-mono">{model.contextWindow}K</td>
                        <td className="px-4 py-3 font-mono">{model.goals.speed}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.accuracy}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.reasoning}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.agentic}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.coding}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.multimodal}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.creativity}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.alignment}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.multilingual}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.recall}</td>
                        <td className="px-4 py-3 font-mono">{model.goals.compression}</td>
                      </tr>
                      {isExpanded && model.subscribersByCohort && (
                        <tr className="bg-slate-900/60 transition-all">
                          <td colSpan={20} className="px-4 py-4 border-b border-slate-800">
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
        </Panel>
      ) : (
        <Panel title="Company Landscape" subtitle="A higher-level readout of who has money, who is profitable, and which flagship is carrying them.">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/45">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900/85 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleCompanySort("name")} className="transition hover:text-slate-100">
                      {renderCompanySortLabel("Company", "name")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleCompanySort("cash")} className="transition hover:text-slate-100">
                      {renderCompanySortLabel("Cash", "cash")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleCompanySort("priorYearRevenue")} className="transition hover:text-slate-100">
                      {renderCompanySortLabel("Prev Year Revenue", "priorYearRevenue")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleCompanySort("priorYearProfit")} className="transition hover:text-slate-100">
                      {renderCompanySortLabel("Prev Year Profit", "priorYearProfit")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleCompanySort("topModel")} className="transition hover:text-slate-100">
                      {renderCompanySortLabel("Top Model", "topModel")}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button type="button" onClick={() => toggleCompanySort("averageCapability")} className="transition hover:text-slate-100">
                      {renderCompanySortLabel("Avg Capability", "averageCapability")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedMarketCompanies.map((company) => (
                  <tr key={company.name} className="border-t border-slate-800/80 text-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-50">{company.name}</td>
                    <td className="px-4 py-3 font-mono">{money(company.cash)}</td>
                    <td className="px-4 py-3 font-mono">{money(company.priorYearRevenue)}</td>
                    <td className="px-4 py-3 font-mono">{money(company.priorYearProfit)}</td>
                    <td className="px-4 py-3">{company.topModel}</td>
                    <td className="px-4 py-3 font-mono">{company.averageCapability.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
