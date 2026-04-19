type EventWindowCounter = Record<string, number>;

type SocketEventCounts = Record<string, EventWindowCounter>;

export class SocketRateLimiter {
  private readonly socketEventCounts: SocketEventCounts = {};

  constructor(
    private readonly windowMs: number,
    private readonly maxEventsPerWindow: number,
  ) {}

  check(socketId: string, eventName: string): boolean {
    if (!this.socketEventCounts[socketId]) {
      this.socketEventCounts[socketId] = {};
    }

    const now = Date.now();
    const windowKey = `${eventName}:${Math.floor(now / this.windowMs)}`;

    if (!this.socketEventCounts[socketId][windowKey]) {
      this.socketEventCounts[socketId][windowKey] = 0;
    }

    this.socketEventCounts[socketId][windowKey] += 1;
    this.cleanupOldWindows(socketId, now);

    return (
      this.socketEventCounts[socketId][windowKey] <= this.maxEventsPerWindow
    );
  }

  private cleanupOldWindows(socketId: string, now: number): void {
    Object.keys(this.socketEventCounts[socketId]).forEach((key) => {
      const window = parseInt(key.split(":")[1], 10);
      if (now / this.windowMs - window > 2) {
        delete this.socketEventCounts[socketId][key];
      }
    });
  }
}
