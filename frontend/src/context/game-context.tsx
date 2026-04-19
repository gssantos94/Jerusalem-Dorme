import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { ReactNode } from "react";
import type { GameState } from "../types/game";
import { GameContext } from "./game-context-object";

let sharedSocket: Socket | null = null;

const getOrCreateSocket = (): Socket => {
  if (sharedSocket) return sharedSocket;

  const backendUrl = window.location.origin;
  console.log(`[Socket.io] Tentando conectar a ${backendUrl}`);

  sharedSocket = io(backendUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10,
    timeout: 20000,
    transports: ["websocket"],
  });

  return sharedSocket;
};

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const socket = useMemo(() => getOrCreateSocket(), []);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [animations, setAnimations] = useState<Record<string, string>>({});

  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleConnect = () => {
      console.log("[Socket.io] Conectado");
      socket.emit("request_state");
    };

    const handleStateUpdate = (state: GameState) => {
      setGameState(state);
    };

    const handlePlayAnimations = (
      events: Array<{ targetId: string; type: string }>,
    ) => {
      const nextAnimations: Record<string, string> = {};
      events.forEach((event) => {
        nextAnimations[event.targetId] = event.type;
      });

      setAnimations(nextAnimations);

      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }

      animTimeoutRef.current = setTimeout(() => {
        setAnimations({});
      }, 5000);
    };

    const handleDisconnect = () => {
      console.log("[Socket.io] Desconectado");
      setGameState(null);
    };

    const handleConnectError = (error: unknown) => {
      console.error("[Socket.io] Erro de conexão:", error);
    };

    const handleSocketError = (error: unknown) => {
      console.error("[Socket.io] Erro Socket:", error);
    };

    socket.on("connect", handleConnect);
    socket.on("game_state_update", handleStateUpdate);
    socket.on("play_animations", handlePlayAnimations);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("error", handleSocketError);

    if (socket.connected) {
      socket.emit("request_state");
    }

    return () => {
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }

      socket.off("connect", handleConnect);
      socket.off("game_state_update", handleStateUpdate);
      socket.off("play_animations", handlePlayAnimations);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("error", handleSocketError);
    };
  }, [socket]);

  return (
    <GameContext.Provider value={{ gameState, socket, animations }}>
      {children}
    </GameContext.Provider>
  );
};
