import type { InsightMessage } from "../../storage/db.js";
import type { LabeledCount, LocalAnalysis, ProblemCard } from "../types/index.js";
import {
  CAPABILITY_KEYWORDS,
  LANGUAGE_KEYWORDS,
  RESPONSE_TIME_BINS,
  SESSION_TYPE_KEYWORDS,
} from "./config.js";
import { buildInsightDetails } from "./details.js";
import {
  average,
  clampScore,
  countKeywordHits,
  countSnippetsFromMessage,
  median,
  normalizeArray,
  pickTopMapValues,
  sourceLabel,
  tokenize,
} from "./helpers.js";
import { computeTopicCards, takeTopKeywords } from "./topics.js";

export function localAnalysis(messages: InsightMessage[]): LocalAnalysis {
  const totalMessages = messages.length;
  const sessionIds = [...new Set(messages.map((message) => message.session_id))];
  const sessionCount = Math.max(1, sessionIds.length);
  const sourceCount = new Map<string, number>();
  const capabilityCount = new Map<string, number>();
  const languageCount = new Map<string, number>();
  const sessionTypeCount = new Map<string, number>();
  const errorTerms = ["error", "failed", "exception", "timeout", "bug", "broken"];
  const uncertaintyTerms = ["not sure", "unsure", "maybe", "perhaps", "unclear", "unknown", "不确定", "可能"];
  let userCount = 0;
  let assistantCount = 0;
  let firstTimestamp = Number.MAX_SAFE_INTEGER;
  let lastTimestamp = 0;
  let totalChars = 0;
  let errorHits = 0;
  let uncertaintyHits = 0;
  let snippetCount = 0;

  const responseIntervalsSec: number[] = [];
  const sortedByTime = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  for (let index = 1; index < sortedByTime.length; index += 1) {
    const previous = sortedByTime[index - 1];
    const current = sortedByTime[index];
    if (previous?.role === "assistant" && current?.role === "user") {
      const delta = (current.timestamp - previous.timestamp) / 1000;
      if (delta >= 2 && delta < 3600) responseIntervalsSec.push(delta);
    }
  }

  const timeOfDayCount = new Map<string, number>([
    ["Morning (6-12)", 0],
    ["Afternoon (12-18)", 0],
    ["Evening (18-24)", 0],
    ["Night (0-6)", 0],
  ]);

  for (const message of messages) {
    sourceCount.set(message.source, (sourceCount.get(message.source) ?? 0) + 1);
    if (message.role === "user") userCount += 1;
    if (message.role === "assistant") assistantCount += 1;
    totalChars += message.content.length;
    firstTimestamp = Math.min(firstTimestamp, message.timestamp);
    lastTimestamp = Math.max(lastTimestamp, message.timestamp);
    snippetCount += countSnippetsFromMessage(message.content);

    const contentLower = message.content.toLowerCase();
    if (errorTerms.some((term) => contentLower.includes(term))) errorHits += 1;
    if (uncertaintyTerms.some((term) => contentLower.includes(term))) uncertaintyHits += 1;

    for (const cap of CAPABILITY_KEYWORDS) {
      const hits = countKeywordHits(contentLower, cap.keywords);
      if (hits > 0) capabilityCount.set(cap.name, (capabilityCount.get(cap.name) ?? 0) + hits);
    }
    for (const language of LANGUAGE_KEYWORDS) {
      const hits = countKeywordHits(contentLower, language.keywords);
      if (hits > 0) languageCount.set(language.name, (languageCount.get(language.name) ?? 0) + hits);
    }
    for (const sessionType of SESSION_TYPE_KEYWORDS) {
      const hits = countKeywordHits(contentLower, sessionType.keywords);
      if (hits > 0) sessionTypeCount.set(sessionType.name, (sessionTypeCount.get(sessionType.name) ?? 0) + hits);
    }

    const hour = new Date(message.timestamp).getHours();
    const timeBucket =
      hour >= 6 && hour < 12
        ? "Morning (6-12)"
        : hour >= 12 && hour < 18
          ? "Afternoon (12-18)"
          : hour >= 18
            ? "Evening (18-24)"
            : "Night (0-6)";
    timeOfDayCount.set(timeBucket, (timeOfDayCount.get(timeBucket) ?? 0) + 1);
  }

  const topSources = pickTopMapValues(sourceCount, 6);
  const sourceLabels = topSources.map((entry) => sourceLabel(entry.name));
  const avgMessagesPerSession = totalMessages / sessionCount;
  const avgChars = totalChars / Math.max(1, totalMessages);
  const snippetRatio = snippetCount / Math.max(1, totalMessages);
  const errorRatio = errorHits / Math.max(1, totalMessages);
  const uncertaintyRatio = uncertaintyHits / Math.max(1, totalMessages);
  const timespanHours = Math.max(1, Math.round((lastTimestamp - firstTimestamp) / (1000 * 60 * 60)));

  let efficiency = 84;
  if (avgMessagesPerSession > 24) efficiency -= 14;
  else if (avgMessagesPerSession > 16) efficiency -= 8;
  else if (avgMessagesPerSession < 10) efficiency += 3;
  if (avgChars > 1100) efficiency -= 5;
  if (snippetRatio < 0.18) efficiency -= 4;

  let stability = 82;
  if (errorRatio > 0.28) stability -= 16;
  else if (errorRatio > 0.18) stability -= 10;
  else stability += 2;

  let decisionClarity = 83;
  if (uncertaintyRatio > 0.2) decisionClarity -= 16;
  else if (uncertaintyRatio > 0.12) decisionClarity -= 9;
  if (userCount > assistantCount * 1.8) decisionClarity -= 5;

  efficiency = clampScore(efficiency);
  stability = clampScore(stability);
  decisionClarity = clampScore(decisionClarity);

  const scoreReasons = [
    `Efficiency ${efficiency}: average ${avgMessagesPerSession.toFixed(1)} messages/session with ${snippetCount} runnable snippets captured.`,
    `Stability ${stability}: error-term ratio ${(errorRatio * 100).toFixed(1)}% across the analyzed conversation window.`,
    `Decision clarity ${decisionClarity}: uncertainty-term ratio ${(uncertaintyRatio * 100).toFixed(1)}% with user/assistant ratio ${userCount}:${assistantCount}.`,
  ];

  const topKeywords = takeTopKeywords(messages.filter((message) => message.role === "user"), 6);
  const topicCards = computeTopicCards(messages, sessionIds);
  const dominantTopic = topicCards[0]?.title ?? "Cross-layer implementation";

  const responseDist = RESPONSE_TIME_BINS.map((bin) => ({
    name: bin.label,
    count: responseIntervalsSec.filter((seconds) => seconds >= bin.min && seconds < bin.max).length,
  }));
  const timeOfDay = pickTopMapValues(timeOfDayCount, 4);
  const capabilityTop = normalizeArray(pickTopMapValues(capabilityCount, 5), [
    { name: "Code Generation", count: Math.max(1, Math.round(totalMessages / 8)) },
    { name: "Architecture", count: Math.max(1, Math.round(totalMessages / 10)) },
    { name: "Debugging", count: Math.max(1, Math.round(totalMessages / 12)) },
  ]);
  const languageTop = normalizeArray(pickTopMapValues(languageCount, 5), [
    { name: "TypeScript", count: Math.max(1, Math.round(totalMessages / 6)) },
    { name: "SQL", count: Math.max(1, Math.round(totalMessages / 14)) },
  ]);
  const sessionTypes = normalizeArray(pickTopMapValues(sessionTypeCount, 4), [
    { name: "Implementation", count: Math.max(1, Math.round(sessionCount * 0.5)) },
    { name: "Architecture", count: Math.max(1, Math.round(sessionCount * 0.4)) },
    { name: "Debugging", count: Math.max(1, Math.round(sessionCount * 0.2)) },
  ]);

  const medianResponse = median(responseIntervalsSec);
  const avgResponse = average(responseIntervalsSec);
  const multiAssistantUsage =
    sourceLabels.length > 1
      ? `You use ${sourceLabels.length} assistants with clear specialization: ${sourceLabels.join(", ")}. You generally switch assistants sequentially by task shape.`
      : `Most activity is concentrated in ${sourceLabels[0] ?? "a single assistant"}, indicating stable tooling preference for this window.`;

  const fragmentationRisk = sourceLabels.length >= 4;
  const depthRisk = avgMessagesPerSession < 8;
  const validationRisk = snippetRatio < 0.2;

  const frictionItems: ProblemCard[] = [];
  if (fragmentationRisk) {
    frictionItems.push({
      title: "Context Fragmentation Across Tools",
      body: `Switching between ${sourceLabels.length} assistants increases context reset overhead. Consolidate related sessions to preserve architectural continuity.`,
      evidence: [
        `Detected active usage across ${sourceLabels.join(", ")} in the same analysis range.`,
        "Link related sessions before starting follow-up implementation tasks.",
      ],
    });
  }
  if (depthRisk) {
    frictionItems.push({
      title: "Breadth Over Depth in Single Sessions",
      body: `Average session depth is ${avgMessagesPerSession.toFixed(
        1
      )} messages. Splitting broad topics into focused deep-dive sessions will improve decision quality.`,
      evidence: [
        `Current average: ${avgMessagesPerSession.toFixed(1)} messages/session.`,
        "Use explicit sub-goals for architecture, implementation, and validation stages.",
      ],
    });
  }
  if (validationRisk) {
    frictionItems.push({
      title: "Under-Utilizing Runnable Validation",
      body: "Many sessions are discussion-heavy without enough executable checks. Add concrete run/test steps earlier.",
      evidence: [
        `Snippet density is ${snippetRatio.toFixed(2)} snippets/message, which is below the target validation baseline.`,
        "Prefer prompts that require runnable commands and verification output.",
      ],
    });
  }
  if (frictionItems.length === 0) {
    frictionItems.push({
      title: "No Critical Friction Detected",
      body: "Your workflow is stable overall. Focus on incremental quality improvements rather than major process changes.",
      evidence: ["Scores and keyword signals indicate balanced usage with manageable risk."],
    });
  }

  const frictionTypes: LabeledCount[] = [];
  if (fragmentationRisk) frictionTypes.push({ name: "Context Loss", count: sourceLabels.length - 2 });
  if (depthRisk) frictionTypes.push({ name: "Shallow Coverage", count: Math.max(1, Math.round(10 - avgMessagesPerSession)) });
  if (validationRisk) frictionTypes.push({ name: "Missing Validation", count: Math.max(1, Math.round((0.2 - snippetRatio) * 10)) });
  if (frictionTypes.length === 0) frictionTypes.push({ name: "Minor Friction", count: 1 });

  const fullyAchieved = Math.max(1, Math.round((efficiency + stability + decisionClarity) / 60));
  const partiallyAchieved = Math.max(1, Math.round((100 - efficiency) / 30));

  const patterns = [
    `Primary workstream: ${dominantTopic}.`,
    topKeywords.length > 0 ? `Frequent user themes: ${topKeywords.slice(0, 4).join(", ")}.` : "No stable keyword clusters detected.",
    `Tool distribution is led by ${sourceLabels.slice(0, 2).join(" and ") || "a single source"}.`,
  ];

  const feedback = [
    fragmentationRisk
      ? "Create a short shared context note when switching between assistants to reduce re-explaining architectural decisions."
      : "Keep your current assistant specialization strategy and continue documenting cross-session decisions.",
    depthRisk
      ? "Break broad requests into one topic per session and require completion criteria before moving on."
      : "Your session depth is healthy; keep preserving explicit next-step checklists.",
    validationRisk
      ? "Increase executable snippets and test-first prompts to validate assumptions earlier."
      : "Validation density looks good; continue attaching runnable verification steps to implementation tasks.",
  ];

  const summary = [
    `${totalMessages} messages across ${sessionCount} sessions in ~${timespanHours}h.`,
    `Average ${avgMessagesPerSession.toFixed(1)} msgs/session, ${snippetCount} snippets, top sources: ${sourceLabels.join(", ") || "n/a"}.`,
  ].join(" ");

  const workingBody = `You are effectively coordinating ${sourceLabels.length} assistant workflows across ${sessionCount} sessions. The strongest cluster is ${dominantTopic}, and your scoring profile indicates solid delivery discipline.`;
  const hinderingBody = frictionItems[0]?.body ?? "No major friction was detected in the selected sessions.";
  const quickWinsBody =
    "Prioritize tighter session scopes, preserve context handoffs, and require executable validation in each implementation cycle.";
  const ambitiousBody =
    "As your session library grows, you can automate cross-session orchestration and generate reusable architecture artifacts from historical conversations.";

  const details = buildInsightDetails({
    sessionCount,
    topicCards,
    capabilityTop,
    languageTop,
    sessionTypes,
    avgMessagesPerSession,
    responseDist,
    timeOfDay,
    multiAssistantUsage,
    sourceLabels,
    snippetCount,
    frictionItems,
    frictionTypes,
    fullyAchieved,
    partiallyAchieved,
    workingBody,
    hinderingBody,
    quickWinsBody,
    ambitiousBody,
  });

  return {
    title: "Weekly Development Summary",
    summary,
    patterns,
    feedback,
    scores: {
      efficiency,
      stability,
      decision_clarity: decisionClarity,
    },
    scoreReasons,
    details,
    sessionCount,
    messageCount: totalMessages,
    snippetCount,
    sources: sourceLabels,
  };
}
