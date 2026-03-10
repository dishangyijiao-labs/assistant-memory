import { getDb } from "../db-core.js";
import type { NormalizedMessage, Source } from "../types.js";
import { sanitizeFtsQuery } from "../utils.js";

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

export function searchMessages(
  query: string,
  limit: number = 50,
  source?: Source
): MessageResult[] {
  const database = getDb();
  const whereSource = source ? "AND s.source = ?" : "";
  const sql = `
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
  `;
  const stmt = database.prepare(sql);

  // Try AND first for precise results
  const ftsAnd = sanitizeFtsQuery(query, "and");
  const paramsAnd: Array<string | number> = [ftsAnd];
  if (source) paramsAnd.push(source);
  paramsAnd.push(limit);
  const andResults = stmt.all(...paramsAnd) as MessageResult[];
  if (andResults.length > 0) return andResults;

  // Fallback to OR for broader recall
  const ftsOr = sanitizeFtsQuery(query, "or");
  if (ftsOr === ftsAnd) return andResults; // single token, no point retrying
  const paramsOr: Array<string | number> = [ftsOr];
  if (source) paramsOr.push(source);
  paramsOr.push(limit);
  return stmt.all(...paramsOr) as MessageResult[];
}
