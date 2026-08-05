import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, "0.0.0.0");

server.on("error", (err) => {
  logger.error({ err }, "Server failed to start");
  process.exit(1);
});

server.on("listening", () => {
  logger.info({ port }, "Server listening");
});

// Graceful shutdown — cleanly close open connections
const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
