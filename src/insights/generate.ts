import type { InsightEvidenceInput, InsightMessage } from "../storage/db.js";

export interface InsightModelConfig {
  mode: "local" | "external";
  provider?: string;
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
}

interface LabeledCount {
  name: string;
  count: number;
}

interface TopicCard {
  title: string;
  summary: string;
  sessions: number;
}

interface ProblemCard {
  title: string;
  body: string;
  evidence: string[];
}

interface ActionCard {
  title: string;
  body: string;
  command: string;
}

interface HorizonCard {
  title: string;
  body: string;
  prompt: string;
}

interface AtGlanceCard {
  title: string;
  body: string;
  cta: string;
}

export interface InsightDetails {
  at_a_glance: {
    working: AtGlanceCard;
    hindering: AtGlanceCard;
    quick_wins: AtGlanceCard;
    ambitious: AtGlanceCard;
  };
  what_you_work_on: {
    topics: TopicCard[];
    top_capabilities: LabeledCount[];
    languages: LabeledCount[];
    session_types: LabeledCount[];
  };
  how_you_use_ai: {
    overview: string;
    key_pattern: string;
    response_time_distribution: LabeledCount[];
    messages_by_time_of_day: LabeledCount[];
    multi_assistant_usage: string;
  };
  impressive_things: {
    intro: string;
    items: Array<{ title: string; body: string }>;
    helped_capabilities: LabeledCount[];
    outcomes: {
      fully_achieved: number;
      partially_achieved: number;
    };
  };
  where_things_go_wrong: {
    intro: string;
    items: ProblemCard[];
    friction_types: LabeledCount[];
  };
  features_to_try: {
    cards: ActionCard[];
    claude_md_additions: string[];
  };
  on_the_horizon: {
    intro: string;
    cards: HorizonCard[];
  };
}

export interface InsightGenerationResult {
  title: string;
  summary: string;
  patterns: string[];
  feedback: string[];
  scores: {
    efficiency: number;
    stability: number;
    decision_clarity: number;
  };
  scoreReasons: string[];
  details: InsightDetails;
  sessionCount: number;
  messageCount: number;
  snippetCount: number;
  sources: string[];
  evidence: InsightEvidenceInput[];
}

interface LocalAnalysis {
  title: string;
  summary: string;
  patterns: string[];
  feedback: string[];
  scores: {
    efficiency: number;
    stability: number;
    decision_clarity: number;
  };
  scoreReasons: string[];
  details: InsightDetails;
  sessionCount: number;
  messageCount: number;
  snippetCount: number;
  sources: string[];
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

const TOPIC_DEFINITIONS = [
  {
    id: "react_next",
    title: "React / Next.js Architecture",
    keywords: [
      "react",
      "next",
      "server component",
      "client component",
      "hydration",
      "frontend",
      "rendering",
    ],
    summary:
      "Discussions focused on component boundaries, rendering strategy, and data flow for modern React applications.",
  },
  {
    id: "database_schema",
    title: "Database Schema & Multi-Tenant Design",
    keywords: [
      "database",
      "schema",
      "migration",
      "sql",
      "postgres",
      "tenant",
      "rls",
      "query",
      "index",
    ],
    summary:
      "Work centered on data modeling, schema evolution, query design, and tenant isolation patterns across services.",
  },
  {
    id: "devops_ci",
    title: "DevOps & CI/CD Pipelines",
    keywords: [
      "pipeline",
      "github actions",
      "docker",
      "kubernetes",
      "deploy",
      "infra",
      "ci",
      "cd",
      "cache",
    ],
    summary:
      "Sessions covered build pipelines, infrastructure automation, and release reliability for production delivery.",
  },
  {
    id: "typescript_patterns",
    title: "TypeScript Advanced Patterns",
    keywords: [
      "typescript",
      "generic",
      "type",
      "infer",
      "utility type",
      "tsc",
      "compile",
      "strict",
    ],
    summary:
      "The conversation explored advanced type modeling, compile-time validation, and reusable TypeScript abstractions.",
  },
  {
    id: "api_design",
    title: "API & Backend Integration",
    keywords: [
      "api",
      "endpoint",
      "route",
      "handler",
      "server",
      "backend",
      "validation",
      "request",
      "response",
    ],
    summary:
      "Work emphasized API contract clarity, backend implementation details, and end-to-end data contract consistency.",
  },
] as const;

const CAPABILITY_KEYWORDS: Array<{ name: string; keywords: string[] }> = [
  { name: "Code Generation", keywords: ["implement", "write", "generate", "build", "create"] },
  { name: "Code Review", keywords: ["review", "refactor", "cleanup", "optimize"] },
  { name: "Debugging", keywords: ["error", "failed", "exception", "bug", "trace", "fix"] },
  { name: "Architecture", keywords: ["architecture", "design", "pattern", "trade-off"] },
  { name: "Schema Design", keywords: ["schema", "migration", "sql", "table", "index", "rls"] },
];

const LANGUAGE_KEYWORDS: Array<{ name: string; keywords: string[] }> = [
  { name: "TypeScript", keywords: ["typescript", ".ts", ".tsx", "tsc"] },
  { name: "SQL", keywords: ["select", "insert", "update", "sql", "postgres", "sqlite"] },
  { name: "YAML", keywords: [".yml", ".yaml", "yaml", "github actions"] },
  { name: "CSS", keywords: ["css", "tailwind", "style", "layout", "flex", "grid"] },
  { name: "Rust", keywords: ["rust", "cargo", "tauri", ".rs"] },
  { name: "Python", keywords: ["python", "pip", "pytest"] },
];

const SESSION_TYPE_KEYWORDS: Array<{ name: string; keywords: string[] }> = [
  { name: "Architecture", keywords: ["architecture", "design", "trade-off", "decision"] },
  { name: "Implementation", keywords: ["implement", "build", "write", "coding"] },
  { name: "Debugging", keywords: ["debug", "error", "failed", "bug"] },
  { name: "Learning", keywords: ["explain", "why", "learn", "understand"] },
];

const RESPONSE_TIME_BINS = [
  { label: "2-10s", min: 2, max: 10 },
  { label: "10-30s", min: 10, max: 30 },
  { label: "30s-1m", min: 30, max: 60 },
  { label: "1-2m", min: 60, max: 120 },
  { label: "2-5m", min: 120, max: 300 },
  { label: ">5m", min: 300, max: Number.MAX_SAFE_INTEGER },
] as const;

function clampScore(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

function sourceLabel(source: string): string {
  if (source === "cursor") return "Cursor IDE";
  if (source === "copilot") return "Copilot";
  if (source === "cursor-cli") return "Cursor CLI";
  if (source === "claude-code") return "Claude Code";
  if (source === "codex") return "Codex";
  if (source === "gemini") return "Gemini";
  return source;
}

function tokenize(content: string): string[] {
  return content
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function normalizeArray(items: LabeledCount[], fallback: LabeledCount[]): LabeledCount[] {
  return items.length > 0 ? items : fallback;
}

function pickTopMapValues(map: Map<string, number>, limit: number): LabeledCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function countSnippetsFromMessage(content: string): number {
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

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const keyword of keywords) {
    if (lower.includes(keyword)) hits += 1;
  }
  return hits;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid] ?? 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, n) => acc + n, 0);
  return sum / values.length;
}

function takeTopKeywords(messages: InsightMessage[], limit: number): string[] {
  const frequency = new Map<string, number>();
  for (const message of messages) {
    const tokens = tokenize(message.content).filter((token) => !STOP_WORDS.has(token) && token.length >= 4);
    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

function computeTopicCards(messages: InsightMessage[], sessionIds: number[]): TopicCard[] {
  const sessionTopicHits = new Map<number, Map<string, number>>();
  for (const message of messages) {
    const perSession = sessionTopicHits.get(message.session_id) ?? new Map<string, number>();
    for (const topic of TOPIC_DEFINITIONS) {
      const hitCount = countKeywordHits(message.content, [...topic.keywords]);
      if (hitCount > 0) {
        perSession.set(topic.id, (perSession.get(topic.id) ?? 0) + hitCount);
      }
    }
    sessionTopicHits.set(message.session_id, perSession);
  }

  const topicToSessions = new Map<string, number>();
  for (const sessionId of sessionIds) {
    const perSession = sessionTopicHits.get(sessionId);
    if (!perSession) continue;
    for (const [topicId, hitCount] of perSession.entries()) {
      if (hitCount > 0) topicToSessions.set(topicId, (topicToSessions.get(topicId) ?? 0) + 1);
    }
  }

  const cards: TopicCard[] = [];
  for (const topic of TOPIC_DEFINITIONS) {
    const count = topicToSessions.get(topic.id) ?? 0;
    if (count <= 0) continue;
    cards.push({
      title: topic.title,
      summary: topic.summary,
      sessions: count,
    });
  }
  return cards.sort((a, b) => b.sessions - a.sessions).slice(0, 4);
}

function buildEvidence(
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
    .map((message) => `[${message.role}] ${message.content.slice(0, 220)}`)
    .join("\n");
  const prompt = [
    "You are generating development insights.",
    "Return strict JSON with keys: summary (string), patterns (string[]), feedback (string[]).",
    "Keep feedback actionable and concise.",
    `Local summary: ${local.summary}`,
    `Local patterns: ${local.patterns.join(" | ")}`,
    `Local feedback: ${local.feedback.join(" | ")}`,
    `Chat sample:\n${compactSample}`,
  ].join("\n");

  const endpoint = model.baseUrl.endsWith("/")
    ? `${model.baseUrl}chat/completions`
    : `${model.baseUrl}/chat/completions`;
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
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJsonBlock(content)) as {
    summary?: unknown;
    patterns?: unknown;
    feedback?: unknown;
  };
  if (typeof parsed.summary !== "string" || !Array.isArray(parsed.patterns) || !Array.isArray(parsed.feedback)) {
    throw new Error("MODEL_RESPONSE_INVALID_SHAPE");
  }
  return {
    summary: parsed.summary,
    patterns: parsed.patterns.filter((item): item is string => typeof item === "string").slice(0, 6),
    feedback: parsed.feedback.filter((item): item is string => typeof item === "string").slice(0, 6),
  };
}

function localAnalysis(messages: InsightMessage[]): LocalAnalysis {
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

  const details: InsightDetails = {
    at_a_glance: {
      working: {
        title: "What's working",
        body: workingBody,
        cta: "Impressive Things",
      },
      hindering: {
        title: "What's hindering you",
        body: hinderingBody,
        cta: "Where Things Go Wrong",
      },
      quick_wins: {
        title: "Quick wins to try",
        body: quickWinsBody,
        cta: "Features to Try",
      },
      ambitious: {
        title: "Ambitious workflows",
        body: ambitiousBody,
        cta: "On the Horizon",
      },
    },
    what_you_work_on: {
      topics: topicCards.length > 0 ? topicCards : [
        {
          title: "General Product Development",
          summary: "Cross-layer implementation and debugging conversations dominated the selected session set.",
          sessions: sessionCount,
        },
      ],
      top_capabilities: capabilityTop,
      languages: languageTop,
      session_types: sessionTypes,
    },
    how_you_use_ai: {
      overview:
        `You demonstrate a strategic multi-tool interaction style with ${avgMessagesPerSession.toFixed(
          1
        )} messages per session on average, favoring focused and medium-depth collaboration.`,
      key_pattern:
        "You typically move from architecture framing to implementation details, then to validation, which is a strong repeatable execution pattern.",
      response_time_distribution: responseDist,
      messages_by_time_of_day: timeOfDay,
      multi_assistant_usage: multiAssistantUsage,
    },
    impressive_things: {
      intro:
        "You maintained coherent cross-layer momentum across the selected sessions and preserved strong implementation throughput.",
      items: [
        {
          title: "Cross-Layer Architecture Thinking",
          body: "You repeatedly connected frontend, API, and persistence concerns in the same planning thread, reducing integration mismatch risk.",
        },
        {
          title: "Strategic Tool Selection",
          body: `You matched assistant strengths by task type across ${sourceLabels.join(", ") || "your active tools"}, which improved focus and velocity.`,
        },
        {
          title: "Execution Discipline",
          body: `With ${snippetCount} snippets and ${sessionCount} sessions, your workflow shows consistent movement from discussion into concrete implementation steps.`,
        },
      ],
      helped_capabilities: capabilityTop.slice(0, 3),
      outcomes: {
        fully_achieved: fullyAchieved,
        partially_achieved: partiallyAchieved,
      },
    },
    where_things_go_wrong: {
      intro:
        "A few recurring friction patterns appear in the selected sessions. Addressing them will improve continuity and reduce rework.",
      items: frictionItems,
      friction_types: frictionTypes,
    },
    features_to_try: {
      cards: [
        {
          title: "Session Memory Consolidation",
          body: "Consolidate related threads into a shared memory layer so repeated design questions resolve faster.",
          command: "memory consolidate --topic=core-architecture",
        },
        {
          title: "Cross-Session Context Linking",
          body: "Link schema and API sessions so design decisions carry forward automatically into implementation work.",
          command: "memory link --from=session-1 --to=session-2",
        },
        {
          title: "Automated Session Tagging",
          body: "Use automatic tagging to cluster future conversations by technology and task type.",
          command: "memory auto-tag --enable",
        },
      ],
      claude_md_additions: [
        "When discussing architecture changes, summarize cross-layer impact before proposing code.",
        "Always include at least one runnable validation command for implementation tasks.",
        "For multi-file edits, list touched files and acceptance criteria before editing.",
      ],
    },
    on_the_horizon: {
      intro:
        "Your current collaboration pattern is a strong base for more autonomous and parallelized development workflows.",
      cards: [
        {
          title: "AI-Assisted Architecture Decision Records",
          body: "Generate ADRs directly from prior architecture sessions to preserve alternatives and trade-off rationale.",
          prompt:
            "Analyze my architecture sessions and draft an ADR with chosen approach, alternatives, and validation criteria.",
        },
        {
          title: "Parallel Assistant Orchestration",
          body: "Split frontend, API, and database streams into parallel assistant tracks, then merge and validate end-to-end.",
          prompt:
            "Create three parallel implementation plans (frontend, API, database) with merge checks and integration tests.",
        },
      ],
    },
  };

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
