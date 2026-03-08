import { getDb } from "../db-core.js";

function sanitizeFtsQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '""';
  const cleaned = trimmed.replace(/["""*(){}[\]^~:;!@#$%&\\|/<>]/g, " ").trim();
  if (!cleaned) return '""';
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length === 0) return '""';
  return '"' + tokens.slice(0, 8).join(" ") + '"';
}

export interface SimilarQuestion {
  message_id: number;
  content: string;
  score: number | null;
  grade: string | null;
}

/**
 * Retrieve user messages similar to the query via FTS5.
 * Optionally filter by quality score (prefer high-quality as RAG examples).
 * Excludes the given messageId (e.g. the one being analyzed).
 */
export function retrieveSimilarUserQuestions(opts: {
  query: string;
  limit?: number;
  excludeMessageId?: number;
  minScore?: number;
}): SimilarQuestion[] {
  const db = getDb();
  const limit = Math.min(20, Math.max(1, opts.limit ?? 5));
  const minScore = opts.minScore ?? 0;

  const ftsQuery = sanitizeFtsQuery(opts.query);
  if (ftsQuery === '""') return [];

  const excludeClause = opts.excludeMessageId
    ? "AND m.id != ?"
    : "";
  const params: Array<string | number> = [ftsQuery];
  if (opts.excludeMessageId) params.push(opts.excludeMessageId);
  params.push(limit);

  const scoreFilter = minScore > 0 ? "AND q.score >= ?" : "";
  if (minScore > 0) params.splice(params.length - 1, 0, minScore);

  let stmt = db.prepare(`
    SELECT
      m.id AS message_id,
      substr(m.content, 1, 400) AS content,
      q.score AS score,
      q.grade AS grade
    FROM messages_fts f
    JOIN messages m ON m.id = f.rowid AND m.role = 'user'
    JOIN sessions s ON s.id = m.session_id
    LEFT JOIN message_quality_scores q ON q.message_id = m.id
    WHERE messages_fts MATCH ? ${excludeClause} ${scoreFilter}
    ORDER BY COALESCE(q.score, 0) DESC, s.last_at DESC
    LIMIT ?
  `);
  let rows = stmt.all(...params) as SimilarQuestion[];
  if (rows.length === 0 && minScore > 0) {
    return retrieveSimilarUserQuestions({
      ...opts,
      minScore: 0,
    });
  }
  return rows;
}
