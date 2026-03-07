import type { InsightMessage } from "../storage/db.js";
import type { QualityKpiSnapshot, LowQualityQuestion } from "../storage/queries/quality.js";
import { localAnalysis } from "./analysis/core.js";
import { buildEvidence } from "./analysis/evidence.js";
import { generateReflectionPrompts } from "./analysis/reflection.js";
import { externalRewrite } from "./llm/client.js";
import { runAgentLoop } from "./agent/runner.js";
import type { InsightGenerationResult, InsightModelConfig } from "./types/index.js";

export interface QualityContext {
  kpi: QualityKpiSnapshot;
  topLowQualityQuestions: LowQualityQuestion[];
}

export type { InsightGenerationResult, InsightModelConfig, InsightDetails } from "./types/index.js";

export async function generateInsight(
  messages: InsightMessage[],
  model: InsightModelConfig,
  qualityContext?: QualityContext
): Promise<InsightGenerationResult> {
  if (messages.length === 0) {
    throw new Error("INSIGHT_INPUT_EMPTY");
  }

  const local = localAnalysis(messages, qualityContext);
  let summary = local.summary;
  let patterns = [...local.patterns];
  let feedback = [...local.feedback];

  if (model.mode === "external") {
    const external = await externalRewrite(messages, local, model);
    summary = external.summary || summary;
    patterns = external.patterns.length > 0 ? external.patterns : patterns;
    feedback = external.feedback.length > 0 ? external.feedback : feedback;
    if (external.prompt_coach) {
      local.details.prompt_coach = external.prompt_coach;
    }
  } else if (model.mode === "agent" && model.baseUrl && model.modelName && model.apiKey) {
    const sessionIds = [...new Set(messages.map((m) => m.session_id))];
    const userPrompt = [
      "Analyze this user's AI chat usage and produce actionable insights.",
      `Scope: ${messages.length} messages across ${sessionIds.length} session(s). Session IDs: ${sessionIds.join(", ")}.`,
      "Use the tools to search sessions, get session details, retrieve similar high-quality questions, and get quality KPIs.",
      "Your goal: help the user ask BETTER questions. Output JSON: {summary, patterns, feedback}.",
      "Feedback MUST be actionable: 'Next time when X, ask like: [concrete prompt example]'.",
      "",
      "Local analysis (for context):",
      `Summary: ${local.summary}`,
      `Patterns: ${local.patterns.join(" | ")}`,
    ].join("\n");
    const systemPrompt =
      "You are an AI assistant that analyzes a user's chat history. Use the provided tools to gather data. Return JSON with keys: summary (string), patterns (string[]), feedback (string[]). Feedback must be concrete and actionable.";
    const result = await runAgentLoop(
      { baseUrl: model.baseUrl, modelName: model.modelName, apiKey: model.apiKey },
      userPrompt,
      systemPrompt
    );
    summary = result.summary || summary;
    if (result.patterns.length > 0) patterns = result.patterns;
    if (result.feedback.length > 0) feedback = result.feedback;
  }

  const evidence = buildEvidence(messages, patterns, feedback, local.scoreReasons);
  const reflections = generateReflectionPrompts(local.prompt_coach.top_issues);
  return {
    title: local.title,
    summary,
    patterns,
    feedback,
    scores: local.scores,
    scoreReasons: local.scoreReasons,
    details: local.details,
    sessionCount: local.sessionCount,
    messageCount: local.messageCount,
    snippetCount: local.snippetCount,
    sources: local.sources,
    evidence,
    reflections,
  };
}
