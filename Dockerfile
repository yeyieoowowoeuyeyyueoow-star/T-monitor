# Single-stage build — avoids pnpm symlink issues with multi-stage COPY
FROM node:20-slim

# Install Python 3 for the notification bot + curl for debugging
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 curl && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests first (layer cache)
COPY web/package.json          ./web/
COPY web/pnpm-workspace.yaml   ./web/
COPY web/pnpm-lock.yaml        ./web/
COPY web/api-server/package.json   ./web/api-server/
COPY web/api-client-react/package.json ./web/api-client-react/
COPY web/api-zod/package.json  ./web/api-zod/
COPY web/tg-web/package.json   ./web/tg-web/

# Install all dependencies (includes devDeps needed to build)
RUN cd web && pnpm install --frozen-lockfile

# Copy source code
COPY web/ ./web/
COPY bot/ ./bot/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Build API server and frontend
RUN cd web/api-server && pnpm run build
RUN cd web/tg-web    && pnpm run build

ENV NODE_ENV=production

EXPOSE 8080

CMD ["./docker-entrypoint.sh"]
