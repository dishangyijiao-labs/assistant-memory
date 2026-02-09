import type { Source } from "../storage/db.js";

export const SOURCE_LABELS: Record<string, string> = {
  cursor: "Cursor IDE",
  copilot: "Copilot (VS Code)",
  "cursor-cli": "Cursor CLI",
  "claude-code": "Claude Code",
  codex: "Codex",
  gemini: "Gemini",
};

export const SOURCE_DESCRIPTIONS: Record<Source, string> = {
  cursor: "Local SQLite database from Cursor editor sessions.",
  copilot: "Copilot Chat conversation logs from VS Code / JetBrains.",
  "cursor-cli": "Terminal-based Cursor CLI session history.",
  "claude-code": "Anthropic Claude Code project session files.",
  codex: "OpenAI Codex CLI local session files.",
  gemini: "Google Gemini exported conversation files.",
};

export function parseSourceKey(raw: string): Source | null {
  if (!Object.prototype.hasOwnProperty.call(SOURCE_LABELS, raw)) return null;
  return raw as Source;
}
