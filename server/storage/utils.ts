/**
 * Sanitize a raw search string for safe use in an SQLite FTS5 MATCH query.
 * Strips special FTS5 operators.
 * - mode "and": all tokens must match (default)
 * - mode "or":  any token can match
 * Tokens get prefix matching (e.g. "packag" matches "package" and "packaging").
 */
export function sanitizeFtsQuery(
  raw: string,
  mode: "and" | "or" = "and"
): string {
  const trimmed = raw.trim();
  if (!trimmed) return '""';
  const cleaned = trimmed
    .replace(/["""*(){}[\]^~:;!@#$%&\\|/<>]/g, " ")
    .trim();
  if (!cleaned) return '""';
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return '""';
  if (tokens.length === 1) return '"' + tokens[0] + '"';
  const join = mode === "or" ? " OR " : " AND ";
  return tokens.map((t) => '"' + t + '"').join(join);
}
