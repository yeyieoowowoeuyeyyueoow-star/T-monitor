#!/bin/bash
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building frontend..."
cd "$ROOT/web/tg-web"
BASE_PATH=/ npm run build

echo "==> Starting on port 5000..."
cd "$ROOT/web/api-server"
PORT=5000 node dist/index.mjs
