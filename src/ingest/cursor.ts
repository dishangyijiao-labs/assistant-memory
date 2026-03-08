import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import Database from "better-sqlite3";
import type { RawSession, RawMessage } from "./types.js";

const CURSOR_KEYS = [
  "workbench.panel.aichat.view.aichat.chatdata",
  "workbench.panel.aichat.chatdata",
  "composer.composerData",
  "aiService.prompts",
];

function getCursorWorkspaceStorageDir(): string | null {
  const home = homedir();
  if (platform() === "win32") {
    const ap = process.env.APPDATA;
    if (!ap) return null;
    return join(ap, "Cursor", "User", "workspaceStorage");
  }
  if (platform() === "darwin") {
    return join(home, "Library", "Application Support", "Cursor", "User", "workspaceStorage");
  }
  return join(home, ".config", "Cursor", "User", "workspaceStorage");
}

export function ingestCursor(): RawSession[] {
  const base = getCursorWorkspaceStorageDir();
  if (!base || !existsSync(base)) return [];

  const sessions: RawSession[] = [];
  const dirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const dir of dirs) {
    const statePath = join(base, dir.name, "state.vscdb");
    if (!existsSync(statePath)) continue;

    try {
      const db = new Database(statePath, { readonly: true });
      let foundAny = false;
      for (const key of CURSOR_KEYS) {
        const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key) as { value: unknown } | undefined;
        const text = row?.value ? asText(row.value) : null;
        if (!text) continue;
        const data = parseCursorChatData(text);
        for (const s of data) {
          s.workspace = s.workspace || dir.name;
          sessions.push(s);
        }
        if (data.length > 0) {
          foundAny = true;
          break;
        }
      }
      if (!foundAny) {
        const promptRow = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get("aiService.prompts") as { value: unknown } | undefined;
        const genRow = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get("aiService.generations") as { value: unknown } | undefined;
        const promptText = promptRow?.value ? asText(promptRow.value) : null;
        const genText = genRow?.value ? asText(genRow.value) : null;
        const fallback = parseCursorPromptHistory(promptText, genText, dir.name);
        if (fallback) sessions.push(fallback);
      }
      db.close();
    } catch (_e) {
      // Skip corrupted or locked DB
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
    // Ignore parse errors
  }
  return out;
}

interface CursorPromptEntry {
  text?: string;
  commandType?: number;
}

interface CursorGenerationEntry {
  unixMs?: number;
  textDescription?: string;
}

function parseCursorPromptHistory(
  promptsJson: string | null,
  generationsJson: string | null,
  workspace: string
): RawSession | null {
  if (!promptsJson && !generationsJson) return null;
  let prompts: CursorPromptEntry[] = [];
  let gens: CursorGenerationEntry[] = [];
  try {
    if (promptsJson) {
      const parsed = JSON.parse(promptsJson);
      if (Array.isArray(parsed)) prompts = parsed as CursorPromptEntry[];
    }
  } catch (_e) {
    // Ignore
  }
  try {
    if (generationsJson) {
      const parsed = JSON.parse(generationsJson);
      if (Array.isArray(parsed)) gens = parsed as CursorGenerationEntry[];
    }
  } catch (_e) {
    // Ignore
  }

  const max = Math.max(prompts.length, gens.length);
  if (max === 0) return null;
  // Collect real timestamps first to derive a stable fallback base
  const realTimestamps: number[] = [];
  for (let i = 0; i < max; i += 1) {
    const ts = gens[i]?.unixMs;
    if (typeof ts === "number" && ts > 0) realTimestamps.push(ts);
  }
  // Use earliest real timestamp as base, or a fixed epoch if none exist
  const base = realTimestamps.length
    ? Math.min(...realTimestamps) - max * 1000
    : 0;
  const messages: RawMessage[] = [];
  for (let i = 0; i < max; i += 1) {
    const prompt = prompts[i];
    if (prompt?.text && String(prompt.text).trim()) {
      const ts = gens[i]?.unixMs ?? (base > 0 ? base + i * 1000 : 0);
      messages.push({ role: "user", content: String(prompt.text).trim(), timestamp: ts });
    }
    const gen = gens[i];
    if (gen?.textDescription && String(gen.textDescription).trim()) {
      const ts = gen.unixMs ?? (base > 0 ? base + i * 1000 + 1 : 0);
      messages.push({ role: "assistant", content: String(gen.textDescription).trim(), timestamp: ts });
    }
  }

  if (messages.length === 0) return null;
  const timestamps = messages.map((m) => m.timestamp).filter((t) => t > 0);
  const started = timestamps.length ? Math.min(...timestamps) : 0;
  const last = timestamps.length ? Math.max(...timestamps) : 0;
  return {
    source: "cursor",
    workspace,
    external_id: `cursor-prompts-${workspace}`,
    started_at: started,
    last_at: last,
    messages,
  };
}

function cursorConvToSession(conv: Record<string, unknown>): RawSession | null {
  const messages = extractCursorMessages(conv);
  if (messages.length === 0) return null;
  const timestamps = messages.map((m) => m.timestamp).filter((t) => t > 0);
  const now = Date.now();
  const started = timestamps.length ? Math.min(...timestamps) : now;
  const last = timestamps.length ? Math.max(...timestamps) : started;
  const id = (conv.id ?? conv.sessionId ?? conv.conversationId ?? `cursor-${started}`) as string;
  return {
    source: "cursor",
    workspace: "",
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

  const bubbles = conv.bubbles ?? conv.turns;
  if (Array.isArray(bubbles)) {
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i] as Record<string, unknown> | undefined;
      if (!b || typeof b !== "object") continue;
      const prompt = b.prompt ?? b.request ?? b.userMessage ?? b.query;
      const response = b.response ?? b.completion ?? b.assistantMessage ?? b.answer;
      const tsPrompt = parseTimestamp(
        (typeof prompt === "object" && prompt !== null ? prompt : {}) as Record<string, unknown>,
        0
      );
      const tsResponse = parseTimestamp(
        (typeof response === "object" && response !== null ? response : {}) as Record<string, unknown>,
        tsPrompt > 0 ? tsPrompt + 1 : 0
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
    const ts = parseTimestamp(obj, 0);
    messages.push({
      role: roleNorm as "user" | "assistant",
      content,
      timestamp: ts,
      external_id: (obj.id ?? obj.uuid) as string | undefined,
    });
  }
  return messages;
}
