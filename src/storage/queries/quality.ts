import { getDb } from "../db-core.js";

export interface QualityScoreRecord {
  id: number;
  message_id: number;
  session_id: number;
  score: number;
  grade: string;
  deductions_json: string;
  missing_info_checklist_json: string;
  rewrites_json: string;
  tags_json: string;
  created_at: number;
}

export interface QualityScoreInput {
  messageId: number;
  sessionId: number;
  score: number;
  grade: string;
  deductionsJson: string;
  missingInfoChecklistJson: string;
  rewritesJson: string;
  tagsJson: string;
}

export function upsertQualityScore(input: QualityScoreInput): void {
  const now = Date.now();
  getDb()
    .prepare(
      `
    INSERT INTO message_quality_scores (
      message_id, session_id, score, grade, deductions_json, missing_info_checklist_json,
      rewrites_json, tags_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(message_id) DO UPDATE SET
      score = excluded.score,
      grade = excluded.grade,
      deductions_json = excluded.deductions_json,
      missing_info_checklist_json = excluded.missing_info_checklist_json,
      rewrites_json = excluded.rewrites_json,
      tags_json = excluded.tags_json,
      created_at = excluded.created_at
  `
    )
    .run(
      input.messageId,
      input.sessionId,
      input.score,
      input.grade,
      input.deductionsJson,
      input.missingInfoChecklistJson,
      input.rewritesJson,
      input.tagsJson,
      now
    );
}

export function getQualityScoresBySessionId(sessionId: number): QualityScoreRecord[] {
  return getDb()
    .prepare(
      `
    SELECT id, message_id, session_id, score, grade, deductions_json, missing_info_checklist_json,
           rewrites_json, tags_json, created_at
    FROM message_quality_scores
    WHERE session_id = ?
    ORDER BY created_at ASC
  `
    )
    .all(sessionId) as QualityScoreRecord[];
}

export function getQualityScoresByMessageIds(messageIds: number[]): Map<number, QualityScoreRecord> {
  if (messageIds.length === 0) return new Map();
  const placeholders = messageIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `
    SELECT id, message_id, session_id, score, grade, deductions_json, missing_info_checklist_json,
           rewrites_json, tags_json, created_at
    FROM message_quality_scores
    WHERE message_id IN (${placeholders})
  `
    )
    .all(...messageIds) as QualityScoreRecord[];
  const map = new Map<number, QualityScoreRecord>();
  for (const row of rows) {
    map.set(row.message_id, row);
  }
  return map;
}

export interface QualityKpiSnapshot {
  avg_follow_up_rounds: number;
  first_pass_resolution_rate: number;
  repeated_question_ratio: number;
  high_quality_ratio: number;
  scored_question_count: number;
  total_user_question_count: number;
}

export function getQualityKpiForScope(opts: {
  sessionIds?: number[];
  timeFrom?: number;
  timeTo?: number;
}): QualityKpiSnapshot {
  const db = getDb();
  let scoredCount = 0;
  let totalUserCount = 0;
  let sumFollowUpRounds = 0;
  let repeatedCount = 0;
  let highQualityCount = 0;

  if (opts.sessionIds && opts.sessionIds.length > 0) {
    const placeholders = opts.sessionIds.map(() => "?").join(",");
    const sessionRows = db
      .prepare(
        `
      SELECT s.id,
             (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.role = 'user') AS user_count
      FROM sessions s
      WHERE s.id IN (${placeholders})
    `
      )
      .all(...opts.sessionIds) as Array<{ id: number; user_count: number }>;

    for (const row of sessionRows) {
      const userCount = row.user_count ?? 0;
      if (userCount > 0) {
        totalUserCount += userCount;
        sumFollowUpRounds += Math.max(0, userCount - 1);
      }
    }

    const scoreRows = db
      .prepare(
        `
      SELECT q.message_id, q.score
      FROM message_quality_scores q
      WHERE q.session_id IN (${placeholders})
    `
      )
      .all(...opts.sessionIds) as Array<{ message_id: number; score: number }>;

    scoredCount = scoreRows.length;
    highQualityCount = scoreRows.filter((r) => r.score >= 80).length;

    const msgIds = scoreRows.map((r) => r.message_id);
    if (msgIds.length > 1) {
      const ph = msgIds.map(() => "?").join(",");
      const contents = db
        .prepare(
          `SELECT id, lower(trim(substr(replace(replace(content, '\n', ' '), '\r', ' '), 1, 120))) AS norm FROM messages WHERE id IN (${ph})`
        )
        .all(...msgIds) as Array<{ id: number; norm: string }>;
      const normToCount = new Map<string, number>();
      for (const c of contents) {
        const n = c.norm ?? "";
        if (n.length > 10) normToCount.set(n, (normToCount.get(n) ?? 0) + 1);
      }
      repeatedCount = [...normToCount.values()].filter((c) => c > 1).reduce((a, b) => a + b - 1, 0);
    }
  }

  const avgFollowUp = totalUserCount > 0 ? sumFollowUpRounds / totalUserCount : 0;
  const firstPassRate = scoredCount > 0 ? Math.min(1, (scoredCount - repeatedCount) / scoredCount) : 0;
  const repeatedRatio = scoredCount > 0 ? repeatedCount / scoredCount : 0;
  const highQualityRatio = scoredCount > 0 ? highQualityCount / scoredCount : 0;

  return {
    avg_follow_up_rounds: Math.round(avgFollowUp * 100) / 100,
    first_pass_resolution_rate: Math.round(firstPassRate * 1000) / 1000,
    repeated_question_ratio: Math.round(repeatedRatio * 1000) / 1000,
    high_quality_ratio: Math.round(highQualityRatio * 1000) / 1000,
    scored_question_count: scoredCount,
    total_user_question_count: totalUserCount,
  };
}

export interface LowQualityQuestion {
  session_id: number;
  workspace: string;
  source: string;
  message_id: number;
  title: string;
  score: number;
  grade: string;
  deduction_reasons: string;
  required_checklist_md: string;
  rewrite_short: string;
  rewrite_engineering: string;
  rewrite_exploratory: string;
}

export function getTopLowQualityQuestions(opts: {
  sessionIds?: number[];
  timeFrom?: number;
  timeTo?: number;
  limit?: number;
  maxScore?: number;
}): LowQualityQuestion[] {
  const db = getDb();
  const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
  const maxScore = opts.maxScore ?? 80;

  let sessionIds = opts.sessionIds;
  if (!sessionIds?.length && (opts.timeFrom != null || opts.timeTo != null)) {
    const clauses: string[] = ["1=1"];
    const params: Array<number> = [];
    if (opts.timeFrom != null) {
      clauses.push("last_at >= ?");
      params.push(opts.timeFrom);
    }
    if (opts.timeTo != null) {
      clauses.push("last_at <= ?");
      params.push(opts.timeTo);
    }
    const rows = db
      .prepare(`SELECT id FROM sessions WHERE ${clauses.join(" AND ")}`)
      .all(...params) as Array<{ id: number }>;
    sessionIds = rows.map((r) => r.id);
  }
  if (!sessionIds?.length) {
    const rows = db
      .prepare("SELECT id FROM sessions ORDER BY last_at DESC LIMIT 500")
      .all() as Array<{ id: number }>;
    sessionIds = rows.map((r) => r.id);
  }
  if (sessionIds.length === 0) return [];

  const placeholders = sessionIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
    SELECT q.message_id, q.session_id, q.score, q.grade, q.deductions_json, q.missing_info_checklist_json, q.rewrites_json,
           s.workspace, s.source,
           substr(m.content, 1, 120) AS title
    FROM message_quality_scores q
    JOIN sessions s ON s.id = q.session_id
    JOIN messages m ON m.id = q.message_id
    WHERE q.session_id IN (${placeholders}) AND q.score < ?
    ORDER BY q.score ASC
    LIMIT ?
  `
    )
    .all(...sessionIds, maxScore, limit) as Array<{
    message_id: number;
    session_id: number;
    score: number;
    grade: string;
    deductions_json: string;
    missing_info_checklist_json: string;
    rewrites_json: string;
    workspace: string;
    source: string;
    title: string;
  }>;

  return rows.map((r) => {
    const deductions = (() => {
      try {
        const arr = JSON.parse(r.deductions_json) as Array<{ reason?: string; code?: string }>;
        return Array.isArray(arr) ? arr.map((d) => d.reason || d.code || "").filter(Boolean).join("; ") : "";
      } catch {
        return "";
      }
    })();
    const checklist = (() => {
      try {
        const arr = JSON.parse(r.missing_info_checklist_json) as string[];
        return Array.isArray(arr) ? arr.map((s) => `- ${s}`).join("\n") : "";
      } catch {
        return "";
      }
    })();
    const rewrites = (() => {
      try {
        const o = JSON.parse(r.rewrites_json) as { short?: string; engineering?: string; exploratory?: string };
        return o && typeof o === "object"
          ? {
              short: String(o.short ?? ""),
              engineering: String(o.engineering ?? ""),
              exploratory: String(o.exploratory ?? ""),
            }
          : { short: "", engineering: "", exploratory: "" };
      } catch {
        return { short: "", engineering: "", exploratory: "" };
      }
    })();
    return {
      session_id: r.session_id,
      workspace: r.workspace ?? "",
      source: r.source ?? "",
      message_id: r.message_id,
      title: (r.title ?? "").trim().slice(0, 100) || "(empty)",
      score: r.score,
      grade: r.grade ?? "?",
      deduction_reasons: deductions,
      required_checklist_md: checklist || "(none)",
      rewrite_short: rewrites.short,
      rewrite_engineering: rewrites.engineering,
      rewrite_exploratory: rewrites.exploratory,
    };
  });
}
