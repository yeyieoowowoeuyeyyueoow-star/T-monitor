/**
 * Authentication middleware
 * - Requests from localhost (bot.py) bypass auth automatically
 * - All other requests require a signed session cookie set by POST /api/auth/login
 */
import { Request, Response, NextFunction } from "express";

const COOKIE_NAME = "tgm_auth";

/**
 * Routes accessible without auth even from the browser.
 * NOTE: Express strips the "/api" mount prefix from req.path inside
 * app.use("/api", requireAuth), so paths here must NOT include "/api".
 */
const PUBLIC_PATHS = new Set([
  "/auth/login",
  "/auth/status",
  "/healthz",
]);

function isLocalRequest(req: Request): boolean {
  const ip = req.ip ?? req.socket.remoteAddress ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Always allow local bot.py calls
  if (isLocalRequest(req)) return next();

  // Allow public paths
  if (PUBLIC_PATHS.has(req.path)) return next();

  // Check signed session cookie
  const cookie = (req as any).signedCookies?.[COOKIE_NAME];
  if (cookie === "1") return next();

  res.status(401).json({ error: "Unauthorized" });
}

export { COOKIE_NAME };
