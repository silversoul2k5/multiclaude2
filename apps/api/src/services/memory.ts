import { nanoid } from "nanoid";
import { db } from "../db/database.js";
import { cosineSimilarity, embedText } from "./embedding.js";
import type { MemoryScope } from "../types/domain.js";

export function upsertMemory(input: {
  id?: string;
  scope: MemoryScope;
  projectId?: string | null;
  conversationId?: string | null;
  key: string;
  value: string;
}) {
  const now = new Date().toISOString();
  const payload = {
    id: input.id ?? nanoid(),
    scope: input.scope,
    projectId: input.projectId ?? null,
    conversationId: input.conversationId ?? null,
    key: input.key,
    value: input.value,
    embedding: JSON.stringify(embedText(`${input.key}\n${input.value}`)),
    createdAt: now,
    updatedAt: now
  };

  db.prepare(`
    INSERT INTO memories (id, scope, project_id, conversation_id, key, value, embedding, created_at, updated_at)
    VALUES (@id, @scope, @projectId, @conversationId, @key, @value, @embedding, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      scope = excluded.scope,
      project_id = excluded.project_id,
      conversation_id = excluded.conversation_id,
      key = excluded.key,
      value = excluded.value,
      embedding = excluded.embedding,
      updated_at = excluded.updated_at
  `).run(payload);

  return payload.id;
}

export function retrieveMemories(query: string, options: { projectId?: string | null; conversationId?: string | null; limit?: number }) {
  const rows = db.prepare(`
    SELECT * FROM memories
    WHERE project_id IS NULL OR project_id = @projectId OR conversation_id = @conversationId
  `).all({
    projectId: options.projectId ?? null,
    conversationId: options.conversationId ?? null
  }) as Array<{ id: string; scope: string; key: string; value: string; embedding: string }>;

  const queryEmbedding = embedText(query);
  return rows
    .map((row) => ({
      ...row,
      score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding) as number[])
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 6);
}
