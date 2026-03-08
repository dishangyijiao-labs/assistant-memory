import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { claudeContentBlocksToText, isOnlyToolResult } from "../../server/ingest/claude-code.js";

describe("claudeContentBlocksToText", () => {
  it("extracts plain text blocks", () => {
    const blocks = [
      { type: "text", text: "Hello world" },
      { type: "text", text: "Second line" },
    ];
    assert.equal(claudeContentBlocksToText(blocks), "Hello world\nSecond line");
  });

  it("handles raw string blocks", () => {
    const blocks = ["raw string", "another"];
    assert.equal(claudeContentBlocksToText(blocks), "raw string\nanother");
  });

  it("handles tool_use blocks", () => {
    const blocks = [
      { type: "tool_use", name: "read_file", input: { path: "/foo.ts" } },
    ];
    const result = claudeContentBlocksToText(blocks);
    assert.ok(result.includes("[tool_call] read_file"));
    assert.ok(result.includes("/foo.ts"));
  });

  it("handles tool_use with no input", () => {
    const blocks = [{ type: "tool_use", name: "list_files" }];
    assert.equal(claudeContentBlocksToText(blocks), "[tool_call] list_files");
  });

  it("handles tool_result with string content", () => {
    const blocks = [{ type: "tool_result", content: "file contents here" }];
    assert.equal(claudeContentBlocksToText(blocks), "[tool_result] file contents here");
  });

  it("handles tool_result with nested array content", () => {
    const blocks = [
      { type: "tool_result", content: [{ type: "text", text: "nested result" }] },
    ];
    assert.equal(claudeContentBlocksToText(blocks), "[tool_result] nested result");
  });

  it("handles tool_result with empty content", () => {
    const blocks = [{ type: "tool_result", content: "" }];
    assert.equal(claudeContentBlocksToText(blocks), "[tool_result]");
  });

  it("handles image blocks", () => {
    const blocks = [{ type: "image" }];
    assert.equal(claudeContentBlocksToText(blocks), "[image]");
  });

  it("handles image_url blocks", () => {
    const blocks = [{ type: "image_url", url: "https://example.com/img.png" }];
    assert.equal(claudeContentBlocksToText(blocks), "[image]");
  });

  it("skips null/undefined entries", () => {
    const blocks = [null, undefined, { type: "text", text: "valid" }];
    assert.equal(claudeContentBlocksToText(blocks as unknown[]), "valid");
  });

  it("skips unknown block types silently", () => {
    const blocks = [
      { type: "unknown_type", data: "something" },
      { type: "text", text: "visible" },
    ];
    assert.equal(claudeContentBlocksToText(blocks), "visible");
  });

  it("handles mixed block types", () => {
    const blocks = [
      { type: "text", text: "Let me check that file." },
      { type: "tool_use", name: "read_file", input: { path: "src/main.ts" } },
      { type: "tool_result", content: "export function main() {}" },
      { type: "text", text: "Here is the result." },
    ];
    const result = claudeContentBlocksToText(blocks);
    assert.ok(result.includes("Let me check that file."));
    assert.ok(result.includes("[tool_call] read_file"));
    assert.ok(result.includes("[tool_result]"));
    assert.ok(result.includes("Here is the result."));
  });

  it("trims whitespace from text blocks", () => {
    const blocks = [{ type: "text", text: "  padded  " }];
    assert.equal(claudeContentBlocksToText(blocks), "padded");
  });

  it("skips empty text blocks", () => {
    const blocks = [
      { type: "text", text: "" },
      { type: "text", text: "   " },
      { type: "text", text: "valid" },
    ];
    assert.equal(claudeContentBlocksToText(blocks), "valid");
  });
});

describe("isOnlyToolResult", () => {
  it("returns true for only tool_result blocks", () => {
    const blocks = [
      { type: "tool_result", content: "result 1" },
      { type: "tool_result", content: "result 2" },
    ];
    assert.equal(isOnlyToolResult(blocks), true);
  });

  it("returns false when text blocks with content exist", () => {
    const blocks = [
      { type: "tool_result", content: "result" },
      { type: "text", text: "Some actual text" },
    ];
    assert.equal(isOnlyToolResult(blocks), false);
  });

  it("returns true with empty text blocks alongside tool_result", () => {
    const blocks = [
      { type: "tool_result", content: "result" },
      { type: "text", text: "" },
      { type: "text", text: "   " },
    ];
    assert.equal(isOnlyToolResult(blocks), true);
  });

  it("returns false for empty array", () => {
    assert.equal(isOnlyToolResult([]), false);
  });

  it("returns false for only text blocks", () => {
    const blocks = [{ type: "text", text: "Hello" }];
    assert.equal(isOnlyToolResult(blocks), false);
  });

  it("handles null/undefined in array", () => {
    const blocks = [null, { type: "tool_result", content: "x" }];
    assert.equal(isOnlyToolResult(blocks as unknown[]), true);
  });
});
