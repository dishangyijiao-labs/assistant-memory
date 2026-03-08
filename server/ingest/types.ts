import type { Source } from "../storage/db.js";

export type IngestSource = Source;

export interface RawSession {
  source: IngestSource;
  workspace: string;
  external_id: string;
  started_at: number;
  last_at: number;
  messages: RawMessage[];
}

export interface RawMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  external_id?: string;
}
