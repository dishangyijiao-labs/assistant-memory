import { getDb } from "../db-core.js";
import { SOURCES, type NormalizedSession, type Source } from "../types.js";
import { sanitizeFtsQuery } from "../utils.js";

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
export interface SessionListItem {
  id: number;
  source: string;
  workspace: string;
  external_id: string;
  started_at: number;
  last_at: number;
  message_count: number;
  preview: string;
}

export interface SessionFilterOptions {
  source?: Source;
  workspace?: string;
  query?: string;
  timeFrom?: number;
  timeTo?: number;
  limit?: number;
  offset?: number;
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
      SELECT
        s.id, s.source, s.workspace, s.external_id, s.started_at, s.last_at, s.message_count,
        COALESCE(substr(m.content, 1, 100), s.workspace, s.external_id) AS preview
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, content, MIN(timestamp) as min_ts
        FROM messages
        WHERE role = 'user'
        GROUP BY session_id
      ) m ON m.session_id = s.id
      WHERE ${whereSource} ${whereQuery}
      ORDER BY s.last_at DESC
      LIMIT ? OFFSET ?
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
    SELECT
      s.id, s.source, s.workspace, s.external_id, s.started_at, s.last_at, s.message_count,
      COALESCE(substr(m.content, 1, 100), s.workspace, s.external_id) AS preview
    FROM sessions s
    LEFT JOIN (
      SELECT session_id, content, MIN(timestamp) as min_ts
      FROM messages
      WHERE role = 'user'
      GROUP BY session_id
    ) m ON m.session_id = s.id
    WHERE ${whereSource} ${whereQuery}
    ORDER BY s.last_at DESC
    LIMIT ? OFFSET ?
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

function buildSessionFilters(opts: SessionFilterOptions): {
  whereSql: string;
  params: Array<string | number>;
} {
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (opts.source) {
    clauses.push("source = ?");
    params.push(opts.source);
  }
  if (typeof opts.workspace === "string" && opts.workspace.trim()) {
    clauses.push("workspace = ?");
    params.push(opts.workspace.trim());
  }
  const q = (opts.query ?? "").trim();
  if (q) {
    // Search both session metadata AND message content via FTS
    clauses.push("(workspace LIKE ? OR external_id LIKE ? OR id IN (SELECT DISTINCT session_id FROM messages WHERE id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)))");
    const like = "%" + q + "%";
    const ftsQuery = sanitizeFtsQuery(q);
    params.push(like, like, ftsQuery);
  }
  if (typeof opts.timeFrom === "number" && Number.isFinite(opts.timeFrom)) {
    clauses.push("last_at >= ?");
    params.push(Math.trunc(opts.timeFrom));
  }
  if (typeof opts.timeTo === "number" && Number.isFinite(opts.timeTo)) {
    clauses.push("last_at <= ?");
    params.push(Math.trunc(opts.timeTo));
  }
  return {
    whereSql: clauses.length > 0 ? clauses.join(" AND ") : "1=1",
    params,
  };
}

export function listSessionsAdvanced(opts: SessionFilterOptions = {}): SessionListItem[] {
  const database = getDb();
  const limit = Math.min(500, Math.max(1, opts.limit ?? 100));
  const offset = Math.max(0, opts.offset ?? 0);
  const { whereSql, params } = buildSessionFilters(opts);
  const stmt = database.prepare(`
    SELECT
      s.id, s.source, s.workspace, s.external_id, s.started_at, s.last_at, s.message_count,
      COALESCE(substr(m.content, 1, 100), s.workspace, s.external_id) AS preview
    FROM sessions s
    LEFT JOIN (
      SELECT session_id, content, MIN(timestamp) as min_ts
      FROM messages
      WHERE role = 'user'
      GROUP BY session_id
    ) m ON m.session_id = s.id
    WHERE ${whereSql}
    ORDER BY s.last_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(...params, limit, offset) as SessionListItem[];
}

export function countSessionsAdvanced(opts: SessionFilterOptions = {}): number {
  const database = getDb();
  const { whereSql, params } = buildSessionFilters(opts);
  const stmt = database.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE ${whereSql}`);
  return (stmt.get(...params) as { c: number }).c;
}

export interface WorkspaceListItem {
  name: string;
  session_count: number;
  last_at: number;
}

export function listWorkspaces(limit: number = 200): WorkspaceListItem[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT
      workspace AS name,
      COUNT(*) AS session_count,
      MAX(last_at) AS last_at
    FROM sessions
    WHERE workspace <> ''
    GROUP BY workspace
    ORDER BY last_at DESC
    LIMIT ?
  `);
  return stmt.all(Math.min(1000, Math.max(1, limit))) as WorkspaceListItem[];
}

export function getMostRecentWorkspace(): string | null {
  const row = getDb()
    .prepare("SELECT workspace FROM sessions WHERE workspace <> '' ORDER BY last_at DESC LIMIT 1")
    .get() as { workspace: string } | undefined;
  return row?.workspace ?? null;
}

export function getStats(): { sessions: number; messages: number } {
  const database = getDb();
  const sessions = (database.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c;
  const messages = (database.prepare("SELECT COUNT(*) AS c FROM messages").get() as { c: number }).c;
  return { sessions, messages };
}

export interface SourceAggregate {
  source: Source;
  session_count: number;
  message_count: number;
  last_at: number | null;
}

export function getSourceAggregates(): SourceAggregate[] {
  const rows = getDb()
    .prepare(`
      SELECT source, COUNT(*) AS session_count, COALESCE(SUM(message_count), 0) AS message_count, MAX(last_at) AS last_at
      FROM sessions
      GROUP BY source
    `)
    .all() as Array<{
      source: string;
      session_count: number;
      message_count: number;
      last_at: number | null;
    }>;
  return rows
    .filter((row) => SOURCES.includes(row.source as Source))
    .map((row) => ({
      source: row.source as Source,
      session_count: row.session_count,
      message_count: row.message_count,
      last_at: row.last_at,
    }));
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

export function getSessionDetail(
  sessionId: number,
  limit: number = 2000,
  offset: number = 0,
  order: "asc" | "desc" = "asc"
): SessionDetail | null {
  const database = getDb();
  const session = database
    .prepare(`
      SELECT
        s.id, s.source, s.workspace, s.external_id, s.started_at, s.last_at, s.message_count,
        COALESCE(substr(m.content, 1, 100), s.workspace, s.external_id) AS preview
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, content, MIN(timestamp) as min_ts
        FROM messages
        WHERE role = 'user'
        GROUP BY session_id
      ) m ON m.session_id = s.id
      WHERE s.id = ?
    `)
    .get(sessionId) as SessionListItem | undefined;
  if (!session) return null;
  const orderSql = order === "asc" ? "ASC" : "DESC";
  const messages = database
    .prepare(
      `SELECT id, role, content, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ${orderSql} LIMIT ? OFFSET ?`
    )
    .all(sessionId, Math.min(5000, Math.max(1, limit)), Math.max(0, offset)) as SessionDetail["messages"];
  return { session, messages };
}

export function listSessionsByIds(sessionIds: number[]): SessionListItem[] {
  const ids = sessionIds
    .map((id) => Math.trunc(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`
      SELECT
        s.id, s.source, s.workspace, s.external_id, s.started_at, s.last_at, s.message_count,
        COALESCE(substr(m.content, 1, 100), s.workspace, s.external_id) AS preview
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, content, MIN(timestamp) as min_ts
        FROM messages
        WHERE role = 'user'
        GROUP BY session_id
      ) m ON m.session_id = s.id
      WHERE s.id IN (${placeholders})
      ORDER BY s.last_at DESC
    `)
    .all(...ids) as SessionListItem[];
  return rows;
}
