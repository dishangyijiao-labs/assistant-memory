import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg, getLastMessageId } from "./helpers.js";
import { tryRecordEvalPair, getEvalStats } from "../src/storage/queries/eval.js";
import { upsertQualityScore } from "../src/storage/queries/quality.js";
import { upsertSession } from "../src/storage/queries/sessions.js";
import { insertMessage } from "../src/storage/queries/messages.js";

describe("eval queries", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("tryRecordEvalPair", () => {
    it("records a pair when prior message has a score", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "answer", timestamp: 150, role: "assistant" }));
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      // Score the first message
      upsertQualityScore({
        messageId: id1, sessionId: sid, score: 60, grade: "C",
        deductionsJson: "[]", missingInfoChecklistJson: "[]", rewritesJson: "{}", tagsJson: "[]",
      });

      // Now score the second and try to record pair
      tryRecordEvalPair(id2, sid, 85);

      const stats = getEvalStats();
      assert.equal(stats.pair_count, 1);
      assert.equal(stats.improved_count, 1);
      assert.equal(stats.avg_delta, 25);
    });

    it("does nothing when no prior user message exists", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "first question", timestamp: 100 }));
      const id1 = getLastMessageId();

      tryRecordEvalPair(id1, sid, 80);

      const stats = getEvalStats();
      assert.equal(stats.pair_count, 0);
    });

    it("does nothing when prior message has no score", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      tryRecordEvalPair(id2, sid, 80);

      const stats = getEvalStats();
      assert.equal(stats.pair_count, 0);
    });
  });

  describe("getEvalStats", () => {
    it("returns zeros for empty DB", () => {
      const stats = getEvalStats();
      assert.equal(stats.pair_count, 0);
      assert.equal(stats.improvement_rate, 0);
      assert.equal(stats.avg_delta, 0);
    });

    it("computes stats with mixed improvements/regressions", () => {
      const sid = upsertSession(makeSession());
      // 3 user questions
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q3", timestamp: 300 }));
      const id3 = getLastMessageId();

      // Score q1 and q2
      upsertQualityScore({
        messageId: id1, sessionId: sid, score: 70, grade: "C+",
        deductionsJson: "[]", missingInfoChecklistJson: "[]", rewritesJson: "{}", tagsJson: "[]",
      });
      upsertQualityScore({
        messageId: id2, sessionId: sid, score: 50, grade: "D",
        deductionsJson: "[]", missingInfoChecklistJson: "[]", rewritesJson: "{}", tagsJson: "[]",
      });

      // Record pair q1->q2 (regression: 70->50)
      tryRecordEvalPair(id2, sid, 50);
      // Record pair q2->q3 (improvement: 50->90)
      upsertQualityScore({
        messageId: id2, sessionId: sid, score: 50, grade: "D",
        deductionsJson: "[]", missingInfoChecklistJson: "[]", rewritesJson: "{}", tagsJson: "[]",
      });
      tryRecordEvalPair(id3, sid, 90);

      const stats = getEvalStats();
      assert.equal(stats.pair_count, 2);
      assert.equal(stats.improved_count, 1);
      assert.equal(stats.regressed_count, 1);
      assert.equal(stats.unchanged_count, 0);
    });

    it("filters by sessionIds", () => {
      const sid1 = upsertSession(makeSession({ external_id: "es1" }));
      const sid2 = upsertSession(makeSession({ external_id: "es2" }));

      // Session 1: pair
      insertMessage(sid1, makeMsg({ content: "s1q1", timestamp: 100 }));
      const s1id1 = getLastMessageId();
      insertMessage(sid1, makeMsg({ content: "s1q2", timestamp: 200 }));
      const s1id2 = getLastMessageId();
      upsertQualityScore({
        messageId: s1id1, sessionId: sid1, score: 60, grade: "C",
        deductionsJson: "[]", missingInfoChecklistJson: "[]", rewritesJson: "{}", tagsJson: "[]",
      });
      tryRecordEvalPair(s1id2, sid1, 80);

      // Session 2: pair
      insertMessage(sid2, makeMsg({ content: "s2q1", timestamp: 100 }));
      const s2id1 = getLastMessageId();
      insertMessage(sid2, makeMsg({ content: "s2q2", timestamp: 200 }));
      const s2id2 = getLastMessageId();
      upsertQualityScore({
        messageId: s2id1, sessionId: sid2, score: 70, grade: "C+",
        deductionsJson: "[]", missingInfoChecklistJson: "[]", rewritesJson: "{}", tagsJson: "[]",
      });
      tryRecordEvalPair(s2id2, sid2, 75);

      const all = getEvalStats();
      assert.equal(all.pair_count, 2);

      const filtered = getEvalStats({ sessionIds: [sid1] });
      assert.equal(filtered.pair_count, 1);
    });
  });
});
