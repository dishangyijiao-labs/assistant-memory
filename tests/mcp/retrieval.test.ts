import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg } from "../helpers.js";
import { upsertSession } from "../../server/storage/queries/sessions.js";
import { insertMessage } from "../../server/storage/queries/messages.js";
import { getRelevantContext } from "../../server/mcp/retrieval.js";
import type { ContextSnippet } from "../../server/mcp/retrieval.js";

describe("getRelevantContext", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it("returns empty array for empty query", () => {
    const result = getRelevantContext("");
    assert.deepEqual(result, []);
  });

  it("returns empty array for whitespace-only query", () => {
    const result = getRelevantContext("   ");
    assert.deepEqual(result, []);
  });

  it("returns results matching a normal query", () => {
    const sessionId = upsertSession(makeSession({ source: "cursor", workspace: "/projects/alpha" }));
    insertMessage(sessionId, makeMsg({
      role: "user",
      content: "How do I configure webpack production builds?",
      timestamp: Date.now(),
    }));

    const results = getRelevantContext("webpack production");

    assert.ok(results.length > 0, "expected at least one result");
    const first = results[0];
    assert.equal(typeof first.source, "string");
    assert.equal(typeof first.workspace, "string");
    assert.equal(typeof first.timestamp, "string");
    // timestamp should be a valid ISO 8601 string
    assert.ok(!Number.isNaN(Date.parse(first.timestamp)), "timestamp should be a valid ISO date");
    assert.equal(typeof first.snippet, "string");
    assert.equal(typeof first.relevance, "number");
    assert.ok(first.relevance >= 0 && first.relevance <= 1, "relevance should be between 0 and 1");
  });

  it("returns at most 3 snippets", () => {
    const sessionId = upsertSession(makeSession({ source: "cursor", workspace: "/projects/beta" }));
    for (let i = 0; i < 6; i++) {
      insertMessage(sessionId, makeMsg({
        role: "user",
        content: `Deploying microservice number ${i} to kubernetes cluster`,
        timestamp: Date.now() - i * 60_000,
      }));
    }

    const results = getRelevantContext("kubernetes deploy");

    assert.ok(results.length <= 3, `expected at most 3 results, got ${results.length}`);
  });

  it("boosts ranking for messages matching workspace hint", () => {
    const wsTarget = "/projects/target-workspace";
    const wsOther = "/projects/other-workspace";

    const sessionTarget = upsertSession(makeSession({
      source: "cursor",
      workspace: wsTarget,
      external_id: "s-target",
    }));
    const sessionOther = upsertSession(makeSession({
      source: "cursor",
      workspace: wsOther,
      external_id: "s-other",
    }));

    // Insert the same content into both workspaces so FTS scores are equal
    const content = "Implementing authentication middleware for express server";
    insertMessage(sessionOther, makeMsg({
      role: "user",
      content,
      timestamp: Date.now() - 100_000,
    }));
    insertMessage(sessionTarget, makeMsg({
      role: "user",
      content,
      timestamp: Date.now() - 100_000,
    }));

    const results = getRelevantContext("authentication middleware", wsTarget);

    assert.ok(results.length > 0, "expected results");
    // The top result should come from the target workspace
    assert.equal(results[0].workspace, wsTarget,
      "workspace hint should boost matching workspace to the top");
  });

  it("deduplicates results with identical snippet text", () => {
    const duplicateContent = "Setting up CI pipeline with GitHub Actions for Node projects";

    // Insert the same content across two different sessions
    const session1 = upsertSession(makeSession({
      source: "cursor",
      workspace: "/ws/one",
      external_id: "s-dup-1",
    }));
    const session2 = upsertSession(makeSession({
      source: "cursor",
      workspace: "/ws/two",
      external_id: "s-dup-2",
    }));

    insertMessage(session1, makeMsg({
      role: "user",
      content: duplicateContent,
      timestamp: Date.now(),
    }));
    insertMessage(session2, makeMsg({
      role: "user",
      content: duplicateContent,
      timestamp: Date.now(),
    }));

    const results = getRelevantContext("CI pipeline GitHub Actions");

    // After deduplication, there should be only one result for the duplicate content
    const snippets = results.map((r) => r.snippet);
    const uniqueSnippets = new Set(snippets);
    assert.equal(snippets.length, uniqueSnippets.size,
      "results should not contain duplicate snippets");
  });

  it("returns results with correct output shape", () => {
    const sessionId = upsertSession(makeSession({
      source: "cursor",
      workspace: "/projects/gamma",
    }));
    insertMessage(sessionId, makeMsg({
      role: "user",
      content: "Debugging memory leaks in long-running Node process",
      timestamp: Date.now(),
    }));

    const results = getRelevantContext("memory leaks");

    assert.ok(results.length > 0, "expected at least one result");
    for (const item of results) {
      // All required fields must be present
      assert.ok("source" in item, "missing source field");
      assert.ok("workspace" in item, "missing workspace field");
      assert.ok("timestamp" in item, "missing timestamp field");
      assert.ok("snippet" in item, "missing snippet field");
      assert.ok("relevance" in item, "missing relevance field");

      // Type checks
      assert.equal(typeof item.source, "string");
      assert.equal(typeof item.workspace, "string");
      assert.equal(typeof item.timestamp, "string");
      assert.equal(typeof item.snippet, "string");
      assert.equal(typeof item.relevance, "number");

      // timestamp is ISO 8601
      const parsed = Date.parse(item.timestamp);
      assert.ok(!Number.isNaN(parsed), "timestamp must be a valid ISO 8601 string");

      // relevance in [0, 1]
      assert.ok(item.relevance >= 0, "relevance must be >= 0");
      assert.ok(item.relevance <= 1, "relevance must be <= 1");

      // source and snippet should be non-empty
      assert.ok(item.source.length > 0, "source must be non-empty");
      assert.ok(item.snippet.length > 0, "snippet must be non-empty");
    }
  });

  it("returns results sorted by relevance descending", () => {
    const sessionId = upsertSession(makeSession({ source: "cursor", workspace: "/projects/delta" }));
    for (let i = 0; i < 5; i++) {
      insertMessage(sessionId, makeMsg({
        role: "user",
        content: `Optimizing database queries for faster response times iteration ${i}`,
        timestamp: Date.now() - i * 3_600_000, // spread across hours
      }));
    }

    const results = getRelevantContext("database queries optimization");

    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].relevance >= results[i].relevance,
        `results should be sorted by relevance desc: index ${i - 1} (${results[i - 1].relevance}) >= index ${i} (${results[i].relevance})`);
    }
  });
});
