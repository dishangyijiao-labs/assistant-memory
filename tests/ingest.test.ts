import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb } from "./helpers.js";
import { getDb, closeDb } from "../src/storage/db-core.js";
import { getStats } from "../src/storage/queries/sessions.js";
import { listMessages } from "../src/storage/queries/messages.js";

// We cannot easily call runIngest() without real file system sources.
// Instead, we test the core transaction logic by replicating what runIngest does:
// collect → begin → upsert+insert → commit/rollback.
import { upsertSession } from "../src/storage/queries/sessions.js";
import { insertMessage, clearSessionMessages } from "../src/storage/queries/messages.js";
import type { NormalizedSession, NormalizedMessage } from "../src/storage/types.js";
import type { SourceResult, IngestResult } from "../src/ingest/index.js";

interface RawSession {
  source: "cursor" | "copilot" | "claude-code" | "codex" | "gemini" | "cursor-cli";
  workspace: string;
  external_id: string;
  started_at: number;
  last_at: number;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string; timestamp: number; external_id?: string }>;
}

/** Replicate runIngest transaction logic for testing */
function ingestSessions(rawSessions: RawSession[]): IngestResult {
  const database = getDb();
  const sourceResults: SourceResult[] = [];

  database.exec("BEGIN");
  try {
    for (const raw of rawSessions) {
      const session: NormalizedSession = {
        source: raw.source,
        workspace: raw.workspace,
        external_id: raw.external_id,
        started_at: raw.started_at,
        last_at: raw.last_at,
        message_count: raw.messages.length,
      };
      const sessionId = upsertSession(session);
      clearSessionMessages(sessionId);
      for (const m of raw.messages) {
        const msg: NormalizedMessage = {
          session_external: raw.external_id,
          source: raw.source,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          external_id: m.external_id,
        };
        insertMessage(sessionId, msg);
      }
    }
    database.exec("COMMIT");
  } catch (e) {
    database.exec("ROLLBACK");
    throw e;
  }

  const stats = getStats();
  return { ...stats, sourceResults };
}

/** collectSource logic from ingest/index.ts */
function collectSource(
  name: string,
  fn: () => RawSession[],
  all: RawSession[],
  results: SourceResult[]
): void {
  try {
    const sessions = fn();
    all.push(...sessions);
    results.push({ source: name, sessions: sessions.length });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    results.push({ source: name, sessions: 0, error });
  }
}

describe("ingest transaction logic", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  it("commits multiple sessions and messages in a transaction", () => {
    const rawSessions: RawSession[] = [
      {
        source: "cursor",
        workspace: "/ws1",
        external_id: "s1",
        started_at: 100,
        last_at: 200,
        messages: [
          { role: "user", content: "hello", timestamp: 100 },
          { role: "assistant", content: "hi", timestamp: 101 },
        ],
      },
      {
        source: "copilot",
        workspace: "/ws2",
        external_id: "s2",
        started_at: 200,
        last_at: 300,
        messages: [{ role: "user", content: "world", timestamp: 200 }],
      },
    ];

    const result = ingestSessions(rawSessions);
    assert.equal(result.sessions, 2);
    assert.equal(result.messages, 3);
  });

  it("rolls back on error during message insertion", () => {
    // First, insert a valid session so we have data before the failing ingest
    const initialRaw: RawSession[] = [
      {
        source: "cursor",
        workspace: "/initial",
        external_id: "pre-existing",
        started_at: 50,
        last_at: 60,
        messages: [{ role: "user", content: "initial", timestamp: 50 }],
      },
    ];
    ingestSessions(initialRaw);
    const statsBefore = getStats();
    assert.equal(statsBefore.sessions, 1);
    assert.equal(statsBefore.messages, 1);

    // Now attempt an ingest that will fail mid-transaction.
    // We simulate failure by making the transaction throw after some work.
    const db = getDb();
    db.exec("BEGIN");
    try {
      // Insert one session successfully
      const sid = upsertSession({
        source: "cursor",
        workspace: "/fail",
        external_id: "will-rollback",
        started_at: 100,
        last_at: 200,
        message_count: 1,
      });
      insertMessage(sid, {
        session_external: "will-rollback",
        source: "cursor",
        role: "user",
        content: "should be rolled back",
        timestamp: 100,
      });

      // Simulate an error
      throw new Error("simulated insertion failure");
    } catch {
      db.exec("ROLLBACK");
    }

    // Verify original data is untouched
    const statsAfter = getStats();
    assert.equal(statsAfter.sessions, 1);
    assert.equal(statsAfter.messages, 1);
  });

  it("re-ingesting a session replaces its messages", () => {
    const raw1: RawSession[] = [
      {
        source: "cursor",
        workspace: "/ws",
        external_id: "replace-test",
        started_at: 100,
        last_at: 200,
        messages: [
          { role: "user", content: "old message 1", timestamp: 100 },
          { role: "assistant", content: "old message 2", timestamp: 101 },
        ],
      },
    ];
    ingestSessions(raw1);
    assert.equal(getStats().messages, 2);

    // Re-ingest same session with different messages
    const raw2: RawSession[] = [
      {
        source: "cursor",
        workspace: "/ws",
        external_id: "replace-test",
        started_at: 100,
        last_at: 300,
        messages: [
          { role: "user", content: "new message only", timestamp: 200 },
        ],
      },
    ];
    ingestSessions(raw2);
    assert.equal(getStats().messages, 1);
    const msgs = listMessages(10);
    assert.equal(msgs.length, 1);
    assert.ok(msgs[0].snippet.includes("new message only"));
  });
});

describe("collectSource error handling", () => {
  it("captures source errors without stopping aggregation", () => {
    const all: RawSession[] = [];
    const results: SourceResult[] = [];

    collectSource("good-source", () => [
      { source: "cursor", workspace: "/w", external_id: "g1", started_at: 1, last_at: 2, messages: [] },
    ], all, results);

    collectSource("bad-source", () => {
      throw new Error("disk read failed");
    }, all, results);

    collectSource("another-good", () => [
      { source: "copilot", workspace: "/w", external_id: "g2", started_at: 1, last_at: 2, messages: [] },
    ], all, results);

    assert.equal(all.length, 2, "good sources should still contribute");
    assert.equal(results.length, 3);
    assert.equal(results[0].sessions, 1);
    assert.equal(results[1].sessions, 0);
    assert.equal(results[1].error, "disk read failed");
    assert.equal(results[2].sessions, 1);
  });

  it("handles non-Error throws", () => {
    const all: RawSession[] = [];
    const results: SourceResult[] = [];

    collectSource("string-throw", () => {
      throw "string error"; // eslint-disable-line no-throw-literal
    }, all, results);

    assert.equal(results[0].error, "string error");
  });
});
