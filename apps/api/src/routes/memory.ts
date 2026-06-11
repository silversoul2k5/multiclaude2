import { Router } from "express";
import { z } from "zod";
import { db } from "../db/database.js";
import { retrieveMemories, upsertMemory } from "../services/memory.js";

const router = Router();

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT id, scope, project_id, conversation_id, key, value, created_at, updated_at FROM memories ORDER BY updated_at DESC").all();
  res.json({ memories: rows });
});

router.post("/", (req, res) => {
  const input = z.object({
    scope: z.enum(["long-term", "project", "session"]),
    projectId: z.string().nullable().optional(),
    conversationId: z.string().nullable().optional(),
    key: z.string().min(1),
    value: z.string().min(1)
  }).parse(req.body);
  const id = upsertMemory(input);
  res.status(201).json({ id });
});

router.post("/search", (req, res) => {
  const input = z.object({
    query: z.string().min(1),
    projectId: z.string().nullable().optional(),
    conversationId: z.string().nullable().optional(),
    limit: z.number().int().min(1).max(20).optional()
  }).parse(req.body);
  res.json({ memories: retrieveMemories(input.query, input) });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM memories WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
