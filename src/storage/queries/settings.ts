import { getDb } from "../db-core.js";
import { SOURCES, type Source } from "../types.js";

const MODEL_SETTING_KEYS = {
  modeDefault: "model.mode_default",
  externalEnabled: "model.external_enabled",
  provider: "model.provider",
  baseUrl: "model.base_url",
  modelName: "model.model_name",
  keyRef: "model.key_ref",
  apiKey: "model.api_key",
} as const;

export interface ModelSettings {
  mode_default: "local" | "external" | "agent";
  external_enabled: boolean;
  provider: string;
  base_url: string;
  model_name: string;
  key_ref: string;
  api_key: string;
}

const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  mode_default: "local",
  external_enabled: false,
  provider: "",
  base_url: "https://api.openai.com/v1",
  model_name: "",
  key_ref: "",
  api_key: "",
};

function getSettingRaw(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

const TOMORROW_PLAN_KEY = "insights.tomorrow_plan";

export interface TomorrowPlanItem {
  id: string;
  action: string;
  source_report_id: number | null;
  status: "open" | "done";
  created_at: number;
}

export function setSetting(key: string, value: string): void {
  const now = Date.now();
  getDb()
    .prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    .run(key, value, now);
}

export function listTomorrowPlanItems(): TomorrowPlanItem[] {
  const raw = getSettingRaw(TOMORROW_PLAN_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const row = item as Record<string, unknown>;
        const id = typeof row.id === "string" ? row.id : "";
        const action = typeof row.action === "string" ? row.action : "";
        const sourceReportId =
          typeof row.source_report_id === "number" && Number.isFinite(row.source_report_id)
            ? Math.trunc(row.source_report_id)
            : null;
        const status = row.status === "open" || row.status === "done" ? row.status : null;
        const createdAt =
          typeof row.created_at === "number" && Number.isFinite(row.created_at) ? Math.trunc(row.created_at) : 0;
        if (!id || !action || !status || !createdAt) return null;
        return {
          id,
          action,
          source_report_id: sourceReportId,
          status,
          created_at: createdAt,
        } as TomorrowPlanItem;
      })
      .filter((item): item is TomorrowPlanItem => Boolean(item));
  } catch {
    return [];
  }
}

export function appendTomorrowPlanItem(action: string, sourceReportId?: number | null): TomorrowPlanItem {
  const cleanAction = action.trim();
  if (!cleanAction) {
    throw new Error("TOMORROW_PLAN_ACTION_EMPTY");
  }
  const normalized = cleanAction.replace(/\s+/g, " ").toLowerCase();
  const now = Date.now();
  const items = listTomorrowPlanItems();
  const existing = items.find((item) => item.action.trim().replace(/\s+/g, " ").toLowerCase() === normalized);
  if (existing) {
    return existing;
  }
  const nextItem: TomorrowPlanItem = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    action: cleanAction,
    source_report_id:
      typeof sourceReportId === "number" && Number.isFinite(sourceReportId) ? Math.trunc(sourceReportId) : null,
    status: "open",
    created_at: now,
  };
  const out = [nextItem, ...items].slice(0, 100);
  setSetting(TOMORROW_PLAN_KEY, JSON.stringify(out));
  return nextItem;
}

export function updateTomorrowPlanItemStatus(id: string, status: "open" | "done"): TomorrowPlanItem | null {
  const targetId = id.trim();
  if (!targetId) return null;
  const items = listTomorrowPlanItems();
  const idx = items.findIndex((item) => item.id === targetId);
  if (idx < 0) return null;
  const next = [...items];
  next[idx] = { ...next[idx], status };
  setSetting(TOMORROW_PLAN_KEY, JSON.stringify(next));
  return next[idx] ?? null;
}

export function removeTomorrowPlanItem(id: string): boolean {
  const targetId = id.trim();
  if (!targetId) return false;
  const items = listTomorrowPlanItems();
  const next = items.filter((item) => item.id !== targetId);
  if (next.length === items.length) return false;
  setSetting(TOMORROW_PLAN_KEY, JSON.stringify(next));
  return true;
}

export function getModelSettings(): ModelSettings {
  const modeRaw = getSettingRaw(MODEL_SETTING_KEYS.modeDefault);
  const mode = modeRaw === "agent" ? "agent" : modeRaw === "external" ? "external" : "local";
  const externalEnabled = getSettingRaw(MODEL_SETTING_KEYS.externalEnabled) === "true";
  const provider = getSettingRaw(MODEL_SETTING_KEYS.provider) ?? DEFAULT_MODEL_SETTINGS.provider;
  const baseUrl = getSettingRaw(MODEL_SETTING_KEYS.baseUrl) ?? DEFAULT_MODEL_SETTINGS.base_url;
  const modelName = getSettingRaw(MODEL_SETTING_KEYS.modelName) ?? DEFAULT_MODEL_SETTINGS.model_name;
  const keyRef = getSettingRaw(MODEL_SETTING_KEYS.keyRef) ?? DEFAULT_MODEL_SETTINGS.key_ref;
  const apiKey = getSettingRaw(MODEL_SETTING_KEYS.apiKey) ?? DEFAULT_MODEL_SETTINGS.api_key;
  return {
    mode_default: mode,
    external_enabled: externalEnabled,
    provider,
    base_url: baseUrl,
    model_name: modelName,
    key_ref: keyRef,
    api_key: apiKey,
  };
}

export function updateModelSettings(patch: Partial<ModelSettings>): ModelSettings {
  if (patch.mode_default) {
    setSetting(MODEL_SETTING_KEYS.modeDefault, patch.mode_default);
  }
  if (typeof patch.external_enabled === "boolean") {
    setSetting(MODEL_SETTING_KEYS.externalEnabled, patch.external_enabled ? "true" : "false");
  }
  if (typeof patch.provider === "string") {
    setSetting(MODEL_SETTING_KEYS.provider, patch.provider);
  }
  if (typeof patch.base_url === "string") {
    setSetting(MODEL_SETTING_KEYS.baseUrl, patch.base_url);
  }
  if (typeof patch.model_name === "string") {
    setSetting(MODEL_SETTING_KEYS.modelName, patch.model_name);
  }
  if (typeof patch.key_ref === "string") {
    setSetting(MODEL_SETTING_KEYS.keyRef, patch.key_ref);
  }
  if (typeof patch.api_key === "string") {
    setSetting(MODEL_SETTING_KEYS.apiKey, patch.api_key);
  }
  return getModelSettings();
}

export type SourceMode = "local_files" | "file_import" | "api";

export interface SourceSettings {
  source: Source;
  enabled: boolean;
  mode: SourceMode;
  path: string;
  last_sync_at: number | null;
}

export interface SourceSettingsPatch {
  enabled?: boolean;
  mode?: SourceMode;
  path?: string;
  last_sync_at?: number | null;
}

const DEFAULT_SOURCE_SETTINGS: Record<Source, { enabled: boolean; mode: SourceMode; path: string }> = {
  cursor: {
    enabled: true,
    mode: "local_files",
    path: "~/.cursor/conversations",
  },
  copilot: {
    enabled: true,
    mode: "local_files",
    path: "~/.config/github-copilot/conversations",
  },
  "cursor-cli": {
    enabled: true,
    mode: "local_files",
    path: "~/.cursor-cli/history",
  },
  "claude-code": {
    enabled: true,
    mode: "local_files",
    path: "~/.claude/projects",
  },
  codex: {
    enabled: true,
    mode: "local_files",
    path: "~/.codex/sessions",
  },
  gemini: {
    enabled: true,
    mode: "file_import",
    path: "~/.gemini/conversations",
  },
};

type SourceSettingField = "enabled" | "mode" | "path" | "last_sync_at";

function sourceSettingKey(source: Source, field: SourceSettingField): string {
  return `source.${source}.${field}`;
}

function normalizeSourceMode(raw: string | null, fallback: SourceMode): SourceMode {
  if (raw === "local_files" || raw === "file_import" || raw === "api") return raw;
  return fallback;
}

function parseStoredNumber(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function getSourceSettings(source: Source): SourceSettings {
  const defaults = DEFAULT_SOURCE_SETTINGS[source];
  const enabledRaw = getSettingRaw(sourceSettingKey(source, "enabled"));
  const modeRaw = getSettingRaw(sourceSettingKey(source, "mode"));
  const pathRaw = getSettingRaw(sourceSettingKey(source, "path"));
  const lastSyncRaw = getSettingRaw(sourceSettingKey(source, "last_sync_at"));
  return {
    source,
    enabled: enabledRaw === null ? defaults.enabled : enabledRaw === "true",
    mode: normalizeSourceMode(modeRaw, defaults.mode),
    path: pathRaw ?? defaults.path,
    last_sync_at: parseStoredNumber(lastSyncRaw),
  };
}

export function listSourceSettings(): SourceSettings[] {
  return SOURCES.map((source) => getSourceSettings(source));
}

export function listEnabledSources(): Source[] {
  return listSourceSettings()
    .filter((item) => item.enabled)
    .map((item) => item.source);
}

export function updateSourceSettings(source: Source, patch: SourceSettingsPatch): SourceSettings {
  if (typeof patch.enabled === "boolean") {
    setSetting(sourceSettingKey(source, "enabled"), patch.enabled ? "true" : "false");
  }
  if (typeof patch.mode === "string") {
    const mode = normalizeSourceMode(patch.mode, DEFAULT_SOURCE_SETTINGS[source].mode);
    setSetting(sourceSettingKey(source, "mode"), mode);
  }
  if (typeof patch.path === "string") {
    setSetting(sourceSettingKey(source, "path"), patch.path.trim());
  }
  if (typeof patch.last_sync_at === "number" && Number.isFinite(patch.last_sync_at)) {
    setSetting(sourceSettingKey(source, "last_sync_at"), String(Math.trunc(patch.last_sync_at)));
  } else if (patch.last_sync_at === null) {
    setSetting(sourceSettingKey(source, "last_sync_at"), "");
  }
  return getSourceSettings(source);
}
