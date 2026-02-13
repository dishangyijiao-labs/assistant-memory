export interface QualityAnalyzerInput {
  question: string;
  workspace?: string;
  assistant?: string;
  sessionObjective?: string;
  knownConstraints?: string[];
  acceptanceCriteria?: string[];
}

export interface QualityMetricDefinition {
  key: string;
  name: string;
  formula: string;
  interpretation: string;
}

export const QUALITY_ANALYZER_OUTPUT_SCHEMA = {
  score: "number (0-100)",
  grade: "string (A/B/C/D/F)",
  deductions: [
    {
      code: "string (missing_context|missing_constraints|missing_acceptance|ambiguous_goal|missing_repro|missing_io)",
      reason: "string",
      points: "number",
    },
  ],
  missing_info_checklist: ["string"],
  rewrites: {
    short: "string",
    engineering: "string",
    exploratory: "string",
  },
  tags: ["string"],
} as const;

export const QUALITY_ANALYZER_SYSTEM_PROMPT = [
  "You are a prompt quality reviewer for engineering workflows.",
  "Goal: improve first-pass resolution rate and reduce clarification rounds.",
  "Return STRICT JSON only. No markdown, no prose outside JSON.",
  "Use this schema exactly: {score, grade, deductions, missing_info_checklist, rewrites, tags}.",
  "Scoring rubric:",
  "- Start from 100 points.",
  "- Deduct for missing context, missing constraints, missing acceptance criteria, unclear objective, missing reproducible steps, missing I/O examples.",
  "- Keep final score in 0..100.",
  "Grade mapping:",
  "- A: >= 90",
  "- B: 80-89",
  "- C: 70-79",
  "- D: 60-69",
  "- F: < 60",
  "For rewrites, provide:",
  "- short: concise everyday version.",
  "- engineering: includes env/version/repro/constraints/DoD.",
  "- exploratory: allows broader ideation while preserving objective.",
  "Checklist should be minimal and executable (max 8 items).",
].join("\n");

function toBulletList(items: string[] | undefined): string {
  if (!items || items.length === 0) return "(none)";
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildQualityAnalyzerUserPrompt(input: QualityAnalyzerInput): string {
  return [
    "Analyze the following user request and output JSON only.",
    "",
    "User question:",
    input.question.trim() || "(empty)",
    "",
    "Workspace:",
    input.workspace?.trim() || "(unspecified)",
    "",
    "Assistant:",
    input.assistant?.trim() || "(unspecified)",
    "",
    "Session objective:",
    input.sessionObjective?.trim() || "(unspecified)",
    "",
    "Known constraints:",
    toBulletList(input.knownConstraints),
    "",
    "Acceptance criteria:",
    toBulletList(input.acceptanceCriteria),
  ].join("\n");
}

export const DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE = `# Daily Prompt Quality Report ({{date}})

## 1) KPI Snapshot
- Average follow-up rounds per session: {{kpi.avg_follow_up_rounds}}
- First-pass resolution rate: {{kpi.first_pass_resolution_rate}}
- Repeated question ratio: {{kpi.repeated_question_ratio}}
- High-quality question ratio (score >= 80): {{kpi.high_quality_ratio}}

## 2) Top 10 Low-Quality Questions (Impact Sorted)
{{#top_low_quality_questions}}
### {{rank}}. {{title}}
- Session: {{session_id}} | Workspace: {{workspace}} | Source: {{source}}
- Quality score: {{score}}
- Deduction reasons: {{deduction_reasons}}
- Required checklist:
{{required_checklist_md}}
- Rewrite options:
  - Short: {{rewrite_short}}
  - Engineering: {{rewrite_engineering}}
  - Exploratory: {{rewrite_exploratory}}
{{/top_low_quality_questions}}

## 3) Frequent Problem Patterns (Top 3)
{{#patterns}}
### {{name}}
- Frequency: {{count}}
- Why it hurts: {{impact}}
- Reusable prompt template:
\`\`\`
{{template}}
\`\`\`
{{/patterns}}

## 4) Feedback Outcome (👍/👎/🔁)
- 👍 resolved once: {{feedback.resolved_once}}
- 👎 not resolved: {{feedback.not_resolved}}
- 🔁 needs clarification: {{feedback.needs_clarification}}
- Coverage: {{feedback.coverage}}

## 5) Tomorrow's Focus
- Must-fix missing fields: {{tomorrow.must_fix_fields}}
- Suggested guardrail: {{tomorrow.guardrail}}
`;

export const QUALITY_METRIC_DEFINITIONS: QualityMetricDefinition[] = [
  {
    key: "avg_follow_up_rounds",
    name: "Average Follow-up Rounds",
    formula:
      "avg(max(user_turn_count - 1, 0)) per session, where user_turn_count is number of user messages in a session",
    interpretation: "Lower is better. Measures clarification overhead before reaching useful output.",
  },
  {
    key: "first_pass_resolution_rate",
    name: "First-pass Resolution Rate",
    formula: "count(feedback_label = 'resolved_once') / count(feedback_label is not null)",
    interpretation: "Higher is better. Directly tracks one-shot success.",
  },
  {
    key: "repeated_question_ratio",
    name: "Repeated Question Ratio",
    formula: "count(question_cluster_size > 1) / count(all_user_questions)",
    interpretation: "Lower is better. High value means repeated asks without reuse.",
  },
  {
    key: "high_quality_ratio",
    name: "High-quality Question Ratio",
    formula: "count(quality_score >= 80) / count(scored_questions)",
    interpretation: "Higher is better. Indicates quality habit formation.",
  },
];

