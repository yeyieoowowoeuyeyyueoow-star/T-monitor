#!/bin/bash
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install JS dependencies
echo "==> Installing dependencies..."
cd "$ROOT/web"
pnpm install

# Build API server
echo "==> Building API server..."
cd "$ROOT/web/api-server"
pnpm run build

# Build frontend
echo "==> Building frontend..."
cd "$ROOT/web/tg-web"
pnpm run build

# Start Python bot in background
echo "==> Starting Python bot..."
cd "$ROOT"
python3 "$ROOT/bot/bot.py" &
BOT_PID=$!

# Kill bot when this script exits
trap 'kill "$BOT_PID" 2>/dev/null; exit' INT TERM EXIT

# Start Node.js server (foreground — keeps the process alive)
echo "==> Starting Node.js server on port 5000..."
cd "$ROOT/web/api-server"
NODE_ENV=production PORT=5000 node dist/index.mjs
