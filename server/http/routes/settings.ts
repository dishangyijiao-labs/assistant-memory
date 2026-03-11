import type { IncomingMessage, ServerResponse } from "http";
import * as db from "../../storage/db.js";
import {
  SOURCE_LABELS,
  SOURCE_DESCRIPTIONS,
  parseSourceKey,
  sendJson,
  sendError,
  readJsonBody,
  resolveModelApiKey,
  testModelConnection,
  setRuntimeModelApiKey,
} from "../utils/http.js";
import { runIngest } from "../../ingest/index.js";

export async function handleGetSources(_req: IncomingMessage, res: ServerResponse): Promise<void> {
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
}

export async function handleUpdateSource(req: IncomingMessage, res: ServerResponse, sourceKey: string): Promise<void> {
  const source = parseSourceKey(sourceKey);
  if (!source) {
    sendError(res, 400, "INVALID_ARGUMENT", "Unknown source");
    return;
  }
  const body = await readJsonBody(req);
  const patch: db.SourceSettingsPatch = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.path === "string") patch.path = body.path.trim();
  if (body.mode === "local_files" || body.mode === "file_import" || body.mode === "api") patch.mode = body.mode;
  if (typeof body.last_sync_at === "number" && Number.isFinite(body.last_sync_at)) {
    patch.last_sync_at = Math.trunc(body.last_sync_at);
  } else if (body.last_sync_at === null) {
    patch.last_sync_at = null;
  }
  const updated = db.updateSourceSettings(source, patch);
  sendJson(res, 200, { source: updated });
}

export async function handleSyncSource(req: IncomingMessage, res: ServerResponse, sourceKey: string): Promise<void> {
  const source = parseSourceKey(sourceKey);
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
}

export async function handleGetModel(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const settings = db.getModelSettings();
  const hasApiKey = Boolean(resolveModelApiKey(settings));
  const { api_key: _omit, ...safeSettings } = settings;
  sendJson(res, 200, { settings: safeSettings, has_api_key: hasApiKey });
}

export async function handleUpdateModel(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const patch: Partial<db.ModelSettings> = {};
  if (body.mode_default === "local" || body.mode_default === "external" || body.mode_default === "agent") {
    patch.mode_default = body.mode_default;
  }
  if (typeof body.external_enabled === "boolean") patch.external_enabled = body.external_enabled;
  if (typeof body.provider === "string") patch.provider = body.provider.trim();
  if (typeof body.base_url === "string") patch.base_url = body.base_url.trim();
  if (typeof body.model_name === "string") patch.model_name = body.model_name.trim();
  if (typeof body.key_ref === "string") patch.key_ref = body.key_ref.trim();
  if (typeof body.api_key === "string") {
    const persistedApiKey = body.api_key.trim();
    patch.api_key = persistedApiKey;
    setRuntimeModelApiKey(persistedApiKey || null);
    if (!patch.key_ref) patch.key_ref = persistedApiKey ? "db" : "";
  }
  const settings = db.updateModelSettings(patch);
  const hasApiKey = Boolean(resolveModelApiKey(settings));
  const { api_key: _omit, ...safeSettings } = settings;
  sendJson(res, 200, { settings: safeSettings, has_api_key: hasApiKey });
}

export async function handleTestModel(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const settings = db.getModelSettings();
  const testSettings: db.ModelSettings = {
    ...settings,
    provider: typeof body.provider === "string" ? body.provider : settings.provider,
    base_url: typeof body.base_url === "string" ? body.base_url : settings.base_url,
    model_name: typeof body.model_name === "string" ? body.model_name : settings.model_name,
    external_enabled: typeof body.external_enabled === "boolean" ? body.external_enabled : settings.external_enabled,
  };
  const apiKey = resolveModelApiKey(testSettings, typeof body.api_key === "string" ? body.api_key : undefined);
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
}
