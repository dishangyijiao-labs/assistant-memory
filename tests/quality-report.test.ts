import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg, makeScoreInput, getLastMessageId } from "./helpers.js";
import {
  DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE,
  QUALITY_METRIC_DEFINITIONS,
  buildQualityAnalyzerUserPrompt,
  QUALITY_ANALYZER_SYSTEM_PROMPT,
  QUALITY_ANALYZER_OUTPUT_SCHEMA,
  type QualityAnalyzerInput,
} from "../src/insights/quality-kit.js";
import {
  upsertQualityScore,
  getQualityKpiForScope,
  getTopLowQualityQuestions,
} from "../src/storage/queries/quality.js";
import { upsertSession } from "../src/storage/queries/sessions.js";
import { insertMessage } from "../src/storage/queries/messages.js";
/** Render the quality report template with provided KPI and low-quality questions (mimics cli.ts logic) */
function renderReport(
  kpi: ReturnType<typeof getQualityKpiForScope>,
  lowQuality: ReturnType<typeof getTopLowQualityQuestions>,
  dateStr?: string
): string {
  const date = dateStr ?? new Date().toISOString().slice(0, 10);
  let md = DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.replace(/\{\{date\}\}/g, date)
    .replace(/\{\{kpi\.avg_follow_up_rounds\}\}/g, String(kpi.avg_follow_up_rounds))
    .replace(/\{\{kpi\.first_pass_resolution_rate\}\}/g, String(kpi.first_pass_resolution_rate))
    .replace(/\{\{kpi\.repeated_question_ratio\}\}/g, String(kpi.repeated_question_ratio))
    .replace(/\{\{kpi\.high_quality_ratio\}\}/g, String(kpi.high_quality_ratio));

  const blockMatch = md.match(
    /\{\{#top_low_quality_questions\}\}([\s\S]*?)\{\{\/top_low_quality_questions\}\}/
  );
  if (blockMatch) {
    const template = blockMatch[1];
    const items = lowQuality
      .map(
        (q, i) =>
          template
            .replace(/\{\{rank\}\}/g, String(i + 1))
            .replace(/\{\{title\}\}/g, q.title.replace(/\|/g, "\\|"))
            .replace(/\{\{session_id\}\}/g, String(q.session_id))
            .replace(/\{\{workspace\}\}/g, q.workspace)
            .replace(/\{\{source\}\}/g, q.source)
            .replace(/\{\{score\}\}/g, String(q.score))
            .replace(/\{\{deduction_reasons\}\}/g, q.deduction_reasons)
            .replace(/\{\{required_checklist_md\}\}/g, q.required_checklist_md)
            .replace(/\{\{rewrite_short\}\}/g, q.rewrite_short)
            .replace(/\{\{rewrite_engineering\}\}/g, q.rewrite_engineering)
            .replace(/\{\{rewrite_exploratory\}\}/g, q.rewrite_exploratory)
      )
      .join("\n\n");
    md = md.replace(
      /\{\{#top_low_quality_questions\}\}[\s\S]*?\{\{\/top_low_quality_questions\}\}/,
      items || "(no low-quality questions)"
    );
  }
  md = md
    .replace(/\{\{#patterns\}\}[\s\S]*?\{\{\/patterns\}\}/g, "(patterns not yet implemented)")
    .replace(/\{\{feedback\.[^}]+\}\}/g, "—")
    .replace(/\{\{tomorrow\.[^}]+\}\}/g, "—");
  return md;
}

describe("quality-report template rendering", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("template structure", () => {
    it("template contains all required KPI placeholders", () => {
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{kpi.avg_follow_up_rounds}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{kpi.first_pass_resolution_rate}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{kpi.repeated_question_ratio}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{kpi.high_quality_ratio}}"));
    });

    it("template contains section markers for low-quality questions", () => {
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{#top_low_quality_questions}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{/top_low_quality_questions}}"));
    });

    it("template contains question item placeholders", () => {
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{rank}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{title}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{score}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{deduction_reasons}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{rewrite_short}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{rewrite_engineering}}"));
      assert.ok(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.includes("{{rewrite_exploratory}}"));
    });
  });

  describe("rendered output with empty data", () => {
    it("renders report with zero KPI values", () => {
      const kpi = getQualityKpiForScope({});
      const low = getTopLowQualityQuestions({});
      const md = renderReport(kpi, low, "2024-06-01");

      assert.ok(md.includes("# Daily Prompt Quality Report (2024-06-01)"));
      assert.ok(md.includes("Average follow-up rounds per session: 0"));
      assert.ok(md.includes("First-pass resolution rate: 0"));
      assert.ok(md.includes("(no low-quality questions)"));
    });
  });

  describe("rendered output with real data", () => {
    it("renders complete markdown with KPI and low-quality questions", () => {
      const sid = upsertSession(makeSession({ workspace: "/my-project" }));

      // Insert user messages
      insertMessage(sid, makeMsg({ content: "fix bug", timestamp: 100, role: "user" }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "answer 1", timestamp: 101, role: "assistant" }));
      insertMessage(sid, makeMsg({ content: "refactor code", timestamp: 200, role: "user" }));
      const id2 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "answer 2", timestamp: 201, role: "assistant" }));
      insertMessage(sid, makeMsg({ content: "add tests", timestamp: 300, role: "user" }));
      const id3 = getLastMessageId();

      // Score them: one low, two high
      upsertQualityScore(
        makeScoreInput({
          messageId: id1,
          sessionId: sid,
          score: 35,
          grade: "F",
          deductionsJson: JSON.stringify([
            { code: "missing_context", reason: "No error message provided", points: 30 },
            { code: "ambiguous_goal", reason: "Unclear which bug", points: 35 },
          ]),
          missingInfoChecklistJson: JSON.stringify(["error message", "stack trace", "expected behavior"]),
          rewritesJson: JSON.stringify({
            short: "Fix the null pointer in UserService.getUser()",
            engineering: "Fix NPE in UserService.getUser() when user_id is null. Node 18, PostgreSQL 15.",
            exploratory: "Investigate why UserService.getUser() sometimes returns null",
          }),
          tagsJson: JSON.stringify(["bug", "backend"]),
        })
      );
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid, score: 90, grade: "A" }));
      upsertQualityScore(makeScoreInput({ messageId: id3, sessionId: sid, score: 85, grade: "B" }));

      const kpi = getQualityKpiForScope({ sessionIds: [sid] });
      const low = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80, limit: 10 });
      const md = renderReport(kpi, low, "2024-06-15");

      // Check date in header
      assert.ok(md.includes("# Daily Prompt Quality Report (2024-06-15)"));

      // Check KPI section is populated with actual values
      assert.ok(md.includes("## 1) KPI Snapshot"));
      // high_quality_ratio: 2/3 ~ 0.67
      assert.ok(!md.includes("{{kpi."));

      // Check low-quality question section
      assert.ok(md.includes("### 1."));
      assert.ok(md.includes("fix bug"));
      assert.ok(md.includes("Quality score: 35"));
      assert.ok(md.includes("No error message provided"));
      assert.ok(md.includes("error message"));
      assert.ok(md.includes("Fix the null pointer in UserService.getUser()"));
      assert.ok(md.includes("Fix NPE in UserService.getUser()"));

      // Ensure no unresolved template placeholders for question items
      assert.ok(!md.includes("{{rank}}"));
      assert.ok(!md.includes("{{title}}"));
      assert.ok(!md.includes("{{score}}"));
      assert.ok(!md.includes("{{rewrite_short}}"));
    });

    it("renders multiple low-quality questions with correct ranking", () => {
      const sid = upsertSession(makeSession());

      insertMessage(sid, makeMsg({ content: "question alpha", timestamp: 100, role: "user" }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "question beta", timestamp: 200, role: "user" }));
      const id2 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "question gamma", timestamp: 300, role: "user" }));
      const id3 = getLastMessageId();

      upsertQualityScore(
        makeScoreInput({
          messageId: id1,
          sessionId: sid,
          score: 20,
          grade: "F",
          deductionsJson: '[{"reason":"terrible"}]',
          rewritesJson: '{"short":"better alpha","engineering":"eng alpha","exploratory":"exp alpha"}',
        })
      );
      upsertQualityScore(
        makeScoreInput({
          messageId: id2,
          sessionId: sid,
          score: 50,
          grade: "D",
          deductionsJson: '[{"reason":"mediocre"}]',
          rewritesJson: '{"short":"better beta","engineering":"eng beta","exploratory":"exp beta"}',
        })
      );
      upsertQualityScore(
        makeScoreInput({
          messageId: id3,
          sessionId: sid,
          score: 65,
          grade: "C",
          deductionsJson: '[{"reason":"okay"}]',
          rewritesJson: '{"short":"better gamma","engineering":"eng gamma","exploratory":"exp gamma"}',
        })
      );

      const low = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80, limit: 10 });
      assert.equal(low.length, 3);

      const md = renderReport(getQualityKpiForScope({ sessionIds: [sid] }), low, "2024-07-01");
      assert.ok(md.includes("### 1."));
      assert.ok(md.includes("### 2."));
      assert.ok(md.includes("### 3."));
    });

    it("escapes pipe characters in titles", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "error | crash | fail", timestamp: 100 }));
      const id1 = getLastMessageId();
      upsertQualityScore(
        makeScoreInput({
          messageId: id1,
          sessionId: sid,
          score: 30,
          grade: "F",
          deductionsJson: "[]",
          rewritesJson: '{"short":"s","engineering":"e","exploratory":"x"}',
        })
      );

      const low = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80 });
      const md = renderReport(getQualityKpiForScope({ sessionIds: [sid] }), low);

      // Pipes should be escaped in the rendered markdown
      assert.ok(md.includes("\\|"));
    });
  });

  describe("QUALITY_METRIC_DEFINITIONS", () => {
    it("defines exactly 4 metrics", () => {
      assert.equal(QUALITY_METRIC_DEFINITIONS.length, 4);
    });

    it("each metric has required fields", () => {
      for (const m of QUALITY_METRIC_DEFINITIONS) {
        assert.ok(typeof m.key === "string" && m.key.length > 0);
        assert.ok(typeof m.name === "string" && m.name.length > 0);
        assert.ok(typeof m.formula === "string" && m.formula.length > 0);
        assert.ok(typeof m.interpretation === "string" && m.interpretation.length > 0);
      }
    });

    it("has expected metric keys", () => {
      const keys = QUALITY_METRIC_DEFINITIONS.map((m) => m.key);
      assert.ok(keys.includes("avg_follow_up_rounds"));
      assert.ok(keys.includes("first_pass_resolution_rate"));
      assert.ok(keys.includes("repeated_question_ratio"));
      assert.ok(keys.includes("high_quality_ratio"));
    });
  });

  describe("QUALITY_ANALYZER_OUTPUT_SCHEMA", () => {
    it("has required top-level fields", () => {
      assert.ok("score" in QUALITY_ANALYZER_OUTPUT_SCHEMA);
      assert.ok("grade" in QUALITY_ANALYZER_OUTPUT_SCHEMA);
      assert.ok("deductions" in QUALITY_ANALYZER_OUTPUT_SCHEMA);
      assert.ok("missing_info_checklist" in QUALITY_ANALYZER_OUTPUT_SCHEMA);
      assert.ok("rewrites" in QUALITY_ANALYZER_OUTPUT_SCHEMA);
      assert.ok("tags" in QUALITY_ANALYZER_OUTPUT_SCHEMA);
    });
  });

  describe("QUALITY_ANALYZER_SYSTEM_PROMPT", () => {
    it("includes scoring rubric", () => {
      assert.ok(QUALITY_ANALYZER_SYSTEM_PROMPT.includes("Start from 100 points"));
    });

    it("includes grade mapping", () => {
      assert.ok(QUALITY_ANALYZER_SYSTEM_PROMPT.includes("A: >= 90"));
      assert.ok(QUALITY_ANALYZER_SYSTEM_PROMPT.includes("F: < 60"));
    });
  });

  describe("buildQualityAnalyzerUserPrompt", () => {
    it("includes question and workspace", () => {
      const prompt = buildQualityAnalyzerUserPrompt({
        question: "How to fix the bug?",
        workspace: "my-project",
      });
      assert.ok(prompt.includes("How to fix the bug?"));
      assert.ok(prompt.includes("my-project"));
    });

    it("handles empty question", () => {
      const prompt = buildQualityAnalyzerUserPrompt({ question: "" });
      assert.ok(prompt.includes("(empty)"));
    });

    it("handles missing optional fields", () => {
      const prompt = buildQualityAnalyzerUserPrompt({ question: "test" });
      assert.ok(prompt.includes("(unspecified)"));
      assert.ok(prompt.includes("(none)"));
    });

    it("includes constraints and acceptance criteria", () => {
      const prompt = buildQualityAnalyzerUserPrompt({
        question: "test",
        knownConstraints: ["must use TypeScript", "no external deps"],
        acceptanceCriteria: ["passes CI", "100% coverage"],
      });
      assert.ok(prompt.includes("must use TypeScript"));
      assert.ok(prompt.includes("no external deps"));
      assert.ok(prompt.includes("passes CI"));
      assert.ok(prompt.includes("100% coverage"));
    });

    it("includes RAG examples when provided", () => {
      const prompt = buildQualityAnalyzerUserPrompt(
        { question: "test question" },
        [
          { content: "Example high quality question about refactoring", score: 95, grade: "A" },
          { content: "Another example question", score: 88, grade: "B" },
        ]
      );
      assert.ok(prompt.includes("Example 1"));
      assert.ok(prompt.includes("score 95"));
      assert.ok(prompt.includes("grade A"));
      assert.ok(prompt.includes("Example 2"));
      assert.ok(prompt.includes("--- Question to analyze ---"));
    });

    it("does not include RAG section when no examples", () => {
      const prompt = buildQualityAnalyzerUserPrompt({ question: "test" });
      assert.ok(!prompt.includes("--- Example"));
      assert.ok(!prompt.includes("--- Question to analyze ---"));
    });

    it("includes all optional fields when provided", () => {
      const input: QualityAnalyzerInput = {
        question: "Why does the API timeout?",
        workspace: "backend",
        assistant: "Claude",
        sessionObjective: "Debug API performance",
        knownConstraints: ["Node 18", "PostgreSQL 15"],
        acceptanceCriteria: ["Response under 200ms"],
      };
      const prompt = buildQualityAnalyzerUserPrompt(input);
      assert.ok(prompt.includes("Why does the API timeout?"));
      assert.ok(prompt.includes("backend"));
      assert.ok(prompt.includes("Claude"));
      assert.ok(prompt.includes("Debug API performance"));
      assert.ok(prompt.includes("Node 18"));
      assert.ok(prompt.includes("Response under 200ms"));
    });
  });
});
