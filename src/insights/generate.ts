import type { InsightEvidenceInput, InsightMessage } from "../storage/db.js";

export interface InsightModelConfig {
  mode: "local" | "external";
  provider?: string;
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
}

export interface InsightGenerationResult {
  summary: string;
  patterns: string[];
  feedback: string[];
  scores: {
    efficiency: number;
    stability: number;
    decision_clarity: number;
  };
  scoreReasons: string[];
  evidence: InsightEvidenceInput[];
}

interface LocalAnalysis {
  summary: string;
  patterns: string[];
  feedback: string[];
  scores: {
    efficiency: number;
    stability: number;
    decision_clarity: number;
  };
  scoreReasons: string[];
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "you",
  "your",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "can",
  "will",
  "just",
  "about",
  "into",
  "then",
  "than",
  "what",
  "when",
  "where",
  "why",
  "how",
  "need",
  "please",
  "code",
  "file",
  "line",
  "project",
  "session",
  "message",
]);

function clampScore(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

function takeTopKeywords(messages: InsightMessage[], limit: number): string[] {
  const freq = new Map<string, number>();
  for (const m of messages) {
    const tokens = m.content
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
    for (const token of tokens) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function localAnalysis(messages: InsightMessage[]): LocalAnalysis {
  const total = messages.length;
  const sessionSet = new Set<number>();
  const sourceCount = new Map<string, number>();
  let userCount = 0;
  let assistantCount = 0;
  let totalChars = 0;
  let firstTs = Number.MAX_SAFE_INTEGER;
  let lastTs = 0;
  for (const m of messages) {
    sessionSet.add(m.session_id);
    sourceCount.set(m.source, (sourceCount.get(m.source) ?? 0) + 1);
    if (m.role === "user") userCount += 1;
    if (m.role === "assistant") assistantCount += 1;
    totalChars += m.content.length;
    if (m.timestamp < firstTs) firstTs = m.timestamp;
    if (m.timestamp > lastTs) lastTs = m.timestamp;
  }

  const sessions = Math.max(1, sessionSet.size);
  const avgMessagesPerSession = total / sessions;
  const avgChars = totalChars / Math.max(1, total);
  const timespanHours = Math.max(1, Math.round((lastTs - firstTs) / (1000 * 60 * 60)));
  const topSources = [...sourceCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name}(${count})`);
  const keywords = takeTopKeywords(messages.filter((m) => m.role === "user"), 5);

  let efficiency = 82;
  if (avgMessagesPerSession > 50) efficiency -= 18;
  else if (avgMessagesPerSession > 30) efficiency -= 10;
  else if (avgMessagesPerSession < 12) efficiency += 4;
  if (avgChars > 1200) efficiency -= 6;

  let stability = 80;
  const errorTerms = ["error", "failed", "exception", "timeout", "bug"];
  let errorHits = 0;
  for (const m of messages) {
    const contentLower = m.content.toLowerCase();
    if (errorTerms.some((term) => contentLower.includes(term))) errorHits += 1;
  }
  const errorRatio = errorHits / Math.max(1, total);
  if (errorRatio > 0.25) stability -= 16;
  else if (errorRatio > 0.15) stability -= 10;
  else stability += 3;

  let decisionClarity = 84;
  const uncertaintyTerms = ["not sure", "unsure", "maybe", "perhaps", "不确定", "可能"];
  let uncertaintyHits = 0;
  for (const m of messages) {
    const contentLower = m.content.toLowerCase();
    if (uncertaintyTerms.some((term) => contentLower.includes(term))) uncertaintyHits += 1;
  }
  const uncertaintyRatio = uncertaintyHits / Math.max(1, total);
  if (uncertaintyRatio > 0.18) decisionClarity -= 16;
  else if (uncertaintyRatio > 0.1) decisionClarity -= 8;
  if (userCount > assistantCount * 1.6) decisionClarity -= 6;

  efficiency = clampScore(efficiency);
  stability = clampScore(stability);
  decisionClarity = clampScore(decisionClarity);

  const summary = [
    `Analyzed ${total} messages across ${sessions} sessions in ~${timespanHours}h.`,
    `Top sources: ${topSources.join(", ") || "n/a"}.`,
    `User/Assistant ratio: ${userCount}:${assistantCount}.`,
    keywords.length > 0 ? `Frequent user terms: ${keywords.join(", ")}.` : "No stable user keywords detected.",
  ].join(" ");

  const patterns: string[] = [];
  if (keywords.length > 0) {
    patterns.push(`High-frequency themes: ${keywords.slice(0, 3).join(", ")}.`);
  }
  if (avgMessagesPerSession > 35) {
    patterns.push("Several sessions are long, indicating iterative trial-and-error cycles.");
  } else {
    patterns.push("Session length is generally controlled, indicating focused iterations.");
  }
  if (errorRatio > 0.15) {
    patterns.push("Error/failure terms appear frequently and likely represent repeated debugging loops.");
  }

  const feedback: string[] = [];
  if (efficiency < 70) {
    feedback.push("Break large requests into smaller acceptance steps to reduce back-and-forth.");
  } else {
    feedback.push("Current iteration pace is good; keep using scoped prompts with explicit acceptance criteria.");
  }
  if (stability < 70) {
    feedback.push("Introduce a repeatable debug checklist (repro, logs, fix, validation) before asking for new changes.");
  } else {
    feedback.push("Stability signals are healthy; continue capturing fix rationale in each session.");
  }
  if (decisionClarity < 70) {
    feedback.push("Lock major technical decisions earlier and avoid parallel alternatives in the same session.");
  } else {
    feedback.push("Decision clarity is strong; keep framing options with trade-offs when requesting AI help.");
  }

  const scoreReasons = [
    `Efficiency ${efficiency}: average ${avgMessagesPerSession.toFixed(1)} messages/session and average ${Math.round(avgChars)} chars/message.`,
    `Stability ${stability}: error-term ratio ${(errorRatio * 100).toFixed(1)}%.`,
    `Decision clarity ${decisionClarity}: uncertainty-term ratio ${(uncertaintyRatio * 100).toFixed(1)}%.`,
  ];

  return {
    summary,
    patterns,
    feedback,
    scores: {
      efficiency,
      stability,
      decision_clarity: decisionClarity,
    },
    scoreReasons,
  };
}

function findEvidenceByText(
  messages: InsightMessage[],
  claimText: string,
  fallbackIndex: number
): { sessionId: number; messageId: number } | null {
  const words = claimText
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 5);
  const candidate = messages.find((m) => {
    const content = m.content.toLowerCase();
    return words.some((w) => content.includes(w));
  });
  if (candidate) {
    return { sessionId: candidate.session_id, messageId: candidate.message_id };
  }
  const fallback = messages[Math.min(fallbackIndex, Math.max(0, messages.length - 1))];
  if (!fallback) return null;
  return { sessionId: fallback.session_id, messageId: fallback.message_id };
}

function buildEvidence(
  messages: InsightMessage[],
  patterns: string[],
  feedback: string[],
  scoreReasons: string[]
): InsightEvidenceInput[] {
  const evidence: InsightEvidenceInput[] = [];
  patterns.forEach((claim, idx) => {
    const hit = findEvidenceByText(messages, claim, idx);
    if (!hit) return;
    evidence.push({
      claimType: "pattern",
      claimText: claim,
      sessionId: hit.sessionId,
      messageId: hit.messageId,
    });
  });
  feedback.forEach((claim, idx) => {
    const hit = findEvidenceByText(messages, claim, idx + 3);
    if (!hit) return;
    evidence.push({
      claimType: "feedback",
      claimText: claim,
      sessionId: hit.sessionId,
      messageId: hit.messageId,
    });
  });
  scoreReasons.forEach((claim, idx) => {
    const hit = findEvidenceByText(messages, claim, idx + 6);
    if (!hit) return;
    evidence.push({
      claimType: "score_reason",
      claimText: claim,
      sessionId: hit.sessionId,
      messageId: hit.messageId,
    });
  });
  return evidence;
}

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const generic = trimmed.match(/\{[\s\S]*\}/);
  if (generic?.[0]) return generic[0].trim();
  throw new Error("MODEL_RESPONSE_NOT_JSON");
}

async function externalRewrite(
  messages: InsightMessage[],
  local: LocalAnalysis,
  model: InsightModelConfig
): Promise<Pick<InsightGenerationResult, "summary" | "patterns" | "feedback">> {
  if (!model.baseUrl || !model.modelName || !model.apiKey) {
    throw new Error("EXTERNAL_MODEL_CONFIG_MISSING");
  }
  const compactSample = messages
    .slice(-120)
    .map((m) => `[${m.role}] ${m.content.slice(0, 200)}`)
    .join("\n");
  const prompt = [
    "You are generating development insights.",
    "Return strict JSON with keys: summary (string), patterns (string[]), feedback (string[]).",
    "Keep feedback actionable and concise.",
    `Local baseline summary: ${local.summary}`,
    `Local baseline patterns: ${local.patterns.join(" | ")}`,
    `Local baseline feedback: ${local.feedback.join(" | ")}`,
    `Chat sample:\n${compactSample}`,
  ].join("\n");

  const endpoint = model.baseUrl.endsWith("/") ? `${model.baseUrl}chat/completions` : `${model.baseUrl}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.modelName,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`MODEL_PROVIDER_HTTP_${response.status}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJsonBlock(content)) as {
    summary?: unknown;
    patterns?: unknown;
    feedback?: unknown;
  };
  if (
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.patterns) ||
    !Array.isArray(parsed.feedback)
  ) {
    throw new Error("MODEL_RESPONSE_INVALID_SHAPE");
  }
  return {
    summary: parsed.summary,
    patterns: parsed.patterns.filter((x): x is string => typeof x === "string").slice(0, 6),
    feedback: parsed.feedback.filter((x): x is string => typeof x === "string").slice(0, 6),
  };
}

export async function generateInsight(
  messages: InsightMessage[],
  model: InsightModelConfig
): Promise<InsightGenerationResult> {
  if (messages.length === 0) {
    throw new Error("INSIGHT_INPUT_EMPTY");
  }
  const local = localAnalysis(messages);
  let summary = local.summary;
  let patterns = local.patterns;
  let feedback = local.feedback;

  if (model.mode === "external") {
    const external = await externalRewrite(messages, local, model);
    summary = external.summary || summary;
    patterns = external.patterns.length > 0 ? external.patterns : patterns;
    feedback = external.feedback.length > 0 ? external.feedback : feedback;
  }

  const evidence = buildEvidence(messages, patterns, feedback, local.scoreReasons);
  return {
    summary,
    patterns,
    feedback,
    scores: local.scores,
    scoreReasons: local.scoreReasons,
    evidence,
  };
}
