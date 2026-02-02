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

export interface MessageResult {
    snippet: string;
    session_id: number;
    source: string;
    workspace: string;
    last_at: number;
}

export function listMessages(
    limit: number = 50,
    source?: Source
  ): MessageResult[] {
    const database = getDb();
    const whereSource = source ? "AND s.source = ?" : "";
    const stmt = database.prepare(`
      SELECT
        substr(m.content, 1, 300) AS snippet,
        m.session_id,
        s.source,
        s.workspace,
        s.last_at
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
      snippet(messages_fts, 0, '**', '**', '…', 32) AS snippet,
      m.session_id,
      s.source,
      s.workspace,
      s.last_at
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

export function listSessions(opts: { source?: Source; limit?: number; offset?: number } = {}): SessionListItem[] {
  const database = getDb();
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const offset = Math.max(0, opts.offset ?? 0);
  if (opts.source) {
    const stmt = database.prepare(`
      SELECT id, source, workspace, external_id, started_at, last_at, message_count
      FROM sessions WHERE source = ? ORDER BY last_at DESC LIMIT ? OFFSET ?
    `);
    return stmt.all(opts.source, limit, offset) as SessionListItem[];
  }
  const stmt = database.prepare(`
    SELECT id, source, workspace, external_id, started_at, last_at, message_count
    FROM sessions ORDER BY last_at DESC LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as SessionListItem[];
}

export function getStats(): { sessions: number; messages: number } {
  const database = getDb();
  const sessions = (database.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c;
  const messages = (database.prepare("SELECT COUNT(*) AS c FROM messages").get() as { c: number }).c;
  return { sessions, messages };
}
