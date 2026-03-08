import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const CLI_ENTRY = join(import.meta.dirname, "../..", "server", "index.ts");
const TSX = join(import.meta.dirname, "../..", "node_modules", ".bin", "tsx");

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

describe("CLI integration", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cli-test-"));
    dbPath = join(tempDir, "test.db");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("stats command", () => {
    it("shows zero counts for fresh DB", () => {
      const { stdout } = runCli(["stats"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("Sessions:"), "should show Sessions count");
      assert.ok(stdout.includes("Messages:"), "should show Messages count");
      assert.ok(stdout.includes("Database:"), "should show Database path");
      assert.ok(stdout.includes("0"), "should have zero counts initially");
    });

    it("shows correct DB path", () => {
      const { stdout } = runCli(["stats"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes(dbPath), "should include the custom DB path");
    });
  });

  describe("index command", () => {
    it("runs index and reports counts", () => {
      const { stdout, stderr } = runCli(["index"], { ASSISTMEM_DB_PATH: dbPath });
      const combined = stdout + stderr;
      assert.ok(combined.includes("Indexing"), "should log indexing");
      assert.ok(combined.includes("sessions"), "should mention sessions");
      assert.ok(combined.includes("messages"), "should mention messages");
    });

    it("accepts --sources filter", () => {
      const { stdout, stderr } = runCli(["index", "--sources", "copilot"], { ASSISTMEM_DB_PATH: dbPath });
      const combined = stdout + stderr;
      assert.ok(combined.includes("copilot"), "should mention copilot source");
    });
  });

  describe("search command", () => {
    it("shows no matches for empty DB", () => {
      const { stdout } = runCli(["search", "typescript"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("No matches"), "should indicate no results");
    });

    it("accepts --limit flag", () => {
      const { stdout } = runCli(["search", "test", "-n", "5"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("No matches") || stdout.includes("result"));
    });
  });

  describe("--help", () => {
    it("shows help text", () => {
      const { stdout } = runCli(["--help"], { ASSISTMEM_DB_PATH: dbPath });
      assert.ok(stdout.includes("assistmem"), "should show program name");
      assert.ok(stdout.includes("index"), "should list index command");
      assert.ok(stdout.includes("search"), "should list search command");
      assert.ok(stdout.includes("serve"), "should list serve command");
    });
  });
});
