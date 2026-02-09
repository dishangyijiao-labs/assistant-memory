import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { homedir, platform } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getLegacyDbPath(): string {
  const home = homedir();
  if (platform() === "win32") {
    return join(home, "AppData", "Local", "assistant-memory", "assistant-memory.db");
  }
  return join(home, ".assistant-memory.db");
}

function getDefaultDbPath(): string {
  const home = homedir();
  const legacy = getLegacyDbPath();
  if (existsSync(legacy)) return legacy;
  if (platform() === "win32") {
    return join(home, "AppData", "Local", "assistmem", "assistmem.db");
  }
  return join(home, ".assistmem.db");
}

export function getDbPath(): string {
  return process.env.ASSISTMEM_DB_PATH || process.env.ASSISTANT_MEMORY_DB_PATH || getDefaultDbPath();
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const path = getDbPath();
    const dir = dirname(path);
    if (dir && !existsSync(dir) && path !== join(homedir(), ".assistmem.db") && path !== getLegacyDbPath()) {
      mkdirSync(dir, { recursive: true });
    }
    db = new Database(path);
    db.pragma("journal_mode = WAL");
    const schemaPath = join(__dirname, "schema.sql");
    const schema = readFileSync(schemaPath, "utf-8");
    db.exec(schema);
    // Migrations for existing databases.
    const insightReportColumnMigrations = [
      "ALTER TABLE insight_reports ADD COLUMN score_reasons_json TEXT NOT NULL DEFAULT '[]'",
      "ALTER TABLE insight_reports ADD COLUMN title TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE insight_reports ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}'",
      "ALTER TABLE insight_reports ADD COLUMN session_count INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE insight_reports ADD COLUMN message_count INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE insight_reports ADD COLUMN snippet_count INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE insight_reports ADD COLUMN sources_json TEXT NOT NULL DEFAULT '[]'",
    ];
    for (const sql of insightReportColumnMigrations) {
      try {
        db.exec(sql);
      } catch {
        // Column already exists — ignore.
      }
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS insight_report_sessions (
        id INTEGER PRIMARY KEY,
        report_id INTEGER NOT NULL,
        session_id INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        UNIQUE(report_id, session_id),
        FOREIGN KEY (report_id) REFERENCES insight_reports(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_insight_report_sessions_report_id ON insight_report_sessions(report_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_insight_report_sessions_session_id ON insight_report_sessions(session_id)");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
