import type { InsightMessage } from "../storage/db.js";
import { localAnalysis } from "./analysis/core.js";
import { buildEvidence } from "./analysis/evidence.js";
import { externalRewrite } from "./llm/client.js";
import type { InsightGenerationResult, InsightModelConfig } from "./types/index.js";

export type { InsightGenerationResult, InsightModelConfig, InsightDetails } from "./types/index.js";

export async function generateInsight(
  messages: InsightMessage[],
  model: InsightModelConfig
): Promise<InsightGenerationResult> {
  if (messages.length === 0) {
    throw new Error("INSIGHT_INPUT_EMPTY");
  }

  const local = localAnalysis(messages);
  let summary = local.summary;
  let patterns = [...local.patterns];
  let feedback = [...local.feedback];

  if (model.mode === "external") {
    const external = await externalRewrite(messages, local, model);
    summary = external.summary || summary;
    patterns = external.patterns.length > 0 ? external.patterns : patterns;
    feedback = external.feedback.length > 0 ? external.feedback : feedback;
  }

  const evidence = buildEvidence(messages, patterns, feedback, local.scoreReasons);
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
  };
}
