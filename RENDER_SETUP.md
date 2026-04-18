# Render.com Setup - Passo a Passo

## Se você já criou o serviço:

### 1. Acesse as Settings do Serviço

1. Vá ao dashboard do Render
2. Clique no seu serviço "jerusalem-dorme"
3. Vá para aba "Settings"

### 2. Atualize o Build Command

**Mude de:**

```
npm install && npm run build
```

**Para:**

```
npm run build:ci
```

### 3. Verificar Outras Configurações

```
Runtime: Node
Start Command: npm start
Node Version: 22 (ou Auto)
Auto-deploy: On (GitHub repo connected)
```

### 4. Clique em "Deploy"

- Use a opção "Manual Deploy" no topo
- Ou faça um novo push para main no GitHub
- Build deve passar agora ✅

---

## Se você vai criar do zero:

### 1. Vá para https://render.com

2. Click "New +" → "Web Service"
3. Authorize com GitHub e selecione repo
4. Use essas exatas configurações:

| Campo             | Valor              |
| ----------------- | ------------------ |
| **Name**          | `jerusalem-dorme`  |
| **Runtime**       | `Node`             |
| **Build Command** | `npm run build:ci` |
| **Start Command** | `npm start`        |
| **Plan**          | Free               |
| **Node Version**  | 22 (auto ok)       |

### 2. Adicione Environment Variables

**Settings → Environment**

```
PORT=3000
NODE_ENV=production
GAME_TIMEOUT_MINUTES=5
ALLOWED_ORIGINS=https://jerusalem-dorme.onrender.com
```

### 3. Deploy

- Clique "Create Web Service"
- Render iniciará o build

---

## O que mudou no código

**Script `build:ci` (para CI/CD):**

```bash
npm install && cd frontend && npm install && npm run build && cd .. && npm run build:backend
```

**Passo a passo:**

1. `npm install` - Instala deps raiz
2. `cd frontend && npm install` - Instala deps frontend
3. `npm run build` - TypeScript compile + Vite build
4. `cd .. && npm run build:backend` - TypeScript compile backend

Isso garante que todas as dependências estejam presentes antes de compilar.

---

## Troubleshooting

### "Ainda não funciona"

- Vá para "Settings"
- Clique "Clear build cache"
- Faça "Manual Deploy"

### Erro: "Cannot find type definition file for 'vite/client'"

- ✅ Resolvido! Build Command deve ser: `npm run build:ci`

### App inicia mas Socket.IO não conecta

- Verifique `ALLOWED_ORIGINS` no Render Dashboard
- Deve ser exatamente: `https://jerusalem-dorme.onrender.com`

---

## URLs Finais (após deploy)

```
App:  https://jerusalem-dorme.onrender.com
Admin: https://jerusalem-dorme.onrender.com/admin
Logs: https://jerusalem-dorme.onrender.com/api/logs
```

---

## Status Atual

✅ Código atualizado com `npm run build:ci`
✅ Código commitado para GitHub
✅ Pronto para Render redeploy

**Próximo passo:** Atualize Build Command no Render Dashboard para `npm run build:ci`
