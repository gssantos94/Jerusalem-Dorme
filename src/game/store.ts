import { createInitialGameState } from "../domain/state";
import { GameState } from "../domain/types";

export interface GameStore {
  gameState: GameState;
  timerInterval: NodeJS.Timeout | null;
}

export const createGameStore = (): GameStore => ({
  gameState: createInitialGameState(),
  timerInterval: null,
});
