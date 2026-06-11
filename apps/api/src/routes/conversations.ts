import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/database.js";
import { retrieveMemories, upsertMemory } from "../services/memory.js";
import { completeWithProvider, getNextProvider, getProvider, markProviderActive, markProviderHealth } from "../services/providerManager.js";
import { estimateTokens, generateSummary } from "../services/summary.js";
import type { ChatMessage } from "../types/domain.js";

const router = Router();

function mapMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    branchId: String(row.branch_id),
    providerId: row.provider_id ? String(row.provider_id) : null,
    role: row.role as ChatMessage["role"],
    content: String(row.content),
    metadata: JSON.parse(String(row.metadata ?? "{}")) as Record<string, unknown>,
    createdAt: String(row.created_at)
  };
}

function getMessages(conversationId: string, branchId: string) {
  return (db.prepare(`
    SELECT * FROM messages WHERE conversation_id = ? AND branch_id = ? ORDER BY created_at ASC
  `).all(conversationId, branchId) as Record<string, unknown>[]).map(mapMessage);
}

function getConversation(id: string) {
  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
}

function insertMessage(input: Omit<ChatMessage, "createdAt">) {
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO messages (id, conversation_id, branch_id, provider_id, role, content, metadata, created_at)
    VALUES (@id, @conversationId, @branchId, @providerId, @role, @content, @metadata, @createdAt)
  `).run({ ...input, metadata: JSON.stringify(input.metadata), createdAt });
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(createdAt, input.conversationId);
  return { ...input, createdAt };
}

function saveSummary(conversationId: string, branchId: string, messages: ChatMessage[], extraMemories: string[] = []) {
  const summary = generateSummary(messages, extraMemories);
  db.prepare(`
    INSERT INTO summaries (id, conversation_id, branch_id, summary, token_estimate, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(nanoid(), conversationId, branchId, summary, estimateTokens(summary), new Date().toISOString());
  return summary;
}

router.get("/", (req, res) => {
  const query = String(req.query.q ?? "").trim();
  const rows = db.prepare(`
    SELECT c.*, (
      SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
    ) as preview
    FROM conversations c
    WHERE @query = '' OR c.title LIKE @like OR preview LIKE @like
    ORDER BY c.updated_at DESC
  `).all({ query, like: `%${query}%` });
  res.json({ conversations: rows });
});

router.post("/", (req, res) => {
  const title = z.object({ title: z.string().optional(), projectId: z.string().nullable().optional() }).parse(req.body);
  const now = new Date().toISOString();
  const conversationId = nanoid();
  const branchId = nanoid();

  db.prepare(`
    INSERT INTO conversations (id, title, active_branch_id, project_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(conversationId, title.title ?? "New conversation", branchId, title.projectId ?? null, now, now);
  db.prepare("INSERT INTO branches (id, conversation_id, title, created_at) VALUES (?, ?, ?, ?)").run(branchId, conversationId, "Main", now);
  res.status(201).json({ conversation: getConversation(conversationId), messages: [] });
});

router.get("/:id", (req, res) => {
  const conversation = getConversation(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  res.json({ conversation, messages: getMessages(req.params.id, String(conversation.active_branch_id)) });
});

router.post("/:id/messages", async (req, res, next) => {
  try {
    const input = z.object({
      content: z.string().min(1),
      providerId: z.string().nullable().optional()
    }).parse(req.body);

    const conversation = getConversation(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const conversationId = String(conversation.id);
    const branchId = String(conversation.active_branch_id);
    const userMessage = insertMessage({
      id: nanoid(),
      conversationId,
      branchId,
      providerId: null,
      role: "user",
      content: input.content,
      metadata: {}
    });

    const memories = retrieveMemories(input.content, {
      projectId: conversation.project_id ? String(conversation.project_id) : null,
      conversationId,
      limit: 5
    });
    const history = getMessages(conversationId, branchId);
    const summary = saveSummary(conversationId, branchId, history, memories.map((memory) => `${memory.key}: ${memory.value}`));

    const systemContext: Pick<ChatMessage, "role" | "content"> = {
      role: "system",
      content: `Use this provider-independent memory layer to continue seamlessly.\n\n${summary}`
    };

    let provider = input.providerId ? getProvider(input.providerId) : getNextProvider(null);
    if (!provider || !provider.enabled) {
      provider = getNextProvider(input.providerId);
    }
    if (!provider) {
      res.status(400).json({ error: "No enabled provider is available." });
      return;
    }

    let switched = false;
    let providerNotice: string | null = null;
    let assistantContent = "";

    try {
      assistantContent = await completeWithProvider(provider, [systemContext, ...history]);
      markProviderActive(provider.id);
    } catch (_error) {
      markProviderHealth(provider.id, "unhealthy");
      const fallback = getNextProvider(provider.id);
      if (!fallback) throw _error;
      switched = true;
      provider = fallback;
      providerNotice = "Provider switched. Conversation context preserved.";
      assistantContent = await completeWithProvider(provider, [systemContext, ...history]);
      markProviderActive(provider.id);
    }

    const assistantMessage = insertMessage({
      id: nanoid(),
      conversationId,
      branchId,
      providerId: provider.id,
      role: "assistant",
      content: assistantContent,
      metadata: { switched, providerNotice }
    });

    upsertMemory({
      scope: "session",
      conversationId,
      key: `latest:${userMessage.id}`,
      value: `User asked: ${input.content}\nAssistant answered: ${assistantContent.slice(0, 1000)}`
    });

    res.json({
      message: assistantMessage,
      provider: { ...provider, apiKey: provider.apiKey ? "********" : null },
      providerNotice,
      memories
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/branch", (req, res) => {
  const input = z.object({ parentMessageId: z.string().nullable().optional(), title: z.string().optional() }).parse(req.body);
  const conversation = getConversation(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  const now = new Date().toISOString();
  const branchId = nanoid();
  db.prepare("INSERT INTO branches (id, conversation_id, parent_message_id, title, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(branchId, req.params.id, input.parentMessageId ?? null, input.title ?? "Branch", now);
  db.prepare("UPDATE conversations SET active_branch_id = ?, updated_at = ? WHERE id = ?").run(branchId, now, req.params.id);
  res.status(201).json({ branch: { id: branchId, conversationId: req.params.id, title: input.title ?? "Branch" } });
});

router.get("/:id/export", (req, res) => {
  const conversation = getConversation(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found." });
    return;
  }
  const branchId = String(conversation.active_branch_id);
  res.json({ conversation, messages: getMessages(req.params.id, branchId) });
});

router.post("/import", (req, res) => {
  const input = z.object({
    title: z.string(),
    messages: z.array(z.object({ role: z.enum(["system", "user", "assistant", "tool"]), content: z.string() }))
  }).parse(req.body);
  const now = new Date().toISOString();
  const conversationId = nanoid();
  const branchId = nanoid();
  db.prepare("INSERT INTO conversations (id, title, active_branch_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(conversationId, input.title, branchId, now, now);
  db.prepare("INSERT INTO branches (id, conversation_id, title, created_at) VALUES (?, ?, ?, ?)")
    .run(branchId, conversationId, "Imported", now);
  for (const message of input.messages) {
    insertMessage({ id: nanoid(), conversationId, branchId, providerId: null, role: message.role, content: message.content, metadata: { imported: true } });
  }
  res.status(201).json({ conversation: getConversation(conversationId) });
});

export default router;
