import { searchMessages } from "../storage/queries/messages.js";
import type { MessageResult } from "../storage/queries/messages.js";

export interface ContextSnippet {
  source: string;
  workspace: string;
  timestamp: string;
  snippet: string;
  relevance: number;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECENCY_BOOST = 0.15;
const WORKSPACE_HINT_BOOST = 0.1;
const BASE_RELEVANCE = 0.75;
const MAX_RESULTS = 3;
const FETCH_LIMIT = 20;

function computeRelevance(
  result: MessageResult,
  now: number,
  workspaceHint?: string
): number {
  let relevance = BASE_RELEVANCE;

  // Recency boost: up to 0.15 for messages within the last 7 days, linearly decaying
  const ageMs = now - result.last_at;
  if (ageMs < SEVEN_DAYS_MS) {
    relevance += MAX_RECENCY_BOOST * (1 - ageMs / SEVEN_DAYS_MS);
  }

  // Workspace hint boost
  if (
    workspaceHint &&
    result.workspace.toLowerCase().includes(workspaceHint.toLowerCase())
  ) {
    relevance += WORKSPACE_HINT_BOOST;
  }

  return Math.round(Math.min(1, relevance) * 100) / 100;
}

export function getRelevantContext(
  query: string,
  workspaceHint?: string
): ContextSnippet[] {
  if (!query || !query.trim()) {
    return [];
  }

  const results = searchMessages(query, FETCH_LIMIT);
  const now = Date.now();

  // Score all results
  const scored: ContextSnippet[] = results.map((r) => ({
    source: r.source,
    workspace: r.workspace,
    timestamp: new Date(r.last_at).toISOString(),
    snippet: r.snippet,
    relevance: computeRelevance(r, now, workspaceHint),
  }));

  // Deduplicate by snippet text, keeping higher relevance
  const deduped = new Map<string, ContextSnippet>();
  for (const item of scored) {
    const existing = deduped.get(item.snippet);
    if (!existing || item.relevance > existing.relevance) {
      deduped.set(item.snippet, item);
    }
  }

  // Sort by relevance descending, return top results
  return [...deduped.values()]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, MAX_RESULTS);
}
