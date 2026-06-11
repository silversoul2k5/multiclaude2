# Unified AI Workspace

Self-hosted web app for connecting up to five AI providers while keeping conversation history, summaries, memories, file metadata, and retrieval data in a local database.

## Features

- Next.js 15, React, TypeScript, Tailwind CSS, dark responsive UI
- Node.js, Express, TypeScript API
- Local SQLite database by default
- Optional PostgreSQL-ready configuration placeholder via `DATABASE_URL`
- Up to 5 providers with enable/disable, priority, health, and last-active tracking
- Automatic provider failover with preserved context summary
- Unified conversations, search, import/export, markdown, code highlighting, attachments metadata, and branching
- Long-term, project, and session memories with local embeddings and vector retrieval

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. The API runs on `http://localhost:4000`.

## Configure Providers

Providers are stored locally in SQLite. Use the Providers page to add up to five accounts. For OpenAI-compatible APIs, set:

- `Base URL`: for example `https://api.openai.com`
- `API Key`: your provider key
- `Model`: for example `gpt-4.1-mini`

If no real provider is configured, the seeded local mock provider keeps the app usable for testing.

## Docker

```bash
docker compose up --build
```

SQLite data is persisted in `./data`.

## Environment Variables

- `API_PORT`: Express port, default `4000`
- `DATABASE_URL`: `file:./data/unified-ai-workspace.sqlite` by default
- `CORS_ORIGIN`: frontend origin for CORS
- `NEXT_PUBLIC_API_URL`: browser-visible API URL

## Deployment Notes

- The frontend can deploy to Vercel using `vercel.json`.
- The API needs a persistent Node host with writable storage for SQLite, or a future PostgreSQL adapter.
- For fully self-hosted deployment, Docker Compose is recommended.

## File Structure

```text
apps/
  api/      Express API, SQLite schema, providers, memory, chat orchestration
  web/      Next.js UI
data/       Local SQLite volume
.github/    CI workflow
```
