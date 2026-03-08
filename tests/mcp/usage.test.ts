import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb } from "../helpers.js";
import { logMcpToolUsage, getMcpUsageSummary } from "../../server/mcp/usage.js";

describe("MCP usage logging", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it("returns empty summary when no usage logged", () => {
    const summary = getMcpUsageSummary();
    assert.equal(summary.last_client, null);
    assert.equal(summary.last_tool, null);
    assert.equal(summary.last_used_at, null);
    assert.deepEqual(summary.clients, {});
  });

  it("logs tool usage and updates summary", () => {
    logMcpToolUsage("claude-code", "get_relevant_context");
    const summary = getMcpUsageSummary();

    assert.equal(summary.last_client, "claude-code");
    assert.equal(summary.last_tool, "get_relevant_context");
    assert.ok(summary.last_used_at !== null);
    assert.ok(summary.last_used_at! > Date.now() - 5000);

    assert.ok(summary.clients["claude-code"]);
    assert.equal(summary.clients["claude-code"].call_count, 1);
    assert.ok(summary.clients["claude-code"].last_used_at !== null);
  });

  it("increments call count on repeated usage", () => {
    logMcpToolUsage("claude-code", "get_relevant_context");
    logMcpToolUsage("claude-code", "get_relevant_context");
    logMcpToolUsage("claude-code", "get_relevant_context");

    const summary = getMcpUsageSummary();
    assert.equal(summary.clients["claude-code"].call_count, 3);
  });

  it("tracks multiple clients independently", () => {
    logMcpToolUsage("claude-code", "get_relevant_context");
    logMcpToolUsage("cursor", "get_relevant_context");

    const summary = getMcpUsageSummary();
    assert.equal(summary.last_client, "cursor");
    assert.equal(summary.clients["claude-code"].call_count, 1);
    assert.equal(summary.clients["cursor"].call_count, 1);
  });
});
