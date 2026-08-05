import { Router } from "express";
import { resultStore } from "../lib/resultStore.js";

const router = Router();

// GET /api/results?since=<id>&limit=<n>
router.get("/", (req, res) => {
  const since = (req.query.since as string) || null;
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
  const results = since ? resultStore.getSince(since) : resultStore.getAll();
  res.json(results.slice(0, limit));
});

// DELETE /api/results  (clear all)
router.delete("/", (_req, res) => {
  resultStore.clear();
  res.json({ ok: true });
});

export default router;
