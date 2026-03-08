import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { SOURCE_LABELS, escapeHtml, formatNumber, timeAgo } from "../format";
import { showToast } from "../components/Toast";
import Toast from "../components/Toast";
import "../styles/settings.css";

const MODE_LABELS: Record<string, string> = {
  local_files: "Local Files",
  file_import: "File Import",
  api: "API",
};

interface SourceEntry {
  source: string;
  label?: string;
  description?: string;
  enabled: boolean;
  mode: string;
  path: string;
  last_sync_at?: number | null;
  session_count: number;
  message_count: number;
  last_activity_at?: number | null;
}

interface SourcesPayload {
  sources: SourceEntry[];
  summary: {
    active_sources: number;
    total_sessions?: number;
    total_messages?: number;
  };
  db_path?: string;
}

interface ModelPayload {
  settings: {
    external_enabled: boolean;
    [key: string]: unknown;
  };
  has_api_key?: boolean;
}

export default function SettingsPage() {
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [activeSources, setActiveSources] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [statusKind, setStatusKind] = useState<"" | "ok" | "warn" | "err">("");
  const [insightsApiStatus, setInsightsApiStatus] = useState("External API: unknown");
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editMode, setEditMode] = useState("local_files");
  const [editPath, setEditPath] = useState("");

  const setStatus = useCallback((message: string, kind: "" | "ok" | "warn" | "err" = "") => {
    setStatusText(message);
    setStatusKind(kind);
  }, []);

  const loadSourceSettings = useCallback(() => {
    setStatus("Loading source settings...", "warn");
    api<SourcesPayload>("/api/settings/sources")
      .then((payload) => {
        const list = payload.sources || [];
        setSources(list);
        const active = payload.summary?.active_sources || 0;
        setActiveSources(active);
        setStatus(
          "Loaded " + formatNumber(active) + " active sources.",
          "ok",
        );
      })
      .catch((err) => {
        setStatus(err?.message || "Failed to load source settings", "err");
      });
  }, [setStatus]);

  const loadModelStatus = useCallback(() => {
    api<ModelPayload>("/api/settings/model")
      .then((payload) => {
        const enabled = !!payload.settings?.external_enabled;
        setInsightsApiStatus("External API: " + (enabled ? "Enabled" : "Disabled"));
      })
      .catch(() => {
        setInsightsApiStatus("External API: unavailable");
      });
  }, []);

  useEffect(() => {
    loadSourceSettings();
    loadModelStatus();
  }, [loadSourceSettings, loadModelStatus]);

  const handleToggle = useCallback(
    (source: string, enabled: boolean) => {
      api("/api/settings/sources/" + encodeURIComponent(source), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
        .then(() => {
          setStatus("Updated " + source + " state.", "ok");
          loadSourceSettings();
        })
        .catch((err) => {
          setStatus(err?.message || "Failed to update source", "err");
        });
    },
    [setStatus, loadSourceSettings],
  );

  const handleEditClick = useCallback(
    (source: string) => {
      if (editingSource === source) {
        setEditingSource(null);
        return;
      }
      const s = sources.find((item) => item.source === source);
      setEditMode(s?.mode || "local_files");
      setEditPath(s?.path || "");
      setEditingSource(source);
    },
    [editingSource, sources],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingSource(null);
  }, []);

  const handleSaveConfig = useCallback(
    (source: string) => {
      api("/api/settings/sources/" + encodeURIComponent(source), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: editMode, path: editPath }),
      })
        .then(() => {
          setStatus("Saved config for " + source + ".", "ok");
          showToast("Configuration saved");
          setEditingSource(null);
          loadSourceSettings();
        })
        .catch((err) => {
          setStatus(err?.message || "Failed to save source config", "err");
        });
    },
    [editMode, editPath, setStatus, loadSourceSettings],
  );

  return (
    <>
      <div className="settings-page">
        <main className="main">
          <Link className="back-link" to="/">
            &larr; Back
          </Link>
          <h1 className="page-title">Advanced</h1>
          <p className="page-sub">
            Data source paths and low-frequency local configuration. Daily sync
            runs from Home.
          </p>

          <div className={`status${statusKind ? " " + statusKind : ""}`}>
            {statusText}
          </div>

          <section>
            <div className="section-head">
              <h2 className="section-title">Connected Tools</h2>
              <span className="count-chip">
                {formatNumber(activeSources)} enabled
              </span>
            </div>

            <div className="source-list">
              {sources.length === 0 && (
                <div className="section-card">
                  <div className="muted">No source configuration available.</div>
                </div>
              )}
              {sources.map((s) => {
                const label = s.label || SOURCE_LABELS[s.source] || s.source;
                const kind = MODE_LABELS[s.mode] || s.mode;
                const icon = label ? label.charAt(0).toUpperCase() : "?";
                const isEditing = editingSource === s.source;

                return (
                  <div
                    key={s.source}
                    className={`source-card${s.enabled ? "" : " disabled"}`}
                  >
                    <div className="source-top">
                      <div className="source-main">
                        <div className="source-icon">{icon}</div>
                        <div>
                          <div className="source-title-row">
                            <span className="source-title">{escapeHtml(label)}</span>
                            <span className="source-kind">{escapeHtml(kind)}</span>
                          </div>
                          <div className="source-path">
                            {s.path || ""}
                          </div>
                        </div>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          onChange={(e) =>
                            handleToggle(s.source, e.target.checked)
                          }
                        />
                        <span className="slider" />
                      </label>
                    </div>

                    <div className="source-meta">
                      <span>{formatNumber(s.session_count)} sessions</span>
                      <span>{formatNumber(s.message_count)} messages</span>
                      <span>
                        Last active: {timeAgo(s.last_activity_at ?? undefined) || "never"}
                      </span>
                    </div>

                    <div className="source-actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleEditClick(s.source)}
                      >
                        Edit
                      </button>
                    </div>

                    {isEditing && (
                      <div className="source-config">
                        <select
                          value={editMode}
                          onChange={(e) => setEditMode(e.target.value)}
                        >
                          <option value="local_files">Local Files</option>
                          <option value="file_import">File Import</option>
                          <option value="api">API</option>
                        </select>
                        <input
                          type="text"
                          value={editPath}
                          onChange={(e) => setEditPath(e.target.value)}
                          placeholder="Source path"
                        />
                        <div className="row" style={{ marginTop: 0 }}>
                          <button
                            type="button"
                            className="btn primary"
                            onClick={() => handleSaveConfig(s.source)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="section-card">
              <h3>Insights API</h3>
              <div className="muted">{insightsApiStatus}</div>
              <div className="row">
                <Link to="/insights/new">Open Insights Setup</Link>
              </div>
            </div>

            <div className="footer-note">
              Supported: Cursor IDE, GitHub Copilot, Cursor CLI, Claude Code,
              Codex, Gemini.
            </div>
          </section>
        </main>
      </div>
      <Toast />
    </>
  );
}
