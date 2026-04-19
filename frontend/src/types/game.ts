import { Socket } from "socket.io-client";

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

export interface GameContextType {
  gameState: GameState | null;
  socket: Socket | null;
  animations: Record<string, string>;
}

export interface RoleAbility {
  id: string;
  label: string;
  icon: string;
  actionType: string;
  oneTime?: boolean;
  requiresDead?: boolean;
  dayOnly?: boolean;
}

export type RoleAbilities = Record<string, RoleAbility[]>;
