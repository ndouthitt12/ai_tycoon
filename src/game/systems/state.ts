import { Draft, produce, setAutoFreeze } from "immer";

import { GameState } from "../types";

export type GameRecipe = (draft: Draft<GameState>) => void;

// The simulation still follows a "clone then mutate" pattern in many places.
// Disable Immer's freezing so those working copies remain writable.
setAutoFreeze(false);

export function produceGame(game: GameState, recipe: GameRecipe): GameState {
  return produce(game, recipe);
}

export function copyGame(game: GameState): GameState {
  return typeof structuredClone === "function"
    ? structuredClone(game)
    : JSON.parse(JSON.stringify(game));
}
