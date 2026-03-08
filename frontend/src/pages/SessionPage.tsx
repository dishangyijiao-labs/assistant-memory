import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { showToast } from "../components/Toast";
import Toast from "../components/Toast";
import {
  SOURCE_LABELS,
  escapeHtml,
  formatTime,
  getDateKey,
  formatDateLabel,
} from "../format";
import { renderMarkdown } from "../markdown";
import "../styles/session.css";

interface Session {
  id: number;
  source: string;
  workspace?: string;
  last_at?: number;
  message_count?: number;
}

interface Message {
  id: number;
  role: string;
  content: string;
  timestamp?: number;
}

interface QualityScore {
  score?: number;
  grade?: string;
  deductions?: Array<{ reason?: string; code?: string; points?: number }>;
  missing_info_checklist?: string[];
  tags?: string[];
  rewrites?: { short?: string; engineering?: string; exploratory?: string };
}

export default function SessionPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const highlightMessageId = searchParams.get("message_id");

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [qualityScores, setQualityScores] = useState<Record<number, QualityScore>>({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState<{ text: string; kind: string; html?: string }>({
    text: "",
    kind: "",
  });
  const [openPanels, setOpenPanels] = useState<Set<number>>(new Set());

  const loadSession = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    api<{
      session?: Session;
      messages?: Message[];
      quality_scores?: Record<number, QualityScore>;
    }>(
      "/api/session?session_id=" + encodeURIComponent(sessionId) + "&order=asc&limit=5000",
    )
      .then((data) => {
        setSession(data.session || null);
        setMessages(data.messages || []);
        setQualityScores(data.quality_scores || {});
      })
      .catch(() => {
        setSession(null);
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Scroll to highlighted message
  useEffect(() => {
    if (!highlightMessageId || loading) return;
    setTimeout(() => {
      const target = document.querySelector(
        `.message[data-message-id="${highlightMessageId}"]`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [highlightMessageId, loading]);

  const runAnalyze = useCallback(() => {
    if (!session || analyzing) return;
    setAnalyzing(true);
    setAnalyzeStatus({ text: "Running quality analysis...", kind: "" });
    api<{ analyzed?: number }>("/api/quality/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.id }),
    })
      .then((result) => {
        setAnalyzeStatus({ text: "Done. Refreshing...", kind: "ok" });
        setTimeout(() => loadSession(), 600);
      })
      .catch((err) => {
        const msg = err?.message || "Analysis failed.";
        const needsApiKey =
          err?.code === "QUALITY_MODEL_NOT_CONFIGURED" || /api key/i.test(msg);
        if (needsApiKey) {
          setAnalyzeStatus({
            text: msg,
            kind: "error",
            html: `${escapeHtml(msg)} <a href="/insights/new">Configure API key</a>`,
          });
        } else {
          setAnalyzeStatus({ text: msg, kind: "error" });
        }
      })
      .finally(() => setAnalyzing(false));
  }, [session, analyzing, loadSession]);

  const toggleQualityPanel = useCallback((msgId: number) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const copyRewrite = useCallback((text: string, btn: HTMLButtonElement) => {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = orig;
      }, 800);
    });
  }, []);

  // Handle tool block toggle via delegation
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const header = target.closest(".tool-block-header") as HTMLElement | null;
      if (header) {
        header.classList.toggle("open");
        return;
      }
      const rewriteBtn = target.closest(".rewrite-chip button") as HTMLButtonElement | null;
      if (rewriteBtn) {
        const chip = rewriteBtn.closest(".rewrite-chip");
        const src = chip?.querySelector(".copy-src");
        if (src?.textContent) copyRewrite(src.textContent, rewriteBtn);
      }
    },
    [copyRewrite],
  );

  if (!sessionId) {
    return (
      <div className="session-page">
        <div className="container">
          <div className="empty-state">Missing session_id.</div>
        </div>
      </div>
    );
  }

  const userCount = messages.filter((m) => (m.role || "").toLowerCase() === "user").length;
  const label = session ? (SOURCE_LABELS[session.source] || session.source || "?") : "";

  // Group consecutive assistant messages
  const groups: { role: string; items: Message[] }[] = [];
  for (const m of messages) {
    const role = (m.role || "assistant").toLowerCase();
    if (role === "assistant" && groups.length > 0 && groups[groups.length - 1].role === "assistant") {
      groups[groups.length - 1].items.push(m);
    } else {
      groups.push({ role, items: [m] });
    }
  }

  const buildQualityHtml = (q: QualityScore, msgId: number) => {
    const gradeClass = "grade-" + (q.grade ? q.grade.toLowerCase() : "c").charAt(0);
    const isOpen = openPanels.has(msgId);
    const deductions = Array.isArray(q.deductions) ? q.deductions : [];
    const checklist = Array.isArray(q.missing_info_checklist) ? q.missing_info_checklist : [];
    const tags = Array.isArray(q.tags) ? q.tags : [];
    const rewrites = q.rewrites || {};
    const hasRewrites = rewrites.short || rewrites.engineering || rewrites.exploratory;

    return (
      <>
        <div
          className={`quality-badge ${gradeClass}`}
          onClick={() => toggleQualityPanel(msgId)}
          title="Click to expand"
        >
          {q.score ?? "?"}&nbsp;{q.grade || "?"} {isOpen ? "\u25B4" : "\u25BE"}
        </div>
        <div className={`quality-panel${isOpen ? " open" : ""}`}>
          {deductions.length > 0 && (
            <div className="quality-section">
              <div className="quality-section-title">Score deductions</div>
              {deductions.map((d, i) => (
                <div key={i} className="deduction-row">
                  <span className="deduction-reason">{d.reason || d.code || ""}</span>
                  {d.points != null && (
                    <span className="deduction-points">-{Math.abs(d.points)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {checklist.length > 0 && (
            <div className="quality-section">
              <div className="quality-section-title">Missing information</div>
              {checklist.map((item, i) => (
                <div key={i} className="checklist-item">{item}</div>
              ))}
            </div>
          )}
          {tags.length > 0 && (
            <div className="quality-section">
              <div className="quality-section-title">Tags</div>
              <div className="tags-wrap">
                {tags.map((t, i) => (
                  <span key={i} className="tag-chip">{t}</span>
                ))}
              </div>
            </div>
          )}
          {hasRewrites && (
            <div className="quality-section">
              <div className="quality-section-title">Rewrite suggestions</div>
              <div className="rewrites">
                {rewrites.short && (
                  <div className="rewrite-chip">
                    <span className="label">Short</span>
                    <span className="text">{rewrites.short.slice(0, 60)}{rewrites.short.length > 60 ? "\u2026" : ""}</span>
                    <span className="copy-src" style={{ display: "none" }}>{rewrites.short}</span>
                    <button type="button">Copy</button>
                  </div>
                )}
                {rewrites.engineering && (
                  <div className="rewrite-chip">
                    <span className="label">Engineering</span>
                    <span className="text">{rewrites.engineering.slice(0, 60)}{rewrites.engineering.length > 60 ? "\u2026" : ""}</span>
                    <span className="copy-src" style={{ display: "none" }}>{rewrites.engineering}</span>
                    <button type="button">Copy</button>
                  </div>
                )}
                {rewrites.exploratory && (
                  <div className="rewrite-chip">
                    <span className="label">Exploratory</span>
                    <span className="text">{rewrites.exploratory.slice(0, 60)}{rewrites.exploratory.length > 60 ? "\u2026" : ""}</span>
                    <span className="copy-src" style={{ display: "none" }}>{rewrites.exploratory}</span>
                    <button type="button">Copy</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  const renderMessages = () => {
    if (loading) {
      return (
        <>
          <div className="skeleton" style={{ height: 48, width: "60%", marginBottom: "0.5rem", borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 48, width: "75%", marginBottom: "0.5rem", borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 48, width: "55%", marginBottom: "0.5rem", borderRadius: 8 }} />
        </>
      );
    }
    if (messages.length === 0) {
      return <div className="empty-state">No messages found.</div>;
    }

    const elements: React.ReactNode[] = [];
    let lastDateKey = "";

    groups.forEach((group, gi) => {
      const firstMsg = group.items[0];
      const dk = getDateKey(firstMsg.timestamp);
      if (dk !== lastDateKey) {
        elements.push(
          <div key={"date-" + dk + gi} className="date-separator">
            {formatDateLabel(firstMsg.timestamp)}
          </div>,
        );
        lastDateKey = dk;
      }

      if (group.role !== "assistant" || group.items.length === 1) {
        const m = firstMsg;
        const role = group.role;
        const roleClass = role === "user" ? "role-user" : role === "assistant" ? "role-assistant" : "role-system";
        const isHighlight = highlightMessageId && String(m.id) === String(highlightMessageId);
        const content = renderMarkdown(m.content || "(empty)");
        const q = role === "user" ? qualityScores[m.id] : null;
        elements.push(
          <div
            key={"m-" + m.id}
            className={`message ${roleClass}${isHighlight ? " highlight" : ""}`}
            data-message-id={m.id}
          >
            <div className="message-meta">
              <span className="role">{m.role || "assistant"}</span>
              <span>{formatTime(m.timestamp)}</span>
            </div>
            <div className="msg-section">
              <div className="message-content" dangerouslySetInnerHTML={{ __html: content }} />
            </div>
            {q && <div className="quality-feedback">{buildQualityHtml(q, m.id)}</div>}
          </div>,
        );
      } else {
        // Grouped assistant messages
        const ids = group.items.map((m) => m.id);
        const isHighlight = group.items.some(
          (m) => highlightMessageId && String(m.id) === String(highlightMessageId),
        );
        const firstTs = formatTime(firstMsg.timestamp);
        const lastMsg = group.items[group.items.length - 1];
        const lastTs = formatTime(lastMsg.timestamp);
        const timeLabel = firstTs === lastTs ? firstTs : firstTs + " \u2013 " + lastTs;

        elements.push(
          <div
            key={"ag-" + ids[0]}
            className={`message role-assistant${isHighlight ? " highlight" : ""}`}
            data-message-id={ids.join(",")}
          >
            <div className="message-meta">
              <span className="role">ASSISTANT</span>
              <span>{timeLabel}</span>
              <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                ({group.items.length} parts)
              </span>
            </div>
            {group.items.map((m, idx) => (
              <div key={m.id}>
                {idx > 0 && <hr className="msg-section-divider" />}
                <div className="msg-section">
                  <div
                    className="message-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content || "(empty)") }}
                  />
                </div>
              </div>
            ))}
          </div>,
        );
      }
    });
    return elements;
  };

  return (
    <div className="session-page" onClick={handleClick}>
      <div className="container">
        <div className="header">
          <div>
            <div><Link to="/">&larr; Back to sessions</Link></div>
            <div className="title">
              {session ? label + " \u2014 " + (session.workspace || "(default)") : "Session"}
            </div>
            <div className="meta">
              {session &&
                `Session ${session.id} \u00b7 ${formatTime(session.last_at)} \u00b7 ${session.message_count || 0} messages`}
            </div>
          </div>
          <div>
            {userCount > 0 && (
              <button
                type="button"
                className="btn-analyze"
                disabled={analyzing}
                onClick={runAnalyze}
              >
                {analyzing ? "Analyzing\u2026" : "Score Messages"}
              </button>
            )}
            <div
              className={`analyze-status${analyzeStatus.kind ? " " + analyzeStatus.kind : ""}`}
              dangerouslySetInnerHTML={
                analyzeStatus.html
                  ? { __html: analyzeStatus.html }
                  : undefined
              }
            >
              {!analyzeStatus.html ? analyzeStatus.text : undefined}
            </div>
          </div>
        </div>
        <div id="messages">{renderMessages()}</div>
      </div>
      <Toast />
    </div>
  );
}
