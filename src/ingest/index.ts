import * as db from "../storage/db.js";
import type { NormalizedSession, NormalizedMessage } from "../storage/db.js";
import type { RawSession } from "./types.js";
import { ingestCursor } from "./cursor.js";
import { ingestCursorCli } from "./cursor-cli.js";
import { ingestCopilot } from "./copilot.js";
import { ingestClaudeCode } from "./claude-code.js";
import { ingestCodex } from "./codex.js";
import { ingestGemini } from "./gemini.js";

export interface IngestOptions {
  sources?: Array<"cursor" | "cursor-cli" | "copilot" | "claude-code" | "codex" | "gemini">;
}

export function runIngest(options: IngestOptions = {}): { sessions: number; messages: number } {
  const sources = options.sources ?? ["cursor", "cursor-cli", "copilot", "claude-code", "codex", "gemini"];
  const all: RawSession[] = [];

  if (sources.includes("cursor")) {
    const s = ingestCursor();
    all.push(...s);
  }
  if (sources.includes("cursor-cli")) {
    const s = ingestCursorCli();
    all.push(...s);
  }
  if (sources.includes("copilot")) {
    const s = ingestCopilot();
    all.push(...s);
  }
  if (sources.includes("claude-code")) {
    const s = ingestClaudeCode();
    all.push(...s);
  }
  if (sources.includes("codex")) {
    const s = ingestCodex();
    all.push(...s);
  }
  if (sources.includes("gemini")) {
    const s = ingestGemini();
    all.push(...s);
  }

  const database = db.getDb();
  database.exec("BEGIN");
  try {
    for (const raw of all) {
      const session: NormalizedSession = {
        source: raw.source,
        workspace: raw.workspace,
        external_id: raw.external_id,
        started_at: raw.started_at,
        last_at: raw.last_at,
        message_count: raw.messages.length,
      };
      const sessionId = db.upsertSession(session);
      db.clearSessionMessages(sessionId);
      for (const m of raw.messages) {
        const msg: NormalizedMessage = {
          session_external: raw.external_id,
          source: raw.source,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          external_id: m.external_id,
        };
        db.insertMessage(sessionId, msg);
      }
    }
    database.exec("COMMIT");
  } catch (e) {
    database.exec("ROLLBACK");
    throw e;
  }

  return db.getStats();
}
