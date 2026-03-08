import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseGeminiMessage, parseGeminiPart } from "../src/ingest/gemini.js";

describe("parseGeminiMessage", () => {
  it("parses a user message with text field", () => {
    const msg = parseGeminiMessage({ role: "user", text: "Hello", timestamp: 1000 });
    assert.ok(msg);
    assert.equal(msg!.role, "user");
    assert.equal(msg!.content, "Hello");
    assert.equal(msg!.timestamp, 1000);
  });

  it("parses a user message with content field", () => {
    const msg = parseGeminiMessage({ role: "user", content: "Hello" });
    assert.ok(msg);
    assert.equal(msg!.content, "Hello");
  });

  it("parses parts array", () => {
    const msg = parseGeminiMessage({
      role: "user",
      parts: [{ text: "part 1" }, { text: "part 2" }],
    });
    assert.ok(msg);
    assert.equal(msg!.content, "part 1\npart 2");
  });

  it("normalizes 'model' role to 'assistant'", () => {
    const msg = parseGeminiMessage({ role: "model", text: "Response" });
    assert.ok(msg);
    assert.equal(msg!.role, "assistant");
  });

  it("normalizes 'gemini' role to 'assistant'", () => {
    const msg = parseGeminiMessage({ role: "gemini", text: "Response" });
    assert.ok(msg);
    assert.equal(msg!.role, "assistant");
  });

  it("normalizes 'info' role to 'system'", () => {
    const msg = parseGeminiMessage({ role: "info", text: "System msg" });
    assert.ok(msg);
    assert.equal(msg!.role, "system");
  });

  it("defaults unknown role to 'assistant'", () => {
    const msg = parseGeminiMessage({ role: "custom", text: "Text" });
    assert.ok(msg);
    assert.equal(msg!.role, "assistant");
  });

  it("returns null for empty text", () => {
    assert.equal(parseGeminiMessage({ role: "user", text: "" }), null);
    assert.equal(parseGeminiMessage({ role: "user", text: "   " }), null);
  });

  it("returns null for null/undefined input", () => {
    assert.equal(parseGeminiMessage(null), null);
    assert.equal(parseGeminiMessage(undefined), null);
  });

  it("returns null for non-object", () => {
    assert.equal(parseGeminiMessage("string"), null);
    assert.equal(parseGeminiMessage(42), null);
  });

  it("parses string timestamp", () => {
    const msg = parseGeminiMessage({ role: "user", text: "Hi", timestamp: "2024-01-15T12:00:00Z" });
    assert.ok(msg);
    assert.equal(msg!.timestamp, new Date("2024-01-15T12:00:00Z").getTime());
  });

  it("uses time field as fallback", () => {
    const msg = parseGeminiMessage({ role: "user", text: "Hi", time: 5000 });
    assert.ok(msg);
    assert.equal(msg!.timestamp, 5000);
  });

  it("preserves external_id from id/uuid", () => {
    const msg = parseGeminiMessage({ role: "user", text: "Hi", id: "gem-123" });
    assert.ok(msg);
    assert.equal(msg!.external_id, "gem-123");
  });

  it("skips empty parts", () => {
    const msg = parseGeminiMessage({
      role: "user",
      parts: [{ text: "" }, { text: "valid" }, {}],
    });
    assert.ok(msg);
    assert.equal(msg!.content, "valid");
  });
});

describe("parseGeminiPart", () => {
  it("parses a part with text", () => {
    const msg = parseGeminiPart({ text: "content", role: "user", timestamp: 1000 });
    assert.ok(msg);
    assert.equal(msg!.role, "user");
    assert.equal(msg!.content, "content");
  });

  it("parses a part with content field", () => {
    const msg = parseGeminiPart({ content: "data" });
    assert.ok(msg);
    assert.equal(msg!.content, "data");
    assert.equal(msg!.role, "assistant"); // default
  });

  it("parses a part with nested parts array", () => {
    const msg = parseGeminiPart({ parts: [{ text: "a" }, { text: "b" }] });
    assert.ok(msg);
    assert.equal(msg!.content, "a\nb");
  });

  it("returns null for empty content", () => {
    assert.equal(parseGeminiPart({ text: "" }), null);
    assert.equal(parseGeminiPart({ text: "  " }), null);
  });

  it("returns null for null/undefined", () => {
    assert.equal(parseGeminiPart(null), null);
    assert.equal(parseGeminiPart(undefined), null);
  });

  it("defaults role to assistant", () => {
    const msg = parseGeminiPart({ text: "hello" });
    assert.ok(msg);
    assert.equal(msg!.role, "assistant");
  });

  it("maps user role correctly", () => {
    const msg = parseGeminiPart({ text: "hello", role: "user" });
    assert.ok(msg);
    assert.equal(msg!.role, "user");
  });

  it("maps non-user roles to assistant", () => {
    const msg = parseGeminiPart({ text: "hello", role: "model" });
    assert.ok(msg);
    assert.equal(msg!.role, "assistant");
  });
});
