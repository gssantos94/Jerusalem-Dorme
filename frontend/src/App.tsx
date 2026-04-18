import React, {
  useEffect,
  useState,
  createContext,
  useContext,
  useRef,
} from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";

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

export interface GameState {
  phase: "setup" | "day" | "night";
  players: Player[];
  timer: number | null;
  nightActions: NightAction[];
  usedOneTimeAbilities: Record<string, boolean>;
  pedroLastProtectedId: string | null;
  jesusSacrificed: boolean;
  matiasTargetId: string | null;
  dayCount: number;
  winnerMessage: string | null;
}

interface GameContextType {
  gameState: GameState | null;
  socket: Socket | null;
  animations: Record<string, string>;
}

const GameContext = createContext<GameContextType>({
  gameState: null,
  socket: null,
  animations: {},
});
export const useGame = () => useContext(GameContext);

const ROLE_ABILITIES: Record<string, any[]> = {
  jesus: [
    {
      id: "jesus_revive",
      label: "Ressuscitar",
      icon: "✨",
      actionType: "jesus_revive",
      oneTime: true,
      requiresDead: true,
    },
  ],
  maria_madalena: [
    {
      id: "maria_cuida",
      label: "Maria Cuida",
      icon: "💖",
      actionType: "maria_cuida",
    },
  ],
  pedro: [
    {
      id: "pedro_protege",
      label: "Pedro Protege",
      icon: "🛡️",
      actionType: "pedro_protege",
    },
  ],
  simao_zelote: [
    {
      id: "simao_elimina",
      label: "Simão Elimina",
      icon: "⚔️",
      actionType: "simao_elimina",
      oneTime: true,
    },
  ],
  matias: [
    {
      id: "matias_escolhe",
      label: "Substituir",
      icon: "🔄",
      actionType: "matias_escolhe",
      oneTime: true,
    },
  ],
  fariseu: [
    {
      id: "sombra_ataca",
      label: "Sombra Ataca",
      icon: "🗡️",
      actionType: "sombra_ataca",
    },
  ],
  sumo_sacerdote: [
    {
      id: "sombra_ataca",
      label: "Sombra Ataca",
      icon: "🗡️",
      actionType: "sombra_ataca",
    },
  ],
  rei_herodes: [
    {
      id: "sombra_ataca",
      label: "Sombra Ataca",
      icon: "🗡️",
      actionType: "sombra_ataca",
    },
  ],
  soldado_romano: [
    {
      id: "sombra_ataca",
      label: "Sombra Ataca",
      icon: "🗡️",
      actionType: "sombra_ataca",
    },
  ],
  judas: [], // Judas moved to Neutro, no active attack
  ananias: [],
  safira: [],
  joao: [],
  tome: [],
  nicodemos: [],
  jose_de_arimateia: [],
  zaqueu: [],
  o_publicano: [],
};

const Dashboard = () => {
  const { gameState, animations } = useGame();

  useEffect(() => {
    if (gameState?.phase === "night") {
      document.body.className = "night-mode";
    } else {
      document.body.className = "day-mode";
    }
  }, [gameState?.phase]);

  if (!gameState)
    return (
      <div className="p-8 text-center text-xl">Conectando ao servidor...</div>
    );

  return (
    <div className="min-h-screen flex flex-col items-center p-8 transition-colors duration-500">
      <h1 className="text-5xl font-bold mb-4 text-center">
        {gameState.phase === "night"
          ? "Jerusalem Dorme..."
          : gameState.phase === "day"
            ? "Jerusalem Acorda!"
            : "Aguardando Início..."}
      </h1>

      {gameState.winnerMessage && (
        <div className="w-full max-w-4xl bg-yellow-400 text-yellow-900 p-6 rounded-2xl shadow-2xl mb-8 text-center border-4 border-yellow-500 animate-bounce z-50">
          <h2 className="text-2xl sm:text-4xl font-bold uppercase tracking-wider">
            {gameState.winnerMessage}
          </h2>
        </div>
      )}

      {gameState.timer !== null &&
        gameState.phase === "day" &&
        !gameState.winnerMessage && (
          <div className="text-4xl font-mono mb-8 p-6 bg-black/10 rounded-2xl shadow-inner font-bold tracking-widest text-slate-800">
            {Math.floor(gameState.timer / 60)}:
            {(gameState.timer % 60).toString().padStart(2, "0")}
          </div>
        )}

      {gameState.phase === "setup" ? (
        <div className="text-2xl mt-12 opacity-70">
          A partida começará em breve...
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 w-full max-w-[95vw] mb-8">
          {gameState.players.map((player) => {
            const anim = animations[player.id];
            let animClass = "";
            if (anim === "attack")
              animClass = "animate-pulse ring-8 ring-red-500 scale-105 z-50";
            else if (anim === "protect")
              animClass =
                "animate-bounce ring-8 ring-blue-500 scale-110 z-50 shadow-[0_0_40px_rgba(59,130,246,0.8)]";
            else if (anim === "revive")
              animClass =
                "ring-8 ring-yellow-400 scale-110 z-50 shadow-[0_0_40px_rgba(250,204,21,0.8)]";
            else if (anim === "expel")
              animClass = "animate-bounce ring-8 ring-orange-500 z-50";

            return (
              <div
                key={player.id}
                className={`relative flex flex-col items-center justify-start transition-all duration-500 flex-grow min-w-[120px] max-w-[250px] basis-[calc(50%-1rem)] sm:basis-[calc(33%-1rem)] md:basis-[calc(25%-1.5rem)] lg:basis-[calc(20%-2rem)] min-[1920px]:basis-[calc(10%-2rem)] ${animClass} ${player.isAlive ? "opacity-100" : "opacity-60"}`}
              >
                <div
                  className={`w-full aspect-[2/3] rounded-xl border-4 ${player.isAlive ? "border-slate-400" : "border-red-900"} flex items-center justify-center overflow-hidden relative shadow-2xl bg-slate-800`}
                >
                  {anim === "attack" && (
                    <div className="absolute inset-0 bg-red-500/60 z-30 flex items-center justify-center text-6xl">
                      🗡️
                    </div>
                  )}
                  {anim === "protect" && (
                    <div className="absolute inset-0 bg-blue-500/40 z-30 flex items-center justify-center text-6xl">
                      🛡️
                    </div>
                  )}
                  {anim === "revive" && (
                    <div className="absolute inset-0 bg-yellow-300/60 z-30 flex items-center justify-center text-6xl">
                      ✨
                    </div>
                  )}
                  {anim === "expel" && (
                    <div className="absolute inset-0 bg-orange-500/60 z-30 flex items-center justify-center text-6xl">
                      🏛️
                    </div>
                  )}

                  {player.isRevealed || !player.isAlive ? (
                    <>
                      <img
                        src={`/img/${player.roleId}.jpg`}
                        className={`absolute inset-0 w-full h-full object-cover z-0 ${!player.isAlive && anim !== "revive" ? "grayscale" : ""}`}
                      />
                      {!player.isAlive && (
                        <>
                          <div className="absolute inset-0 bg-red-950/60 z-10"></div>
                          <span className="z-20 font-bold bg-black/80 px-2 py-1 rounded text-red-200 uppercase tracking-widest text-[10px] sm:text-xs">
                            {player.deathReason === "expulso"
                              ? "Expulso"
                              : "Eliminado"}
                          </span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-[url('/img/background.jpg')] bg-cover opacity-80 z-0"></div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                      <span className="z-20 font-bold text-white text-sm sm:text-lg tracking-widest opacity-80">
                        OCULTO
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-3 w-full bg-slate-900/10 dark:bg-white/10 px-2 py-1.5 rounded-lg shadow-sm">
                  <span className="font-bold text-sm sm:text-base lg:text-lg text-center block leading-tight truncate w-full">
                    {player.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Admin = () => {
  const { gameState, socket } = useGame();
  const [newPlayerName, setNewPlayerName] = useState("");
  const [activeNightStep, setActiveNightStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const availableAbilities = React.useMemo(() => {
    const abilities: any[] = [];
    if (!gameState) return abilities;

    gameState.players
      .filter((p) => p.isAlive && p.roleId)
      .forEach((p) => {
        const roleAbilities = ROLE_ABILITIES[p.roleId!] || [];
        roleAbilities.forEach((ability) => {
          if (ability.oneTime && gameState.usedOneTimeAbilities[ability.id])
            return;
          if (!abilities.some((a) => a.id === ability.id)) {
            abilities.push({ ...ability, sourceRoleId: p.roleId });
          }
        });
      });
    return abilities;
  }, [gameState]);

  useEffect(() => {
    if (gameState?.phase === "day") {
      setActiveNightStep(0);
    }
  }, [gameState?.phase]);

  if (!gameState) return <div className="p-4">Conectando...</div>;

  const activeNightOrder = [
    {
      id: "matias",
      name: "Matias",
      condition: (gs: GameState) =>
        gs.dayCount === 0 &&
        gs.players.some((p) => p.roleId === "matias" && p.isAlive),
    },
    {
      id: "ananias_safira",
      name: "Ananias e Safira",
      condition: (gs: GameState) =>
        gs.dayCount === 0 &&
        gs.players.some((p) => p.roleId === "ananias" && p.isAlive),
    },
    {
      id: "sombras",
      name: "Sombras",
      condition: (gs: GameState) =>
        gs.players.some(
          (p) =>
            [
              "fariseu",
              "judas",
              "sumo_sacerdote",
              "rei_herodes",
              "soldado_romano",
              "ananias",
              "safira",
            ].includes(p.roleId!) && p.isAlive,
        ),
    },
    {
      id: "jesus",
      name: "Jesus",
      condition: (gs: GameState) =>
        gs.players.some((p) => p.roleId === "jesus" && p.isAlive) &&
        gs.players.some((p) => !p.isAlive),
    },
    {
      id: "maria_madalena",
      name: "Maria Madalena",
      condition: (gs: GameState) =>
        gs.players.some((p) => p.roleId === "maria_madalena" && p.isAlive),
    },
    {
      id: "pedro",
      name: "Pedro",
      condition: (gs: GameState) =>
        gs.players.some((p) => p.roleId === "pedro" && p.isAlive),
    },
    {
      id: "joao",
      name: "João",
      condition: (gs: GameState) =>
        gs.players.some((p) => p.roleId === "joao" && p.isAlive),
    },
    {
      id: "nicodemos",
      name: "Nicodemos",
      condition: (gs: GameState) =>
        gs.players.some((p) => p.roleId === "nicodemos" && p.isAlive),
    },
    {
      id: "jose_de_arimateia",
      name: "José de Arimateia",
      condition: (gs: GameState) =>
        gs.players.some((p) => p.roleId === "jose_de_arimateia" && p.isAlive),
    },
    {
      id: "simao_zelote",
      name: "Simão Zelote",
      condition: (gs: GameState) =>
        gs.players.some((p) => p.roleId === "simao_zelote" && p.isAlive),
    },
  ].filter((order) => order.condition(gameState));

  const nextStep = () => {
    if (activeNightStep < activeNightOrder.length - 1) {
      setActiveNightStep((prev) => prev + 1);
      if (scrollRef.current) {
        const child = scrollRef.current.children[
          activeNightStep + 1
        ] as HTMLElement;
        if (child) {
          scrollRef.current.scrollTo({
            left: child.offsetLeft - 20,
            behavior: "smooth",
          });
        }
      }
    }
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const newPlayer: Player = {
      id: Math.random().toString(36).substring(7),
      name: newPlayerName.trim(),
      roleId: null,
      isAlive: true,
      isRevealed: false,
    };
    if (gameState.phase === "setup")
      socket?.emit("update_players", [...gameState.players, newPlayer]);
    setNewPlayerName("");
  };

  const distributeRoles = () => {
    socket?.emit("distribute_roles");
  };

  const startGame = () => {
    if (gameState.players.length < 5) return;
    if (gameState.players.some((p) => !p.roleId)) return;
    socket?.emit("start_game");
  };

  const togglePhase = () => {
    const nextPhase = gameState.phase === "night" ? "day" : "night";
    socket?.emit("change_phase", nextPhase);
  };

  const handleAbilityClick = (ability: any, target: Player) => {
    if (ability.id === "matias_escolhe") {
      socket?.emit("use_one_time", ability.id);
      socket?.emit("set_matias_target", target.id);
      return;
    }
    if (ability.oneTime) {
      socket?.emit("use_one_time", ability.id);
    }
    if (gameState.phase === "night") {
      socket?.emit("queue_night_action", {
        sourceRoleId: ability.sourceRoleId,
        targetId: target.id,
        actionType: ability.actionType,
      });
    }
  };

  return (
    <div className="p-2 sm:p-4 max-w-full mx-auto bg-slate-50 min-h-screen text-slate-900 pb-32 font-sans">
      <h1 className="text-2xl font-bold mb-4 text-center text-slate-800">
        Painel do Mestre
      </h1>

      {gameState.phase === "setup" && (
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-4">
          <form onSubmit={handleAddPlayer} className="flex gap-2">
            <input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Nome"
              className="flex-1 p-3 border rounded-lg focus:outline-none bg-slate-50"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-3 rounded-lg font-bold"
            >
              +
            </button>
          </form>
          <div className="flex gap-2 mt-4">
            <button
              onClick={distributeRoles}
              disabled={gameState.players.length === 0}
              className="flex-1 bg-amber-500 text-white py-3 rounded-lg font-bold shadow-sm"
            >
              Cartas
            </button>
            <button
              onClick={startGame}
              disabled={
                gameState.players.length < 5 ||
                gameState.players.some((p) => !p.roleId)
              }
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold shadow-sm disabled:opacity-50"
            >
              Iniciar
            </button>
          </div>
        </div>
      )}

      {gameState.phase !== "setup" && (
        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border sticky top-2 z-50">
          <button
            onClick={togglePhase}
            className={`w-full py-4 rounded-xl font-bold shadow-md text-white transition-all text-lg ${gameState.phase === "night" ? "bg-amber-500" : "bg-indigo-800"}`}
          >
            {gameState.phase === "night" ? "🌞 Amanhecer" : "🌙 Anoitecer"}
          </button>
          {gameState.phase === "night" && activeNightOrder.length > 0 && (
            <div className="mt-4 bg-slate-50 p-2 rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Ordem de Chamada:
                </div>
                <button
                  onClick={nextStep}
                  disabled={activeNightStep >= activeNightOrder.length - 1}
                  className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded font-bold hover:bg-indigo-200 disabled:opacity-50"
                >
                  Próximo →
                </button>
              </div>
              <div
                className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar items-center"
                ref={scrollRef}
              >
                {activeNightOrder.map((o, i) => (
                  <div
                    key={o.id}
                    className={`flex-shrink-0 flex items-center gap-2 border px-4 py-2 rounded-full text-sm font-semibold transition-all ${i === activeNightStep ? "bg-indigo-600 text-white shadow-md scale-105" : i < activeNightStep ? "bg-green-100 text-green-800 border-green-200 opacity-60" : "bg-white text-slate-500"}`}
                  >
                    {i < activeNightStep && <CheckCircle2 size={16} />}
                    <span>
                      {i + 1}. {o.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {gameState.players.map((player) => (
          <div
            key={player.id}
            className={`p-3 rounded-xl shadow-sm border flex flex-col gap-3 ${player.isAlive ? "bg-white" : "bg-slate-200 opacity-80"}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-16 bg-slate-300 rounded shadow-sm overflow-hidden flex-shrink-0 relative">
                {player.roleId && (
                  <img
                    src={`/img/${player.roleId}.jpg`}
                    className={`w-full h-full object-cover ${!player.isAlive ? "grayscale opacity-60" : ""}`}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg leading-tight flex items-center justify-between gap-2">
                  <span className="truncate">{player.name}</span>
                  {gameState.phase !== "setup" && (
                    <button
                      onClick={() => socket?.emit("toggle_reveal", player.id)}
                      className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 flex-shrink-0"
                    >
                      {player.isRevealed ? (
                        <Eye size={18} className="text-indigo-600" />
                      ) : (
                        <EyeOff size={18} />
                      )}
                    </button>
                  )}
                </div>
                <div className="text-xs font-semibold text-indigo-600 uppercase mt-1">
                  {player.roleId ? player.roleId.replace(/_/g, " ") : ""}
                </div>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {gameState.phase === "setup" ? (
                <button
                  onClick={() =>
                    socket?.emit(
                      "update_players",
                      gameState.players.filter((p) => p.id !== player.id),
                    )
                  }
                  className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold text-sm"
                >
                  Remover
                </button>
              ) : player.isAlive ? (
                <>
                  {gameState.phase === "night" &&
                    availableAbilities
                      .filter((a) => !a.requiresDead && !a.dayOnly)
                      .map((ability) => {
                        const isQueued = gameState.nightActions.some(
                          (na) =>
                            na.sourceRoleId === ability.sourceRoleId &&
                            na.targetId === player.id,
                        );
                        return (
                          <button
                            key={ability.id}
                            onClick={() => handleAbilityClick(ability, player)}
                            className={`${isQueued ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700 border-slate-300"} px-2 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 border flex-1 justify-center min-w-[30%]`}
                          >
                            {ability.icon}{" "}
                            <span className="truncate">
                              {isQueued ? "Fila" : ability.label}
                            </span>
                          </button>
                        );
                      })}

                  {gameState.phase === "day" && (
                    <>
                      <button
                        onClick={() =>
                          socket?.emit("execute_action", {
                            type: "kill",
                            targetId: player.id,
                          })
                        }
                        className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold text-sm flex-1"
                      >
                        Eliminar
                      </button>
                      <button
                        onClick={() =>
                          socket?.emit("execute_action", {
                            type: "expel",
                            targetId: player.id,
                          })
                        }
                        className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-lg font-bold text-sm flex-1"
                      >
                        Expulsar
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {(gameState.phase === "night" || gameState.phase === "day") &&
                    availableAbilities
                      .filter((a) => a.requiresDead)
                      .map((ability) => (
                        <button
                          key={ability.id}
                          onClick={() => handleAbilityClick(ability, player)}
                          className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 flex-1 justify-center"
                        >
                          {ability.icon} {ability.label}
                        </button>
                      ))}
                  <button
                    onClick={() =>
                      socket?.emit("execute_action", {
                        type: "revive",
                        targetId: player.id,
                      })
                    }
                    className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-sm flex-1"
                  >
                    Reviver
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {gameState.phase !== "setup" && (
        <div className="mt-8 text-center">
          <button
            onClick={() => socket?.emit("reset_game")}
            className="bg-red-50 text-red-500 px-4 py-2 rounded-lg font-bold text-sm"
          >
            Resetar Jogo
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [animations, setAnimations] = useState<Record<string, string>>({});

  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

    if (socket) return; // Avoid duplicate connections

    const newSocket = io(backendUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Socket connected");
    });

    newSocket.on("game_state_update", (state: GameState) => {
      setGameState(state);
    });

    newSocket.on(
      "play_animations",
      (events: { targetId: string; type: string }[]) => {
        const newAnims: Record<string, string> = {};
        events.forEach((e) => {
          newAnims[e.targetId] = e.type;
        });
        setAnimations(newAnims);

        // Clear existing timeout
        if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);

        animTimeoutRef.current = setTimeout(() => {
          setAnimations({});
        }, 5000);
      },
    );

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setGameState(null);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    newSocket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
      newSocket.close();
    };
  }, [socket]);

  return (
    <GameContext.Provider value={{ gameState, socket, animations }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </GameContext.Provider>
  );
}
