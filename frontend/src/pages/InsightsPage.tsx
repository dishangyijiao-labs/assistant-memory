import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { SOURCE_LABELS, formatTime, timeAgo, formatNumber } from "../format";
import { showToast } from "../components/Toast";
import Toast from "../components/Toast";
import "../styles/insights.css";
import type { Report, Candidate, PlanItem, ModelSettings, InsightState, ModelState } from "../features/insights/types";
import { MIN_INSIGHT_TOTAL_MESSAGES, MIN_INSIGHT_USER_MESSAGES, TABS, SOURCE_FILTER_KEYS } from "../features/insights/constants";
import { safeText, sessionDisplayName, normalizeModelSettings, scoreLevel, sampleWarning } from "../features/insights/helpers";
import { renderDetailTab } from "../features/insights/tab-renderers";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InsightsPage() {
  const location = useLocation();
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // Determine view
  const view = location.pathname === "/insights/new"
    ? "new"
    : params.id
      ? "detail"
      : "list";
  const detailId = params.id ? parseInt(params.id, 10) || 0 : 0;

  // State
  const [insightState, setInsightState] = useState<InsightState>({
    candidates: [],
    selected: new Set(),
    sourceFilter: "all",
    tab: "at_a_glance",
    currentReport: null,
  });

  const [modelState, setModelState] = useState<ModelState>({
    settings: {
      mode_default: "local",
      external_enabled: false,
      provider: "openai-compatible",
      base_url: "https://api.openai.com/v1",
      model_name: "",
      api_key: "",
    },
    hasApiKey: false,
  });

  const [statusMsg, setStatusMsg] = useState("");
  const [statusKind, setStatusKind] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState({ total_reports: 0, sessions_analyzed: 0, messages_analyzed: 0 });
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [detailTabContent, setDetailTabContent] = useState("");

  // Refs for model form fields
  const modeRef = useRef<HTMLSelectElement>(null);
  const providerRef = useRef<HTMLInputElement>(null);
  const baseUrlRef = useRef<HTMLInputElement>(null);
  const modelNameRef = useRef<HTMLInputElement>(null);
  const apiKeyRef = useRef<HTMLInputElement>(null);

  const status = useCallback((msg: string, kind?: string) => {
    setStatusMsg(msg);
    setStatusKind(kind || "");
  }, []);

  // ---- Model helpers ----
  const getModelMode = useCallback((): string => {
    const el = modeRef.current;
    if (el?.value) {
      if (el.value === "agent") return "agent";
      if (el.value === "external") return "external";
      return "local";
    }
    const md = modelState.settings.mode_default;
    return md === "agent" ? "agent" : md === "external" ? "external" : "local";
  }, [modelState.settings.mode_default]);

  const getRuntimeApiKey = useCallback((): string => {
    return (apiKeyRef.current?.value || "").trim();
  }, []);

  const hasEffectiveApiKey = useCallback((): boolean => {
    return modelState.hasApiKey || getRuntimeApiKey().length > 0;
  }, [modelState.hasApiKey, getRuntimeApiKey]);

  const isModelReadyForGeneration = useCallback((): boolean => {
    const mode = getModelMode();
    return (mode !== "external" && mode !== "agent") || hasEffectiveApiKey();
  }, [getModelMode, hasEffectiveApiKey]);

  const getModelPayload = useCallback(() => {
    return {
      mode: getModelMode(),
      provider: (providerRef.current?.value || "").trim(),
      base_url: (baseUrlRef.current?.value || "").trim(),
      model_name: (modelNameRef.current?.value || "").trim(),
      api_key: getRuntimeApiKey(),
    };
  }, [getModelMode, getRuntimeApiKey]);

  const getModelHint = useCallback((): { cls: string; text: string } => {
    const mode = getModelMode();
    if ((mode === "external" || mode === "agent") && !hasEffectiveApiKey()) {
      return { cls: "model-hint err", text: "API key is missing. Add a runtime key or switch to Local Analysis." };
    }
    if (mode === "agent") {
      return { cls: "model-hint ok", text: "Agent mode: LLM can call tools (search, get session, RAG) to generate targeted insights." };
    }
    if (mode === "external") {
      return { cls: "model-hint ok", text: "External model is ready. You can generate insights now." };
    }
    return { cls: "model-hint", text: "Local Analysis mode uses built-in heuristics and does not require an external API key." };
  }, [getModelMode, hasEffectiveApiKey]);

  // ---- API calls ----
  const loadModelConfig = useCallback(() => {
    return api<{ settings?: Partial<ModelSettings>; has_api_key?: boolean }>("/api/settings/model")
      .then((data) => {
        setModelState({
          settings: normalizeModelSettings(data.settings || null),
          hasApiKey: !!data.has_api_key,
        });
      })
      .catch((err) => {
        status(err.message || "Failed to load model settings", "err");
      });
  }, [status]);

  const saveModelConfig = useCallback(() => {
    const payload = getModelPayload();
    const needsApi = payload.mode === "external" || payload.mode === "agent";
    if (needsApi && (!payload.provider || !payload.base_url || !payload.model_name)) {
      status("Provider, Base URL, and Model Name are required for external/agent mode.", "err");
      return;
    }
    status("Saving model settings...", "warn");
    api<{ settings?: Partial<ModelSettings>; has_api_key?: boolean }>("/api/settings/model", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode_default: payload.mode,
        external_enabled: payload.mode === "external" || payload.mode === "agent",
        provider: payload.provider,
        base_url: payload.base_url,
        model_name: payload.model_name,
        api_key: payload.api_key,
      }),
    }).then((data) => {
      setModelState({
        settings: normalizeModelSettings(data.settings || null),
        hasApiKey: !!data.has_api_key,
      });
      status("Model settings saved.", "ok");
    }).catch((err) => {
      status(err.message || "Failed to save model settings", "err");
    });
  }, [getModelPayload, status]);

  const testModelConfig = useCallback(() => {
    const payload = getModelPayload();
    if (payload.mode !== "external" && payload.mode !== "agent") {
      status("Local mode does not require external connection testing.", "ok");
      return;
    }
    if (!payload.provider || !payload.base_url || !payload.model_name) {
      status("Provider, Base URL, and Model Name are required for external mode.", "err");
      return;
    }
    if (!hasEffectiveApiKey()) {
      status("External model API key is missing.", "err");
      apiKeyRef.current?.focus();
      return;
    }
    status("Testing model connection...", "warn");
    api<{ message?: string }>("/api/model/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: payload.provider,
        base_url: payload.base_url,
        model_name: payload.model_name,
        external_enabled: true,
        api_key: payload.api_key,
      }),
    }).then((out) => {
      status(out.message || "Connection successful.", "ok");
    }).catch((err) => {
      status(err.message || "Connection test failed", "err");
    });
  }, [getModelPayload, hasEffectiveApiKey, status]);

  const loadListPage = useCallback(() => {
    status("Loading reports...", "warn");
    Promise.all([
      api<{ reports?: Report[]; summary?: typeof summary }>("/api/insights?limit=50"),
      api<{ items?: PlanItem[] }>("/api/insights/tomorrow-plan?limit=3"),
    ]).then(([data, planData]) => {
      const s = data.summary || { total_reports: 0, sessions_analyzed: 0, messages_analyzed: 0 };
      setReports(data.reports || []);
      setSummary(s);
      setPlanItems(Array.isArray(planData.items) ? planData.items : []);
      status("Loaded report history.", "ok");
    }).catch((err) => {
      status(err.message || "Failed to load reports", "err");
    });
  }, [status]);

  const loadCandidates = useCallback(() => {
    status("Loading candidate sessions...", "warn");
    return api<{ sessions?: Candidate[] }>("/api/insights/candidates?limit=120")
      .then((data) => {
        setInsightState((prev) => ({ ...prev, candidates: data.sessions || [] }));
        status("Select sessions to generate a report.", "ok");
      })
      .catch((err) => {
        status(err.message || "Failed to load candidates", "err");
      });
  }, [status]);

  const loadDetailPage = useCallback((id: number, tab: string) => {
    status("Loading report...", "warn");
    api<{ report?: Report }>("/api/insights/" + id)
      .then((data) => {
        const report = (data.report || {}) as Report;
        const details = (report.details || {}) as Record<string, any>;
        setInsightState((prev) => ({ ...prev, currentReport: report, tab }));
        setDetailTabContent(renderDetailTab(tab, report, details));
        status("Loaded report #" + id, "ok");
      })
      .catch((err) => {
        status(err.message || "Failed to load report", "err");
        setDetailTabContent('<div class="empty">Unable to load this report.</div>');
      });
  }, [status]);

  const deleteReport = useCallback((id: number) => {
    if (!window.confirm("Delete this report permanently?")) return;
    status("Deleting report...", "warn");
    api("/api/insights/" + id, { method: "DELETE" })
      .then(() => {
        status("Report deleted.", "ok");
        loadListPage();
      })
      .catch((err) => {
        status(err.message || "Failed to delete report", "err");
      });
  }, [status, loadListPage]);

  const togglePlanItem = useCallback((planId: string, nextStatus: string) => {
    api("/api/insights/tomorrow-plan/" + encodeURIComponent(planId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    }).then(() => {
      showToast("Tomorrow plan updated.");
      loadListPage();
    }).catch((err) => {
      showToast(err.message || "Failed to update tomorrow plan");
    });
  }, [loadListPage]);

  const deletePlanItem = useCallback((planId: string) => {
    if (!window.confirm("Delete this tomorrow plan item?")) return;
    api("/api/insights/tomorrow-plan/" + encodeURIComponent(planId), {
      method: "DELETE",
    }).then(() => {
      showToast("Tomorrow plan item deleted.");
      loadListPage();
    }).catch((err) => {
      showToast(err.message || "Failed to delete tomorrow plan item");
    });
  }, [loadListPage]);

  const addTomorrowPlan = useCallback((action: string, reportId: number | null) => {
    if (!action) {
      showToast("Missing action text.");
      return;
    }
    api<{ deduped?: boolean }>("/api/insights/tomorrow-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, source_report_id: reportId }),
    }).then((out) => {
      showToast(out.deduped ? "Already in tomorrow plan." : "Added to tomorrow plan.");
    }).catch((err) => {
      showToast(err.message || "Failed to add tomorrow plan");
    });
  }, []);

  const generateReport = useCallback(() => {
    const ids = Array.from(insightState.selected);
    if (!ids.length) return;
    const selectedRows = insightState.candidates.filter((item) => insightState.selected.has(item.id));
    const estimatedTotalMessages = selectedRows.reduce((sum, item) => sum + Number(item.message_count || 0), 0);
    const estimatedUserMessages = Math.floor(estimatedTotalMessages / 2);
    if (estimatedTotalMessages < MIN_INSIGHT_TOTAL_MESSAGES || estimatedUserMessages < MIN_INSIGHT_USER_MESSAGES) {
      status(
        "Sample too small for reliable insights. Need at least " +
          MIN_INSIGHT_TOTAL_MESSAGES + " total messages and " +
          MIN_INSIGHT_USER_MESSAGES + " user messages (estimated).",
        "err"
      );
      return;
    }
    if (!isModelReadyForGeneration()) {
      status("External model API key is missing. Configure it in the panel above before generating.", "err");
      apiKeyRef.current?.focus();
      return;
    }
    const payload = getModelPayload();
    status("Generating report...", "warn");
    setGenerating(true);
    api<{ report_id?: number }>("/api/insights/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_ids: ids, model: payload }),
    }).then((out) => {
      status("Report generated.", "ok");
      if (out.report_id) {
        navigate("/insights/" + out.report_id);
      } else {
        navigate("/insights");
      }
    }).catch((err: any) => {
      if (err?.code === "INSIGHTS_SAMPLE_TOO_SMALL") {
        status(err.message || "Sample too small for reliable insights.", "err");
      } else if (err?.code === "INSIGHTS_MODEL_NOT_CONFIGURED") {
        status("Model API not configured. Set an API key or switch to Local Analysis.", "err");
        apiKeyRef.current?.focus();
      } else {
        status(err.message || "Failed to generate report", "err");
      }
    }).finally(() => setGenerating(false));
  }, [insightState.selected, insightState.candidates, isModelReadyForGeneration, getModelPayload, status, navigate]);

  // Toggle candidate selection
  const toggleCandidate = useCallback((id: number) => {
    setInsightState((prev) => {
      const next = new Set(prev.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, selected: next };
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setInsightState((prev) => {
      const filtered = prev.candidates.filter((item) =>
        prev.sourceFilter === "all" || item.source === prev.sourceFilter
      );
      const allSelected = filtered.length > 0 && filtered.every((item) => prev.selected.has(item.id));
      const next = new Set(prev.selected);
      if (allSelected) {
        filtered.forEach((item) => next.delete(item.id));
      } else {
        filtered.forEach((item) => next.add(item.id));
      }
      return { ...prev, selected: next };
    });
  }, []);

  const setSourceFilter = useCallback((filter: string) => {
    setInsightState((prev) => ({ ...prev, sourceFilter: filter }));
  }, []);

  const setTab = useCallback((tab: string) => {
    if (view === "detail" && detailId > 0) {
      loadDetailPage(detailId, tab);
    }
  }, [view, detailId, loadDetailPage]);

  // ---- Effects ----
  useEffect(() => {
    if (view === "list") {
      loadListPage();
    } else if (view === "new") {
      loadModelConfig();
      loadCandidates();
    } else if (view === "detail" && detailId > 0) {
      loadDetailPage(detailId, insightState.tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, detailId]);

  // Handle click delegation for copy buttons and add-to-tomorrow in detail HTML
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Copy button
    const copyBtn = target.closest(".copy-btn") as HTMLElement | null;
    if (copyBtn) {
      const parent = copyBtn.parentElement;
      if (parent) {
        const text = parent.textContent ? parent.textContent.replace("\u29C9", "").trim() : "";
        if (text && navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => showToast("Copied."));
        }
      }
      return;
    }
    // Add to tomorrow plan button
    const addBtn = target.closest("[data-add-tomorrow]") as HTMLElement | null;
    if (addBtn) {
      const action = addBtn.getAttribute("data-action") || "";
      const reportId = parseInt(addBtn.getAttribute("data-report-id") || "0", 10) || null;
      addTomorrowPlan(action, reportId);
      return;
    }
  }, [addTomorrowPlan]);

  // Computed values for new page
  const selectedCount = insightState.selected.size;
  const selectedMessageCount = (() => {
    const map = new Map(insightState.candidates.map((c) => [c.id, c]));
    let total = 0;
    insightState.selected.forEach((id) => {
      const row = map.get(id);
      if (row) total += row.message_count || 0;
    });
    return total;
  })();

  const filteredCandidates = insightState.candidates.filter((item) =>
    insightState.sourceFilter === "all" || item.source === insightState.sourceFilter
  );

  const mode = modelState.settings.mode_default === "agent" ? "agent" : modelState.settings.mode_default === "external" ? "external" : "local";
  const isExternalMode = mode === "external" || mode === "agent";
  const modelHint = getModelHint();

  /* ================================================================ */
  /*  LIST VIEW                                                        */
  /* ================================================================ */
  if (view === "list") {
    return (
      <div className="insights-page">
        <main className="main">
          <div className="topbar">
            <div className="breadcrumbs">
              <Link to="/">&larr; Back</Link>
              <span>|</span>
              <span className="metric-strong">Insights Reports</span>
            </div>
          </div>
          <div className="content">
            <div className={`status ${statusKind}`}>{statusMsg}</div>
            <div className="reports-head">
              <div>
                <div style={{ fontSize: "1.7rem", fontWeight: 700, lineHeight: 1.1 }}>Report History</div>
                <p className="subtitle" style={{ marginTop: "0.4rem" }}>
                  Select sessions, generate targeted insights reports, and review your history.
                </p>
              </div>
              <button className="btn-primary" type="button" onClick={() => navigate("/insights/new")}>
                + New Report
              </button>
            </div>

            {/* Tomorrow plan */}
            <div className="plan-panel">
              <div className="plan-head">
                <h3>Tomorrow Plan</h3>
                <span className="plan-count">{formatNumber(planItems.length)} item(s)</span>
              </div>
              {planItems.length === 0 ? (
                <div className="plan-empty">No items yet. Add action items from report details.</div>
              ) : (
                planItems.map((item) => {
                  const done = item.status === "done";
                  return (
                    <div key={item.id} className={`plan-item${done ? " done" : ""}`}>
                      <div className="plan-main">
                        <div className="plan-action">{item.action}</div>
                        <div className="plan-meta">
                          {formatTime(item.created_at)}
                          {item.source_report_id ? (
                            <Link className="plan-link" to={"/insights/" + item.source_report_id}>
                              View source report
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      <div className="plan-actions">
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => togglePlanItem(item.id, done ? "open" : "done")}
                        >
                          {done ? "Reopen" : "Done"}
                        </button>
                        <button
                          type="button"
                          className="delete-btn"
                          title="Delete"
                          onClick={() => deletePlanItem(item.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Summary grid */}
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-value">{formatNumber(summary.total_reports)}</div>
                <div className="summary-label">Total Reports</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">{formatNumber(summary.sessions_analyzed)}</div>
                <div className="summary-label">Sessions Analyzed</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">{formatNumber(summary.messages_analyzed)}</div>
                <div className="summary-label">Messages Analyzed</div>
              </div>
            </div>

            {/* Report cards */}
            {reports.length === 0 ? (
              <div className="empty">No reports yet. Click "New Report" to generate your first insight report.</div>
            ) : (
              reports.map((r) => {
                const tags = Array.isArray(r.sources) ? r.sources : [];
                return (
                  <div key={r.id} className="report-card">
                    <div>
                      <div className="report-title">{r.title || "Report #" + r.id}</div>
                      <div className="report-meta">
                        {formatTime(r.created_at)} &middot; {formatNumber(r.session_count || 0)} sessions &middot; {formatNumber(r.message_count || 0)} messages
                      </div>
                      <div className="tag-row">
                        {tags.map((t) => (
                          <span key={t} className="tag">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="report-actions">
                      <button className="btn-ghost" type="button" onClick={() => navigate("/insights/" + r.id)}>
                        View
                      </button>
                      <button className="delete-btn" type="button" title="Delete" onClick={() => deleteReport(r.id)}>
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
        <Toast />
      </div>
    );
  }

  /* ================================================================ */
  /*  NEW REPORT VIEW                                                  */
  /* ================================================================ */
  if (view === "new") {
    return (
      <div className="insights-page">
        <main className="main">
          <div className="topbar">
            <div className="breadcrumbs">
              <Link to="/insights">&larr; Cancel</Link>
              <span>|</span>
              <span className="metric-strong">Select Sessions</span>
            </div>
          </div>
          <div className="content">
            <div className={`status ${statusKind}`}>{statusMsg}</div>

            {/* Model config panel */}
            <div className="model-config-card">
              <div className="model-head">
                <div className="model-title">Model Configuration</div>
                <span className={modelState.hasApiKey ? "model-badge ok" : "model-badge"}>
                  {modelState.hasApiKey ? "API key configured" : "No API key configured"}
                </span>
              </div>
              <div className="model-grid">
                <div className="model-field">
                  <label htmlFor="model-mode">Mode</label>
                  <select
                    id="model-mode"
                    ref={modeRef}
                    defaultValue={mode}
                    onChange={(e) => {
                      const v = e.target.value;
                      setModelState((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, mode_default: v === "agent" ? "agent" : v === "external" ? "external" : "local" },
                      }));
                    }}
                  >
                    <option value="local">Local Analysis (no external API)</option>
                    <option value="external">External API</option>
                    <option value="agent">Agent (tool calling)</option>
                  </select>
                </div>
                <div className="model-field">
                  <label htmlFor="model-provider">Provider</label>
                  <input
                    id="model-provider"
                    ref={providerRef}
                    type="text"
                    defaultValue={modelState.settings.provider}
                    disabled={!isExternalMode}
                  />
                </div>
                <div className="model-field">
                  <label htmlFor="model-base-url">Base URL</label>
                  <input
                    id="model-base-url"
                    ref={baseUrlRef}
                    type="text"
                    defaultValue={modelState.settings.base_url}
                    disabled={!isExternalMode}
                  />
                </div>
                <div className="model-field">
                  <label htmlFor="model-name">Model Name</label>
                  <input
                    id="model-name"
                    ref={modelNameRef}
                    type="text"
                    defaultValue={modelState.settings.model_name}
                    disabled={!isExternalMode}
                  />
                </div>
              </div>
              <div className="model-grid two">
                <div className="model-field">
                  <label htmlFor="model-api-key">API Key (saved locally)</label>
                  <input
                    id="model-api-key"
                    ref={apiKeyRef}
                    type="password"
                    defaultValue={modelState.settings.api_key}
                    placeholder="Saved in local app database"
                    disabled={!isExternalMode}
                  />
                </div>
                <div className="model-actions">
                  <button className="btn-ghost" type="button" onClick={saveModelConfig}>Save Settings</button>
                  <button className="btn-ghost" type="button" onClick={testModelConfig}>Test Connection</button>
                  <Link to="/advanced" className="btn-ghost" style={{ textDecoration: "none" }}>Advanced</Link>
                </div>
              </div>
              <p className="model-note">API key is stored locally on this machine for persistence. For production, env-based key management is still recommended.</p>
              <div className={modelHint.cls}>{modelHint.text}</div>
            </div>

            {/* Selection header */}
            <div className="reports-head">
              <div className="metric-strong">
                {selectedCount} sessions selected &nbsp; {formatNumber(selectedMessageCount)} messages total
              </div>
              <button
                className="btn-primary"
                type="button"
                disabled={selectedCount === 0 || !isModelReadyForGeneration() || generating}
                onClick={generateReport}
              >
                {generating ? "Generating..." : "\u26A1 Generate Report"}
              </button>
            </div>

            {/* Source filter tabs */}
            <div className="select-toolbar">
              <div className="source-tabs">
                {SOURCE_FILTER_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`source-tab${key === insightState.sourceFilter ? " active" : ""}`}
                    onClick={() => setSourceFilter(key)}
                  >
                    {key === "all" ? "All" : (SOURCE_LABELS[key] || key)}
                  </button>
                ))}
              </div>
              <button className="select-all" type="button" onClick={toggleSelectAll}>
                Select All
              </button>
            </div>

            {/* Candidate list */}
            {filteredCandidates.length === 0 ? (
              <div className="empty">No candidate sessions in current filter.</div>
            ) : (
              filteredCandidates.map((item) => {
                const checked = insightState.selected.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`candidate-card${checked ? " selected" : ""}`}
                    onClick={() => toggleCandidate(item.id)}
                  >
                    <input
                      className="candidate-check"
                      type="checkbox"
                      checked={checked}
                      readOnly
                    />
                    <div>
                      <div className="candidate-title">{sessionDisplayName(item)}</div>
                      <div className="candidate-meta">
                        <span>{SOURCE_LABELS[item.source] || item.source}</span>
                        <span>{timeAgo(item.last_at)}</span>
                      </div>
                    </div>
                    <div className="candidate-count">
                      <div className="metric-strong">{formatNumber(item.message_count || 0)}</div>
                      <div>messages</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
        <Toast />
      </div>
    );
  }

  /* ================================================================ */
  /*  DETAIL VIEW                                                      */
  /* ================================================================ */
  const report = insightState.currentReport;
  const reportTitle = safeText(report?.title || "Insight Report");

  return (
    <div className="insights-page">
      <main className="main">
        <div className="topbar">
          <div className="breadcrumbs">
            <Link to="/insights">&larr; All Reports</Link>
            <span>|</span>
            <span className="metric-strong">{reportTitle}</span>
          </div>
        </div>

        {report && (
          <>
            <div className="metrics-strip">
              <span>
                {formatNumber(report.message_count || 0)} messages across {formatNumber(report.session_count || 0)} sessions
              </span>
              <span>|</span>
              <span>Generated {formatTime(report.created_at)}</span>
              <span className="mobile-hidden">
                &#9634; <span className="metric-strong">{formatNumber(report.message_count || 0)}</span> Messages
              </span>
              <span className="mobile-hidden">
                &#9634; <span className="metric-strong">{formatNumber(report.snippet_count || 0)}</span> Snippets
              </span>
              <span className="mobile-hidden">
                &#9634; <span className="metric-strong">{formatNumber(report.session_count || 0)}</span> Sessions
              </span>
              <span className="mobile-hidden">
                &#9889; <span className="metric-strong">
                  {report.session_count ? (report.message_count! / report.session_count).toFixed(1) : "0.0"}
                </span> Msgs/Session
              </span>
            </div>

            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`tab${t.key === insightState.tab ? " active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="content" onClick={handleContentClick}>
          <div className={`status ${statusKind}`}>{statusMsg}</div>
          <div dangerouslySetInnerHTML={{ __html: detailTabContent }} />
        </div>
      </main>
      <Toast />
    </div>
  );
}
