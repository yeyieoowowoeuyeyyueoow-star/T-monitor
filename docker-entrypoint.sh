#!/bin/bash
set -e

# Railway sets $PORT automatically (usually 8080).
# Fall back to 8080 if not set.
export PORT="${PORT:-8080}"

# Start Python notification bot in background
# (waits for the Node server to be ready before polling)
python3 /app/bot/bot.py &
BOT_PID=$!

# Kill bot when this script exits
trap 'kill "$BOT_PID" 2>/dev/null; exit' INT TERM EXIT

echo "==> Starting Node.js server on port $PORT..."
exec node /app/web/api-server/dist/index.mjs
