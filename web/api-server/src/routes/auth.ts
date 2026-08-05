import { Router } from "express";
import { COOKIE_NAME } from "../middlewares/auth.js";

const router = Router();

const DASHBOARD_PASSWORD = process.env["DASHBOARD_PASSWORD"] ?? "";

if (!DASHBOARD_PASSWORD) {
  console.warn(
    "[auth] ⚠️  DASHBOARD_PASSWORD env var is not set — dashboard is unprotected from the browser! Set it to enable password protection.",
  );
}

// GET /api/auth/status
router.get("/status", (req, res) => {
  const cookie = (req as any).signedCookies?.[COOKIE_NAME];
  const fromLocal =
    (req.ip ?? "") === "127.0.0.1" ||
    (req.ip ?? "") === "::1" ||
    (req.ip ?? "") === "::ffff:127.0.0.1";
  res.json({ authenticated: cookie === "1" || fromLocal || !DASHBOARD_PASSWORD });
});

// POST /api/auth/login  { password }
router.post("/login", (req, res) => {
  if (!DASHBOARD_PASSWORD) {
    // No password configured — auto-allow
    res.cookie(COOKIE_NAME, "1", {
      signed: true,
      httpOnly: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.json({ ok: true });
    return;
  }

  const { password } = req.body as { password?: string };
  if (!password || password !== DASHBOARD_PASSWORD) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  res.cookie(COOKIE_NAME, "1", {
    signed: true,
    httpOnly: true,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  res.json({ ok: true });
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

export default router;
