import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { z } from "zod";

dotenv.config();

const app = express();

// CORS configuration from environment
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
];

// Rate limiting middleware for HTTP requests
const httpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(httpLimiter);

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }),
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

export interface Player {
  id: string;
  name: string;
  roleId: string | null;
  isAlive: boolean;
  isRevealed: boolean;
  deathReason?: "eliminado" | "expulso" | null;
}

export interface NightAction {
  sourceRoleId: string;
  targetId: string;
  actionType: string;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Validation helpers
const isValidPlayerId = (playerId: string, gameState: GameState): boolean => {
  return typeof playerId === "string" && 
    gameState.players.some(p => p.id === playerId);
};

const isPlayerAlive = (playerId: string, gameState: GameState): boolean => {
  return gameState.players.find(p => p.id === playerId)?.isAlive ?? false;
};

const isValidPhase = (phase: string): phase is "setup" | "day" | "night" => {
  return ["setup", "day", "night"].includes(phase);
};

const isValidPhaseTransition = (currentPhase: string, newPhase: string): boolean => {
  const transitions: Record<string, string[]> = {
    setup: ["day"],
    day: ["night", "setup"],
    night: ["day", "setup"],
  };
  return (transitions[currentPhase] || []).includes(newPhase);
};

// Socket.IO rate limiting: track event frequency per socket
const socketEventCounts: Record<string, Record<string, number>> = {};
const SOCKET_RATE_LIMIT_WINDOW = 1000; // 1 second
const SOCKET_RATE_LIMIT_MAX = 10; // Max 10 events per second per socket

const checkSocketRateLimit = (socketId: string, eventName: string): boolean => {
  if (!socketEventCounts[socketId]) {
    socketEventCounts[socketId] = {};
  }
  
  const now = Date.now();
  const key = `${eventName}:${Math.floor(now / SOCKET_RATE_LIMIT_WINDOW)}`;
  
  if (!socketEventCounts[socketId][key]) {
    socketEventCounts[socketId][key] = 0;
  }
  
  socketEventCounts[socketId][key]++;
  
  // Cleanup old windows (older than 2 seconds)
  Object.keys(socketEventCounts[socketId]).forEach((k) => {
    const window = parseInt(k.split(":")[1]);
    if (now / SOCKET_RATE_LIMIT_WINDOW - window > 2) {
      delete socketEventCounts[socketId][k];
    }
  });
  
  return socketEventCounts[socketId][key] <= SOCKET_RATE_LIMIT_MAX;
};

// Zod schemas for Socket.IO event validation
const PhaseSchema = z.enum(["setup", "day", "night"]);
const DeathReasonSchema = z.enum(["eliminado", "expulso"]).nullable();

const PlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  roleId: z.string().nullable(),
  isAlive: z.boolean(),
  isRevealed: z.boolean(),
  deathReason: DeathReasonSchema.optional(),
});

const NightActionSchema = z.object({
  sourceRoleId: z.string().min(1),
  targetId: z.string().min(1),
  actionType: z.string().min(1),
});

const GameStateSchema = z.object({
  phase: PhaseSchema,
  players: z.array(PlayerSchema),
  timer: z.number().nullable(),
  nightActions: z.array(NightActionSchema),
  logs: z.array(z.string()),
  usedOneTimeAbilities: z.record(z.string(), z.boolean()),
  pedroLastProtectedId: z.string().nullable(),
  jesusSacrificed: z.boolean(),
  matiasTargetId: z.string().nullable(),
  dayCount: z.number().nonnegative().int(),
  winnerMessage: z.string().nullable(),
});

// Event payload schemas
const UpdatePlayersSchema = z.array(PlayerSchema);
const DistributeRolesSchema = z.object({});
const StartGameSchema = z.object({});
const ChangePhasSchema = PhaseSchema;
const QueueNightActionSchema = NightActionSchema;
const ExecuteActionSchema = z.object({
  type: z.string().min(1),
  targetId: z.string().min(1),
});
const UseOneTimeSchema = z.string().min(1);
const SetMatiasTargetSchema = z.string().min(1);
const ToggleRevealSchema = z.string().min(1);
const ResetGameSchema = z.object({});

export interface GameState {
  phase: "setup" | "day" | "night";
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
}

let gameState: GameState = {
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
};

let timerInterval: NodeJS.Timeout | null = null;

// Helper function for logging game events
const logEvent = (message: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  gameState.logs.push(logEntry);
  // Keep only last 100 logs to prevent memory bloat
  if (gameState.logs.length > 100) {
    gameState.logs = gameState.logs.slice(-100);
  }
  console.log(logEntry);
};

// Helper function for validating with zod schemas
const validatePayload = <T>(data: unknown, schema: z.ZodSchema<T>): T | null => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn(`Validation error: ${error.message}`);
      return null;
    }
    throw error;
  }
};

function checkWinCondition() {
  if (
    gameState.phase === "setup" ||
    gameState.players.length === 0 ||
    gameState.winnerMessage
  )
    return;

  const alivePlayers = gameState.players.filter((p) => p.isAlive);
  if (alivePlayers.length === 0) return;

  const luzRoles = [
    "jesus",
    "pedro",
    "maria_madalena",
    "joao",
    "tome",
    "nicodemos",
    "zaqueu",
    "jose_de_arimateia",
    "o_publicano",
  ];
  const sombraRoles = [
    "rei_herodes",
    "soldado_romano",
    "fariseu",
    "sumo_sacerdote",
  ];

  let luzCount = 0;
  let sombraCount = 0;
  let judasCount = 0;
  let casalCount = 0;
  let otherNeutrosCount = 0;

  for (const p of alivePlayers) {
    if (luzRoles.includes(p.roleId || "")) luzCount++;
    else if (sombraRoles.includes(p.roleId || "")) sombraCount++;
    else if (p.roleId === "judas") judasCount++;
    else if (p.roleId === "ananias" || p.roleId === "safira") casalCount++;
    else otherNeutrosCount++;
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
    winnerMsg = "🕊️ A EQUIPE LUZ VENCEU! Todas as ameaças foram eliminadas.";
  } else if (
    luzCount === 0 &&
    judasCount === 0 &&
    casalCount === 0 &&
    otherNeutrosCount === 0 &&
    sombraCount > 0
  ) {
    winnerMsg = "🌑 A EQUIPE DAS SOMBRAS VENCEU! A luz se apagou.";
  } else if (alivePlayers.length === 2) {
    if (luzCount === 1 && judasCount === 1) {
      winnerMsg = "⛓️ JUDAS VENCEU! Ele sobreviveu até o fim com a luz.";
    } else if (sombraCount === 1 && judasCount === 1) {
      if (isNight) {
        winnerMsg =
          "🌑 A EQUIPE DAS SOMBRAS VENCEU! A sombra eliminou Judas na última noite.";
      } else {
        winnerMsg =
          "⛓️ JUDAS VENCEU! Durante o dia, Judas manipulou a vila e venceu a sombra.";
      }
    }
  } else if (alivePlayers.length === 3) {
    if (luzCount === 1 && casalCount === 2) {
      winnerMsg = "👩‍❤️‍👨 ANANIAS E SAFIRA VENCERAM! Eles sobreviveram até o fim.";
    } else if (sombraCount === 1 && casalCount === 2) {
      if (isNight) {
        winnerMsg =
          "🌑 A EQUIPE DAS SOMBRAS VENCEU! A sombra eliminou o casal na última noite.";
      } else {
        winnerMsg =
          "👩‍❤️‍👨 ANANIAS E SAFIRA VENCERAM! Eles expulsaram a sombra no último dia.";
      }
    }
  }

  if (winnerMsg) {
    gameState.winnerMessage = winnerMsg;
    logEvent(`🏆 GAME END: ${winnerMsg}`);
    // Stop timer when game ends
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }
}

function killPlayer(
  targetId: string,
  reason: "eliminado" | "expulso",
  killedIds: string[],
) {
  const target = gameState.players.find((p) => p.id === targetId);
  if (!target || !target.isAlive) return;

  target.isAlive = false;
  target.deathReason = reason;
  killedIds.push(targetId);

  const roleLabel = target.roleId ? ` (${target.roleId})` : "";
  logEvent(`Player ${target.name}${roleLabel} was ${reason === "eliminado" ? "killed" : "expelled"}`);

  let currentRole = target.roleId;

  if (currentRole === "ananias") {
    const safira = gameState.players.find(
      (p) => p.roleId === "safira" && p.isAlive,
    );
    if (safira) {
      safira.isAlive = false;
      safira.deathReason = reason;
      killedIds.push(safira.id);
      logEvent(`Safira (couple) also died with Ananias`);
    }
  } else if (currentRole === "safira") {
    const ananias = gameState.players.find(
      (p) => p.roleId === "ananias" && p.isAlive,
    );
    if (ananias) {
      ananias.isAlive = false;
      ananias.deathReason = reason;
      killedIds.push(ananias.id);
      logEvent(`Ananias (couple) also died with Safira`);
    }
  }

  if (currentRole === "jesus" && reason === "eliminado") {
    gameState.jesusSacrificed = true;
  }

  if (gameState.matiasTargetId === targetId) {
    const matias = gameState.players.find(
      (p) => p.roleId === "matias" && p.isAlive,
    );
    if (matias) {
      matias.roleId = currentRole;
      gameState.matiasTargetId = null;
    }
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.emit("game_state_update", gameState);

  socket.on("update_players", (newPlayers: Player[]) => {
    if (!checkSocketRateLimit(socket.id, "update_players")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded update_players limit`);
      return;
    }

    // Validate with zod schema
    const validated = validatePayload(newPlayers, UpdatePlayersSchema);
    if (!validated) {
      console.warn("Invalid newPlayers payload");
      return;
    }

    // Only allow updates during setup phase
    if (gameState.phase !== "setup") {
      console.warn("Cannot update players outside setup phase");
      return;
    }

    gameState.players = validated;
    logEvent(`Players updated: ${validated.map(p => p.name).join(", ")}`);
    io.emit("game_state_update", gameState);
  });

  socket.on("distribute_roles", () => {
    if (!checkSocketRateLimit(socket.id, "distribute_roles")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded distribute_roles limit`);
      return;
    }

    // Only allow during setup phase
    if (gameState.phase !== "setup") {
      console.warn("Cannot distribute roles outside setup phase");
      return;
    }

    // Must have at least 1 player
    if (gameState.players.length === 0) {
      console.warn("Cannot distribute roles: no players");
      return;
    }

    const uniqueRoles = [
      "jesus",
      "maria_madalena",
      "pedro",
      "judas",
      "fariseu",
      "joao",
      "jose_de_arimateia",
      "matias",
      "nicodemos",
      "o_publicano",
      "rei_herodes",
      "simao_zelote",
      "sumo_sacerdote",
      "tome",
      "zaqueu",
    ];
    const rolesToAssign: string[] = [];

    // Always include Ananias and Safira if 7+ players (deterministic)
    if (gameState.players.length >= 7) {
      rolesToAssign.push("ananias", "safira");
    }

    // Shuffle unique roles using Fisher-Yates algorithm
    const shuffledUnique = shuffle([...uniqueRoles]);

    while (rolesToAssign.length < gameState.players.length) {
      if (shuffledUnique.length > 0) {
        rolesToAssign.push(shuffledUnique.pop()!);
      } else {
        rolesToAssign.push("soldado_romano");
      }
    }
    
    // Final shuffle to randomize positions
    const finalRoles = shuffle(rolesToAssign);

    const playersWithRoles = gameState.players.map((p, idx) => ({
      ...p,
      roleId: finalRoles[idx],
    }));
    gameState.players = playersWithRoles;
    const rolesSummary = gameState.players.map(p => `${p.name}=${p.roleId}`).join(", ");
    logEvent(`Roles distributed: ${rolesSummary}`);
    io.emit("game_state_update", gameState);
  });

  socket.on("start_game", () => {
    if (!checkSocketRateLimit(socket.id, "start_game")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded start_game limit`);
      return;
    }

    // Only allow from setup phase
    if (gameState.phase !== "setup") {
      console.warn("Cannot start game from phase:", gameState.phase);
      return;
    }

    // Must have at least 1 player
    if (gameState.players.length === 0) {
      console.warn("Cannot start game: no players");
      return;
    }

    // All players must have roles assigned
    if (gameState.players.some(p => !p.roleId)) {
      console.warn("Cannot start game: not all players have roles assigned");
      return;
    }

    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    gameState.phase = "night";
    gameState.timer = null;
    gameState.nightActions = [];
    gameState.usedOneTimeAbilities = {};
    gameState.pedroLastProtectedId = null;
    gameState.jesusSacrificed = false;
    gameState.matiasTargetId = null;
    gameState.dayCount = 0;
    logEvent(`Game started with ${gameState.players.length} players`);
    io.emit("game_state_update", gameState);
  });

  socket.on("change_phase", (newPhase: "setup" | "day" | "night") => {
    if (!checkSocketRateLimit(socket.id, "change_phase")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded change_phase limit`);
      return;
    }

    // Validate with zod schema
    const validated = validatePayload(newPhase, ChangePhasSchema);
    if (!validated) {
      console.warn("Invalid phase payload");
      return;
    }

    // Validate phase transition
    if (!isValidPhaseTransition(gameState.phase, validated)) {
      console.warn(`Invalid transition from ${gameState.phase} to ${validated}`);
      return;
    }

    if (validated === "day" && gameState.phase === "night") {
      gameState.dayCount++;
      const actions = gameState.nightActions;

      const attackedByShadows = actions
        .filter((a) => a.actionType === "sombra_ataca")
        .map((a) => a.targetId);
      const protectedByPedro = actions.find(
        (a) => a.actionType === "pedro_protege",
      )?.targetId;
      const caredByMaria = actions.find(
        (a) => a.actionType === "maria_cuida",
      )?.targetId;
      const simaoKill = actions.find(
        (a) => a.actionType === "simao_elimina",
      )?.targetId;
      const jesusRevive = actions.find(
        (a) => a.actionType === "jesus_revive",
      )?.targetId;

      const animationEvents: any[] = [];
      const killedIds: string[] = [];

      if (simaoKill) {
        const target = gameState.players.find((p) => p.id === simaoKill);
        const simao = gameState.players.find(
          (p) => p.roleId === "simao_zelote",
        );
        if (target && target.isAlive) {
          animationEvents.push({ targetId: target.id, type: "attack" });
          killPlayer(target.id, "eliminado", killedIds);

          const luzRoles = [
            "jesus",
            "pedro",
            "maria_madalena",
            "joao",
            "tome",
            "nicodemos",
            "zaqueu",
            "jose_de_arimateia",
            "o_publicano",
          ];
          if (target.roleId && luzRoles.includes(target.roleId)) {
            if (simao && simao.isAlive) {
              animationEvents.push({ targetId: simao.id, type: "attack" });
              killPlayer(simao.id, "eliminado", killedIds);
            }
          }
        }
      }

      if (attackedByShadows.length > 0) {
        for (const targetId of attackedByShadows) {
          const target = gameState.players.find((p) => p.id === targetId);
          if (!target || !target.isAlive) continue;

          if (caredByMaria === targetId) {
            animationEvents.push({ targetId, type: "protect" });
          } else if (protectedByPedro === targetId) {
            animationEvents.push({ targetId, type: "protect" });

            const soldados = gameState.players.filter(
              (p) => p.roleId === "soldado_romano" && p.isAlive,
            );
            if (soldados.length > 0) {
              const unluckySoldier =
                soldados[Math.floor(Math.random() * soldados.length)];
              animationEvents.push({
                targetId: unluckySoldier.id,
                type: "attack",
              });
              killPlayer(unluckySoldier.id, "eliminado", killedIds);
            }
          } else {
            animationEvents.push({ targetId, type: "attack" });
            killPlayer(targetId, "eliminado", killedIds);
          }
        }
      }

      if (jesusRevive) {
        const target = gameState.players.find((p) => p.id === jesusRevive);
        if (target && !target.isAlive) {
          target.isAlive = true;
          target.deathReason = null;
          animationEvents.push({ targetId: target.id, type: "revive" });
        }
      }

      if (gameState.jesusSacrificed) {
        gameState.jesusSacrificed = false;
      }

      gameState.pedroLastProtectedId = protectedByPedro || null;
      gameState.nightActions = [];

      // Start 5-minute timer
      if (timerInterval) clearInterval(timerInterval);
      gameState.timer = 5 * 60;
      timerInterval = setInterval(() => {
        if (gameState.timer !== null && gameState.timer > 0) {
          gameState.timer--;
          io.emit("game_state_update", gameState);
        } else {
          if (timerInterval) clearInterval(timerInterval);
        }
      }, 1000);

      io.emit("play_animations", animationEvents);
    } else if (validated === "night" && gameState.phase === "day") {
      if (timerInterval) clearInterval(timerInterval);
      gameState.timer = null;
    }

    gameState.phase = validated;
    logEvent(`Phase changed to ${validated} (Day ${gameState.dayCount})`);
    checkWinCondition();
    io.emit("game_state_update", gameState);
  });

  socket.on("queue_night_action", (actionData: NightAction) => {
    if (!checkSocketRateLimit(socket.id, "queue_night_action")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded queue_night_action limit`);
      return;
    }

    // Validate with zod schema
    const validated = validatePayload(actionData, QueueNightActionSchema);
    if (!validated) {
      console.warn("Invalid night action payload");
      return;
    }

    // Validate phase
    if (gameState.phase !== "night") {
      console.warn("queue_night_action called outside night phase");
      return;
    }

    // Validate source and target exist and are alive
    const source = gameState.players.find(p => p.roleId === validated.sourceRoleId && p.isAlive);
    if (!source) {
      console.warn("Invalid source for night action:", validated.sourceRoleId);
      return;
    }

    if (!isValidPlayerId(validated.targetId, gameState)) {
      console.warn("Invalid target player ID:", validated.targetId);
      return;
    }

    const target = gameState.players.find(p => p.id === validated.targetId);
    if (!target) {
      console.warn("Target player not found:", validated.targetId);
      return;
    }

    gameState.nightActions = gameState.nightActions.filter(
      (a) => a.sourceRoleId !== validated.sourceRoleId,
    );
    gameState.nightActions.push(validated);
    logEvent(`Night action queued: ${validated.sourceRoleId} -> ${validated.targetId} (${validated.actionType})`);
    io.emit("game_state_update", gameState);
  });

  socket.on("use_one_time", (abilityId: string) => {
    if (!checkSocketRateLimit(socket.id, "use_one_time")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded use_one_time limit`);
      return;
    }

    // Validate with zod schema
    const validated = validatePayload(abilityId, UseOneTimeSchema);
    if (!validated) {
      console.warn("Invalid ability ID payload");
      return;
    }
    
    if (gameState.usedOneTimeAbilities[validated]) {
      console.warn("Ability already used:", validated);
      return;
    }
    
    gameState.usedOneTimeAbilities[validated] = true;
    logEvent(`One-time ability used: ${validated}`);
    io.emit("game_state_update", gameState);
  });

  socket.on("set_matias_target", (targetId: string) => {
    if (!checkSocketRateLimit(socket.id, "set_matias_target")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded set_matias_target limit`);
      return;
    }

    // Validate with zod schema
    const validated = validatePayload(targetId, SetMatiasTargetSchema);
    if (!validated) {
      console.warn("Invalid Matias target payload");
      return;
    }

    if (!isValidPlayerId(validated, gameState)) {
      console.warn("Invalid Matias target:", validated);
      return;
    }
    
    if (!isPlayerAlive(validated, gameState)) {
      console.warn("Matias target is not alive:", validated);
      return;
    }
    
    gameState.matiasTargetId = validated;
    const targetPlayer = gameState.players.find(p => p.id === validated);
    logEvent(`Matias target set to ${targetPlayer?.name || validated}`);
    io.emit("game_state_update", gameState);
  });

  socket.on("toggle_reveal", (targetId: string) => {
    if (!checkSocketRateLimit(socket.id, "toggle_reveal")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded toggle_reveal limit`);
      return;
    }

    // Validate with zod schema
    const validated = validatePayload(targetId, ToggleRevealSchema);
    if (!validated) {
      console.warn("Invalid toggle_reveal target payload");
      return;
    }

    if (!isValidPlayerId(validated, gameState)) {
      console.warn("Invalid toggle_reveal target:", validated);
      return;
    }
    
    const target = gameState.players.find((p) => p.id === validated);
    if (target) {
      target.isRevealed = !target.isRevealed;
      logEvent(`${target.name} reveal status toggled: ${target.isRevealed}`);
      io.emit("game_state_update", gameState);
    }
  });

  socket.on("execute_action", (actionData: any) => {
    if (!checkSocketRateLimit(socket.id, "execute_action")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded execute_action limit`);
      return;
    }

    // Validate with zod schema
    const validated = validatePayload(actionData, ExecuteActionSchema);
    if (!validated) {
      console.warn("Invalid execute_action payload");
      return;
    }

    // Validate target exists
    if (!isValidPlayerId(validated.targetId, gameState)) {
      console.warn("Invalid execute_action target:", validated.targetId);
      return;
    }

    const target = gameState.players.find(p => p.id === validated.targetId);
    if (!target) {
      console.warn("Target not found:", validated.targetId);
      return;
    }

    if (validated.type === "kill") {
      if (!target.isAlive) {
        console.warn("Cannot kill already dead player:", validated.targetId);
        return;
      }
      killPlayer(validated.targetId, "eliminado", []);
      io.emit("play_animations", [
        { targetId: validated.targetId, type: "attack" },
      ]);
    } else if (validated.type === "expel") {
      if (!target.isAlive) {
        console.warn("Cannot expel already dead player:", validated.targetId);
        return;
      }
      killPlayer(validated.targetId, "expulso", []);
      io.emit("play_animations", [
        { targetId: validated.targetId, type: "expel" },
      ]);
    } else if (validated.type === "revive") {
      if (target.isAlive) {
        console.warn("Cannot revive already alive player:", validated.targetId);
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
    
    checkWinCondition();
    io.emit("game_state_update", gameState);
  });

  socket.on("reset_game", () => {
    if (!checkSocketRateLimit(socket.id, "reset_game")) {
      console.warn(`[RATE LIMIT] Socket ${socket.id} exceeded reset_game limit`);
      return;
    }

    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    gameState = {
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
    };
    io.emit("game_state_update", gameState);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const frontendPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendPath));

// Endpoint to retrieve game logs (useful for debugging)
app.get("/api/logs", (req, res) => {
  res.json({
    logs: gameState.logs,
    gameState: {
      phase: gameState.phase,
      playerCount: gameState.players.length,
      alivePlayers: gameState.players.filter(p => p.isAlive).length,
      dayCount: gameState.dayCount,
      winnerMessage: gameState.winnerMessage,
    }
  });
});

app.use((req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
