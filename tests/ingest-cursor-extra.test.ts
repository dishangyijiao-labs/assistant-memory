import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCursorPromptHistory } from "../src/ingest/cursor.js";
import { parseCursorCliChatFile } from "../src/ingest/cursor-cli.js";
import { normalizeRole } from "../src/ingest/copilot.js";

describe("parseCursorPromptHistory", () => {
  it("returns null for null inputs", () => {
    assert.equal(parseCursorPromptHistory(null, null, "ws"), null);
  });

  it("returns null for empty arrays", () => {
    assert.equal(parseCursorPromptHistory("[]", "[]", "ws"), null);
  });

  it("parses prompts and generations", () => {
    const prompts = JSON.stringify([
      { text: "How to fix this bug?" },
      { text: "What about performance?" },
    ]);
    const gens = JSON.stringify([
      { unixMs: 1700000000000, textDescription: "Fix by refactoring..." },
      { unixMs: 1700000001000, textDescription: "Use memoization..." },
    ]);
    const session = parseCursorPromptHistory(prompts, gens, "my-workspace");
    assert.ok(session);
    assert.equal(session!.source, "cursor");
    assert.equal(session!.workspace, "my-workspace");
    assert.equal(session!.external_id, "cursor-prompts-my-workspace");
    assert.equal(session!.messages.length, 4); // 2 user + 2 assistant
    assert.equal(session!.messages[0].role, "user");
    assert.equal(session!.messages[0].content, "How to fix this bug?");
    assert.equal(session!.messages[1].role, "assistant");
    assert.equal(session!.messages[1].content, "Fix by refactoring...");
  });

  it("handles prompts without matching generations", () => {
    const prompts = JSON.stringify([
      { text: "Question without generation" },
    ]);
    const session = parseCursorPromptHistory(prompts, null, "ws");
    assert.ok(session);
    // The user message should exist, timestamp may be 0 since no generations
    assert.ok(session!.messages.some(m => m.role === "user" && m.content === "Question without generation"));
  });

  it("handles generations without matching prompts", () => {
    const gens = JSON.stringify([
      { unixMs: 1700000000000, textDescription: "Generated answer" },
    ]);
    const session = parseCursorPromptHistory(null, gens, "ws");
    assert.ok(session);
    assert.ok(session!.messages.some(m => m.role === "assistant" && m.content === "Generated answer"));
  });

  it("skips empty prompt text", () => {
    const prompts = JSON.stringify([
      { text: "" },
      { text: "Valid question" },
    ]);
    const gens = JSON.stringify([
      { unixMs: 1000 },
      { unixMs: 2000, textDescription: "Valid answer" },
    ]);
    const session = parseCursorPromptHistory(prompts, gens, "ws");
    assert.ok(session);
    // Empty text prompt should be skipped
    assert.ok(!session!.messages.some(m => m.content === ""));
  });

  it("handles mismatched prompt/generation counts", () => {
    const prompts = JSON.stringify([
      { text: "Q1" },
      { text: "Q2" },
      { text: "Q3" },
    ]);
    const gens = JSON.stringify([
      { unixMs: 1000, textDescription: "A1" },
    ]);
    const session = parseCursorPromptHistory(prompts, gens, "ws");
    assert.ok(session);
    // Should handle the mismatch gracefully
    assert.ok(session!.messages.length >= 2);
  });

  it("computes correct started_at and last_at from timestamps", () => {
    const prompts = JSON.stringify([{ text: "Q" }]);
    const gens = JSON.stringify([{ unixMs: 5000, textDescription: "A" }]);
    const session = parseCursorPromptHistory(prompts, gens, "ws");
    assert.ok(session);
    assert.ok(session!.started_at > 0);
    assert.ok(session!.last_at >= session!.started_at);
  });

  it("handles invalid JSON gracefully", () => {
    // Invalid prompts JSON, valid gens
    const gens = JSON.stringify([{ unixMs: 1000, textDescription: "answer" }]);
    const session = parseCursorPromptHistory("{invalid", gens, "ws");
    assert.ok(session);
    assert.equal(session!.messages.length, 1);
    assert.equal(session!.messages[0].role, "assistant");
  });

  it("handles commandType in prompts", () => {
    const prompts = JSON.stringify([
      { text: "regular question", commandType: 0 },
    ]);
    const gens = JSON.stringify([
      { unixMs: 1000, textDescription: "answer" },
    ]);
    const session = parseCursorPromptHistory(prompts, gens, "ws");
    assert.ok(session);
    assert.equal(session!.messages[0].content, "regular question");
  });
});

describe("parseCursorCliChatFile", () => {
  it("parses single JSON object with messages", () => {
    const json = JSON.stringify({
      id: "chat-1",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ],
    });
    const session = parseCursorCliChatFile(json, "chat-1.json");
    assert.ok(session);
    assert.equal(session!.source, "cursor-cli");
    assert.equal(session!.workspace, "chats");
    assert.equal(session!.external_id, "chat-1");
    assert.equal(session!.messages.length, 2);
  });

  it("parses JSONL with multiple conversation objects", () => {
    const lines = [
      JSON.stringify({ messages: [{ role: "user", content: "Line 1 Q" }] }),
      JSON.stringify({ messages: [{ role: "user", content: "Line 2 Q" }] }),
    ];
    // First line alone might not parse as single object with messages extracted,
    // so JSONL path kicks in
    const raw = lines.join("\n");
    const session = parseCursorCliChatFile(raw, "multi.jsonl");
    assert.ok(session);
    assert.ok(session!.messages.length >= 2);
  });

  it("uses filename as fallback external_id", () => {
    const json = JSON.stringify({
      messages: [{ role: "user", content: "test" }],
    });
    const session = parseCursorCliChatFile(json, "my-session.json");
    assert.ok(session);
    // No id field, should use filename without extension
    assert.equal(session!.external_id, "my-session");
  });

  it("returns null for empty content", () => {
    const session = parseCursorCliChatFile("", "empty.json");
    assert.equal(session, null);
  });

  it("handles bubbles/turns format", () => {
    const json = JSON.stringify({
      id: "bubble-chat",
      bubbles: [
        { prompt: "Question?", response: "Answer." },
      ],
    });
    const session = parseCursorCliChatFile(json, "bubble.json");
    assert.ok(session);
    assert.equal(session!.messages.length, 2);
    assert.equal(session!.messages[0].role, "user");
    assert.equal(session!.messages[1].role, "assistant");
  });

  it("parses single-line JSONL that is also valid JSON", () => {
    const json = JSON.stringify({
      sessionId: "single-line",
      messages: [{ role: "user", content: "one liner" }],
    });
    const session = parseCursorCliChatFile(json, "single.jsonl");
    assert.ok(session);
    assert.equal(session!.external_id, "single-line");
  });

  it("returns null for no extractable messages", () => {
    const json = JSON.stringify({ id: "no-msgs", data: "unrelated" });
    const session = parseCursorCliChatFile(json, "no-msgs.json");
    assert.equal(session, null);
  });
});

describe("copilot normalizeRole", () => {
  it("returns 'user' for user role", () => {
    assert.equal(normalizeRole("user"), "user");
  });

  it("returns 'assistant' for assistant role", () => {
    assert.equal(normalizeRole("assistant"), "assistant");
  });

  it("returns 'assistant' for copilot role", () => {
    assert.equal(normalizeRole("copilot"), "assistant");
  });

  it("returns 'system' for system role", () => {
    assert.equal(normalizeRole("system"), "system");
  });

  it("returns null for undefined", () => {
    assert.equal(normalizeRole(undefined), null);
  });

  it("returns null for empty string", () => {
    assert.equal(normalizeRole(""), null);
  });

  it("returns null for unknown role", () => {
    assert.equal(normalizeRole("moderator"), null);
  });

  it("is case-insensitive", () => {
    assert.equal(normalizeRole("User"), "user");
    assert.equal(normalizeRole("ASSISTANT"), "assistant");
    assert.equal(normalizeRole("System"), "system");
  });

  it("handles partial matches", () => {
    assert.equal(normalizeRole("github-copilot"), "assistant");
    assert.equal(normalizeRole("end-user"), "user");
  });
});
