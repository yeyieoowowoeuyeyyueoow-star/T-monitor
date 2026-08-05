import express, { type Express } from "express";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import os from "node:os";
import router from "./routes";
import { logger } from "./lib/logger";
import { requireAuth } from "./middlewares/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = join(__dirname, "..", "..", "tg-web", "dist", "public");

// SESSION_SECRET is required for signed cookies
const SESSION_SECRET = process.env["SESSION_SECRET"];
if (!SESSION_SECRET) {
  logger.warn("SESSION_SECRET env var is not set — cookie signing will be weak");
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET ?? "fallback-secret-change-me"));

// Temporary file download route (no auth required)
const ZIP_PATH = join(os.homedir(), "..", "runner", "workspace", "tg-monitor.zip");
const ZIP_PATH2 = "/home/runner/workspace/tg-monitor.zip";
app.get("/download/tg-monitor.zip", (_req, res) => {
  const p = existsSync(ZIP_PATH2) ? ZIP_PATH2 : ZIP_PATH;
  if (!existsSync(p)) { res.status(404).send("File not found"); return; }
  res.download(p, "tg-monitor.zip");
});

// Auth guard — protects all /api/* except /api/auth/* and localhost
app.use("/api", requireAuth);

// API routes
app.use("/api", router);

// Serve built frontend (SPA)
if (existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  // All non-API routes → index.html (Express 5 wildcard syntax)
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(join(STATIC_DIR, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.status(503).send("Frontend not built yet. Run: pnpm --filter tg-web build");
  });
}

export default app;
