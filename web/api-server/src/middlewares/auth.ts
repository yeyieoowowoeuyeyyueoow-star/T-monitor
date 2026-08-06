/**
 * Authentication middleware
 * - Requests from localhost (bot.py) bypass auth automatically
 * - All other requests require a signed session cookie set by POST /api/auth/login
 */
import { Request, Response, NextFunction } from "express";

const COOKIE_NAME = "tgm_auth";

/** Routes accessible without auth even from the browser */
const PUBLIC_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/status",
  "/api/health",
  "/api/healthz",
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
