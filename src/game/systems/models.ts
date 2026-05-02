import { GameState, ModelSizeId, ModelState, NotificationTone } from "../types";
import {
  MODEL_MAINTENANCE_BASE_COST,
  MODEL_MAINTENANCE_FRONTIER_MULTIPLIER,
  MODEL_MAINTENANCE_LARGE_MULTIPLIER,
  MODEL_MAINTENANCE_MEDIUM_MULTIPLIER,
  MODEL_MAINTENANCE_SMALL_MULTIPLIER,
} from "./balance";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function addNotification(game: GameState, text: string, tone: NotificationTone = "info") {
  game.notifications.unshift({ id: game.nextId++, text, tone });
  game.notifications = game.notifications.slice(0, 12);
}

export function getModelMaintenanceCost(sizeKey: ModelSizeId) {
  const sizeMultiplier =
    sizeKey === "frontier"
      ? MODEL_MAINTENANCE_FRONTIER_MULTIPLIER
      : sizeKey === "large"
        ? MODEL_MAINTENANCE_LARGE_MULTIPLIER
        : sizeKey === "medium"
          ? MODEL_MAINTENANCE_MEDIUM_MULTIPLIER
          : MODEL_MAINTENANCE_SMALL_MULTIPLIER;

  return Math.round(MODEL_MAINTENANCE_BASE_COST * sizeMultiplier);
}

export function initializeModelQualityFields(model: ModelState, companyTrust: number) {
  if (!("trueCapability" in model) || !Number.isFinite(model.trueCapability)) {
    model.trueCapability = model.capability;
  }
  if (!("demonstratedCapability" in model) || !Number.isFinite(model.demonstratedCapability)) {
    model.demonstratedCapability = model.capability;
  }
  if (!("marketTrust" in model) || !Number.isFinite(model.marketTrust)) {
    model.marketTrust = "trust" in model ? model.trust : companyTrust;
  }
  if (!("capabilityDrift" in model) || !Number.isFinite(model.capabilityDrift)) {
    model.capabilityDrift = 0;
  }
  if (model.postTrainingComplete === undefined || model.postTrainingComplete === null) {
    model.postTrainingComplete = true;
  }
  if (model.deprecated === undefined || model.deprecated === null) {
    model.deprecated = false;
  }
  if (model.deprecationStartWeek === undefined) {
    model.deprecationStartWeek = null;
  }
  if (model.retired === undefined || model.retired === null) {
    model.retired = false;
  }
  if (!Number.isFinite(model.maintenanceCostPerMonth)) {
    model.maintenanceCostPerMonth = getModelMaintenanceCost(model.sizeKey);
  }
  if (!Number.isFinite(model.pendingSafetyRisk)) {
    model.pendingSafetyRisk = 0;
  }
  model.capability = model.demonstratedCapability;
}

export function advanceModelCapabilityDrift(game: GameState) {
  game.models.forEach((model) => {
    initializeModelQualityFields(model, game.trust);

    const priorDemonstrated = model.demonstratedCapability;
    const gap = model.trueCapability - model.demonstratedCapability;
    model.demonstratedCapability = Math.round(model.demonstratedCapability + gap * 0.035);
    model.capabilityDrift = Number((model.demonstratedCapability - priorDemonstrated).toFixed(2));
    model.capability = model.demonstratedCapability;

    const targetTrust = clamp(model.demonstratedCapability * 0.6 + game.trust * 0.4, 10, 99);
    const trustGap = targetTrust - model.marketTrust;
    const trustRecoveryRate = trustGap > 0 ? 0.02 : 0.05;
    model.marketTrust = clamp(Math.round(model.marketTrust + trustGap * trustRecoveryRate), 10, 99);
  });
}

export function deprecateModel(game: GameState, modelId: number) {
  const model = game.models.find((entry) => entry.id === modelId);
  if (!model || model.deprecated || model.retired) return;

  initializeModelQualityFields(model, game.trust);
  const isDeployed = Object.values(game.products).some((product) => product.modelIds.includes(modelId));
  if (!isDeployed || model.postTrainingComplete === false) return;

  model.deprecated = true;
  model.deprecationStartWeek = game.week;

  addNotification(game, `${model.name} marked for deprecation. Users will migrate over 3 months.`, "warning");
}
