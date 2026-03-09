import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { showToast } from "../components/Toast";
import Toast from "../components/Toast";
import { SettingsWorkspace } from "./SettingsPage";
import {
  SOURCE_LABELS,
  timeAgo,
  getTimeGroup,
  getSessionTitle,
  getDateKey,
  formatDateLabel,
} from "../format";
import { renderMarkdown, highlightSearchTerms } from "../markdown";
import "../styles/search.css";

interface Session {
  id: number;
  source: string;
  workspace?: string;
  preview?: string;
  last_at?: number;
  message_count?: number;
}

interface Message {
  id: number;
  role: string;
  content: string;
  timestamp?: number;
}

interface SyncSource {
  source: string;
  enabled: boolean;
  last_sync_at?: number;
}

const BATCH_SIZE = 50;

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="2.25" />
      <path d="M5.5 2.75v10.5" />
      {collapsed ? (
        <path d="M8 8h2.75m-1.2-1.25L10.8 8l-1.25 1.25" />
      ) : (
        <path d="M10.75 8H8m1.2-1.25L7.95 8l1.25 1.25" />
      )}
    </svg>
  );
}

export default function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isSettingsRoute = location.pathname === "/settings";
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [syncSources, setSyncSources] = useState<SyncSource[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const loadedOffset = useRef(0);
  const hasMoreSessions = useRef(true);
  const isLoadingMore = useRef(false);
  const sessionListRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentQueryRef = useRef("");

  const loadSessionDetail = useCallback(
    (sessionId: number) => {
      setMessagesLoading(true);
      api<{
        session?: Session;
        messages?: Message[];
      }>(
        "/api/session?session_id=" +
          encodeURIComponent(String(sessionId)) +
          "&order=asc&limit=5000",
      )
        .then((data) => {
          if (data.session) setSelectedSession(data.session);
          setMessages(data.messages || []);
        })
        .catch(() => {
          setMessages([]);
        })
        .finally(() => setMessagesLoading(false));
    },
    [],
  );

  const loadSessions = useCallback(
    (q?: string) => {
      setSessionsLoading(true);
      loadedOffset.current = 0;
      hasMoreSessions.current = true;
      const searchQ = q !== undefined ? q : currentQueryRef.current;
      let params = "limit=" + BATCH_SIZE + "&offset=0";
      if (searchQ) params += "&q=" + encodeURIComponent(searchQ);

      api<{
        sessions?: Session[];
        total?: number;
        error?: unknown;
      }>("/api/sessions?" + params)
        .then((data) => {
          const list = data.sessions || [];
          setTotalSessions(typeof data.total === "number" ? data.total : list.length);
          setSessions(list);
          loadedOffset.current = list.length;
          hasMoreSessions.current = list.length >= BATCH_SIZE;

          if (list.length > 0) {
            const sel = list[0];
            setSelectedSession(sel);
            setFocusedIndex(0);
            loadSessionDetail(sel.id);
          } else {
            setSelectedSession(null);
            setMessages([]);
            setFocusedIndex(-1);
          }
        })
        .catch(() => {
          setSessions([]);
          setSelectedSession(null);
          setMessages([]);
        })
        .finally(() => setSessionsLoading(false));
    },
    [loadSessionDetail],
  );

  const loadMoreSessions = useCallback(() => {
    if (isLoadingMore.current || !hasMoreSessions.current) return;
    isLoadingMore.current = true;
    let params = "limit=" + BATCH_SIZE + "&offset=" + loadedOffset.current;
    if (currentQueryRef.current)
      params += "&q=" + encodeURIComponent(currentQueryRef.current);
    api<{ sessions?: Session[] }>("/api/sessions?" + params)
      .then((data) => {
        const list = data.sessions || [];
        if (list.length === 0) {
          hasMoreSessions.current = false;
          return;
        }
        setSessions((prev) => {
          const next = [...prev, ...list];
          loadedOffset.current = next.length;
          return next;
        });
        hasMoreSessions.current = list.length >= BATCH_SIZE;
      })
      .finally(() => {
        isLoadingMore.current = false;
      });
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const selectSession = useCallback(
    (idx: number, list?: Session[]) => {
      const s = (list || sessions)[idx];
      if (!s) return;
      setFocusedIndex(idx);
      setSelectedSession(s);
      loadSessionDetail(s.id);
      if (isSettingsRoute) navigate("/");
    },
    [sessions, loadSessionDetail, isSettingsRoute, navigate],
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      currentQueryRef.current = query;
      setSelectedSession(null);
      loadSessions(query);
    },
    [query, loadSessions],
  );

  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      if (val === "" && currentQueryRef.current !== "") {
        currentQueryRef.current = "";
        setSelectedSession(null);
        loadSessions("");
      }
    },
    [loadSessions],
  );

  const handleSync = useCallback(() => {
    if (syncing) return;
    setSyncing(true);
    api<{ sources?: Array<{ source: string }>; summary?: { active_sources?: number } }>(
      "/api/settings/sources",
    )
      .then((settingsPayload) => {
        const active = Number(settingsPayload?.summary?.active_sources || 0);
        if (active <= 0) {
          showToast("No AI tool is enabled. Redirecting to Advanced...");
          setTimeout(() => navigate("/settings"), 700);
          return null;
        }
        return api<{ sessions?: number; messages?: number }>("/api/index", {
          method: "POST",
        });
      })
      .then((payload) => {
        if (!payload) return;
        showToast(
          "Synced " + (payload.sessions || 0) + " sessions / " + (payload.messages || 0) + " messages",
        );
        loadSyncOptions();
        loadSessions();
      })
      .catch((err) => {
        showToast(err?.message || "Sync failed");
      })
      .finally(() => setSyncing(false));
  }, [syncing, navigate, loadSessions]);

  const loadSyncOptions = useCallback(() => {
    api<{ sources?: SyncSource[] }>("/api/settings/sources")
      .then((payload) => {
        setSyncSources(Array.isArray(payload.sources) ? payload.sources : []);
      })
      .catch(() => setSyncSources([]));
  }, []);

  const toggleSyncSource = useCallback(
    (source: string, checked: boolean) => {
      api("/api/settings/sources/" + encodeURIComponent(source), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      })
        .then(() => {
          showToast((SOURCE_LABELS[source] || source) + (checked ? " enabled" : " disabled"));
          loadSyncOptions();
        })
        .catch((err) => {
          showToast(err?.message || "Failed to update source");
        });
    },
    [loadSyncOptions],
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (isInput) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.min(prev + 1, sessions.length - 1);
          return next;
        });
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        selectSession(focusedIndex);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [sessions, focusedIndex, selectSession]);

  // Infinite scroll
  const handleSessionScroll = useCallback(() => {
    const el = sessionListRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      loadMoreSessions();
    }
  }, [loadMoreSessions]);

  // Close sync panel on outside click
  useEffect(() => {
    if (!syncPanelOpen) return;
    const handler = (e: MouseEvent) => {
      const panel = document.getElementById("sync-options-panel");
      const btn = document.getElementById("btn-sync-options");
      if (!panel || !btn) return;
      if (panel.contains(e.target as Node) || btn.contains(e.target as Node)) return;
      setSyncPanelOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [syncPanelOpen]);

  // Handle code copy clicks via delegation
  const handleMessagesClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const btn = target.closest(".code-copy") as HTMLElement | null;
    if (btn) {
      const wrap = btn.closest(".code-wrap");
      const code = wrap?.querySelector("code");
      if (code?.textContent) {
        navigator.clipboard.writeText(code.textContent).then(() => showToast("Code copied!"));
      }
      return;
    }
    // Toggle tool block headers
    const header = target.closest(".tool-block-header") as HTMLElement | null;
    if (header) {
      header.classList.toggle("open");
    }
  }, []);

  // Render sessions HTML
  const renderSessionList = () => {
    if (sessionsLoading) {
      return Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="skeleton skeleton-session" />
      ));
    }
    if (sessions.length === 0) {
      return (
        <div className="empty-state">
          <p>No sessions found.</p>
          <p className="guidance">
            Click <strong>Sync Local Chats</strong> to scan chat history.
          </p>
        </div>
      );
    }
    const items: React.ReactNode[] = [];
    let lastGroup = "";
    sessions.forEach((s, idx) => {
      const group = getTimeGroup(s.last_at);
      if (group !== lastGroup) {
        items.push(
          <div key={"g-" + group} className="session-group-label">
            {group}
          </div>,
        );
        lastGroup = group;
      }
      const isActive = selectedSession && String(selectedSession.id) === String(s.id);
      const isFocused = idx === focusedIndex;
      items.push(
        <div
          key={s.id}
          className={`session-item${isActive ? " active" : ""}${isFocused ? " focused" : ""}`}
          onClick={() => selectSession(idx)}
          role="option"
          aria-selected={!!isActive}
        >
          <div className="session-item-title" title={s.workspace || ""}>
            {getSessionTitle(s)}
          </div>
          <div className="session-item-meta">
            <span className="source-badge">{SOURCE_LABELS[s.source] || s.source || "?"}</span>
            <span className="session-meta-sep">{"\u00b7"}</span>
            <span className="session-time">{timeAgo(s.last_at)}</span>
          </div>
        </div>,
      );
    });
    return items;
  };

  // Render messages
  const renderMessageArea = () => {
    if (messagesLoading) {
      return (
        <>
          <div className="skeleton skeleton-msg" style={{ width: "58%" }} />
          <div className="skeleton skeleton-msg" style={{ width: "72%" }} />
          <div className="skeleton skeleton-msg" style={{ width: "50%" }} />
          <div className="skeleton skeleton-msg" style={{ width: "65%" }} />
        </>
      );
    }
    if (!selectedSession || messages.length === 0) {
      return (
        <div className="empty-state">
          <p>
            {selectedSession
              ? "No messages found in this session."
              : isSidebarCollapsed
                ? "Expand sessions to choose a conversation."
                : "Select a session from the list."}
          </p>
          {!selectedSession && (
            <p className="guidance">
              If no sessions appear, run <code>npx assistmem index</code>
            </p>
          )}
        </div>
      );
    }

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

      if (group.role !== "assistant") {
        const m = firstMsg;
        const role = group.role;
        const msgClass = role === "user" ? "msg-user" : "msg-system";
        const bubbleClass = role === "user" ? "bubble-user" : "bubble-system";
        let content = renderMarkdown(m.content || "(empty)");
        if (currentQueryRef.current) content = highlightSearchTerms(content, currentQueryRef.current);
        elements.push(
          <div key={"m-" + m.id} className={`chat-msg ${msgClass}`}>
            <div className="bubble-wrap">
              <div
                className={`bubble ${bubbleClass}`}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          </div>,
        );
      } else {
        // Grouped assistant messages
        elements.push(
          <div key={"ag-" + group.items[0].id} className="chat-msg msg-assistant">
            <div className="avatar">
              <svg viewBox="0 0 16 16" fill="white">
                <path d="M8 1l1.3 3.9L13.2 6.2l-3.9 1.3L8 11.4 6.7 7.5 2.8 6.2l3.9-1.3z" />
                <path d="M12 10l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" opacity=".6" />
              </svg>
            </div>
            <div className="bubble-wrap">
              <div className="bubble bubble-assistant">
                {group.items.map((m, idx) => {
                  let content = renderMarkdown(m.content || "(empty)");
                  if (currentQueryRef.current)
                    content = highlightSearchTerms(content, currentQueryRef.current);
                  return (
                    <div key={m.id} className="msg-section">
                      {idx > 0 && <hr className="msg-section-divider" />}
                      <div dangerouslySetInnerHTML={{ __html: content }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
        );
      }
    });

    return elements;
  };

  const enabledCount = syncSources.filter((s) => s.enabled).length;
  const lastSyncTs = syncSources.reduce((max, s) => Math.max(max, Number(s.last_sync_at || 0)), 0);

  return (
    <>
      <div className="workspace-page">
        <div className="workspace-toolbar">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={isSidebarCollapsed ? "Show sessions" : "Hide sessions"}
            title={isSidebarCollapsed ? "Show sessions" : "Hide sessions"}
          >
            <SidebarToggleIcon collapsed={isSidebarCollapsed} />
          </button>
        </div>
        <div className={`layout${isSidebarCollapsed ? " sidebar-collapsed" : ""}`}>
          {!isSidebarCollapsed && (
            <aside className="sidebar" id="sessions-sidebar">
              <div className="sidebar-filters">
                <form className="search-wrap" role="search" onSubmit={handleSearch}>
                  <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    type="search"
                    ref={searchInputRef}
                    value={query}
                    onChange={handleSearchInput}
                    placeholder="Search sessions..."
                  />
                </form>
                <div className="sync-btn-group">
                  <button type="button" className="btn-index-now" disabled={syncing} onClick={handleSync}>
                    {syncing ? "Syncing..." : "Sync Local Chats"}
                  </button>
                  <button
                    type="button"
                    className="btn-sync-options"
                    id="btn-sync-options"
                    aria-expanded={syncPanelOpen}
                    title="Select sync sources"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!syncPanelOpen) loadSyncOptions();
                      setSyncPanelOpen(!syncPanelOpen);
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor">
                      <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z" />
                    </svg>
                  </button>
                </div>
                {syncPanelOpen && (
                  <div className="sync-options-panel" id="sync-options-panel">
                    <div className="sync-options-title">Sync Options</div>
                    <div className="sync-options-status">
                      {syncSources.length === 0
                        ? "No source configuration found."
                        : `Enabled ${enabledCount}/${syncSources.length} \u00b7 ${lastSyncTs > 0 ? "Last sync " + timeAgo(lastSyncTs) : "Not synced yet"}`}
                    </div>
                    <div className="sync-options-list">
                      {syncSources.map((s) => (
                        <label key={s.source} className="sync-source-row">
                          <div className="sync-source-main">
                            <div className="sync-source-name">
                              {SOURCE_LABELS[s.source] || s.source || "?"}
                            </div>
                            <div className="sync-source-meta">
                              {s.last_sync_at ? "Last sync: " + timeAgo(s.last_sync_at) : "Not synced yet"}
                            </div>
                          </div>
                          <input
                            className="sync-source-toggle"
                            type="checkbox"
                            checked={s.enabled}
                            onChange={(e) => toggleSyncSource(s.source, e.target.checked)}
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn-sync-inline"
                      disabled={syncing}
                      onClick={handleSync}
                    >
                      {syncing ? "Syncing..." : "Sync Enabled Now"}
                    </button>
                    <Link className="sync-options-link" to="/settings">
                      Open Advanced
                    </Link>
                  </div>
                )}
              </div>
              <div className="session-list-header">
                <span id="session-count">
                  {totalSessions > 0 ? totalSessions + " sessions" : ""}
                </span>
              </div>
              <div
                className="session-list"
                ref={sessionListRef}
                onScroll={handleSessionScroll}
                role="listbox"
                tabIndex={0}
              >
                {renderSessionList()}
              </div>
              <div className="sidebar-foot">
                <button
                  type="button"
                  className={`btn-settings${isSettingsRoute ? " active" : ""}`}
                  onClick={() => navigate("/settings")}
                  title="Settings"
                  aria-current={isSettingsRoute ? "page" : undefined}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0" />
                    <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z" />
                  </svg>
                  <span className="settings-label">Settings</span>
                </button>
              </div>
            </aside>
          )}
          {isSettingsRoute ? (
            <main className="settings-pane">
              <SettingsWorkspace onClose={() => navigate("/")} />
            </main>
          ) : (
            <main className="content">
              <div className="content-header">
                <h2>{selectedSession ? getSessionTitle(selectedSession) : "Select a session"}</h2>
              </div>
              <div className="messages-area" onClick={handleMessagesClick}>
                {renderMessageArea()}
              </div>
            </main>
          )}
        </div>
      </div>
      <Toast />
    </>
  );
}
