# Render.com Setup - Build Simplificado

## Quick Setup (Mais Rápido)

### 1. No Render Dashboard

| Campo | Valor |
|-------|-------|
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |

### 2. Environment Variables

```
PORT=3000
NODE_ENV=production
GAME_TIMEOUT_MINUTES=5
ALLOWED_ORIGINS=https://jerusalem-dorme.onrender.com
```

### 3. Manual Deploy

- Clique "Manual Deploy" ou faça push em `main`
- Build deve passar agora ✅

---

## Como Funciona Agora

Criamos um `build.sh` que é muito mais simples e confiável:

```bash
# 1. Instala todas as dependências (com devDependencies)
npm install

# 2. Instala frontend dependencies
npm --prefix frontend install

# 3. Build frontend
npm --prefix frontend exec vite build

# 4. Build backend
npx tsc
```

Sem pipes, sem `cd`, sem confusão de PATH. Tudo explícito e claro.

---

## Se você já criou o serviço

### Atualize Build Command

**Mude de:**
```
npm run build:ci
```

**Para:**
```
npm run build
```

Clique "Manual Deploy".

---

## Se vai criar do zero

### 1. Vá para https://render.com
2. Click "New +" → "Web Service"
3. Authorize com GitHub e selecione `Jerusalem-Dorme`
4. Use essas configurações:

```
Name: jerusalem-dorme
Runtime: Node
Build Command: npm run build
Start Command: npm start
Plan: Free
```

### 5. Add Environment Variables (Settings → Environment)

```
PORT=3000
NODE_ENV=production
GAME_TIMEOUT_MINUTES=5
ALLOWED_ORIGINS=https://jerusalem-dorme.onrender.com
```

### 6. Deploy

- Clique "Create Web Service"
- Render iniciará o build

---

## Arquivos Adicionados

- `build.sh` - Script de build transparente e simples
- `.npmrc` - Garante devDependencies instaladas
- `Dockerfile` - Alternativa para usar Docker no Render

---

## URLs Finais

```
App:   https://jerusalem-dorme.onrender.com
Admin: https://jerusalem-dorme.onrender.com/admin
Logs:  https://jerusalem-dorme.onrender.com/api/logs
```
