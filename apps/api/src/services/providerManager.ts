import { db } from "../db/database.js";
import type { ChatMessage, Provider } from "../types/domain.js";

function mapProvider(row: Record<string, unknown>): Provider {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: row.kind as Provider["kind"],
    baseUrl: row.base_url ? String(row.base_url) : null,
    apiKey: row.api_key ? String(row.api_key) : null,
    model: String(row.model),
    enabled: Boolean(row.enabled),
    priority: Number(row.priority),
    healthStatus: row.health_status as Provider["healthStatus"],
    lastActiveAt: row.last_active_at ? String(row.last_active_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function listProviders(): Provider[] {
  return (db.prepare("SELECT * FROM providers ORDER BY priority ASC, created_at ASC").all() as Record<string, unknown>[]).map(mapProvider);
}

export function getProvider(id: string): Provider | null {
  const row = db.prepare("SELECT * FROM providers WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapProvider(row) : null;
}

export function getNextProvider(currentProviderId?: string | null): Provider | null {
  const providers = listProviders().filter((provider) => provider.enabled && provider.id !== currentProviderId);
  return providers.find((provider) => provider.healthStatus !== "unhealthy") ?? providers[0] ?? null;
}

export function markProviderHealth(id: string, status: Provider["healthStatus"]) {
  db.prepare("UPDATE providers SET health_status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
}

export function markProviderActive(id: string) {
  const now = new Date().toISOString();
  db.prepare("UPDATE providers SET health_status = 'healthy', last_active_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
}

export async function completeWithProvider(provider: Provider, messages: Pick<ChatMessage, "role" | "content">[]) {
  if (provider.kind === "mock") {
    const latestUser = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
    return `I am continuing with preserved workspace memory.\n\nYou said: ${latestUser}\n\nThis mock provider is ready to be replaced with any OpenAI-compatible account.`;
  }

  if (!provider.baseUrl || !provider.apiKey) {
    throw new Error("Provider is missing base URL or API key.");
  }

  const response = await fetch(`${provider.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
      temperature: 0.4
    })
  });

  if (!response.ok) {
    throw new Error(`Provider request failed with ${response.status}.`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}
