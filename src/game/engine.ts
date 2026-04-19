import {
  LUZ_ROLES,
  NIGHT_ACTION_ORDER,
  SOMBRA_ROLES,
} from "../domain/constants";
import {
  DeathReason,
  GamePhase,
  GameState,
  NightTurnResolution,
} from "../domain/types";
import { GameStore } from "./store";

interface GameEngineDeps {
  store: GameStore;
  logEvent: (message: string) => void;
  stopTimer: () => void;
}

export const isValidPlayerId = (
  playerId: string,
  gameState: GameState,
): boolean => {
  return (
    typeof playerId === "string" &&
    gameState.players.some((player) => player.id === playerId)
  );
};

export const isPlayerAlive = (
  playerId: string,
  gameState: GameState,
): boolean => {
  return (
    gameState.players.find((player) => player.id === playerId)?.isAlive ?? false
  );
};

export const isValidPhaseTransition = (
  currentPhase: GamePhase,
  newPhase: GamePhase,
): boolean => {
  const transitions: Record<GamePhase, GamePhase[]> = {
    setup: ["day"],
    day: ["night", "setup"],
    night: ["day", "setup"],
  };

  return transitions[currentPhase].includes(newPhase);
};

export const createGameEngine = ({
  store,
  logEvent,
  stopTimer,
}: GameEngineDeps) => {
  const killPlayer = (
    targetId: string,
    reason: DeathReason,
    killedIds: string[],
  ): void => {
    const target = store.gameState.players.find(
      (player) => player.id === targetId,
    );
    if (!target || !target.isAlive) return;

    target.isAlive = false;
    target.deathReason = reason;
    killedIds.push(targetId);

    const roleLabel = target.roleId ? ` (${target.roleId})` : "";
    logEvent(
      `Player ${target.name}${roleLabel} was ${reason === "eliminado" ? "killed" : "expelled"}`,
    );

    const currentRole = target.roleId;

    if (currentRole === "ananias") {
      const safira = store.gameState.players.find(
        (player) => player.roleId === "safira" && player.isAlive,
      );
      if (safira) {
        safira.isAlive = false;
        safira.deathReason = reason;
        killedIds.push(safira.id);
        logEvent("Safira (couple) also died with Ananias");
      }
    } else if (currentRole === "safira") {
      const ananias = store.gameState.players.find(
        (player) => player.roleId === "ananias" && player.isAlive,
      );
      if (ananias) {
        ananias.isAlive = false;
        ananias.deathReason = reason;
        killedIds.push(ananias.id);
        logEvent("Ananias (couple) also died with Safira");
      }
    }

    if (currentRole === "jesus" && reason === "eliminado") {
      store.gameState.jesusSacrificed = true;
    }

    if (store.gameState.matiasTargetId === targetId) {
      const matias = store.gameState.players.find(
        (player) => player.roleId === "matias" && player.isAlive,
      );
      if (matias) {
        matias.roleId = currentRole;
        store.gameState.matiasTargetId = null;
      }
    }
  };

  const executeNextNightAction = (): NightTurnResolution => {
    const actions = store.gameState.nightActions;
    const animationEvents: NightTurnResolution["animationEvents"] = [];
    const killedIds: string[] = [];

    const remainingRoleIds = NIGHT_ACTION_ORDER.slice(
      store.gameState.nightTurnIndex,
    );
    if (remainingRoleIds.length === 0) {
      return { animationEvents, killedIds, complete: true };
    }

    const currentRoleId = remainingRoleIds[0];
    store.gameState.nightTurnIndex += 1;

    const roleActions =
      currentRoleId === "sombra_ataca"
        ? actions.filter((action) => action.actionType === "sombra_ataca")
        : actions.filter((action) => action.sourceRoleId === currentRoleId);

    if (currentRoleId === "simao_zelote") {
      const simaoKill = roleActions[0]?.targetId;
      if (simaoKill) {
        const target = store.gameState.players.find(
          (player) => player.id === simaoKill,
        );
        const simao = store.gameState.players.find(
          (player) => player.roleId === "simao_zelote",
        );

        if (target && target.isAlive) {
          animationEvents.push({ targetId: target.id, type: "attack" });
          killPlayer(target.id, "eliminado", killedIds);
          logEvent(`Simao eliminates ${target.name}`);

          if (target.roleId && LUZ_ROLES.includes(target.roleId)) {
            if (simao && simao.isAlive) {
              animationEvents.push({ targetId: simao.id, type: "attack" });
              killPlayer(simao.id, "eliminado", killedIds);
              logEvent(`Simao dies due to killing light (${target.name})`);
            }
          }
        }
      }
    } else if (currentRoleId === "sombra_ataca") {
      const attackedByShadows = roleActions.map((action) => action.targetId);
      const protectedByPedro = actions.find(
        (action) => action.actionType === "pedro_protege",
      )?.targetId;
      const caredByMaria = actions.find(
        (action) => action.actionType === "maria_cuida",
      )?.targetId;

      for (const targetId of attackedByShadows) {
        const target = store.gameState.players.find(
          (player) => player.id === targetId,
        );
        if (!target || !target.isAlive) continue;

        if (caredByMaria === targetId) {
          animationEvents.push({ targetId, type: "protect" });
          logEvent(`Maria protects ${target.name} from shadow attack`);
        } else if (protectedByPedro === targetId) {
          animationEvents.push({ targetId, type: "protect" });
          logEvent(
            `Pedro protects ${target.name}, shadow takes random soldier`,
          );

          const soldados = store.gameState.players.filter(
            (player) => player.roleId === "soldado_romano" && player.isAlive,
          );

          if (soldados.length > 0) {
            const unluckySoldier =
              soldados[Math.floor(Math.random() * soldados.length)];
            animationEvents.push({
              targetId: unluckySoldier.id,
              type: "attack",
            });
            killPlayer(unluckySoldier.id, "eliminado", killedIds);
            logEvent(`Random soldier ${unluckySoldier.name} killed`);
          }
        } else {
          animationEvents.push({ targetId, type: "attack" });
          killPlayer(targetId, "eliminado", killedIds);
          logEvent(`${target.name} killed by shadows`);
        }
      }
    } else if (currentRoleId === "maria_madalena") {
      logEvent("Maria's action processed during shadow defense");
    } else if (currentRoleId === "pedro") {
      const protectedByPedro = roleActions[0]?.targetId;
      if (protectedByPedro) {
        store.gameState.pedroLastProtectedId = protectedByPedro;
        const target = store.gameState.players.find(
          (player) => player.id === protectedByPedro,
        );
        logEvent(`Pedro protects ${target?.name}`);
      }
    } else if (currentRoleId === "jesus") {
      const jesusRevive = roleActions[0]?.targetId;
      if (jesusRevive) {
        const target = store.gameState.players.find(
          (player) => player.id === jesusRevive,
        );
        if (target && !target.isAlive) {
          target.isAlive = true;
          target.deathReason = null;
          animationEvents.push({ targetId: target.id, type: "revive" });
          logEvent(`Jesus revives ${target.name}`);
        }
      }
    }

    return {
      animationEvents,
      killedIds,
      complete: store.gameState.nightTurnIndex >= NIGHT_ACTION_ORDER.length,
    };
  };

  const checkWinCondition = (): void => {
    const { gameState } = store;

    if (
      gameState.phase === "setup" ||
      gameState.players.length === 0 ||
      gameState.winnerMessage
    ) {
      return;
    }

    const alivePlayers = gameState.players.filter((player) => player.isAlive);
    if (alivePlayers.length === 0) return;

    let luzCount = 0;
    let sombraCount = 0;
    let judasCount = 0;
    let casalCount = 0;
    let otherNeutrosCount = 0;

    for (const player of alivePlayers) {
      if (LUZ_ROLES.includes(player.roleId || "")) luzCount += 1;
      else if (SOMBRA_ROLES.includes(player.roleId || "")) sombraCount += 1;
      else if (player.roleId === "judas") judasCount += 1;
      else if (player.roleId === "ananias" || player.roleId === "safira")
        casalCount += 1;
      else otherNeutrosCount += 1;
    }

    const isNight = gameState.phase === "night";
    let winnerMsg: string | null = null;

    if (
      sombraCount === 0 &&
      judasCount === 0 &&
      casalCount === 0 &&
      otherNeutrosCount === 0 &&
      luzCount > 0
    ) {
      winnerMsg = "A EQUIPE LUZ VENCEU! Todas as ameacas foram eliminadas.";
    } else if (
      luzCount === 0 &&
      judasCount === 0 &&
      casalCount === 0 &&
      otherNeutrosCount === 0 &&
      sombraCount > 0
    ) {
      winnerMsg = "A EQUIPE DAS SOMBRAS VENCEU! A luz se apagou.";
    } else if (alivePlayers.length === 2) {
      if (luzCount === 1 && judasCount === 1) {
        winnerMsg = "JUDAS VENCEU! Ele sobreviveu ate o fim com a luz.";
      } else if (sombraCount === 1 && judasCount === 1) {
        if (isNight) {
          winnerMsg =
            "A EQUIPE DAS SOMBRAS VENCEU! A sombra eliminou Judas na ultima noite.";
        } else {
          winnerMsg =
            "JUDAS VENCEU! Durante o dia, Judas manipulou a vila e venceu a sombra.";
        }
      }
    } else if (alivePlayers.length === 3) {
      if (luzCount === 1 && casalCount === 2) {
        winnerMsg = "ANANIAS E SAFIRA VENCERAM! Eles sobreviveram ate o fim.";
      } else if (sombraCount === 1 && casalCount === 2) {
        if (isNight) {
          winnerMsg =
            "A EQUIPE DAS SOMBRAS VENCEU! A sombra eliminou o casal na ultima noite.";
        } else {
          winnerMsg =
            "ANANIAS E SAFIRA VENCERAM! Eles expulsaram a sombra no ultimo dia.";
        }
      }
    }

    if (winnerMsg) {
      gameState.winnerMessage = winnerMsg;
      logEvent(`GAME END: ${winnerMsg}`);
      stopTimer();
    }
  };

  return {
    killPlayer,
    executeNextNightAction,
    checkWinCondition,
  };
};
