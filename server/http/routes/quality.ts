import type { IncomingMessage, ServerResponse } from "http";
import * as db from "../../storage/db.js";
import {
  getQueryParams,
  sendJson,
  sendError,
  readJsonBody,
  resolveModelApiKey,
} from "../utils/http.js";
import { analyzeSession } from "../../insights/quality-analyzer.js";

export async function handleAnalyze(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const sid = body.session_id;
  const sessionId =
    typeof sid === "number" ? Math.trunc(sid) : typeof sid === "string" ? parseInt(sid, 10) : null;
  if (!sessionId || sessionId < 1 || !Number.isFinite(sessionId)) {
    sendError(res, 400, "INVALID_ARGUMENT", "session_id is required and must be positive");
    return;
  }
  const session = db.getSessionDetail(sessionId, 1, 0, "asc");
  if (!session) {
    sendError(res, 404, "NOT_FOUND", "Session not found");
    return;
  }
  const settings = db.getModelSettings();
  const apiKey = resolveModelApiKey(settings);
  if (!apiKey) {
    sendError(res, 400, "QUALITY_MODEL_NOT_CONFIGURED", "API key is missing. Configure in Insights Setup.");
    return;
  }
  const baseUrl = (settings.base_url || "https://api.openai.com/v1").replace(/\/+$/, "");
  const modelName = settings.model_name || "gpt-4o-mini";
  if (!modelName) {
    sendError(res, 400, "QUALITY_MODEL_NOT_CONFIGURED", "model_name is required in Insights Setup");
    return;
  }
  const force = body.force === true;
  const result = await analyzeSession(sessionId, { baseUrl, modelName, apiKey }, { force });
  sendJson(res, 200, {
    session_id: sessionId,
    analyzed: result.analyzed,
    skipped: result.skipped,
    failed: result.failed,
  });
}

export async function handleKpi(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const params = getQueryParams(url);
  const sessionIdsParam = params.get("session_ids");
  const sessionIds = sessionIdsParam
    ? sessionIdsParam.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0)
    : undefined;
  if (!sessionIds || sessionIds.length === 0) {
    sendError(res, 400, "INVALID_ARGUMENT", "session_ids query param required (comma-separated)");
    return;
  }
  const kpi = db.getQualityKpiForScope({ sessionIds });
  sendJson(res, 200, kpi);
}

export async function handleEvalStats(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const params = getQueryParams(url);
  const sessionIdsParam = params.get("session_ids");
  const sessionIds = sessionIdsParam
    ? sessionIdsParam.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0)
    : undefined;
  const { parseOptInt } = await import("../utils/http.js");
  const timeFrom = parseOptInt(params.get("time_from"));
  const timeTo = parseOptInt(params.get("time_to"));
  const stats = db.getEvalStats({
    sessionIds: sessionIds && sessionIds.length > 0 ? sessionIds : undefined,
    timeFrom: timeFrom ?? undefined,
    timeTo: timeTo ?? undefined,
  });
  sendJson(res, 200, stats);
}
