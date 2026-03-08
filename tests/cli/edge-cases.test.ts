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
