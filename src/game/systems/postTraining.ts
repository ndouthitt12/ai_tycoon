import { GameState, NotificationTone, PostTrainingConfig } from "../types";
import {
  POST_TRAINING_DOMAIN_GOAL_BOOST,
  POST_TRAINING_DOMAIN_WEEKS_BASE,
  POST_TRAINING_RED_TEAM_WEEKS_BASE,
  POST_TRAINING_RLHF_TRUST_BONUS,
  POST_TRAINING_RLHF_WEEKS_BASE,
  POST_TRAINING_SKIP_INCIDENT_RISK_PER_WEEK,
  POST_TRAINING_SKIP_TRUST_PENALTY,
} from "./balance";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function addNotification(game: GameState, text: string, tone: NotificationTone = "info") {
  game.notifications.unshift({ id: game.nextId++, text, tone });
  game.notifications = game.notifications.slice(0, 12);
}

export function getPostTrainingEstimate(config: PostTrainingConfig) {
  let weeksTotal = 0;
  if (config.rlhf) weeksTotal += POST_TRAINING_RLHF_WEEKS_BASE;
  if (config.domainFocus) weeksTotal += POST_TRAINING_DOMAIN_WEEKS_BASE;
  if (config.redTeam) weeksTotal += POST_TRAINING_RED_TEAM_WEEKS_BASE;
  weeksTotal = clamp(Math.max(1, config.weeksAllocated || weeksTotal), 1, 8);

  const trustDelta = config.rlhf ? POST_TRAINING_RLHF_TRUST_BONUS : POST_TRAINING_SKIP_TRUST_PENALTY;
  const goalBoost = config.domainFocus
    ? { goalId: config.domainFocus, delta: POST_TRAINING_DOMAIN_GOAL_BOOST }
    : null;
  const safetyRisk = config.redTeam ? 0 : weeksTotal * POST_TRAINING_SKIP_INCIDENT_RISK_PER_WEEK;

  return { weeksTotal, trustDelta, goalBoost, safetyRisk };
}

export function startPostTraining(
  game: GameState,
  modelId: number,
  config: PostTrainingConfig,
): void {
  game.postTrainingRuns ??= [];
  const model = game.models.find((entry) => entry.id === modelId);
  if (!model || game.postTrainingRuns.some((run) => run.modelId === modelId)) return;

  const estimate = getPostTrainingEstimate(config);
  model.postTrainingComplete = false;

  game.postTrainingRuns.push({
    id: game.nextId++,
    modelId,
    config: {
      rlhf: config.rlhf,
      domainFocus: config.domainFocus,
      redTeam: config.redTeam,
      weeksAllocated: estimate.weeksTotal,
    },
    weeksElapsed: 0,
    weeksTotal: estimate.weeksTotal,
    projectedTrustDelta: estimate.trustDelta,
    projectedGoalBoost: estimate.goalBoost,
    projectedSafetyIncidentRisk: estimate.safetyRisk,
  });

  addNotification(game, `${model.name} entered post-training for ${estimate.weeksTotal} week${estimate.weeksTotal === 1 ? "" : "s"}.`, "info");
}

export function advancePostTrainingRuns(game: GameState): void {
  game.postTrainingRuns ??= [];
  game.postTrainingRuns = game.postTrainingRuns.filter((run) => {
    run.weeksElapsed += 1;

    if (run.weeksElapsed < run.weeksTotal) return true;

    const model = game.models.find((entry) => entry.id === run.modelId);
    if (model) {
      model.trust = clamp(model.trust + run.projectedTrustDelta, 10, 99);
      model.marketTrust = clamp((model.marketTrust ?? model.trust) + run.projectedTrustDelta, 10, 99);

      if (run.projectedGoalBoost) {
        model.goals[run.projectedGoalBoost.goalId] = Math.min(
          100,
          model.goals[run.projectedGoalBoost.goalId] + run.projectedGoalBoost.delta,
        );
      }

      if (run.projectedSafetyIncidentRisk > 0) {
        game.pendingSafetyRisk = (game.pendingSafetyRisk ?? 0) + run.projectedSafetyIncidentRisk;
        model.pendingSafetyRisk = (model.pendingSafetyRisk ?? 0) + run.projectedSafetyIncidentRisk;
      }

      model.postTrainingComplete = true;
      addNotification(game, `${model.name} completed post-training and is ready to deploy.`, "good");
    }

    return false;
  });
}
