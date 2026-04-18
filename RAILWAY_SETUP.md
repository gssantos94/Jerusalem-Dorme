# Railway.app Deployment Guide

## Quick Setup (5 minutos)

### 1. Vá para https://railway.app

- Clique "Login with GitHub"
- Autorize Railway a acessar seus repos

### 2. Crie Novo Projeto

- Clique "New Project"
- Selecione "GitHub Repo"
- Selecione `gssantos94/Jerusalem-Dorme`
- Branch: `main`

### 3. Configure Variáveis de Ambiente

Railway Dashboard → Project → Variables:

```
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://seu-app.railway.app
GAME_TIMEOUT_MINUTES=5
```

### 4. Deploy

- Railway detectará `Dockerfile` automaticamente
- Clique "Deploy"
- Build iniciará (~3-5 minutos)

---

## URLs Finais (após deploy)

```
App:   https://seu-app.railway.app
Admin: https://seu-app.railway.app/admin
Logs:  https://seu-app.railway.app/api/logs
```

---

## Como Funciona

1. **Docker Build:**
   - Instala deps (npm ci)
   - Build frontend (vite)
   - Build backend (TypeScript)
   - Remove devDependencies
   - Total: ~50-60 MB

2. **Runtime:**
   - Node 22 Alpine (~150 MB base)
   - Aplicação (~50-60 MB)
   - Total: ~200-210 MB

3. **Auto-Deploy:**
   - Cada push em `main` redeploys automaticamente
   - Sem tempo de sleep (sempre online)

---

## Troubleshooting

### Build falha com "Cannot find module"

- Verifique Dockerfile está copiando todos os arquivos necessários
- Verifique frontend/package.json e frontend/tsconfig.json existem

### App inicia mas não conecta

- Verifique `ALLOWED_ORIGINS` está correto
- Format: `https://seu-app.railway.app`

### Logs de build

- Railway Dashboard → Deployments → Logs
- Ver output completo do build

---

## Arquivos Adicionados

- `railway.json` - Configuração Railway (opcional mas recomendado)
- `Dockerfile` - Build em Docker (simples e confiável)
- `.dockerignore` - Otimização de build

---

## Status

✅ Dockerfile criado e testado  
✅ railway.json configurado  
✅ package.json com scripts build  
✅ Pronto para Railway deploy!

**Próximo passo:** Login em Railway.app e conecte seu GitHub repo
