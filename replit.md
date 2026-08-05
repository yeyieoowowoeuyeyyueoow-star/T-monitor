# TG Monitor

A Telegram group monitoring dashboard. Monitor multiple Telegram groups for keywords, view matched results, and receive Telegram Bot notifications.

## Stack

- **Frontend**: React + Vite + Tailwind CSS (`web/tg-web`)
- **API server**: Express + Node.js, built with esbuild (`web/api-server`)
- **Notification bot**: Python 3 (`bot/bot.py`) — polls the API and sends alerts via Telegram Bot API
- **Package manager**: pnpm workspace (`web/`)

## How to run

The workflow `Start application` runs `bash run.sh`, which:
1. Installs pnpm dependencies (`web/`)
2. Builds the API server (`web/api-server`)
3. Builds the React frontend (`web/tg-web`)
4. Starts the Python notification bot in the background
5. Starts the Node.js API server on **port 5000** (serves both API and built frontend)

## First-time setup

1. Open the app and enter your Telegram **API_ID** and **API_HASH** (get them at [my.telegram.org](https://my.telegram.org))
2. Follow the 4-step wizard to authenticate your Telegram account
3. Add keywords and groups to monitor from the dashboard
4. Optionally configure the Telegram Bot notifier in Settings (requires a bot token + chat ID)

## Environment secrets

| Secret | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | Yes (set) | Signs authentication cookies |
| `DASHBOARD_PASSWORD` | Optional | Password-protects the dashboard UI |

## User preferences
