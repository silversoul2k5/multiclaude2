import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/database.js";

const router = Router();

router.post("/", (req, res) => {
  const input = z.object({
    conversationId: z.string(),
    messageId: z.string().nullable().optional(),
    filename: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    storagePath: z.string(),
    extractedText: z.string().nullable().optional()
  }).parse(req.body);

  const id = nanoid();
  db.prepare(`
    INSERT INTO attachments (id, conversation_id, message_id, filename, mime_type, size_bytes, storage_path, extracted_text, created_at)
    VALUES (@id, @conversationId, @messageId, @filename, @mimeType, @sizeBytes, @storagePath, @extractedText, @createdAt)
  `).run({ ...input, id, messageId: input.messageId ?? null, extractedText: input.extractedText ?? null, createdAt: new Date().toISOString() });
  res.status(201).json({ id });
});

router.get("/:conversationId", (req, res) => {
  const attachments = db.prepare("SELECT * FROM attachments WHERE conversation_id = ? ORDER BY created_at DESC").all(req.params.conversationId);
  res.json({ attachments });
});

export default router;
