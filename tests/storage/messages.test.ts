import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg } from "../helpers.js";
import { insertMessage, listMessages, searchMessages, clearSessionMessages } from "../../server/storage/queries/messages.js";
import { upsertSession } from "../../server/storage/queries/sessions.js";

describe("messages queries", () => {
  let cleanup: () => void;
  let sessionId: number;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
    sessionId = upsertSession(makeSession());
  });

  afterEach(() => {
    cleanup();
  });

  describe("insertMessage", () => {
    it("inserts a message into the database", () => {
      insertMessage(sessionId, makeMsg({ content: "test content" }));
      const results = listMessages(10);
      assert.equal(results.length, 1);
      assert.ok(results[0].snippet.includes("test content"));
    });

    it("inserts multiple messages", () => {
      insertMessage(sessionId, makeMsg({ content: "first", timestamp: 100 }));
      insertMessage(sessionId, makeMsg({ content: "second", timestamp: 200 }));
      const results = listMessages(10);
      assert.equal(results.length, 2);
    });
  });

  describe("listMessages", () => {
    it("returns empty array when no messages", () => {
      const results = listMessages(10);
      assert.equal(results.length, 0);
    });

    it("respects limit parameter", () => {
      for (let i = 0; i < 5; i++) {
        insertMessage(sessionId, makeMsg({ content: `msg ${i}`, timestamp: i }));
      }
      const results = listMessages(3);
      assert.equal(results.length, 3);
    });

    it("orders by timestamp desc", () => {
      insertMessage(sessionId, makeMsg({ content: "old", timestamp: 100 }));
      insertMessage(sessionId, makeMsg({ content: "new", timestamp: 200 }));
      const results = listMessages(10);
      assert.ok(results[0].snippet.includes("new"));
      assert.ok(results[1].snippet.includes("old"));
    });

    it("filters by source", () => {
      const cursorSession = upsertSession(makeSession({ source: "cursor", external_id: "s-cursor" }));
      const copilotSession = upsertSession(makeSession({ source: "copilot", external_id: "s-copilot" }));
      insertMessage(cursorSession, makeMsg({ content: "from cursor", timestamp: 100 }));
      insertMessage(copilotSession, makeMsg({ content: "from copilot", timestamp: 200 }));

      const cursorResults = listMessages(10, "cursor");
      assert.equal(cursorResults.length, 1);
      assert.ok(cursorResults[0].snippet.includes("from cursor"));
    });
  });

  describe("searchMessages", () => {
    it("finds messages by keyword", () => {
      insertMessage(sessionId, makeMsg({ content: "typescript is great", timestamp: 100 }));
      insertMessage(sessionId, makeMsg({ content: "python is also good", timestamp: 200 }));
      const results = searchMessages("typescript", 10);
      assert.equal(results.length, 1);
      assert.ok(results[0].snippet.includes("typescript"));
    });

    it("returns empty for non-matching query", () => {
      insertMessage(sessionId, makeMsg({ content: "hello world", timestamp: 100 }));
      const results = searchMessages("nonexistent", 10);
      assert.equal(results.length, 0);
    });

    it("handles special characters in query safely", () => {
      insertMessage(sessionId, makeMsg({ content: "test content", timestamp: 100 }));
      // Should not throw even with special chars
      const results = searchMessages('test* OR "injection', 10);
      assert.ok(Array.isArray(results));
    });

    it("respects limit", () => {
      for (let i = 0; i < 5; i++) {
        insertMessage(sessionId, makeMsg({ content: `common keyword here ${i}`, timestamp: i }));
      }
      const results = searchMessages("common", 2);
      assert.equal(results.length, 2);
    });

    it("filters by source", () => {
      const cursorSession = upsertSession(makeSession({ source: "cursor", external_id: "s2-cursor" }));
      const copilotSession = upsertSession(makeSession({ source: "copilot", external_id: "s2-copilot" }));
      insertMessage(cursorSession, makeMsg({ content: "shared keyword cursor", timestamp: 100 }));
      insertMessage(copilotSession, makeMsg({ content: "shared keyword copilot", timestamp: 200 }));

      const results = searchMessages("shared", 10, "copilot");
      assert.equal(results.length, 1);
      assert.equal(results[0].source, "copilot");
    });
  });

  describe("clearSessionMessages", () => {
    it("removes all messages for a session", () => {
      insertMessage(sessionId, makeMsg({ content: "msg1", timestamp: 100 }));
      insertMessage(sessionId, makeMsg({ content: "msg2", timestamp: 200 }));
      assert.equal(listMessages(10).length, 2);

      clearSessionMessages(sessionId);
      assert.equal(listMessages(10).length, 0);
    });

    it("does not affect other sessions", () => {
      const otherSession = upsertSession(makeSession({ external_id: "other" }));
      insertMessage(sessionId, makeMsg({ content: "session1 msg", timestamp: 100 }));
      insertMessage(otherSession, makeMsg({ content: "session2 msg", timestamp: 200 }));

      clearSessionMessages(sessionId);
      const results = listMessages(10);
      assert.equal(results.length, 1);
      assert.ok(results[0].snippet.includes("session2"));
    });
  });
});
