import type { InsightDetails, LabeledCount, ProblemCard, PromptCoach, TopicCard } from "../types/index.js";

export interface BuildInsightDetailsInput {
  sessionCount: number;
  topicCards: TopicCard[];
  capabilityTop: LabeledCount[];
  languageTop: LabeledCount[];
  sessionTypes: LabeledCount[];
  avgMessagesPerSession: number;
  responseDist: LabeledCount[];
  timeOfDay: LabeledCount[];
  multiAssistantUsage: string;
  sourceLabels: string[];
  snippetCount: number;
  frictionItems: ProblemCard[];
  frictionTypes: LabeledCount[];
  fullyAchieved: number;
  partiallyAchieved: number;
  workingBody: string;
  hinderingBody: string;
  quickWinsBody: string;
  ambitiousBody: string;
  prompt_coach: PromptCoach;
}

export function buildInsightDetails(input: BuildInsightDetailsInput): InsightDetails {
  return {
    at_a_glance: {
      working: {
        title: "What's working",
        body: input.workingBody,
        cta: "Impressive Things",
      },
      hindering: {
        title: "What's hindering you",
        body: input.hinderingBody,
        cta: "Where Things Go Wrong",
      },
      quick_wins: {
        title: "Quick wins to try",
        body: input.quickWinsBody,
        cta: "Features to Try",
      },
      ambitious: {
        title: "Ambitious workflows",
        body: input.ambitiousBody,
        cta: "On the Horizon",
      },
    },
    what_you_work_on: {
      topics: input.topicCards.length > 0
        ? input.topicCards
        : [
            {
              title: "General Product Development",
              summary: "Cross-layer implementation and debugging conversations dominated the selected session set.",
              sessions: input.sessionCount,
            },
          ],
      top_capabilities: input.capabilityTop,
      languages: input.languageTop,
      session_types: input.sessionTypes,
    },
    how_you_use_ai: {
      overview:
        `You demonstrate a strategic multi-tool interaction style with ${input.avgMessagesPerSession.toFixed(
          1
        )} messages per session on average, favoring focused and medium-depth collaboration.`,
      key_pattern:
        "You typically move from architecture framing to implementation details, then to validation, which is a strong repeatable execution pattern.",
      response_time_distribution: input.responseDist,
      messages_by_time_of_day: input.timeOfDay,
      multi_assistant_usage: input.multiAssistantUsage,
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
          body: `You matched assistant strengths by task type across ${input.sourceLabels.join(", ") || "your active tools"}, which improved focus and velocity.`,
        },
        {
          title: "Execution Discipline",
          body: `With ${input.snippetCount} snippets and ${input.sessionCount} sessions, your workflow shows consistent movement from discussion into concrete implementation steps.`,
        },
      ],
      helped_capabilities: input.capabilityTop.slice(0, 3),
      outcomes: {
        fully_achieved: input.fullyAchieved,
        partially_achieved: input.partiallyAchieved,
      },
    },
    where_things_go_wrong: {
      intro:
        "A few recurring friction patterns appear in the selected sessions. Addressing them will improve continuity and reduce rework.",
      items: input.frictionItems,
      friction_types: input.frictionTypes,
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
    prompt_coach: input.prompt_coach,
  };
}
