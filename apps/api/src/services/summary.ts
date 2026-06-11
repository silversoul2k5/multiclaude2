import type { ChatMessage } from "../types/domain.js";

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function generateSummary(messages: Pick<ChatMessage, "role" | "content">[], memories: string[] = []): string {
  const recent = messages.slice(-18);
  const facts = memories.length ? `Relevant memory:\n${memories.map((item) => `- ${item}`).join("\n")}\n\n` : "";
  const transcript = recent
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n")
    .slice(-5000);

  return `${facts}Conversation state summary:\n${transcript}`;
}
