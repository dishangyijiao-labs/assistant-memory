import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { SOURCE_LABELS, formatNumber, timeAgo } from "../format";
import { showToast } from "../components/Toast";
import Toast from "../components/Toast";
import "../styles/settings.css";

type Section = "mcp" | "sources";

const MODE_LABELS: Record<string, string> = {
  local_files: "Local Files",
  file_import: "File Import",
  api: "API",
};

/* ---------- MCP types ---------- */
interface McpClient {
  id: string;
  name: string;
  installed: boolean;
  last_used_at: number | null;
  call_count: number;
}
interface McpData {
  clients: McpClient[];
  usage: {
    last_client: string | null;
    last_tool: string | null;
    last_used_at: number | null;
  };
}

/* ---------- Sources types ---------- */
interface SourceEntry {
  source: string;
  label?: string;
  enabled: boolean;
  mode: string;
  path: string;
  session_count: number;
  message_count: number;
  last_activity_at?: number | null;
}
interface SourcesPayload {
  sources: SourceEntry[];
  summary: { active_sources: number };
}

/* ================================================================
   MCP Panel
   ================================================================ */
function McpPanel() {
  const [data, setData] = useState<McpData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(() => {
    api<McpData>("/api/mcp").then(setData).catch((e) => setError(e?.message || "Failed to load"));
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = useCallback(async (clientId: string, action: "install" | "remove") => {
    setBusy(clientId);
    setTestResult(null);
    try {
      await api(`/api/mcp/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }, [load]);

  const doTest = useCallback(async () => {
    setBusy("test");
    try {
      const r = await api<{ ok: boolean; message: string }>("/api/mcp/test", { method: "POST" });
      setTestResult(r);
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setBusy(null);
    }
  }, []);

  if (error) return <div className="panel-error">{error}</div>;
  if (!data) return <div className="panel-loading">Loading…</div>;

  const anyInstalled = data.clients.some((c) => c.installed);

  return (
    <div className="mcp-panel">
      <h2 className="panel-title">MCP Server</h2>

      {/* Enable row */}
      <div className="mcp-row mcp-enable-row">
        <span className="mcp-row-label">Enable AssistMem MCP</span>
        <span className={`mcp-readiness ${anyInstalled ? "ready" : ""}`}>
          {anyInstalled ? "Ready" : "Not configured"}
        </span>
      </div>

      {/* Client rows */}
      {data.clients.map((c) => (
        <div key={c.id} className="mcp-row">
          <span className="mcp-row-label">{c.name}</span>
          <div className="mcp-row-actions">
            {c.installed ? (
              <>
                <button type="button" className="s-btn" disabled={busy === c.id} onClick={() => doAction(c.id, "install")}>Update</button>
                <button type="button" className="s-btn danger" disabled={busy === c.id} onClick={() => doAction(c.id, "remove")}>Remove</button>
              </>
            ) : (
              <button type="button" className="s-btn primary" disabled={busy === c.id} onClick={() => doAction(c.id, "install")}>Install</button>
            )}
          </div>
        </div>
      ))}

      <hr className="mcp-divider" />

      {/* Last used */}
      {data.usage.last_used_at && (
        <div className="mcp-row mcp-meta-row">
          <span className="mcp-row-label muted">Last used</span>
          <span className="muted">
            {data.usage.last_client ?? "unknown"} · {timeAgo(data.usage.last_used_at)}
          </span>
        </div>
      )}

      {/* Test */}
      <div className="mcp-test">
        <button type="button" className="s-btn" disabled={busy === "test"} onClick={doTest}>Test Connection</button>
        {testResult && (
          <span className={`mcp-test-result ${testResult.ok ? "ok" : "fail"}`}>{testResult.message}</span>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   Data Sources Panel
   ================================================================ */
function SourcesPanel() {
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editMode, setEditMode] = useState("local_files");
  const [editPath, setEditPath] = useState("");

  const load = useCallback(() => {
    api<SourcesPayload>("/api/settings/sources")
      .then((p) => setSources(p.sources || []))
      .catch((e) => setError(e?.message || "Failed to load"));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = useCallback((source: string, enabled: boolean) => {
    api("/api/settings/sources/" + encodeURIComponent(source), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).then(() => load()).catch((e) => setError(e?.message || "Toggle failed"));
  }, [load]);

  const handleEditClick = useCallback((source: string) => {
    if (editingSource === source) { setEditingSource(null); return; }
    const s = sources.find((i) => i.source === source);
    setEditMode(s?.mode || "local_files");
    setEditPath(s?.path || "");
    setEditingSource(source);
  }, [editingSource, sources]);

  const handleSave = useCallback((source: string) => {
    api("/api/settings/sources/" + encodeURIComponent(source), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: editMode, path: editPath }),
    }).then(() => { showToast("Configuration saved"); setEditingSource(null); load(); })
      .catch((e) => setError(e?.message || "Save failed"));
  }, [editMode, editPath, load]);

  const handleSync = useCallback(() => {
    setSyncing(true);
    api("/api/index", { method: "POST" })
      .then(() => { showToast("Sync complete"); load(); })
      .catch((e) => setError(e?.message || "Sync failed"))
      .finally(() => setSyncing(false));
  }, [load]);

  if (error) return <div className="panel-error">{error}</div>;

  return (
    <div className="sources-panel">
      <h2 className="panel-title">Data Sources</h2>

      <div className="src-list">
        {sources.map((s) => {
          const label = s.label || SOURCE_LABELS[s.source] || s.source;
          const isEditing = editingSource === s.source;

          return (
            <div key={s.source} className={`src-row${s.enabled ? "" : " off"}`}>
              <div className="src-row-top">
                <span className="src-name">{label}</span>
                <div className="src-right">
                  <label className="toggle">
                    <input type="checkbox" checked={s.enabled} onChange={(e) => handleToggle(s.source, e.target.checked)} />
                    <span className="toggle-track" />
                  </label>
                </div>
              </div>
              <div className="src-row-meta">
                <span className="muted">{formatNumber(s.message_count)} messages</span>
                <button type="button" className="src-edit-btn" onClick={() => handleEditClick(s.source)}>Edit</button>
              </div>

              {isEditing && (
                <div className="src-config">
                  <select value={editMode} onChange={(e) => setEditMode(e.target.value)}>
                    {Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="text" value={editPath} onChange={(e) => setEditPath(e.target.value)} placeholder="Source path" />
                  <div className="src-config-actions">
                    <button type="button" className="s-btn primary" onClick={() => handleSave(s.source)}>Save</button>
                    <button type="button" className="s-btn" onClick={() => setEditingSource(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="src-footer">
        <button type="button" className="s-btn" disabled={syncing} onClick={handleSync}>
          {syncing ? "Syncing…" : "Sync Enabled Now"}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   Settings Page (unified shell)
   ================================================================ */
export default function SettingsPage() {
  const [section, setSection] = useState<Section>("mcp");

  return (
    <>
      <div className="settings-page">
        <Link className="back-link" to="/">&larr; Back</Link>
        <div className="settings-shell">
          <nav className="settings-nav">
            <h1 className="nav-title">Settings</h1>
            <ul>
              <li><button type="button" className={section === "mcp" ? "active" : ""} onClick={() => setSection("mcp")}>MCP</button></li>
              <li><button type="button" className={section === "sources" ? "active" : ""} onClick={() => setSection("sources")}>Data Sources</button></li>
            </ul>
          </nav>
          <main className="settings-detail">
            {section === "mcp" && <McpPanel />}
            {section === "sources" && <SourcesPanel />}
          </main>
        </div>
      </div>
      <Toast />
    </>
  );
}
