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
  role?: string;
  content?: unknown;
  messages?: unknown;
  message?: unknown;
  [key: string]: unknown;
}

const COPILOT_SKIP_KINDS = new Set([
  "mcpServersStarting",
  "progressTaskSerialized",
  "thinking",
  "prepareToolInvocation",
  "toolInvocationSerialized",
  "inlineReference",
  "confirmation",
]);

function copilotText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    // Response streams often arrive as arrays of event objects
    const parts: string[] = [];
    for (const item of value) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const kind = typeof obj.kind === "string" ? obj.kind : "";
        if (kind && COPILOT_SKIP_KINDS.has(kind)) continue;
        const text = copilotText(obj.value ?? obj.message ?? obj.content ?? obj.text ?? obj);
        if (text.trim()) parts.push(text.trim());
      } else {
        const text = copilotText(item);
        if (text.trim()) parts.push(text.trim());
      }
    }
    return parts.join("\n");
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const kind = typeof obj.kind === "string" ? obj.kind : "";
    if (kind && COPILOT_SKIP_KINDS.has(kind)) return "";
    const direct = obj.text ?? obj.content ?? obj.value ?? obj.message ?? obj.prompt ?? obj.response;
    const directText = copilotText(direct);
    if (directText) return directText;
    const arrays = [obj.parts, obj.segments, obj.items, obj.messages, obj.children];
    for (const arr of arrays) {
      if (Array.isArray(arr)) {
        const text = copilotText(arr);
        if (text) return text;
      }
    }
    const strings: string[] = [];
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v.trim()) strings.push(v.trim());
    }
    if (strings.length > 0) return strings.join(" ");
  }
  return "";
}

function normalizeRole(role: string | undefined): "user" | "assistant" | "system" | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r.includes("user")) return "user";
  if (r.includes("assistant") || r.includes("copilot")) return "assistant";
  if (r.includes("system")) return "system";
  return null;
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

      const role = normalizeRole(req.role as string | undefined);
      const roleContent = role ? copilotText(req.content ?? req.message ?? req.text ?? req) : "";
      const reqExternalId = (req.id ?? req.messageId ?? req.requestId) as string | undefined;
      if (role && roleContent.trim()) {
        messages.push({ role, content: roleContent.trim(), timestamp, external_id: reqExternalId });
        continue;
      }

      if (Array.isArray(req.messages)) {
        for (const msg of req.messages as Array<Record<string, unknown>>) {
          const msgRole = normalizeRole(msg.role as string | undefined);
          if (!msgRole) continue;
          const msgText = copilotText(msg.content ?? msg.message ?? msg.text ?? msg);
          if (msgText.trim()) {
            const msgId = (msg.id ?? msg.messageId) as string | undefined;
            messages.push({ role: msgRole, content: msgText.trim(), timestamp, external_id: msgId });
          }
        }
        continue;
      }

      const prompt = copilotText(req.prompt ?? req.input ?? req.message ?? req.text ?? "");
      if (prompt.trim()) {
        messages.push({ role: "user", content: prompt.trim(), timestamp, external_id: reqExternalId });
      }
      const response = copilotText(req.response ?? req.output ?? req.content ?? req.text ?? "");
      if (response.trim()) {
        messages.push({ role: "assistant", content: response.trim(), timestamp, external_id: reqExternalId ? `${reqExternalId}-response` : undefined });
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
