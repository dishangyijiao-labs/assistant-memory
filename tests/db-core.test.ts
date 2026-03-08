import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb } from "./helpers.js";
import { getDb, getDbPath, closeDb } from "../src/storage/db-core.js";

describe("getDbPath", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    closeDb();
    delete process.env.ASSISTMEM_DB_PATH;
    delete process.env.ASSISTANT_MEMORY_DB_PATH;
    // Restore original env
    if (originalEnv.ASSISTMEM_DB_PATH) process.env.ASSISTMEM_DB_PATH = originalEnv.ASSISTMEM_DB_PATH;
    if (originalEnv.ASSISTANT_MEMORY_DB_PATH) process.env.ASSISTANT_MEMORY_DB_PATH = originalEnv.ASSISTANT_MEMORY_DB_PATH;
  });

  it("uses ASSISTMEM_DB_PATH env var when set", () => {
    process.env.ASSISTMEM_DB_PATH = "/tmp/test-custom.db";
    assert.equal(getDbPath(), "/tmp/test-custom.db");
  });

  it("uses ASSISTANT_MEMORY_DB_PATH as fallback", () => {
    delete process.env.ASSISTMEM_DB_PATH;
    process.env.ASSISTANT_MEMORY_DB_PATH = "/tmp/test-legacy.db";
    assert.equal(getDbPath(), "/tmp/test-legacy.db");
  });

  it("ASSISTMEM_DB_PATH takes priority over ASSISTANT_MEMORY_DB_PATH", () => {
    process.env.ASSISTMEM_DB_PATH = "/tmp/primary.db";
    process.env.ASSISTANT_MEMORY_DB_PATH = "/tmp/fallback.db";
    assert.equal(getDbPath(), "/tmp/primary.db");
  });
});

describe("getDb / closeDb", () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  it("creates and initializes a new database", () => {
    ({ cleanup } = useTempDb());
    const db = getDb();
    // Verify sessions table exists
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sessions','messages')")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name).sort();
    assert.deepEqual(tableNames, ["messages", "sessions"]);
  });

  it("returns the same instance on repeated calls", () => {
    ({ cleanup } = useTempDb());
    const db1 = getDb();
    const db2 = getDb();
    assert.equal(db1, db2);
  });

  it("creates a fresh instance after closeDb", () => {
    ({ cleanup } = useTempDb());
    const db1 = getDb();
    closeDb();
    const db2 = getDb();
    assert.notEqual(db1, db2);
  });

  it("sets WAL journal mode", () => {
    ({ cleanup } = useTempDb());
    const db = getDb();
    const row = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    assert.equal(row.journal_mode, "wal");
  });

  it("creates FTS virtual table", () => {
    ({ cleanup } = useTempDb());
    const db = getDb();
    const fts = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages_fts'")
      .get() as { name: string } | undefined;
    assert.ok(fts, "messages_fts virtual table should exist");
  });
});
