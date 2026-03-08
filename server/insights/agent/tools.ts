import * as db from "../../storage/db.js";
import type { Source } from "../../storage/types.js";

const VALID_SOURCES: Source[] = ["cursor", "cursor-cli", "copilot", "claude-code", "codex", "gemini"];

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_sessions",
      description: "Search sessions by keyword, workspace, source, or time range.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword to search in session content" },
          workspace: { type: "string", description: "Filter by workspace name" },
          source: { type: "string", enum: ["cursor", "copilot", "cursor-cli", "claude-code", "codex", "gemini"], description: "Filter by AI tool source" },
          limit: { type: "number", description: "Max sessions to return (default 20)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_session_detail",
      description: "Get full messages of a session by ID.",
      parameters: {
        type: "object",
        properties: {
          session_id: { type: "number", description: "Session ID" },
        },
        required: ["session_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "retrieve_similar_questions",
      description: "Retrieve similar high-quality user questions from history (RAG).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The question or topic to find similar ones" },
          min_score: { type: "number", description: "Minimum quality score (default 80)" },
          limit: { type: "number", description: "Max examples (default 5)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_quality_kpi",
      description: "Get quality KPI for a set of sessions.",
      parameters: {
        type: "object",
        properties: {
          session_ids: { type: "array", items: { type: "number" }, description: "Session IDs" },
        },
      },
    },
  },
];

export function executeTool(name: string, args: Record<string, unknown>): string {
  try {
    switch (name) {
      case "search_sessions": {
        const q = (args.query as string) ?? "";
        const workspace = (args.workspace as string) ?? "";
        const source = (args.source as string) ?? undefined;
        const limit = Math.min(50, Math.max(1, Number(args.limit) ?? 20));
        const sessions = db.listSessionsAdvanced({
          query: q.trim() || undefined,
          workspace: workspace.trim() || undefined,
          source: source && VALID_SOURCES.includes(source as Source) ? (source as Source) : undefined,
          limit,
        });
        return JSON.stringify({
          count: sessions.length,
          sessions: sessions.map((s) => ({ id: s.id, source: s.source, workspace: s.workspace, last_at: s.last_at, preview: s.preview })),
        });
      }
      case "get_session_detail": {
        const sessionId = Number(args.session_id);
        if (!sessionId || !Number.isFinite(sessionId)) return JSON.stringify({ error: "Invalid session_id" });
        const detail = db.getSessionDetail(sessionId, 500, 0, "asc");
        if (!detail) return JSON.stringify({ error: "Session not found" });
        return JSON.stringify({
          session: detail.session,
          message_count: detail.messages.length,
          messages: detail.messages.map((m) => ({ role: m.role, content: m.content.slice(0, 500) })),
        });
      }
      case "retrieve_similar_questions": {
        const query = (args.query as string) ?? "";
        const minScore = Number(args.min_score) ?? 80;
        const limit = Math.min(20, Math.max(1, Number(args.limit) ?? 5));
        const similar = db.retrieveSimilarUserQuestions({ query, limit, minScore: minScore > 0 ? minScore : 0 });
        return JSON.stringify({
          count: similar.length,
          examples: similar.map((s) => ({ content: s.content, score: s.score, grade: s.grade })),
        });
      }
      case "get_quality_kpi": {
        const ids = Array.isArray(args.session_ids)
          ? (args.session_ids as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n > 0)
          : [];
        const kpi = db.getQualityKpiForScope({ sessionIds: ids.length > 0 ? ids : undefined });
        return JSON.stringify(kpi);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : "Tool execution failed" });
  }
}
