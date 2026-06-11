export type ProviderKind = "openai-compatible" | "mock";
export type MemoryScope = "long-term" | "project" | "session";
export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Provider {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string | null;
  apiKey: string | null;
  model: string;
  enabled: boolean;
  priority: number;
  healthStatus: "unknown" | "healthy" | "unhealthy";
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  branchId: string;
  providerId: string | null;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  activeBranchId: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryItem {
  id: string;
  scope: MemoryScope;
  projectId: string | null;
  conversationId: string | null;
  key: string;
  value: string;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
}
