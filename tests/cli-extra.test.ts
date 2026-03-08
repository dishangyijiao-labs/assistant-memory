import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const CLI_ENTRY = join(import.meta.dirname, "..", "src", "index.ts");
const TSX = join(import.meta.dirname, "..", "node_modules", ".bin", "tsx");

function runCli(args: string[], env: Record<string, string> = {}): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(TSX, [CLI_ENTRY, ...args], {
    env: { ...process.env, ...env },
    encoding: "utf-8",
    timeout: 15000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

describe("CLI – extended coverage", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cli-extra-"));
    dbPath = join(tempDir, "test.db");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("search – limit clamping", () => {
    it("clamps limit to min 1", () => {
      const { stdout } = runCli(["search", "test", "-n", "0"], { ASSISTMEM_DB_PATH: dbPath });
      // Should not crash, limit=0 → clamped to 1
      assert.ok(stdout.includes("No matches"));
    });

    it("clamps limit to max 100", () => {
      const { stdout } = runCli(["search", "test", "-n", "9999"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("No matches"));
    });

    it("handles non-numeric limit gracefully (NaN fallback to 20)", () => {
      // parseInt("abc") → NaN → || 20 fallback → limit = 20
      const { stdout, exitCode } = runCli(["search", "test", "-n", "abc"], { ASSISTMEM_DB_PATH: dbPath });
      assert.equal(exitCode, 0);
      assert.ok(stdout.includes("No matches"));
    });
  });

  describe("quality-report – days and limit clamping", () => {
    it("clamps days to min 1", () => {
      const { stdout } = runCli(["quality-report", "-d", "0"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.length > 0, "should produce output");
      assert.ok(stdout.includes("Daily Prompt Quality Report"));
    });

    it("clamps days to max 30", () => {
      const { stdout } = runCli(["quality-report", "-d", "999"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("Daily Prompt Quality Report"));
    });

    it("clamps limit to min 1", () => {
      const { stdout } = runCli(["quality-report", "-n", "0"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("Daily Prompt Quality Report"));
    });

    it("clamps limit to max 50", () => {
      const { stdout } = runCli(["quality-report", "-n", "999"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("Daily Prompt Quality Report"));
    });

    it("writes to file with --output", () => {
      const outPath = join(tempDir, "report.md");
      const { stderr } = runCli(["quality-report", "-o", outPath], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stderr.includes("Report written to"));
      assert.ok(existsSync(outPath));
      const content = readFileSync(outPath, "utf-8");
      assert.ok(content.includes("Daily Prompt Quality Report"));
    });

    it("includes date in report header", () => {
      const { stdout } = runCli(["quality-report"], { ASSISTMEM_DB_PATH: dbPath });
      // Should contain today's date in YYYY-MM-DD format
      const today = new Date().toISOString().slice(0, 10);
      assert.ok(stdout.includes(today));
    });

    it("includes KPI section", () => {
      const { stdout } = runCli(["quality-report"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("KPI Snapshot"));
      assert.ok(stdout.includes("follow-up rounds"));
      assert.ok(stdout.includes("First-pass resolution"));
    });

    it("includes placeholder sections for empty data", () => {
      const { stdout } = runCli(["quality-report"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("(no low-quality questions)") || stdout.includes("Low-Quality Questions"));
      assert.ok(stdout.includes("(patterns not yet implemented)"));
    });
  });

  describe("eval-report – days clamping", () => {
    it("clamps days to min 1", () => {
      const { stdout } = runCli(["eval-report", "-d", "0"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("Eval"));
    });

    it("clamps days to max 365", () => {
      const { stdout } = runCli(["eval-report", "-d", "9999"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("Eval"));
    });

    it("outputs table format", () => {
      const { stdout } = runCli(["eval-report"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("Metric"));
      assert.ok(stdout.includes("Value"));
      assert.ok(stdout.includes("Improvement rate"));
    });

    it("shows period dates", () => {
      const { stdout } = runCli(["eval-report", "-d", "7"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("Period:"));
      // Should have two dates
      const dateMatch = stdout.match(/\d{4}-\d{2}-\d{2}/g);
      assert.ok(dateMatch && dateMatch.length >= 2);
    });
  });

  describe("index – sources filter", () => {
    it("handles multiple comma-separated sources", () => {
      const { stderr } = runCli(["index", "--sources", "copilot,claude-code"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stderr.includes("copilot") || stderr.includes("claude-code"));
    });

    it("shows database path after indexing", () => {
      const { stderr } = runCli(["index"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stderr.includes("Database:"));
      assert.ok(stderr.includes(dbPath));
    });
  });

  describe("cursor-dump", () => {
    it("outputs message when no Cursor data (or dumps session if found)", () => {
      const { stdout, exitCode } = runCli(["cursor-dump"], { ASSISTMEM_DB_PATH: dbPath });
      // On machines without Cursor installed, shows "No Cursor sessions found"
      // On machines with Cursor installed, dumps the first session
      assert.equal(exitCode, 0);
      assert.ok(
        stdout.includes("No Cursor sessions found") || stdout.includes("external_id"),
        "should output either no-sessions message or session dump"
      );
    });
  });

  describe("unknown command", () => {
    it("shows error for unknown command", () => {
      const { stderr, exitCode } = runCli(["nonexistent-command"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(exitCode !== 0 || stderr.length > 0);
    });
  });
});
