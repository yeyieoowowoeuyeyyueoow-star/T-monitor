import { Router } from "express";
import { keywordStore } from "../lib/keywordStore.js";

const router = Router();

// GET /api/keywords
router.get("/", (_req, res) => {
  res.json(keywordStore.getAll());
});

// POST /api/keywords  { text }
router.post("/", (req, res) => {
  const { text } = req.body as { text: string };
  if (!text?.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const kw = keywordStore.add(text);
  if (!kw) {
    res.status(409).json({ error: "Keyword already exists" });
    return;
  }
  const { id, text: t, enabled } = kw;
  res.status(201).json({ id, text: t, enabled });
});

// PATCH /api/keywords/:id  { text?, enabled? }
router.patch("/:id", (req, res) => {
  const { id } = req.params;
  const changes = req.body as { text?: string; enabled?: boolean };
  const kw = keywordStore.update(id, changes);
  if (!kw) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ id: kw.id, text: kw.text, enabled: kw.enabled });
});

// DELETE /api/keywords/:id
router.delete("/:id", (req, res) => {
  const ok = keywordStore.remove(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
