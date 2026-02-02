import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import type { RawSession, RawMessage } from "./types.js";

function getCopilotWorkspaceStorageDir(): string | null {
  const home = homedir();
  if (platform() === "win32") {
    const ap = process.env.APPDATA;
    if (!ap) return null;
    return join(ap, "Code", "User", "workspaceStorage");
  }
  if (platform() === "darwin") {
    return join(home, "Library", "Application Support", "Code", "User", "workspaceStorage");
  }
  return join(home, ".config", "Code", "User", "workspaceStorage");
}

export function ingestCopilot(): RawSession[] {
  const base = getCopilotWorkspaceStorageDir();
  if (!base || !existsSync(base)) return [];

  const sessions: RawSession[] = [];
  const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const dir of dirs) {
    const chatSessionsDir = join(base, dir.name, "chatSessions");
    if (!existsSync(chatSessionsDir)) continue;

    const files = readdirSync(chatSessionsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const path = join(chatSessionsDir, file);
      try {
        const raw = readFileSync(path, "utf-8");
        const s = parseCopilotSession(raw, dir.name);
        if (s && s.messages.length > 0) sessions.push(s);
      } catch (_e) {
        // Skip corrupted files
      }
    }
  }

  return sessions;
}

interface CopilotRequest {
  prompt?: string;
  response?: string;
  timestamp?: number;
  creationDate?: number;
  [key: string]: unknown;
}

function parseCopilotSession(json: string, workspaceHash: string): RawSession | null {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    const sessionId = (data.sessionId ?? data.id) as string | undefined;
    const creationDate = (data.creationDate ?? data.creationTime) as number | undefined;
    const requests = (data.requests ?? data.messages ?? []) as CopilotRequest[];
    if (!sessionId) return null;

    const messages: RawMessage[] = [];
    let started = creationDate ? new Date(creationDate).getTime() : Date.now();
    let last = started;

    for (const req of requests) {
      const ts = (req.timestamp ?? req.creationDate ?? req.time ?? last) as number;
      const timestamp = typeof ts === "number" ? ts : new Date(String(ts)).getTime();
      if (timestamp < started) started = timestamp;
      if (timestamp > last) last = timestamp;

      const prompt = (req.prompt ?? req.input ?? req.message ?? req.text ?? "") as string;
      if (prompt && String(prompt).trim()) {
        messages.push({ role: "user", content: String(prompt).trim(), timestamp });
      }
      const response = (req.response ?? req.output ?? req.content ?? req.text ?? "") as string;
      if (response && String(response).trim()) {
        messages.push({ role: "assistant", content: String(response).trim(), timestamp });
      }
    }

    if (messages.length === 0) return null;
    return {
      source: "copilot",
      workspace: workspaceHash,
      external_id: sessionId,
      started_at: started,
      last_at: last,
      messages,
    };
  } catch (_e) {
    return null;
  }
}
