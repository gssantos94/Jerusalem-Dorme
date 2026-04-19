import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { ROLE_ABILITIES } from "../constants/role-abilities";
import { useGame } from "../context/use-game";
import type { GameState, Player, RoleAbility } from "../types/game";

type AbilityWithSource = RoleAbility & { sourceRoleId: string };

export const Admin = () => {
  const { gameState, socket } = useGame();
  const [newPlayerName, setNewPlayerName] = useState("");
  const [activeNightStep, setActiveNightStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const availableAbilities = useMemo(() => {
    const abilities: AbilityWithSource[] = [];
    if (!gameState) return abilities;

    gameState.players
      .filter((player) => player.isAlive && player.roleId)
      .forEach((player) => {
        const roleAbilities = ROLE_ABILITIES[player.roleId!] || [];
        roleAbilities.forEach((ability) => {
          if (ability.oneTime && gameState.usedOneTimeAbilities[ability.id]) {
            return;
          }
          if (!abilities.some((item) => item.id === ability.id)) {
            abilities.push({ ...ability, sourceRoleId: player.roleId! });
          }
        });
      });

    return abilities;
  }, [gameState]);

  useEffect(() => {
    if (gameState?.phase !== "day") return;

    const resetId = window.setTimeout(() => {
      setActiveNightStep(0);
    }, 0);

    return () => {
      window.clearTimeout(resetId);
    };
  }, [gameState?.phase]);

  if (!gameState) {
    return <div className="p-4">Conectando...</div>;
  }

  const activeNightOrder = [
    {
      id: "matias",
      name: "Matias",
      condition: (state: GameState) =>
        state.dayCount === 0 &&
        state.players.some(
          (player) => player.roleId === "matias" && player.isAlive,
        ),
    },
    {
      id: "ananias_safira",
      name: "Ananias e Safira",
      condition: (state: GameState) =>
        state.dayCount === 0 &&
        state.players.some(
          (player) => player.roleId === "ananias" && player.isAlive,
        ),
    },
    {
      id: "sombras",
      name: "Sombras",
      condition: (state: GameState) =>
        state.players.some(
          (player) =>
            [
              "fariseu",
              "judas",
              "sumo_sacerdote",
              "rei_herodes",
              "soldado_romano",
              "ananias",
              "safira",
            ].includes(player.roleId!) && player.isAlive,
        ),
    },
    {
      id: "jesus",
      name: "Jesus",
      condition: (state: GameState) =>
        state.players.some(
          (player) => player.roleId === "jesus" && player.isAlive,
        ) && state.players.some((player) => !player.isAlive),
    },
    {
      id: "maria_madalena",
      name: "Maria Madalena",
      condition: (state: GameState) =>
        state.players.some(
          (player) => player.roleId === "maria_madalena" && player.isAlive,
        ),
    },
    {
      id: "pedro",
      name: "Pedro",
      condition: (state: GameState) =>
        state.players.some(
          (player) => player.roleId === "pedro" && player.isAlive,
        ),
    },
    {
      id: "joao",
      name: "João",
      condition: (state: GameState) =>
        state.players.some(
          (player) => player.roleId === "joao" && player.isAlive,
        ),
    },
    {
      id: "nicodemos",
      name: "Nicodemos",
      condition: (state: GameState) =>
        state.players.some(
          (player) => player.roleId === "nicodemos" && player.isAlive,
        ),
    },
    {
      id: "jose_de_arimateia",
      name: "José de Arimateia",
      condition: (state: GameState) =>
        state.players.some(
          (player) => player.roleId === "jose_de_arimateia" && player.isAlive,
        ),
    },
    {
      id: "simao_zelote",
      name: "Simão Zelote",
      condition: (state: GameState) =>
        state.players.some(
          (player) => player.roleId === "simao_zelote" && player.isAlive,
        ),
    },
  ].filter((order) => order.condition(gameState));

  const nextStep = () => {
    if (activeNightStep < activeNightOrder.length - 1) {
      setActiveNightStep((previous) => previous + 1);
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

  const handleAddPlayer = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newPlayerName.trim()) return;

    const newPlayer: Player = {
      id: Math.random().toString(36).substring(7),
      name: newPlayerName.trim(),
      roleId: null,
      isAlive: true,
      isRevealed: false,
    };

    if (gameState.phase === "setup") {
      socket?.emit("update_players", [...gameState.players, newPlayer]);
    }

    setNewPlayerName("");
  };

  const distributeRoles = () => {
    socket?.emit("distribute_roles");
  };

  const startGame = () => {
    if (gameState.players.length < 5) return;
    if (gameState.players.some((player) => !player.roleId)) return;
    socket?.emit("start_game");
  };

  const togglePhase = () => {
    const nextPhase = gameState.phase === "night" ? "day" : "night";
    socket?.emit("change_phase", nextPhase);
  };

  const handleAbilityClick = (ability: AbilityWithSource, target: Player) => {
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
              onChange={(event) => setNewPlayerName(event.target.value)}
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
                gameState.players.some((player) => !player.roleId)
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
                {activeNightOrder.map((order, index) => (
                  <div
                    key={order.id}
                    className={`flex-shrink-0 flex items-center gap-2 border px-4 py-2 rounded-full text-sm font-semibold transition-all ${index === activeNightStep ? "bg-indigo-600 text-white shadow-md scale-105" : index < activeNightStep ? "bg-green-100 text-green-800 border-green-200 opacity-60" : "bg-white text-slate-500"}`}
                  >
                    {index < activeNightStep && <CheckCircle2 size={16} />}
                    <span>
                      {index + 1}. {order.name}
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
                      gameState.players.filter((item) => item.id !== player.id),
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
                      .filter(
                        (ability) => !ability.requiresDead && !ability.dayOnly,
                      )
                      .map((ability) => {
                        const isQueued = gameState.nightActions.some(
                          (nightAction) =>
                            nightAction.sourceRoleId === ability.sourceRoleId &&
                            nightAction.targetId === player.id,
                        );

                        return (
                          <button
                            key={ability.id}
                            onClick={() => handleAbilityClick(ability, player)}
                            className={`${isQueued ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700 border-slate-300"} px-2 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 border flex-1 justify-center min-w-[30%]`}
                          >
                            {ability.icon}
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
                      .filter((ability) => ability.requiresDead)
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
