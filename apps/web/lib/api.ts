import type { Conversation, MemoryItem, Message, Provider } from "../types/domain";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  listProviders: () => request<{ providers: Provider[] }>("/providers"),
  createProvider: (body: Partial<Provider> & { apiKey?: string | null }) => request<{ provider: Provider }>("/providers", { method: "POST", body: JSON.stringify(body) }),
  updateProvider: (id: string, body: Partial<Provider> & { apiKey?: string | null }) => request<{ provider: Provider }>(`/providers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  setProviderHealth: (id: string, healthy: boolean) => request<{ provider: Provider }>(`/providers/${id}/health`, { method: "POST", body: JSON.stringify({ healthy }) }),
  listConversations: (q = "") => request<{ conversations: Conversation[] }>(`/conversations?q=${encodeURIComponent(q)}`),
  createConversation: (title?: string) => request<{ conversation: Conversation; messages: Message[] }>("/conversations", { method: "POST", body: JSON.stringify({ title }) }),
  getConversation: (id: string) => request<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}`),
  sendMessage: (conversationId: string, content: string, providerId?: string | null) => request<{ message: Message; provider: Provider; providerNotice: string | null; memories: MemoryItem[] }>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, providerId })
  }),
  createBranch: (conversationId: string, parentMessageId?: string) => request(`/conversations/${conversationId}/branch`, { method: "POST", body: JSON.stringify({ parentMessageId }) }),
  exportConversation: (id: string) => request<{ conversation: Conversation; messages: Message[] }>(`/conversations/${id}/export`),
  importConversation: (body: { title: string; messages: Array<{ role: string; content: string }> }) => request<{ conversation: Conversation }>("/conversations/import", { method: "POST", body: JSON.stringify(body) }),
  listMemories: () => request<{ memories: MemoryItem[] }>("/memory"),
  createMemory: (body: Omit<MemoryItem, "id">) => request<{ id: string }>("/memory", { method: "POST", body: JSON.stringify(body) })
};
