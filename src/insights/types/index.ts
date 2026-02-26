import type { InsightEvidenceInput } from "../../storage/db.js";

export interface InsightModelConfig {
  mode: "local" | "external" | "agent";
  provider?: string;
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
}

export interface LabeledCount {
  name: string;
  count: number;
}

export interface TopicCard {
  title: string;
  summary: string;
  sessions: number;
}

export interface ProblemCard {
  title: string;
  body: string;
  evidence: string[];
}

export interface ActionCard {
  title: string;
  body: string;
  command: string;
}

export interface HorizonCard {
  title: string;
  body: string;
  prompt: string;
}

export interface AtGlanceCard {
  title: string;
  body: string;
  cta: string;
}

export interface PromptCoachKpis {
  depth_score: number;
  token_efficiency_score: number;
  first_pass_resolution_rate: number | null;
  high_quality_ratio: number | null;
  repeated_question_ratio: number | null;
}

export interface PromptIssue {
  issue: string;
  frequency: number;
  impact: "high" | "medium" | "low";
  why_it_hurts: string;
  evidence: Array<{ session_id: number; message_id: number }>;
}

export interface PromptPlaybook {
  name: string;
  when_to_use: string;
  rewrite_short: string;
  rewrite_deep: string;
  rewrite_token_lean: string;
  checklist: string[];
  token_budget_hint: string;
  expected_gain: string;
}

export interface PromptCoach {
  kpis: PromptCoachKpis;
  top_issues: PromptIssue[];
  playbooks: PromptPlaybook[];
  next_week_plan: string[];
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
  prompt_coach?: PromptCoach;
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

export interface LocalAnalysis {
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
  prompt_coach: PromptCoach;
}
