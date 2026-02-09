import { getDb } from "../db-core.js";
import type { NormalizedMessage, Source } from "../types.js";

export function insertMessage(sessionId: number, m: NormalizedMessage): void {
  const database = getDb();
  const now = Date.now();
  database
    .prepare(
      "INSERT INTO messages (session_id, role, content, timestamp, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(sessionId, m.role, m.content, m.timestamp, m.external_id ?? null, now);
}

export function clearSessionMessages(sessionId: number): void {
  getDb().prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
}

export interface MessageResult {
  message_id: number;
  snippet: string;
  session_id: number;
  source: string;
  workspace: string;
  last_at: number;
  timestamp: number;
}

export function listMessages(
  limit: number = 50,
  source?: Source
): MessageResult[] {
  const database = getDb();
  const whereSource = source ? "AND s.source = ?" : "";
  const stmt = database.prepare(`
    SELECT
      m.id AS message_id,
      substr(m.content, 1, 300) AS snippet,
      m.session_id,
      s.source,
      s.workspace,
      s.last_at,
      m.timestamp
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    WHERE 1=1 ${whereSource}
    ORDER BY m.timestamp DESC
    LIMIT ?
  `);
  const params: Array<string | number> = [];
  if (source) params.push(source);
  params.push(limit);
  return stmt.all(...params) as MessageResult[];
}

function sanitizeFtsQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '""';
  const cleaned = trimmed.replace(/["""*(){}[\]^~:;!@#$%&\\|/<>]/g, " ").trim();
  if (!cleaned) return '""';
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return '""';
  return '"' + tokens.join(" ") + '"';
}

export function searchMessages(
  query: string,
  limit: number = 50,
  source?: Source
): MessageResult[] {
  const database = getDb();
  const ftsQuery = sanitizeFtsQuery(query);
  const whereSource = source ? "AND s.source = ?" : "";
  const stmt = database.prepare(`
    SELECT
      m.id AS message_id,
      snippet(messages_fts, 0, '**', '**', '…', 32) AS snippet,
      m.session_id,
      s.source,
      s.workspace,
      s.last_at,
      m.timestamp
    FROM messages_fts f
    JOIN messages m ON m.id = f.rowid
    JOIN sessions s ON s.id = m.session_id
    WHERE messages_fts MATCH ? ${whereSource}
    ORDER BY s.last_at DESC
    LIMIT ?
  `);
  const params: Array<string | number> = [ftsQuery];
  if (source) params.push(source);
  params.push(limit);
  return stmt.all(...params) as MessageResult[];
}
