import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { RawSession, RawMessage } from "./types.js";

const GEMINI_TMP = join(homedir(), ".gemini", "tmp");

export function ingestGemini(): RawSession[] {
  if (!existsSync(GEMINI_TMP)) return [];

  const sessions: RawSession[] = [];
  const projectDirs = readdirSync(GEMINI_TMP, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const proj of projectDirs) {
    const chatsDir = join(GEMINI_TMP, proj.name, "chats");
    if (!existsSync(chatsDir)) continue;

    const files = readdirSync(chatsDir).filter((f) => f.endsWith(".json") || f.endsWith(".jsonl") || !f.includes("."));
    for (const file of files) {
      const path = join(chatsDir, file);
      try {
        const s = parseGeminiSessionFile(path, proj.name);
        if (s && s.messages.length > 0) sessions.push(s);
      } catch (_e) {
        // Skip
      }
    }
  }

  return sessions;
}

function parseGeminiSessionFile(filePath: string, projectHash: string): RawSession | null {
  const content = readFileSync(filePath, "utf-8").trim();
  const messages: RawMessage[] = [];
  let started = Date.now();
  let last = 0;

  if (content.startsWith("[")) {
    try {
      const arr = JSON.parse(content) as unknown[];
      for (const item of arr) {
        const m = parseGeminiMessage(item);
        if (m) {
          messages.push(m);
          if (m.timestamp < started) started = m.timestamp;
          if (m.timestamp > last) last = m.timestamp;
        }
      }
    } catch (_e) {
      return null;
    }
  } else if (content.startsWith("{")) {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      const turns = (data.turns ?? data.messages ?? data.history ?? data.events ?? []) as unknown[];
      for (const t of turns) {
        const m = parseGeminiMessage(t);
        if (m) {
          messages.push(m);
          if (m.timestamp < started) started = m.timestamp;
          if (m.timestamp > last) last = m.timestamp;
        }
      }
      const parts = (data.parts ?? data.content ?? []) as unknown[];
      for (const p of parts) {
        const m = parseGeminiPart(p);
        if (m) {
          messages.push(m);
          if (m.timestamp < started) started = m.timestamp;
          if (m.timestamp > last) last = m.timestamp;
        }
      }
    } catch (_e) {
      return null;
    }
  } else {
    const lines = content.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const item = JSON.parse(line) as Record<string, unknown>;
        const m = parseGeminiMessage(item);
        if (m) {
          messages.push(m);
          if (m.timestamp < started) started = m.timestamp;
          if (m.timestamp > last) last = m.timestamp;
        }
      } catch (_e) {
        // Skip non-JSON lines
      }
    }
  }

  if (messages.length === 0) return null;
  const sessionId = filePath.split("/").pop() ?? filePath.split("\\").pop() ?? "unknown";
  return {
    source: "gemini",
    workspace: projectHash,
    external_id: sessionId,
    started_at: started,
    last_at: last || started,
    messages,
  };
}

function parseGeminiMessage(item: unknown): RawMessage | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const role = (obj.role ?? obj.type ?? "assistant") as string;
  let text = "";
  if (typeof obj.text === "string") text = obj.text;
  else if (typeof obj.content === "string") text = obj.content;
  else if (obj.parts && Array.isArray(obj.parts)) {
    text = (obj.parts as Array<{ text?: string }>)
      .map((p) => p.text ?? "")
      .filter(Boolean)
      .join("\n");
  }
  if (!text.trim()) return null;
  const tsRaw = (obj.timestamp ?? obj.time ?? Date.now()) as number | string;
  const timestamp = typeof tsRaw === "number" ? tsRaw : new Date(String(tsRaw)).getTime() || Date.now();
  const normalizedRole: "user" | "assistant" | "system" =
    role === "user"
      ? "user"
      : role === "model" || role === "assistant" || role === "gemini"
        ? "assistant"
        : role === "system" || role === "info"
          ? "system"
          : "assistant"; // fallback: keep unrecognized roles as assistant rather than dropping
  return {
    role: normalizedRole,
    content: text.trim(),
    timestamp,
    external_id: (obj.id ?? obj.uuid) as string | undefined,
  };
}

function parseGeminiPart(part: unknown): RawMessage | null {
  if (!part || typeof part !== "object") return null;
  const obj = part as Record<string, unknown>;
  let text = "";
  if (typeof obj.text === "string") text = obj.text;
  else if (typeof obj.content === "string") text = obj.content;
  else if (Array.isArray(obj.parts)) {
    text = (obj.parts as Array<{ text?: string }>)
      .map((p) => p.text ?? "")
      .filter(Boolean)
      .join("\n");
  }
  if (!text.trim()) return null;
  const role = (obj.role ?? "assistant") as string;
  const tsRaw = (obj.timestamp ?? obj.time ?? Date.now()) as number | string;
  const timestamp = typeof tsRaw === "number" ? tsRaw : new Date(String(tsRaw)).getTime() || Date.now();
  return {
    role: role === "user" ? "user" : "assistant",
    content: text.trim(),
    timestamp,
  };
}
