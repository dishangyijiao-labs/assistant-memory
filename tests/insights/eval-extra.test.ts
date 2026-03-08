import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg, getLastMessageId } from "../helpers.js";
import { tryRecordEvalPair, getEvalStats } from "../../server/storage/queries/eval.js";
import { upsertQualityScore } from "../../server/storage/queries/quality.js";
import { upsertSession } from "../../server/storage/queries/sessions.js";
import { insertMessage } from "../../server/storage/queries/messages.js";

function score(messageId: number, sessionId: number, score: number) {
  upsertQualityScore({
    messageId, sessionId, score, grade: score >= 80 ? "A" : "C",
    deductionsJson: "[]", missingInfoChecklistJson: "[]", rewritesJson: "{}", tagsJson: "[]",
  });
}

describe("eval – additional coverage", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("tryRecordEvalPair – upsert on conflict", () => {
    it("updates existing pair when re-scored", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      score(id1, sid, 60);
      tryRecordEvalPair(id2, sid, 70);

      let stats = getEvalStats();
      assert.equal(stats.pair_count, 1);
      assert.equal(stats.avg_delta, 10);

      // Re-score: now next_score changes to 90
      tryRecordEvalPair(id2, sid, 90);

      stats = getEvalStats();
      assert.equal(stats.pair_count, 1); // still 1, not 2
      assert.equal(stats.avg_delta, 30); // 90 - 60
    });
  });

  describe("tryRecordEvalPair – unchanged delta (delta=0)", () => {
    it("records pair and counts as unchanged", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      score(id1, sid, 75);
      tryRecordEvalPair(id2, sid, 75);

      const stats = getEvalStats();
      assert.equal(stats.pair_count, 1);
      assert.equal(stats.unchanged_count, 1);
      assert.equal(stats.improved_count, 0);
      assert.equal(stats.regressed_count, 0);
      assert.equal(stats.avg_delta, 0);
    });
  });

  describe("tryRecordEvalPair – multiple pairs in same session", () => {
    it("records sequential pairs q1→q2 and q2→q3", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q3", timestamp: 300 }));
      const id3 = getLastMessageId();

      score(id1, sid, 50);
      score(id2, sid, 70);
      tryRecordEvalPair(id2, sid, 70); // pair: 50→70
      tryRecordEvalPair(id3, sid, 90); // pair: 70→90

      const stats = getEvalStats();
      assert.equal(stats.pair_count, 2);
      assert.equal(stats.improved_count, 2);
      // avg_delta = (20 + 20) / 2 = 20
      assert.equal(stats.avg_delta, 20);
      assert.equal(stats.avg_prior_score, 60); // (50+70)/2
      assert.equal(stats.avg_next_score, 80);  // (70+90)/2
    });
  });

  describe("tryRecordEvalPair – skips assistant messages between user messages", () => {
    it("finds correct prior user message even with assistant messages in between", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "answer1", timestamp: 150, role: "assistant" }));
      insertMessage(sid, makeMsg({ content: "answer2", timestamp: 160, role: "assistant" }));
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      score(id1, sid, 60);
      tryRecordEvalPair(id2, sid, 85);

      const stats = getEvalStats();
      assert.equal(stats.pair_count, 1);
      assert.equal(stats.avg_delta, 25);
    });
  });

  describe("getEvalStats – timeFrom and timeTo filtering", () => {
    it("filters by timeFrom", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      score(id1, sid, 60);
      tryRecordEvalPair(id2, sid, 80);

      // The pair's created_at is Date.now(), so filtering with future timeFrom returns nothing
      const futureFrom = Date.now() + 100000;
      const stats = getEvalStats({ timeFrom: futureFrom });
      assert.equal(stats.pair_count, 0);

      // But current time range includes it
      const pastFrom = Date.now() - 100000;
      const stats2 = getEvalStats({ timeFrom: pastFrom });
      assert.equal(stats2.pair_count, 1);
    });

    it("filters by timeTo", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      score(id1, sid, 60);
      tryRecordEvalPair(id2, sid, 80);

      // timeTo in the past excludes the pair
      const pastTo = Date.now() - 100000;
      const stats = getEvalStats({ timeTo: pastTo });
      assert.equal(stats.pair_count, 0);
    });

    it("filters by both timeFrom and timeTo", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      score(id1, sid, 60);
      tryRecordEvalPair(id2, sid, 80);

      const now = Date.now();
      const stats = getEvalStats({ timeFrom: now - 100000, timeTo: now + 100000 });
      assert.equal(stats.pair_count, 1);
    });
  });

  describe("getEvalStats – improvement_rate calculation", () => {
    it("computes correct improvement_rate with mixed results", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q3", timestamp: 300 }));
      const id3 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q4", timestamp: 400 }));
      const id4 = getLastMessageId();

      score(id1, sid, 60);
      score(id2, sid, 80);
      score(id3, sid, 70);

      tryRecordEvalPair(id2, sid, 80); // improved: +20
      tryRecordEvalPair(id3, sid, 70); // regressed: -10
      tryRecordEvalPair(id4, sid, 70); // unchanged: 0

      const stats = getEvalStats();
      assert.equal(stats.pair_count, 3);
      assert.equal(stats.improved_count, 1);
      assert.equal(stats.regressed_count, 1);
      assert.equal(stats.unchanged_count, 1);
      // improvement_rate = 1/3
      assert.ok(Math.abs(stats.improvement_rate - 1 / 3) < 0.01);
    });
  });
});
