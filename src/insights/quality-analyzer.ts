import * as db from "../storage/db.js";
import {
  QUALITY_ANALYZER_SYSTEM_PROMPT,
  buildQualityAnalyzerUserPrompt,
  type QualityAnalyzerInput,
} from "./quality-kit.js";

export interface QualityAnalyzerConfig {
  baseUrl: string;
  modelName: string;
  apiKey: string;
}

export interface UserMessageWithContext {
  messageId: number;
  sessionId: number;
  content: string;
  workspace: string;
  source: string;
  /** Previous assistant message (session objective hint) */
  priorAssistant?: string;
}

export function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const generic = trimmed.match(/\{[\s\S]*\}/);
  if (generic?.[0]) return generic[0].trim();
  throw new Error("QUALITY_RESPONSE_NOT_JSON");
}

interface AnalyzerOutput {
  score?: number;
  grade?: string;
  deductions?: Array<{ code?: string; reason?: string; points?: number }>;
  missing_info_checklist?: string[];
  rewrites?: { short?: string; engineering?: string; exploratory?: string };
  tags?: string[];
}

async function callQualityModel(
  config: QualityAnalyzerConfig,
  userPrompt: string
): Promise<AnalyzerOutput> {
  const endpoint = config.baseUrl.endsWith("/")
    ? `${config.baseUrl}chat/completions`
    : `${config.baseUrl}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      temperature: 0.2,
      messages: [
        { role: "system", content: QUALITY_ANALYZER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`QUALITY_MODEL_HTTP_${response.status}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const raw = extractJsonBlock(content);
  return JSON.parse(raw) as AnalyzerOutput;
}

export function extractSessionObjective(priorAssistant: string | undefined): string {
  if (!priorAssistant?.trim()) return "(unspecified)";
  const s = priorAssistant.trim();
  return s.length > 300 ? s.slice(0, 300) + "…" : s;
}

/**
 * Extract user messages with context from a session's messages (ordered by timestamp asc).
 */
export function extractUserMessagesWithContext(
  messages: Array<{ id: number; session_id: number; role: string; content: string }>,
  workspace: string,
  source: string
): UserMessageWithContext[] {
  const result: UserMessageWithContext[] = [];
  let priorAssistant: string | undefined;
  for (const m of messages) {
    if (m.role === "user") {
      result.push({
        messageId: m.id,
        sessionId: m.session_id,
        content: m.content,
        workspace,
        source,
        priorAssistant,
      });
    } else if (m.role === "assistant") {
      priorAssistant = m.content;
    }
  }
  return result;
}

/**
 * Analyze a single user message and persist the score.
 * Uses RAG: retrieves similar high-quality user questions via FTS5 and injects as few-shot context.
 */
export async function analyzeOneMessage(
  msg: UserMessageWithContext,
  config: QualityAnalyzerConfig,
  opts?: { ragEnabled?: boolean; ragLimit?: number; ragMinScore?: number }
): Promise<void> {
  const ragEnabled = opts?.ragEnabled !== false;
  const ragLimit = opts?.ragLimit ?? 5;
  const ragMinScore = opts?.ragMinScore ?? 80;

  const input: QualityAnalyzerInput = {
    question: msg.content,
    workspace: msg.workspace,
    assistant: msg.source,
    sessionObjective: extractSessionObjective(msg.priorAssistant),
  };

  let ragExamples: Array<{ content: string; score: number | null; grade: string | null }> | undefined;
  if (ragEnabled && msg.content.trim().length > 5) {
    try {
      const similar = db.retrieveSimilarUserQuestions({
        query: msg.content,
        limit: ragLimit,
        excludeMessageId: msg.messageId,
        minScore: ragMinScore,
      });
      if (similar.length > 0) {
        ragExamples = similar.map((s) => ({
          content: s.content,
          score: s.score,
          grade: s.grade,
        }));
      }
    } catch {
      // RAG retrieval failed; proceed without examples
    }
  }

  const userPrompt = buildQualityAnalyzerUserPrompt(input, ragExamples);
  const output = await callQualityModel(config, userPrompt);

  const score = Math.max(0, Math.min(100, Math.round(Number(output.score) || 70)));
  const grade = (output.grade && /^[A-F]$/i.test(output.grade)) ? output.grade.toUpperCase() : "C";
  const deductions = Array.isArray(output.deductions) ? output.deductions : [];
  const checklist = Array.isArray(output.missing_info_checklist) ? output.missing_info_checklist : [];
  const rewrites = output.rewrites && typeof output.rewrites === "object"
    ? {
        short: String(output.rewrites.short ?? "").trim() || msg.content.slice(0, 80) + "…",
        engineering: String(output.rewrites.engineering ?? "").trim() || msg.content.slice(0, 80) + "…",
        exploratory: String(output.rewrites.exploratory ?? "").trim() || msg.content.slice(0, 80) + "…",
      }
    : { short: "", engineering: "", exploratory: "" };
  const tags = Array.isArray(output.tags) ? output.tags.filter((t): t is string => typeof t === "string") : [];

  db.upsertQualityScore({
    messageId: msg.messageId,
    sessionId: msg.sessionId,
    score,
    grade,
    deductionsJson: JSON.stringify(deductions),
    missingInfoChecklistJson: JSON.stringify(checklist),
    rewritesJson: JSON.stringify(rewrites),
    tagsJson: JSON.stringify(tags),
  });

  try {
    db.tryRecordEvalPair(msg.messageId, msg.sessionId, score);
  } catch {
    // Eval recording is best-effort
  }
}

/**
 * Analyze all user messages in the given session. Uses existing model settings.
 * Already-scored messages are skipped unless `force` is true.
 */
export async function analyzeSession(
  sessionId: number,
  config: QualityAnalyzerConfig,
  opts?: { force?: boolean }
): Promise<{ analyzed: number; skipped: number; failed: number }> {
  const detail = db.getSessionDetail(sessionId, 5000, 0, "asc");
  if (!detail) return { analyzed: 0, skipped: 0, failed: 0 };

  const userMessages = extractUserMessagesWithContext(
    detail.messages.map((m) => ({ id: m.id, session_id: sessionId, role: m.role, content: m.content })),
    detail.session.workspace || "",
    detail.session.source || ""
  );

  const force = opts?.force === true;
  const existingScores = force
    ? new Map()
    : db.getQualityScoresByMessageIds(userMessages.map((m) => m.messageId));

  let analyzed = 0;
  let skipped = 0;
  let failed = 0;
  for (const msg of userMessages) {
    if (!force && existingScores.has(msg.messageId)) {
      skipped += 1;
      continue;
    }
    try {
      await analyzeOneMessage(msg, config);
      analyzed += 1;
    } catch {
      failed += 1;
    }
  }
  return { analyzed, skipped, failed };
}
