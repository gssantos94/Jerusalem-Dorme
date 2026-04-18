FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci
RUN cd frontend && npm ci && cd ..

# Build frontend
RUN npm run build:frontend

# Build backend
RUN npm run build:backend

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built backend
COPY --from=builder /app/dist ./dist

# Copy built frontend
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy public assets if any
COPY frontend/public ./frontend/public 2>/dev/null || true

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/logs', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["npm", "start"]
