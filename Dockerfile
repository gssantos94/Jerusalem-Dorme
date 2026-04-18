FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies (including devDependencies for build)
RUN npm ci && cd frontend && npm ci && cd ..

# Copy source code
COPY src ./src
COPY tsconfig.json ./
COPY frontend/src ./frontend/src
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/tsconfig.app.json ./frontend/
COPY frontend/tsconfig.node.json ./frontend/
COPY frontend/index.html ./frontend/
COPY frontend/public ./frontend/public 2>/dev/null || true

# Build frontend
RUN cd frontend && npm run build && cd ..

# Build backend
RUN npm run build:backend

# Remove devDependencies
RUN npm ci --omit=dev

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
