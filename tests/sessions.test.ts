import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg } from "./helpers.js";
import {
  upsertSession,
  getSessionIdByExternal,
  listSessions,
  countSessions,
  listSessionsAdvanced,
  countSessionsAdvanced,
  getStats,
  getSessionDetail,
  listWorkspaces,
  getMostRecentWorkspace,
} from "../src/storage/queries/sessions.js";
import { insertMessage } from "../src/storage/queries/messages.js";

describe("sessions queries", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("upsertSession", () => {
    it("inserts a new session and returns its id", () => {
      const id = upsertSession(makeSession({ external_id: "ext-1" }));
      assert.ok(typeof id === "number" && id > 0);
    });

    it("returns the same id on upsert with same source+external_id", () => {
      const s = makeSession({ external_id: "ext-dup" });
      const id1 = upsertSession(s);
      const id2 = upsertSession({ ...s, last_at: 9999 });
      assert.equal(id1, id2);
    });

    it("updates workspace and last_at on upsert", () => {
      const s = makeSession({ external_id: "ext-update", workspace: "old", last_at: 100 });
      const id = upsertSession(s);
      upsertSession({ ...s, workspace: "new", last_at: 200 });
      const detail = getSessionDetail(id);
      assert.ok(detail);
      assert.equal(detail.session.workspace, "new");
    });
  });

  describe("getSessionIdByExternal", () => {
    it("returns null for nonexistent session", () => {
      assert.equal(getSessionIdByExternal("cursor", "no-such-id"), null);
    });

    it("returns the id for an existing session", () => {
      const id = upsertSession(makeSession({ source: "cursor", external_id: "ext-find" }));
      assert.equal(getSessionIdByExternal("cursor", "ext-find"), id);
    });
  });

  describe("listSessions", () => {
    it("returns empty array when no sessions", () => {
      assert.deepEqual(listSessions(), []);
    });

    it("lists sessions ordered by last_at desc", () => {
      upsertSession(makeSession({ external_id: "a", last_at: 100 }));
      upsertSession(makeSession({ external_id: "b", last_at: 200 }));
      const list = listSessions();
      assert.equal(list.length, 2);
      assert.ok(list[0].last_at >= list[1].last_at);
    });

    it("filters by source", () => {
      upsertSession(makeSession({ source: "cursor", external_id: "c1" }));
      upsertSession(makeSession({ source: "copilot", external_id: "c2" }));
      const list = listSessions({ source: "copilot" });
      assert.equal(list.length, 1);
      assert.equal(list[0].source, "copilot");
    });

    it("respects limit and offset", () => {
      for (let i = 0; i < 5; i++) {
        upsertSession(makeSession({ external_id: `s-${i}`, last_at: i * 100 }));
      }
      const page1 = listSessions({ limit: 2, offset: 0 });
      assert.equal(page1.length, 2);
      const page2 = listSessions({ limit: 2, offset: 2 });
      assert.equal(page2.length, 2);
      assert.notEqual(page1[0].id, page2[0].id);
    });

    it("filters by query (workspace LIKE)", () => {
      upsertSession(makeSession({ external_id: "q1", workspace: "/my/project" }));
      upsertSession(makeSession({ external_id: "q2", workspace: "/other/path" }));
      const list = listSessions({ query: "project" });
      assert.equal(list.length, 1);
      assert.ok(list[0].workspace.includes("project"));
    });
  });

  describe("countSessions", () => {
    it("returns 0 for empty DB", () => {
      assert.equal(countSessions(), 0);
    });

    it("counts all sessions", () => {
      upsertSession(makeSession({ external_id: "c-1" }));
      upsertSession(makeSession({ external_id: "c-2" }));
      assert.equal(countSessions(), 2);
    });

    it("counts with source filter", () => {
      upsertSession(makeSession({ source: "cursor", external_id: "cc-1" }));
      upsertSession(makeSession({ source: "copilot", external_id: "cc-2" }));
      assert.equal(countSessions({ source: "cursor" }), 1);
    });
  });

  describe("listSessionsAdvanced", () => {
    it("filters by workspace exact match", () => {
      upsertSession(makeSession({ external_id: "adv-1", workspace: "/exact/path" }));
      upsertSession(makeSession({ external_id: "adv-2", workspace: "/other" }));
      const list = listSessionsAdvanced({ workspace: "/exact/path" });
      assert.equal(list.length, 1);
      assert.equal(list[0].workspace, "/exact/path");
    });

    it("filters by time range", () => {
      upsertSession(makeSession({ external_id: "t-1", last_at: 100 }));
      upsertSession(makeSession({ external_id: "t-2", last_at: 200 }));
      upsertSession(makeSession({ external_id: "t-3", last_at: 300 }));
      const list = listSessionsAdvanced({ timeFrom: 150, timeTo: 250 });
      assert.equal(list.length, 1);
      assert.equal(list[0].last_at, 200);
    });

    it("combines multiple filters", () => {
      upsertSession(makeSession({ source: "cursor", external_id: "m-1", workspace: "/ws", last_at: 100 }));
      upsertSession(makeSession({ source: "cursor", external_id: "m-2", workspace: "/ws", last_at: 200 }));
      upsertSession(makeSession({ source: "copilot", external_id: "m-3", workspace: "/ws", last_at: 150 }));
      const list = listSessionsAdvanced({ source: "cursor", workspace: "/ws", timeFrom: 50, timeTo: 150 });
      assert.equal(list.length, 1);
    });
  });

  describe("countSessionsAdvanced", () => {
    it("counts with advanced filters", () => {
      upsertSession(makeSession({ external_id: "ca-1", workspace: "/a", last_at: 100 }));
      upsertSession(makeSession({ external_id: "ca-2", workspace: "/a", last_at: 200 }));
      upsertSession(makeSession({ external_id: "ca-3", workspace: "/b", last_at: 150 }));
      assert.equal(countSessionsAdvanced({ workspace: "/a" }), 2);
      assert.equal(countSessionsAdvanced({ timeFrom: 120 }), 2);
    });
  });

  describe("getStats", () => {
    it("returns zero counts for empty DB", () => {
      const stats = getStats();
      assert.equal(stats.sessions, 0);
      assert.equal(stats.messages, 0);
    });

    it("returns correct counts", () => {
      const sid = upsertSession(makeSession({ external_id: "stats-1" }));
      insertMessage(sid, makeMsg({ content: "m1", timestamp: 100 }));
      insertMessage(sid, makeMsg({ content: "m2", timestamp: 200 }));
      const stats = getStats();
      assert.equal(stats.sessions, 1);
      assert.equal(stats.messages, 2);
    });
  });

  describe("getSessionDetail", () => {
    it("returns null for nonexistent session", () => {
      assert.equal(getSessionDetail(9999), null);
    });

    it("returns session with messages", () => {
      const sid = upsertSession(makeSession({ external_id: "detail-1" }));
      insertMessage(sid, makeMsg({ content: "hello", timestamp: 100 }));
      insertMessage(sid, makeMsg({ content: "world", timestamp: 200, role: "assistant" }));
      const detail = getSessionDetail(sid);
      assert.ok(detail);
      assert.equal(detail.messages.length, 2);
      assert.equal(detail.messages[0].content, "hello"); // asc order
    });

    it("supports desc order", () => {
      const sid = upsertSession(makeSession({ external_id: "detail-desc" }));
      insertMessage(sid, makeMsg({ content: "first", timestamp: 100 }));
      insertMessage(sid, makeMsg({ content: "second", timestamp: 200 }));
      const detail = getSessionDetail(sid, 2000, 0, "desc");
      assert.ok(detail);
      assert.equal(detail.messages[0].content, "second");
    });

    it("supports limit and offset on messages", () => {
      const sid = upsertSession(makeSession({ external_id: "detail-page" }));
      for (let i = 0; i < 5; i++) {
        insertMessage(sid, makeMsg({ content: `msg-${i}`, timestamp: i * 100 }));
      }
      const detail = getSessionDetail(sid, 2, 1);
      assert.ok(detail);
      assert.equal(detail.messages.length, 2);
      assert.equal(detail.messages[0].content, "msg-1");
    });
  });

  describe("listWorkspaces", () => {
    it("returns empty for no sessions", () => {
      assert.deepEqual(listWorkspaces(), []);
    });

    it("groups by workspace", () => {
      upsertSession(makeSession({ external_id: "w-1", workspace: "/ws-a" }));
      upsertSession(makeSession({ external_id: "w-2", workspace: "/ws-a" }));
      upsertSession(makeSession({ external_id: "w-3", workspace: "/ws-b" }));
      const ws = listWorkspaces();
      assert.equal(ws.length, 2);
      const wsA = ws.find((w) => w.name === "/ws-a");
      assert.ok(wsA);
      assert.equal(wsA.session_count, 2);
    });
  });

  describe("getMostRecentWorkspace", () => {
    it("returns null for empty DB", () => {
      assert.equal(getMostRecentWorkspace(), null);
    });

    it("returns the workspace with highest last_at", () => {
      upsertSession(makeSession({ external_id: "r-1", workspace: "/old", last_at: 100 }));
      upsertSession(makeSession({ external_id: "r-2", workspace: "/new", last_at: 200 }));
      assert.equal(getMostRecentWorkspace(), "/new");
    });
  });
});
