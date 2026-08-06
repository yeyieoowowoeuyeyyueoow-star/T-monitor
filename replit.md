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
5. Start the Express server (serves both API and built frontend)

## Required secrets

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | Signs session cookies |
| `DASHBOARD_PASSWORD` | Password for the web dashboard login |

## Optional environment variables (Railway / Docker)

| Variable | Purpose |
|---|---|
| `PORT` | Port for the server (Railway sets this automatically — default: 5000 locally, 8080 on Railway) |
| `BOT_TOKEN` | Telegram Bot Token (بديل عن الإعداد من الواجهة — لا يضيع عند Restart) |
| `BOT_CHAT_ID` | Telegram Chat ID (نفس الغرض) |

> **ملاحظة Railway:** إذا أضفت `BOT_TOKEN` و`BOT_CHAT_ID` كـ Variables في Railway، لن تحتاج لإعادة إعداد البوت بعد كل Restart.

## First-time setup after launch

1. Open the app and log in with `DASHBOARD_PASSWORD`
2. Enter your Telegram **API_ID** and **API_HASH** (from [my.telegram.org](https://my.telegram.org)) via the dashboard wizard
3. Complete the phone-number login flow in the dashboard

## Data persistence

- Keywords and results are stored in `~/.tg-monitor-*.json` files.
- On Railway/Docker without a mounted volume, these files reset on every container restart.
- **Recommended:** add a Railway Volume mounted at `/root` to preserve all data between restarts.
- Bot config (`BOT_TOKEN` / `BOT_CHAT_ID`) can alternatively be set as environment variables to survive restarts.

## Notes

- The Python bot polls the local API every 2 seconds and sends Telegram Bot API notifications.
- On first start, the bot skips old messages to avoid flooding the chat.
- Notifications are retried up to 3 times with exponential backoff on failure.
- The `last_id` cursor only advances on successful sends — failed messages are retried next poll.

## User preferences
