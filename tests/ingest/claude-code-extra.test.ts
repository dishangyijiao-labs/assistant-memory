import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  claudeContentBlocksToText,
  isOnlyToolResult,
  ingestClaudeCode,
} from "../../server/ingest/claude-code.js";

describe("isOnlyToolResult – additional branches", () => {
  it("raw strings are skipped (not objects), so tool_result-only check still passes", () => {
    // Raw strings skip the object checks at line 38 (typeof x !== "object" → continue)
    // So a raw string alongside tool_result doesn't prevent "only tool_result" from being true
    const blocks = [
      { type: "tool_result", content: "result" },
      "Some user text here",
    ];
    assert.equal(isOnlyToolResult(blocks), true);
  });

  it("returns true when raw strings are all empty/whitespace alongside tool_result", () => {
    // raw strings with only whitespace don't count as content
    const blocks = [
      { type: "tool_result", content: "result" },
      "",
      "   ",
    ];
    // isOnlyToolResult checks: if typeof x === "string" && (x).trim() → return false
    // Empty strings: "".trim() is falsy, so they don't trigger "return false"
    assert.equal(isOnlyToolResult(blocks), true);
  });
});

describe("parseClaudeJsonl – tool_result reclassification", () => {
  let tmpDir: string;

  it("reclassifies user message with only tool_result blocks to assistant", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-reclass-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    // A user message whose content is only tool_result blocks should be reclassified
    const lines = [
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", content: "Command output: success" }],
        },
        timestamp: "2024-01-01T00:00:00Z",
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Great, the command succeeded." }],
        },
        timestamp: "2024-01-01T00:00:01Z",
      }),
    ];
    writeFileSync(join(projDir, "session.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 1);
    // The first message was user with only tool_result → reclassified as assistant
    assert.equal(sessions[0].messages[0].role, "assistant");
    assert.ok(sessions[0].messages[0].content.includes("[tool_result]"));
    // Second message stays assistant
    assert.equal(sessions[0].messages[1].role, "assistant");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("keeps user message when content has text alongside tool_result", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-keep-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    const lines = [
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "tool_result", content: "result" },
            { type: "text", text: "Here is my follow-up question" },
          ],
        },
        timestamp: "2024-01-01T00:00:00Z",
      }),
    ];
    writeFileSync(join(projDir, "session.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 1);
    // Should remain user because there's real text content
    assert.equal(sessions[0].messages[0].role, "user");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("parseClaudeJsonl – edge cases via ingestClaudeCode", () => {
  let tmpDir: string;

  it("handles mixed valid and invalid JSONL lines", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-mixed-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    const lines = [
      "{ this is not valid json",
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "Valid question" },
        timestamp: "2024-01-01T00:00:00Z",
      }),
      "another bad line {{{}}}",
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: "Valid answer" },
        timestamp: "2024-01-01T00:00:01Z",
      }),
    ];
    writeFileSync(join(projDir, "session.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 2);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles message with string content directly", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-str-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    const lines = [
      JSON.stringify({
        content: "Direct string content",
        timestamp: "2024-01-01T00:00:00Z",
      }),
    ];
    writeFileSync(join(projDir, "session.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    // content is a string, role defaults to assistant
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages[0].content, "Direct string content");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("ingestClaudeCode overrides external_id with filename (not sessionId from content)", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-sid-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    const lines = [
      JSON.stringify({
        sessionId: "my-custom-session-id",
        type: "user",
        message: { role: "user", content: "Q" },
        timestamp: "2024-01-01T00:00:00Z",
      }),
    ];
    writeFileSync(join(projDir, "session.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 1);
    // ingestClaudeCode always overrides external_id with the filename (without .jsonl)
    assert.equal(sessions[0].external_id, "session");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses filename as sessionId fallback", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-fname-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    const lines = [
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "Q" },
        timestamp: "2024-01-01T00:00:00Z",
      }),
    ];
    writeFileSync(join(projDir, "abc123.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].external_id, "abc123");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips messages with empty content", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-empty-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    const lines = [
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "" },
        timestamp: "2024-01-01T00:00:00Z",
      }),
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "Real question" },
        timestamp: "2024-01-01T00:00:01Z",
      }),
    ];
    writeFileSync(join(projDir, "session.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 1);
    assert.equal(sessions[0].messages[0].content, "Real question");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("preserves uuid as external_id on messages", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-uuid-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    const lines = [
      JSON.stringify({
        uuid: "msg-uuid-123",
        type: "user",
        message: { role: "user", content: "Q" },
        timestamp: "2024-01-01T00:00:00Z",
      }),
    ];
    writeFileSync(join(projDir, "s.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions[0].messages[0].external_id, "msg-uuid-123");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles system role messages", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-sys-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    const lines = [
      JSON.stringify({
        type: "system",
        message: { role: "system", content: "You are a helpful assistant." },
        timestamp: "2024-01-01T00:00:00Z",
      }),
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "Hi" },
        timestamp: "2024-01-01T00:00:01Z",
      }),
    ];
    writeFileSync(join(projDir, "s.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 1);
    // System messages have "(no text)" or content depending on implementation
    const systemMsg = sessions[0].messages.find((m) => m.role === "system");
    assert.ok(systemMsg);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("computes correct started_at and last_at from timestamps", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-ts-"));
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir, { recursive: true });

    const lines = [
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "First" },
        timestamp: "2024-01-10T00:00:00Z",
      }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: "Second" },
        timestamp: "2024-01-15T12:00:00Z",
      }),
    ];
    writeFileSync(join(projDir, "s.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    const s = sessions[0];
    assert.equal(s.started_at, new Date("2024-01-10T00:00:00Z").getTime());
    assert.equal(s.last_at, new Date("2024-01-15T12:00:00Z").getTime());

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
