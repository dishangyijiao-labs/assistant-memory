import type { IncomingMessage, ServerResponse } from "http";
import * as db from "../../storage/db.js";
import {
  getQueryParams,
  parseIntSafe,
  parseOptInt,
  sendJson,
  sendError,
  SOURCE_LABELS,
  parseJsonArray,
  parseJsonObject,
} from "../utils/http.js";

export async function handleSearch(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const params = getQueryParams(url);
  const q = (params.get("q") ?? "").trim();
  const limit = parseInt(params.get("limit") ?? "20", 10) || 20;
  const source = params.get("source") || null;
  const limitNum = Math.min(100, Math.max(1, limit || 20));
  const sourceFilter =
    source && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, source) ? (source as db.Source) : undefined;
  const results = !q ? db.listMessages(limitNum, sourceFilter) : db.searchMessages(q, limitNum, sourceFilter);
  sendJson(res, 200, { results });
}

export async function handleListSessions(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const params = getQueryParams(url);
  const source = params.get("source") || null;
  const workspace = params.get("workspace") || null;
  const limit = Math.min(500, Math.max(1, parseInt(params.get("limit") ?? "500", 10) || 100));
  const offset = Math.max(0, parseInt(params.get("offset") ?? "0", 10) || 0);
  const q = (params.get("q") ?? "").trim();
  const timeFrom = parseOptInt(params.get("time_from"));
  const timeTo = parseOptInt(params.get("time_to"));
  const sourceFilter =
    source && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, source) ? (source as db.Source) : undefined;
  const workspaceFilter = (workspace ?? "").trim() || undefined;
  const sessions = db.listSessionsAdvanced({
    source: sourceFilter,
    workspace: workspaceFilter,
    limit,
    offset,
    query: q,
    timeFrom: typeof timeFrom === "number" ? timeFrom : undefined,
    timeTo: typeof timeTo === "number" ? timeTo : undefined,
  });
  const total = db.countSessionsAdvanced({
    source: sourceFilter,
    workspace: workspaceFilter,
    query: q,
    timeFrom: typeof timeFrom === "number" ? timeFrom : undefined,
    timeTo: typeof timeTo === "number" ? timeTo : undefined,
  });
  sendJson(res, 200, { sessions, sourceLabels: SOURCE_LABELS, total });
}

export async function handleGetSession(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const params = getQueryParams(url);
  const sessionId = parseInt(params.get("session_id") ?? "0", 10);
  if (!sessionId) {
    sendError(res, 400, "INVALID_ARGUMENT", "Missing session_id");
    return;
  }
  const limit = parseIntSafe(params.get("limit"), 2000);
  const offset = parseIntSafe(params.get("offset"), 0);
  const order = params.get("order") === "desc" ? "desc" : "asc";
  const data = db.getSessionDetail(sessionId, limit, offset, order);
  if (!data) {
    sendError(res, 404, "NOT_FOUND", "Session not found");
    return;
  }
  const userMessageIds = data.messages.filter((m) => m.role === "user").map((m) => m.id);
  const qualityMap = db.getQualityScoresByMessageIds(userMessageIds);
  const quality_scores: Record<number, Record<string, unknown>> = {};
  for (const [msgId, row] of qualityMap) {
    quality_scores[msgId] = {
      score: row.score,
      grade: row.grade,
      deductions: parseJsonArray(row.deductions_json),
      missing_info_checklist: parseJsonArray(row.missing_info_checklist_json),
      rewrites: parseJsonObject(row.rewrites_json),
      tags: parseJsonArray(row.tags_json),
    };
  }
  sendJson(res, 200, { ...data, quality_scores });
}

export async function handleWorkspaces(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const params = getQueryParams(url);
  const limit = parseIntSafe(params.get("limit"), 200);
  const workspaces = db.listWorkspaces(limit);
  sendJson(res, 200, { workspaces });
}

export async function handleStats(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const stats = db.getStats();
  const dbPath = db.getDbPath();
  sendJson(res, 200, { sessions: stats.sessions, messages: stats.messages, dbPath });
}

export async function handleGrowth(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const q = getQueryParams(url);
  const range = q.get("range") ?? "30d";
  const workspace = q.get("workspace")?.trim() || undefined;
  const now = Date.now();
  let timeFrom: number | undefined;
  if (range === "7d") timeFrom = now - 7 * 24 * 60 * 60 * 1000;
  else if (range === "30d") timeFrom = now - 30 * 24 * 60 * 60 * 1000;
  else if (range === "90d") timeFrom = now - 90 * 24 * 60 * 60 * 1000;
  const data = db.getGrowthData({ timeFrom, workspace });
  sendJson(res, 200, { data });
}
