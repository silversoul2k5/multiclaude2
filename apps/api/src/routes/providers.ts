import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/database.js";
import { getProvider, listProviders, markProviderHealth } from "../services/providerManager.js";

const router = Router();

const providerSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["openai-compatible", "mock"]).default("openai-compatible"),
  baseUrl: z.string().url().nullable().optional(),
  apiKey: z.string().nullable().optional(),
  model: z.string().min(1),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1).max(5)
});

router.get("/", (_req, res) => {
  res.json({ providers: listProviders().map((provider) => ({ ...provider, apiKey: provider.apiKey ? "********" : null })) });
});

router.post("/", (req, res) => {
  const existing = listProviders();
  if (existing.length >= 5) {
    res.status(400).json({ error: "You can configure up to 5 providers." });
    return;
  }

  const input = providerSchema.parse(req.body);
  const now = new Date().toISOString();
  const id = nanoid();

  db.prepare(`
    INSERT INTO providers (id, name, kind, base_url, api_key, model, enabled, priority, health_status, created_at, updated_at)
    VALUES (@id, @name, @kind, @baseUrl, @apiKey, @model, @enabled, @priority, 'unknown', @createdAt, @updatedAt)
  `).run({
    id,
    name: input.name,
    kind: input.kind,
    baseUrl: input.baseUrl ?? null,
    apiKey: input.apiKey ?? null,
    model: input.model,
    enabled: input.enabled ? 1 : 0,
    priority: input.priority,
    createdAt: now,
    updatedAt: now
  });

  res.status(201).json({ provider: { ...getProvider(id), apiKey: input.apiKey ? "********" : null } });
});

router.patch("/:id", (req, res) => {
  const current = getProvider(req.params.id);
  if (!current) {
    res.status(404).json({ error: "Provider not found." });
    return;
  }

  const input = providerSchema.partial().parse(req.body);
  const next = { ...current, ...input };
  db.prepare(`
    UPDATE providers
    SET name = @name, kind = @kind, base_url = @baseUrl, api_key = COALESCE(@apiKey, api_key),
        model = @model, enabled = @enabled, priority = @priority, updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id: current.id,
    name: next.name,
    kind: next.kind,
    baseUrl: next.baseUrl ?? null,
    apiKey: input.apiKey ?? null,
    model: next.model,
    enabled: next.enabled ? 1 : 0,
    priority: next.priority,
    updatedAt: new Date().toISOString()
  });

  res.json({ provider: { ...getProvider(current.id), apiKey: "********" } });
});

router.post("/:id/health", (req, res) => {
  const provider = getProvider(req.params.id);
  if (!provider) {
    res.status(404).json({ error: "Provider not found." });
    return;
  }

  markProviderHealth(provider.id, req.body?.healthy === false ? "unhealthy" : "healthy");
  res.json({ provider: { ...getProvider(provider.id), apiKey: provider.apiKey ? "********" : null } });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM providers WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
