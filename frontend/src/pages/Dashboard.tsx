import { useEffect, useRef, useState } from "react";
import { useGame } from "../context/use-game";
import type { GameState } from "../types/game";
import { calculateSyncedTimer } from "../utils/timer";

export const Dashboard = () => {
  const { gameState, animations } = useGame();
  const [announcement, setAnnouncement] = useState<{
    text: string;
    variant: "night" | "day" | "win";
  } | null>(null);

  const previousPhaseRef = useRef<GameState["phase"] | null>(null);
  const previousWinnerRef = useRef<string | null>(null);
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const showAnnouncement = (text: string, variant: "night" | "day" | "win") => {
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
    }

    setAnnouncement({ text, variant });
    announcementTimeoutRef.current = setTimeout(
      () => {
        setAnnouncement(null);
      },
      variant === "win" ? 5000 : 2600,
    );
  };

  const getWinnerHeadline = (winnerMessage: string): string => {
    if (winnerMessage.includes("EQUIPE LUZ")) return "Luz Venceu!";
    if (winnerMessage.includes("SOMBRAS")) return "Sombras Venceu!";
    if (winnerMessage.includes("JUDAS")) return "Judas Venceu!";
    if (winnerMessage.includes("ANANIAS E SAFIRA")) {
      return "Ananias e Safira Venceu!";
    }
    return "Vitória!";
  };

  useEffect(() => {
    if (gameState?.phase === "night") {
      document.body.className = "night-mode";
    } else {
      document.body.className = "day-mode";
    }
  }, [gameState?.phase]);

  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!gameState) return;

    let announcementId: number | null = null;

    const scheduleAnnouncement = (
      text: string,
      variant: "night" | "day" | "win",
    ) => {
      announcementId = window.setTimeout(() => {
        showAnnouncement(text, variant);
      }, 0);
    };

    if (previousPhaseRef.current === null) {
      previousPhaseRef.current = gameState.phase;
      previousWinnerRef.current = gameState.winnerMessage;
      return;
    }

    if (
      gameState.winnerMessage &&
      gameState.winnerMessage !== previousWinnerRef.current
    ) {
      scheduleAnnouncement(getWinnerHeadline(gameState.winnerMessage), "win");
    } else if (gameState.phase !== previousPhaseRef.current) {
      if (gameState.phase === "night") {
        scheduleAnnouncement("Jerusalem Dorme", "night");
      }
      if (gameState.phase === "day") {
        scheduleAnnouncement("Jerusalem Acorda", "day");
      }
    }

    previousPhaseRef.current = gameState.phase;
    previousWinnerRef.current = gameState.winnerMessage;

    return () => {
      if (announcementId !== null) {
        window.clearTimeout(announcementId);
      }
    };
  }, [gameState]);

  if (!gameState) {
    return (
      <div className="p-8 text-center text-xl">Conectando ao servidor...</div>
    );
  }

  return (
    <div className="dashboard-shell min-h-screen flex flex-col items-center p-8 transition-colors duration-500 relative overflow-hidden">
      {announcement && (
        <div className="announcement-wrap">
          <div className={`announcement-card ${announcement.variant}`}>
            <h2 className="announcement-text">{announcement.text}</h2>
          </div>
        </div>
      )}

      <h1 className="text-5xl font-bold mb-4 text-center dashboard-title">
        {gameState.phase === "night"
          ? "Jerusalem Dorme..."
          : gameState.phase === "day"
            ? "Jerusalem Acorda!"
            : "Aguardando Início..."}
      </h1>

      {gameState.winnerMessage && (
        <div className="w-full max-w-4xl bg-yellow-400/95 text-yellow-900 p-6 rounded-2xl shadow-2xl mb-8 text-center border-4 border-yellow-500 animate-bounce z-50 winner-banner">
          <h2 className="text-2xl sm:text-4xl font-bold uppercase tracking-wider">
            {gameState.winnerMessage}
          </h2>
        </div>
      )}

      {gameState.timer !== null &&
        gameState.phase === "day" &&
        !gameState.winnerMessage && (
          <div className="text-4xl font-mono mb-8 p-6 bg-black/10 rounded-2xl shadow-inner font-bold tracking-widest text-slate-800">
            {(() => {
              const syncedTimer = calculateSyncedTimer(
                gameState.timerStartedAt,
                gameState.timer,
              );
              const displayTimer = syncedTimer ?? gameState.timer;
              return (
                <>
                  {Math.floor(displayTimer / 60)}:
                  {(displayTimer % 60).toString().padStart(2, "0")}
                </>
              );
            })()}
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

            if (anim === "attack") {
              animClass = "animate-pulse ring-8 ring-red-500 scale-105 z-50";
            } else if (anim === "protect" || anim === "protect_pedro") {
              animClass =
                "ring-8 ring-blue-500 scale-110 z-50 shadow-[0_0_40px_rgba(59,130,246,0.8)]";
            } else if (anim === "protect_maria") {
              animClass =
                "ring-8 ring-rose-500 scale-110 z-50 shadow-[0_0_40px_rgba(244,63,94,0.8)]";
            } else if (anim === "revive") {
              animClass =
                "ring-8 ring-yellow-400 scale-110 z-50 shadow-[0_0_40px_rgba(250,204,21,0.8)]";
            } else if (anim === "expel") {
              animClass = "expel-shake ring-8 ring-orange-500 z-50";
            }

            return (
              <div
                key={player.id}
                className={`player-card relative flex flex-col items-center justify-start transition-all duration-500 flex-grow min-w-[120px] max-w-[250px] basis-[calc(50%-1rem)] sm:basis-[calc(33%-1rem)] md:basis-[calc(25%-1.5rem)] lg:basis-[calc(20%-2rem)] min-[1920px]:basis-[calc(10%-2rem)] ${animClass} ${player.isAlive ? "opacity-100" : "opacity-60"}`}
              >
                <div
                  className={`w-full aspect-[2/3] rounded-xl border-4 ${player.isAlive ? "border-slate-300" : "border-red-900"} flex items-center justify-center overflow-hidden relative shadow-2xl bg-slate-800 card-face`}
                >
                  {anim === "attack" && (
                    <div className="absolute inset-0 bg-red-500/60 z-30 flex items-center justify-center text-6xl">
                      🗡️
                    </div>
                  )}
                  {(anim === "protect" || anim === "protect_pedro") && (
                    <div className="absolute inset-0 bg-blue-500/40 z-30 flex items-center justify-center text-6xl">
                      🛡️
                    </div>
                  )}
                  {anim === "protect_maria" && (
                    <div className="absolute inset-0 bg-rose-500/40 z-30 flex items-center justify-center text-6xl">
                      ❤️
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
                          <div className="absolute inset-0 bg-red-950/60 z-10" />
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
                      <div className="absolute inset-0 bg-[url('/img/background.jpg')] bg-cover opacity-80 z-0" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
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
