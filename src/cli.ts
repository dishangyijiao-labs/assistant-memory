import { Command } from "commander";
import { runIngest } from "./ingest/index.js";
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
    const limit = Math.min(100, Math.max(1, parseInt(opts.limit ?? "20", 10)));
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

export function run(): void {
  program.parse(process.argv);
}
