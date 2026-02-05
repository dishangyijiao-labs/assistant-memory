import { readdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir, platform } from "os";
import Database from "better-sqlite3";
import type { RawSession, RawMessage } from "./types.js";

const CURSOR_KEYS = [
  "workbench.panel.aichat.view.aichat.chatdata",
  "workbench.panel.aichat.chatdata",
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
      const s = cursorConvToSession(parsed);
      if (s) out.push(s);
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
  const base = Date.now() - max * 1000;
  const messages: RawMessage[] = [];
  for (let i = 0; i < max; i += 1) {
    const prompt = prompts[i];
    if (prompt?.text && String(prompt.text).trim()) {
      const ts = gens[i]?.unixMs ?? base + i * 1000;
      messages.push({ role: "user", content: String(prompt.text).trim(), timestamp: ts });
    }
    const gen = gens[i];
    if (gen?.textDescription && String(gen.textDescription).trim()) {
      const ts = gen.unixMs ?? base + i * 1000 + 1;
      messages.push({ role: "assistant", content: String(gen.textDescription).trim(), timestamp: ts });
    }
  }

  if (messages.length === 0) return null;
  const timestamps = messages.map((m) => m.timestamp).filter((t) => t > 0);
  const started = timestamps.length ? Math.min(...timestamps) : Date.now();
  const last = timestamps.length ? Math.max(...timestamps) : Date.now();
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
  const started = timestamps.length ? Math.min(...timestamps) : Date.now();
  const last = timestamps.length ? Math.max(...timestamps) : Date.now();
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
