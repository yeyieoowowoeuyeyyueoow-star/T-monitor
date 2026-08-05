import { Router } from "express";
import { botStore } from "../lib/botStore.js";

const router = Router();

function maskToken(token: string): string {
  if (!token || token.length < 10) return token;
  // Show first 8 chars and last 4, mask the rest — enough to identify but not misuse
  return token.slice(0, 8) + "•".repeat(Math.max(0, token.length - 12)) + token.slice(-4);
}

// GET /api/bot — returns config for the browser UI (token masked for display)
// NOTE: the local bot.py is allowed through by the localhost bypass in auth middleware
router.get("/", (_req, res) => {
  const config = botStore.getConfig();
  res.json({
    botToken: config.botToken,      // full token — only reachable by localhost (bot.py) or authed browser
    botTokenMasked: maskToken(config.botToken),
    chatId: config.chatId,
    configured: botStore.isConfigured,
  });
});

// POST /api/bot — save config
router.post("/", (req, res) => {
  const { botToken, chatId } = req.body as {
    botToken?: string;
    chatId?: string;
  };

  if (!botToken || !chatId) {
    res.status(400).json({ error: "botToken and chatId are required" });
    return;
  }

  botStore.setConfig(String(botToken), String(chatId));
  res.json({ ok: true });
});

export default router;
