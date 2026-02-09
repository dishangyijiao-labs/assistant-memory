import { getDb } from "../db-core.js";
import { SOURCES, type Source } from "../types.js";

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

const INSIGHT_MESSAGE_LIMIT = 50000;

export function getMessagesForSessionIds(sessionIds: number[]): InsightMessage[] {
  const ids = sessionIds
    .map((id) => Math.trunc(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return getDb()
    .prepare(`
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
      WHERE m.session_id IN (${placeholders})
      ORDER BY m.timestamp ASC
      LIMIT ?
    `)
    .all(...ids, INSIGHT_MESSAGE_LIMIT) as InsightMessage[];
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
    LIMIT ?
  `);
  params.push(INSIGHT_MESSAGE_LIMIT);
  return stmt.all(...params) as InsightMessage[];
}

export interface InsightReportRecord {
  id: number;
  title: string;
  workspace: string;
  scope_json: string;
  model_mode: "local" | "external";
  provider: string | null;
  model_name: string | null;
  summary_md: string;
  patterns_json: string;
  feedback_json: string;
  details_json: string;
  session_count: number;
  message_count: number;
  snippet_count: number;
  sources_json: string;
  score_efficiency: number;
  score_stability: number;
  score_decision_clarity: number;
  score_reasons_json: string;
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
  title?: string;
  workspace: string;
  scopeJson: string;
  modelMode: "local" | "external";
  provider?: string | null;
  modelName?: string | null;
  summaryMd: string;
  patternsJson: string;
  feedbackJson: string;
  detailsJson?: string;
  sessionCount?: number;
  messageCount?: number;
  snippetCount?: number;
  sourcesJson?: string;
  scoreEfficiency: number;
  scoreStability: number;
  scoreDecisionClarity: number;
  scoreReasonsJson?: string;
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
        title, workspace, scope_json, model_mode, provider, model_name, summary_md, patterns_json, feedback_json,
        details_json, session_count, message_count, snippet_count, sources_json,
        score_efficiency, score_stability, score_decision_clarity, score_reasons_json, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `)
    .get(
      input.title ?? "",
      input.workspace,
      input.scopeJson,
      input.modelMode,
      input.provider ?? null,
      input.modelName ?? null,
      input.summaryMd,
      input.patternsJson,
      input.feedbackJson,
      input.detailsJson ?? "{}",
      input.sessionCount ?? 0,
      input.messageCount ?? 0,
      input.snippetCount ?? 0,
      input.sourcesJson ?? "[]",
      input.scoreEfficiency,
      input.scoreStability,
      input.scoreDecisionClarity,
      input.scoreReasonsJson ?? "[]",
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

export interface InsightReportSessionInput {
  sessionId: number;
  messageCount: number;
}

export interface InsightReportSessionRecord {
  id: number;
  report_id: number;
  session_id: number;
  message_count: number;
  created_at: number;
  source: string;
  workspace: string;
  external_id: string;
  last_at: number;
}

export function insertInsightReportSessions(reportId: number, sessions: InsightReportSessionInput[]): void {
  if (sessions.length === 0) return;
  const now = Date.now();
  const stmt = getDb().prepare(`
    INSERT INTO insight_report_sessions (report_id, session_id, message_count, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const txn = getDb().transaction((items: InsightReportSessionInput[]) => {
    for (const item of items) {
      stmt.run(reportId, item.sessionId, Math.max(0, Math.trunc(item.messageCount)), now);
    }
  });
  txn(sessions);
}

export function listInsightReportSessions(reportId: number): InsightReportSessionRecord[] {
  return getDb()
    .prepare(`
      SELECT
        rs.id,
        rs.report_id,
        rs.session_id,
        rs.message_count,
        rs.created_at,
        s.source,
        s.workspace,
        s.external_id,
        s.last_at
      FROM insight_report_sessions rs
      JOIN sessions s ON s.id = rs.session_id
      WHERE rs.report_id = ?
      ORDER BY rs.id ASC
    `)
    .all(reportId) as InsightReportSessionRecord[];
}

export function listInsightReports(
  opts: { workspace?: string; limit?: number; offset?: number } = {}
): InsightReportRecord[] {
  const where = opts.workspace && opts.workspace.trim() ? "WHERE workspace = ?" : "";
  const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
  const offset = Math.max(0, opts.offset ?? 0);
  const stmt = getDb().prepare(`
    SELECT
      id, title, workspace, scope_json, model_mode, provider, model_name, summary_md, patterns_json, feedback_json,
      details_json, session_count, message_count, snippet_count, sources_json,
      score_efficiency, score_stability, score_decision_clarity, score_reasons_json, status, created_at, updated_at
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

export function getInsightReportAggregates(workspace?: string): {
  total_reports: number;
  sessions_analyzed: number;
  messages_analyzed: number;
} {
  if (workspace && workspace.trim()) {
    const row = getDb()
      .prepare(`
        SELECT
          COUNT(*) AS total_reports,
          COALESCE(SUM(session_count), 0) AS sessions_analyzed,
          COALESCE(SUM(message_count), 0) AS messages_analyzed
        FROM insight_reports
        WHERE workspace = ?
      `)
      .get(workspace.trim()) as {
      total_reports: number;
      sessions_analyzed: number;
      messages_analyzed: number;
    };
    return row;
  }
  const row = getDb()
    .prepare(`
      SELECT
        COUNT(*) AS total_reports,
        COALESCE(SUM(session_count), 0) AS sessions_analyzed,
        COALESCE(SUM(message_count), 0) AS messages_analyzed
      FROM insight_reports
    `)
    .get() as {
    total_reports: number;
    sessions_analyzed: number;
    messages_analyzed: number;
  };
  return row;
}

export function getInsightReportById(reportId: number): {
  report: InsightReportRecord;
  evidence: InsightEvidenceRecord[];
  sessions: InsightReportSessionRecord[];
} | null {
  const report = getDb()
    .prepare(`
      SELECT
        id, title, workspace, scope_json, model_mode, provider, model_name, summary_md, patterns_json, feedback_json,
        details_json, session_count, message_count, snippet_count, sources_json,
        score_efficiency, score_stability, score_decision_clarity, score_reasons_json, status, created_at, updated_at
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
  const sessions = listInsightReportSessions(reportId);
  return { report, evidence, sessions };
}

export function deleteInsightReport(reportId: number): boolean {
  const out = getDb().prepare("DELETE FROM insight_reports WHERE id = ?").run(reportId);
  return out.changes > 0;
}
