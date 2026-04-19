# Arquitetura do Projeto

## Objetivo

Organizar o projeto por responsabilidade, mantendo o fluxo simples de desenvolvimento e deploy atual.

## Estrutura de pastas

```text
.
├─ docs/
│  └─ ARCHITECTURE.md
├─ frontend/
│  ├─ public/
│  └─ src/
│     ├─ constants/
│     ├─ context/
│     ├─ pages/
│     ├─ types/
│     └─ utils/
└─ src/
   ├─ domain/
   ├─ game/
   ├─ socket/
   ├─ utils/
   ├─ validation/
   └─ server.ts
```

## Escopo por pasta

### Backend

- `src/server.ts`: bootstrap da aplicação (Express, Socket.IO, middlewares e rotas HTTP).
- `src/domain/`: contratos e dados centrais do jogo (`types`, constantes de regra e estado inicial).
- `src/game/`: engine de regras e armazenamento em memória (`store` + regras de vitória/noite).
- `src/socket/`: binding de eventos Socket.IO e fluxo de comandos em tempo real.
- `src/validation/`: schemas Zod e utilitário de validação de payload.
- `src/utils/`: utilitários transversais (embaralhamento, logs, rate limit por socket).

### Frontend

- `frontend/src/App.tsx`: composição de rotas e provider global.
- `frontend/src/context/`: estado global da conexão Socket.IO e sincronização de animações.
- `frontend/src/pages/`: páginas de feature (`Dashboard`, `Admin`).
- `frontend/src/constants/`: regras estáticas de UI/domínio (habilidades por papel).
- `frontend/src/types/`: contratos TypeScript compartilhados no frontend.
- `frontend/src/utils/`: helpers puros (timer sincronizado, formatações, etc.).

### Documentação

- `docs/`: documentação enxuta da arquitetura e organização de pastas.

## Princípios aplicados

- Alta coesão: cada pasta tem responsabilidade única.
- Baixo acoplamento: regras de jogo, transporte (socket) e bootstrap estão separados.
- Simplicidade: sem frameworks extras de arquitetura; apenas organização por camada.
- Evolução segura: módulos pequenos favorecem testes e manutenção incremental.
