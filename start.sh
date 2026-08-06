#!/bin/bash
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# احترم PORT من البيئة، وإلا استخدم 5000
export PORT="${PORT:-5000}"

echo "==> Building frontend..."
cd "$ROOT/web/tg-web"
pnpm run build

# Start Python bot in background
echo "==> Starting Python bot..."
cd "$ROOT"
python3 "$ROOT/bot/bot.py" &
BOT_PID=$!

echo "==> Starting Node.js server on port ${PORT}..."
cd "$ROOT/web/api-server"
NODE_ENV=production node dist/index.mjs &
NODE_PID=$!

trap 'echo "==> Shutting down..."; kill "$BOT_PID" "$NODE_PID" 2>/dev/null; exit' INT TERM EXIT

wait "$NODE_PID"
