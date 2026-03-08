import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg, makeScoreInput, getLastMessageId } from "../helpers.js";
import {
  upsertQualityScore,
  getQualityScoresBySessionId,
  getQualityScoresByMessageIds,
  getQualityKpiForScope,
  getTopLowQualityQuestions,
  getGrowthData,
} from "../../server/storage/queries/quality.js";
import { upsertSession } from "../../server/storage/queries/sessions.js";
import { insertMessage } from "../../server/storage/queries/messages.js";
import { getDb } from "../../server/storage/db-core.js";

describe("quality queries", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("upsertQualityScore", () => {
    it("inserts a quality score", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ timestamp: 100 }));
      const msgId = getLastMessageId();

      upsertQualityScore(makeScoreInput({ messageId: msgId, sessionId: sid, score: 90, grade: "A" }));

      const scores = getQualityScoresBySessionId(sid);
      assert.equal(scores.length, 1);
      assert.equal(scores[0].score, 90);
      assert.equal(scores[0].grade, "A");
    });

    it("upserts on conflict (same message_id)", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ timestamp: 100 }));
      const msgId = getLastMessageId();

      upsertQualityScore(makeScoreInput({ messageId: msgId, sessionId: sid, score: 50, grade: "D" }));
      upsertQualityScore(makeScoreInput({ messageId: msgId, sessionId: sid, score: 90, grade: "A" }));

      const scores = getQualityScoresBySessionId(sid);
      assert.equal(scores.length, 1);
      assert.equal(scores[0].score, 90);
    });
  });

  describe("getQualityScoresByMessageIds", () => {
    it("returns a map of message_id to score", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "msg1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "msg2", timestamp: 200 }));
      const id2 = getLastMessageId();

      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 70 }));
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid, score: 95 }));

      const map = getQualityScoresByMessageIds([id1, id2]);
      assert.equal(map.size, 2);
      assert.equal(map.get(id1)!.score, 70);
      assert.equal(map.get(id2)!.score, 95);
    });

    it("returns empty map for empty input", () => {
      const map = getQualityScoresByMessageIds([]);
      assert.equal(map.size, 0);
    });
  });

  describe("getQualityKpiForScope", () => {
    it("returns zeros for empty scope", () => {
      const kpi = getQualityKpiForScope({});
      assert.equal(kpi.scored_question_count, 0);
      assert.equal(kpi.total_user_question_count, 0);
      assert.equal(kpi.high_quality_ratio, 0);
    });

    it("computes KPI for given sessions", () => {
      const sid = upsertSession(makeSession());
      // 3 user messages = 2 follow-up rounds
      insertMessage(sid, makeMsg({ content: "question 1", timestamp: 100, role: "user" }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "answer 1", timestamp: 101, role: "assistant" }));
      insertMessage(sid, makeMsg({ content: "question 2", timestamp: 200, role: "user" }));
      const id2 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "question 3", timestamp: 300, role: "user" }));
      const id3 = getLastMessageId();

      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 90 }));
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid, score: 60 }));
      upsertQualityScore(makeScoreInput({ messageId: id3, sessionId: sid, score: 85 }));

      const kpi = getQualityKpiForScope({ sessionIds: [sid] });
      assert.equal(kpi.total_user_question_count, 3);
      assert.equal(kpi.scored_question_count, 3);
      // 2 out of 3 have score >= 80
      assert.ok(kpi.high_quality_ratio > 0.6);
    });
  });

  describe("getTopLowQualityQuestions", () => {
    it("returns low-scoring questions sorted by score asc", () => {
      const sid = upsertSession(makeSession({ external_id: "low-q" }));
      insertMessage(sid, makeMsg({ content: "bad question here", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "good question here", timestamp: 200 }));
      const id2 = getLastMessageId();

      upsertQualityScore(makeScoreInput({
        messageId: id1, sessionId: sid, score: 30, grade: "F",
        deductionsJson: '[{"reason":"vague"}]',
        missingInfoChecklistJson: '["context","version"]',
        rewritesJson: '{"short":"better q","engineering":"eng q","exploratory":"exp q"}',
      }));
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid, score: 90, grade: "A" }));

      const low = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80 });
      assert.equal(low.length, 1);
      assert.equal(low[0].score, 30);
      assert.ok(low[0].deduction_reasons.includes("vague"));
      assert.ok(low[0].required_checklist_md.includes("context"));
      assert.equal(low[0].rewrite_short, "better q");
    });

    it("returns empty when all scores are high", () => {
      const sid = upsertSession(makeSession({ external_id: "all-high" }));
      insertMessage(sid, makeMsg({ timestamp: 100 }));
      upsertQualityScore(makeScoreInput({ messageId: getLastMessageId(), sessionId: sid, score: 95 }));
      const low = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80 });
      assert.equal(low.length, 0);
    });
  });

  describe("getGrowthData", () => {
    it("returns daily aggregates", () => {
      const sid = upsertSession(makeSession());
      // Create messages on two different "days"
      // Use known timestamps: 2024-01-01 and 2024-01-02
      const day1 = new Date("2024-01-01T12:00:00Z").getTime();
      const day2 = new Date("2024-01-02T12:00:00Z").getTime();

      insertMessage(sid, makeMsg({ content: "d1m1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "d1m2", timestamp: 200 }));
      const id2 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "d2m1", timestamp: 300 }));
      const id3 = getLastMessageId();

      // Manually set created_at for quality scores to specific dates
      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 70 }));
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid, score: 90 }));
      upsertQualityScore(makeScoreInput({ messageId: id3, sessionId: sid, score: 85 }));

      // Override created_at to fixed dates
      getDb().prepare("UPDATE message_quality_scores SET created_at = ? WHERE message_id = ?").run(day1, id1);
      getDb().prepare("UPDATE message_quality_scores SET created_at = ? WHERE message_id = ?").run(day1, id2);
      getDb().prepare("UPDATE message_quality_scores SET created_at = ? WHERE message_id = ?").run(day2, id3);

      const data = getGrowthData({});
      assert.equal(data.length, 2);
      assert.equal(data[0].date, "2024-01-01");
      assert.equal(data[0].count, 2);
      assert.equal(data[1].date, "2024-01-02");
      assert.equal(data[1].count, 1);
    });

    it("filters by workspace", () => {
      const sidA = upsertSession(makeSession({ external_id: "gd-a", workspace: "/a" }));
      const sidB = upsertSession(makeSession({ external_id: "gd-b", workspace: "/b" }));
      insertMessage(sidA, makeMsg({ timestamp: 100 }));
      upsertQualityScore(makeScoreInput({ messageId: getLastMessageId(), sessionId: sidA, score: 80 }));
      insertMessage(sidB, makeMsg({ timestamp: 200 }));
      upsertQualityScore(makeScoreInput({ messageId: getLastMessageId(), sessionId: sidB, score: 60 }));

      const dataA = getGrowthData({ workspace: "/a" });
      assert.equal(dataA.length, 1);
    });
  });
});
