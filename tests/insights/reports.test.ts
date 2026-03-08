import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg } from "../helpers.js";
import {
  insertInsightReport,
  insertInsightEvidence,
  insertInsightReportSessions,
  listInsightReports,
  countInsightReports,
  getInsightReportById,
  getInsightReportAggregates,
  deleteInsightReport,
  listInsightReportSessions,
  getMessagesForSessionIds,
  getMessagesForInsightScope,
  type InsightReportInput,
} from "../../server/storage/queries/insights.js";
import { upsertSession } from "../../server/storage/queries/sessions.js";
import { insertMessage } from "../../server/storage/queries/messages.js";

function makeReportInput(overrides: Partial<InsightReportInput> = {}): InsightReportInput {
  return {
    title: "Test Report",
    workspace: "/ws",
    scopeJson: '{"workspace":"/ws"}',
    modelMode: "local",
    summaryMd: "## Summary\nTest",
    patternsJson: "[]",
    feedbackJson: "[]",
    scoreEfficiency: 80,
    scoreStability: 70,
    scoreDecisionClarity: 90,
    ...overrides,
  };
}

describe("insights queries", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("insertInsightReport / getInsightReportById", () => {
    it("inserts and retrieves a report", () => {
      const id = insertInsightReport(makeReportInput());
      assert.ok(id > 0);
      const result = getInsightReportById(id);
      assert.ok(result);
      assert.equal(result.report.title, "Test Report");
      assert.equal(result.report.workspace, "/ws");
      assert.equal(result.report.score_efficiency, 80);
      assert.equal(result.report.status, "completed");
    });

    it("returns null for nonexistent report", () => {
      assert.equal(getInsightReportById(9999), null);
    });

    it("stores optional fields", () => {
      const id = insertInsightReport(makeReportInput({
        provider: "openai",
        modelName: "gpt-4",
        detailsJson: '{"key":"value"}',
        sessionCount: 10,
        messageCount: 100,
        snippetCount: 5,
        sourcesJson: '["cursor"]',
        scoreReasonsJson: '["reason1"]',
        status: "failed",
      }));
      const result = getInsightReportById(id)!;
      assert.equal(result.report.provider, "openai");
      assert.equal(result.report.model_name, "gpt-4");
      assert.equal(result.report.session_count, 10);
      assert.equal(result.report.status, "failed");
    });
  });

  describe("insertInsightEvidence", () => {
    it("inserts evidence linked to a report", () => {
      const sid = upsertSession(makeSession());
      insertMessage(sid, makeMsg({ timestamp: 100 }));
      const msgId = 1; // first message
      const reportId = insertInsightReport(makeReportInput());

      insertInsightEvidence(reportId, [
        { claimType: "pattern", claimText: "uses async/await", sessionId: sid, messageId: msgId },
        { claimType: "feedback", claimText: "good practice", sessionId: sid, messageId: msgId },
      ]);

      const result = getInsightReportById(reportId)!;
      assert.equal(result.evidence.length, 2);
      assert.equal(result.evidence[0].claim_type, "pattern");
      assert.equal(result.evidence[1].claim_type, "feedback");
    });

    it("handles empty evidence array", () => {
      const reportId = insertInsightReport(makeReportInput());
      insertInsightEvidence(reportId, []);
      const result = getInsightReportById(reportId)!;
      assert.equal(result.evidence.length, 0);
    });
  });

  describe("insertInsightReportSessions", () => {
    it("links sessions to a report", () => {
      const sid1 = upsertSession(makeSession({ external_id: "rs-1" }));
      const sid2 = upsertSession(makeSession({ external_id: "rs-2" }));
      const reportId = insertInsightReport(makeReportInput());

      insertInsightReportSessions(reportId, [
        { sessionId: sid1, messageCount: 5 },
        { sessionId: sid2, messageCount: 10 },
      ]);

      const sessions = listInsightReportSessions(reportId);
      assert.equal(sessions.length, 2);
      assert.equal(sessions[0].message_count, 5);
    });
  });

  describe("listInsightReports / countInsightReports", () => {
    it("lists reports ordered by created_at desc", () => {
      insertInsightReport(makeReportInput({ title: "First" }));
      insertInsightReport(makeReportInput({ title: "Second" }));
      const list = listInsightReports();
      assert.equal(list.length, 2);
      assert.equal(list[0].title, "Second"); // most recent first
    });

    it("filters by workspace", () => {
      insertInsightReport(makeReportInput({ workspace: "/a" }));
      insertInsightReport(makeReportInput({ workspace: "/b" }));
      const list = listInsightReports({ workspace: "/a" });
      assert.equal(list.length, 1);
      assert.equal(list[0].workspace, "/a");
    });

    it("respects limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        insertInsightReport(makeReportInput({ title: `Report ${i}` }));
      }
      const page = listInsightReports({ limit: 2, offset: 2 });
      assert.equal(page.length, 2);
    });

    it("counts reports", () => {
      insertInsightReport(makeReportInput({ workspace: "/x" }));
      insertInsightReport(makeReportInput({ workspace: "/x" }));
      insertInsightReport(makeReportInput({ workspace: "/y" }));
      assert.equal(countInsightReports(), 3);
      assert.equal(countInsightReports("/x"), 2);
    });
  });

  describe("getInsightReportAggregates", () => {
    it("returns aggregates across reports", () => {
      insertInsightReport(makeReportInput({ sessionCount: 5, messageCount: 50 }));
      insertInsightReport(makeReportInput({ sessionCount: 3, messageCount: 30 }));
      const agg = getInsightReportAggregates();
      assert.equal(agg.total_reports, 2);
      assert.equal(agg.sessions_analyzed, 8);
      assert.equal(agg.messages_analyzed, 80);
    });

    it("filters by workspace", () => {
      insertInsightReport(makeReportInput({ workspace: "/a", sessionCount: 5 }));
      insertInsightReport(makeReportInput({ workspace: "/b", sessionCount: 3 }));
      const agg = getInsightReportAggregates("/a");
      assert.equal(agg.total_reports, 1);
      assert.equal(agg.sessions_analyzed, 5);
    });
  });

  describe("deleteInsightReport", () => {
    it("deletes an existing report", () => {
      const id = insertInsightReport(makeReportInput());
      assert.equal(deleteInsightReport(id), true);
      assert.equal(getInsightReportById(id), null);
    });

    it("returns false for nonexistent report", () => {
      assert.equal(deleteInsightReport(9999), false);
    });
  });

  describe("getMessagesForSessionIds", () => {
    it("returns messages for given session ids", () => {
      const sid = upsertSession(makeSession({ external_id: "msg-scope-1" }));
      insertMessage(sid, makeMsg({ content: "hello", timestamp: 100 }));
      insertMessage(sid, makeMsg({ content: "world", timestamp: 200, role: "assistant" }));
      const msgs = getMessagesForSessionIds([sid]);
      assert.equal(msgs.length, 2);
      assert.equal(msgs[0].content, "hello");
    });

    it("returns empty for empty ids", () => {
      assert.deepEqual(getMessagesForSessionIds([]), []);
    });
  });

  describe("getMessagesForInsightScope", () => {
    it("filters by workspace", () => {
      const sid1 = upsertSession(makeSession({ external_id: "scope-1", workspace: "/a" }));
      const sid2 = upsertSession(makeSession({ external_id: "scope-2", workspace: "/b" }));
      insertMessage(sid1, makeMsg({ content: "in a", timestamp: 100 }));
      insertMessage(sid2, makeMsg({ content: "in b", timestamp: 200 }));
      const msgs = getMessagesForInsightScope({ workspace: "/a" });
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].content, "in a");
    });

    it("filters by time range", () => {
      const sid = upsertSession(makeSession({ external_id: "scope-time" }));
      insertMessage(sid, makeMsg({ content: "early", timestamp: 100 }));
      insertMessage(sid, makeMsg({ content: "mid", timestamp: 200 }));
      insertMessage(sid, makeMsg({ content: "late", timestamp: 300 }));
      const msgs = getMessagesForInsightScope({ timeFrom: 150, timeTo: 250 });
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].content, "mid");
    });

    it("filters by sources", () => {
      const sid1 = upsertSession(makeSession({ source: "cursor", external_id: "scope-s1" }));
      const sid2 = upsertSession(makeSession({ source: "copilot", external_id: "scope-s2" }));
      insertMessage(sid1, makeMsg({ content: "cursor msg", timestamp: 100 }));
      insertMessage(sid2, makeMsg({ content: "copilot msg", timestamp: 200 }));
      const msgs = getMessagesForInsightScope({ sources: ["copilot"] });
      assert.equal(msgs.length, 1);
      assert.equal(msgs[0].source, "copilot");
    });
  });
});
