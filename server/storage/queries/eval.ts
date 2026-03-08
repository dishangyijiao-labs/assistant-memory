import { getDb } from "../db-core.js";

export interface EvalQuestionPairRecord {
  id: number;
  session_id: number;
  prior_message_id: number;
  next_message_id: number;
  prior_score: number;
  next_score: number;
  delta: number;
  created_at: number;
}

export interface EvalStats {
  pair_count: number;
  improved_count: number;
  unchanged_count: number;
  regressed_count: number;
  improvement_rate: number;
  avg_delta: number;
  avg_prior_score: number;
  avg_next_score: number;
}

/**
 * Try to record an eval pair when we've just scored a message.
 * The "next" message is the one we scored; the "prior" is the immediately
 * preceding user message in the same session. If both have scores, record the pair.
 */
export function tryRecordEvalPair(
  nextMessageId: number,
  sessionId: number,
  nextScore: number
): void {
  const db = getDb();

  // Get user messages in this session ordered by timestamp
  const userMessages = db
    .prepare(
      `
    SELECT m.id, m.timestamp
    FROM messages m
    WHERE m.session_id = ? AND m.role = 'user'
    ORDER BY m.timestamp ASC
  `
    )
    .all(sessionId) as Array<{ id: number; timestamp: number }>;

  const idx = userMessages.findIndex((m) => m.id === nextMessageId);
  if (idx <= 0) return;

  const priorMessageId = userMessages[idx - 1]!.id;

  // Get prior message's score
  const priorRow = db
    .prepare(
      `SELECT score FROM message_quality_scores WHERE message_id = ?`
    )
    .get(priorMessageId) as { score: number } | undefined;
  if (!priorRow) return;

  const priorScore = priorRow.score;
  const delta = nextScore - priorScore;
  const now = Date.now();

  db.prepare(
    `
    INSERT INTO eval_question_pairs (
      session_id, prior_message_id, next_message_id, prior_score, next_score, delta, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(prior_message_id, next_message_id) DO UPDATE SET
      prior_score = excluded.prior_score,
      next_score = excluded.next_score,
      delta = excluded.delta,
      created_at = excluded.created_at
  `
  ).run(
    sessionId,
    priorMessageId,
    nextMessageId,
    priorScore,
    nextScore,
    delta,
    now
  );
}

export function getEvalStats(opts?: {
  sessionIds?: number[];
  timeFrom?: number;
  timeTo?: number;
}): EvalStats {
  const db = getDb();
  const clauses: string[] = ["1=1"];
  const params: unknown[] = [];

  if (opts?.sessionIds?.length) {
    const placeholders = opts.sessionIds.map(() => "?").join(",");
    clauses.push(`session_id IN (${placeholders})`);
    params.push(...opts.sessionIds);
  }

  if (opts?.timeFrom !== null && opts?.timeFrom !== undefined) {
    clauses.push("created_at >= ?");
    params.push(opts.timeFrom);
  }
  if (opts?.timeTo !== null && opts?.timeTo !== undefined) {
    clauses.push("created_at <= ?");
    params.push(opts.timeTo);
  }

  const where = clauses.join(" AND ");
  const rows = db
    .prepare(
      `
    SELECT prior_score, next_score, delta
    FROM eval_question_pairs
    WHERE ${where}
  `
    )
    .all(...params) as Array<{ prior_score: number; next_score: number; delta: number }>;

  const count = rows.length;
  const improved = rows.filter((r) => r.delta > 0).length;
  const unchanged = rows.filter((r) => r.delta === 0).length;
  const regressed = rows.filter((r) => r.delta < 0).length;
  const sumDelta = rows.reduce((a, r) => a + r.delta, 0);
  const sumPrior = rows.reduce((a, r) => a + r.prior_score, 0);
  const sumNext = rows.reduce((a, r) => a + r.next_score, 0);

  return {
    pair_count: count,
    improved_count: improved,
    unchanged_count: unchanged,
    regressed_count: regressed,
    improvement_rate: count > 0 ? improved / count : 0,
    avg_delta: count > 0 ? Math.round((sumDelta / count) * 10) / 10 : 0,
    avg_prior_score: count > 0 ? Math.round((sumPrior / count) * 10) / 10 : 0,
    avg_next_score: count > 0 ? Math.round((sumNext / count) * 10) / 10 : 0,
  };
}
