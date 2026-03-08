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

export interface SourceResult {
  source: string;
  sessions: number;
  error?: string;
}

export interface IngestResult {
  sessions: number;
  messages: number;
  sourceResults: SourceResult[];
}

function log(msg: string): void {
  process.stderr.write(`[assistmem] ${msg}\n`);
}

function collectSource(
  name: string,
  fn: () => RawSession[],
  all: RawSession[],
  results: SourceResult[]
): void {
  try {
    const sessions = fn();
    all.push(...sessions);
    results.push({ source: name, sessions: sessions.length });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log(`${name}: ${error}`);
    results.push({ source: name, sessions: 0, error });
  }
}

export function runIngest(options: IngestOptions = {}): IngestResult {
  const sources = options.sources ?? ["cursor", "cursor-cli", "copilot", "claude-code", "codex", "gemini"];
  const all: RawSession[] = [];
  const sourceResults: SourceResult[] = [];

  if (sources.includes("cursor")) collectSource("cursor", ingestCursor, all, sourceResults);
  if (sources.includes("cursor-cli")) collectSource("cursor-cli", ingestCursorCli, all, sourceResults);
  if (sources.includes("copilot")) collectSource("copilot", ingestCopilot, all, sourceResults);
  if (sources.includes("claude-code")) collectSource("claude-code", ingestClaudeCode, all, sourceResults);
  if (sources.includes("codex")) collectSource("codex", ingestCodex, all, sourceResults);
  if (sources.includes("gemini")) collectSource("gemini", ingestGemini, all, sourceResults);

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

  const stats = db.getStats();
  return { ...stats, sourceResults };
}
