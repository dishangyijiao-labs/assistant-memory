import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractJsonBlock,
  extractSessionObjective,
  extractUserMessagesWithContext,
} from "../../server/insights/quality-analyzer.js";

describe("extractJsonBlock", () => {
  it("returns raw JSON when input starts with { and ends with }", () => {
    const input = '{"score": 85, "grade": "B"}';
    assert.equal(extractJsonBlock(input), input);
  });

  it("extracts JSON from markdown fenced code block", () => {
    const input = 'Some text\n```json\n{"score": 90}\n```\nmore text';
    assert.equal(extractJsonBlock(input), '{"score": 90}');
  });

  it("extracts JSON from generic fenced code block without language", () => {
    const input = '```\n{"score": 70}\n```';
    assert.equal(extractJsonBlock(input), '{"score": 70}');
  });

  it("extracts JSON from text containing { ... }", () => {
    const input = 'Here is the result: {"score": 60, "grade": "D"} and some more text';
    const result = extractJsonBlock(input);
    assert.ok(result.startsWith("{"));
    assert.ok(result.endsWith("}"));
    const parsed = JSON.parse(result);
    assert.equal(parsed.score, 60);
  });

  it("trims whitespace from input", () => {
    const input = '  \n  {"score": 95}  \n  ';
    assert.equal(extractJsonBlock(input), '{"score": 95}');
  });

  it("throws for input with no JSON", () => {
    assert.throws(() => extractJsonBlock("no json here"), {
      message: "QUALITY_RESPONSE_NOT_JSON",
    });
  });

  it("throws for empty string", () => {
    assert.throws(() => extractJsonBlock(""), {
      message: "QUALITY_RESPONSE_NOT_JSON",
    });
  });

  it("handles nested JSON objects", () => {
    const input = '{"score": 80, "rewrites": {"short": "test", "engineering": "detailed"}}';
    const result = extractJsonBlock(input);
    const parsed = JSON.parse(result);
    assert.equal(parsed.score, 80);
    assert.equal(parsed.rewrites.short, "test");
  });

  it("handles JSON with arrays", () => {
    const input = '{"deductions": [{"code": "missing_context", "points": 10}], "tags": ["bug"]}';
    const result = extractJsonBlock(input);
    const parsed = JSON.parse(result);
    assert.equal(parsed.deductions.length, 1);
    assert.equal(parsed.tags[0], "bug");
  });

  it("prefers fenced code block over generic { } match", () => {
    // If there's a fenced block AND a raw JSON, the fenced block wins
    const input = '{"wrong": true}\n```json\n{"correct": true}\n```';
    // Actually, it first checks if trimmed starts with { — but this input
    // doesn't start with { after trim because it starts with {"wrong"
    // Wait, it does start with {. So it returns the whole thing.
    // Let me construct a case where fenced block is preferred:
    const input2 = 'Some preamble\n```json\n{"correct": true}\n```\nsome {"other": true} content';
    const result = extractJsonBlock(input2);
    const parsed = JSON.parse(result);
    assert.equal(parsed.correct, true);
  });
});

describe("extractSessionObjective", () => {
  it("returns (unspecified) for undefined", () => {
    assert.equal(extractSessionObjective(undefined), "(unspecified)");
  });

  it("returns (unspecified) for empty string", () => {
    assert.equal(extractSessionObjective(""), "(unspecified)");
  });

  it("returns (unspecified) for whitespace-only string", () => {
    assert.equal(extractSessionObjective("   "), "(unspecified)");
  });

  it("returns the string for short input", () => {
    assert.equal(extractSessionObjective("Fix the authentication bug"), "Fix the authentication bug");
  });

  it("truncates to 300 chars with ellipsis for long input", () => {
    const long = "A".repeat(400);
    const result = extractSessionObjective(long);
    assert.equal(result.length, 301); // 300 + "…"
    assert.ok(result.endsWith("…"));
  });

  it("returns exact 300 chars without ellipsis when length = 300", () => {
    const exact = "B".repeat(300);
    const result = extractSessionObjective(exact);
    assert.equal(result, exact);
    assert.equal(result.length, 300);
  });

  it("trims whitespace before checking length", () => {
    const result = extractSessionObjective("  hello  ");
    assert.equal(result, "hello");
  });
});

describe("extractUserMessagesWithContext", () => {
  it("extracts user messages from a conversation", () => {
    const messages = [
      { id: 1, session_id: 10, role: "user", content: "How to fix this?" },
      { id: 2, session_id: 10, role: "assistant", content: "Try refactoring." },
      { id: 3, session_id: 10, role: "user", content: "What about tests?" },
    ];
    const result = extractUserMessagesWithContext(messages, "/project", "claude-code");
    assert.equal(result.length, 2);
    assert.equal(result[0].messageId, 1);
    assert.equal(result[0].content, "How to fix this?");
    assert.equal(result[0].workspace, "/project");
    assert.equal(result[0].source, "claude-code");
    assert.equal(result[0].priorAssistant, undefined);
    // Second user message should have prior assistant context
    assert.equal(result[1].messageId, 3);
    assert.equal(result[1].priorAssistant, "Try refactoring.");
  });

  it("returns empty array for no user messages", () => {
    const messages = [
      { id: 1, session_id: 10, role: "assistant", content: "Hello" },
      { id: 2, session_id: 10, role: "system", content: "System prompt" },
    ];
    const result = extractUserMessagesWithContext(messages, "/ws", "cursor");
    assert.equal(result.length, 0);
  });

  it("returns empty array for empty input", () => {
    const result = extractUserMessagesWithContext([], "/ws", "cursor");
    assert.equal(result.length, 0);
  });

  it("tracks latest assistant message as prior context", () => {
    const messages = [
      { id: 1, session_id: 10, role: "assistant", content: "First response" },
      { id: 2, session_id: 10, role: "assistant", content: "Second response" },
      { id: 3, session_id: 10, role: "user", content: "My question" },
    ];
    const result = extractUserMessagesWithContext(messages, "/ws", "cursor");
    assert.equal(result.length, 1);
    // Should use the LATEST assistant message before this user message
    assert.equal(result[0].priorAssistant, "Second response");
  });

  it("handles consecutive user messages", () => {
    const messages = [
      { id: 1, session_id: 10, role: "user", content: "Q1" },
      { id: 2, session_id: 10, role: "user", content: "Q2" },
      { id: 3, session_id: 10, role: "user", content: "Q3" },
    ];
    const result = extractUserMessagesWithContext(messages, "/ws", "cursor");
    assert.equal(result.length, 3);
    // No prior assistant for any of them
    assert.equal(result[0].priorAssistant, undefined);
    assert.equal(result[1].priorAssistant, undefined);
    assert.equal(result[2].priorAssistant, undefined);
  });

  it("ignores system messages when tracking prior assistant", () => {
    const messages = [
      { id: 1, session_id: 10, role: "assistant", content: "Answer" },
      { id: 2, session_id: 10, role: "system", content: "System note" },
      { id: 3, session_id: 10, role: "user", content: "Question" },
    ];
    const result = extractUserMessagesWithContext(messages, "/ws", "cursor");
    assert.equal(result.length, 1);
    // System messages don't override priorAssistant
    assert.equal(result[0].priorAssistant, "Answer");
  });
});
