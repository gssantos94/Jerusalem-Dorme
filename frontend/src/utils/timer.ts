export const calculateSyncedTimer = (
  timerStartedAt: number | null,
  currentTimer: number | null,
): number | null => {
  if (!timerStartedAt || currentTimer === null) return currentTimer;

  const timerDurationMs = 5 * 60 * 1000;
  const elapsed = Date.now() - timerStartedAt;
  const remaining = Math.max(0, timerDurationMs - elapsed);

  return Math.ceil(remaining / 1000);
};
