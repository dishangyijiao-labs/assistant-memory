import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { RawSession, RawMessage } from "./types.js";

const CODEX_SESSIONS = join(homedir(), ".codex", "sessions");

export function ingestCodex(): RawSession[] {
  if (!existsSync(CODEX_SESSIONS)) return [];

  const sessions: RawSession[] = [];
  const entries = readdirSync(CODEX_SESSIONS, { withFileTypes: true });

  for (const ent of entries) {
    const path = join(CODEX_SESSIONS, ent.name);
    if (ent.isDirectory()) {
      const files = readdirSync(path).filter((f) => f.endsWith(".jsonl") || f.endsWith(".json"));
      for (const file of files) {
        const fullPath = join(path, file);
        try {
          const s = parseCodexFile(fullPath, ent.name);
          if (s && s.messages.length > 0) sessions.push(s);
        } catch (_e) {
          // Skip
        }
      }
    } else if (ent.isFile() && (ent.name.endsWith(".jsonl") || ent.name.endsWith(".json"))) {
      try {
        const s = parseCodexFile(path, "default");
        if (s && s.messages.length > 0) sessions.push(s);
      } catch (_e) {
        // Skip
      }
    }
  }

  return sessions;
}

function parseCodexFile(filePath: string, workspace: string): RawSession | null {
  const content = readFileSync(filePath, "utf-8");
  const isJsonl = filePath.endsWith(".jsonl");
  const messages: RawMessage[] = [];
  let started = Date.now();
  let last = 0;

  if (isJsonl) {
    const lines = content.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as Record<string, unknown>;
        const role = (msg.role ?? msg.type ?? "assistant") as string;
        const text = (msg.content ?? msg.text ?? msg.message ?? "") as string;
        if (!String(text).trim()) continue;
        const ts = (msg.timestamp ?? msg.time ?? Date.now()) as number;
        const timestamp = typeof ts === "number" ? ts : new Date(String(ts)).getTime();
        if (timestamp < started) started = timestamp;
        if (timestamp > last) last = timestamp;
        messages.push({
          role: role === "user" ? "user" : role === "system" ? "system" : "assistant",
          content: String(text).trim(),
          timestamp,
          external_id: (msg.id ?? msg.uuid) as string | undefined,
        });
      } catch (_e) {
        // Skip
      }
    }
  } else {
    try {
      const data = JSON.parse(content) as Record<string, unknown>;
      const items = (data.messages ?? data.turns ?? data.events ?? []) as Array<Record<string, unknown>>;
      for (const item of items) {
        const role = (item.role ?? item.type ?? "assistant") as string;
        const text = (item.content ?? item.text ?? item.message ?? "") as string;
        if (!String(text).trim()) continue;
        const ts = (item.timestamp ?? item.time ?? Date.now()) as number;
        const timestamp = typeof ts === "number" ? ts : new Date(String(ts)).getTime();
        if (timestamp < started) started = timestamp;
        if (timestamp > last) last = timestamp;
        messages.push({
          role: role === "user" ? "user" : role === "system" ? "system" : "assistant",
          content: String(text).trim(),
          timestamp,
          external_id: (item.id ?? item.uuid) as string | undefined,
        });
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
