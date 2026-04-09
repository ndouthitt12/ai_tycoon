import { COMPETITOR_COMPANIES } from "../defs";
import { CohortDef, CohortId, CompetitorModelState, GameState, ModelGoalId, ModelState, ProductState, ProductTypeId, ReliabilityTierId, SubscriptionPlan } from "../types";
import {
  API_MODEL_ACQUISITION_DECAY,
  API_MODEL_AGE_CHURN_COEFFICIENT,
  API_SHARE_CONVERGENCE,
  BASE_CONTEXT_WINDOW,
  BUDGET_CLIFF_DECAY,
  BUDGET_CLIFF_FLOOR,
  CHATBOT_MODEL_ACQUISITION_DECAY,
  CHATBOT_MODEL_AGE_CHURN_COEFFICIENT,
  CHATBOT_SHARE_CONVERGENCE,
  CHATBOT_DEEP_CONVERSATION_MULTIPLIER,
  CHATBOT_STANDARD_CONVERSATION_MULTIPLIER,
  CHATBOT_TOKENS_PER_POD_MILLIONS,
  CONTEXT_OVERHEAD_STEP_RATE,
  CONTEXT_OVERHEAD_STEP_WINDOW,
  CONSUMER_MULTIMODAL_BONUS_COEFFICIENT,
  CONSUMER_RECENCY_BASELINE,
  CONSUMER_RECENCY_MULTIPLIER_COEFFICIENT,
  CONSUMER_SPEED_BONUS_COEFFICIENT,
  INADEQUATE_PLAN_APPEAL_MULTIPLIER,
  MODEL_CHURN_CEILING,
  MODEL_CHURN_FLOOR,
  MODEL_RECENCY_MONTH_WINDOW,
  MODEL_RECENCY_SCORE_FLOOR,
  PLAN_PRICE_TIEBREAKER_COEFFICIENT,
} from "./balance";
import { getCompetitorCompanyState } from "./competitors";

interface MarketPlanOption {
  plan: SubscriptionPlan | null;
  appeal: number;
  price: number;
  usedTokensM: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundVersion(value: number) {
  return Number(value.toFixed(3));
}

function formatVersion(value: number) {
  const rounded = roundVersion(value);
  return rounded.toFixed(3).replace(/\.?0+$/, (match) => (match.includes(".") ? ".0" : ""));
}

function getModelById(game: GameState, id: number | null) {
  return game.models.find((model) => model.id === id) || null;
}

function getProductModels(game: GameState, product: ProductState) {
  return product.modelIds
    .map((id) => getModelById(game, id))
    .filter((model): model is NonNullable<ReturnType<typeof getModelById>> => Boolean(model));
}

function getModelPrice(product: ProductState, modelId: number) {
  return product.modelPrices[String(modelId)] ?? product.price;
}

function getGoalTotal(goals: Record<ModelGoalId, number>) {
  return Object.values(goals).reduce((sum, value) => sum + value, 0);
}

function getGoalShare(goals: Record<ModelGoalId, number>, key: ModelGoalId) {
  const total = Math.max(1, getGoalTotal(goals));
  return goals[key] / total;
}

function getModelGoalScores(model: ModelState | CompetitorModelState) {
  const capabilitySignal = model.capability;
  const speedSignal = "inferenceCost" in model ? clamp(100 - model.inferenceCost * 14, 20, 98) : clamp(40 + model.capability * 0.4, 20, 98);
  const contextSignal = clamp(20 + model.contextWindow * 0.9, 20, 98);
  const trustSignal = "trust" in model ? model.trust : 60;

  return {
    speed: Math.max(15, 18 + speedSignal * 0.56 + capabilitySignal * 0.14 + getGoalShare(model.goals, "speed") * 26),
    accuracy: Math.max(15, 20 + capabilitySignal * 0.45 + trustSignal * 0.18 + getGoalShare(model.goals, "accuracy") * 28),
    reasoning: Math.max(15, 16 + capabilitySignal * 0.42 + contextSignal * 0.36 + getGoalShare(model.goals, "reasoning") * 30),
    agentic: Math.max(15, 14 + capabilitySignal * 0.32 + contextSignal * 0.32 + trustSignal * 0.12 + getGoalShare(model.goals, "agentic") * 32),
    coding: Math.max(15, 16 + capabilitySignal * 0.38 + contextSignal * 0.18 + getGoalShare(model.goals, "coding") * 30),
    multimodal: Math.max(15, 16 + capabilitySignal * 0.34 + contextSignal * 0.22 + getGoalShare(model.goals, "multimodal") * 28),
  };
}

function getGoalFitScore(goalScores: ReturnType<typeof getModelGoalScores>, productType: ProductTypeId) {
  if (productType === "chatbot") {
    return (
      goalScores.speed * 0.22 +
      goalScores.accuracy * 0.2 +
      goalScores.reasoning * 0.25 +
      goalScores.agentic * 0.13 +
      goalScores.coding * 0.05 +
      goalScores.multimodal * 0.15
    );
  }

  return (
    goalScores.speed * 0.24 +
    goalScores.accuracy * 0.21 +
    goalScores.reasoning * 0.14 +
    goalScores.agentic * 0.15 +
    goalScores.coding * 0.2 +
    goalScores.multimodal * 0.06
  );
}

export function getMarketComparison(capability: number, marketStandard: number) {
  const delta = capability - marketStandard;
  const tone: "default" | "good" | "warning" | "bad" =
    delta >= 8 ? "good" : delta >= 0 ? "default" : delta >= -8 ? "warning" : "bad";
  const label = delta >= 0 ? `+${delta} vs market` : `${delta} vs market`;
  return { delta, tone, label };
}

export function createDefaultModelPerformance() {
  return {
    totalRevenue: 0,
    lastMonthRevenue: 0,
    lastMonthAcquisition: 0,
    lastMonthChurn: 0,
    lastMonthUsers: 0,
  };
}

export function getBlendedModelMetrics(game: GameState, product: ProductState) {
  const models = getProductModels(game, product);
  if (!models.length) return null;

  const averageCapability = models.reduce((sum, model) => sum + model.capability, 0) / models.length;
  const bestCapability = Math.max(...models.map((model) => model.capability));
  const inferenceCost = models.reduce((sum, model) => sum + model.inferenceCost, 0) / models.length;
  const trust = models.reduce((sum, model) => sum + model.trust, 0) / models.length;
  const contextWindow = models.reduce((sum, model) => sum + model.contextWindow, 0) / models.length;
  const averagePrice = models.reduce((sum, model) => sum + getModelPrice(product, model.id), 0) / models.length;
  const averageAge = models.reduce((sum, model) => sum + Math.max(0, game.turn - model.monthBuilt), 0) / models.length;
  const recencyScore = models.reduce(
    (sum, model) => sum + clamp((MODEL_RECENCY_MONTH_WINDOW - Math.max(0, game.turn - model.monthBuilt)) / MODEL_RECENCY_MONTH_WINDOW, MODEL_RECENCY_SCORE_FLOOR, 1),
    0,
  ) / models.length;
  const goalScores = models.reduce(
    (aggregate, model) => {
      const scores = getModelGoalScores(model);
      return {
        speed: aggregate.speed + scores.speed,
        accuracy: aggregate.accuracy + scores.accuracy,
        reasoning: aggregate.reasoning + scores.reasoning,
        agentic: aggregate.agentic + scores.agentic,
        coding: aggregate.coding + scores.coding,
        multimodal: aggregate.multimodal + scores.multimodal,
      };
    },
    { speed: 0, accuracy: 0, reasoning: 0, agentic: 0, coding: 0, multimodal: 0 },
  );
  const averagedGoalScores = {
    speed: goalScores.speed / models.length,
    accuracy: goalScores.accuracy / models.length,
    reasoning: goalScores.reasoning / models.length,
    agentic: goalScores.agentic / models.length,
    coding: goalScores.coding / models.length,
    multimodal: goalScores.multimodal / models.length,
  };

  return {
    models,
    averageCapability,
    bestCapability,
    inferenceCost,
    trust,
    contextWindow,
    averagePrice,
    averageAge,
    recencyScore,
    goalFit: getGoalFitScore(averagedGoalScores, product.type),
    goalScores: averagedGoalScores,
  };
}

function getContextPenalty(contextWindow: number) {
  return 1 + Math.max(0, (contextWindow - BASE_CONTEXT_WINDOW) / CONTEXT_OVERHEAD_STEP_WINDOW) * CONTEXT_OVERHEAD_STEP_RATE;
}

function getChatbotConversationDepthMultiplier(cohort: CohortDef) {
  return cohort.id === "developer" || cohort.id === "power"
    ? CHATBOT_DEEP_CONVERSATION_MULTIPLIER
    : CHATBOT_STANDARD_CONVERSATION_MULTIPLIER;
}

function getCohortTokenDemandMillions(cohort: CohortDef, productType: ProductTypeId) {
  if (productType === "api") {
    return Math.max(0, cohort.baseTokensPerMonthMillions || 0);
  }

  return (cohort.sessionsPerMonth * cohort.tokensPerSession * getChatbotConversationDepthMultiplier(cohort)) / 1000000;
}

function getEstimatedProductTokenUsage(game: GameState, product: ProductState) {
  if (product.tokenUsageMillions > 0) return product.tokenUsageMillions;

  if (product.type === "chatbot" && product.subscriptionPlans?.length) {
    const planUsage = product.subscriptionPlans.reduce((sum, plan) => sum + plan.tokenUsageMillions, 0);
    if (planUsage > 0) return planUsage;
  }

  const models = getProductModels(game, product);
  if (!models.length) return 0;

  return Object.values(game.globalCohorts).reduce((sum, cohort) => {
    const isEligible =
      (product.type === "chatbot" && cohort.category === "Consumer") ||
      (product.type === "api" && cohort.category === "Business");
    if (!isEligible) return sum;

    const cohortSubscribers = models.reduce(
      (modelSum, model) => modelSum + (model.subscribersByCohort[cohort.id] || 0),
      0,
    );
    return sum + cohortSubscribers * getCohortTokenDemandMillions(cohort, product.type);
  }, 0);
}

function getPlanCoverage(neededTokensM: number, tokenLimitMillions: number) {
  if (neededTokensM <= 0) return 1;
  return clamp(tokenLimitMillions / neededTokensM, 0, 1);
}

function getEffectiveSpend(cohort: CohortDef, productType: ProductTypeId | undefined, evaluatedPrice: number) {
  if (productType === "api") {
    return evaluatedPrice * Math.max(0, cohort.baseTokensPerMonthMillions);
  }

  return evaluatedPrice;
}

function getBudgetCliffMultiplier(cohort: CohortDef, effectiveSpend: number) {
  if (effectiveSpend <= cohort.maxBudget) return 1;

  const overspendRatio = (effectiveSpend - cohort.maxBudget) / Math.max(1, cohort.maxBudget);
  return Math.max(BUDGET_CLIFF_FLOOR, Math.exp(-BUDGET_CLIFF_DECAY * overspendRatio));
}

function getValueAdjustedAppeal(rawAppeal: number, cohort: CohortDef, effectiveSpend: number) {
  const valueToPriceWeight = clamp(cohort.valueToPriceWeight, 0, 1);
  const roiAppeal = rawAppeal * (Math.max(1, cohort.maxBudget) / Math.max(1, effectiveSpend));
  const valueAdjustedAppeal =
    Math.pow(rawAppeal, 1 - valueToPriceWeight) *
    Math.pow(Math.max(0.0001, roiAppeal), valueToPriceWeight);

  return valueAdjustedAppeal * getBudgetCliffMultiplier(cohort, effectiveSpend);
}

function getPlanPriceTieBreaker(cohort: CohortDef, price: number) {
  return Math.exp(-(cohort.priceSensitivity * PLAN_PRICE_TIEBREAKER_COEFFICIENT) * price);
}

export function getProductComputeUsage(
  game: GameState,
  product: ProductState,
  metrics: ReturnType<typeof getBlendedModelMetrics>,
): { demand: number; tokensMillions: number } {
  if (!metrics) return { demand: 0, tokensMillions: 0 };

  const contextPenalty = getContextPenalty(metrics.contextWindow);
  const totalTokensMillions = getEstimatedProductTokenUsage(game, product);
  const baseDemand = totalTokensMillions / CHATBOT_TOKENS_PER_POD_MILLIONS;
  const demand = baseDemand * metrics.inferenceCost * contextPenalty;
  return { demand, tokensMillions: totalTokensMillions };
}

export function getProjectedServingDemand(game: GameState) {
  const projectedDemand = Object.values(game.products).reduce((sum, product) => {
    const metrics = getBlendedModelMetrics(game, product);
    const usage = getProductComputeUsage(game, product, metrics);
    return sum + usage.demand;
  }, 0);

  if (projectedDemand > 0) return projectedDemand;
  const hasLiveProducts = Object.values(game.products).some((product) => product.modelIds.length > 0);
  return hasLiveProducts ? game.lastMonth.servingDemand : 0;
}

export function getMarketModelTable(game: GameState) {
  const rivalRows = COMPETITOR_COMPANIES.flatMap((company, index) => {
    const competitor = getCompetitorCompanyState(game, company.id, index);
    return competitor.models.map((model) => ({
      owner: company.name,
      id: model.name,
      chatPrice: model.chatPrice,
      apiPrice: model.apiPrice,
      ...model,
    }));
  });

  const playerRows = game.models.map((model) => ({
    owner: "Your Company",
    id: model.id,
    name: model.name,
    version: model.version,
    developmentCost: model.developmentCost,
    capability: model.capability,
    memorySize: model.memorySize,
    parameterScale: model.parameterScale,
    contextWindow: model.contextWindow,
    goals: { ...model.goals },
    monthBuilt: model.monthBuilt,
    releaseMonth: model.monthBuilt,
    subscribersByCohort: model.subscribersByCohort,
  }));

  return [...playerRows, ...rivalRows]
    .map((entry) => ({
      ...entry,
      marketLabel: getMarketComparison(entry.capability, game.marketStandard).label,
      marketTone: getMarketComparison(entry.capability, game.marketStandard).tone,
    }))
    .sort((a, b) => b.monthBuilt - a.monthBuilt || b.capability - a.capability);
}

export function getMarketCompanyTable(game: GameState) {
  const competitorRows = COMPETITOR_COMPANIES.map((company) => {
    const competitor = getCompetitorCompanyState(game, company.id);
    const topModel = [...competitor.models].sort((a, b) => b.capability - a.capability || b.monthBuilt - a.monthBuilt)[0] ?? null;
    const averageCapability = competitor.models.length
      ? competitor.models.reduce((sum, model) => sum + model.capability, 0) / competitor.models.length
      : game.marketStandard;
    const priorYearRevenue = Math.round(competitor.revenueHistory.reduce((sum, value) => sum + value, 0));
    const priorYearProfit = Math.round(competitor.profitHistory.reduce((sum, value) => sum + value, 0));
    const cash = Math.round(competitor.cash);

    return {
      name: company.name,
      cash,
      priorYearRevenue,
      priorYearProfit,
      topModel: topModel ? `${topModel.name} v${formatVersion(topModel.version)}` : "No flagship",
      averageCapability: Number(averageCapability.toFixed(1)),
    };
  });

  const playerTopModel = game.models.length
    ? [...game.models].sort((a, b) => b.capability - a.capability)[0]
    : null;

  const playerRow = {
    name: "Your Company",
    cash: Math.round(game.cash),
    priorYearRevenue: Math.round(game.lastMonth.revenue * 12),
    priorYearProfit: Math.round(game.lastMonth.profit * 12),
    topModel: playerTopModel ? `${playerTopModel.name} v${formatVersion(playerTopModel.version)}` : "No flagship",
    averageCapability: game.models.length
      ? Number((game.models.reduce((sum, model) => sum + model.capability, 0) / game.models.length).toFixed(1))
      : 0,
  };

  return [playerRow, ...competitorRows].sort((a, b) => b.averageCapability - a.averageCapability);
}

function getConsumerAppealMultiplier(
  game: GameState,
  contender: { model: ModelState | CompetitorModelState; isPlayer: boolean; productType?: ProductTypeId },
) {
  if (contender.productType !== "chatbot") return 1;
  const age = Math.max(0, game.turn - contender.model.monthBuilt);
  const recencyScore = clamp((MODEL_RECENCY_MONTH_WINDOW - age) / MODEL_RECENCY_MONTH_WINDOW, MODEL_RECENCY_SCORE_FLOOR, 1);
  const goalScores = getModelGoalScores(contender.model);
  const recencyMultiplier = 1 + (recencyScore - CONSUMER_RECENCY_BASELINE) * CONSUMER_RECENCY_MULTIPLIER_COEFFICIENT;
  const speedBonus = 1 + goalScores.speed * CONSUMER_SPEED_BONUS_COEFFICIENT;
  const multimodalBonus = 1 + goalScores.multimodal * CONSUMER_MULTIMODAL_BONUS_COEFFICIENT;
  const rivalLaunchMultiplier = contender.isPlayer ? 1 : 1 + game.competitorLaunchShock;
  return recencyMultiplier * speedBonus * multimodalBonus * rivalLaunchMultiplier;
}

function getShareConvergence(cohort: CohortDef, productType?: ProductTypeId) {
  if (cohort.category === "Consumer" && productType === "chatbot") return CHATBOT_SHARE_CONVERGENCE;
  return API_SHARE_CONVERGENCE;
}

function getModelPerformanceTuning(productType: ProductTypeId) {
  return productType === "chatbot"
    ? { decay: CHATBOT_MODEL_ACQUISITION_DECAY, churnCoefficient: CHATBOT_MODEL_AGE_CHURN_COEFFICIENT }
    : { decay: API_MODEL_ACQUISITION_DECAY, churnCoefficient: API_MODEL_AGE_CHURN_COEFFICIENT };
}

export function settleGlobalMarket(game: GameState, servingPressure: number) {
  const contenders: {
    id: string;
    model: ModelState | CompetitorModelState;
    price: number;
    isPlayer: boolean;
    productType?: ProductTypeId;
    salesMultiplier: number;
  }[] = [];

  (["chatbot", "api"] as ProductTypeId[]).forEach((type) => {
    const product = game.products[type];
    const productPrice = product.price;
    const marketingSpendMultiplier = game.marketingBudgetMillions > 0 ? 1 + Math.log1p(Math.max(0, game.marketingBudgetMillions) / Math.max(0.0001, type === "chatbot" ? 1.0 : 3.0)) : 1;
    const sales = game.headcount.sales;
    const gtm = game.upgrades.gtm;
    const distribution = type === "chatbot" ? game.distribution.consumer : game.distribution.enterprise;
    const acquisitionModifier =
      type === "chatbot"
        ? game.archetype === "consumer_ai_product_company" ? 1.2 : 1
        : game.archetype === "enterprise_copilot_company" ? 1.18 : game.archetype === "open_source_challenger" ? 1.12 : 1;
    const visibility = 1.0 + (distribution * 0.04) + (sales * 0.05) + (gtm * 0.1) + (marketingSpendMultiplier * 0.5) + (game.trust * 0.005) + (acquisitionModifier - 1);

    product.modelIds.forEach((modelId) => {
      const model = getModelById(game, modelId);
      if (model) {
        contenders.push({
          id: `player_${type}_${model.id}`,
          model,
          price: product.modelPrices[model.id] ?? productPrice,
          isPlayer: true,
          productType: type,
          salesMultiplier: visibility,
        });
      }
    });
  });

  Object.values(game.competitorCompanies).forEach((company) => {
    if (company.models.length > 0) {
      company.models.slice(0, 2).forEach((compModel, index) => {
        if (compModel.chatPrice) {
          contenders.push({
            id: `comp_${company.id}_${index}_chat`,
            model: compModel,
            price: compModel.chatPrice,
            isPlayer: false,
            productType: "chatbot",
            salesMultiplier: 1.0 + (index === 1 ? -0.4 : 0),
          });
        }
        if (compModel.apiPrice) {
          contenders.push({
            id: `comp_${company.id}_${index}_api`,
            model: compModel,
            price: compModel.apiPrice,
            isPlayer: false,
            productType: "api",
            salesMultiplier: 1.0 + (index === 1 ? -0.4 : 0),
          });
        }
      });
    }
  });

  if (game.products.chatbot.subscriptionPlans) {
    game.products.chatbot.subscriptionPlans.forEach((plan) => {
      plan.subscribers = 0;
      plan.revenue = 0;
      plan.profit = 0;
      plan.tokenUsageMillions = 0;
    });
  }

  const productDeltas = {
    chatbot: { users: 0, acq: 0, churn: 0, cost: 0, revenue: 0, prevUsers: game.products.chatbot.activeUsers, tokens: 0 },
    api: { users: 0, acq: 0, churn: 0, cost: 0, revenue: 0, prevUsers: game.products.api.activeUsers, tokens: 0 },
  };

  Object.values(game.globalCohorts).forEach((cohort) => {
    let totalAppeal = 0;
    const appealScores = contenders.map((contender) => {
      const model = contender.model;
      if (contender.productType === "chatbot" && cohort.category !== "Consumer") {
        return { contender, appeal: 0, options: [] as MarketPlanOption[] };
      }
      if (contender.productType === "api" && cohort.category !== "Business") {
        return { contender, appeal: 0, options: [] as MarketPlanOption[] };
      }

      let weightedReliabilityScore = 1.0;
      Object.entries(cohort.reliabilityWeights).forEach(([tier, weight]) => {
        weightedReliabilityScore += (model.reliability[tier as ReliabilityTierId] || 0) * (weight as number);
      });

      let baseAppeal = (model.capability * weightedReliabilityScore) * cohort.baseCapabilityWeight;
      Object.entries(cohort.weights).forEach(([goal, weight]) => {
        if ((weight as number) > 0 && model.goals[goal as ModelGoalId] !== undefined) {
          baseAppeal += model.goals[goal as ModelGoalId] * (weight as number) * 10;
        }
      });

      const rawAppeal = Math.max(1, baseAppeal);
      const neededTokensM = getCohortTokenDemandMillions(cohort, contender.productType ?? "chatbot");
      const options: MarketPlanOption[] = [];

      if (contender.isPlayer && contender.productType === "chatbot" && game.products.chatbot.subscriptionPlans?.length) {
        const sortedPlans = [...game.products.chatbot.subscriptionPlans].sort((a, b) => (a.price || 0) - (b.price || 0));
        const freePlan = sortedPlans.find((plan) => (plan.price || 0) === 0) ?? null;
        const paidPlans = sortedPlans.filter((plan) => !freePlan || plan.id !== freePlan.id);
        const freeCoverage = freePlan ? getPlanCoverage(neededTokensM, freePlan.tokenLimitMillions || 0) : 0;

        if (freePlan) {
          const freeAppeal = getValueAdjustedAppeal(rawAppeal, cohort, 0) * freeCoverage;
          if (freeAppeal > 0) {
            options.push({
              plan: freePlan,
              appeal: freeAppeal,
              price: freePlan.price || 0,
              usedTokensM: Math.min(neededTokensM, freePlan.tokenLimitMillions || 0),
            });
          }
        }

        const paidSurplusMultiplier = freePlan ? Math.max(0, 1 - freeCoverage) : 1;
        if (paidSurplusMultiplier > 0 && paidPlans.length > 0) {
          const fittingPaidPlans = paidPlans.filter((plan) => (plan.tokenLimitMillions || 0) >= neededTokensM);
          const candidatePaidPlans = fittingPaidPlans.length > 0
            ? fittingPaidPlans
            : [paidPlans[paidPlans.length - 1]];
          const useTieBreaker = candidatePaidPlans.length > 1;

          candidatePaidPlans.forEach((plan) => {
            const planCoverage = getPlanCoverage(neededTokensM, plan.tokenLimitMillions || 0);
            const adequacyMultiplier = planCoverage >= 1 ? 1 : INADEQUATE_PLAN_APPEAL_MULTIPLIER;
            let paidAppeal =
              getValueAdjustedAppeal(rawAppeal, cohort, getEffectiveSpend(cohort, contender.productType, plan.price || 0)) *
              paidSurplusMultiplier *
              adequacyMultiplier;

            if (useTieBreaker) {
              paidAppeal *= getPlanPriceTieBreaker(cohort, plan.price || 0);
            }

            if (paidAppeal > 0) {
              options.push({
                plan,
                appeal: paidAppeal,
                price: plan.price || 0,
                usedTokensM: Math.min(neededTokensM, plan.tokenLimitMillions || 0),
              });
            }
          });
        }
      } else {
        options.push({
          plan: null,
          appeal: getValueAdjustedAppeal(rawAppeal, cohort, getEffectiveSpend(cohort, contender.productType, contender.price)),
          price: contender.price,
          usedTokensM: neededTokensM,
        });
      }

      if (!options.length) {
        options.push({
          plan: null,
          appeal: 0,
          price: contender.price,
          usedTokensM: neededTokensM,
        });
      }

      let appeal = options.reduce((sum, option) => sum + option.appeal, 0);
      appeal *= contender.salesMultiplier;

      if (cohort.category === "Consumer" && contender.productType === "chatbot") {
        appeal *= getConsumerAppealMultiplier(game, contender);
      }

      totalAppeal += appeal;
      return { contender, appeal, options };
    });

    appealScores.forEach(({ contender, appeal, options }) => {
      const targetShare = totalAppeal > 0 ? appeal / totalAppeal : 0;
      const targetUsers = cohort.population * targetShare;
      const currentUsers = contender.model.subscribersByCohort[cohort.id as CohortId] || 0;
      const convergence = getShareConvergence(cohort, contender.productType);
      const rawDelta = (targetUsers - currentUsers) * convergence;
      const expectedChurn = cohort.category === "Consumer" && contender.productType === "chatbot" ? 0 : rawDelta < 0 ? Math.abs(currentUsers * 0.05) : 0;
      const nextUsers = Math.max(0, currentUsers + rawDelta - expectedChurn);
      const delta = nextUsers - currentUsers;

      if (contender.isPlayer && contender.productType) {
        productDeltas[contender.productType].users += nextUsers;
        if (delta > 0) productDeltas[contender.productType].acq += delta;
        if (delta < 0) productDeltas[contender.productType].churn += Math.abs(delta);
        const totalOptionAppeal = options.reduce((sum, option) => sum + option.appeal, 0);
        const allocatedOptions = totalOptionAppeal > 0 ? options : options.slice(0, 1);

        allocatedOptions.forEach((option) => {
          const share = totalOptionAppeal > 0 ? option.appeal / totalOptionAppeal : 1;
          const usersForOption = (nextUsers || 0) * share;
          const optionRevenue = usersForOption * (option.price || 0);
          const optionTokenUsage = usersForOption * (option.usedTokensM || 0);

          productDeltas[contender.productType].revenue += optionRevenue;
          productDeltas[contender.productType].tokens += optionTokenUsage;

          if (option.plan) {
            option.plan.subscribers += usersForOption;
            option.plan.revenue += optionRevenue;
            option.plan.tokenUsageMillions += optionTokenUsage;
          }
        });
      }

      contender.model.subscribersByCohort[cohort.id as CohortId] = nextUsers;
    });
  });

  (["chatbot", "api"] as ProductTypeId[]).forEach((type) => {
    const product = game.products[type];
    const delta = productDeltas[type];
    const activeUsers = Math.max(0, Math.round(delta.users));
    product.activeUsers = activeUsers;
    product.revenue = Math.max(0, Math.round(delta.revenue));
    product.acquisition = Math.round(delta.acq);

    if (type === "chatbot" && product.subscriptionPlans) {
      product.tokenUsageMillions = product.subscriptionPlans.reduce((sum, plan) => sum + plan.tokenUsageMillions, 0);
    } else {
      product.tokenUsageMillions = delta.tokens;
    }

    const abstractChurn = Math.round(delta.churn) + Math.round(activeUsers * 0.02);
    product.churn = activeUsers > 0 ? Number((abstractChurn / (activeUsers + abstractChurn)).toFixed(3)) : 0;

    const metrics = getBlendedModelMetrics(game, product);
    const usage = getProductComputeUsage(game, product, metrics);
    product.computeDemand = usage.demand;
    product.tokenUsageMillions = usage.tokensMillions;
    product.computeCost = Math.round(product.computeDemand * 2500);
    product.trust = metrics ? clamp(Math.round(metrics.trust * 0.55 + game.trust * 0.45 - servingPressure * 14), 10, 99) : clamp(game.trust, 10, 99);
  });
}

export function updateModelPerformance(game: GameState) {
  const nextPerformance: GameState["modelPerformance"] = Object.fromEntries(
    game.models.map((model) => [String(model.id), { ...(game.modelPerformance[String(model.id)] ?? createDefaultModelPerformance()) }]),
  );
  const churnWeightByModel: Record<string, number> = {};
  const churnTotalByModel: Record<string, number> = {};
  const monthlyUserMultiplier = clamp(Number(game.monthlyUserMultiplier) || 1, 0.1, 10);

  Object.keys(nextPerformance).forEach((modelId) => {
    nextPerformance[modelId].lastMonthRevenue = 0;
    nextPerformance[modelId].lastMonthAcquisition = 0;
    nextPerformance[modelId].lastMonthChurn = 0;
    nextPerformance[modelId].lastMonthUsers = 0;
  });

  Object.values(game.products).forEach((product) => {
    if (!product.modelIds.length) return;
    const modelCount = product.modelIds.length;
    const totalLinePrice = product.modelIds.reduce((sum, modelId) => sum + (product.modelPrices[String(modelId)] ?? product.price), 0);
    const rawEndingUsers = Math.max(0, product.activeUsers / monthlyUserMultiplier);
    const rawStartingUsers =
      product.churn < 0.999
        ? Math.max(0, (rawEndingUsers - product.acquisition) / Math.max(0.001, 1 - product.churn))
        : 0;
    const modelAges: Record<string, number> = {};
    product.modelIds.forEach((modelId) => {
      const model = game.models.find((entry) => entry.id === modelId);
      modelAges[String(modelId)] = model ? Math.max(0, game.turn - model.monthBuilt) : 999;
    });
    const avgAge = Object.values(modelAges).reduce((sum, age) => sum + age, 0) / modelCount;
    const storedPriorUsers: Record<string, number> = {};
    product.modelIds.forEach((modelId) => {
      storedPriorUsers[String(modelId)] = Math.max(0, game.modelPerformance[String(modelId)]?.lastMonthUsers ?? 0);
    });
    const totalStoredPriorUsers = Object.values(storedPriorUsers).reduce((sum, value) => sum + value, 0);
    const tuning = getModelPerformanceTuning(product.type);

    const acquisitionWeights: Record<string, number> = {};
    product.modelIds.forEach((modelId) => {
      acquisitionWeights[String(modelId)] = Math.pow(tuning.decay, modelAges[String(modelId)]);
    });
    const totalWeight = Object.values(acquisitionWeights).reduce((sum, weight) => sum + weight, 0);

    product.modelIds.forEach((modelId) => {
      const key = String(modelId);
      const performance = nextPerformance[key] ?? createDefaultModelPerformance();
      const modelPrice = product.modelPrices[key] ?? product.price;
      const modelRevenue =
        totalLinePrice > 0 ? product.revenue * (modelPrice / totalLinePrice) : product.revenue / Math.max(1, modelCount);
      const acquisitionShare = product.acquisition * (acquisitionWeights[key] / Math.max(0.0001, totalWeight));
      const churnDelta = (modelAges[key] - avgAge) * tuning.churnCoefficient;
      const modelChurn = clamp(product.churn + churnDelta, MODEL_CHURN_FLOOR, MODEL_CHURN_CEILING);
      const priorUserShare = totalStoredPriorUsers > 0 ? storedPriorUsers[key] / totalStoredPriorUsers : 1 / modelCount;
      const startingUsersForModel = rawStartingUsers * priorUserShare;
      const endingUsersForModel = (startingUsersForModel * (1 - modelChurn) + acquisitionShare) * monthlyUserMultiplier;

      performance.totalRevenue = Math.round(performance.totalRevenue + modelRevenue);
      performance.lastMonthRevenue = Math.round(performance.lastMonthRevenue + modelRevenue);
      performance.lastMonthAcquisition = Number((performance.lastMonthAcquisition + acquisitionShare).toFixed(1));
      performance.lastMonthUsers = Number((performance.lastMonthUsers + endingUsersForModel).toFixed(1));
      nextPerformance[key] = performance;

      churnWeightByModel[key] = (churnWeightByModel[key] ?? 0) + endingUsersForModel;
      churnTotalByModel[key] = (churnTotalByModel[key] ?? 0) + modelChurn * endingUsersForModel;
    });
  });

  Object.keys(nextPerformance).forEach((modelId) => {
    nextPerformance[modelId].lastMonthChurn =
      churnWeightByModel[modelId] && churnWeightByModel[modelId] > 0
        ? churnTotalByModel[modelId] / churnWeightByModel[modelId]
        : 0;
  });

  game.modelPerformance = nextPerformance;
}
