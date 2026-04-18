#!/bin/bash
set -e

echo "=== Jerusalem Dorme Build Script ==="
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo ""

# Step 1: Install root dependencies (including devDependencies)
echo "📦 Installing root dependencies..."
npm install

# Step 2: Build frontend with Vite
echo ""
echo "🔨 Building frontend with Vite..."
cd frontend
npm install
npx vite build
cd ..

# Step 3: Build backend with TypeScript
echo ""
echo "🔨 Building backend with TypeScript..."
npx tsc

echo ""
echo "✅ Build complete!"
ls -lah dist/
ls -lah frontend/dist/
