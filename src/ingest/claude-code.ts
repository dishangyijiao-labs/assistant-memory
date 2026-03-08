import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { RawSession, RawMessage } from "./types.js";

const CLAUDE_PROJECTS = join(homedir(), ".claude", "projects");

export function ingestClaudeCode(baseDir?: string): RawSession[] {
  const base = baseDir ?? CLAUDE_PROJECTS;
  if (!existsSync(base)) return [];

  const sessions: RawSession[] = [];
  const projectDirs = readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const proj of projectDirs) {
    const dir = join(base, proj.name);
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      const sessionId = file.replace(/\.jsonl$/, "");
      const path = join(dir, file);
      try {
        const s = parseClaudeJsonl(path, proj.name);
        if (s) {
          s.external_id = sessionId;
          if (s.messages.length > 0) sessions.push(s);
        }
      } catch (_e) {
        // Skip
      }
    }
  }

  return sessions;
}

export function isOnlyToolResult(blocks: unknown[]): boolean {
  for (const x of blocks) {
    if (!x || typeof x !== "object") continue;
    const blk = x as Record<string, unknown>;
    if (blk.type === "tool_result") continue;
    // text blocks with actual content mean it's not purely tool_result
    if (typeof blk.text === "string" && blk.text.trim()) return false;
    if (typeof x === "string" && (x as string).trim()) return false;
  }
  return blocks.some(
    (x) => x && typeof x === "object" && (x as Record<string, unknown>).type === "tool_result",
  );
}

export function claudeContentBlocksToText(blocks: unknown[]): string {
  const parts: string[] = [];
  for (const x of blocks) {
    if (typeof x === "string") {
      if (x.trim()) parts.push(x.trim());
      continue;
    }
    if (!x || typeof x !== "object") continue;
    const blk = x as Record<string, unknown>;
    if (typeof blk.text === "string") {
      if (blk.text.trim()) parts.push(blk.text.trim());
    } else if (blk.type === "tool_use") {
      const name = String(blk.name ?? "tool");
      const input = blk.input !== undefined ? JSON.stringify(blk.input) : "";
      parts.push(input ? `[tool_call] ${name} ${input}` : `[tool_call] ${name}`);
    } else if (blk.type === "tool_result") {
      const inner = blk.content;
      const result =
        typeof inner === "string"
          ? inner
          : Array.isArray(inner)
            ? claudeContentBlocksToText(inner)
            : "";
      parts.push(result.trim() ? `[tool_result] ${result.trim()}` : "[tool_result]");
    } else if (blk.type === "image" || blk.type === "image_url") {
      parts.push("[image]");
    }
    // skip other unknown block types silently
  }
  return parts.join("\n");
}

interface ClaudeJsonlMessage {
  type?: string;
  uuid?: string;
  sessionId?: string;
  timestamp?: string;
  message?: { role?: string; content?: string | unknown[] };
  content?: string;
}

function parseClaudeJsonl(filePath: string, workspace: string): RawSession | null {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const messages: RawMessage[] = [];
  let started = Date.now();
  let last = 0;

  for (const line of lines) {
    try {
      const msg = JSON.parse(line) as ClaudeJsonlMessage;
      const roleRaw =
        msg.type === "user" || msg.type === "assistant" || msg.type === "system"
          ? msg.type
          : (msg.message?.role as string | undefined) ?? "assistant";
      let role: "user" | "assistant" | "system" =
        roleRaw === "user" ? "user" : roleRaw === "system" ? "system" : "assistant";
      let text = "";
      if (typeof msg.content === "string") text = msg.content;
      else if (msg.message) {
        const c = (msg.message as { content?: string | unknown[] }).content;
        if (typeof c === "string") text = c;
        else if (Array.isArray(c)) {
          // Reclassify user messages that contain only tool_result blocks as assistant
          if (role === "user" && isOnlyToolResult(c)) role = "assistant";
          text = claudeContentBlocksToText(c);
        }
      }
      if (!text.trim() && role !== "system") continue;
      const ts = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now();
      if (ts < started) started = ts;
      if (ts > last) last = ts;
      messages.push({
        role: role === "user" ? "user" : role === "system" ? "system" : "assistant",
        content: text.trim() || "(no text)",
        timestamp: ts,
        external_id: msg.uuid,
      });
    } catch (_e) {
      // Skip bad lines
    }
  }

  if (messages.length === 0) return null;
  let sessionId: string;
  try {
    const first = JSON.parse(lines[0]) as ClaudeJsonlMessage;
    sessionId = first.sessionId ?? "";
  } catch {
    sessionId = "";
  }
  if (!sessionId) sessionId = filePath.split("/").pop()?.replace(/\.jsonl$/, "") ?? "unknown";
  return {
    source: "claude-code",
    workspace,
    external_id: sessionId,
    started_at: started,
    last_at: last || started,
    messages,
  };
}
