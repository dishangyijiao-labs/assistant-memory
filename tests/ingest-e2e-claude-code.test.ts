import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ingestClaudeCode } from "../src/ingest/claude-code.js";

describe("ingestClaudeCode E2E", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "claude-test-"));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("returns empty for nonexistent base dir", () => {
    const sessions = ingestClaudeCode("/nonexistent/path");
    assert.deepEqual(sessions, []);
  });

  it("returns empty for empty project dir", () => {
    mkdirSync(join(baseDir, "my-project"), { recursive: true });
    const sessions = ingestClaudeCode(baseDir);
    assert.deepEqual(sessions, []);
  });

  it("ingests a JSONL session file", () => {
    const projDir = join(baseDir, "my-project");
    mkdirSync(projDir, { recursive: true });
    const lines = [
      JSON.stringify({ type: "user", message: { role: "user", content: "What is TypeScript?" }, timestamp: "2024-01-15T12:00:00Z", uuid: "u1" }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: "TypeScript is a typed superset of JavaScript." }, timestamp: "2024-01-15T12:00:01Z", uuid: "u2" }),
    ];
    writeFileSync(join(projDir, "session-abc.jsonl"), lines.join("\n"), "utf-8");

    const sessions = ingestClaudeCode(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].source, "claude-code");
    assert.equal(sessions[0].workspace, "my-project");
    assert.equal(sessions[0].external_id, "session-abc");
    assert.equal(sessions[0].messages.length, 2);
    assert.equal(sessions[0].messages[0].role, "user");
    assert.equal(sessions[0].messages[1].role, "assistant");
  });

  it("ingests multiple projects and sessions", () => {
    const proj1 = join(baseDir, "proj-1");
    const proj2 = join(baseDir, "proj-2");
    mkdirSync(proj1, { recursive: true });
    mkdirSync(proj2, { recursive: true });

    writeFileSync(join(proj1, "s1.jsonl"),
      JSON.stringify({ type: "user", message: { role: "user", content: "Hello" }, timestamp: "2024-01-01T00:00:00Z" }), "utf-8");
    writeFileSync(join(proj1, "s2.jsonl"),
      JSON.stringify({ type: "user", message: { role: "user", content: "World" }, timestamp: "2024-01-02T00:00:00Z" }), "utf-8");
    writeFileSync(join(proj2, "s3.jsonl"),
      JSON.stringify({ type: "user", message: { role: "user", content: "Test" }, timestamp: "2024-01-03T00:00:00Z" }), "utf-8");

    const sessions = ingestClaudeCode(baseDir);
    assert.equal(sessions.length, 3);
    const workspaces = sessions.map(s => s.workspace).sort();
    assert.ok(workspaces.includes("proj-1"));
    assert.ok(workspaces.includes("proj-2"));
  });

  it("handles content blocks array (tool_use)", () => {
    const projDir = join(baseDir, "proj");
    mkdirSync(projDir, { recursive: true });
    const lines = [
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Let me read that." },
            { type: "tool_use", name: "read_file", input: { path: "foo.ts" } },
          ],
        },
        timestamp: "2024-01-15T12:00:00Z",
      }),
    ];
    writeFileSync(join(projDir, "tool-session.jsonl"), lines.join("\n"), "utf-8");

    const sessions = ingestClaudeCode(baseDir);
    assert.equal(sessions.length, 1);
    assert.ok(sessions[0].messages[0].content.includes("Let me read that."));
    assert.ok(sessions[0].messages[0].content.includes("[tool_call] read_file"));
  });

  it("reclassifies user messages with only tool_result as assistant", () => {
    const projDir = join(baseDir, "proj");
    mkdirSync(projDir, { recursive: true });
    const lines = [
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "tool_result", content: "output data" },
          ],
        },
        timestamp: "2024-01-15T12:00:00Z",
      }),
    ];
    writeFileSync(join(projDir, "reclassify.jsonl"), lines.join("\n"), "utf-8");

    const sessions = ingestClaudeCode(baseDir);
    assert.equal(sessions.length, 1);
    // Should be reclassified from user to assistant
    assert.equal(sessions[0].messages[0].role, "assistant");
  });

  it("skips corrupted JSONL lines gracefully", () => {
    const projDir = join(baseDir, "proj");
    mkdirSync(projDir, { recursive: true });
    const lines = [
      "this is not json",
      JSON.stringify({ type: "user", message: { role: "user", content: "valid" }, timestamp: "2024-01-15T12:00:00Z" }),
      "{broken json",
    ];
    writeFileSync(join(projDir, "mixed.jsonl"), lines.join("\n"), "utf-8");

    const sessions = ingestClaudeCode(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 1);
    assert.equal(sessions[0].messages[0].content, "valid");
  });

  it("skips non-jsonl files", () => {
    const projDir = join(baseDir, "proj");
    mkdirSync(projDir, { recursive: true });
    writeFileSync(join(projDir, "readme.txt"), "not a session", "utf-8");
    writeFileSync(join(projDir, "data.json"), '{"key":"value"}', "utf-8");

    const sessions = ingestClaudeCode(baseDir);
    assert.deepEqual(sessions, []);
  });

  it("skips sessions with no messages", () => {
    const projDir = join(baseDir, "proj");
    mkdirSync(projDir, { recursive: true });
    // A line with empty content should be skipped
    writeFileSync(join(projDir, "empty.jsonl"),
      JSON.stringify({ type: "user", message: { role: "user", content: "" }, timestamp: "2024-01-15T12:00:00Z" }), "utf-8");

    const sessions = ingestClaudeCode(baseDir);
    assert.deepEqual(sessions, []);
  });
});
