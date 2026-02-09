import type { InsightEvidenceInput, InsightMessage } from "../../storage/db.js";
import { tokenize } from "./helpers.js";

export function buildEvidence(
  messages: InsightMessage[],
  patterns: string[],
  feedback: string[],
  scoreReasons: string[]
): InsightEvidenceInput[] {
  const claims: Array<{ claimType: "pattern" | "feedback" | "score_reason"; claimText: string }> = [];
  for (const claim of patterns) claims.push({ claimType: "pattern", claimText: claim });
  for (const claim of feedback) claims.push({ claimType: "feedback", claimText: claim });
  for (const claim of scoreReasons) claims.push({ claimType: "score_reason", claimText: claim });

  const evidence: InsightEvidenceInput[] = [];
  claims.forEach((item, index) => {
    const words = tokenize(item.claimText).filter((word) => word.length >= 5);
    const matched = messages.find((message) => {
      const text = message.content.toLowerCase();
      return words.some((word) => text.includes(word));
    });
    const fallback = messages[Math.min(index, Math.max(0, messages.length - 1))];
    const hit = matched ?? fallback;
    if (!hit) return;
    evidence.push({
      claimType: item.claimType,
      claimText: item.claimText,
      sessionId: hit.session_id,
      messageId: hit.message_id,
    });
  });
  return evidence;
}
