import * as db from "../../storage/db.js";
import { generateInsight, type InsightModelConfig } from "../../insights/generate.js";
import { resolveModelApiKey } from "../utils/http.js";

const SOURCE_LABELS: Record<string, string> = {
  cursor: "Cursor IDE",
  copilot: "Copilot (VS Code)",
  "cursor-cli": "Cursor CLI",
  "claude-code": "Claude Code",
  codex: "Codex",
  gemini: "Gemini",
};

const MIN_INSIGHT_TOTAL_MESSAGES = 10;
const MIN_INSIGHT_USER_MESSAGES = 5;

export interface GenerateInsightInput {
  sessionIds: number[];
  scope: Record<string, unknown>;
  model: Record<string, unknown>;
}

export interface GenerateInsightResult {
  report_id: number;
  status: string;
  title: string;
  summary: string;
  patterns: string[];
  feedback: string[];
  scores: { efficiency: number; stability: number; decision_clarity: number };
  score_reasons: string[];
  reflections: unknown[];
}

export async function generateInsightReport(input: GenerateInsightInput): Promise<GenerateInsightResult> {
  const { sessionIds: rawSessionIds, scope: scopeRaw, model: modelRaw } = input;

  const selectedSessionIds = rawSessionIds
    .map((id) => (typeof id === "number" ? Math.trunc(id) : Number.NaN))
    .filter((id) => Number.isFinite(id) && id > 0);
  const uniqueSessionIds = [...new Set(selectedSessionIds)];
  const sessionsByIds = uniqueSessionIds.length > 0 ? db.listSessionsByIds(uniqueSessionIds) : [];
  const sessionIdSet = new Set(sessionsByIds.map((item) => item.id));
  const validSelectedIds = uniqueSessionIds.filter((id) => sessionIdSet.has(id));

  const workspaceFromScope = typeof scopeRaw.workspace === "string" ? scopeRaw.workspace.trim() : "";
  const workspaceFromSessions = sessionsByIds.length > 0
    ? [...new Set(sessionsByIds.map((s) => s.workspace).filter((w) => Boolean(w && w.trim())))]
    : [];
  const workspace =
    workspaceFromScope ||
    (workspaceFromSessions.length === 1
      ? workspaceFromSessions[0] ?? ""
      : workspaceFromSessions.length > 1
        ? "(mixed)"
        : "") ||
    db.getMostRecentWorkspace() ||
    "";

  const sourcesFromScope =
    Array.isArray(scopeRaw.sources)
      ? scopeRaw.sources
          .filter((s): s is string => typeof s === "string" && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, s))
          .map((s) => s as db.Source)
      : [];
  const sourcesFromSelected =
    sessionsByIds
      .map((s) => s.source)
      .filter((s): s is db.Source => Object.prototype.hasOwnProperty.call(SOURCE_LABELS, s));
  const sources = [...new Set(validSelectedIds.length > 0 ? sourcesFromSelected : sourcesFromScope)];
  const timeFrom = typeof scopeRaw.time_from === "number" ? Math.trunc(scopeRaw.time_from) : undefined;
  const timeTo = typeof scopeRaw.time_to === "number" ? Math.trunc(scopeRaw.time_to) : undefined;

  // Resolve model config
  const settings = db.getModelSettings();
  const mode =
    modelRaw.mode === "agent" || modelRaw.mode === "external" || modelRaw.mode === "local"
      ? modelRaw.mode
      : settings.mode_default;
  const externalRequestedInPayload = modelRaw.mode === "external" || modelRaw.mode === "agent" || modelRaw.external_enabled === true;
  if ((mode === "external" || mode === "agent") && !settings.external_enabled && !externalRequestedInPayload) {
    throw new ServiceError(400, "INSIGHTS_MODEL_NOT_CONFIGURED", "External model is disabled");
  }
  const modelConfig: InsightModelConfig = { mode };
  if (mode === "external" || mode === "agent") {
    const apiKey = resolveModelApiKey(settings, typeof modelRaw.api_key === "string" ? modelRaw.api_key : undefined);
    if (!apiKey) {
      throw new ServiceError(400, "INSIGHTS_MODEL_NOT_CONFIGURED", "External model API key is missing");
    }
    modelConfig.provider =
      typeof modelRaw.provider === "string" && modelRaw.provider.trim()
        ? modelRaw.provider.trim()
        : settings.provider;
    modelConfig.baseUrl =
      typeof modelRaw.base_url === "string" && modelRaw.base_url.trim()
        ? modelRaw.base_url.trim()
        : settings.base_url;
    modelConfig.modelName =
      typeof modelRaw.model_name === "string" && modelRaw.model_name.trim()
        ? modelRaw.model_name.trim()
        : settings.model_name;
    modelConfig.apiKey = apiKey;
  }

  // Fetch messages
  const messages =
    validSelectedIds.length > 0
      ? db.getMessagesForSessionIds(validSelectedIds)
      : db.getMessagesForInsightScope({ workspace, timeFrom, timeTo, sources });
  if (messages.length === 0) {
    throw new ServiceError(400, "INVALID_ARGUMENT", "No messages found in selected scope or session selection");
  }
  const userMessageCount = messages.reduce(
    (count, message) => count + (String(message.role || "").toLowerCase() === "user" ? 1 : 0),
    0
  );
  if (messages.length < MIN_INSIGHT_TOTAL_MESSAGES || userMessageCount < MIN_INSIGHT_USER_MESSAGES) {
    throw new ServiceError(
      400,
      "INSIGHTS_SAMPLE_TOO_SMALL",
      `Need at least ${MIN_INSIGHT_TOTAL_MESSAGES} total messages and ${MIN_INSIGHT_USER_MESSAGES} user messages. Current: ${messages.length} total, ${userMessageCount} user.`
    );
  }

  // Quality context
  const qualitySessionIds =
    validSelectedIds.length > 0
      ? validSelectedIds
      : [...new Set(messages.map((m) => m.session_id))];
  const qualityKpi = db.getQualityKpiForScope({ sessionIds: qualitySessionIds });
  const topLowQualityQuestions = db.getTopLowQualityQuestions({
    sessionIds: qualitySessionIds,
    limit: 10,
    maxScore: 70,
  });

  // Generate
  const insight = await generateInsight(messages, modelConfig, {
    kpi: qualityKpi,
    topLowQualityQuestions,
  });

  // Persist
  const sessionMessageCountMap = new Map<number, number>();
  for (const message of messages) {
    sessionMessageCountMap.set(message.session_id, (sessionMessageCountMap.get(message.session_id) ?? 0) + 1);
  }
  const selectedSessionsForReport =
    validSelectedIds.length > 0
      ? validSelectedIds.map((sessionId) => ({
          sessionId,
          messageCount: sessionMessageCountMap.get(sessionId) ?? 0,
        }))
      : [...sessionMessageCountMap.entries()].map(([sessionId, messageCount]) => ({ sessionId, messageCount }));

  const reportId = db.insertInsightReport({
    title: insight.title,
    workspace,
    scopeJson: JSON.stringify({ workspace, time_from: timeFrom ?? null, time_to: timeTo ?? null, sources, session_ids: validSelectedIds }),
    modelMode: mode,
    provider: modelConfig.provider ?? null,
    modelName: modelConfig.modelName ?? null,
    summaryMd: insight.summary,
    patternsJson: JSON.stringify(insight.patterns),
    feedbackJson: JSON.stringify(insight.feedback),
    detailsJson: JSON.stringify({ ...insight.details, reflections: insight.reflections }),
    sessionCount: insight.sessionCount,
    messageCount: insight.messageCount,
    snippetCount: insight.snippetCount,
    sourcesJson: JSON.stringify(insight.sources),
    scoreEfficiency: insight.scores.efficiency,
    scoreStability: insight.scores.stability,
    scoreDecisionClarity: insight.scores.decision_clarity,
    scoreReasonsJson: JSON.stringify(insight.scoreReasons),
    status: "completed",
  });
  db.insertInsightEvidence(reportId, insight.evidence);
  db.insertInsightReportSessions(reportId, selectedSessionsForReport);

  return {
    report_id: reportId,
    status: "completed",
    title: insight.title,
    summary: insight.summary,
    patterns: insight.patterns,
    feedback: insight.feedback,
    scores: insight.scores,
    score_reasons: insight.scoreReasons,
    reflections: insight.reflections,
  };
}

export class ServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
