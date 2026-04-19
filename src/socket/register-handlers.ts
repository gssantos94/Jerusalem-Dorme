import { Server } from "socket.io";
import { NIGHT_ACTION_ORDER, SOMBRA_ROLES } from "../domain/constants";
import { createInitialGameState } from "../domain/state";
import { GamePhase, NightAction, Player } from "../domain/types";
import {
  createGameEngine,
  isPlayerAlive,
  isValidPhaseTransition,
  isValidPlayerId,
} from "../game/engine";
import { GameStore } from "../game/store";
import { SocketRateLimiter } from "../utils/socket-rate-limiter";
import { shuffle } from "../utils/shuffle";
import {
  ExecuteActionSchema,
  NightActionSchema,
  PhaseSchema,
  SetMatiasTargetSchema,
  ToggleRevealSchema,
  UpdatePlayersSchema,
  UseOneTimeSchema,
} from "../validation/schemas";
import { validatePayload } from "../validation/validate";

interface RegisterSocketHandlersDeps {
  io: Server;
  store: GameStore;
  rateLimiter: SocketRateLimiter;
  logEvent: (message: string) => void;
}

const MIN_PLAYERS_TO_START = 6;

const CORE_LIGHT_ROLES = ["jesus", "pedro", "maria_madalena"];
const SUPPORT_LIGHT_ROLES = [
  "joao",
  "tome",
  "nicodemos",
  "zaqueu",
  "jose_de_arimateia",
  "o_publicano",
  "matias",
];
const CORE_SHADOW_ROLES = ["fariseu", "sumo_sacerdote", "rei_herodes"];
const SHADOW_FILLER_ROLE = "soldado_romano";
const SINGLE_NEUTRAL_ROLE = "judas";
const NEUTRAL_COUPLE_ROLES = ["ananias", "safira"];

const buildBalancedRoles = (playerCount: number): string[] => {
  const rolesToAssign: string[] = [];
  const shadowCorePool = shuffle([...CORE_SHADOW_ROLES]);
  const supportLightPool = shuffle([...SUPPORT_LIGHT_ROLES]);
  const shadowReservePool = [...shadowCorePool.slice(2), SHADOW_FILLER_ROLE];

  rolesToAssign.push(...CORE_LIGHT_ROLES);
  rolesToAssign.push(...shadowCorePool.slice(0, 2));
  rolesToAssign.push(SINGLE_NEUTRAL_ROLE);

  const counts = { luz: 3, sombra: 2, neutro: 1 };
  let remainingSlots = playerCount - rolesToAssign.length;

  // Couple only enters with more players and always together.
  if (playerCount >= 8 && remainingSlots >= 1) {
    const judasIndex = rolesToAssign.indexOf(SINGLE_NEUTRAL_ROLE);
    if (judasIndex >= 0) {
      rolesToAssign.splice(judasIndex, 1);
    }

    rolesToAssign.push(...NEUTRAL_COUPLE_ROLES);
    counts.neutro = 2;
    remainingSlots -= 1;
  }

  while (remainingSlots > 0) {
    const shouldAddShadow = counts.sombra < counts.luz;

    if (shouldAddShadow) {
      const nextShadowRole = shadowReservePool.shift() ?? SHADOW_FILLER_ROLE;
      rolesToAssign.push(nextShadowRole);
      counts.sombra += 1;
    } else {
      const nextLightRole = supportLightPool.shift();
      if (nextLightRole) {
        rolesToAssign.push(nextLightRole);
        counts.luz += 1;
      } else {
        rolesToAssign.push(SHADOW_FILLER_ROLE);
        counts.sombra += 1;
      }
    }

    remainingSlots -= 1;
  }

  return shuffle(rolesToAssign);
};

export const registerSocketHandlers = ({
  io,
  store,
  rateLimiter,
  logEvent,
}: RegisterSocketHandlersDeps): void => {
  const stopTimer = () => {
    if (store.timerInterval) {
      clearInterval(store.timerInterval);
      store.timerInterval = null;
    }
  };

  const startDayTimer = () => {
    stopTimer();
    store.gameState.timer = 5 * 60;
    store.gameState.timerStartedAt = Date.now();

    store.timerInterval = setInterval(() => {
      if (store.gameState.timer !== null && store.gameState.timer > 0) {
        store.gameState.timer -= 1;
        io.emit("game_state_update", store.gameState);
      } else {
        stopTimer();
        store.gameState.timerStartedAt = null;
      }
    }, 1000);
  };

  const emitState = () => {
    io.emit("game_state_update", store.gameState);
  };

  const validateRateLimit = (socketId: string, eventName: string): boolean => {
    if (!rateLimiter.check(socketId, eventName)) {
      console.warn(
        `[RATE LIMIT] Socket ${socketId} exceeded ${eventName} limit`,
      );
      return false;
    }
    return true;
  };

  const shouldBlockAfterWinner = (eventName: string): boolean => {
    if (!store.gameState.winnerMessage) {
      return false;
    }

    console.warn(
      `[GAME LOCKED] Ignoring ${eventName}: game already has a winner`,
    );
    return true;
  };

  const gameEngine = createGameEngine({
    store,
    logEvent,
    stopTimer,
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.emit("game_state_update", store.gameState);

    socket.on("request_state", () => {
      socket.emit("game_state_update", store.gameState);
    });

    socket.on("update_players", (newPlayers: Player[]) => {
      if (!validateRateLimit(socket.id, "update_players")) return;
      if (shouldBlockAfterWinner("update_players")) return;

      const validated = validatePayload(newPlayers, UpdatePlayersSchema);
      if (!validated) {
        console.warn("Invalid newPlayers payload");
        return;
      }

      if (store.gameState.phase !== "setup") {
        console.warn("Cannot update players outside setup phase");
        return;
      }

      store.gameState.players = validated;
      logEvent(
        `Players updated: ${validated.map((player) => player.name).join(", ")}`,
      );
      emitState();
    });

    socket.on("distribute_roles", () => {
      if (!validateRateLimit(socket.id, "distribute_roles")) return;
      if (shouldBlockAfterWinner("distribute_roles")) return;

      if (store.gameState.phase !== "setup") {
        console.warn("Cannot distribute roles outside setup phase");
        return;
      }

      if (store.gameState.players.length < MIN_PLAYERS_TO_START) {
        console.warn(
          `Cannot distribute roles: minimum is ${MIN_PLAYERS_TO_START} players`,
        );
        return;
      }

      const finalRoles = buildBalancedRoles(store.gameState.players.length);
      store.gameState.players = store.gameState.players.map(
        (player, index) => ({
          ...player,
          roleId: finalRoles[index],
        }),
      );

      const rolesSummary = store.gameState.players
        .map((player) => `${player.name}=${player.roleId}`)
        .join(", ");
      logEvent(`Roles distributed: ${rolesSummary}`);
      emitState();
    });

    socket.on("start_game", () => {
      if (!validateRateLimit(socket.id, "start_game")) return;
      if (shouldBlockAfterWinner("start_game")) return;

      if (store.gameState.phase !== "setup") {
        console.warn("Cannot start game from phase:", store.gameState.phase);
        return;
      }

      if (store.gameState.players.length < MIN_PLAYERS_TO_START) {
        console.warn(
          `Cannot start game: minimum is ${MIN_PLAYERS_TO_START} players`,
        );
        return;
      }

      if (store.gameState.players.some((player) => !player.roleId)) {
        console.warn("Cannot start game: not all players have roles assigned");
        return;
      }

      stopTimer();

      store.gameState.phase = "night";
      store.gameState.timer = null;
      store.gameState.timerStartedAt = null;
      store.gameState.nightActions = [];
      store.gameState.usedOneTimeAbilities = {};
      store.gameState.pedroLastProtectedId = null;
      store.gameState.jesusSacrificed = false;
      store.gameState.matiasTargetId = null;
      store.gameState.dayCount = 0;
      store.gameState.nightTurnIndex = 0;
      store.gameState.nightTurns = [];
      store.gameState.winnerMessage = null;

      logEvent(`Game started with ${store.gameState.players.length} players`);
      emitState();
    });

    socket.on("change_phase", (newPhase: GamePhase) => {
      if (!validateRateLimit(socket.id, "change_phase")) return;
      if (shouldBlockAfterWinner("change_phase")) return;

      const validated = validatePayload(newPhase, PhaseSchema);
      if (!validated) {
        console.warn("Invalid phase payload");
        return;
      }

      if (!isValidPhaseTransition(store.gameState.phase, validated)) {
        console.warn(
          `Invalid transition from ${store.gameState.phase} to ${validated}`,
        );
        return;
      }

      if (validated === "day" && store.gameState.phase === "night") {
        store.gameState.dayCount += 1;
        store.gameState.nightTurnIndex = 0;
        store.gameState.nightTurns = [...NIGHT_ACTION_ORDER];

        const allAnimationEvents: Array<{ targetId: string; type: string }> =
          [];
        while (true) {
          const { animationEvents, complete } =
            gameEngine.executeNextNightAction();
          if (animationEvents.length > 0) {
            allAnimationEvents.push(...animationEvents);
          }
          if (complete) break;
        }

        if (allAnimationEvents.length > 0) {
          io.emit("play_animations", allAnimationEvents);
        }

        // Night choices are only valid for one resolution cycle.
        store.gameState.nightActions = [];

        gameEngine.checkWinCondition();
        if (!store.gameState.winnerMessage) {
          startDayTimer();
        }
      } else if (validated === "night" && store.gameState.phase === "day") {
        stopTimer();
        store.gameState.timer = null;
        store.gameState.timerStartedAt = null;
        store.gameState.nightTurnIndex = 0;
        store.gameState.nightTurns = [];
        store.gameState.nightActions = [];
      }

      store.gameState.phase = validated;
      logEvent(
        `Phase changed to ${validated} (Day ${store.gameState.dayCount})`,
      );
      gameEngine.checkWinCondition();
      emitState();
    });

    socket.on("queue_night_action", (actionData: NightAction) => {
      if (!validateRateLimit(socket.id, "queue_night_action")) return;
      if (shouldBlockAfterWinner("queue_night_action")) return;

      const validated = validatePayload(actionData, NightActionSchema);
      if (!validated) {
        console.warn("Invalid night action payload");
        return;
      }

      if (store.gameState.phase !== "night") {
        console.warn("queue_night_action called outside night phase");
        return;
      }

      const source = store.gameState.players.find(
        (player) => player.roleId === validated.sourceRoleId && player.isAlive,
      );
      if (!source) {
        console.warn(
          "Invalid source for night action:",
          validated.sourceRoleId,
        );
        return;
      }

      if (!isValidPlayerId(validated.targetId, store.gameState)) {
        console.warn("Invalid target player ID:", validated.targetId);
        return;
      }

      const target = store.gameState.players.find(
        (player) => player.id === validated.targetId,
      );
      if (!target) {
        console.warn("Target player not found:", validated.targetId);
        return;
      }

      if (
        validated.actionType === "sombra_ataca" &&
        target.roleId &&
        SOMBRA_ROLES.includes(target.roleId)
      ) {
        console.warn("Shadow action cannot target a shadow player");
        return;
      }

      if (
        validated.actionType === "simao_elimina" &&
        target.roleId === "simao_zelote"
      ) {
        console.warn("Simao cannot target himself");
        return;
      }

      if (
        validated.actionType === "pedro_protege" &&
        store.gameState.pedroLastProtectedId === validated.targetId
      ) {
        console.warn(
          "Pedro cannot protect the same player in consecutive nights",
        );
        return;
      }

      store.gameState.nightActions = store.gameState.nightActions.filter(
        (action) => action.sourceRoleId !== validated.sourceRoleId,
      );
      store.gameState.nightActions.push(validated);

      logEvent(
        `Night action queued: ${validated.sourceRoleId} -> ${validated.targetId} (${validated.actionType})`,
      );
      emitState();
    });

    socket.on("use_one_time", (abilityId: string) => {
      if (!validateRateLimit(socket.id, "use_one_time")) return;
      if (shouldBlockAfterWinner("use_one_time")) return;

      const validated = validatePayload(abilityId, UseOneTimeSchema);
      if (!validated) {
        console.warn("Invalid ability ID payload");
        return;
      }

      if (store.gameState.usedOneTimeAbilities[validated]) {
        console.warn("Ability already used:", validated);
        return;
      }

      store.gameState.usedOneTimeAbilities[validated] = true;
      logEvent(`One-time ability used: ${validated}`);
      emitState();
    });

    socket.on("set_matias_target", (targetId: string) => {
      if (!validateRateLimit(socket.id, "set_matias_target")) return;
      if (shouldBlockAfterWinner("set_matias_target")) return;

      const validated = validatePayload(targetId, SetMatiasTargetSchema);
      if (!validated) {
        console.warn("Invalid Matias target payload");
        return;
      }

      if (!isValidPlayerId(validated, store.gameState)) {
        console.warn("Invalid Matias target:", validated);
        return;
      }

      if (!isPlayerAlive(validated, store.gameState)) {
        console.warn("Matias target is not alive:", validated);
        return;
      }

      store.gameState.matiasTargetId = validated;
      const targetPlayer = store.gameState.players.find(
        (player) => player.id === validated,
      );
      logEvent(`Matias target set to ${targetPlayer?.name || validated}`);
      emitState();
    });

    socket.on("toggle_reveal", (targetId: string) => {
      if (!validateRateLimit(socket.id, "toggle_reveal")) return;
      if (shouldBlockAfterWinner("toggle_reveal")) return;

      const validated = validatePayload(targetId, ToggleRevealSchema);
      if (!validated) {
        console.warn("Invalid toggle_reveal target payload");
        return;
      }

      if (!isValidPlayerId(validated, store.gameState)) {
        console.warn("Invalid toggle_reveal target:", validated);
        return;
      }

      const target = store.gameState.players.find(
        (player) => player.id === validated,
      );
      if (!target) return;

      target.isRevealed = !target.isRevealed;
      logEvent(`${target.name} reveal status toggled: ${target.isRevealed}`);
      emitState();
    });

    socket.on("execute_action", (actionData: unknown) => {
      if (!validateRateLimit(socket.id, "execute_action")) return;
      if (shouldBlockAfterWinner("execute_action")) return;

      const validated = validatePayload(actionData, ExecuteActionSchema);
      if (!validated) {
        console.warn("Invalid execute_action payload");
        return;
      }

      if (!isValidPlayerId(validated.targetId, store.gameState)) {
        console.warn("Invalid execute_action target:", validated.targetId);
        return;
      }

      const target = store.gameState.players.find(
        (player) => player.id === validated.targetId,
      );
      if (!target) {
        console.warn("Target not found:", validated.targetId);
        return;
      }

      if (validated.type === "kill") {
        if (!target.isAlive) {
          console.warn("Cannot kill already dead player:", validated.targetId);
          return;
        }
        gameEngine.killPlayer(validated.targetId, "eliminado", []);
        io.emit("play_animations", [
          { targetId: validated.targetId, type: "attack" },
        ]);
      } else if (validated.type === "expel") {
        if (!target.isAlive) {
          console.warn("Cannot expel already dead player:", validated.targetId);
          return;
        }
        gameEngine.killPlayer(validated.targetId, "expulso", []);
        io.emit("play_animations", [
          { targetId: validated.targetId, type: "expel" },
        ]);
      } else if (validated.type === "revive") {
        if (target.isAlive) {
          console.warn(
            "Cannot revive already alive player:",
            validated.targetId,
          );
          return;
        }
        target.isAlive = true;
        target.deathReason = null;
        io.emit("play_animations", [
          { targetId: validated.targetId, type: "revive" },
        ]);
      } else {
        console.warn("Unknown action type:", validated.type);
        return;
      }

      gameEngine.checkWinCondition();
      emitState();
    });

    socket.on("reset_game", () => {
      if (!validateRateLimit(socket.id, "reset_game")) return;

      stopTimer();
      store.gameState = createInitialGameState();
      emitState();
    });

    socket.on("next_night_turn", () => {
      if (shouldBlockAfterWinner("next_night_turn")) return;

      if (store.gameState.phase !== "night") {
        console.warn("next_night_turn called outside night phase");
        return;
      }

      const { animationEvents, complete } = gameEngine.executeNextNightAction();

      if (animationEvents.length > 0) {
        io.emit("play_animations", animationEvents);
      }

      if (complete) {
        logEvent("Night phase actions completed, transitioning to day");
        store.gameState.nightTurnIndex = 0;
        store.gameState.nightTurns = [];
        store.gameState.nightActions = [];
      }

      emitState();
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};
