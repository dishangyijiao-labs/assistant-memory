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
        const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key) as { value: unknown } | undefined;
        const text = row?.value ? asText(row.value) : null;
        if (!text) continue;
        const data = parseCursorChatData(text);
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

function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && Buffer.isBuffer(value)) {
    return value.toString("utf-8");
  }
  return null;
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
      // Handle allComposers format (same as cursor.ts)
      if (parsed.allComposers && Array.isArray(parsed.allComposers)) {
        for (const c of parsed.allComposers as Array<Record<string, unknown>>) {
          const conv = c.composer ?? c;
          if (conv && typeof conv === "object") {
            const s = cursorConvToSession(conv as Record<string, unknown>);
            if (s) out.push(s);
          }
        }
      } else {
        const s = cursorConvToSession(parsed);
        if (s) out.push(s);
      }
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


function normalizeCursorRole(role: string | undefined, isUser?: boolean): "user" | "assistant" | null {
  if (typeof isUser === "boolean") return isUser ? "user" : "assistant";
  const r = (role ?? "").toLowerCase();
  if (
    r.includes("user") ||
    r === "human" ||
    r.includes("prompt") ||
    r.includes("request") ||
    r === "inbound"
  )
    return "user";
  if (
    r.includes("assistant") ||
    r.includes("model") ||
    r.includes("ai") ||
    r.includes("bot") ||
    r.includes("copilot") ||
    r.includes("response") ||
    r.includes("completion") ||
    r === "outbound"
  )
    return "assistant";
  return null;
}

function extractContent(obj: Record<string, unknown>): string {
  if (typeof obj.content === "string") return obj.content;
  if (typeof obj.text === "string") return obj.text;
  if (Array.isArray(obj.parts))
    return (obj.parts as Array<{ text?: string }>).map((p) => p.text ?? "").join("\n").trim();
  if (obj.message) return String((obj.message as Record<string, unknown>).content ?? obj.message);
  return "";
}

function parseTimestamp(obj: Record<string, unknown>, fallback: number): number {
  const ts = (obj.timestamp ?? obj.createdAt ?? obj.time) as number | undefined;
  return typeof ts === "number" ? ts : new Date(String(ts ?? "")).getTime() || fallback;
}

function extractCursorMessages(conv: Record<string, unknown>): RawMessage[] {
  const messages: RawMessage[] = [];
  const baseTs = Date.now();

  const bubbles = conv.bubbles ?? conv.turns;
  if (Array.isArray(bubbles)) {
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i] as Record<string, unknown> | undefined;
      if (!b || typeof b !== "object") continue;
      const prompt = b.prompt ?? b.request ?? b.userMessage ?? b.query;
      const response = b.response ?? b.completion ?? b.assistantMessage ?? b.answer;
      const tsPrompt = parseTimestamp(
        (typeof prompt === "object" && prompt !== null ? prompt : {}) as Record<string, unknown>,
        baseTs - (bubbles.length - i) * 2000
      );
      const tsResponse = parseTimestamp(
        (typeof response === "object" && response !== null ? response : {}) as Record<string, unknown>,
        tsPrompt + 1
      );
      if (typeof prompt === "string" && prompt.trim()) {
        messages.push({ role: "user", content: prompt.trim(), timestamp: tsPrompt });
      } else if (prompt && typeof prompt === "object") {
        const c = extractContent(prompt as Record<string, unknown>);
        if (c) messages.push({ role: "user", content: c, timestamp: tsPrompt });
      }
      if (typeof response === "string" && response.trim()) {
        messages.push({ role: "assistant", content: response.trim(), timestamp: tsResponse });
      } else if (response && typeof response === "object") {
        const c = extractContent(response as Record<string, unknown>);
        if (c) messages.push({ role: "assistant", content: c, timestamp: tsResponse });
      }
    }
    if (messages.length > 0) return messages;
  }

  const items = (conv.messages ?? conv.chatData ?? conv.messagesList ?? conv.items) as unknown[] | undefined;
  if (!Array.isArray(items)) return messages;

  let lastRole: "user" | "assistant" = "assistant";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const roleRaw = (obj.role ?? obj.type ?? obj.messageType ?? obj.author ?? obj.sender) as string | undefined;
    const isUser = obj.isUser !== undefined ? !!obj.isUser : undefined;
    const content = extractContent(obj);
    if (!content.trim()) continue;

    let roleNorm = normalizeCursorRole(roleRaw, isUser);
    if (roleNorm === null) {
      roleNorm = lastRole === "user" ? "assistant" : "user";
    }
    lastRole = roleNorm;
    const ts = parseTimestamp(obj, baseTs - (items.length - i) * 1000);
    messages.push({
      role: roleNorm as "user" | "assistant",
      content,
      timestamp: ts,
      external_id: (obj.id ?? obj.uuid) as string | undefined,
    });
  }
  return messages;
}

function parseCursorCliChatFile(raw: string, filename: string): RawSession | null {
  const baseId = filename.replace(/\.(json|jsonl)$/, "");

  // Try single-object JSON first (covers .json and single-object .jsonl)
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const messages = extractCursorMessages(data);
    if (messages.length > 0) {
      const timestamps = messages.map((m) => m.timestamp).filter((t) => t > 0);
      const started = timestamps.length ? Math.min(...timestamps) : Date.now();
      const last = timestamps.length ? Math.max(...timestamps) : Date.now();
      const id = (data.id ?? data.sessionId ?? baseId) as string;
      return {
        source: "cursor-cli",
        workspace: "chats",
        external_id: String(id),
        started_at: started,
        last_at: last,
        messages,
      };
    }
  } catch (_e) {
    // Not single-object JSON — fall through to JSONL parsing
  }

  // JSONL: each line is a separate message/conversation object
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return null;
  const allMessages: import("./types.js").RawMessage[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const msgs = extractCursorMessages(obj);
      allMessages.push(...msgs);
    } catch (_e) {
      // Skip unparseable lines
    }
  }
  if (allMessages.length === 0) return null;
  const timestamps = allMessages.map((m) => m.timestamp).filter((t) => t > 0);
  const started = timestamps.length ? Math.min(...timestamps) : Date.now();
  const last = timestamps.length ? Math.max(...timestamps) : Date.now();
  return {
    source: "cursor-cli",
    workspace: "chats",
    external_id: baseId,
    started_at: started,
    last_at: last,
    messages: allMessages,
  };
}
