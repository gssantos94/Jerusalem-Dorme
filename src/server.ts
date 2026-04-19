import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { createGameStore } from "./game/store";
import { registerSocketHandlers } from "./socket/register-handlers";
import { createGameLogger } from "./utils/logger";
import { SocketRateLimiter } from "./utils/socket-rate-limiter";

dotenv.config();

const app = express();

app.set("trust proxy", 1);

const httpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(httpLimiter);

app.use(
  cors({
    origin: true,
    credentials: false,
  }),
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: false,
  },
});

const store = createGameStore();
const logEvent = createGameLogger(store);
const socketRateLimiter = new SocketRateLimiter(1000, 10);

registerSocketHandlers({
  io,
  store,
  rateLimiter: socketRateLimiter,
  logEvent,
});

const frontendPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendPath));

app.get("/api/logs", (req, res) => {
  res.json({
    logs: store.gameState.logs,
    gameState: {
      phase: store.gameState.phase,
      playerCount: store.gameState.players.length,
      alivePlayers: store.gameState.players.filter((player) => player.isAlive)
        .length,
      dayCount: store.gameState.dayCount,
      winnerMessage: store.gameState.winnerMessage,
    },
  });
});

app.use((req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
