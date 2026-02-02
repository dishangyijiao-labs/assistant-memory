import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import Database from "better-sqlite3";
import type { RawSession, RawMessage } from "./types.js";

const CURSOR_KEYS = [
  "workbench.panel.aichat.view.aichat.chatdata",
  "workbench.panel.aichat.chatdata",
  "aiService.prompts",
];

function getCursorCliPaths(): { globalState: string; chatsDir: string } {
  const home = homedir();
  if (platform() === "win32") {
    const ap = process.env.APPDATA;
    const base = ap ? join(ap, "Cursor") : join(home, ".cursor");
    return {
      globalState: join(base, "User", "globalStorage", "global-state.vscdb"),
      chatsDir: join(home, ".cursor", "chats"),
    };
  }
  return {
    globalState: join(home, ".cursor", "globalStorage", "global-state.vscdb"),
    chatsDir: join(home, ".cursor", "chats"),
  };
}

export function ingestCursorCli(): RawSession[] {
  const sessions: RawSession[] = [];
  const { globalState, chatsDir } = getCursorCliPaths();

  if (existsSync(globalState)) {
    try {
      const db = new Database(globalState, { readonly: true });
      for (const key of CURSOR_KEYS) {
        const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key) as { value: string } | undefined;
        if (!row?.value) continue;
        const data = parseCursorChatData(row.value);
        for (const s of data) {
          s.source = "cursor-cli";
          s.workspace = s.workspace || "global";
          sessions.push(s);
        }
        if (data.length > 0) break;
      }
      db.close();
    } catch (_e) {
      // Skip locked or corrupted DB
    }
  }

  if (existsSync(chatsDir)) {
    try {
      const files = readdirSync(chatsDir).filter((f) => f.endsWith(".json") || f.endsWith(".jsonl"));
      for (const file of files) {
        const path = join(chatsDir, file);
        try {
          const raw = readFileSync(path, "utf-8");
          const s = parseCursorCliChatFile(raw, file);
          if (s && s.messages.length > 0) {
            s.source = "cursor-cli";
            sessions.push(s);
          }
        } catch (_e) {
          // Skip
        }
      }
    } catch (_e) {
      // Dir not readable
    }
  }

  return sessions;
}

function parseCursorChatData(json: string): RawSession[] {
  const out: RawSession[] = [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      for (const conv of parsed) {
        const s = cursorConvToSession(conv);
        if (s) out.push(s);
      }
    } else if (parsed && typeof parsed === "object") {
      const s = cursorConvToSession(parsed);
      if (s) out.push(s);
    }
  } catch (_e) {
    // Ignore
  }
  return out;
}

function cursorConvToSession(conv: Record<string, unknown>): RawSession | null {
  const messages = extractCursorMessages(conv);
  if (messages.length === 0) return null;
  const timestamps = messages.map((m) => m.timestamp).filter((t) => t > 0);
  const started = timestamps.length ? Math.min(...timestamps) : Date.now();
  const last = timestamps.length ? Math.max(...timestamps) : Date.now();
  const id = (conv.id ?? conv.sessionId ?? conv.conversationId ?? `cursor-cli-${started}`) as string;
  return {
    source: "cursor-cli",
    workspace: "global",
    external_id: String(id),
    started_at: started,
    last_at: last,
    messages,
  };
}

function extractCursorMessages(conv: Record<string, unknown>): RawMessage[] {
  const messages: RawMessage[] = [];
  const items = (conv.messages ?? conv.chatData ?? conv.messagesList ?? conv.items) as unknown[] | undefined;
  if (!Array.isArray(items)) return messages;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const role = (obj.role ?? obj.type ?? obj.messageType) as string | undefined;
    let content = "";
    if (typeof obj.content === "string") content = obj.content;
    else if (typeof obj.text === "string") content = obj.text;
    else if (Array.isArray(obj.parts)) content = (obj.parts as Array<{ text?: string }>).map((p) => p.text ?? "").join("\n");
    else if (obj.message) content = String((obj.message as Record<string, unknown>).content ?? obj.message);
    if (!content.trim()) continue;
    const roleNorm = role?.toLowerCase().includes("user") ? "user" : role?.toLowerCase().includes("assistant") ? "assistant" : "user";
    const ts = (obj.timestamp ?? obj.createdAt ?? obj.time ?? Date.now()) as number;
    const timestamp = typeof ts === "number" ? ts : new Date(String(ts)).getTime();
    messages.push({ role: roleNorm as "user" | "assistant", content, timestamp, external_id: (obj.id ?? obj.uuid) as string | undefined });
  }
  return messages;
}

function parseCursorCliChatFile(json: string, filename: string): RawSession | null {
  try {
    const data = JSON.parse(json) as Record<string, unknown>;
    const messages = extractCursorMessages(data);
    if (messages.length === 0) return null;
    const timestamps = messages.map((m) => m.timestamp).filter((t) => t > 0);
    const started = timestamps.length ? Math.min(...timestamps) : Date.now();
    const last = timestamps.length ? Math.max(...timestamps) : Date.now();
    const id = (data.id ?? data.sessionId ?? filename.replace(/\.(json|jsonl)$/, "")) as string;
    return {
      source: "cursor-cli",
      workspace: "chats",
      external_id: String(id),
      started_at: started,
      last_at: last,
      messages,
    };
  } catch (_e) {
    return null;
  }
}
