import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { ZodError } from "zod";
import { migrate } from "./db/database.js";
import { seedDefaults } from "./db/seed.js";
import attachmentsRouter from "./routes/attachments.js";
import conversationsRouter from "./routes/conversations.js";
import memoryRouter from "./routes/memory.js";
import providersRouter from "./routes/providers.js";

dotenv.config({ path: path.resolve(process.env.INIT_CWD ?? process.cwd(), ".env") });
dotenv.config();

migrate();
seedDefaults();

const app = express();
const port = Number(process.env.API_PORT ?? 4000);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json({ limit: "25mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ ok: true, service: "unified-ai-workspace-api" }));
app.use("/providers", providersRouter);
app.use("/conversations", conversationsRouter);
app.use("/memory", memoryRouter);
app.use("/attachments", attachmentsRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Invalid request.", details: error.flatten() });
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown server error.";
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`Unified AI Workspace API listening on http://localhost:${port}`);
});
