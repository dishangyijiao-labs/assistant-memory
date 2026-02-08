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
    clauses.push("(workspace LIKE ? OR external_id LIKE ?)");
    const like = "%" + q + "%";
    params.push(like, like);
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
    SELECT id, source, workspace, external_id, started_at, last_at, message_count
    FROM sessions WHERE ${whereSql} ORDER BY last_at DESC LIMIT ? OFFSET ?
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
  order: "asc" | "desc" = "desc"
): SessionDetail | null {
  const database = getDb();
  const session = database
    .prepare("SELECT id, source, workspace, external_id, started_at, last_at, message_count FROM sessions WHERE id = ?")
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

export interface InsightScope {
  workspace?: string;
  timeFrom?: number;
  timeTo?: number;
  sources?: Source[];
}

export interface InsightMessage {
  message_id: number;
  session_id: number;
  source: Source;
  workspace: string;
  role: string;
  content: string;
  timestamp: number;
}

export function getMessagesForInsightScope(scope: InsightScope): InsightMessage[] {
  const database = getDb();
  const clauses: string[] = ["1=1"];
  const params: Array<string | number> = [];
  if (scope.workspace && scope.workspace.trim()) {
    clauses.push("s.workspace = ?");
    params.push(scope.workspace.trim());
  }
  if (typeof scope.timeFrom === "number" && Number.isFinite(scope.timeFrom)) {
    clauses.push("m.timestamp >= ?");
    params.push(Math.trunc(scope.timeFrom));
  }
  if (typeof scope.timeTo === "number" && Number.isFinite(scope.timeTo)) {
    clauses.push("m.timestamp <= ?");
    params.push(Math.trunc(scope.timeTo));
  }
  if (scope.sources && scope.sources.length > 0) {
    const valid = scope.sources.filter((s) => SOURCES.includes(s));
    if (valid.length > 0) {
      clauses.push(`s.source IN (${valid.map(() => "?").join(",")})`);
      params.push(...valid);
    }
  }
  const whereSql = clauses.join(" AND ");
  const stmt = database.prepare(`
    SELECT
      m.id AS message_id,
      m.session_id AS session_id,
      s.source AS source,
      s.workspace AS workspace,
      m.role AS role,
      m.content AS content,
      m.timestamp AS timestamp
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    WHERE ${whereSql}
    ORDER BY m.timestamp ASC
  `);
  return stmt.all(...params) as InsightMessage[];
}

export interface InsightReportRecord {
  id: number;
  workspace: string;
  scope_json: string;
  model_mode: "local" | "external";
  provider: string | null;
  model_name: string | null;
  summary_md: string;
  patterns_json: string;
  feedback_json: string;
  score_efficiency: number;
  score_stability: number;
  score_decision_clarity: number;
  status: "completed" | "failed";
  created_at: number;
  updated_at: number;
}

export interface InsightEvidenceRecord {
  id: number;
  report_id: number;
  claim_type: "pattern" | "feedback" | "score_reason";
  claim_text: string;
  session_id: number;
  message_id: number;
  created_at: number;
}

export interface InsightReportInput {
  workspace: string;
  scopeJson: string;
  modelMode: "local" | "external";
  provider?: string | null;
  modelName?: string | null;
  summaryMd: string;
  patternsJson: string;
  feedbackJson: string;
  scoreEfficiency: number;
  scoreStability: number;
  scoreDecisionClarity: number;
  status?: "completed" | "failed";
}

export interface InsightEvidenceInput {
  claimType: "pattern" | "feedback" | "score_reason";
  claimText: string;
  sessionId: number;
  messageId: number;
}

export function insertInsightReport(input: InsightReportInput): number {
  const now = Date.now();
  const row = getDb()
    .prepare(`
      INSERT INTO insight_reports (
        workspace, scope_json, model_mode, provider, model_name, summary_md, patterns_json, feedback_json,
        score_efficiency, score_stability, score_decision_clarity, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `)
    .get(
      input.workspace,
      input.scopeJson,
      input.modelMode,
      input.provider ?? null,
      input.modelName ?? null,
      input.summaryMd,
      input.patternsJson,
      input.feedbackJson,
      input.scoreEfficiency,
      input.scoreStability,
      input.scoreDecisionClarity,
      input.status ?? "completed",
      now,
      now
    ) as { id: number };
  return row.id;
}

export function insertInsightEvidence(reportId: number, evidence: InsightEvidenceInput[]): void {
  if (evidence.length === 0) return;
  const now = Date.now();
  const stmt = getDb().prepare(`
    INSERT INTO insight_evidence (report_id, claim_type, claim_text, session_id, message_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const txn = getDb().transaction((items: InsightEvidenceInput[]) => {
    for (const item of items) {
      stmt.run(reportId, item.claimType, item.claimText, item.sessionId, item.messageId, now);
    }
  });
  txn(evidence);
}

export function listInsightReports(
  opts: { workspace?: string; limit?: number; offset?: number } = {}
): InsightReportRecord[] {
  const where = opts.workspace && opts.workspace.trim() ? "WHERE workspace = ?" : "";
  const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
  const offset = Math.max(0, opts.offset ?? 0);
  const stmt = getDb().prepare(`
    SELECT
      id, workspace, scope_json, model_mode, provider, model_name, summary_md, patterns_json, feedback_json,
      score_efficiency, score_stability, score_decision_clarity, status, created_at, updated_at
    FROM insight_reports
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  const params: Array<string | number> = [];
  if (where) params.push(opts.workspace!.trim());
  params.push(limit, offset);
  return stmt.all(...params) as InsightReportRecord[];
}

export function countInsightReports(workspace?: string): number {
  if (workspace && workspace.trim()) {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS c FROM insight_reports WHERE workspace = ?")
      .get(workspace.trim()) as { c: number };
    return row.c;
  }
  const row = getDb().prepare("SELECT COUNT(*) AS c FROM insight_reports").get() as { c: number };
  return row.c;
}

export function getInsightReportById(reportId: number): {
  report: InsightReportRecord;
  evidence: InsightEvidenceRecord[];
} | null {
  const report = getDb()
    .prepare(`
      SELECT
        id, workspace, scope_json, model_mode, provider, model_name, summary_md, patterns_json, feedback_json,
        score_efficiency, score_stability, score_decision_clarity, status, created_at, updated_at
      FROM insight_reports
      WHERE id = ?
    `)
    .get(reportId) as InsightReportRecord | undefined;
  if (!report) return null;
  const evidence = getDb()
    .prepare(`
      SELECT id, report_id, claim_type, claim_text, session_id, message_id, created_at
      FROM insight_evidence
      WHERE report_id = ?
      ORDER BY id ASC
    `)
    .all(reportId) as InsightEvidenceRecord[];
  return { report, evidence };
}

const MODEL_SETTING_KEYS = {
  modeDefault: "model.mode_default",
  externalEnabled: "model.external_enabled",
  provider: "model.provider",
  baseUrl: "model.base_url",
  modelName: "model.model_name",
  keyRef: "model.key_ref",
} as const;

export interface ModelSettings {
  mode_default: "local" | "external";
  external_enabled: boolean;
  provider: string;
  base_url: string;
  model_name: string;
  key_ref: string;
}

const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  mode_default: "local",
  external_enabled: false,
  provider: "",
  base_url: "https://api.openai.com/v1",
  model_name: "",
  key_ref: "",
};

function getSettingRaw(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const now = Date.now();
  getDb()
    .prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    .run(key, value, now);
}

export function getModelSettings(): ModelSettings {
  const modeRaw = getSettingRaw(MODEL_SETTING_KEYS.modeDefault);
  const mode = modeRaw === "external" ? "external" : "local";
  const externalEnabled = getSettingRaw(MODEL_SETTING_KEYS.externalEnabled) === "true";
  const provider = getSettingRaw(MODEL_SETTING_KEYS.provider) ?? DEFAULT_MODEL_SETTINGS.provider;
  const baseUrl = getSettingRaw(MODEL_SETTING_KEYS.baseUrl) ?? DEFAULT_MODEL_SETTINGS.base_url;
  const modelName = getSettingRaw(MODEL_SETTING_KEYS.modelName) ?? DEFAULT_MODEL_SETTINGS.model_name;
  const keyRef = getSettingRaw(MODEL_SETTING_KEYS.keyRef) ?? DEFAULT_MODEL_SETTINGS.key_ref;
  return {
    mode_default: mode,
    external_enabled: externalEnabled,
    provider,
    base_url: baseUrl,
    model_name: modelName,
    key_ref: keyRef,
  };
}

export function updateModelSettings(patch: Partial<ModelSettings>): ModelSettings {
  if (patch.mode_default) {
    setSetting(MODEL_SETTING_KEYS.modeDefault, patch.mode_default);
  }
  if (typeof patch.external_enabled === "boolean") {
    setSetting(MODEL_SETTING_KEYS.externalEnabled, patch.external_enabled ? "true" : "false");
  }
  if (typeof patch.provider === "string") {
    setSetting(MODEL_SETTING_KEYS.provider, patch.provider);
  }
  if (typeof patch.base_url === "string") {
    setSetting(MODEL_SETTING_KEYS.baseUrl, patch.base_url);
  }
  if (typeof patch.model_name === "string") {
    setSetting(MODEL_SETTING_KEYS.modelName, patch.model_name);
  }
  if (typeof patch.key_ref === "string") {
    setSetting(MODEL_SETTING_KEYS.keyRef, patch.key_ref);
  }
  return getModelSettings();
}
