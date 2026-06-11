export interface Provider {
  id: string;
  name: string;
  kind: "openai-compatible" | "mock";
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  enabled: boolean;
  priority: number;
  healthStatus: "unknown" | "healthy" | "unhealthy";
  lastActiveAt: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  active_branch_id: string;
  project_id: string | null;
  updated_at: string;
  preview?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  branchId: string;
  providerId: string | null;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MemoryItem {
  id: string;
  scope: "long-term" | "project" | "session";
  key: string;
  value: string;
  score?: number;
}
