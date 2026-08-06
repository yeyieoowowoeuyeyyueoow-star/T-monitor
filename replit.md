# TG Monitor

A Telegram keyword monitoring dashboard. Watch groups/channels for keywords and get notified via a Telegram bot.

## Stack

- **Frontend**: React + Vite + Tailwind CSS (`web/tg-web/`)
- **API server**: Node.js + Express + TypeScript (`web/api-server/`)
- **Notification bot**: Python (`bot/bot.py`)
- **Package manager**: pnpm (workspace rooted at `web/`)

## How to run

The single `run.sh` script handles everything:

```bash
bash run.sh
```

It will:
1. Install JS dependencies (`pnpm install` in `web/`)
2. Build the API server (`web/api-server`)
3. Build the React frontend (`web/tg-web`)
4. Start the Python notification bot in the background
5. Start the Express server on **port 5000** (serves both API and built frontend)

## Required secrets

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | Signs session cookies |
| `DASHBOARD_PASSWORD` | Password for the web dashboard login |

## First-time setup after launch

1. Open the app and log in with `DASHBOARD_PASSWORD`
2. Enter your Telegram **API_ID** and **API_HASH** (from [my.telegram.org](https://my.telegram.org)) via the dashboard wizard
3. Complete the phone-number login flow in the dashboard

## Notes

- Data (keywords, results) is stored in-memory inside the container and is lost on restart. A persistent storage solution (file or database) would be a useful addition.
- The Python bot polls the local API every 2 seconds and sends Telegram Bot API notifications.

## User preferences

