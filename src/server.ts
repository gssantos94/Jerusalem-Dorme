import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

export interface Player {
  id: string;
  name: string;
  roleId: string | null;
  isAlive: boolean;
  isRevealed: boolean;
  deathReason?: 'eliminado' | 'expulso' | null;
}

export interface NightAction {
  sourceRoleId: string;
  targetId: string;
  actionType: string;
}

export interface GameState {
  phase: 'setup' | 'day' | 'night';
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
  phase: 'setup',
  players: [],
  timer: null,
  nightActions: [],
  logs: [],
  usedOneTimeAbilities: {},
  pedroLastProtectedId: null,
  jesusSacrificed: false,
  matiasTargetId: null,
  dayCount: 0,
  winnerMessage: null
};

let timerInterval: NodeJS.Timeout | null = null;

function checkWinCondition() {
    if (gameState.phase === 'setup' || gameState.players.length === 0 || gameState.winnerMessage) return;

    const alivePlayers = gameState.players.filter(p => p.isAlive);
    if (alivePlayers.length === 0) return;

    const luzRoles = ['jesus', 'pedro', 'maria_madalena', 'joao', 'tome', 'nicodemos', 'zaqueu', 'jose_de_arimateia', 'o_publicano'];
    const sombraRoles = ['rei_herodes', 'soldado_romano', 'fariseu', 'sumo_sacerdote'];
    
    let luzCount = 0;
    let sombraCount = 0;
    let judasCount = 0;
    let casalCount = 0;
    let otherNeutrosCount = 0;

    for (const p of alivePlayers) {
        if (luzRoles.includes(p.roleId || '')) luzCount++;
        else if (sombraRoles.includes(p.roleId || '')) sombraCount++;
        else if (p.roleId === 'judas') judasCount++;
        else if (p.roleId === 'ananias' || p.roleId === 'safira') casalCount++;
        else otherNeutrosCount++;
    }

    const isNight = gameState.phase === 'night';
    let winnerMsg: string | null = null;

    if (sombraCount === 0 && judasCount === 0 && casalCount === 0 && otherNeutrosCount === 0 && luzCount > 0) {
        winnerMsg = "🕊️ A EQUIPE LUZ VENCEU! Todas as ameaças foram eliminadas.";
    } else if (luzCount === 0 && judasCount === 0 && casalCount === 0 && otherNeutrosCount === 0 && sombraCount > 0) {
        winnerMsg = "🌑 A EQUIPE DAS SOMBRAS VENCEU! A luz se apagou.";
    } else if (alivePlayers.length === 2) {
        if (luzCount === 1 && judasCount === 1) {
            winnerMsg = "⛓️ JUDAS VENCEU! Ele sobreviveu até o fim com a luz.";
        } else if (sombraCount === 1 && judasCount === 1) {
            if (isNight) {
                winnerMsg = "🌑 A EQUIPE DAS SOMBRAS VENCEU! A sombra eliminou Judas na última noite.";
            } else {
                winnerMsg = "⛓️ JUDAS VENCEU! Durante o dia, Judas manipulou a vila e venceu a sombra.";
            }
        }
    } else if (alivePlayers.length === 3) {
        if (luzCount === 1 && casalCount === 2) {
            winnerMsg = "👩‍❤️‍👨 ANANIAS E SAFIRA VENCERAM! Eles sobreviveram até o fim.";
        } else if (sombraCount === 1 && casalCount === 2) {
            if (isNight) {
                winnerMsg = "🌑 A EQUIPE DAS SOMBRAS VENCEU! A sombra eliminou o casal na última noite.";
            } else {
                winnerMsg = "👩‍❤️‍👨 ANANIAS E SAFIRA VENCERAM! Eles expulsaram a sombra no último dia.";
            }
        }
    }

    if (winnerMsg) {
        gameState.winnerMessage = winnerMsg;
        gameState.logs.push(`🏆 FIM DE JOGO: ${winnerMsg}`);
    }
}

function killPlayer(targetId: string, reason: 'eliminado' | 'expulso', killedIds: string[]) {
  const target = gameState.players.find(p => p.id === targetId);
  if (!target || !target.isAlive) return;

  target.isAlive = false;
  target.deathReason = reason;
  killedIds.push(targetId);
  
  let currentRole = target.roleId;

  if (currentRole === 'ananias') {
    const safira = gameState.players.find(p => p.roleId === 'safira' && p.isAlive);
    if (safira) {
      safira.isAlive = false;
      safira.deathReason = reason;
      killedIds.push(safira.id);
    }
  } else if (currentRole === 'safira') {
    const ananias = gameState.players.find(p => p.roleId === 'ananias' && p.isAlive);
    if (ananias) {
      ananias.isAlive = false;
      ananias.deathReason = reason;
      killedIds.push(ananias.id);
    }
  }

  if (currentRole === 'jesus' && reason === 'eliminado') {
      gameState.jesusSacrificed = true;
  }

  if (gameState.matiasTargetId === targetId) {
    const matias = gameState.players.find(p => p.roleId === 'matias' && p.isAlive);
    if (matias) {
      matias.roleId = currentRole;
      gameState.matiasTargetId = null;
    }
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('game_state_update', gameState);

  socket.on('update_players', (newPlayers: Player[]) => {
    if (gameState.phase === 'setup') {
      gameState.players = newPlayers;
      io.emit('game_state_update', gameState);
    }
  });

  socket.on('distribute_roles', () => {
    const uniqueRoles = ['jesus', 'maria_madalena', 'pedro', 'judas', 'fariseu', 'joao', 'jose_de_arimateia', 'matias', 'nicodemos', 'o_publicano', 'rei_herodes', 'simao_zelote', 'sumo_sacerdote', 'tome', 'zaqueu'];
    const rolesToAssign: string[] = [];
    
    // Always pair Ananias and Safira if added
    if (gameState.players.length >= 7 && Math.random() > 0.5) {
        rolesToAssign.push('ananias', 'safira');
    }

    const shuffledUnique = [...uniqueRoles].sort(() => 0.5 - Math.random());
    
    while (rolesToAssign.length < gameState.players.length) {
        if (shuffledUnique.length > 0) {
            rolesToAssign.push(shuffledUnique.pop()!);
        } else {
            rolesToAssign.push('soldado_romano');
        }
    }
    rolesToAssign.sort(() => 0.5 - Math.random());
    
    const playersWithRoles = gameState.players.map((p, idx) => ({ ...p, roleId: rolesToAssign[idx] }));
    gameState.players = playersWithRoles;
    io.emit('game_state_update', gameState);
  });

  socket.on('start_game', () => {
    gameState.phase = 'night';
    gameState.timer = null;
    gameState.nightActions = [];
    gameState.usedOneTimeAbilities = {};
    gameState.pedroLastProtectedId = null;
    gameState.jesusSacrificed = false;
    gameState.matiasTargetId = null;
    gameState.dayCount = 0;
    if (timerInterval) clearInterval(timerInterval);
    io.emit('game_state_update', gameState);
  });

  socket.on('change_phase', (newPhase: 'setup' | 'day' | 'night') => {
    if (newPhase === 'day' && gameState.phase === 'night') {
        gameState.dayCount++;
        const actions = gameState.nightActions;
        
        const attackedByShadows = actions.filter(a => a.actionType === 'sombra_ataca').map(a => a.targetId);
        const protectedByPedro = actions.find(a => a.actionType === 'pedro_protege')?.targetId;
        const caredByMaria = actions.find(a => a.actionType === 'maria_cuida')?.targetId;
        const simaoKill = actions.find(a => a.actionType === 'simao_elimina')?.targetId;
        const jesusRevive = actions.find(a => a.actionType === 'jesus_revive')?.targetId;

        const animationEvents: any[] = [];
        const killedIds: string[] = [];

        if (simaoKill) {
           const target = gameState.players.find(p=>p.id===simaoKill);
           const simao = gameState.players.find(p=>p.roleId==='simao_zelote');
           if (target && target.isAlive) {
               animationEvents.push({ targetId: target.id, type: 'attack' });
               killPlayer(target.id, 'eliminado', killedIds);
               
               const luzRoles = ['jesus', 'pedro', 'maria_madalena', 'joao', 'tome', 'nicodemos', 'zaqueu', 'jose_de_arimateia', 'o_publicano'];
               if (target.roleId && luzRoles.includes(target.roleId)) {
                   if (simao && simao.isAlive) {
                       animationEvents.push({ targetId: simao.id, type: 'attack' });
                       killPlayer(simao.id, 'eliminado', killedIds);
                   }
               }
           }
        }

        if (attackedByShadows.length > 0) {
            for (const targetId of attackedByShadows) {
                const target = gameState.players.find(p=>p.id===targetId);
                if (!target || !target.isAlive) continue;

                if (caredByMaria === targetId) {
                    animationEvents.push({ targetId, type: 'protect' });
                } else if (protectedByPedro === targetId) {
                    animationEvents.push({ targetId, type: 'protect' });
                    
                    const soldados = gameState.players.filter(p=>p.roleId === 'soldado_romano' && p.isAlive);
                    if (soldados.length > 0) {
                        const unluckySoldier = soldados[Math.floor(Math.random() * soldados.length)];
                        animationEvents.push({ targetId: unluckySoldier.id, type: 'attack' });
                        killPlayer(unluckySoldier.id, 'eliminado', killedIds);
                    }
                } else {
                    animationEvents.push({ targetId, type: 'attack' });
                    killPlayer(targetId, 'eliminado', killedIds);
                }
            }
        }

        if (jesusRevive) {
            const target = gameState.players.find(p=>p.id===jesusRevive);
            if (target && !target.isAlive) {
                target.isAlive = true;
                target.deathReason = null;
                animationEvents.push({ targetId: target.id, type: 'revive' });
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
              io.emit('game_state_update', gameState);
           } else {
              if (timerInterval) clearInterval(timerInterval);
           }
        }, 1000);

        io.emit('play_animations', animationEvents);

    } else if (newPhase === 'night' && gameState.phase === 'day') {
        if (timerInterval) clearInterval(timerInterval);
        gameState.timer = null;
    }
    
    gameState.phase = newPhase;
    checkWinCondition();
    io.emit('game_state_update', gameState);
  });

  socket.on('queue_night_action', (actionData: NightAction) => {
      gameState.nightActions = gameState.nightActions.filter(a => a.sourceRoleId !== actionData.sourceRoleId);
      gameState.nightActions.push(actionData);
      io.emit('game_state_update', gameState);
  });

  socket.on('use_one_time', (abilityId: string) => {
      gameState.usedOneTimeAbilities[abilityId] = true;
      io.emit('game_state_update', gameState);
  });

  socket.on('set_matias_target', (targetId: string) => {
      gameState.matiasTargetId = targetId;
      io.emit('game_state_update', gameState);
  });

  socket.on('toggle_reveal', (targetId: string) => {
      const target = gameState.players.find(p => p.id === targetId);
      if (target) {
          target.isRevealed = !target.isRevealed;
          io.emit('game_state_update', gameState);
      }
  });

  socket.on('execute_action', (actionData: any) => {
    if (actionData.type === 'kill') {
      killPlayer(actionData.targetId, 'eliminado', []);
      io.emit('play_animations', [{ targetId: actionData.targetId, type: 'attack' }]);
    } else if (actionData.type === 'expel') {
      killPlayer(actionData.targetId, 'expulso', []);
      io.emit('play_animations', [{ targetId: actionData.targetId, type: 'expel' }]);
    } else if (actionData.type === 'revive') {
      const target = gameState.players.find(p => p.id === actionData.targetId);
      if (target) {
        target.isAlive = true;
        target.deathReason = null;
        io.emit('play_animations', [{ targetId: actionData.targetId, type: 'revive' }]);
      }
    }
    checkWinCondition();
    io.emit('game_state_update', gameState);
  });

  socket.on('reset_game', () => {
    if (timerInterval) clearInterval(timerInterval);
    gameState = {
      phase: 'setup',
      players: [],
      timer: null,
      nightActions: [],
      logs: [],
      usedOneTimeAbilities: {},
      pedroLastProtectedId: null,
      jesusSacrificed: false,
      matiasTargetId: null,
      dayCount: 0,
      winnerMessage: null
    };
    io.emit('game_state_update', gameState);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
