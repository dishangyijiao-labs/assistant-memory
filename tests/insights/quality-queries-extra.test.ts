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

describe("quality queries – extended coverage", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("getQualityKpiForScope – repeated_question_ratio", () => {
    it("detects repeated questions by normalized content", () => {
      const sid = upsertSession(makeSession());

      // Insert 3 user messages: 2 are essentially the same
      insertMessage(sid, makeMsg({ content: "How do I fix the bug in auth module?", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "how do i fix the bug in auth module?", timestamp: 200 }));
      const id2 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "Something completely different question here", timestamp: 300 }));
      const id3 = getLastMessageId();

      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 70 }));
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid, score: 65 }));
      upsertQualityScore(makeScoreInput({ messageId: id3, sessionId: sid, score: 90 }));

      const kpi = getQualityKpiForScope({ sessionIds: [sid] });
      // 2 identical questions → 1 repeated occurrence (count - 1 = 1)
      assert.ok(kpi.repeated_question_ratio > 0, "should detect repeated questions");
      assert.ok(kpi.repeated_question_ratio < 1, "ratio should be < 1");
    });

    it("returns 0 repeated_question_ratio when all questions are unique", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "Unique question about performance tuning", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "Different question about database indexing", timestamp: 200 }));
      const id2 = getLastMessageId();

      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid }));
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid }));

      const kpi = getQualityKpiForScope({ sessionIds: [sid] });
      assert.equal(kpi.repeated_question_ratio, 0);
    });
  });

  describe("getQualityKpiForScope – avg_follow_up_rounds", () => {
    it("computes follow-up rounds across multiple sessions", () => {
      // Session 1: 3 user messages → 2 follow-up rounds
      const sid1 = upsertSession(makeSession({ external_id: "fur-1" }));
      insertMessage(sid1, makeMsg({ content: "q1", timestamp: 100 }));
      insertMessage(sid1, makeMsg({ content: "a1", timestamp: 101, role: "assistant" }));
      insertMessage(sid1, makeMsg({ content: "q2", timestamp: 200 }));
      insertMessage(sid1, makeMsg({ content: "q3", timestamp: 300 }));

      // Session 2: 1 user message → 0 follow-up rounds
      const sid2 = upsertSession(makeSession({ external_id: "fur-2" }));
      insertMessage(sid2, makeMsg({ content: "q1-only", timestamp: 100 }));

      const kpi = getQualityKpiForScope({ sessionIds: [sid1, sid2] });
      // Total user = 4, follow-ups = 2+0 = 2, avg = 2/4 = 0.5
      assert.equal(kpi.total_user_question_count, 4);
      assert.equal(kpi.avg_follow_up_rounds, 0.5);
    });
  });

  describe("getQualityKpiForScope – high_quality_ratio boundary", () => {
    it("score exactly 80 counts as high quality", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q", timestamp: 100 }));
      const id1 = getLastMessageId();
      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 80 }));

      const kpi = getQualityKpiForScope({ sessionIds: [sid] });
      assert.equal(kpi.high_quality_ratio, 1);
    });

    it("score 79 does not count as high quality", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q", timestamp: 100 }));
      const id1 = getLastMessageId();
      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 79 }));

      const kpi = getQualityKpiForScope({ sessionIds: [sid] });
      assert.equal(kpi.high_quality_ratio, 0);
    });
  });

  describe("getQualityKpiForScope – first_pass_resolution_rate", () => {
    it("is 1 when no repeated questions", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "unique question about deployment", timestamp: 100 }));
      const id1 = getLastMessageId();
      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 85 }));

      const kpi = getQualityKpiForScope({ sessionIds: [sid] });
      assert.equal(kpi.first_pass_resolution_rate, 1);
    });
  });

  describe("getTopLowQualityQuestions – extended", () => {
    it("respects limit parameter", () => {
      const sid = upsertSession(makeSession());
      for (let i = 0; i < 5; i++) {
        insertMessage(sid, makeMsg({ content: `low quality question number ${i}`, timestamp: 100 + i }));
        const id = getLastMessageId();
        upsertQualityScore(makeScoreInput({
          messageId: id,
          sessionId: sid,
          score: 30 + i * 5, // 30, 35, 40, 45, 50
          grade: "F",
          deductionsJson: `[{"reason":"reason-${i}"}]`,
          rewritesJson: `{"short":"s${i}","engineering":"e${i}","exploratory":"x${i}"}`,
        }));
      }

      const limited = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80, limit: 3 });
      assert.equal(limited.length, 3);
      // Should be sorted by score ASC (lowest first)
      assert.ok(limited[0].score <= limited[1].score);
      assert.ok(limited[1].score <= limited[2].score);
    });

    it("handles malformed deductions JSON gracefully", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "bad json question", timestamp: 100 }));
      const id1 = getLastMessageId();
      upsertQualityScore(makeScoreInput({
        messageId: id1,
        sessionId: sid,
        score: 40,
        grade: "F",
        deductionsJson: "not valid json {{",
        missingInfoChecklistJson: "also bad [][]",
        rewritesJson: "bad {}{}",
      }));

      const low = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80 });
      assert.equal(low.length, 1);
      // Should fall back to empty strings, not crash
      assert.equal(low[0].deduction_reasons, "");
      assert.equal(low[0].required_checklist_md, "(none)");
      assert.equal(low[0].rewrite_short, "");
    });

    it("filters by maxScore correctly", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 60 }));
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid, score: 75 }));

      // maxScore 70: only score < 70 qualifies
      const low70 = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 70 });
      assert.equal(low70.length, 1);
      assert.equal(low70[0].score, 60);

      // maxScore 80: both qualify
      const low80 = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80 });
      assert.equal(low80.length, 2);
    });

    it("truncates title to max 100 chars", () => {
      const sid = upsertSession(makeSession());
      const longContent = "A".repeat(200);
      insertMessage(sid, makeMsg({ content: longContent, timestamp: 100 }));
      const id = getLastMessageId();
      upsertQualityScore(makeScoreInput({
        messageId: id, sessionId: sid, score: 30, grade: "F",
        deductionsJson: "[]", rewritesJson: '{"short":"s","engineering":"e","exploratory":"x"}',
      }));

      const low = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80 });
      assert.ok(low[0].title.length <= 100);
    });

    it("returns (empty) for messages with no content", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "   ", timestamp: 100 }));
      const id = getLastMessageId();
      upsertQualityScore(makeScoreInput({
        messageId: id, sessionId: sid, score: 20, grade: "F",
        deductionsJson: "[]", rewritesJson: '{"short":"s","engineering":"e","exploratory":"x"}',
      }));

      const low = getTopLowQualityQuestions({ sessionIds: [sid], maxScore: 80 });
      assert.equal(low.length, 1);
      assert.equal(low[0].title, "(empty)");
    });

    it("uses timeFrom/timeTo to filter sessions when no sessionIds provided", () => {
      // Create two sessions with different last_at
      const sid1 = upsertSession(makeSession({ last_at: 5000, external_id: "time-a" }));
      insertMessage(sid1, makeMsg({ content: "old low quality question here", timestamp: 5000 }));
      const id1 = getLastMessageId();
      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid1, score: 40 }));

      const sid2 = upsertSession(makeSession({ last_at: 15000, external_id: "time-b" }));
      insertMessage(sid2, makeMsg({ content: "new low quality question here", timestamp: 15000 }));
      const id2 = getLastMessageId();
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid2, score: 30 }));

      // timeFrom=10000 → only sid2 matches (last_at=15000)
      const low = getTopLowQualityQuestions({ timeFrom: 10000, timeTo: 20000, maxScore: 80 });
      assert.equal(low.length, 1);
      assert.equal(low[0].score, 30); // sid2's score

      // timeFrom=1000 → both match
      const low2 = getTopLowQualityQuestions({ timeFrom: 1000, timeTo: 20000, maxScore: 80 });
      assert.equal(low2.length, 2);
    });
  });

  describe("getQualityScoresBySessionId – ordering", () => {
    it("returns scores ordered by created_at ASC", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();

      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 90 }));
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid, score: 70 }));

      const scores = getQualityScoresBySessionId(sid);
      assert.equal(scores.length, 2);
      assert.ok(scores[0].created_at <= scores[1].created_at);
    });
  });

  describe("getQualityScoresByMessageIds – non-existent IDs", () => {
    it("returns only existing scores, ignores missing IDs", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ timestamp: 100 }));
      const id1 = getLastMessageId();
      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 85 }));

      const map = getQualityScoresByMessageIds([id1, 99999, 88888]);
      assert.equal(map.size, 1);
      assert.ok(map.has(id1));
      assert.ok(!map.has(99999));
    });
  });

  describe("getGrowthData – timeFrom/timeTo filtering", () => {
    it("filters growth data by time range", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ timestamp: 100 }));
      const id1 = getLastMessageId();
      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 85 }));

      const day1 = new Date("2024-03-01T12:00:00Z").getTime();
      getDb().prepare("UPDATE message_quality_scores SET created_at = ? WHERE message_id = ?").run(day1, id1);

      // Range that includes the data
      const data1 = getGrowthData({
        timeFrom: new Date("2024-02-28T00:00:00Z").getTime(),
        timeTo: new Date("2024-03-02T00:00:00Z").getTime(),
      });
      assert.equal(data1.length, 1);

      // Range that excludes the data
      const data2 = getGrowthData({
        timeFrom: new Date("2024-04-01T00:00:00Z").getTime(),
        timeTo: new Date("2024-04-30T00:00:00Z").getTime(),
      });
      assert.equal(data2.length, 0);
    });
  });

  describe("getGrowthData – high_ratio computation", () => {
    it("computes correct high_ratio per day", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ content: "q1", timestamp: 100 }));
      const id1 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q2", timestamp: 200 }));
      const id2 = getLastMessageId();
      insertMessage(sid, makeMsg({ content: "q3", timestamp: 300 }));
      const id3 = getLastMessageId();

      upsertQualityScore(makeScoreInput({ messageId: id1, sessionId: sid, score: 90 }));
      upsertQualityScore(makeScoreInput({ messageId: id2, sessionId: sid, score: 50 }));
      upsertQualityScore(makeScoreInput({ messageId: id3, sessionId: sid, score: 85 }));

      const day = new Date("2024-05-01T12:00:00Z").getTime();
      getDb().prepare("UPDATE message_quality_scores SET created_at = ?").run(day);

      const data = getGrowthData({});
      assert.equal(data.length, 1);
      // 2/3 high quality (>= 80)
      assert.ok(Math.abs(data[0].high_ratio - 0.667) < 0.01);
      assert.equal(data[0].count, 3);
    });
  });
});
