import { Router } from "express";
import { resultStore } from "../lib/resultStore.js";

const router = Router();

// GET /api/results?since=<id>&limit=<n>&enrichedOnly=true
router.get("/", (req, res) => {
  const since       = (req.query.since as string) || null;
  const limit       = Math.min(parseInt((req.query.limit as string) || "50", 10), 200);
  const enrichedOnly = req.query.enrichedOnly === "true";

  let results = since ? resultStore.getSince(since) : resultStore.getAll();

  if (enrichedOnly) {
    const cutoff = Date.now() - 20_000; // fallback: return anyway if stuck for >20s
    results = results.filter(
      (r) => r.enriched || new Date(r.timestamp).getTime() < cutoff,
    );
  }

  res.json(results.slice(0, limit));
});

// DELETE /api/results  (clear all)
router.delete("/", (_req, res) => {
  resultStore.clear();
  res.json({ ok: true });
});

export default router;
