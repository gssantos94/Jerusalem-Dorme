import { GameStore } from "../game/store";

export const createGameLogger = (store: GameStore) => {
  return (message: string): void => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    store.gameState.logs.push(logEntry);

    // Keep only the latest entries to avoid memory bloat.
    if (store.gameState.logs.length > 100) {
      store.gameState.logs = store.gameState.logs.slice(-100);
    }

    console.log(logEntry);
  };
};
