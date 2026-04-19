export type GamePhase = "setup" | "day" | "night";
export type DeathReason = "eliminado" | "expulso";

export interface Player {
  id: string;
  name: string;
  roleId: string | null;
  isAlive: boolean;
  isRevealed: boolean;
  deathReason?: DeathReason | null;
}

export interface NightAction {
  sourceRoleId: string;
  targetId: string;
  actionType: string;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  timer: number | null;
  nightActions: NightAction[];
  logs: string[];
  usedOneTimeAbilities: Record<string, boolean>;
  pedroLastProtectedId: string | null;
  jesusSacrificed: boolean;
  matiasTargetId: string | null;
  dayCount: number;
  winnerMessage: string | null;
  timerStartedAt: number | null;
  nightTurnIndex: number;
  nightTurns: string[];
}

export interface AnimationEvent {
  targetId: string;
  type: "attack" | "protect" | "revive" | "expel";
}

export interface NightTurnResolution {
  animationEvents: AnimationEvent[];
  killedIds: string[];
  complete: boolean;
}
