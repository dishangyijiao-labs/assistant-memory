import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb, makeSession, makeMsg } from "../helpers.js";
import {
  upsertSession,
  listSessionsAdvanced,
  countSessionsAdvanced,
  listSessions,
} from "../../server/storage/queries/sessions.js";
import { insertMessage } from "../../server/storage/queries/messages.js";

describe("sessions advanced FTS query", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("listSessionsAdvanced with query (FTS path)", () => {
    it("finds sessions by message content via FTS", () => {
      const sid1 = upsertSession(makeSession({ external_id: "fts-1", workspace: "/proj-a" }));
      const sid2 = upsertSession(makeSession({ external_id: "fts-2", workspace: "/proj-b" }));
      insertMessage(sid1, makeMsg({ content: "configure typescript compiler options", timestamp: 100 }));
      insertMessage(sid2, makeMsg({ content: "python flask routing setup", timestamp: 200 }));

      const results = listSessionsAdvanced({ query: "typescript" });
      assert.equal(results.length, 1);
      assert.equal(results[0].workspace, "/proj-a");
    });

    it("finds sessions by workspace LIKE match", () => {
      upsertSession(makeSession({ external_id: "ws-1", workspace: "/my-typescript-project" }));
      upsertSession(makeSession({ external_id: "ws-2", workspace: "/python-project" }));

      const results = listSessionsAdvanced({ query: "typescript" });
      assert.equal(results.length, 1);
      assert.ok(results[0].workspace.includes("typescript"));
    });

    it("finds sessions by external_id LIKE match", () => {
      upsertSession(makeSession({ external_id: "session-typescript-123", workspace: "/ws" }));
      upsertSession(makeSession({ external_id: "session-python-456", workspace: "/ws" }));

      const results = listSessionsAdvanced({ query: "typescript" });
      assert.equal(results.length, 1);
    });

    it("combines FTS query with other filters", () => {
      const sid1 = upsertSession(makeSession({ source: "cursor", external_id: "combo-1", workspace: "/ws", last_at: 100 }));
      const sid2 = upsertSession(makeSession({ source: "copilot", external_id: "combo-2", workspace: "/ws", last_at: 200 }));
      insertMessage(sid1, makeMsg({ content: "debugging memory leaks", timestamp: 100 }));
      insertMessage(sid2, makeMsg({ content: "debugging memory leaks in production", timestamp: 200 }));

      // Both match "debugging" via FTS, but filter by source
      const cursorResults = listSessionsAdvanced({ query: "debugging", source: "cursor" });
      assert.equal(cursorResults.length, 1);
      assert.equal(cursorResults[0].source, "cursor");
    });

    it("countSessionsAdvanced with query", () => {
      const sid1 = upsertSession(makeSession({ external_id: "cnt-1" }));
      const sid2 = upsertSession(makeSession({ external_id: "cnt-2" }));
      insertMessage(sid1, makeMsg({ content: "react component lifecycle", timestamp: 100 }));
      insertMessage(sid2, makeMsg({ content: "vue component lifecycle", timestamp: 200 }));

      assert.equal(countSessionsAdvanced({ query: "component" }), 2);
      assert.equal(countSessionsAdvanced({ query: "react" }), 1);
    });
  });

  describe("listSessions with query (LIKE path)", () => {
    it("searches workspace and external_id via LIKE", () => {
      upsertSession(makeSession({ external_id: "like-1", workspace: "/my-react-app" }));
      upsertSession(makeSession({ external_id: "like-2", workspace: "/angular-app" }));

      // listSessions uses LIKE for query, not FTS
      const results = listSessions({ query: "react" });
      assert.equal(results.length, 1);
    });

    it("query matches external_id", () => {
      upsertSession(makeSession({ external_id: "unique-id-xyz", workspace: "/ws" }));
      upsertSession(makeSession({ external_id: "other-id-abc", workspace: "/ws" }));

      const results = listSessions({ query: "xyz" });
      assert.equal(results.length, 1);
    });
  });
});
