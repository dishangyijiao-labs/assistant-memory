import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg, getLastMessageId } from "./helpers.js";
import { retrieveSimilarUserQuestions } from "../src/storage/queries/rag.js";
import { upsertQualityScore } from "../src/storage/queries/quality.js";
import { upsertSession } from "../src/storage/queries/sessions.js";
import { insertMessage } from "../src/storage/queries/messages.js";

describe("rag queries", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("retrieveSimilarUserQuestions", () => {
    it("finds similar user messages via FTS", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "how to configure typescript compiler options", timestamp: 100 }));
      insertMessage(sid, makeMsg({ content: "python list comprehension examples", timestamp: 200 }));

      const results = retrieveSimilarUserQuestions({ query: "typescript compiler" });
      assert.equal(results.length, 1);
      assert.ok(results[0].content.includes("typescript"));
    });

    it("returns empty for empty query", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "some content", timestamp: 100 }));
      const results = retrieveSimilarUserQuestions({ query: "" });
      assert.equal(results.length, 0);
    });

    it("returns empty for special-chars-only query", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "test content", timestamp: 100 }));
      const results = retrieveSimilarUserQuestions({ query: "***!!!" });
      assert.equal(results.length, 0);
    });

    it("excludes specified message id", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "unique typescript question", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "another typescript question", timestamp: 200 }));

      const results = retrieveSimilarUserQuestions({ query: "typescript", excludeMessageId: id1 });
      assert.equal(results.length, 1);
      assert.ok(results[0].content.includes("another"));
    });

    it("respects limit", () => {
      const sid = upsertSession(makeSession());
      for (let i = 0; i < 10; i++) {
        insertMessage(sid, makeMsg({ content: `javascript framework question ${i}`, timestamp: i * 100 }));
      }
      const results = retrieveSimilarUserQuestions({ query: "javascript", limit: 3 });
      assert.equal(results.length, 3);
    });

    it("filters by minScore and falls back when no results", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "react hooks best practices guide", timestamp: 100 }));
      const id1 = getLastMessageId();

      // Score = 50, below minScore of 80
      upsertQualityScore({
        messageId: id1, sessionId: sid, score: 50, grade: "D",
        deductionsJson: "[]", missingInfoChecklistJson: "[]", rewritesJson: "{}", tagsJson: "[]",
      });

      // With minScore=80, should still find results via fallback (minScore=0)
      const results = retrieveSimilarUserQuestions({ query: "react hooks", minScore: 80 });
      assert.ok(results.length > 0);
    });

    it("only returns user role messages", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "user asks about databases", timestamp: 100, role: "user" }));
      insertMessage(sid, makeMsg({ content: "assistant explains databases", timestamp: 200, role: "assistant" }));

      const results = retrieveSimilarUserQuestions({ query: "databases" });
      assert.equal(results.length, 1);
      assert.ok(results[0].content.includes("user asks"));
    });

    it("includes quality score when available", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "deployment pipeline question", timestamp: 100 }));
      const id1 = getLastMessageId();

      upsertQualityScore({
        messageId: id1, sessionId: sid, score: 95, grade: "A",
        deductionsJson: "[]", missingInfoChecklistJson: "[]", rewritesJson: "{}", tagsJson: "[]",
      });

      const results = retrieveSimilarUserQuestions({ query: "deployment pipeline" });
      assert.equal(results.length, 1);
      assert.equal(results[0].score, 95);
      assert.equal(results[0].grade, "A");
    });

    it("returns null score/grade when not scored", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "unscored question about testing", timestamp: 100 }));

      const results = retrieveSimilarUserQuestions({ query: "testing" });
      assert.equal(results.length, 1);
      assert.equal(results[0].score, null);
      assert.equal(results[0].grade, null);
    });
  });
});
