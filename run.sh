#!/bin/bash
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# احترم PORT من البيئة (Railway يضبطه تلقائياً)، وإلا استخدم 5000
export PORT="${PORT:-5000}"

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

# Start Node.js server in background حتى يعمل الـ trap بشكل صحيح
echo "==> Starting Node.js server on port ${PORT}..."
cd "$ROOT/web/api-server"
NODE_ENV=production node dist/index.mjs &
NODE_PID=$!

# أوقف كلا العمليتين عند خروج السكريبت (SIGINT / SIGTERM / EXIT)
trap 'echo "==> Shutting down..."; kill "$BOT_PID" "$NODE_PID" 2>/dev/null; exit' INT TERM EXIT

# انتظر Node.js — عند خروجه يُفعَّل الـ trap
wait "$NODE_PID"
