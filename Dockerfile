# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY web/package.json web/pnpm-workspace.yaml web/pnpm-lock.yaml ./web/
COPY web/api-server/package.json    ./web/api-server/
COPY web/api-client-react/package.json ./web/api-client-react/
COPY web/api-zod/package.json       ./web/api-zod/
COPY web/tg-web/package.json        ./web/tg-web/

# Install JS dependencies
RUN cd web && pnpm install --frozen-lockfile

# Copy source code
COPY web/ ./web/

# Build API server
RUN cd web/api-server && pnpm run build

# Build React frontend
RUN cd web/tg-web && pnpm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-slim

# Install Python 3 for the notification bot
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder /app/web/api-server/dist ./web/api-server/dist
COPY --from=builder /app/web/tg-web/dist     ./web/tg-web/dist

# Copy only the production node_modules needed at runtime
COPY --from=builder /app/web/node_modules    ./web/node_modules
COPY --from=builder /app/web/api-server/node_modules ./web/api-server/node_modules

# Copy bot and entrypoint
COPY bot/bot.py ./bot/bot.py
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Railway injects PORT automatically; default to 8080 as fallback
ENV NODE_ENV=production
EXPOSE 8080

CMD ["./docker-entrypoint.sh"]
