import { readdirSync, readFileSync, existsSync } from "fs";
import { join, dirname, relative } from "path";
import { homedir } from "os";
import type { RawSession, RawMessage } from "./types.js";

const CODEX_SESSIONS = join(homedir(), ".codex", "sessions");

export function ingestCodex(): RawSession[] {
  if (!existsSync(CODEX_SESSIONS)) return [];

  const sessions: RawSession[] = [];
  const files = listCodexFiles(CODEX_SESSIONS);
  for (const filePath of files) {
    const workspace = relative(CODEX_SESSIONS, dirname(filePath)) || "default";
    try {
      const s = parseCodexFile(filePath, workspace);
      if (s && s.messages.length > 0) sessions.push(s);
    } catch (_e) {
      // Skip
    }
  }

  return sessions;
}

function listCodexFiles(baseDir: string): string[] {
  const out: string[] = [];
  const stack: string[] = [baseDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(fullPath);
      } else if (ent.isFile() && (ent.name.endsWith(".jsonl") || ent.name.endsWith(".json"))) {
        out.push(fullPath);
      }
    }
  }
  return out;
}

function parseCodexFile(filePath: string, workspace: string): RawSession | null {
  const content = readFileSync(filePath, "utf-8");
  const isJsonl = filePath.endsWith(".jsonl");
  const messages: RawMessage[] = [];
  let started = Date.now();
  let last = 0;

  const pushMessage = (msg: RawMessage): void => {
    if (!msg.content.trim()) return;
    if (msg.timestamp < started) started = msg.timestamp;
    if (msg.timestamp > last) last = msg.timestamp;
    messages.push(msg);
  };

  if (isJsonl) {
    const lines = content.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const evt = JSON.parse(line) as Record<string, unknown>;
        for (const msg of codexEventToMessages(evt)) {
          pushMessage(msg);
        }
      } catch (_e) {
        // Skip
      }
    }
  } else {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      const items = (data.events ?? data.messages ?? data.turns ?? []) as Array<Record<string, unknown>>;
      if (items.length > 0 && items.every((i) => typeof i === "object" && i && "type" in i)) {
        for (const evt of items) {
          for (const msg of codexEventToMessages(evt)) {
            pushMessage(msg);
          }
        }
      } else {
        for (const item of items) {
          const fallback = codexLegacyMessage(item);
          if (fallback) pushMessage(fallback);
        }
      }
    } catch (_e) {
      return null;
    }
  }

  if (messages.length === 0) return null;
  const sessionId = filePath.split("/").pop()?.replace(/\.(jsonl|json)$/, "") ?? "unknown";
  return {
    source: "codex",
    workspace,
    external_id: sessionId,
    started_at: started,
    last_at: last || started,
    messages,
  };
}

function codexEventToMessages(evt: Record<string, unknown>): RawMessage[] {
  const out: RawMessage[] = [];
  const timestamp = codexTimestamp(evt.timestamp ?? evt.time) ?? Date.now();

  if (evt.type === "event_msg" && evt.payload && typeof evt.payload === "object") {
    const payload = evt.payload as Record<string, unknown>;
    const payloadType = payload.type as string | undefined;
    if (payloadType === "user_message") {
      const text = String(payload.message ?? "").trim();
      if (text) out.push({ role: "user", content: text, timestamp });
    } else if (payloadType === "agent_message") {
      const text = String(payload.message ?? "").trim();
      if (text) out.push({ role: "assistant", content: text, timestamp });
    }
    return out;
  }

  if (evt.type === "response_item" && evt.payload && typeof evt.payload === "object") {
    const payload = evt.payload as Record<string, unknown>;
    const payloadType = payload.type as string | undefined;
    if (payloadType === "function_call") {
      const name = String(payload.name ?? "tool");
      const args = String(payload.arguments ?? "").trim();
      const content = args ? `[tool_call] ${name} ${args}` : `[tool_call] ${name}`;
      out.push({
        role: "assistant",
        content,
        timestamp,
        external_id: payload.call_id as string | undefined,
      });
    } else if (payloadType === "function_call_output") {
      const output = String(payload.output ?? "").trim();
      const content = output ? `[tool_result] ${output}` : "[tool_result] (empty)";
      out.push({
        role: "assistant",
        content,
        timestamp,
        external_id: payload.call_id as string | undefined,
      });
    } else if (payloadType === "message") {
      const role = String(payload.role ?? "assistant");
      const content = codexContentToText(payload.content);
      if (content) {
        out.push({
          role: role === "user" ? "user" : role === "system" || role === "developer" ? "system" : "assistant",
          content,
          timestamp,
        });
      }
    }
    return out;
  }

  return out;
}

function codexLegacyMessage(item: Record<string, unknown>): RawMessage | null {
  const role = String(item.role ?? item.type ?? "assistant");
  const text = String(item.content ?? item.text ?? item.message ?? "").trim();
  if (!text) return null;
  const timestamp = codexTimestamp(item.timestamp ?? item.time) ?? Date.now();
  return {
    role: role === "user" ? "user" : role === "system" ? "system" : "assistant",
    content: text,
    timestamp,
    external_id: (item.id ?? item.uuid) as string | undefined,
  };
}

function codexTimestamp(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : null;
  }
  return null;
}

function codexContentToText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === "string") {
      if (part.trim()) parts.push(part.trim());
      continue;
    }
    if (!part || typeof part !== "object") continue;
    const obj = part as Record<string, unknown>;
    const text = obj.text ?? obj.content;
    if (typeof text === "string" && text.trim()) {
      parts.push(text.trim());
      continue;
    }
    if (obj.type === "input_image" || obj.type === "image" || obj.type === "image_url") {
      parts.push("[image]");
      continue;
    }
  }
  return parts.join("\n").trim();
}
