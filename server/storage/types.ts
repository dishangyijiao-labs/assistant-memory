export const SOURCES = ["cursor", "cursor-cli", "copilot", "claude-code", "codex", "gemini"] as const;
export type Source = (typeof SOURCES)[number];

export interface SessionRow {
  id: number;
  source: string;
  workspace: string;
  external_id: string;
  started_at: number;
  last_at: number;
  message_count: number;
  created_at: number;
}

export interface MessageRow {
  id: number;
  session_id: number;
  role: string;
  content: string;
  timestamp: number;
  external_id: string | null;
  created_at: number;
}

export interface NormalizedSession {
  source: Source;
  workspace: string;
  external_id: string;
  started_at: number;
  last_at: number;
  message_count: number;
}

export interface NormalizedMessage {
  session_external: string;
  source: Source;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  external_id?: string;
}
