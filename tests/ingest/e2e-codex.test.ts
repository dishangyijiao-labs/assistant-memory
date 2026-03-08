import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ingestCodex } from "../../server/ingest/codex.js";

describe("ingestCodex E2E", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "codex-test-"));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("returns empty for nonexistent dir", () => {
    assert.deepEqual(ingestCodex("/nonexistent"), []);
  });

  it("returns empty for empty dir", () => {
    assert.deepEqual(ingestCodex(baseDir), []);
  });

  it("ingests a JSONL session file", () => {
    const lines = [
      JSON.stringify({ type: "event_msg", timestamp: 1700000000000, payload: { type: "user_message", message: "How to use async?" } }),
      JSON.stringify({ type: "event_msg", timestamp: 1700000001000, payload: { type: "agent_message", message: "Use async/await like this..." } }),
    ];
    writeFileSync(join(baseDir, "session-1.jsonl"), lines.join("\n"), "utf-8");

    const sessions = ingestCodex(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].source, "codex");
    assert.equal(sessions[0].external_id, "session-1");
    assert.equal(sessions[0].messages.length, 2);
    assert.equal(sessions[0].messages[0].role, "user");
    assert.equal(sessions[0].messages[1].role, "assistant");
  });

  it("ingests a JSON session file with events array", () => {
    const data = {
      events: [
        { type: "event_msg", timestamp: 1700000000000, payload: { type: "user_message", message: "test" } },
      ],
    };
    writeFileSync(join(baseDir, "session-2.json"), JSON.stringify(data), "utf-8");

    const sessions = ingestCodex(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 1);
  });

  it("ingests legacy JSON format", () => {
    const data = {
      messages: [
        { role: "user", content: "What is Node?", timestamp: 1700000000000 },
        { role: "assistant", content: "A JS runtime.", timestamp: 1700000001000 },
      ],
    };
    writeFileSync(join(baseDir, "legacy.json"), JSON.stringify(data), "utf-8");

    const sessions = ingestCodex(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 2);
  });

  it("recursively finds files in subdirectories", () => {
    const subDir = join(baseDir, "project-a", "sub");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, "deep.jsonl"),
      JSON.stringify({ type: "event_msg", timestamp: 1700000000000, payload: { type: "user_message", message: "deep" } }), "utf-8");

    const sessions = ingestCodex(baseDir);
    assert.equal(sessions.length, 1);
    assert.ok(sessions[0].workspace.includes("project-a"));
  });

  it("handles function_call and function_call_output events", () => {
    const lines = [
      JSON.stringify({ type: "response_item", timestamp: 1700000000000, payload: { type: "function_call", name: "shell", arguments: "ls -la", call_id: "c1" } }),
      JSON.stringify({ type: "response_item", timestamp: 1700000001000, payload: { type: "function_call_output", output: "file1.ts\nfile2.ts", call_id: "c1" } }),
    ];
    writeFileSync(join(baseDir, "tool-use.jsonl"), lines.join("\n"), "utf-8");

    const sessions = ingestCodex(baseDir);
    assert.equal(sessions.length, 1);
    assert.ok(sessions[0].messages[0].content.includes("[tool_call] shell"));
    assert.ok(sessions[0].messages[1].content.includes("[tool_result]"));
  });

  it("skips corrupted lines", () => {
    const lines = [
      "not json",
      JSON.stringify({ type: "event_msg", timestamp: 1700000000000, payload: { type: "user_message", message: "valid" } }),
    ];
    writeFileSync(join(baseDir, "mixed.jsonl"), lines.join("\n"), "utf-8");

    const sessions = ingestCodex(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 1);
  });

  it("converts seconds timestamps to milliseconds", () => {
    const lines = [
      JSON.stringify({ type: "event_msg", timestamp: 1700000000, payload: { type: "user_message", message: "test" } }),
    ];
    writeFileSync(join(baseDir, "secs.jsonl"), lines.join("\n"), "utf-8");

    const sessions = ingestCodex(baseDir);
    assert.equal(sessions[0].messages[0].timestamp, 1700000000000);
  });
});
