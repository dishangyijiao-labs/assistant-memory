import { createServer, type IncomingMessage, type ServerResponse } from "http";
import * as db from "../../storage/db.js";
import { runIngest } from "../../ingest/index.js";
import { generateInsight, type InsightModelConfig } from "../../insights/generate.js";
import {
  SOURCE_LABELS,
  SOURCE_DESCRIPTIONS,
  getQueryParams,
  parseSourceKey,
  parseIntSafe,
  parseOptInt,
  sendJson,
  sendError,
  readJsonBody,
  resolveModelApiKey,
  testModelConnection,
  serveSearchApi,
  serveSessionsApi,
  serveSessionDetailApi,
  parseJsonArray,
  parseJsonObject,
  parseJsonStringArray,
  setRuntimeModelApiKey,
} from "../utils/http.js";
import getSearchPage from "../views/search.js";
import getSessionPage from "../views/session.js";
import getInsightsPage from "../views/insights.js";
import getSettingsPage from "../views/settings.js";
import getInsightsReportsPage from "../views/insights-reports.js";
import {
  DAILY_QUALITY_REPORT_MARKDOWN_TEMPLATE,
  QUALITY_ANALYZER_OUTPUT_SCHEMA,
  QUALITY_ANALYZER_SYSTEM_PROMPT,
  QUALITY_METRIC_DEFINITIONS,
} from "../../insights/quality-kit.js";
import { analyzeSession } from "../../insights/quality-analyzer.js";

const DEFAULT_PORT = 3000;
const MIN_INSIGHT_TOTAL_MESSAGES = 10;
const MIN_INSIGHT_USER_MESSAGES = 5;

export function createHandler() {
  return function handler(req: IncomingMessage, res: ServerResponse): void {
    void (async () => {
      const url = req.url ?? "/";
      const method = req.method ?? "GET";
      const path = url.split("?")[0];
      const userAgent = req.headers["user-agent"] ?? "-";

      // Allow only local origins: localhost, 127.0.0.1, and Tauri WebView.
      const origin = req.headers.origin ?? "";
      const ALLOWED_ORIGINS = [
        "http://localhost:3939",
        "http://127.0.0.1:3939",
        "tauri://localhost",
      ];
      if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      }
      if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      console.log(`[${new Date().toISOString()}] ${method} ${url} - ${userAgent}`);

      if (path === "/api/index" && method === "POST") {
        try {
          const enabledSources = db.listEnabledSources();
          if (enabledSources.length === 0) {
            sendError(res, 400, "NO_ENABLED_SOURCE", "No AI tool enabled. Enable at least one source in Advanced.");
            return;
          }
          const sources = enabledSources;
          const stats = runIngest({ sources });
          const syncAt = Date.now();
          for (const source of sources) {
            db.updateSourceSettings(source, { last_sync_at: syncAt });
          }
          sendJson(res, 200, { sessions: stats.sessions, messages: stats.messages, sources, last_sync_at: syncAt });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Index failed";
          sendError(res, 500, "INDEX_FAILED", message);
        }
        return;
      }

      if (path === "/api/insights/generate" && method === "POST") {
        try {
          const body = await readJsonBody(req);
          const scopeRaw =
            body.scope && typeof body.scope === "object" && !Array.isArray(body.scope)
              ? (body.scope as Record<string, unknown>)
              : {};
          const modelRaw =
            body.model && typeof body.model === "object" && !Array.isArray(body.model)
              ? (body.model as Record<string, unknown>)
              : {};
          const selectedSessionIds = Array.isArray(body.session_ids)
            ? body.session_ids
                .map((id) => (typeof id === "number" ? Math.trunc(id) : Number.NaN))
                .filter((id) => Number.isFinite(id) && id > 0)
            : [];
          const uniqueSessionIds = [...new Set(selectedSessionIds)];
          const sessionsByIds = uniqueSessionIds.length > 0 ? db.listSessionsByIds(uniqueSessionIds) : [];
          const sessionIdSet = new Set(sessionsByIds.map((item) => item.id));
          const validSelectedIds = uniqueSessionIds.filter((id) => sessionIdSet.has(id));

          const workspaceFromScope = typeof scopeRaw.workspace === "string" ? scopeRaw.workspace.trim() : "";
          const workspaceFromSessions = sessionsByIds.length > 0
            ? [...new Set(sessionsByIds.map((s) => s.workspace).filter((w) => Boolean(w && w.trim())))]
            : [];
          const workspace =
            workspaceFromScope ||
            (workspaceFromSessions.length === 1
              ? workspaceFromSessions[0] ?? ""
              : workspaceFromSessions.length > 1
                ? "(mixed)"
                : "") ||
            db.getMostRecentWorkspace() ||
            "";

          const sourcesFromScope =
            Array.isArray(scopeRaw.sources)
              ? scopeRaw.sources
                  .filter((s): s is string => typeof s === "string" && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, s))
                  .map((s) => s as db.Source)
              : [];
          const sourcesFromSelected =
            sessionsByIds
              .map((s) => s.source)
              .filter((s): s is db.Source => Object.prototype.hasOwnProperty.call(SOURCE_LABELS, s));
          const sources = [...new Set(validSelectedIds.length > 0 ? sourcesFromSelected : sourcesFromScope)];
          const timeFrom = typeof scopeRaw.time_from === "number" ? Math.trunc(scopeRaw.time_from) : undefined;
          const timeTo = typeof scopeRaw.time_to === "number" ? Math.trunc(scopeRaw.time_to) : undefined;
          const settings = db.getModelSettings();
          const mode =
            modelRaw.mode === "agent" || modelRaw.mode === "external" || modelRaw.mode === "local"
              ? modelRaw.mode
              : settings.mode_default;
          const externalRequestedInPayload = modelRaw.mode === "external" || modelRaw.mode === "agent" || modelRaw.external_enabled === true;
          if ((mode === "external" || mode === "agent") && !settings.external_enabled && !externalRequestedInPayload) {
            sendError(res, 400, "INSIGHTS_MODEL_NOT_CONFIGURED", "External model is disabled");
            return;
          }
          const modelConfig: InsightModelConfig = { mode };
          if (mode === "external" || mode === "agent") {
            const apiKey = resolveModelApiKey(settings, typeof modelRaw.api_key === "string" ? modelRaw.api_key : undefined);
            if (!apiKey) {
              sendError(res, 400, "INSIGHTS_MODEL_NOT_CONFIGURED", "External model API key is missing");
              return;
            }
            modelConfig.provider =
              typeof modelRaw.provider === "string" && modelRaw.provider.trim()
                ? modelRaw.provider.trim()
                : settings.provider;
            modelConfig.baseUrl =
              typeof modelRaw.base_url === "string" && modelRaw.base_url.trim()
                ? modelRaw.base_url.trim()
                : settings.base_url;
            modelConfig.modelName =
              typeof modelRaw.model_name === "string" && modelRaw.model_name.trim()
                ? modelRaw.model_name.trim()
                : settings.model_name;
            modelConfig.apiKey = apiKey;
          }
          const messages =
            validSelectedIds.length > 0
              ? db.getMessagesForSessionIds(validSelectedIds)
              : db.getMessagesForInsightScope({
                  workspace,
                  timeFrom,
                  timeTo,
                  sources,
                });
          if (messages.length === 0) {
            sendError(res, 400, "INVALID_ARGUMENT", "No messages found in selected scope or session selection");
            return;
          }
          const userMessageCount = messages.reduce(
            (count, message) => count + (String(message.role || "").toLowerCase() === "user" ? 1 : 0),
            0
          );
          if (messages.length < MIN_INSIGHT_TOTAL_MESSAGES || userMessageCount < MIN_INSIGHT_USER_MESSAGES) {
            sendError(
              res,
              400,
              "INSIGHTS_SAMPLE_TOO_SMALL",
              `Need at least ${MIN_INSIGHT_TOTAL_MESSAGES} total messages and ${MIN_INSIGHT_USER_MESSAGES} user messages. Current: ${messages.length} total, ${userMessageCount} user.`
            );
            return;
          }
          const qualitySessionIds =
            validSelectedIds.length > 0
              ? validSelectedIds
              : [...new Set(messages.map((m) => m.session_id))];
          const qualityKpi = db.getQualityKpiForScope({ sessionIds: qualitySessionIds });
          const topLowQualityQuestions = db.getTopLowQualityQuestions({
            sessionIds: qualitySessionIds,
            limit: 10,
            maxScore: 70,
          });
          const qualityContext = {
            kpi: qualityKpi,
            topLowQualityQuestions,
          } satisfies { kpi: db.QualityKpiSnapshot; topLowQualityQuestions: db.LowQualityQuestion[] };
          const insight = await generateInsight(messages, modelConfig, qualityContext);
          const sessionMessageCountMap = new Map<number, number>();
          for (const message of messages) {
            sessionMessageCountMap.set(message.session_id, (sessionMessageCountMap.get(message.session_id) ?? 0) + 1);
          }
          const selectedSessionsForReport =
            validSelectedIds.length > 0
              ? validSelectedIds.map((sessionId) => ({
                  sessionId,
                  messageCount: sessionMessageCountMap.get(sessionId) ?? 0,
                }))
              : [...sessionMessageCountMap.entries()].map(([sessionId, messageCount]) => ({ sessionId, messageCount }));

          const reportId = db.insertInsightReport({
            title: insight.title,
            workspace,
            scopeJson: JSON.stringify({
              workspace,
              time_from: timeFrom ?? null,
              time_to: timeTo ?? null,
              sources,
              session_ids: validSelectedIds,
            }),
            modelMode: mode,
            provider: modelConfig.provider ?? null,
            modelName: modelConfig.modelName ?? null,
            summaryMd: insight.summary,
            patternsJson: JSON.stringify(insight.patterns),
            feedbackJson: JSON.stringify(insight.feedback),
            detailsJson: JSON.stringify(insight.details),
            sessionCount: insight.sessionCount,
            messageCount: insight.messageCount,
            snippetCount: insight.snippetCount,
            sourcesJson: JSON.stringify(insight.sources),
            scoreEfficiency: insight.scores.efficiency,
            scoreStability: insight.scores.stability,
            scoreDecisionClarity: insight.scores.decision_clarity,
            scoreReasonsJson: JSON.stringify(insight.scoreReasons),
            status: "completed",
          });
          db.insertInsightEvidence(reportId, insight.evidence);
          db.insertInsightReportSessions(reportId, selectedSessionsForReport);
          sendJson(res, 200, {
            report_id: reportId,
            status: "completed",
            title: insight.title,
            summary: insight.summary,
            patterns: insight.patterns,
            feedback: insight.feedback,
            scores: insight.scores,
            score_reasons: insight.scoreReasons,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Insights generation failed";
          sendError(res, 500, "INSIGHTS_GENERATION_FAILED", message);
        }
        return;
      }

      if (path === "/api/settings/model" && method === "PUT") {
        try {
          const body = await readJsonBody(req);
          const patch: Partial<db.ModelSettings> = {};
          if (body.mode_default === "local" || body.mode_default === "external" || body.mode_default === "agent") {
            patch.mode_default = body.mode_default;
          }
          if (typeof body.external_enabled === "boolean") {
            patch.external_enabled = body.external_enabled;
          }
          if (typeof body.provider === "string") {
            patch.provider = body.provider.trim();
          }
          if (typeof body.base_url === "string") {
            patch.base_url = body.base_url.trim();
          }
          if (typeof body.model_name === "string") {
            patch.model_name = body.model_name.trim();
          }
          if (typeof body.key_ref === "string") {
            patch.key_ref = body.key_ref.trim();
          }
          if (typeof body.api_key === "string") {
            const persistedApiKey = body.api_key.trim();
            patch.api_key = persistedApiKey;
            setRuntimeModelApiKey(persistedApiKey || null);
            if (!patch.key_ref) {
              patch.key_ref = persistedApiKey ? "db" : "";
            }
          }
          const settings = db.updateModelSettings(patch);
          const hasApiKey = Boolean(resolveModelApiKey(settings));
          sendJson(res, 200, { settings, has_api_key: hasApiKey });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update model settings";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/model/test" && method === "POST") {
        try {
          const body = await readJsonBody(req);
          const settings = db.getModelSettings();
          const testSettings: db.ModelSettings = {
            ...settings,
            provider: typeof body.provider === "string" ? body.provider : settings.provider,
            base_url: typeof body.base_url === "string" ? body.base_url : settings.base_url,
            model_name: typeof body.model_name === "string" ? body.model_name : settings.model_name,
            external_enabled:
              typeof body.external_enabled === "boolean" ? body.external_enabled : settings.external_enabled,
          };
          const apiKey = resolveModelApiKey(
            testSettings,
            typeof body.api_key === "string" ? body.api_key : undefined
          );
          if (!apiKey) {
            sendError(res, 400, "INSIGHTS_MODEL_NOT_CONFIGURED", "External model API key is missing");
            return;
          }
          const out = await testModelConnection(testSettings, apiKey);
          if (out.ok) {
            sendJson(res, 200, out);
          } else {
            sendError(res, 400, "MODEL_PROVIDER_TIMEOUT", out.message);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Model test failed";
          sendError(res, 500, "MODEL_PROVIDER_TIMEOUT", message);
        }
        return;
      }

      const sourceUpdateMatch = path.match(/^\/api\/settings\/sources\/([a-z-]+)$/);
      if (sourceUpdateMatch && method === "PUT") {
        try {
          const source = parseSourceKey(sourceUpdateMatch[1] ?? "");
          if (!source) {
            sendError(res, 400, "INVALID_ARGUMENT", "Unknown source");
            return;
          }
          const body = await readJsonBody(req);
          const patch: db.SourceSettingsPatch = {};
          if (typeof body.enabled === "boolean") {
            patch.enabled = body.enabled;
          }
          if (typeof body.path === "string") {
            patch.path = body.path.trim();
          }
          if (
            body.mode === "local_files" ||
            body.mode === "file_import" ||
            body.mode === "api"
          ) {
            patch.mode = body.mode;
          }
          if (typeof body.last_sync_at === "number" && Number.isFinite(body.last_sync_at)) {
            patch.last_sync_at = Math.trunc(body.last_sync_at);
          } else if (body.last_sync_at === null) {
            patch.last_sync_at = null;
          }
          const updated = db.updateSourceSettings(source, patch);
          sendJson(res, 200, { source: updated });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update source settings";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      const sourceSyncMatch = path.match(/^\/api\/settings\/sources\/([a-z-]+)\/sync$/);
      if (sourceSyncMatch && method === "POST") {
        try {
          const source = parseSourceKey(sourceSyncMatch[1] ?? "");
          if (!source) {
            sendError(res, 400, "INVALID_ARGUMENT", "Unknown source");
            return;
          }
          const body = await readJsonBody(req);
          const force = body.force === true;
          const sourceSetting = db.getSourceSettings(source);
          if (!sourceSetting.enabled && !force) {
            sendError(res, 400, "SOURCE_DISABLED", "Source is disabled. Enable it before syncing.");
            return;
          }
          const stats = runIngest({ sources: [source] });
          const syncAt = Date.now();
          const updated = db.updateSourceSettings(source, { last_sync_at: syncAt });
          const aggregate = db.getSourceAggregates().find((item) => item.source === source);
          sendJson(res, 200, {
            source: updated,
            aggregate: aggregate ?? { source, session_count: 0, message_count: 0, last_at: null },
            stats,
            last_sync_at: syncAt,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to sync source";
          sendError(res, 500, "INDEX_FAILED", message);
        }
        return;
      }

      if (path === "/api/stats" && method === "GET") {
        try {
          const stats = db.getStats();
          const dbPath = db.getDbPath();
          sendJson(res, 200, { sessions: stats.sessions, messages: stats.messages, dbPath });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to read database";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/insights/quality-kit" && method === "GET") {
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
        return;
      }

      const insightDeleteMatch = path.match(/^\/api\/insights\/(\d+)$/);
      if (insightDeleteMatch && method === "DELETE") {
        try {
          const reportId = parseInt(insightDeleteMatch[1] ?? "0", 10);
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete insight report";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/quality/analyze" && method === "POST") {
        try {
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
          const result = await analyzeSession(sessionId, {
            baseUrl,
            modelName,
            apiKey,
          });
          sendJson(res, 200, {
            session_id: sessionId,
            analyzed: result.analyzed,
            failed: result.failed,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Quality analysis failed";
          sendError(res, 500, "QUALITY_ANALYSIS_FAILED", message);
        }
        return;
      }

      if (path === "/api/insights/tomorrow-plan" && method === "POST") {
        try {
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to append tomorrow plan";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/insights/tomorrow-plan" && method === "GET") {
        try {
          const params = getQueryParams(url);
          const limit = Math.min(20, Math.max(1, parseIntSafe(params.get("limit"), 3)));
          const items = db.listTomorrowPlanItems()
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, limit);
          sendJson(res, 200, { items });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load tomorrow plan";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      const tomorrowPlanItemMatch = path.match(/^\/api\/insights\/tomorrow-plan\/([^/]+)$/);
      if (tomorrowPlanItemMatch && method === "PUT") {
        try {
          const body = await readJsonBody(req);
          const id = decodeURIComponent(tomorrowPlanItemMatch[1] ?? "").trim();
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update tomorrow plan";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (tomorrowPlanItemMatch && method === "DELETE") {
        try {
          const id = decodeURIComponent(tomorrowPlanItemMatch[1] ?? "").trim();
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete tomorrow plan";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (method !== "GET") {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method Not Allowed");
        return;
      }

      if (url === "/" || url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getSearchPage());
        return;
      }

      if (path === "/session") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getSessionPage());
        return;
      }

      if (path === "/insights" || path === "/insights/new" || /^\/insights\/\d+$/.test(path)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getInsightsReportsPage());
        return;
      }

      if (path === "/settings" || path === "/advanced") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getSettingsPage());
        return;
      }

      if (path === "/api/workspaces") {
        try {
          const params = getQueryParams(url);
          const limit = parseIntSafe(params.get("limit"), 200);
          const workspaces = db.listWorkspaces(limit);
          sendJson(res, 200, { workspaces });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to list workspaces";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/settings/sources") {
        try {
          const sourceSettings = db.listSourceSettings();
          const aggregateMap = new Map<string, db.SourceAggregate>();
          for (const row of db.getSourceAggregates()) {
            aggregateMap.set(row.source, row);
          }
          const summaryStats = db.getStats();
          const sources = sourceSettings.map((item) => {
            const aggregate = aggregateMap.get(item.source);
            return {
              source: item.source,
              label: SOURCE_LABELS[item.source],
              description: SOURCE_DESCRIPTIONS[item.source],
              enabled: item.enabled,
              mode: item.mode,
              path: item.path,
              last_sync_at: item.last_sync_at,
              session_count: aggregate?.session_count ?? 0,
              message_count: aggregate?.message_count ?? 0,
              last_activity_at: aggregate?.last_at ?? null,
            };
          });
          const activeSources = sources.reduce((count, s) => count + (s.enabled ? 1 : 0), 0);
          sendJson(res, 200, {
            summary: {
              active_sources: activeSources,
              total_sessions: summaryStats.sessions,
              total_messages: summaryStats.messages,
            },
            db_path: db.getDbPath(),
            sources,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to read source settings";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/settings/model") {
        try {
          const settings = db.getModelSettings();
          const hasApiKey = Boolean(resolveModelApiKey(settings));
          sendJson(res, 200, { settings, has_api_key: hasApiKey });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to read model settings";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/search") {
        const params = getQueryParams(url);
        const q = (params.get("q") ?? "").trim();
        const limit = parseInt(params.get("limit") ?? "20", 10) || 20;
        const source = params.get("source") || null;
        try {
          const data = serveSearchApi(q, limit, source);
          sendJson(res, 200, data);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Search failed";
          sendError(res, 500, "SEARCH_FAILED", message);
        }
        return;
      }

      if (path === "/api/insights") {
        try {
          const params = getQueryParams(url);
          const workspace = (params.get("workspace") ?? "").trim() || undefined;
          const limit = parseIntSafe(params.get("limit"), 20);
          const offset = parseIntSafe(params.get("offset"), 0);
          const rows = db.listInsightReports({ workspace, limit, offset });
          const total = db.countInsightReports(workspace);
          const summary = db.getInsightReportAggregates(workspace);
          const reports = rows.map((r) => ({
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
          }));
          sendJson(res, 200, { reports, total, summary });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to list insights";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/insights/candidates") {
        try {
          const params = getQueryParams(url);
          const source = params.get("source");
          const workspace = params.get("workspace");
          const query = params.get("q");
          const limit = parseIntSafe(params.get("limit"), 120);
          const offset = parseIntSafe(params.get("offset"), 0);
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to list insight candidates";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      const insightDetailMatch = path.match(/^\/api\/insights\/(\d+)$/);
      if (insightDetailMatch) {
        try {
          const reportId = parseInt(insightDetailMatch[1] ?? "0", 10);
          const data = db.getInsightReportById(reportId);
          if (!data) {
            sendError(res, 404, "NOT_FOUND", "Insight report not found");
            return;
          }
          sendJson(res, 200, {
            report: {
              id: data.report.id,
              title: data.report.title || "Insight Report",
              workspace: data.report.workspace,
              scope: parseJsonObject(data.report.scope_json),
              model_mode: data.report.model_mode,
              provider: data.report.provider,
              model_name: data.report.model_name,
              summary: data.report.summary_md,
              patterns: parseJsonStringArray(data.report.patterns_json),
              feedback: parseJsonStringArray(data.report.feedback_json),
              details: parseJsonObject(data.report.details_json),
              session_count: data.report.session_count,
              message_count: data.report.message_count,
              snippet_count: data.report.snippet_count,
              sources: parseJsonStringArray(data.report.sources_json),
              scores: {
                efficiency: data.report.score_efficiency,
                stability: data.report.score_stability,
                decision_clarity: data.report.score_decision_clarity,
              },
              score_reasons: parseJsonStringArray(data.report.score_reasons_json),
              status: data.report.status,
              created_at: data.report.created_at,
              updated_at: data.report.updated_at,
            },
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load insight report";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/sessions") {
        const params = getQueryParams(url);
        const source = params.get("source") || null;
        const workspace = params.get("workspace") || null;
        const limit = parseInt(params.get("limit") ?? "500", 10) || 100;
        const offset = parseInt(params.get("offset") ?? "0", 10) || 0;
        const query = params.get("q");
        const timeFrom = parseOptInt(params.get("time_from"));
        const timeTo = parseOptInt(params.get("time_to"));
        try {
          const data = serveSessionsApi(source, workspace, limit, offset, query, timeFrom, timeTo);
          sendJson(res, 200, data);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to list sessions";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/session") {
        const params = getQueryParams(url);
        const sessionId = parseInt(params.get("session_id") ?? "0", 10);
        if (!sessionId) {
          sendError(res, 400, "INVALID_ARGUMENT", "Missing session_id");
          return;
        }
        const limit = parseIntSafe(params.get("limit"), 2000);
        const offset = parseIntSafe(params.get("offset"), 0);
        const order = params.get("order") === "desc" ? "desc" : "asc";
        try {
          const data = serveSessionDetailApi(sessionId, limit, offset, order);
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load session";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/quality/kpi") {
        try {
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to compute KPI";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/eval/stats") {
        try {
          const params = getQueryParams(url);
          const sessionIdsParam = params.get("session_ids");
          const sessionIds = sessionIdsParam
            ? sessionIdsParam.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0)
            : undefined;
          const timeFrom = parseOptInt(params.get("time_from"));
          const timeTo = parseOptInt(params.get("time_to"));
          const stats = db.getEvalStats({
            sessionIds: sessionIds && sessionIds.length > 0 ? sessionIds : undefined,
            timeFrom: timeFrom ?? undefined,
            timeTo: timeTo ?? undefined,
          });
          sendJson(res, 200, stats);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to compute eval stats";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Internal server error";
      sendError(res, 500, "INTERNAL_ERROR", message);
    });
  };
}



export function startServer(port: number = DEFAULT_PORT): void {
  const server = createServer(createHandler());
  server.listen(port, () => {
    console.error("AssistMem – web search");
    console.error("Open http://localhost:" + port + " in your browser.");
  });
}
