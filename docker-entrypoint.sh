#!/bin/bash
set -e

# Railway sets $PORT automatically (usually 8080).
# Fall back to 8080 if not set.
export PORT="${PORT:-8080}"

# Start Python notification bot in background
# (waits for the Node server to be ready before polling)
python3 /app/bot/bot.py &
BOT_PID=$!

echo "==> Starting Node.js server on port ${PORT}..."

# شغّل Node في الخلفية حتى يعمل الـ trap عند SIGTERM
node /app/web/api-server/dist/index.mjs &
NODE_PID=$!

# أوقف كلا العمليتين عند استقبال إشارة إيقاف
trap 'echo "==> Shutting down..."; kill "$BOT_PID" "$NODE_PID" 2>/dev/null; wait; exit' INT TERM EXIT

# انتظر Node — عند خروجه يُفعَّل الـ trap ويُوقف البوت أيضاً
wait "$NODE_PID"
