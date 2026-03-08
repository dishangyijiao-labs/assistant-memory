import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copilotText, parseCopilotSession } from "../src/ingest/copilot.js";

describe("copilotText", () => {
  it("returns string directly", () => {
    assert.equal(copilotText("hello"), "hello");
  });

  it("converts number to string", () => {
    assert.equal(copilotText(42), "42");
  });

  it("converts boolean to string", () => {
    assert.equal(copilotText(true), "true");
  });

  it("extracts text from object with text field", () => {
    assert.equal(copilotText({ text: "found" }), "found");
  });

  it("extracts content from object", () => {
    assert.equal(copilotText({ content: "found" }), "found");
  });

  it("extracts value from object", () => {
    assert.equal(copilotText({ value: "found" }), "found");
  });

  it("handles nested arrays", () => {
    const value = [
      { value: "part 1" },
      { value: "part 2" },
    ];
    assert.equal(copilotText(value), "part 1\npart 2");
  });

  it("skips COPILOT_SKIP_KINDS in arrays", () => {
    const value = [
      { kind: "thinking", value: "thinking..." },
      { kind: "progressTaskSerialized", value: "progress" },
      { value: "actual content" },
    ];
    assert.equal(copilotText(value), "actual content");
  });

  it("skips COPILOT_SKIP_KINDS in objects", () => {
    assert.equal(copilotText({ kind: "thinking", value: "hidden" }), "");
    assert.equal(copilotText({ kind: "mcpServersStarting", text: "hidden" }), "");
    assert.equal(copilotText({ kind: "prepareToolInvocation", text: "hidden" }), "");
    assert.equal(copilotText({ kind: "toolInvocationSerialized", text: "hidden" }), "");
    assert.equal(copilotText({ kind: "inlineReference", text: "hidden" }), "");
    assert.equal(copilotText({ kind: "confirmation", text: "hidden" }), "");
  });

  it("tries nested arrays (parts, segments, items, messages, children)", () => {
    assert.equal(copilotText({ parts: [{ text: "from parts" }] }), "from parts");
    assert.equal(copilotText({ segments: [{ text: "from segments" }] }), "from segments");
  });

  it("falls back to concatenating string values", () => {
    const obj = { foo: "bar", baz: "qux", num: 42 };
    const result = copilotText(obj);
    assert.ok(result.includes("bar"));
    assert.ok(result.includes("qux"));
  });

  it("returns empty string for null/undefined", () => {
    assert.equal(copilotText(null), "");
    assert.equal(copilotText(undefined), "");
  });

  it("handles deeply nested response stream", () => {
    const stream = [
      { kind: "thinking", value: "hmm..." },
      { value: { text: "The answer is 42." } },
      { kind: "progressTaskSerialized", value: "step1" },
      "plain text",
    ];
    const result = copilotText(stream);
    assert.ok(result.includes("The answer is 42."));
    assert.ok(result.includes("plain text"));
    assert.ok(!result.includes("hmm..."));
    assert.ok(!result.includes("step1"));
  });
});

describe("parseCopilotSession", () => {
  it("parses a basic session with requests", () => {
    const json = JSON.stringify({
      sessionId: "session-1",
      creationDate: 1700000000000,
      requests: [
        { prompt: "How do I use React?", timestamp: 1700000000000 },
        { response: "Here is how...", timestamp: 1700000001000 },
      ],
    });
    const session = parseCopilotSession(json, "ws-hash");
    assert.ok(session);
    assert.equal(session!.source, "copilot");
    assert.equal(session!.workspace, "ws-hash");
    assert.equal(session!.external_id, "session-1");
    assert.ok(session!.messages.length > 0);
  });

  it("returns null for missing sessionId", () => {
    const json = JSON.stringify({ requests: [] });
    assert.equal(parseCopilotSession(json, "ws"), null);
  });

  it("returns null for invalid JSON", () => {
    assert.equal(parseCopilotSession("{invalid", "ws"), null);
  });

  it("returns null for no messages", () => {
    const json = JSON.stringify({ sessionId: "s1", requests: [] });
    assert.equal(parseCopilotSession(json, "ws"), null);
  });

  it("handles role-based messages", () => {
    const json = JSON.stringify({
      sessionId: "s2",
      messages: [
        { role: "user", content: "Hello", timestamp: 1000 },
        { role: "assistant", content: "Hi!", timestamp: 1001 },
      ],
    });
    const session = parseCopilotSession(json, "ws");
    assert.ok(session);
    assert.equal(session!.messages.length, 2);
    assert.equal(session!.messages[0].role, "user");
    assert.equal(session!.messages[1].role, "assistant");
  });

  it("handles nested messages array in request", () => {
    const json = JSON.stringify({
      sessionId: "s3",
      requests: [
        {
          timestamp: 1000,
          messages: [
            { role: "user", content: "Question" },
            { role: "copilot", content: "Answer" },
          ],
        },
      ],
    });
    const session = parseCopilotSession(json, "ws");
    assert.ok(session);
    assert.equal(session!.messages.length, 2);
    assert.equal(session!.messages[0].role, "user");
    assert.equal(session!.messages[1].role, "assistant"); // copilot → assistant
  });

  it("handles prompt/response style requests", () => {
    const json = JSON.stringify({
      sessionId: "s4",
      requests: [
        { prompt: "What is TypeScript?", response: "A typed superset of JS", timestamp: 1000 },
      ],
    });
    const session = parseCopilotSession(json, "ws");
    assert.ok(session);
    assert.equal(session!.messages.length, 2);
    assert.equal(session!.messages[0].role, "user");
    assert.equal(session!.messages[0].content, "What is TypeScript?");
    assert.equal(session!.messages[1].role, "assistant");
  });

  it("uses id field as fallback for sessionId", () => {
    const json = JSON.stringify({
      id: "fallback-id",
      requests: [{ prompt: "test", timestamp: 1000 }],
    });
    const session = parseCopilotSession(json, "ws");
    assert.ok(session);
    assert.equal(session!.external_id, "fallback-id");
  });

  it("computes correct started_at and last_at", () => {
    const json = JSON.stringify({
      sessionId: "timing",
      creationDate: 500,
      requests: [
        { prompt: "q1", timestamp: 1000 },
        { prompt: "q2", timestamp: 2000 },
      ],
    });
    const session = parseCopilotSession(json, "ws");
    assert.ok(session);
    assert.ok(session!.started_at <= 1000);
    assert.ok(session!.last_at >= 2000);
  });
});
