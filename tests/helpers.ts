import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { closeDb, getDb } from "../server/storage/db-core.js";
import type { NormalizedSession, NormalizedMessage } from "../server/storage/types.js";
import type { QualityScoreInput } from "../server/storage/queries/quality.js";

/**
 * Create a temporary DB path and set env var so db-core uses it.
 * Returns a cleanup function that closes the DB and removes the temp dir.
 */
export function useTempDb(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "assistmem-test-"));
  const dbPath = join(dir, "test.db");
  process.env.ASSISTMEM_DB_PATH = dbPath;
  // Force db-core to re-create the singleton on next getDb() call
  closeDb();
  return {
    dbPath,
    cleanup() {
      closeDb();
      delete process.env.ASSISTMEM_DB_PATH;
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    },
  };
}

export function makeSession(overrides: Partial<NormalizedSession> = {}): NormalizedSession {
  return {
    source: "cursor",
    workspace: "/ws",
    external_id: `s-${Date.now()}-${Math.random()}`,
    started_at: 1000,
    last_at: 2000,
    message_count: 0,
    ...overrides,
  };
}

export function makeMsg(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    session_external: "test",
    source: "cursor",
    role: "user",
    content: "test",
    timestamp: Date.now(),
    ...overrides,
  };
}

export function makeScoreInput(overrides: Partial<QualityScoreInput> = {}): QualityScoreInput {
  return {
    messageId: 1,
    sessionId: 1,
    score: 85,
    grade: "B+",
    deductionsJson: "[]",
    missingInfoChecklistJson: "[]",
    rewritesJson: "{}",
    tagsJson: "[]",
    ...overrides,
  };
}

export function getLastMessageId(): number {
  return (getDb().prepare("SELECT MAX(id) AS id FROM messages").get() as { id: number }).id;
}
