import type { InsightMessage, QualityKpiSnapshot, LowQualityQuestion } from "../../storage/db.js";
import type { LabeledCount, LocalAnalysis, ProblemCard, PromptCoach, PromptIssue, PromptPlaybook } from "../types/index.js";

export interface QualityContext {
  kpi: QualityKpiSnapshot;
  topLowQualityQuestions: LowQualityQuestion[];
}
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

const DEPTH_KEYWORDS = ["tradeoff", "trade-off", "assumption", "risk", "criteria", "constraint", "alternative", "requirement", "consideration"];
const TOKEN_EFFICIENCY_KEYWORDS = ["as a list", "concise", "brief", "bullet", "short", "summarize", "tl;dr", "keep it", "in \\d+ lines?"];
const CONSTRAINT_KEYWORDS = ["must", "should", "limit", "max", "at most", "no more than", "constraint", "require"];
const ACCEPTANCE_KEYWORDS = ["should", "expect", "must", "verify", "test", "assert", "check that", "acceptance"];
const FORMAT_KEYWORDS = ["list", "table", "json", "markdown", "bullet", "format", "concise", "brief"];

interface AntiPatternDef {
  name: string;
  impact: "high" | "medium" | "low";
  why_it_hurts: string;
  detect: (content: string, contentLower: string) => boolean;
  playbook: PromptPlaybook;
}

const ANTI_PATTERNS: AntiPatternDef[] = [
  {
    name: "Vague goal",
    impact: "high",
    why_it_hurts: "Without a clear goal, the assistant guesses intent and produces generic or irrelevant output, wasting tokens and requiring follow-ups.",
    detect: (content, lower) => !content.includes("?") && content.length < 80 && !content.includes("```"),
    playbook: {
      name: "Goal-First Prompting",
      when_to_use: "When you catch yourself writing a short, open-ended request without a specific deliverable.",
      rewrite_short: "Refactor the login handler to return 401 on expired tokens.",
      rewrite_deep: "Refactor the login handler: return 401 on expired tokens, add refresh-token rotation, and include integration test stubs for both paths.",
      rewrite_token_lean: "Fix login handler: 401 on expired token. Show only changed lines.",
      checklist: ["State the specific deliverable", "Name the file or function", "Describe the expected output shape"],
      token_budget_hint: "Keep goal statement under 2 sentences; details go in constraints.",
      expected_gain: "50-70% fewer clarification round-trips.",
    },
  },
  {
    name: "Missing constraints",
    impact: "high",
    why_it_hurts: "Unconstrained prompts let the assistant pick arbitrary scope, performance targets, and tech choices, often requiring rework.",
    detect: (content, lower) =>
      content.length > 100 && !CONSTRAINT_KEYWORDS.some((kw) => lower.includes(kw)),
    playbook: {
      name: "Constraint Injection",
      when_to_use: "When your prompt describes what to build but not the boundaries (performance, size, compatibility).",
      rewrite_short: "Add pagination to /api/users. Max 50 per page, cursor-based, must work with existing auth middleware.",
      rewrite_deep: "Add cursor-based pagination to /api/users. Max 50/page, keyset pagination on created_at, backward-compatible response envelope, must not break existing mobile client contract.",
      rewrite_token_lean: "Paginate /api/users: cursor-based, max 50, keyset on created_at. Diff only.",
      checklist: ["Add at least one 'must' or 'must not'", "Specify size/performance limits", "Name compatibility requirements"],
      token_budget_hint: "2-3 constraint bullets add ~30 tokens but save entire rework cycles.",
      expected_gain: "40-60% reduction in scope-creep rework.",
    },
  },
  {
    name: "No acceptance criteria",
    impact: "medium",
    why_it_hurts: "Without success criteria, you cannot objectively evaluate the output and end up in subjective revision loops.",
    detect: (content, lower) =>
      content.length > 120 && !ACCEPTANCE_KEYWORDS.some((kw) => lower.includes(kw)),
    playbook: {
      name: "Acceptance-Driven Prompting",
      when_to_use: "When you would struggle to write a pass/fail check for the expected output.",
      rewrite_short: "Write a date parser that handles ISO-8601 and Unix timestamps. It should return null for invalid input and never throw.",
      rewrite_deep: "Write a date parser: accepts ISO-8601 and Unix timestamps, returns Date | null, never throws. Include 5 test cases covering edge cases (empty string, negative timestamp, timezone offset).",
      rewrite_token_lean: "Date parser: ISO-8601 + Unix → Date|null, no throw. Add 3 test cases.",
      checklist: ["Define at least one 'should' or 'must' for output", "Include a test case or example", "Specify error behavior"],
      token_budget_hint: "One 'should …' sentence plus one example adds ~20 tokens.",
      expected_gain: "30-50% fewer revision cycles.",
    },
  },
  {
    name: "No output format",
    impact: "medium",
    why_it_hurts: "Unspecified format leads to verbose prose when you wanted a table, or raw code when you wanted an explanation, wasting tokens on reformatting.",
    detect: (content, lower) =>
      content.length > 80 && !FORMAT_KEYWORDS.some((kw) => lower.includes(kw)),
    playbook: {
      name: "Format-First Framing",
      when_to_use: "When you know exactly how you want to consume the output (paste into code, scan a table, read a summary).",
      rewrite_short: "List the top 5 performance bottlenecks as a numbered list with one sentence each.",
      rewrite_deep: "Analyze performance bottlenecks. Return a markdown table with columns: Location, Impact (high/med/low), Fix complexity, Suggested action. Max 7 rows.",
      rewrite_token_lean: "Top 5 perf issues. Numbered list, 1 sentence each. No preamble.",
      checklist: ["Name the output format (list, table, code block, JSON)", "Specify length or row limit", "Say whether preamble/explanation is wanted"],
      token_budget_hint: "Adding 'as a list of N items' costs ~8 tokens, saves hundreds in unwanted prose.",
      expected_gain: "60-80% reduction in reformatting follow-ups.",
    },
  },
];

export function computePromptCoach(
  messages: InsightMessage[],
  qualityContext?: QualityContext,
): PromptCoach {
  try {
    const userMessages = messages.filter((m) => m.role === "user");
    const totalUser = Math.max(1, userMessages.length);

    // Depth score: % of user messages >150 chars containing depth keywords
    const deepCount = userMessages.filter((m) => {
      if (m.content.length <= 150) return false;
      const lower = m.content.toLowerCase();
      return DEPTH_KEYWORDS.some((kw) => lower.includes(kw));
    }).length;
    const depth_score = clampScore((deepCount / totalUser) * 200);

    // Token efficiency score: % of user messages with format/length directives
    const tokenEfficientRegex = new RegExp(TOKEN_EFFICIENCY_KEYWORDS.join("|"), "i");
    const efficientCount = userMessages.filter((m) => tokenEfficientRegex.test(m.content)).length;
    const token_efficiency_score = clampScore((efficientCount / totalUser) * 300);

    // Detect anti-patterns
    const patternHits: Array<{ def: AntiPatternDef; evidence: Array<{ session_id: number; message_id: number }>; frequency: number }> = [];

    for (const pattern of ANTI_PATTERNS) {
      const evidence: Array<{ session_id: number; message_id: number }> = [];
      for (const m of userMessages) {
        const lower = m.content.toLowerCase();
        if (pattern.detect(m.content, lower)) {
          evidence.push({ session_id: m.session_id, message_id: m.message_id });
        }
      }
      if (evidence.length > 0) {
        patternHits.push({ def: pattern, evidence, frequency: evidence.length });
      }
    }

    // Boost anti-pattern frequency using quality deduction reasons
    if (qualityContext?.topLowQualityQuestions.length) {
      const allDeductions = qualityContext.topLowQualityQuestions
        .flatMap((q) => q.deduction_reasons.split(";").map((s) => s.trim().toLowerCase()));
      for (const hit of patternHits) {
        const boost = allDeductions.filter((d) => d.includes(hit.def.name.toLowerCase())).length;
        hit.frequency += boost;
      }
    }

    // Sort by frequency descending, take top 3
    patternHits.sort((a, b) => b.frequency - a.frequency);
    const top3 = patternHits.slice(0, 3);

    const top_issues: PromptIssue[] = top3.map((hit) => ({
      issue: hit.def.name,
      frequency: hit.frequency,
      impact: hit.def.impact,
      why_it_hurts: hit.def.why_it_hurts,
      evidence: hit.evidence.slice(0, 5),
    }));

    const playbooks: PromptPlaybook[] = top3.map((hit) => hit.def.playbook);

    // Generate next-week plan based on detected issues
    const detectedNames = new Set(top3.map((h) => h.def.name));
    const next_week_plan: string[] = [];

    if (detectedNames.has("Vague goal")) {
      next_week_plan.push("Practice writing a one-sentence goal statement before every prompt.");
    }
    if (detectedNames.has("Missing constraints")) {
      next_week_plan.push("Add at least two explicit constraints (must/must-not) to each implementation prompt.");
    }
    if (detectedNames.has("No acceptance criteria")) {
      next_week_plan.push("Include one test case or success criterion in every prompt over 100 characters.");
    }
    if (detectedNames.has("No output format")) {
      next_week_plan.push("Specify the desired output format (list, table, code block) in every prompt.");
    }
    // Fill to 5 items with general advice
    const generalAdvice = [
      "Review your three longest sessions and identify where a better initial prompt could have saved follow-ups.",
      "Try the rewrite templates from your top playbook on at least 3 real prompts this week.",
      "Measure your first-pass success rate by counting how often the first response is usable without edits.",
      "Experiment with token-lean rewrites to reduce response length without losing quality.",
      "Create a personal prompt checklist based on your most frequent anti-patterns.",
    ];
    for (const advice of generalAdvice) {
      if (next_week_plan.length >= 5) break;
      next_week_plan.push(advice);
    }

    const hasQualitySample = (qualityContext?.kpi.scored_question_count ?? 0) > 0;

    return {
      kpis: {
        depth_score,
        token_efficiency_score,
        first_pass_resolution_rate: hasQualitySample ? qualityContext!.kpi.first_pass_resolution_rate : null,
        high_quality_ratio: hasQualitySample ? qualityContext!.kpi.high_quality_ratio : null,
        repeated_question_ratio: hasQualitySample ? qualityContext!.kpi.repeated_question_ratio : null,
      },
      top_issues,
      playbooks,
      next_week_plan: next_week_plan.slice(0, 5),
    };
  } catch {
    // Never throw — return safe defaults
    return {
      kpis: {
        depth_score: 0,
        token_efficiency_score: 0,
        first_pass_resolution_rate: null,
        high_quality_ratio: null,
        repeated_question_ratio: null,
      },
      top_issues: [],
      playbooks: [],
      next_week_plan: [],
    };
  }
}

export function localAnalysis(messages: InsightMessage[], qualityContext?: QualityContext): LocalAnalysis {
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

  const promptCoach = computePromptCoach(messages, qualityContext);

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
    prompt_coach: promptCoach,
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
    prompt_coach: promptCoach,
  };
}
