import type { IncomingMessage, ServerResponse } from "http";
import * as db from "../../storage/db.js";
import {
  getQueryParams,
  parseIntSafe,
  sendJson,
  sendError,
  readJsonBody,
  parseJsonObject,
  parseJsonStringArray,
} from "../utils/http.js";
import {
  DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE,
  QUALITY_ANALYZER_OUTPUT_SCHEMA,
  QUALITY_ANALYZER_SYSTEM_PROMPT,
  QUALITY_METRIC_DEFINITIONS,
} from "../../insights/quality-kit.js";
import { generateInsightReport, ServiceError } from "../services/insights.js";

export async function handleGenerate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const scopeRaw =
    body.scope && typeof body.scope === "object" && !Array.isArray(body.scope)
      ? (body.scope as Record<string, unknown>)
      : {};
  const modelRaw =
    body.model && typeof body.model === "object" && !Array.isArray(body.model)
      ? (body.model as Record<string, unknown>)
      : {};
  const sessionIds = Array.isArray(body.session_ids)
    ? body.session_ids
        .map((id) => (typeof id === "number" ? Math.trunc(id) : Number.NaN))
        .filter((id) => Number.isFinite(id) && id > 0)
    : [];

  try {
    const result = await generateInsightReport({ sessionIds, scope: scopeRaw, model: modelRaw });
    sendJson(res, 200, result);
  } catch (err) {
    if (err instanceof ServiceError) {
      sendError(res, err.statusCode, err.code, err.message);
    } else {
      throw err;
    }
  }
}

export async function handleList(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const params = getQueryParams(url);
  const workspace = (params.get("workspace") ?? "").trim() || undefined;
  const limit = parseIntSafe(params.get("limit"), 20);
  const offset = parseIntSafe(params.get("offset"), 0);
  const rows = db.listInsightReports({ workspace, limit, offset });
  const total = db.countInsightReports(workspace);
  const summary = db.getInsightReportAggregates(workspace);
  const reports = rows.map((r) => formatReport(r));
  sendJson(res, 200, { reports, total, summary });
}

export async function handleGetDetail(_req: IncomingMessage, res: ServerResponse, reportId: number): Promise<void> {
  const data = db.getInsightReportById(reportId);
  if (!data) {
    sendError(res, 404, "NOT_FOUND", "Insight report not found");
    return;
  }
  sendJson(res, 200, {
    report: formatReport(data.report),
    evidence: data.evidence.map((e) => ({
      id: e.id,
      claim_type: e.claim_type,
      claim: e.claim_text,
      session_id: e.session_id,
      message_id: e.message_id,
      created_at: e.created_at,
    })),
    sessions: data.sessions.map((s) => ({
      id: s.session_id,
      source: s.source,
      workspace: s.workspace,
      external_id: s.external_id,
      last_at: s.last_at,
      message_count: s.message_count,
    })),
  });
}

export async function handleDelete(_req: IncomingMessage, res: ServerResponse, reportId: number): Promise<void> {
  if (!reportId) {
    sendError(res, 400, "INVALID_ARGUMENT", "Invalid report id");
    return;
  }
  const removed = db.deleteInsightReport(reportId);
  if (!removed) {
    sendError(res, 404, "NOT_FOUND", "Insight report not found");
    return;
  }
  sendJson(res, 200, { ok: true, report_id: reportId });
}

export async function handleCandidates(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const params = getQueryParams(url);
  const source = params.get("source");
  const workspace = params.get("workspace");
  const query = params.get("q");
  const limit = parseIntSafe(params.get("limit"), 120);
  const offset = parseIntSafe(params.get("offset"), 0);
  const { parseOptInt, SOURCE_LABELS } = await import("../utils/http.js");
  const timeFrom = parseOptInt(params.get("time_from"));
  const timeTo = parseOptInt(params.get("time_to"));
  const parsedSource =
    source && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, source) ? (source as db.Source) : undefined;
  const sessions = db.listSessionsAdvanced({
    source: parsedSource,
    workspace: workspace && workspace.trim() ? workspace.trim() : undefined,
    query: query && query.trim() ? query.trim() : undefined,
    timeFrom: typeof timeFrom === "number" ? timeFrom : undefined,
    timeTo: typeof timeTo === "number" ? timeTo : undefined,
    limit,
    offset,
  });
  const total = db.countSessionsAdvanced({
    source: parsedSource,
    workspace: workspace && workspace.trim() ? workspace.trim() : undefined,
    query: query && query.trim() ? query.trim() : undefined,
    timeFrom: typeof timeFrom === "number" ? timeFrom : undefined,
    timeTo: typeof timeTo === "number" ? timeTo : undefined,
  });
  sendJson(res, 200, { sessions, total });
}

export async function handleQualityKit(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  sendJson(res, 200, {
    analyzer: {
      system_prompt: QUALITY_ANALYZER_SYSTEM_PROMPT,
      output_schema: QUALITY_ANALYZER_OUTPUT_SCHEMA,
    },
    daily_report: {
      markdown_template: DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE,
      metrics: QUALITY_METRIC_DEFINITIONS,
    },
  });
}

export async function handleTomorrowPlanCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const sourceReportId =
    typeof body.source_report_id === "number" && Number.isFinite(body.source_report_id)
      ? Math.trunc(body.source_report_id)
      : null;
  if (!action) {
    sendError(res, 400, "INVALID_ARGUMENT", "action is required");
    return;
  }
  const beforeIds = new Set(db.listTomorrowPlanItems().map((row) => row.id));
  const item = db.appendTomorrowPlanItem(action, sourceReportId);
  const deduped = beforeIds.has(item.id);
  sendJson(res, 200, { item, deduped });
}

export async function handleTomorrowPlanList(_req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  const params = getQueryParams(url);
  const limit = Math.min(20, Math.max(1, parseIntSafe(params.get("limit"), 3)));
  const items = db.listTomorrowPlanItems()
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
  sendJson(res, 200, { items });
}

export async function handleTomorrowPlanUpdate(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  const body = await readJsonBody(req);
  const status = body.status === "done" ? "done" : body.status === "open" ? "open" : null;
  if (!id || !status) {
    sendError(res, 400, "INVALID_ARGUMENT", "id and status(open|done) are required");
    return;
  }
  const item = db.updateTomorrowPlanItemStatus(id, status);
  if (!item) {
    sendError(res, 404, "NOT_FOUND", "Tomorrow plan item not found");
    return;
  }
  sendJson(res, 200, { item });
}

export async function handleTomorrowPlanDelete(_req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
  if (!id) {
    sendError(res, 400, "INVALID_ARGUMENT", "id is required");
    return;
  }
  const removed = db.removeTomorrowPlanItem(id);
  if (!removed) {
    sendError(res, 404, "NOT_FOUND", "Tomorrow plan item not found");
    return;
  }
  sendJson(res, 200, { ok: true });
}

function formatReport(r: db.InsightReportRecord) {
  return {
    id: r.id,
    title: r.title || "Insight Report",
    workspace: r.workspace,
    scope: parseJsonObject(r.scope_json),
    model_mode: r.model_mode,
    provider: r.provider,
    model_name: r.model_name,
    summary: r.summary_md,
    patterns: parseJsonStringArray(r.patterns_json),
    feedback: parseJsonStringArray(r.feedback_json),
    details: parseJsonObject(r.details_json),
    session_count: r.session_count,
    message_count: r.message_count,
    snippet_count: r.snippet_count,
    sources: parseJsonStringArray(r.sources_json),
    scores: {
      efficiency: r.score_efficiency,
      stability: r.score_stability,
      decision_clarity: r.score_decision_clarity,
    },
    score_reasons: parseJsonStringArray(r.score_reasons_json),
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
