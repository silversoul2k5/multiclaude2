import { nanoid } from "nanoid";
import { db } from "./database.js";

export function seedDefaults() {
  const count = db.prepare("SELECT COUNT(*) as count FROM providers").get() as { count: number };
  if (count.count > 0) return;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO providers (id, name, kind, base_url, api_key, model, enabled, priority, health_status, created_at, updated_at)
    VALUES (@id, @name, @kind, @baseUrl, @apiKey, @model, @enabled, @priority, @healthStatus, @createdAt, @updatedAt)
  `).run({
    id: nanoid(),
    name: "Local Mock Provider",
    kind: "mock",
    baseUrl: null,
    apiKey: null,
    model: "mock-local",
    enabled: 1,
    priority: 1,
    healthStatus: "healthy",
    createdAt: now,
    updatedAt: now
  });
}
