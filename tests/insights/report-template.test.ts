import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE } from "../../server/insights/quality-kit.js";

/**
 * Tests for the quality-report template rendering logic,
 * focusing on patterns/feedback placeholder sections.
 */

/** Minimal rendering function matching cli.ts logic */
function renderTemplate(opts: {
  date?: string;
  kpi?: { avg_follow_up_rounds: number; first_pass_resolution_rate: number; repeated_question_ratio: number; high_quality_ratio: number };
  lowQuality?: Array<{
    title: string; session_id: number; workspace: string; source: string;
    score: number; deduction_reasons: string; required_checklist_md: string;
    rewrite_short: string; rewrite_engineering: string; rewrite_exploratory: string;
  }>;
}): string {
  const kpi = opts.kpi ?? { avg_follow_up_rounds: 0, first_pass_resolution_rate: 0, repeated_question_ratio: 0, high_quality_ratio: 0 };
  const date = opts.date ?? "2024-01-01";
  let md = DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{kpi\.avg_follow_up_rounds\}\}/g, String(kpi.avg_follow_up_rounds))
    .replace(/\{\{kpi\.first_pass_resolution_rate\}\}/g, String(kpi.first_pass_resolution_rate))
    .replace(/\{\{kpi\.repeated_question_ratio\}\}/g, String(kpi.repeated_question_ratio))
    .replace(/\{\{kpi\.high_quality_ratio\}\}/g, String(kpi.high_quality_ratio));

  const blockMatch = md.match(/\{\{#top_low_quality_questions\}\}([\s\S]*?)\{\{\/top_low_quality_questions\}\}/);
  if (blockMatch) {
    const template = blockMatch[1];
    const items = (opts.lowQuality ?? [])
      .map((q, i) =>
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

describe("quality-report template – patterns/feedback placeholder sections", () => {
  it("replaces patterns block with placeholder", () => {
    const md = renderTemplate({});
    assert.ok(md.includes("(patterns not yet implemented)"));
    assert.ok(!md.includes("{{#patterns}}"));
    assert.ok(!md.includes("{{/patterns}}"));
    assert.ok(!md.includes("{{name}}"));
    assert.ok(!md.includes("{{count}}"));
    assert.ok(!md.includes("{{impact}}"));
    assert.ok(!md.includes("{{template}}"));
  });

  it("replaces feedback placeholders with dashes", () => {
    const md = renderTemplate({});
    assert.ok(!md.includes("{{feedback."));
    // Should have em-dashes in the feedback section
    const feedbackSection = md.split("Feedback Outcome")[1];
    assert.ok(feedbackSection);
    assert.ok(feedbackSection.includes("—"));
  });

  it("replaces tomorrow placeholders with dashes", () => {
    const md = renderTemplate({});
    assert.ok(!md.includes("{{tomorrow."));
    const tomorrowSection = md.split("Tomorrow's Focus")[1];
    assert.ok(tomorrowSection);
    assert.ok(tomorrowSection.includes("—"));
  });

  it("no unresolved template variables remain after full render", () => {
    const md = renderTemplate({
      date: "2024-06-01",
      kpi: { avg_follow_up_rounds: 1.5, first_pass_resolution_rate: 0.8, repeated_question_ratio: 0.1, high_quality_ratio: 0.75 },
      lowQuality: [
        {
          title: "fix bug", session_id: 1, workspace: "/ws", source: "cursor",
          score: 40, deduction_reasons: "vague", required_checklist_md: "- context",
          rewrite_short: "s", rewrite_engineering: "e", rewrite_exploratory: "x",
        },
      ],
    });
    // No {{ ... }} should remain
    const remaining = md.match(/\{\{[^}]+\}\}/g);
    assert.equal(remaining, null, `Unresolved placeholders found: ${remaining?.join(", ")}`);
  });
});

describe("quality-report template – section structure", () => {
  it("has 5 numbered sections", () => {
    const md = renderTemplate({});
    assert.ok(md.includes("## 1) KPI Snapshot"));
    assert.ok(md.includes("## 2) Top 10 Low-Quality Questions"));
    assert.ok(md.includes("## 3) Frequent Problem Patterns"));
    assert.ok(md.includes("## 4) Feedback Outcome"));
    assert.ok(md.includes("## 5) Tomorrow's Focus"));
  });

  it("KPI section shows actual values", () => {
    const md = renderTemplate({
      kpi: { avg_follow_up_rounds: 2.5, first_pass_resolution_rate: 0.85, repeated_question_ratio: 0.15, high_quality_ratio: 0.7 },
    });
    assert.ok(md.includes("2.5"));
    assert.ok(md.includes("0.85"));
    assert.ok(md.includes("0.15"));
    assert.ok(md.includes("0.7"));
  });

  it("renders low-quality question with all fields", () => {
    const md = renderTemplate({
      lowQuality: [
        {
          title: "What is wrong?",
          session_id: 42,
          workspace: "/my-project",
          source: "claude-code",
          score: 25,
          deduction_reasons: "missing context; ambiguous goal",
          required_checklist_md: "- error message\n- stack trace",
          rewrite_short: "Fix NPE in UserService",
          rewrite_engineering: "Fix NPE in UserService.getUser() on null id, Node 18",
          rewrite_exploratory: "Why does UserService sometimes throw NPE?",
        },
      ],
    });
    assert.ok(md.includes("### 1."));
    assert.ok(md.includes("What is wrong?"));
    assert.ok(md.includes("Session: 42"));
    assert.ok(md.includes("Workspace: /my-project"));
    assert.ok(md.includes("Source: claude-code"));
    assert.ok(md.includes("Quality score: 25"));
    assert.ok(md.includes("missing context; ambiguous goal"));
    assert.ok(md.includes("error message"));
    assert.ok(md.includes("Fix NPE in UserService"));
    assert.ok(md.includes("Fix NPE in UserService.getUser()"));
    assert.ok(md.includes("Why does UserService sometimes throw NPE?"));
  });
});
