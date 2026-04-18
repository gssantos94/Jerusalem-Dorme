# Débitos Técnicos - Jerusalem Dorme
## Análise de Bugs e Melhorias (Versão Revisada)

---

## 🔴 CRÍTICAS (7 Issues)

### 1. **BUG CRÍTICO: Shuffle de Papéis Tendencioso**
**Arquivo**: `src/server.ts:179-188`  
**Severidade**: 🔴 CRÍTICA

**Problema**:
```typescript
const shuffledUnique = [...uniqueRoles].sort(() => 0.5 - Math.random());
```

- Algoritmo `sort(() => 0.5 - Math.random())` é **ineficiente e tendencioso** (viés gaussiano)
- Gera distribuição não-uniforme de papéis
- Violação Fair Play: alguns papéis aparecem mais frequentemente

**Impacto**: Jogo desequilibrado, balanço de papéis prejudicado.

**Fix**:
```typescript
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const shuffledUnique = shuffle(uniqueRoles);
```

---

### 2. **BUG CRÍTICO: Ananias/Safira com Entrada Aleatória**
**Arquivo**: `src/server.ts:175-177`  
**Severidade**: 🔴 CRÍTICA

**Problema**:
```typescript
if (gameState.players.length >= 7 && Math.random() > 0.5) {
    rolesToAssign.push('ananias', 'safira');
}
```

- Casal só entra com 50% de probabilidade (não determinístico)
- Condições de vitória (linhas 104-112) assumem casal pode estar presente
- Se ausentes, `checkWinCondition` pode entrar em deadlock

**Impacto**: Jogo inconsistente, condições de vitória incompletas.

**Fix**:
```typescript
// Sempre incluir com 7+ players (determinístico)
if (gameState.players.length >= 7) {
    rolesToAssign.push('ananias', 'safira');
}
```

---

### 3. **BUG CRÍTICO: Timer Não Para Quando Jogo Termina**
**Arquivo**: `src/server.ts:280-302, 347-362`  
**Severidade**: 🔴 CRÍTICA

**Problema**:
```typescript
checkWinCondition();  // Define winnerMessage
io.emit('game_state_update', gameState);

// timerInterval continua rodando indefinidamente
// Mesmo com vencedor definido, timer dispara a cada 1s
```

**Impacto**:
- Memory leak: timer consome CPU indefinidamente
- Estado atualiza eternamente
- Múltiplas partidas = múltiplos timers vazando
- Servidor fica lento com o tempo

**Fix**:
```typescript
if (winnerMsg) {
    gameState.winnerMessage = winnerMsg;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}
```

---

### 4. **SEGURANÇA CRÍTICA: CORS Aberto para Tudo**
**Arquivo**: `src/server.ts:8, 11-16`  
**Severidade**: 🔴 CRÍTICA

**Problema**:
```typescript
app.use(cors());  // Qualquer origin
const io = new Server(server, {
  cors: {
    origin: '*',  // ← Aceita qualquer domínio
    methods: ['GET', 'POST']
  }
});
```

**Impacto**:
- Qualquer site se conecta ao seu server
- Bot farms podem jogar automaticamente
- Estado do jogo exposto
- Cross-site attacks

**Fix**:
```typescript
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || 
  ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({ 
  origin: ALLOWED_ORIGINS,
  credentials: true 
}));

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```

---

### 5. **BUG CRÍTICO: Reset Não Limpa TimerInterval**
**Arquivo**: `src/server.ts:345-362`  
**Severidade**: 🔴 CRÍTICA

**Problema**:
```typescript
socket.on('reset_game', () => {
    if (timerInterval) clearInterval(timerInterval);
    gameState = { /* ... */ };
    // ✓ Limpa estado

    // Mas se nova partida começar e terminar, há 2 timers rodando!
});
```

**Cenário**: Múltiplas partidas seguidas = timers acumulam.

**Impacto**: Memory leak severo em sessões longas.

**Fix**:
```typescript
socket.on('reset_game', () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;  // ← Ensure null
    }
    gameState = { /* reset */ };
});

// Também em start_game:
socket.on('start_game', () => {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    // ... start
});
```

---

### 6. **BUG CRÍTICO: Frontend Acesso Direto a Socket Sem Error Handling**
**Arquivo**: `frontend/src/App.tsx:362-382`  
**Severidade**: 🔴 CRÍTICA

**Problema**:
```typescript
useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    const newSocket = io(backendUrl);  // ← Sem tratamento de erro
    setSocket(newSocket);

    newSocket.on('game_state_update', (state: GameState) => {
        setGameState(state);  // ← Sem validação
    });

    // Sem handlers: disconnect, error, connect_error
    return () => newSocket.close();
}, []);
```

**Impacto**: 
- Desconexão silenciosa
- UI não reflete estado real
- Dados corrompidos passam para componentes

**Fix**:
```typescript
newSocket.on('connect', () => console.log('Connected'));
newSocket.on('disconnect', () => {
    setGameState(null);  // Reset UI
    // Mostrar mensagem de reconexão
});
newSocket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    // Mostrar erro ao usuário
});
newSocket.on('error', (error) => {
    console.error('Socket error:', error);
});
```

---

### 7. **BUG CRÍTICO: Frontend Timeout de Animação Não Limpo**
**Arquivo**: `frontend/src/App.tsx:371-378`  
**Severidade**: 🔴 CRÍTICA

**Problema**: 
```typescript
newSocket.on('play_animations', (events: {targetId: string, type: string}[]) => {
    const newAnims: Record<string, string> = {};
    events.forEach(e => { newAnims[e.targetId] = e.type; });
    setAnimations(newAnims);
    
    setTimeout(() => {
        setAnimations({});
    }, 5000);
    // ← Se desconectar, timeout continua disparando
});
```

**Impacto**: Memory leak em frontend, múltiplos timeouts pendentes.

**Fix**:
```typescript
const animTimeoutRef = useRef<NodeJS.Timeout>();

newSocket.on('play_animations', (events) => {
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    
    setAnimations(newAnims);
    animTimeoutRef.current = setTimeout(() => {
        setAnimations({});
    }, 5000);
});
```

---

## 🟠 ALTAS (8 Issues)

### 8. **Sem Validação de Entrada no Backend**
**Arquivo**: `src/server.ts` (todo)  
**Severidade**: 🟠 ALTA

**Problema**: Eventos como `execute_action`, `queue_night_action` não validam entrada:
```typescript
socket.on('execute_action', (actionData: any) => {  // ← any!
    // Sem verificar se targetId existe, se player está vivo, etc
});
```

**Fix**:
```typescript
socket.on('execute_action', (actionData: any) => {
    if (!actionData?.type || !actionData?.targetId) return;
    
    const target = gameState.players.find(p => p.id === actionData.targetId);
    if (!target || !target.isAlive) return;  // Validar
    
    if (actionData.type === 'kill') { /* ... */ }
});
```

---

### 9. **Estado Compartilhado Entre Conexões**
**Arquivo**: `src/server.ts` (global gameState)  
**Severidade**: 🟠 ALTA

**Problema**: Todas as conexões compartilham `gameState` global. Sem isolamento de sessão:
- Múltiplas salas simultâneas → conflito
- Sem autenticação → qualquer um controla o jogo

**Fix**:
```typescript
const games = new Map<string, GameState>();

io.on('connection', (socket) => {
    let gameId = socket.handshake.query.gameId as string;
    if (!gameId) gameId = generateId();
    
    if (!games.has(gameId)) {
        games.set(gameId, createInitialState());
    }
    
    const gameState = games.get(gameId)!;
    // ... usar gameState local
});
```

---

### 10. **Sem Rate Limiting**
**Arquivo**: `src/server.ts`  
**Severidade**: 🟠 ALTA

**Problema**: Socket.IO sem proteção contra flood/spam:
```typescript
socket.on('execute_action', (actionData) => {
    // Cliente pode enviar 1000x/s
});
```

**Fix**:
```typescript
import rateLimit from 'socket.io-rate-limit';
io.use(rateLimit({ max: 10, windowMs: 1000 }));  // 10 ações/seg
```

---

### 11. **Typagem Fraca em Eventos Socket.IO**
**Arquivo**: `frontend/src/App.tsx`, `src/server.ts`  
**Severidade**: 🟠 ALTA

**Problema**:
```typescript
newSocket.on('game_state_update', (state: GameState) => {  // ← Sem verificação
    setGameState(state);  // Pode ser null, undefined, etc
});
```

**Fix**: Usar tipagem stricta com `zod` ou `io-ts`:
```typescript
import { z } from 'zod';
const GameStateSchema = z.object({
    phase: z.enum(['setup', 'day', 'night']),
    players: z.array(PlayerSchema),
    // ...
});

newSocket.on('game_state_update', (data: unknown) => {
    const state = GameStateSchema.parse(data);
    setGameState(state);
});
```

---

### 12. **Sem Validação de Fase de Jogo**
**Arquivo**: `src/server.ts` (eventos)  
**Severidade**: 🟠 ALTA

**Problema**:
```typescript
socket.on('queue_night_action', (actionData: NightAction) => {
    // Sem checar se phase === 'night'
    gameState.nightActions.push(actionData);
});
```

**Fix**:
```typescript
socket.on('queue_night_action', (actionData: NightAction) => {
    if (gameState.phase !== 'night') return;  // ← Validar fase
    gameState.nightActions.push(actionData);
});
```

---

### 13. **Pedro Protege Sem Validação de Target**
**Arquivo**: `src/server.ts:215`  
**Severidade**: 🟠 ALTA

**Problema**:
```typescript
const protectedByPedro = actions.find(a => a.actionType === 'pedro_protege')?.targetId;
// Sem verificar se target está vivo, existe, etc
```

**Fix**:
```typescript
const protectedAction = actions.find(a => a.actionType === 'pedro_protege');
const protectedByPedro = protectedAction?.targetId && 
    gameState.players.find(p => p.id === protectedAction.targetId && p.isAlive)?.id;
```

---

### 14. **Frontend: Sem Tratamento de Desconexão em Timeouts**
**Arquivo**: `frontend/src/App.tsx:371-378`  
**Severidade**: 🟠 ALTA

**Problema**: 
```typescript
newSocket.on('play_animations', (events: {targetId: string, type: string}[]) => {
    // ... setTimeout sem cleanup
    // Se desconectar, timeout continua disparando
});
```

**Fix**: Usar useRef e cleanup.

---

### 15. **Sem Suporte a Reconexão Automática**
**Arquivo**: `frontend/src/App.tsx`  
**Severidade**: 🟠 ALTA

**Problema**: Socket.IO desconecta e não tenta reconectar automaticamente.

**Fix**:
```typescript
const newSocket = io(backendUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
});
```

---

## 🟡 MÉDIAS (6 Issues)

### 16. **Sem Logs de Jogo**
**Arquivo**: `src/server.ts`  
**Severidade**: 🟡 MÉDIA

**Problema**: Campo `logs` definido no GameState mas nunca utilizado:
```typescript
logs: string[];  // ← Declarado mas vazio
```

**Fix**: Implementar logging de eventos para replay/debug:
```typescript
gameState.logs.push(`🎲 Distribuindo papéis...`);
gameState.logs.push(`⚔️ ${simao.name} mata ${target.name}`);
gameState.logs.push(`🛡️ Pedro protege ${protected.name}`);
```

---

### 17. **Ordem de Chamada Noturna Não Reflete Backend**
**Arquivo**: `frontend/src/App.tsx:172-183`, `src/server.ts` (sem lógica)  
**Severidade**: 🟡 MÉDIA

**Problema**: Frontend define ordem de chamada (Matias → Ananias → Sombras), mas backend resolve tudo de uma vez sem obedecer ordem.

**Fix**: Implementar state machine com turnos noturnos:
```typescript
interface NightTurn {
    roleId: string;
    status: 'pending' | 'active' | 'done';
}
const nightTurns: NightTurn[] = [];
```

---

### 18. **Falta de Feedback Visual de Desconexão**
**Arquivo**: `frontend/src/App.tsx`  
**Severidade**: 🟡 MÉDIA

**Problema**: Se conexão cai, UI continua mostrando estado velho.

**Fix**: Adicionar banner de status:
```typescript
const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');

newSocket.on('disconnect', () => setConnectionStatus('disconnected'));
newSocket.on('reconnect', () => setConnectionStatus('connected'));
```

---

### 19. **Sem Sincronização de Hora Entre Cliente/Servidor**
**Arquivo**: `src/server.ts:280-288` (timer)  
**Severidade**: 🟡 MÉDIA

**Problema**: Timer é mantido no servidor mas clientes calculam localmente. Pode haver desincronização.

**Fix**: Enviar timestamp do servidor:
```typescript
io.emit('game_state_update', { 
    ...gameState, 
    timerStartedAt: Date.now(),  // ← Clock sincronizado
});
```

---

### 20. **Sem Arquivo .env com Variáveis de Configuração**
**Arquivo**: `src/server.ts`  
**Severidade**: 🟡 MÉDIA

**Problema**: Hardcoded:
- Porta 3000
- CORS `*`
- URLs do frontend

**Fix**: Criar `.env` e `.env.example`:
```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
GAME_TIMEOUT_MINUTES=5
```

---

### 21. **Frontend: Race Condition em useEffect**
**Arquivo**: `frontend/src/App.tsx:362-382`  
**Severidade**: 🟡 MÉDIA

**Problema**:
```typescript
useEffect(() => {
    const newSocket = io(backendUrl);  // Pode ser chamado múltiplas vezes em dev
    // Múltiplas conexões simultâneas
}, []);  // Sem dependencies
```

**Fix**:
```typescript
useEffect(() => {
    if (socket) return;  // Evitar duplicação
    const newSocket = io(backendUrl);
    setSocket(newSocket);
    return () => newSocket.close();
}, [socket]);
```

---

## 🔵 BAIXAS (4 Issues)

### 22. **Sem Documentação de Eventos Socket.IO**
**Arquivo**: `src/server.ts`  
**Severidade**: 🔵 BAIXA

**Fix**: Adicionar comentários ou arquivo `SOCKET_EVENTS.md`:
```typescript
/**
 * update_players: Atualiza lista de jogadores (fase setup)
 * distribute_roles: Embaralha e distribui papéis
 * start_game: Inicia jogo (transição setup → night)
 */
```

---

### 23. **Sem Validação de Valores Enum**
**Arquivo**: `frontend/src/App.tsx:236`  
**Severidade**: 🔵 BAIXA

**Problema**:
```typescript
const handleAbilityClick = (ability: any, target: Player) => {
    // ability.actionType pode ser qualquer string
};
```

**Fix**: Usar tipos Union para garantir valores válidos.

---

### 24. **Imagens de Cartas Quebradas Sem Fallback**
**Arquivo**: `frontend/src/App.tsx:112`  
**Severidade**: 🔵 BAIXA

**Problema**:
```typescript
<img src={`/img/${player.roleId}.jpg`} />  // Sem fallback se não existir
```

**Fix**: Adicionar `onError` ou placeholder.

---

### 25. **Sem Testes Automatizados**
**Arquivo**: Projeto  
**Severidade**: 🔵 BAIXA

**Fix**: Adicionar Jest + React Testing Library para frontend, vitest para backend.

---

## 📋 RESUMO POR PRIORIDADE

| Severidade | Quantidade | Recomendação |
|-----------|-----------|-------------|
| 🔴 CRÍTICA | 7 | **Corrigir antes de produção** |
| 🟠 ALTA | 8 | **Corrigir em próxima sprint** |
| 🟡 MÉDIA | 6 | **Corrigir conforme tempo permite** |
| 🔵 BAIXA | 4 | **Nice to have** |

---

## ✅ PRÓXIMOS PASSOS

1. **Imediato**: Criar branch `fix/critical-bugs` e corrigir issues 1-7
2. **Curto prazo**: Implementar validação e segurança (issues 8-15)
3. **Médio prazo**: Refatorar arquitetura para múltiplas sessões (issue 9)
4. **Longo prazo**: Adicionar logging, reconexão e testes (issues 16-25)

