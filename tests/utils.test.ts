import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFtsQuery } from "../src/storage/utils.js";

describe("sanitizeFtsQuery", () => {
  it("returns empty phrase for empty string", () => {
    assert.equal(sanitizeFtsQuery(""), '""');
  });

  it("returns empty phrase for whitespace-only", () => {
    assert.equal(sanitizeFtsQuery("   "), '""');
  });

  it("returns empty phrase for only special characters", () => {
    assert.equal(sanitizeFtsQuery("***!!!"), '""');
  });

  it("wraps a single token in quotes", () => {
    assert.equal(sanitizeFtsQuery("hello"), '"hello"');
  });

  it("wraps multiple tokens in a single phrase", () => {
    assert.equal(sanitizeFtsQuery("hello world"), '"hello world"');
  });

  it("collapses multiple spaces", () => {
    assert.equal(sanitizeFtsQuery("  hello   world  "), '"hello world"');
  });

  it("strips FTS5 operators and special chars", () => {
    assert.equal(sanitizeFtsQuery('hello* AND "world"'), '"hello AND world"');
  });

  it("strips parentheses and braces", () => {
    assert.equal(sanitizeFtsQuery("(foo) {bar} [baz]"), '"foo bar baz"');
  });

  it("handles mixed special chars and valid tokens", () => {
    assert.equal(sanitizeFtsQuery("@user: check #this!"), '"user check this"');
  });

  it("handles unicode text", () => {
    assert.equal(sanitizeFtsQuery("你好 世界"), '"你好 世界"');
  });
});
