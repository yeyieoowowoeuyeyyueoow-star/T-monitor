import { Router } from "express";
import { telegramService } from "../lib/telegramService.js";

const router = Router();

// GET /api/telegram/status
router.get("/status", async (req, res) => {
  res.json(telegramService.getStatus());
});

// POST /api/telegram/send-code  { apiId, apiHash, phone }
router.post("/send-code", async (req, res) => {
  const { apiId, apiHash, phone } = req.body as {
    apiId: number;
    apiHash: string;
    phone: string;
  };
  if (!apiId || !apiHash || !phone) {
    res.status(400).json({ error: "apiId, apiHash and phone are required" });
    return;
  }
  try {
    await telegramService.sendCode(Number(apiId), apiHash, phone);
    res.json({ ok: true, state: "waiting_code" });
  } catch (err: any) {
    req.log.error({ err }, "send-code failed");
    res.status(500).json({ error: err?.message ?? "Failed to send code" });
  }
});

// POST /api/telegram/verify  { code }
router.post("/verify", async (req, res) => {
  const { code } = req.body as { code: string };
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }
  telegramService.submitCode(code);
  const { state, error } = await telegramService.waitForStateChange(
    "waiting_code",
  );
  if (error || state === "idle") {
    res.status(401).json({ error: error ?? "Invalid code — please try again" });
    return;
  }
  res.json({ ok: true, state });
});

// POST /api/telegram/verify-2fa  { password }
router.post("/verify-2fa", async (req, res) => {
  const { password } = req.body as { password: string };
  if (!password) {
    res.status(400).json({ error: "password is required" });
    return;
  }
  telegramService.submitPassword(password);
  const { state, error } = await telegramService.waitForStateChange(
    "waiting_password",
  );
  if (error || state === "idle") {
    res.status(401).json({ error: error ?? "Invalid password — please try again" });
    return;
  }
  res.json({ ok: true, state });
});

// POST /api/telegram/restore  { apiId, apiHash }
router.post("/restore", async (req, res) => {
  const { apiId, apiHash } = req.body as { apiId: number; apiHash: string };
  if (!apiId || !apiHash) {
    res.status(400).json({ error: "apiId and apiHash are required" });
    return;
  }
  try {
    const ok = await telegramService.tryRestoreSession(
      Number(apiId),
      apiHash,
    );
    res.json({ ok, state: telegramService.authState });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Restore failed" });
  }
});

// POST /api/telegram/start
router.post("/start", async (req, res) => {
  try {
    await telegramService.startMonitoring();
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "start monitoring failed");
    res.status(500).json({ error: err?.message ?? "Failed to start" });
  }
});

// POST /api/telegram/stop
router.post("/stop", async (req, res) => {
  try {
    await telegramService.stopMonitoring();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to stop" });
  }
});

// POST /api/telegram/disconnect
router.post("/disconnect", (_req, res) => {
  telegramService.disconnect();
  res.json({ ok: true });
});

export default router;
