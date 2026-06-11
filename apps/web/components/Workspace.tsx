"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { Bot, Boxes, Download, GitBranch, MemoryStick, Plus, Search, Send, UploadCloud, WifiOff } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import type { Conversation, MemoryItem, Message, Provider } from "../types/domain";
import { MarkdownMessage } from "./MarkdownMessage";

export function Workspace() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const [providerResult, conversationResult, memoryResult] = await Promise.all([
      api.listProviders(),
      api.listConversations(query),
      api.listMemories()
    ]);
    setProviders(providerResult.providers);
    setConversations(conversationResult.conversations);
    setMemories(memoryResult.memories);
    setActiveProviderId((current) => current ?? providerResult.providers.find((provider) => provider.enabled)?.id ?? null);
  }

  useEffect(() => {
    refresh().catch((refreshError) => setError(refreshError.message));
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      api.listConversations(query).then((result) => setConversations(result.conversations)).catch((searchError) => setError(searchError.message));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function openConversation(id: string) {
    const result = await api.getConversation(id);
    setActiveConversation(result.conversation);
    setMessages(result.messages);
    setNotice(null);
  }

  async function createConversation() {
    const result = await api.createConversation("Untitled workspace thread");
    setActiveConversation(result.conversation);
    setMessages([]);
    await refresh();
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!composer.trim()) return;

    let conversation = activeConversation;
    if (!conversation) {
      const created = await api.createConversation(composer.slice(0, 54));
      conversation = created.conversation;
      setActiveConversation(conversation);
    }

    const optimistic: Message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      branchId: conversation.active_branch_id,
      providerId: null,
      role: "user",
      content: composer,
      metadata: {},
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, optimistic]);
    setComposer("");
    setNotice(null);
    setError(null);

    startTransition(async () => {
      try {
        const result = await api.sendMessage(conversation.id, optimistic.content, activeProviderId);
        setMessages((current) => [...current.filter((message) => message.id !== optimistic.id), optimistic, result.message]);
        setActiveProviderId(result.provider.id);
        setNotice(result.providerNotice);
        await refresh();
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : "Could not send message.");
      }
    });
  }

  async function exportActiveConversation() {
    if (!activeConversation) return;
    const exported = await api.exportConversation(activeConversation.id);
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeConversation.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as { conversation?: Conversation; messages?: Message[]; title?: string };
    const imported = await api.importConversation({
      title: parsed.conversation?.title ?? parsed.title ?? file.name,
      messages: (parsed.messages ?? []).map((message) => ({ role: message.role, content: message.content }))
    });
    await refresh();
    await openConversation(imported.conversation.id);
  }

  async function addMemory(scope: MemoryItem["scope"]) {
    const key = window.prompt(`Memory key for ${scope}`);
    const value = key ? window.prompt("Memory value") : null;
    if (!key || !value) return;
    await api.createMemory({ scope, key, value });
    await refresh();
  }

  async function addProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.createProvider({
      name: String(form.get("name")),
      kind: "openai-compatible",
      baseUrl: String(form.get("baseUrl")),
      apiKey: String(form.get("apiKey")),
      model: String(form.get("model")),
      enabled: true,
      priority: Math.min(providers.length + 1, 5)
    });
    event.currentTarget.reset();
    await refresh();
  }

  return (
    <main className="min-h-screen p-3 text-ink md:p-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[19rem_minmax(0,1fr)_20rem]">
        <aside className="glass rounded-[2rem] p-4">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.36em] text-moss">Self-hosted</p>
            <h1 className="font-display text-3xl leading-tight">Unified AI Workspace</h1>
          </div>

          <button onClick={createConversation} className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-ember px-4 py-3 font-semibold text-black transition hover:brightness-110">
            <Plus size={18} /> New conversation
          </button>

          <label className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
            <Search size={16} className="text-moss" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40" />
          </label>

          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => openConversation(conversation.id)}
                className={clsx("w-full rounded-2xl border p-3 text-left transition", activeConversation?.id === conversation.id ? "border-ember/70 bg-ember/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]")}
              >
                <p className="truncate font-medium">{conversation.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink/55">{conversation.preview ?? "No messages yet"}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="glass flex min-h-[78vh] flex-col overflow-hidden rounded-[2rem]">
          <header className="border-b border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-moss">Persistent conversation layer</p>
                <h2 className="font-display text-2xl">{activeConversation?.title ?? "Memory-first chat"}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={() => activeConversation && api.createBranch(activeConversation.id, messages.at(-1)?.id).then(() => openConversation(activeConversation.id))} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
                  <GitBranch size={16} />
                </button>
                <button onClick={exportActiveConversation} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
                  <Download size={16} />
                </button>
                <label className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/10">
                  <UploadCloud size={16} />
                  <input type="file" accept="application/json" className="hidden" onChange={(event) => importFile(event.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
            {notice ? <p className="mt-3 rounded-2xl border border-moss/40 bg-moss/10 px-4 py-2 text-sm text-moss">{notice}</p> : null}
            {error ? <p className="mt-3 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</p> : null}
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div className="max-w-md">
                  <Bot className="mx-auto mb-4 text-ember" size={42} />
                  <h3 className="font-display text-3xl">Bring any provider. Keep one memory.</h3>
                  <p className="mt-3 text-ink/65">Switch accounts midstream, survive outages, and keep the thread grounded in locally stored context.</p>
                </div>
              </div>
            ) : messages.map((message) => (
              <div key={message.id} className={clsx("rounded-[1.5rem] border p-4", message.role === "user" ? "ml-auto max-w-[88%] border-ember/30 bg-ember/10" : "mr-auto max-w-[92%] border-white/10 bg-black/24")}>
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-ink/45">{message.role}</div>
                <MarkdownMessage content={message.content} />
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="border-t border-white/10 p-4">
            <div className="flex gap-2 rounded-[1.5rem] border border-white/10 bg-black/30 p-2">
              <textarea value={composer} onChange={(event) => setComposer(event.target.value)} placeholder="Ask, continue, paste code, or describe the project state..." rows={2} className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 outline-none placeholder:text-ink/35" />
              <button disabled={isPending} className="rounded-2xl bg-moss px-4 text-black transition hover:brightness-110 disabled:opacity-50">
                <Send size={18} />
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="glass rounded-[2rem] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl">Providers</h2>
              <Boxes size={18} className="text-moss" />
            </div>
            <div className="space-y-2">
              {providers.map((provider) => (
                <div key={provider.id} className={clsx("rounded-2xl border p-3", activeProviderId === provider.id ? "border-ember/60 bg-ember/10" : "border-white/10 bg-white/[0.03]")}>
                  <button onClick={() => setActiveProviderId(provider.id)} className="w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{provider.name}</span>
                      <span className={clsx("rounded-full px-2 py-1 text-[0.65rem]", provider.healthStatus === "healthy" ? "bg-moss/20 text-moss" : provider.healthStatus === "unhealthy" ? "bg-red-500/20 text-red-200" : "bg-white/10 text-ink/60")}>{provider.healthStatus}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink/55">P{provider.priority} · {provider.model}</p>
                  </button>
                  <button onClick={() => api.setProviderHealth(provider.id, provider.healthStatus === "unhealthy").then(refresh)} className="mt-2 flex items-center gap-1 text-xs text-ink/55 hover:text-ink">
                    <WifiOff size={13} /> Toggle health
                  </button>
                </div>
              ))}
            </div>
            {providers.length < 5 ? (
              <form onSubmit={addProvider} className="mt-4 space-y-2">
                <input name="name" required placeholder="Provider name" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none" />
                <input name="baseUrl" required placeholder="https://api.provider.com" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none" />
                <input name="apiKey" required placeholder="API key" type="password" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none" />
                <input name="model" required placeholder="Model" className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none" />
                <button className="w-full rounded-xl border border-moss/40 px-3 py-2 text-sm text-moss hover:bg-moss/10">Add provider</button>
              </form>
            ) : null}
          </section>

          <section className="glass rounded-[2rem] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl">Memory</h2>
              <MemoryStick size={18} className="text-ember" />
            </div>
            <div className="mb-3 flex gap-2">
              {(["long-term", "project", "session"] as const).map((scope) => (
                <button key={scope} onClick={() => addMemory(scope)} className="rounded-xl border border-white/10 px-2 py-1 text-xs hover:bg-white/10">{scope}</button>
              ))}
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {memories.slice(0, 12).map((memory) => (
                <div key={memory.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-moss">{memory.scope}</p>
                  <p className="font-medium">{memory.key}</p>
                  <p className="mt-1 line-clamp-3 text-sm text-ink/60">{memory.value}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
