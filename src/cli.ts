import { writeFileSync } from "fs";
import { Command } from "commander";
import { runIngest } from "./ingest/index.js";
import { ingestCursor } from "./ingest/cursor.js";
import * as db from "./storage/db.js";
import { startServer } from "./web/server.js";
import {
  DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE,
  QUALITY_ANALYZER_OUTPUT_SCHEMA,
  QUALITY_ANALYZER_SYSTEM_PROMPT,
  QUALITY_METRIC_DEFINITIONS,
} from "./insights/quality-kit.js";

const program = new Command();

program
  .name("assistmem")
  .description("Index and search Cursor IDE, Copilot (VS Code), Cursor/Claude Code/Codex/Gemini CLI locally (no login).")
  .version("0.1.0");

program
  .command("index")
  .description("Index chat history from Cursor IDE, Copilot, Cursor CLI, Claude Code CLI, Codex CLI, Gemini CLI.")
  .option("-s, --sources <list>", "Comma-separated: cursor,cursor-cli,copilot,claude-code,codex,gemini (default: all)")
  .action((opts: { sources?: string }) => {
    const sources = opts.sources
      ? (opts.sources.split(",").map((s) => s.trim()) as Array<"cursor" | "cursor-cli" | "copilot" | "claude-code" | "codex" | "gemini">)
      : undefined;
    console.error("Indexing sources:", sources ?? "all");
    const stats = runIngest({ sources });
    console.error("Indexed", stats.sessions, "sessions,", stats.messages, "messages.");
    console.error("Database:", db.getDbPath());
  });

program
  .command("search <query>")
  .description("Search chat history by keyword (FTS).")
  .option("-n, --limit <number>", "Max results (default 20)", "20")
  .action((query: string, opts: { limit?: string }) => {
    const limit = Math.min(100, Math.max(1, parseInt(opts.limit ?? "20", 10) || 20));
    const results = db.searchMessages(query, limit);
    if (results.length === 0) {
      console.log("No matches. Try 'assistmem index' first, or a different query.");
      return;
    }
    for (const r of results) {
      console.log("---");
      console.log("[", r.source, "]", r.workspace || "(default)", new Date(r.last_at).toISOString());
      console.log(r.snippet);
    }
    console.log("---");
    console.log(results.length, "result(s)");
  });

program
  .command("stats")
  .description("Show database path and session/message counts.")
  .action(() => {
    const stats = db.getStats();
    console.log("Database:", db.getDbPath());
    console.log("Sessions:", stats.sessions, "Messages:", stats.messages);
  });

program
  .command("serve")
  .description("Start web server for search in the browser.")
  .option("-p, --port <number>", "Port (default 3000)", "3000")
  .action((opts: { port?: string }) => {
    const port = parseInt(opts.port ?? "3000", 10) || 3000;
    startServer(port);
  });

program
  .command("quality-kit")
  .description("Print prompt-quality analyzer prompt, JSON schema, and daily report template.")
  .option("-f, --format <type>", "Output format: markdown|json (default markdown)", "markdown")
  .action((opts: { format?: string }) => {
    const format = (opts.format ?? "markdown").trim().toLowerCase();
    if (format === "json") {
      console.log(
        JSON.stringify(
          {
            analyzer: {
              system_prompt: QUALITY_ANALYZER_SYSTEM_PROMPT,
              output_schema: QUALITY_ANALYZER_OUTPUT_SCHEMA,
            },
            daily_report: {
              markdown_template: DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE,
              metrics: QUALITY_METRIC_DEFINITIONS,
            },
          },
          null,
          2
        )
      );
      return;
    }
    console.log("# Prompt Quality Kit");
    console.log("");
    console.log("## Analyzer System Prompt");
    console.log("```text");
    console.log(QUALITY_ANALYZER_SYSTEM_PROMPT);
    console.log("```");
    console.log("");
    console.log("## Analyzer JSON Output Schema");
    console.log("```json");
    console.log(JSON.stringify(QUALITY_ANALYZER_OUTPUT_SCHEMA, null, 2));
    console.log("```");
    console.log("");
    console.log("## Daily Report Metrics");
    for (const metric of QUALITY_METRIC_DEFINITIONS) {
      console.log(`- ${metric.name} (\`${metric.key}\`)`);
      console.log(`  formula: ${metric.formula}`);
      console.log(`  interpretation: ${metric.interpretation}`);
    }
    console.log("");
    console.log("## Daily Report Markdown Template");
    console.log("```md");
    console.log(DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE);
    console.log("```");
  });

program
  .command("quality-report")
  .description("Generate daily prompt quality report (KPI + top low-quality questions).")
  .option("-d, --days <number>", "Days to include (default 1)", "1")
  .option("-n, --limit <number>", "Top N low-quality questions (default 10)", "10")
  .option("-o, --output <path>", "Write to file (default: stdout)")
  .action((opts: { days?: string; limit?: string; output?: string }) => {
    const days = Math.min(30, Math.max(1, parseInt(opts.days ?? "1", 10)));
    const limit = Math.min(50, Math.max(1, parseInt(opts.limit ?? "10", 10)));
    const now = Date.now();
    const timeTo = now;
    const timeFrom = now - days * 24 * 60 * 60 * 1000;
    const sessionRows = db
      .getDb()
      .prepare(
        "SELECT id FROM sessions WHERE last_at >= ? AND last_at <= ? ORDER BY last_at DESC"
      )
      .all(timeFrom, timeTo) as Array<{ id: number }>;
    const sessionIds = sessionRows.map((r) => r.id);
    const kpi = db.getQualityKpiForScope({ sessionIds, timeFrom, timeTo });
    const lowQuality = db.getTopLowQualityQuestions({
      sessionIds: sessionIds.length > 0 ? sessionIds : undefined,
      timeFrom,
      timeTo,
      limit,
      maxScore: 80,
    });
    const dateStr = new Date().toISOString().slice(0, 10);
    let md = DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE.replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{kpi\.avg_follow_up_rounds\}\}/g, String(kpi.avg_follow_up_rounds))
      .replace(/\{\{kpi\.first_pass_resolution_rate\}\}/g, String(kpi.first_pass_resolution_rate))
      .replace(/\{\{kpi\.repeated_question_ratio\}\}/g, String(kpi.repeated_question_ratio))
      .replace(/\{\{kpi\.high_quality_ratio\}\}/g, String(kpi.high_quality_ratio));
    const blockMatch = md.match(/\{\{#top_low_quality_questions\}\}([\s\S]*?)\{\{\/top_low_quality_questions\}\}/);
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
      md = md.replace(/\{\{#top_low_quality_questions\}\}[\s\S]*?\{\{\/top_low_quality_questions\}\}/, items || "(no low-quality questions)");
    }
    md = md
      .replace(/\{\{#patterns\}\}[\s\S]*?\{\{\/patterns\}\}/g, "(patterns not yet implemented)")
      .replace(/\{\{feedback\.[^}]+\}\}/g, "—")
      .replace(/\{\{tomorrow\.[^}]+\}\}/g, "—");
    if (opts.output) {
      writeFileSync(opts.output, md, "utf-8");
      console.error("Report written to", opts.output);
    } else {
      console.log(md);
    }
  });

program
  .command("cursor-dump")
  .description("Dump first Cursor session structure for debugging role attribution.")
  .action(() => {
    const sessions = ingestCursor();
    if (sessions.length === 0) {
      console.log("No Cursor sessions found.");
      return;
    }
    const s = sessions[0];
    const sample = s.messages.slice(0, 8).map((m) => ({ role: m.role, content_preview: m.content.slice(0, 100) + (m.content.length > 100 ? "…" : "") }));
    console.log(JSON.stringify({ external_id: s.external_id, message_count: s.messages.length, sample }, null, 2));
    console.log("\nRun 'npx assistmem index' then refresh the session page to apply role fixes.");
  });

program
  .command("eval-report")
  .description("Show eval stats: improvement rate when user's next question scores higher.")
  .option("-d, --days <number>", "Days to include (default 30)", "30")
  .action((opts: { days?: string }) => {
    const days = Math.min(365, Math.max(1, parseInt(opts.days ?? "30", 10)));
    const now = Date.now();
    const timeFrom = now - days * 24 * 60 * 60 * 1000;
    const timeTo = now;
    const stats = db.getEvalStats({ timeFrom, timeTo });
    console.log("# Eval: Question Quality Improvement");
    console.log("");
    console.log("Period:", new Date(timeFrom).toISOString().slice(0, 10), "to", new Date(timeTo).toISOString().slice(0, 10));
    console.log("");
    console.log("| Metric | Value |");
    console.log("|--------|-------|");
    console.log("| Pairs (prior → next) |", stats.pair_count, "|");
    console.log("| Improved |", stats.improved_count, "|");
    console.log("| Unchanged |", stats.unchanged_count, "|");
    console.log("| Regressed |", stats.regressed_count, "|");
    console.log("| Improvement rate |", (stats.improvement_rate * 100).toFixed(1) + "%", "|");
    console.log("| Avg delta (next - prior) |", stats.avg_delta, "|");
    console.log("| Avg prior score |", stats.avg_prior_score, "|");
    console.log("| Avg next score |", stats.avg_next_score, "|");
    if (stats.pair_count === 0) {
      console.log("");
      console.log("No eval pairs yet. Run quality analysis on sessions with multiple user messages.");
    }
  });

export function run(): void {
  program.parse(process.argv);
}
