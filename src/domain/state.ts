import { GameState } from "./types";

export const createInitialGameState = (): GameState => ({
  phase: "setup",
  players: [],
  timer: null,
  nightActions: [],
  logs: [],
  usedOneTimeAbilities: {},
  pedroLastProtectedId: null,
  jesusSacrificed: false,
  matiasTargetId: null,
  dayCount: 0,
  winnerMessage: null,
  timerStartedAt: null,
  nightTurnIndex: 0,
  nightTurns: [],
});
