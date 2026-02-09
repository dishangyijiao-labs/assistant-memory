import type { LabeledCount } from "../types/index.js";

export function clampScore(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

export function sourceLabel(source: string): string {
  if (source === "cursor") return "Cursor IDE";
  if (source === "copilot") return "Copilot";
  if (source === "cursor-cli") return "Cursor CLI";
  if (source === "claude-code") return "Claude Code";
  if (source === "codex") return "Codex";
  if (source === "gemini") return "Gemini";
  return source;
}

export function tokenize(content: string): string[] {
  return content
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

export function normalizeArray(items: LabeledCount[], fallback: LabeledCount[]): LabeledCount[] {
  return items.length > 0 ? items : fallback;
}

export function pickTopMapValues(map: Map<string, number>, limit: number): LabeledCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export function countSnippetsFromMessage(content: string): number {
  const codeFenceCount = (content.match(/```/g) ?? []).length;
  let snippets = Math.floor(codeFenceCount / 2);
  if (snippets === 0 && /`[^`]{2,}`/.test(content)) {
    snippets = 1;
  }
  if (snippets === 0 && /^[>$\s-]{0,3}(npm|pnpm|yarn|node|cargo|git)\b/m.test(content)) {
    snippets = 1;
  }
  return snippets;
}

export function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const keyword of keywords) {
    if (lower.includes(keyword)) hits += 1;
  }
  return hits;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid] ?? 0;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, n) => acc + n, 0);
  return sum / values.length;
}
