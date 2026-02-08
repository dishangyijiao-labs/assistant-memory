-- Assistant Memory: Cursor IDE, Copilot (VS Code), Cursor/Claude Code/Codex/Gemini CLI
-- Single SQLite DB + FTS5 for keyword search

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  workspace TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_source ON sessions(source);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace);
CREATE INDEX IF NOT EXISTS idx_sessions_last_at ON sessions(last_at);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  external_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_session_timestamp ON messages(session_id, timestamp);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content=messages,
  content_rowid=id
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;
CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TABLE IF NOT EXISTS insight_reports (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  workspace TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  model_mode TEXT NOT NULL,
  provider TEXT,
  model_name TEXT,
  summary_md TEXT NOT NULL,
  patterns_json TEXT NOT NULL,
  feedback_json TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  session_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  snippet_count INTEGER NOT NULL DEFAULT 0,
  sources_json TEXT NOT NULL DEFAULT '[]',
  score_efficiency INTEGER NOT NULL,
  score_stability INTEGER NOT NULL,
  score_decision_clarity INTEGER NOT NULL,
  score_reasons_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_insight_reports_workspace_created_at
  ON insight_reports(workspace, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insight_reports_created_at
  ON insight_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS insight_evidence (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL,
  claim_type TEXT NOT NULL,
  claim_text TEXT NOT NULL,
  session_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (report_id) REFERENCES insight_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_insight_evidence_report_id ON insight_evidence(report_id);
CREATE INDEX IF NOT EXISTS idx_insight_evidence_message_id ON insight_evidence(message_id);

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

CREATE INDEX IF NOT EXISTS idx_insight_report_sessions_report_id ON insight_report_sessions(report_id);
CREATE INDEX IF NOT EXISTS idx_insight_report_sessions_session_id ON insight_report_sessions(session_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_last_at ON sessions(workspace, last_at DESC);
