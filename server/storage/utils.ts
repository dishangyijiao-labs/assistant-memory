/**
 * Sanitize a raw search string for safe use in an SQLite FTS5 MATCH query.
 * Strips special FTS5 operators. Single token → phrase, multiple tokens → AND.
 */
export function sanitizeFtsQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '""';
  const cleaned = trimmed.replace(/["""*(){}[\]^~:;!@#$%&\\|/<>]/g, " ").trim();
  if (!cleaned) return '""';
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return '""';
  if (tokens.length === 1) return '"' + tokens[0] + '"';
  return tokens.map((t) => '"' + t + '"').join(" AND ");
}
