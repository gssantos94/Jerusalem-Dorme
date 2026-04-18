# Deployment Guide - Jerusalem Dorme v0.0.1

## Free Hosting Options Comparison

| Platform           | Type       | Free Tier        | Sleep        | Perfect For                     |
| ------------------ | ---------- | ---------------- | ------------ | ------------------------------- |
| **Railway.app** ⭐ | Full-stack | $5/mês crédito   | Não          | Apps Node.js full-stack         |
| **Render.com**     | Full-stack | Sim, com sleep   | Sim (15 min) | Backend Express + Socket.IO     |
| **Fly.io**         | Container  | 3 shared-cpu-1x  | Não          | Docker containers               |
| **Vercel**         | Frontend   | Sim              | Não          | Next.js / React (frontend only) |
| **Azure**          | Cloud      | $200 crédito/mês | Não          | Full-stack applications         |

**Recomendação:** Railway.app (melhor custo-benefício para esta aplicação)

---

## Option 1: Railway.app ⭐ (RECOMENDADO)

### Setup (5 minutos)

1. **Criar conta**
   - Vá para: https://railway.app
   - Faça login com GitHub
   - Autorize Railway

2. **Criar novo projeto**

   ```bash
   # Instale Railway CLI
   npm install -g @railway/cli

   # Faça login
   railway login

   # Inicialize projeto no diretório
   railway init
   ```

3. **Adicione variáveis de ambiente**
   - No dashboard Railway: Project Settings → Variables
   - Adicione:
     ```
     PORT=3000
     NODE_ENV=production
     ALLOWED_ORIGINS=https://seu-app.railway.app
     GAME_TIMEOUT_MINUTES=5
     ```

4. **Configure build e start**
   - Railway detectará automaticamente `package.json`
   - Irá rodar: `npm install && npm run build && npm start`

5. **Deploy**
   ```bash
   # Conecte com GitHub (recomendado)
   # Ou faça deploy manual
   railway up
   ```

### Resultado

```
✅ URL: https://seu-app.railway.app
✅ Banco de dados: Em memória (reinicia a cada deploy)
✅ Limites: $5/mês grátis (renovável)
✅ Sleep: Não (sempre online)
✅ Socket.IO: ✅ Funciona perfeitamente
```

### Deploy automático (GitHub)

1. No Railway: New Project → GitHub Repo
2. Selecione `gssantos94/Jerusalem-Dorme`
3. Autorize Railway no GitHub
4. A cada push em `main`, faz deploy automático

---

## Option 2: Render.com

### Setup (7 minutos)

1. **Criar conta**
   - https://render.com
   - Faça login com GitHub

2. **Create New Service**
   - Click: "New +" → "Web Service"
   - Conecte seu GitHub repo
   - Selecione `gssantos94/Jerusalem-Dorme`
   - Branch: `main`

3. **Configurar**
   - Name: `jerusalem-dorme`
   - Runtime: `Node`
   - **Build Command:** `npm run build:ci`
   - Start Command: `npm start`
   - Plan: `Free`
   - Node Version: `22` (ou deixe default)

4. **Environment Variables**

   ```
   PORT=3000
   NODE_ENV=production
   ALLOWED_ORIGINS=https://jerusalem-dorme.onrender.com
   GAME_TIMEOUT_MINUTES=5
   ```

5. **Deploy**
   - Clique "Create Web Service"
   - Render fará deploy automático

### Resultado

```
✅ URL: https://jerusalem-dorme.onrender.com
✅ Build: Automático no main
✅ Sleep: Sim (15 min de inatividade)
⚠️  Primeira requisição: ~30s (wake up)
✅ Socket.IO: ✅ Funciona
```

### Desabilitar sleep (opcional)

- Usar cron job para pingar app a cada 5 min:
  ```bash
  # Cron service: https://cron-job.org
  # URL: https://jerusalem-dorme.onrender.com/api/logs
  ```

---

## Option 3: Fly.io

### Setup (10 minutos)

1. **Instale Fly CLI**

   ```bash
   npm install -g flyctl
   flyctl auth login
   ```

2. **Crie arquivo `fly.toml`** na raiz:

   ```toml
   app = "jerusalem-dorme"
   primary_region = "gru"  # São Paulo

   [build]
   dockerfile = "Dockerfile"

   [env]
   PORT = "3000"
   NODE_ENV = "production"
   ALLOWED_ORIGINS = "https://jerusalem-dorme.fly.dev"
   GAME_TIMEOUT_MINUTES = "5"

   [[services]]
   internal_port = 3000
   protocol = "tcp"

   [services.concurrency]
   type = "connections"
   hard_limit = 1000
   soft_limit = 100
   ```

3. **Crie `Dockerfile`**:

   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build:backend
   COPY frontend/dist /app/frontend/dist
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

4. **Deploy**
   ```bash
   flyctl launch
   flyctl deploy
   ```

### Resultado

```
✅ URL: https://jerusalem-dorme.fly.dev
✅ Free tier: 3 shared-cpu-1x, 3GB RAM
✅ Regiões: Escolha São Paulo (gru)
✅ Sleep: Não (sempre online)
✅ Socket.IO: ✅ Funciona
```

---

## Option 4: Azure Static Web Apps

### Limitações

- ❌ Frontend OK, mas backend (Express + Socket.IO) é difícil
- Para usar: Separar frontend (Static Web Apps) + backend (Azure Functions)
- Muito complexo para este caso

---

## Configuração Final - Recomendado (Railway.app)

### 1. Atualize `.env.production`

Crie arquivo `src/config.production.ts`:

```typescript
export const getConfig = () => {
  const isDev = process.env.NODE_ENV === "development";

  return {
    port: parseInt(process.env.PORT || "3000"),
    nodeEnv: process.env.NODE_ENV || "development",
    allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
      .split(",")
      .map((o) => o.trim()),
    gameTimeoutMinutes: parseInt(process.env.GAME_TIMEOUT_MINUTES || "5"),
  };
};
```

### 2. Atualize `src/server.ts`

```typescript
import { getConfig } from "./config.production";

// Usar no lugar de process.env direto
const config = getConfig();
const PORT = config.port;
const ALLOWED_ORIGINS = config.allowedOrigins;
```

### 3. Commit e Push

```bash
cd c:\Users\gustavo\Documents\jerusalem_dorme
git add -A
git commit -m "chore(deploy): Add production configuration for hosting

- Create config.production.ts for environment setup
- Support Railway.app, Render.com, Fly.io
- Configurable ALLOWED_ORIGINS via env
- Ready for free tier deployment

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

git push origin main
```

### 4. Deploy no Railway.app

```bash
# Opção 1: Conectar GitHub (automático)
# Railway Dashboard → New Project → GitHub Repo
# Selecione gssantos94/Jerusalem-Dorme

# Opção 2: CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

---

## Pós-Deploy Checklist

- [ ] Deploy completado sem erros
- [ ] App acessível em https://seu-app.railway.app
- [ ] Dashboard (/) carrega corretamente
- [ ] Admin panel (/admin) funciona
- [ ] Socket.IO conecta sem erros
- [ ] Timer sincroniza entre cliente-servidor
- [ ] Rate limiting ativo
- [ ] Logs visíveis em /api/logs

---

## Monitoramento

### Railway.app Logs

```bash
railway logs  # Ver logs em tempo real
```

### Testar conexão

```bash
# Terminal 1: Ver logs
curl https://seu-app.railway.app/api/logs

# Terminal 2: Carregar app
curl https://seu-app.railway.app/
```

---

## Problemas Comuns

### 1. Socket.IO não conecta

**Causa:** CORS misconfigured
**Solução:**

```env
ALLOWED_ORIGINS=https://seu-app.railway.app,http://localhost:3000
```

### 2. Build falha

**Causa:** `npm run build` falta
**Solução:**

```bash
# Certifique-se que em package.json existe:
"build": "npm run build:frontend && npm run build:backend"
```

### 3. Porta não está listening

**Causa:** App tenta porta fixa em 3000
**Solução:**

```typescript
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {...})
```

### 4. Não consegue conectar ao banco (não é aplicável aqui - memory state)

**Causa:** Sem persistência configurada
**Solução:** OK para v0.0.1 - reinicia a cada deploy

---

## Escalabilidade Futura

Se quiser adicionar:

### Persistência (PostgreSQL)

- Railway: Add-on PostgreSQL (pago)
- Render: PostgreSQL free tier (1 mês grátis, depois pago)

### Autenticação

- Adicionar JWT ou OAuth via GitHub

### Monitoramento

- Sentry.io (free tier)
- LogRocket (free tier)

---

## URLs Finais (Exemplo)

```
Production:  https://jerusalem-dorme.railway.app
Production Admin: https://jerusalem-dorme.railway.app/admin
Logs API:    https://jerusalem-dorme.railway.app/api/logs

GitHub main: https://github.com/gssantos94/Jerusalem-Dorme
```

---

## Recomendação Final

**Use Railway.app:**

- ✅ $5/mês grátis (renovável)
- ✅ Deploy automático no main
- ✅ Sem sleep/wake time
- ✅ Socket.IO 100% suportado
- ✅ Fácil setup (5 minutos)
- ✅ Dashboard intuitivo
- ✅ Logs em tempo real
- ✅ Escala facilmente se precisar

**Passos:**

1. Vá para https://railway.app
2. Login com GitHub
3. Create new project → GitHub Repo
4. Selecione `Jerusalem-Dorme`
5. Autorize Railroad no GitHub
6. Pronto! Deploy automático no próximo push em `main`

---

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
