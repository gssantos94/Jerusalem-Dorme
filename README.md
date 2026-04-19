# Documentacao Completa - Jerusalem Dorme

## 1) Visao geral

`Jerusalem Dorme` e um web app para apoiar o mestre de partida em uma adaptacao de "Cidade Dorme" com tema biblico. O sistema e dividido em:

- **Dashboard publico (`/`)**: tela para todos os jogadores acompanharem fase, status dos jogadores, animacoes e vencedor.
- **Painel do mestre (`/admin`)**: controle total de setup, distribuicao de papeis, ciclo dia/noite e acoes manuais.

O app funciona em tempo real via WebSocket (Socket.IO), com estado em memoria no backend.

Documentacao de apoio:

- `docs/ARCHITECTURE.md`: escopo e responsabilidade por pasta

## 2) Arquitetura tecnica

### Backend

- Linguagem: TypeScript
- Runtime: Node.js
- Framework HTTP: Express
- Tempo real: Socket.IO
- Bootstrap: `src/server.ts`
- Modulos principais:
  - `src/domain/` (tipos, constantes, estado inicial)
  - `src/game/` (store e engine de regras)
  - `src/socket/` (handlers de eventos)
  - `src/validation/` (schemas Zod)
  - `src/utils/` (logger, shuffle, rate limit)
- Build: `tsc` para `dist/server.js`
- Execucao prod: `npm start` (porta padrao `3000`)

### Frontend

- Framework: React 19 + TypeScript
- Build tool: Vite 8
- Roteamento: React Router
- Realtime client: `socket.io-client`
- Estilo: Tailwind CSS v4 + classes utilitarias
- Entradas principais:
  - `frontend/src/App.tsx` (rotas)
  - `frontend/src/context/game-context.tsx` (estado global Socket.IO)
  - `frontend/src/pages/` (Dashboard e Admin)
  - `frontend/src/constants/role-abilities.ts` (habilidades por papel)

### Scripts principais (raiz)

- `npm run dev`: fluxo oficial de desenvolvimento. Usa `concurrently` para subir backend + frontend juntos
- `npm run dev:backend`: `tsx watch src/server.ts`
- `npm run dev:frontend`: `cd frontend && npm run dev`
- `npm run build`: build frontend + backend
- `npm run start`: inicia backend compilado

## 3) Fluxo de rotas e UX

## `/` Dashboard

- Mostra estado da fase:
  - `night`: "Jerusalem Dorme..."
  - `day`: "Jerusalem Acorda!"
  - `setup`: "Aguardando Inicio..."
- Tema automatico:
  - Noite: `night-mode` (fundo escuro)
  - Dia/Setup: `day-mode` (fundo claro)
- Mostra jogadores em cards:
  - Vivo e nao revelado: carta oculta (`background.jpg`)
  - Revelado ou morto: carta real (`/img/<roleId>.jpg`)
  - Mortos mostram faixa de causa (`Eliminado` ou `Expulso`)
- Exibe animacoes de eventos (`attack`, `protect`, `revive`, `expel`)
- Exibe timer de debate no periodo diurno (5 minutos)
- Exibe mensagem de vitoria quando condicao final e atingida

## `/admin` Painel do Mestre

- Fase `setup`:
  - Adicionar/remover jogadores
  - Distribuir papeis (`Cartas`)
  - Iniciar jogo (minimo 5 jogadores + todos com papel)
- Fase ativa (`day`/`night`):
  - Botao de alternancia `Amanhecer` <-> `Anoitecer`
  - Ordem de chamada noturna dinamica com passo atual
  - Lista de jogadores com:
    - toggle de revelar/esconder papel
    - acoes noturnas contextuais
    - acoes diurnas (eliminar, expulsar)
    - reviver manual
  - Botao de reset total da partida

## 4) Modelo de estado do jogo (backend)

`GameState` em memoria:

- `phase`: `'setup' | 'day' | 'night'`
- `players`: lista de jogadores
- `timer`: segundos restantes do dia (ou `null`)
- `timerStartedAt`: timestamp Unix (ms) do inicio do timer para sincronizacao C-S
- `nightActions`: fila de acoes noturnas
- `nightTurnIndex`: indice do turno noturno atual (state machine)
- `nightTurns`: lista ordenada de roles para processamento sequencial
- `logs`: array de eventos do jogo com timestamp (ultimas 100 entradas)
- `usedOneTimeAbilities`: mapa de habilidades unicas ja usadas
- `pedroLastProtectedId`: ultimo alvo protegido por Pedro
- `jesusSacrificed`: flag auxiliar de sacrificio
- `matiasTargetId`: alvo escolhido por Matias
- `dayCount`: numero de amanheceres concluidos
- `winnerMessage`: texto final de vitoria

`Player`:

- `id`, `name`
- `roleId`
- `isAlive`
- `isRevealed`
- `deathReason`: `'eliminado' | 'expulso' | null`

## 5) Personagens e papeis presentes no projeto

Com imagem em `frontend/public/img`:

- `jesus`
- `maria_madalena`
- `pedro`
- `judas`
- `fariseu`
- `joao`
- `jose_de_arimateia`
- `matias`
- `nicodemos`
- `o_publicano`
- `rei_herodes`
- `simao_zelote`
- `sumo_sacerdote`
- `tome`
- `zaqueu`
- `ananias`
- `safira`
- `soldado_romano`

## 6) Distribuicao de papeis

Ao chamar `distribute_roles`:

1. Base de papeis unicos e embaralhada.
2. Se houver **7+ jogadores**, existe chance de incluir o par `ananias` + `safira`.
3. Se faltarem papeis para completar jogadores, preenche com `soldado_romano`.
4. Embaralha novamente e atribui 1 papel por jogador.

## 7) Habilidades e acoes implementadas

Mapeamento em `ROLE_ABILITIES` (frontend):

- `jesus`: `jesus_revive` (1x, alvo morto)
- `maria_madalena`: `maria_cuida`
- `pedro`: `pedro_protege`
- `simao_zelote`: `simao_elimina` (1x)
- `matias`: `matias_escolhe` (1x)
- Equipe sombra (`fariseu`, `sumo_sacerdote`, `rei_herodes`, `soldado_romano`): `sombra_ataca`
- Diversos papeis sem acao ativa no estado atual (`joao`, `tome`, `nicodemos`, `zaqueu`, etc.)

Regras especiais implementadas:

- **Ananias/Safira**: morre um, morre o outro junto.
- **Pedro protege**: se alvo protegido for atacado por sombra, ataque falha e um `soldado_romano` vivo aleatorio morre.
- **Maria cuida**: alvo cuidado sobrevive ao ataque da sombra.
- **Jesus reviver**: pode reviver um morto (1x por partida).
- **Matias substituir**: marca alvo na primeira noite; se o alvo morrer depois, Matias assume o papel dele.
- **Simão Zelote**: elimina alvo (1x); se matar alguem da Luz, Simao tambem morre.

## 8) Ciclo de jogo e resolucao de noite

### Inicio da partida

- `start_game` muda fase para `night`.
- Limpa timer, fila de acoes e flags auxiliares.
- Zera contadores e vencedor.
- Inicializa `nightTurnIndex = 0` para state machine.

### Transicao `night -> day`

Ao `change_phase('day')`:

1. Incrementa `dayCount`.
2. Inicializa state machine: `nightTurnIndex = 0`, `nightTurns` definido.
3. Inicia timer diurno de 5 minutos (300s) com `timerStartedAt` para sincronizacao.
4. Envia `game_state_update` para iniciar processamento.
5. Cliente pode chamar `next_night_turn` repetidamente para processar cada turno sequencialmente.

**Ordem de resolucao noturna:**

- **Turno 1**: Simão Zelote (`simao_elimina`)
- **Turno 2**: Sombras (`sombra_ataca`) com interacoes Maria/Pedro
- **Turno 3**: Maria Madalena (processada junto com sombras)
- **Turno 4**: Pedro (`pedro_protege`)
- **Turno 5**: Jesus (`jesus_revive`)

Cada turno dispara animacoes individuais. Ao final (`next_night_turn` retorna `complete: true`), fila e limpas.

### Transicao `day -> night`

- Para timer diurno e remove contagem (`timer = null`, `timerStartedAt = null`).
- Reseta `nightTurnIndex = 0` e `nightTurns = []`.

## 9) Condicoes de vitoria implementadas

A checagem considera jogadores vivos por grupos:

- **Luz**: `jesus`, `pedro`, `maria_madalena`, `joao`, `tome`, `nicodemos`, `zaqueu`, `jose_de_arimateia`, `o_publicano`
- **Sombra**: `rei_herodes`, `soldado_romano`, `fariseu`, `sumo_sacerdote`
- **Judas** separado
- **Casal**: `ananias` + `safira`
- **Outros neutros**: qualquer papel vivo fora dos grupos acima

Resultados:

- **Luz vence**: so restam Luz vivos.
- **Sombra vence**: so restam Sombras vivas.
- **Judas vence**: em cenario final de 2 vivos:
  - 1 Luz + Judas
  - ou 1 Sombra + Judas durante o dia (a noite, sombra vence por eliminar Judas)
- **Ananias/Safira vencem**: em cenario final de 3 vivos:
  - 1 Luz + casal
  - ou 1 Sombra + casal durante o dia (a noite, sombra vence se eliminar o casal)

Ao definir vencedor, o backend grava `winnerMessage` e encerra disputa por novas condicoes.

## 10) Eventos Socket.IO

### Servidor -> cliente

- `game_state_update`: estado global atualizado
- `play_animations`: eventos visuais da rodada

### Cliente -> servidor

- `update_players`
- `distribute_roles`
- `start_game`
- `change_phase`
- `queue_night_action`
- `next_night_turn` (avanca state machine de turnos noturnos)
- `use_one_time`
- `set_matias_target`
- `toggle_reveal`
- `execute_action` (`kill`, `expel`, `revive`)
- `reset_game`

### Endpoints HTTP

- `GET /api/logs`: retorna array de eventos do jogo + snapshot do estado atual

## 11) Persistencia, seguranca e operacao

- Estado e **volatil em memoria** (reinicio do processo reinicia partida).
- Nao ha autenticacao separada entre rotas no estado atual.
- **CORS configurado via env** (`ALLOWED_ORIGINS` do .env):
  - Producao: configurable por variavel ambiente
  - Desenvolvimento: localhost 5173-5175 + 3000
- **Rate limiting habilitado**:
  - HTTP: 100 requests/min por IP (express-rate-limit)
  - Socket.IO: 10 events/sec por socket (custom middleware)
- **Input validation**: todos os Socket.IO handlers validam com Zod schemas
- **Logging de eventos**: ultimas 100 entradas com timestamp ISO
- **Timer sincronizado**: cliente calcula tempo dinamicamente via `timerStartedAt`
- Backend serve build estatico de `frontend/dist`.

## 12) Assets e convencoes visuais

- Cartas: `frontend/public/img/<role>.jpg`
- Fundo oculto: `frontend/public/img/background.jpg`
- O sistema depende da correspondencia entre `roleId` e nome dos arquivos de imagem.

## 13) Diferencas entre intencao original e implementacao atual

- Ha um fluxo funcional completo de partida em tempo real.
- Algumas funcoes narrativas planejadas originalmente nao possuem acao programada dedicada (ex.: investigacoes de certos papeis), aparecendo apenas como papel sem habilidade ativa.
- O projeto esta pronto para uso manual pelo mestre, com automacao moderada na resolucao da noite e no controle visual.

## 14) Como rodar

Na raiz:

1. `npm install`
2. `cd frontend && npm install`
3. Volte a raiz e rode `npm run dev` (este comando usa `concurrently` para iniciar backend e frontend no mesmo terminal)
4. Acesse:
   - `http://localhost:5173/` (dashboard, durante dev Vite)
   - `http://localhost:5173/admin` (painel do mestre)

Para build/producao:

1. `npm run build`
2. `npm start`
3. Acesse `http://localhost:3000/`

## 15) Melhorias implementadas - v0.0.1

**Session 2 Improvements:**

### Seguranca

- ✅ **Rate Limiting**: HTTP 100/min + Socket.IO 10/sec (prevent DDoS/spam)
- ✅ **Input Validation**: Zod schemas em todos os 11+ handlers Socket.IO
- ✅ **CORS Configuravel**: Environment-based allowed origins

### Confiabilidade

- ✅ **Timer Sincronizado**: Client-server sync via `timerStartedAt` (elimina drift)
- ✅ **Memory Leak Fixes**: Limpeza correta de timers em todas as transicoes
- ✅ **Auto-Reconnect**: Socket.IO com retry automático em desconexões
- ✅ **React.StrictMode Fix**: conexão Socket.IO compartilhada para evitar duplicidade em dev

### Observabilidade

- ✅ **Game Event Logging**: 100 eventos recentes com timestamp ISO
- ✅ **Logs Endpoint**: `GET /api/logs` para debug e analise pos-jogo
- ✅ **Structured Logging**: Contexto completo em cada evento (roles, targets, etc)

### Game Logic

- ✅ **Night Turn State Machine**: Processamento sequencial de acoes noturnas
- ✅ **Per-Turn Animations**: Cada turno gera animacoes individuais
- ✅ **Ordered Execution**: Simao → Sombras → Maria → Pedro → Jesus

### Code Quality

- ✅ Fisher-Yates shuffle (probabilidade uniforme)
- ✅ Ananias/Safira deterministica com 7+ players
- ✅ Semantic commits com trailers Co-authored-by
- ✅ TypeScript strict mode + Zod validation

### Deployment

- ✅ Develop branch workflow (main <- PR from develop)
- ✅ Environment configuration (.env / .env.example)
- ✅ Build validation (npm run build)
- ✅ Git tags para releases (v0.0.1)
