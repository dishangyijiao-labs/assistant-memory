import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { homedir, platform } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCES = ["cursor", "cursor-cli", "copilot", "claude-code", "codex", "gemini"] as const;
export type Source = (typeof SOURCES)[number];

export interface SessionRow {
  id: number;
  source: string;
  workspace: string;
  external_id: string;
  started_at: number;
  last_at: number;
  message_count: number;
  created_at: number;
}

export interface MessageRow {
  id: number;
  session_id: number;
  role: string;
  content: string;
  timestamp: number;
  external_id: string | null;
  created_at: number;
}

export interface NormalizedSession {
  source: Source;
  workspace: string;
  external_id: string;
  started_at: number;
  last_at: number;
  message_count: number;
}

export interface NormalizedMessage {
  session_external: string;
  source: Source;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  external_id?: string;
}

function getDefaultDbPath(): string {
  const home = homedir();
  if (platform() === "win32") {
    return join(home, "AppData", "Local", "assistant-memory", "assistant-memory.db");
  }
  return join(home, ".assistant-memory.db");
}

export function getDbPath(): string {
  return process.env.ASSISTANT_MEMORY_DB_PATH || getDefaultDbPath();
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const path = getDbPath();
    const dir = dirname(path);
    if (dir && !existsSync(dir) && path !== join(homedir(), ".assistant-memory.db")) {
      mkdirSync(dir, { recursive: true });
    }
    db = new Database(path);
    db.pragma("journal_mode = WAL");
    const schemaPath = join(__dirname, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");
    db.exec(schema);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function upsertSession(s: NormalizedSession): number {
  const database = getDb();
  const now = Date.now();
  const stmt = database.prepare(`
    INSERT INTO sessions (source, workspace, external_id, started_at, last_at, message_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, external_id) DO UPDATE SET
      workspace = excluded.workspace,
      last_at = excluded.last_at,
      message_count = excluded.message_count
    RETURNING id
  `);
  const row = stmt.get(s.source, s.workspace, s.external_id, s.started_at, s.last_at, s.message_count, now) as { id: number };
  return row.id;
}

export function getSessionIdByExternal(source: Source, external_id: string): number | null {
  const row = getDb().prepare("SELECT id FROM sessions WHERE source = ? AND external_id = ?").get(source, external_id) as { id: number } | undefined;
  return row?.id ?? null;
}

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
  const params: Array<string | number> = [query];
  if (source) params.push(source);
  params.push(limit);
  return stmt.all(...params) as MessageResult[];
}

export interface SessionListItem {
  id: number;
  source: string;
  workspace: string;
  external_id: string;
  started_at: number;
  last_at: number;
  message_count: number;
}

export function listSessions(
  opts: { source?: Source; limit?: number; offset?: number; query?: string } = {}
): SessionListItem[] {
  const database = getDb();
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const offset = Math.max(0, opts.offset ?? 0);
  const query = (opts.query ?? "").trim();
  const hasQuery = query.length > 0;
  const whereSource = opts.source ? "source = ?" : "1=1";
  const whereQuery = hasQuery ? "AND (workspace LIKE ? OR external_id LIKE ?)" : "";
  if (opts.source) {
    const stmt = database.prepare(`
      SELECT id, source, workspace, external_id, started_at, last_at, message_count
      FROM sessions WHERE ${whereSource} ${whereQuery} ORDER BY last_at DESC LIMIT ? OFFSET ?
    `);
    const params: Array<string | number> = [opts.source];
    if (hasQuery) {
      const like = "%" + query + "%";
      params.push(like, like);
    }
    params.push(limit, offset);
    return stmt.all(...params) as SessionListItem[];
  }
  const stmt = database.prepare(`
    SELECT id, source, workspace, external_id, started_at, last_at, message_count
    FROM sessions WHERE ${whereSource} ${whereQuery} ORDER BY last_at DESC LIMIT ? OFFSET ?
  `);
  const params: Array<string | number> = [];
  if (hasQuery) {
    const like = "%" + query + "%";
    params.push(like, like);
  }
  params.push(limit, offset);
  return stmt.all(...params) as SessionListItem[];
}

export function countSessions(opts: { source?: Source; query?: string } = {}): number {
  const database = getDb();
  const query = (opts.query ?? "").trim();
  const hasQuery = query.length > 0;
  const whereSource = opts.source ? "source = ?" : "1=1";
  const whereQuery = hasQuery ? "AND (workspace LIKE ? OR external_id LIKE ?)" : "";
  if (opts.source) {
    const stmt = database.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE ${whereSource} ${whereQuery}`);
    const params: Array<string | number> = [opts.source];
    if (hasQuery) {
      const like = "%" + query + "%";
      params.push(like, like);
    }
    return (stmt.get(...params) as { c: number }).c;
  }
  const stmt = database.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE ${whereSource} ${whereQuery}`);
  const params: Array<string | number> = [];
  if (hasQuery) {
    const like = "%" + query + "%";
    params.push(like, like);
  }
  return (stmt.get(...params) as { c: number }).c;
}

export function getStats(): { sessions: number; messages: number } {
  const database = getDb();
  const sessions = (database.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c;
  const messages = (database.prepare("SELECT COUNT(*) AS c FROM messages").get() as { c: number }).c;
  return { sessions, messages };
}

export interface SessionDetail {
  session: SessionListItem;
  messages: Array<{
    id: number;
    role: string;
    content: string;
    timestamp: number;
  }>;
}

export function getSessionDetail(sessionId: number, limit: number = 2000, offset: number = 0): SessionDetail | null {
  const database = getDb();
  const session = database
    .prepare("SELECT id, source, workspace, external_id, started_at, last_at, message_count FROM sessions WHERE id = ?")
    .get(sessionId) as SessionListItem | undefined;
  if (!session) return null;
  const messages = database
    .prepare(
      "SELECT id, role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    )
    .all(sessionId, Math.min(5000, Math.max(1, limit)), Math.max(0, offset)) as SessionDetail["messages"];
  return { session, messages };
}
