import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  codexEventToMessages,
  codexTimestamp,
  codexContentToText,
  codexLegacyMessage,
} from "../../server/ingest/codex.js";

describe("codexTimestamp", () => {
  it("returns milliseconds for large numbers (already ms)", () => {
    const ms = 1700000000000; // ~2023
    assert.equal(codexTimestamp(ms), ms);
  });

  it("converts seconds to milliseconds for small numbers", () => {
    const secs = 1700000000; // ~2023 in seconds
    assert.equal(codexTimestamp(secs), secs * 1000);
  });

  it("boundary: 1e12 is treated as milliseconds", () => {
    assert.equal(codexTimestamp(1e12), 1e12);
  });

  it("boundary: just below 1e12 is treated as seconds", () => {
    const val = 999999999999;
    assert.equal(codexTimestamp(val), val * 1000);
  });

  it("parses ISO date strings", () => {
    const result = codexTimestamp("2024-01-15T12:00:00Z");
    assert.ok(result !== null);
    assert.ok(result! > 0);
    assert.equal(result, new Date("2024-01-15T12:00:00Z").getTime());
  });

  it("returns null for invalid date strings", () => {
    assert.equal(codexTimestamp("not a date"), null);
  });

  it("returns null for null/undefined", () => {
    assert.equal(codexTimestamp(null), null);
    assert.equal(codexTimestamp(undefined), null);
  });

  it("returns null for boolean", () => {
    assert.equal(codexTimestamp(true), null);
  });

  it("returns null for objects", () => {
    assert.equal(codexTimestamp({}), null);
  });
});

describe("codexContentToText", () => {
  it("returns trimmed string for string input", () => {
    assert.equal(codexContentToText("  hello world  "), "hello world");
  });

  it("returns empty for empty string", () => {
    assert.equal(codexContentToText(""), "");
  });

  it("returns empty for non-array non-string", () => {
    assert.equal(codexContentToText(123), "");
    assert.equal(codexContentToText(null), "");
    assert.equal(codexContentToText(undefined), "");
  });

  it("extracts text from array of objects", () => {
    const content = [
      { text: "first part" },
      { content: "second part" },
    ];
    assert.equal(codexContentToText(content), "first part\nsecond part");
  });

  it("handles string items in array", () => {
    const content = ["line 1", "line 2"];
    assert.equal(codexContentToText(content), "line 1\nline 2");
  });

  it("handles image blocks", () => {
    const content = [
      { type: "input_image", url: "..." },
      { text: "caption" },
    ];
    assert.equal(codexContentToText(content), "[image]\ncaption");
  });

  it("handles image_url type", () => {
    assert.equal(codexContentToText([{ type: "image_url" }]), "[image]");
    assert.equal(codexContentToText([{ type: "image" }]), "[image]");
  });

  it("skips empty strings in array", () => {
    const content = ["", "  ", "valid"];
    assert.equal(codexContentToText(content), "valid");
  });

  it("skips null/undefined items", () => {
    const content = [null, undefined, { text: "ok" }];
    assert.equal(codexContentToText(content), "ok");
  });
});

describe("codexEventToMessages", () => {
  it("parses user_message event", () => {
    const evt = {
      type: "event_msg",
      timestamp: 1700000000000,
      payload: { type: "user_message", message: "How do I fix this?" },
    };
    const msgs = codexEventToMessages(evt);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].role, "user");
    assert.equal(msgs[0].content, "How do I fix this?");
  });

  it("parses agent_message event", () => {
    const evt = {
      type: "event_msg",
      timestamp: 1700000000000,
      payload: { type: "agent_message", message: "Here is the fix." },
    };
    const msgs = codexEventToMessages(evt);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].role, "assistant");
  });

  it("skips empty messages", () => {
    const evt = {
      type: "event_msg",
      timestamp: 1700000000000,
      payload: { type: "user_message", message: "" },
    };
    assert.equal(codexEventToMessages(evt).length, 0);
  });

  it("parses function_call response_item", () => {
    const evt = {
      type: "response_item",
      timestamp: 1700000000000,
      payload: { type: "function_call", name: "read_file", arguments: '{"path":"foo.ts"}', call_id: "c1" },
    };
    const msgs = codexEventToMessages(evt);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].role, "assistant");
    assert.ok(msgs[0].content.includes("[tool_call] read_file"));
    assert.equal(msgs[0].external_id, "c1");
  });

  it("parses function_call_output response_item", () => {
    const evt = {
      type: "response_item",
      timestamp: 1700000000000,
      payload: { type: "function_call_output", output: "file contents", call_id: "c1" },
    };
    const msgs = codexEventToMessages(evt);
    assert.equal(msgs.length, 1);
    assert.ok(msgs[0].content.includes("[tool_result] file contents"));
  });

  it("parses message response_item", () => {
    const evt = {
      type: "response_item",
      timestamp: 1700000000000,
      payload: { type: "message", role: "assistant", content: "Done!" },
    };
    const msgs = codexEventToMessages(evt);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].role, "assistant");
    assert.equal(msgs[0].content, "Done!");
  });

  it("maps developer role to system", () => {
    const evt = {
      type: "response_item",
      timestamp: 1700000000000,
      payload: { type: "message", role: "developer", content: "system prompt" },
    };
    const msgs = codexEventToMessages(evt);
    assert.equal(msgs[0].role, "system");
  });

  it("returns empty for unknown event types", () => {
    const evt = { type: "unknown", timestamp: 1700000000000, payload: {} };
    assert.equal(codexEventToMessages(evt).length, 0);
  });

  it("uses timestamp from event, converting seconds to ms", () => {
    const evt = {
      type: "event_msg",
      timestamp: 1700000000, // seconds
      payload: { type: "user_message", message: "test" },
    };
    const msgs = codexEventToMessages(evt);
    assert.equal(msgs[0].timestamp, 1700000000000);
  });
});

describe("codexLegacyMessage", () => {
  it("extracts a user message", () => {
    const item = { role: "user", content: "Hello", timestamp: 1700000000000 };
    const msg = codexLegacyMessage(item);
    assert.ok(msg);
    assert.equal(msg!.role, "user");
    assert.equal(msg!.content, "Hello");
  });

  it("extracts an assistant message", () => {
    const item = { role: "assistant", text: "Response", timestamp: 1700000000000 };
    const msg = codexLegacyMessage(item);
    assert.ok(msg);
    assert.equal(msg!.role, "assistant");
    assert.equal(msg!.content, "Response");
  });

  it("returns null for empty content", () => {
    const item = { role: "user", content: "", timestamp: 1700000000000 };
    assert.equal(codexLegacyMessage(item), null);
  });

  it("falls back to message field", () => {
    const item = { role: "user", message: "via message field", timestamp: 1700000000000 };
    const msg = codexLegacyMessage(item);
    assert.ok(msg);
    assert.equal(msg!.content, "via message field");
  });

  it("defaults unknown roles to assistant", () => {
    const item = { role: "unknown", content: "test", timestamp: 1700000000000 };
    const msg = codexLegacyMessage(item);
    assert.ok(msg);
    assert.equal(msg!.role, "assistant");
  });

  it("uses type field as fallback role", () => {
    const item = { type: "user", content: "test", timestamp: 1700000000000 };
    const msg = codexLegacyMessage(item);
    assert.ok(msg);
    assert.equal(msg!.role, "user");
  });

  it("preserves external_id", () => {
    const item = { role: "user", content: "test", timestamp: 1700000000000, id: "ext-123" };
    const msg = codexLegacyMessage(item);
    assert.equal(msg!.external_id, "ext-123");
  });
});
