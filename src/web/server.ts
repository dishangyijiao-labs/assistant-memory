import { createServer, type IncomingMessage, type ServerResponse } from "http";
import * as db from "../storage/db.js";
import { runIngest } from "../ingest/index.js";
import { generateInsight, type InsightModelConfig } from "../insights/generate.js";

const DEFAULT_PORT = 3000;

function getSearchPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Assistant Memory – Main</title>
  <style>
    :root {
      --bg: #ffffff;
      --surface: #f6f7fb;
      --border: #e1e5ee;
      --text: #1b1d26;
      --muted: #6b7280;
      --accent: #1f4bff;
      --accent-hover: #1a3fda;
      --accent-soft: #e8eeff;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "SF Mono", "Consolas", "Monaco", monospace;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      min-height: 100vh;
      padding: 1.25rem;
    }
    .container { max-width: 1360px; margin: 0 auto; }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    .sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 1rem; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .scope {
      font-size: 0.8rem;
      color: var(--muted);
      margin-bottom: 0.7rem;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .filters button {
      padding: 0.4rem 0.7rem;
      font: inherit;
      font-size: 0.8rem;
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
    }
    .filters button:hover { border-color: var(--muted); }
    .filters button.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    .search-row {
      display: flex;
      gap: 0.5rem;
      flex: 1;
      min-width: 200px;
    }
    .search-row input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      font: inherit;
      font-size: 0.875rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
    }
    .search-row input::placeholder { color: var(--muted); }
    .search-row input:focus { outline: none; border-color: var(--accent); }
    .search-row button {
      padding: 0.5rem 1rem;
      font: inherit;
      font-size: 0.875rem;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .search-row button:hover { background: var(--accent-hover); }
    .toolbar .btn-index { flex-shrink: 0; }
    .main {
      display: grid;
      grid-template-columns: 330px minmax(0, 1fr);
      gap: 0.9rem;
      align-items: start;
    }
    @media (max-width: 980px) {
      .main { grid-template-columns: 1fr; }
    }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.7rem;
      min-height: 62vh;
    }
    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.45rem;
    }
    .panel-title {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    #session-list { margin-top: 0.45rem; min-height: 120px; }
    .card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.7rem;
      margin-bottom: 0.6rem;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .card:hover { border-color: var(--accent); background: #f3f7ff; }
    .card.active {
      border-color: var(--accent);
      background: #edf2ff;
      box-shadow: 0 0 0 1px #dbe6ff inset;
    }
    .card-meta {
      font-size: 0.75rem;
      color: var(--muted);
      margin-bottom: 0.4rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .card-meta .source {
      background: var(--border);
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
      color: var(--text);
    }
    .card-snippet {
      font-size: 0.8rem;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--muted);
      margin-top: 0.5rem;
    }
    .empty, .error { color: var(--muted); font-size: 0.9rem; padding: 1rem 0; }
    .error { color: #e07070; }
    .count { font-size: 0.78rem; color: var(--muted); }
    .empty-state {
      padding: 0.8rem;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .empty-state p { margin: 0 0 0.75rem 0; }
    .btn-index {
      padding: 0.5rem 1rem;
      font: inherit;
      font-size: 0.875rem;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-index:hover { background: var(--accent-hover); }
    .btn-index:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      background: var(--accent-soft);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-link:hover { border-color: var(--accent); }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: 0.55rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border);
    }
    .pagination button {
      padding: 0.4rem 0.8rem;
      font: inherit;
      font-size: 0.8rem;
      background: var(--accent-soft);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
    }
    .pagination button:hover { border-color: var(--accent); }
    .pagination button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .pagination .page-info {
      font-size: 0.8rem;
      color: var(--muted);
    }
    .session-header {
      margin-bottom: 0.7rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.55rem;
    }
    .session-title {
      font-size: 0.95rem;
      font-weight: 600;
      margin: 0 0 0.2rem 0;
      word-break: break-word;
    }
    .session-meta {
      font-size: 0.78rem;
      color: var(--muted);
    }
    .msg-toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.45rem;
      margin-bottom: 0.65rem;
    }
    .msg-toolbar button {
      padding: 0.35rem 0.65rem;
      font: inherit;
      font-size: 0.75rem;
      background: var(--accent-soft);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
    }
    .msg-toolbar button:hover { border-color: var(--accent); }
    .messages {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      max-height: calc(62vh - 90px);
      overflow: auto;
      padding-right: 0.15rem;
    }
    .message {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.55rem 0.65rem;
      max-width: 86%;
    }
    .message.role-user {
      align-self: flex-end;
      background: #f4f6ff;
      border-color: #cfd8ff;
    }
    .message.role-assistant {
      align-self: flex-start;
      background: #f5fff7;
      border-color: #cfead7;
    }
    .message.role-system {
      align-self: center;
      background: #fff8ed;
      border-color: #f3ddbb;
      max-width: 92%;
    }
    .message-meta {
      font-size: 0.72rem;
      color: var(--muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }
    .message-role {
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
      color: var(--text);
    }
    .copy-msg {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
      border-radius: 4px;
      font: inherit;
      font-size: 0.67rem;
      padding: 0.12rem 0.35rem;
      cursor: pointer;
    }
    .copy-msg:hover { border-color: var(--accent); color: var(--text); }
    .message-content {
      font-size: 0.8rem;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Assistant Memory</h1>
    <p class="sub">Browse chat records and search by keyword (Cursor IDE, Copilot, Cursor/Claude Code/Codex/Gemini CLI)</p>
    <p class="scope" id="workspace-scope">Workspace scope: (none selected)</p>
    <div class="toolbar">
      <div class="filters" id="filters" role="group" aria-label="Filter by source">
        <button type="button" class="active" data-source="">All</button>
        <button type="button" data-source="cursor">Cursor IDE</button>
        <button type="button" data-source="copilot">Copilot</button>
        <button type="button" data-source="cursor-cli">Cursor CLI</button>
        <button type="button" data-source="claude-code">Claude Code</button>
        <button type="button" data-source="codex">Codex</button>
        <button type="button" data-source="gemini">Gemini</button>
      </div>
      <form class="search-row" id="search-form" role="search">
        <input type="search" name="q" id="q" placeholder="Search sessions (workspace or id)…" />
        <button type="submit">Search</button>
      </form>
      <a class="btn-index btn-link" href="/insights" title="Open insights and reports">Insights</a>
      <button type="button" class="btn-index" id="btn-index" title="Index local chat history from Cursor, Copilot, CLI">Index now</button>
    </div>
    <p class="count" id="db-status" aria-live="polite"></p>
    <div class="main">
      <div class="panel">
        <div class="panel-head">
          <div class="panel-title">Sessions</div>
          <div class="count" id="session-count"></div>
        </div>
        <div id="session-list" role="region" aria-label="Sessions list"></div>
        <div class="pagination" id="pagination">
          <button type="button" id="prev-page">Previous</button>
          <span class="page-info" id="page-info"></span>
          <button type="button" id="next-page">Next</button>
        </div>
      </div>
      <div class="panel">
        <div class="session-header" id="session-header">
          <h2 class="session-title" id="session-title">Select a session</h2>
          <div class="session-meta" id="session-meta">Choose one item from the left list to view messages.</div>
        </div>
        <div class="msg-toolbar">
          <button type="button" id="copy-session" disabled>Copy Session</button>
          <button type="button" id="open-session-page" disabled>Open Standalone</button>
        </div>
        <div class="messages" id="messages">
          <div class="empty-state"><p class="empty">Select a session from the left list.</p></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    var currentSource = "";
    var currentQuery = "";
    var currentPage = 1;
    var pageSize = 50;
    var currentSessions = [];
    var selectedSession = null;
    var selectedMessages = [];
    var sourceLabels = { cursor: "Cursor IDE", copilot: "Copilot (VS Code)", "cursor-cli": "Cursor CLI", "claude-code": "Claude Code", codex: "Codex", gemini: "Gemini" };

    function formatTime(ts) {
      var d = ts ? new Date(ts) : new Date();
      if (isNaN(d.getTime())) return "Unknown date";
      try {
        if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
          return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(d);
        }
      } catch (_e) {}
      return d.toISOString();
    }

    function escapeHtml(s) {
      var div = document.createElement("div");
      div.textContent = s;
      return div.innerHTML;
    }

    function setWorkspaceScope(text) {
      var el = document.getElementById("workspace-scope");
      if (el) {
        el.textContent = "Workspace scope: " + (text || "(none selected)");
      }
    }

    function setSessionHeader(session) {
      var titleEl = document.getElementById("session-title");
      var metaEl = document.getElementById("session-meta");
      if (!session) {
        titleEl.textContent = "Select a session";
        metaEl.textContent = "Choose one item from the left list to view messages.";
        setWorkspaceScope("");
        return;
      }
      var label = sourceLabels[session.source] || session.source || "?";
      titleEl.textContent = label + " — " + (session.workspace || "(default)");
      metaEl.textContent = "Session " + session.id + " · " + formatTime(session.last_at) + " · " + (session.message_count || 0) + " messages";
      setWorkspaceScope(session.workspace || "(default)");
    }

    function updatePagination(total) {
      var pageInfo = document.getElementById("page-info");
      var prevBtn = document.getElementById("prev-page");
      var nextBtn = document.getElementById("next-page");
      var totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;
      if (pageInfo) {
        pageInfo.textContent = total > 0 ? "Page " + currentPage + " of " + totalPages : "No results";
      }
      if (prevBtn) prevBtn.disabled = currentPage <= 1;
      if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    }

    function setMessagePanelEmpty(text) {
      selectedMessages = [];
      document.getElementById("messages").innerHTML = '<div class="empty-state"><p class="empty">' + escapeHtml(text) + '</p></div>';
      document.getElementById("copy-session").disabled = true;
      document.getElementById("open-session-page").disabled = true;
    }

    function renderMessages(messages) {
      selectedMessages = messages || [];
      if (!messages || messages.length === 0) {
        setMessagePanelEmpty("No messages found in this session.");
        return;
      }
      var html = messages.map(function (m) {
        var role = (m.role || "assistant").toLowerCase();
        var roleClass = role === "user" ? "role-user" : role === "assistant" ? "role-assistant" : "role-system";
        return '<div class="message ' + roleClass + '" data-message-id="' + m.id + '">' +
          '<div class="message-meta"><span class="message-role">' + escapeHtml(m.role || "assistant") + '</span><span>' + escapeHtml(formatTime(m.timestamp)) + '</span><button type="button" class="copy-msg" data-copy-id="' + m.id + '">Copy</button></div>' +
          '<div class="message-content">' + escapeHtml(m.content || "(empty)") + '</div>' +
        '</div>';
      }).join("");
      document.getElementById("messages").innerHTML = html;
      document.getElementById("copy-session").disabled = false;
      document.getElementById("open-session-page").disabled = false;
    }

    function loadSessionDetail(sessionId) {
      if (!sessionId) {
        selectedSession = null;
        setSessionHeader(null);
        setMessagePanelEmpty("Select a session from the left list.");
        return;
      }
      document.getElementById("messages").innerHTML = '<div class="empty-state"><p>Loading messages…</p></div>';
      fetch("/api/session?session_id=" + encodeURIComponent(String(sessionId)) + "&order=asc&limit=5000")
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) {
            setMessagePanelEmpty(data.error);
            return;
          }
          selectedSession = data.session || selectedSession;
          setSessionHeader(selectedSession);
          renderMessages(data.messages || []);
        })
        .catch(function () {
          setMessagePanelEmpty("Failed to load session messages.");
        });
    }

    function renderSessions(list) {
      var host = document.getElementById("session-list");
      if (!list || list.length === 0) {
        host.innerHTML = '<div class="empty-state"><p class="empty">No sessions found.</p></div>';
        return;
      }
      var html = list.map(function (s) {
        var active = selectedSession && String(selectedSession.id) === String(s.id) ? " active" : "";
        var date = formatTime(s.last_at);
        var label = sourceLabels[s.source] || s.source || "?";
        return '<div class="card' + active + '" data-session-id="' + s.id + '">' +
          '<div class="card-meta"><span class="source">' + escapeHtml(label) + '</span><span>' + escapeHtml(s.workspace || "(default)") + '</span><span>' + escapeHtml(date) + '</span></div>' +
          '<div class="card-snippet">' + escapeHtml(String(s.message_count || 0)) + ' messages</div>' +
        '</div>';
      }).join("");
      host.innerHTML = html;
    }

    function loadSessions() {
      var offset = (currentPage - 1) * pageSize;
      var params = "limit=" + pageSize + "&offset=" + offset;
      if (currentSource) params += "&source=" + encodeURIComponent(currentSource);
      if (currentQuery) params += "&q=" + encodeURIComponent(currentQuery);
      fetch("/api/sessions?" + params)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var countEl = document.getElementById("session-count");
          if (data.error) {
            document.getElementById("session-list").innerHTML = '<div class="empty-state"><p class="error">' + escapeHtml(data.error) + '</p></div>';
            if (countEl) countEl.textContent = "Error";
            updatePagination(0);
            setSessionHeader(null);
            setMessagePanelEmpty("Select a session from the left list.");
            return;
          }
          var list = data.sessions || [];
          currentSessions = list;
          if (!list.length) {
            document.getElementById("session-list").innerHTML = '<div class="empty-state"><p class="empty">No sessions found.</p></div>';
            if (countEl) countEl.textContent = "0 sessions";
            updatePagination(0);
            selectedSession = null;
            setSessionHeader(null);
            setMessagePanelEmpty("Select a session from the left list.");
            return;
          }
          if (countEl && typeof data.total === "number") countEl.textContent = data.total + " session(s)";
          if (!selectedSession || !list.some(function (s) { return String(s.id) === String(selectedSession.id); })) {
            selectedSession = list[0];
          } else {
            selectedSession = list.find(function (s) { return String(s.id) === String(selectedSession.id); }) || list[0];
          }
          renderSessions(list);
          setSessionHeader(selectedSession);
          loadSessionDetail(selectedSession.id);
          updatePagination(typeof data.total === "number" ? data.total : data.sessions.length);
        })
        .catch(function () {
          document.getElementById("session-list").innerHTML = '<div class="empty-state"><p class="error">Failed to load sessions.</p></div>';
          var countEl = document.getElementById("session-count");
          if (countEl) countEl.textContent = "Error";
          updatePagination(0);
          setSessionHeader(null);
          setMessagePanelEmpty("Select a session from the left list.");
        });
    }

    function loadDbStatus() {
      fetch("/api/stats")
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var el = document.getElementById("db-status");
          if (data.error) el.textContent = "Database: " + data.error;
          else el.textContent = "Database: " + data.sessions + " sessions, " + data.messages + " messages" + (data.dbPath ? " (" + data.dbPath + ")" : "");
        })
        .catch(function () { document.getElementById("db-status").textContent = "Database: status unknown"; });
    }

    function runIndex() {
      var btn = document.getElementById("btn-index");
      var listEl = document.getElementById("session-list");
      var countEl = document.getElementById("session-count");
      if (btn) { btn.disabled = true; btn.textContent = "Indexing…"; }
      if (countEl) countEl.textContent = "Indexing local chat history…";
      if (listEl) {
        listEl.innerHTML = '<div class="empty-state"><p>Reading Cursor, Copilot, Cursor CLI, Claude Code, Codex, Gemini data from disk…</p></div>';
      }
      fetch("/api/index", { method: "POST" })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (out) {
          if (!out.ok) {
            if (countEl) countEl.textContent = "Index failed";
            if (listEl) {
              listEl.innerHTML = '<div class="empty-state"><p class="error">Error: ' + escapeHtml(out.data.error || "Index failed") + '</p><p>Run <code>npx assistant-memory index</code> in a terminal to index from the same machine.</p></div>';
            }
            if (btn) { btn.disabled = false; btn.textContent = "Index now"; }
            loadDbStatus();
            return;
          }
          if (countEl) countEl.textContent = "Indexed " + (out.data.sessions || 0) + " sessions, " + (out.data.messages || 0) + " messages. Reloading…";
          currentPage = 1;
          loadSessions();
          if (btn) { btn.disabled = false; btn.textContent = "Index now"; }
        })
        .catch(function (err) {
          if (countEl) countEl.textContent = "Index failed";
          if (listEl) {
            listEl.innerHTML = '<div class="empty-state"><p class="error">Error: ' + escapeHtml(err.message || "Index failed") + '</p><p>Run <code>npx assistant-memory index</code> in a terminal, then refresh this page.</p></div>';
          }
          if (btn) { btn.disabled = false; btn.textContent = "Index now"; }
          loadDbStatus();
        });
    }

    function documentKeyDown(e) {
       if (e.key === "/" && document.activeElement !== document.getElementById("q")) {
         e.preventDefault();
         document.getElementById("q").focus();
       }
    }
    document.addEventListener("keydown", documentKeyDown);

    document.getElementById("filters").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-source]");
      if (!btn) return;
      document.querySelectorAll("#filters button").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      currentSource = btn.getAttribute("data-source") || "";
      currentPage = 1;
      selectedSession = null;
      loadSessions();
    });

    document.getElementById("session-list").addEventListener("click", function (e) {
      var card = e.target.closest(".card[data-session-id]");
      if (!card) return;
      var sessionId = card.getAttribute("data-session-id");
      var next = currentSessions.find(function (s) { return String(s.id) === String(sessionId); }) || null;
      if (!next) return;
      selectedSession = next;
      renderSessions(currentSessions);
      setSessionHeader(selectedSession);
      loadSessionDetail(selectedSession.id);
    });

    document.getElementById("search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      currentQuery = document.getElementById("q").value || "";
      currentPage = 1;
      selectedSession = null;
      loadSessions();
    });

    document.getElementById("prev-page").addEventListener("click", function () {
      if (currentPage <= 1) return;
      currentPage -= 1;
      loadSessions();
    });

    document.getElementById("next-page").addEventListener("click", function () {
      currentPage += 1;
      loadSessions();
    });

    document.getElementById("copy-session").addEventListener("click", function () {
      if (!selectedMessages || !selectedMessages.length) return;
      var text = selectedMessages.map(function (m) {
        return "[" + (m.role || "assistant") + "] " + formatTime(m.timestamp) + "\\n" + (m.content || "");
      }).join("\\n\\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
      }
    });

    document.getElementById("messages").addEventListener("click", function (e) {
      var btn = e.target.closest("button.copy-msg[data-copy-id]");
      if (!btn) return;
      var id = btn.getAttribute("data-copy-id");
      var m = selectedMessages.find(function (x) { return String(x.id) === String(id); });
      if (!m) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(m.content || "").catch(function () {});
      }
    });

    document.getElementById("open-session-page").addEventListener("click", function () {
      if (!selectedSession) return;
      window.location.href = "/session?session_id=" + encodeURIComponent(String(selectedSession.id));
    });

    document.getElementById("btn-index").addEventListener("click", runIndex);
    loadSessions();
    loadDbStatus();
  </script>
</body>
</html>`;
}

function getSessionPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Assistant Memory – Session</title>
  <style>
    :root {
      --bg: #ffffff;
      --surface: #f6f7fb;
      --border: #e1e5ee;
      --text: #1b1d26;
      --muted: #6b7280;
      --accent: #1f4bff;
      --accent-hover: #1a3fda;
      --accent-soft: #e8eeff;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "SF Mono", "Consolas", "Monaco", monospace;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 900px; margin: 0 auto; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { color: var(--accent-hover); }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .title {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0.2rem 0;
    }
    .meta {
      font-size: 0.8rem;
      color: var(--muted);
    }
    .message {
      padding: 0.7rem 0.9rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 0.6rem;
      background: #fff;
      transition: border-color 0.15s ease, background 0.15s ease;
      max-width: 82%;
    }
    .message.highlight {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-soft);
    }
    #messages {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .message.role-user {
      align-self: flex-end;
      background: #f4f6ff;
      border-color: #cfd8ff;
    }
    .message.role-assistant {
      align-self: flex-start;
      background: #f1fff4;
      border-color: #bfe5c8;
    }
    .message.role-system {
      align-self: center;
      background: #fff7e8;
      border-color: #f2d3a7;
      max-width: 90%;
    }
    .message.role-user .message-meta {
      justify-content: flex-end;
    }
    .message-meta {
      font-size: 0.72rem;
      color: var(--muted);
      margin-bottom: 0.35rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .role {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text);
    }
    .message-content {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.84rem;
    }
    .empty-state {
      padding: 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div><a href="/">← Back to search</a></div>
        <div class="title" id="title">Session</div>
        <div class="meta" id="meta"></div>
      </div>
    </div>
    <div id="messages"></div>
  </div>
  <script>
    var sourceLabels = { cursor: "Cursor IDE", copilot: "Copilot (VS Code)", "cursor-cli": "Cursor CLI", "claude-code": "Claude Code", codex: "Codex", gemini: "Gemini" };

    function formatBeijingTime(ts) {
      var d = ts ? new Date(ts) : new Date();
      if (isNaN(d.getTime())) return "Unknown date";
      try {
        if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
          return new Intl.DateTimeFormat("zh-CN", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(d);
        }
      } catch (_e) {}
      var utc = d.getTime();
      var beijingMs = utc + 8 * 60 * 60 * 1000;
      var b = new Date(beijingMs);
      var yyyy = b.getUTCFullYear();
      var mm = String(b.getUTCMonth() + 1).padStart(2, "0");
      var dd = String(b.getUTCDate()).padStart(2, "0");
      var hh = String(b.getUTCHours()).padStart(2, "0");
      var mi = String(b.getUTCMinutes()).padStart(2, "0");
      var ss = String(b.getUTCSeconds()).padStart(2, "0");
      return yyyy + "-" + mm + "-" + dd + " " + hh + ":" + mi + ":" + ss;
    }

    function escapeHtml(s) {
      var div = document.createElement("div");
      div.textContent = s;
      return div.innerHTML;
    }

    function getQueryParams() {
      try {
        return new URL(window.location.href).searchParams;
      } catch (e) {
        return new URLSearchParams();
      }
    }

    function renderSession(data, highlightMessageId) {
      if (!data || !data.session) {
        document.getElementById("messages").innerHTML = '<div class="empty-state">Session not found.</div>';
        return;
      }
      var s = data.session;
      var label = sourceLabels[s.source] || s.source || "?";
      document.getElementById("title").textContent = label + " — " + (s.workspace || "(default)");
      var lastDate = formatBeijingTime(s.last_at);
      document.getElementById("meta").textContent = "Session " + s.id + " · " + lastDate + " · " + (s.message_count || 0) + " messages";

      var html = (data.messages || []).map(function (m) {
        var ts = formatBeijingTime(m.timestamp);
        var role = (m.role || "assistant").toLowerCase();
        var roleClass = role === "user" ? "role-user" : role === "assistant" ? "role-assistant" : "role-system";
        var highlight = highlightMessageId && String(m.id) === String(highlightMessageId) ? " highlight" : "";
        return '<div class="message ' + roleClass + highlight + '" data-message-id="' + m.id + '">' +
          '<div class="message-meta"><span class="role">' + escapeHtml(m.role || "assistant") + '</span><span>' + escapeHtml(ts) + '</span></div>' +
          '<div class="message-content">' + escapeHtml(m.content || "(empty)") + '</div>' +
        '</div>';
      }).join("");
      document.getElementById("messages").innerHTML = html || '<div class="empty-state">No messages found.</div>';

      if (highlightMessageId) {
        var target = document.querySelector('.message[data-message-id="' + highlightMessageId + '"]');
        if (target && target.scrollIntoView) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }

    var params = getQueryParams();
    var sessionId = params.get("session_id");
    var messageId = params.get("message_id");
    if (!sessionId) {
      document.getElementById("messages").innerHTML = '<div class="empty-state">Missing session_id.</div>';
    } else {
      fetch("/api/session?session_id=" + encodeURIComponent(String(sessionId)))
        .then(function (res) { return res.json(); })
        .then(function (data) { renderSession(data, messageId); })
        .catch(function () {
          document.getElementById("messages").innerHTML = '<div class="empty-state">Failed to load session.</div>';
        });
    }
  </script>
</body>
</html>`;
}

function getInsightsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Assistant Memory – Insights</title>
  <style>
    :root {
      --bg: #ffffff;
      --surface: #f6f7fb;
      --border: #e1e5ee;
      --text: #1b1d26;
      --muted: #6b7280;
      --accent: #1f4bff;
      --accent-hover: #1a3fda;
      --accent-soft: #e8eeff;
      --success: #2f7d32;
      --warning: #a85700;
      --error: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: "SF Mono", "Consolas", "Monaco", monospace;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    a {
      color: var(--accent);
      text-decoration: none;
    }
    a:hover { color: var(--accent-hover); }
    .title { margin: 0; font-size: 1.2rem; }
    .sub { margin: 0.3rem 0 0; font-size: 0.82rem; color: var(--muted); }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 960px) {
      .layout { grid-template-columns: 1fr; }
    }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.9rem;
    }
    .section-title {
      margin: 0 0 0.55rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.74rem;
    }
    .controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
      margin-bottom: 0.85rem;
    }
    @media (max-width: 860px) {
      .controls { grid-template-columns: 1fr; }
    }
    label {
      display: block;
      font-size: 0.78rem;
      color: var(--muted);
      margin-bottom: 0.35rem;
    }
    input[type="text"],
    input[type="password"],
    select {
      width: 100%;
      border: 1px solid var(--border);
      background: #fff;
      color: var(--text);
      border-radius: 6px;
      padding: 0.45rem 0.55rem;
      font: inherit;
      font-size: 0.82rem;
    }
    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.82rem;
      color: var(--text);
    }
    .source-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .source-item {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.78rem;
      color: var(--text);
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.2rem 0.5rem;
    }
    .btn-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin: 0.9rem 0 0.65rem;
    }
    button {
      border: none;
      border-radius: 6px;
      padding: 0.45rem 0.8rem;
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
      background: var(--accent);
      color: #fff;
    }
    button:hover { background: var(--accent-hover); }
    button.secondary {
      background: var(--accent-soft);
      color: var(--text);
      border: 1px solid var(--border);
    }
    button.secondary:hover { border-color: var(--accent); }
    button:disabled { opacity: 0.65; cursor: not-allowed; }
    .status {
      min-height: 1.2rem;
      font-size: 0.8rem;
      color: var(--muted);
      margin: 0.3rem 0 0.8rem;
    }
    .status.ok { color: var(--success); }
    .status.warn { color: var(--warning); }
    .status.err { color: var(--error); }
    .result-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.65rem;
      margin-bottom: 0.75rem;
    }
    @media (max-width: 860px) {
      .result-grid { grid-template-columns: 1fr; }
    }
    .score-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.65rem;
    }
    .score-name {
      font-size: 0.72rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .score-value {
      font-size: 1.2rem;
      margin-top: 0.2rem;
      font-weight: 700;
    }
    .block {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.7rem;
      margin-bottom: 0.65rem;
    }
    .block h3 {
      margin: 0 0 0.45rem;
      font-size: 0.82rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .block p, .block li, .block a {
      font-size: 0.82rem;
      line-height: 1.45;
      color: var(--text);
    }
    .block ul {
      margin: 0;
      padding-left: 1rem;
    }
    .history-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      max-height: 70vh;
      overflow: auto;
    }
    .history-item {
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 0.6rem;
      background: #fff;
      cursor: pointer;
    }
    .history-item.active {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px #dbe6ff inset;
    }
    .history-item button {
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      color: var(--text);
      padding: 0;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .history-meta {
      margin-top: 0.25rem;
      font-size: 0.72rem;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div><a href="/">← Back to sessions</a></div>
        <h1 class="title">Insights</h1>
        <p class="sub">Manual reports with scores and evidence links</p>
      </div>
    </div>

    <div class="layout">
      <div class="panel">
        <p class="section-title">Scope</p>
        <div class="controls">
          <div>
            <label for="scope-workspace">Workspace</label>
            <select id="scope-workspace"></select>
          </div>
          <div>
            <label for="scope-range">Time Range</label>
            <select id="scope-range">
              <option value="7d">Last 7 days</option>
              <option value="30d" selected>Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
        <div>
          <label>Sources</label>
          <div class="source-list" id="source-list"></div>
        </div>

        <p class="section-title" style="margin-top:0.9rem;">Model</p>
        <div class="controls">
          <div>
            <label for="model-mode">Mode</label>
            <select id="model-mode">
              <option value="local">Local</option>
              <option value="external">External API</option>
            </select>
          </div>
          <div>
            <label for="model-provider">Provider</label>
            <input id="model-provider" type="text" placeholder="openai-compatible" />
          </div>
          <div>
            <label for="model-base">Base URL</label>
            <input id="model-base" type="text" placeholder="https://api.openai.com/v1" />
          </div>
          <div>
            <label for="model-name">Model Name</label>
            <input id="model-name" type="text" placeholder="gpt-4o-mini" />
          </div>
          <div>
            <label for="model-key">API Key (runtime)</label>
            <input id="model-key" type="password" placeholder="optional, not persisted in db by default" />
          </div>
          <div style="display:flex;align-items:flex-end;">
            <label class="checkbox-row"><input id="model-enabled" type="checkbox" /> Enable External API</label>
          </div>
        </div>

        <div class="btn-row">
          <button class="secondary" id="btn-save">Save Model Settings</button>
          <button class="secondary" id="btn-test">Test Connection</button>
          <button id="btn-generate">Generate Insights</button>
        </div>
        <p id="status" class="status"></p>

        <div class="block">
          <h3>Summary</h3>
          <p id="summary">No report yet.</p>
        </div>
        <div class="result-grid">
          <div class="score-card">
            <div class="score-name">Efficiency</div>
            <div class="score-value" id="score-eff">-</div>
          </div>
          <div class="score-card">
            <div class="score-name">Stability</div>
            <div class="score-value" id="score-sta">-</div>
          </div>
          <div class="score-card">
            <div class="score-name">Decision Clarity</div>
            <div class="score-value" id="score-dec">-</div>
          </div>
        </div>
        <div class="block">
          <h3>Patterns</h3>
          <ul id="patterns"><li>No report yet.</li></ul>
        </div>
        <div class="block">
          <h3>Feedback</h3>
          <ul id="feedback"><li>No report yet.</li></ul>
        </div>
        <div class="block">
          <h3>Evidence</h3>
          <ul id="evidence"><li>No report yet.</li></ul>
        </div>
      </div>

      <div class="panel">
        <p class="section-title">History</p>
        <ul id="history" class="history-list">
          <li class="history-item"><div class="history-meta">Loading…</div></li>
        </ul>
      </div>
    </div>
  </div>
  <script>
    var sourceLabels = { cursor: "Cursor IDE", copilot: "Copilot", "cursor-cli": "Cursor CLI", "claude-code": "Claude Code", codex: "Codex", gemini: "Gemini" };
    var sourceKeys = Object.keys(sourceLabels);
    var lastReportId = null;

    function status(text, kind) {
      var el = document.getElementById("status");
      el.textContent = text || "";
      el.className = "status" + (kind ? " " + kind : "");
    }

    function safeText(v) {
      if (v === null || v === undefined) return "";
      return String(v);
    }

    function escapeHtml(v) {
      return safeText(v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function parseError(payload) {
      if (!payload) return "Request failed";
      if (typeof payload.error === "string") return payload.error;
      if (payload.error && typeof payload.error.message === "string") return payload.error.message;
      return "Request failed";
    }

    function api(path, options) {
      return fetch(path, options || {}).then(function (res) {
        return res.text().then(function (text) {
          var payload = {};
          try { payload = text ? JSON.parse(text) : {}; } catch (_e) {}
          if (!res.ok) {
            throw new Error(parseError(payload));
          }
          return payload;
        });
      });
    }

    function renderSourceChecks() {
      var host = document.getElementById("source-list");
      host.innerHTML = sourceKeys.map(function (key) {
        return '<label class="source-item"><input type="checkbox" data-source="' + key + '" checked />' + sourceLabels[key] + '</label>';
      }).join("");
    }

    function selectedSources() {
      var checked = Array.from(document.querySelectorAll('#source-list input[type="checkbox"]:checked'));
      return checked.map(function (node) { return node.getAttribute("data-source"); }).filter(Boolean);
    }

    function msDays(days) {
      return days * 24 * 60 * 60 * 1000;
    }

    function resolveTimeRange() {
      var range = document.getElementById("scope-range").value;
      var now = Date.now();
      if (range === "7d") return { from: now - msDays(7), to: now };
      if (range === "30d") return { from: now - msDays(30), to: now };
      if (range === "90d") return { from: now - msDays(90), to: now };
      return null;
    }

    function currentWorkspace() {
      var sel = document.getElementById("scope-workspace");
      return sel ? (sel.value || "") : "";
    }

    function setGenerateDisabled(disabled) {
      document.getElementById("btn-generate").disabled = disabled;
      document.getElementById("btn-test").disabled = disabled;
      document.getElementById("btn-save").disabled = disabled;
    }

    function asListHtml(items) {
      if (!items || items.length === 0) return "<li>None</li>";
      return items.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join("");
    }

    function renderReport(data, evidence) {
      document.getElementById("summary").textContent = safeText(data.summary || "No summary.");
      document.getElementById("patterns").innerHTML = asListHtml(data.patterns || []);
      document.getElementById("feedback").innerHTML = asListHtml(data.feedback || []);
      var scores = data.scores || {};
      document.getElementById("score-eff").textContent = safeText(scores.efficiency || "-");
      document.getElementById("score-sta").textContent = safeText(scores.stability || "-");
      document.getElementById("score-dec").textContent = safeText(scores.decision_clarity || "-");
      var evidenceList = Array.isArray(evidence) ? evidence : [];
      if (evidenceList.length === 0) {
        document.getElementById("evidence").innerHTML = "<li>No evidence links.</li>";
      } else {
        document.getElementById("evidence").innerHTML = evidenceList.map(function (e) {
          var text = escapeHtml(e.claim || e.claim_text || "Evidence");
          var sessionId = e.session_id;
          var messageId = e.message_id;
          var href = "/session?session_id=" + encodeURIComponent(String(sessionId)) + "&message_id=" + encodeURIComponent(String(messageId));
          return '<li><a href="' + href + '">' + text + "</a></li>";
        }).join("");
      }
    }

    function renderHistory(data) {
      var list = document.getElementById("history");
      var reports = (data && data.reports) || [];
      if (!reports.length) {
        list.innerHTML = '<li class="history-item"><div class="history-meta">No reports yet.</div></li>';
        return;
      }
      list.innerHTML = reports.map(function (r) {
        var when = new Date(r.created_at || Date.now()).toLocaleString();
        var summary = escapeHtml(safeText(r.summary || "").slice(0, 120));
        return '<li class="history-item" data-report-id="' + r.id + '">' +
          '<button type="button" data-report-id="' + r.id + '">' + summary + '</button>' +
          '<div class="history-meta">#' + r.id + " · " + when + "</div>" +
        "</li>";
      }).join("");
      setActiveHistoryItem(lastReportId);
    }

    function setActiveHistoryItem(id) {
      Array.from(document.querySelectorAll("#history .history-item")).forEach(function (node) {
        node.classList.remove("active");
      });
      if (!id) return;
      var item = document.querySelector('#history .history-item[data-report-id="' + String(id) + '"]');
      if (item) item.classList.add("active");
    }

    function getReportIdFromEventTarget(target) {
      if (!target) return 0;
      var node = target.nodeType === 1 ? target : target.parentElement;
      if (!node || !node.closest) return 0;
      var holder = node.closest("[data-report-id]");
      if (!holder) return 0;
      var raw = holder.getAttribute("data-report-id") || "0";
      var id = parseInt(raw, 10);
      return Number.isFinite(id) ? id : 0;
    }

    function loadHistory() {
      var ws = currentWorkspace();
      var q = ws ? "?workspace=" + encodeURIComponent(ws) + "&limit=30" : "?limit=30";
      return api("/api/insights" + q).then(function (data) {
        renderHistory(data);
      }).catch(function (err) {
        status(err.message || "Failed to load report history", "err");
      });
    }

    function loadReport(id) {
      return api("/api/insights/" + encodeURIComponent(String(id))).then(function (data) {
        lastReportId = id;
        renderReport(data.report || {}, data.evidence || []);
        setActiveHistoryItem(id);
        status("Loaded report #" + id, "ok");
      }).catch(function (err) {
        status(err.message || "Failed to load report", "err");
      });
    }

    function loadWorkspaces() {
      return api("/api/workspaces").then(function (data) {
        var list = (data && data.workspaces) || [];
        var select = document.getElementById("scope-workspace");
        if (!list.length) {
          select.innerHTML = '<option value="">(no workspace)</option>';
          return;
        }
        select.innerHTML = list.map(function (w) {
          var raw = safeText(w.name || "");
          return '<option value="' + escapeHtml(raw) + '">' + escapeHtml(raw) + '</option>';
        }).join("");
      });
    }

    function loadSettings() {
      return api("/api/settings/model").then(function (data) {
        var s = (data && data.settings) || {};
        document.getElementById("model-mode").value = s.mode_default || "local";
        document.getElementById("model-provider").value = s.provider || "";
        document.getElementById("model-base").value = s.base_url || "https://api.openai.com/v1";
        document.getElementById("model-name").value = s.model_name || "";
        document.getElementById("model-enabled").checked = !!s.external_enabled;
      });
    }

    function saveSettings() {
      status("Saving model settings…", "warn");
      var body = {
        mode_default: document.getElementById("model-mode").value,
        provider: document.getElementById("model-provider").value.trim(),
        base_url: document.getElementById("model-base").value.trim(),
        model_name: document.getElementById("model-name").value.trim(),
        external_enabled: !!document.getElementById("model-enabled").checked,
        api_key: document.getElementById("model-key").value.trim(),
      };
      return api("/api/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(function () {
        status("Model settings saved", "ok");
      }).catch(function (err) {
        status(err.message || "Failed to save model settings", "err");
      });
    }

    function testConnection() {
      status("Testing model connection…", "warn");
      var body = {
        provider: document.getElementById("model-provider").value.trim(),
        base_url: document.getElementById("model-base").value.trim(),
        model_name: document.getElementById("model-name").value.trim(),
        external_enabled: !!document.getElementById("model-enabled").checked,
        api_key: document.getElementById("model-key").value.trim(),
      };
      return api("/api/model/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (out) {
        status(out.message || "Connection successful", "ok");
      }).catch(function (err) {
        status(err.message || "Connection test failed", "err");
      });
    }

    function generate() {
      setGenerateDisabled(true);
      status("Generating insights…", "warn");
      var windowRange = resolveTimeRange();
      var scope = {
        workspace: currentWorkspace(),
        sources: selectedSources(),
      };
      if (windowRange) {
        scope.time_from = windowRange.from;
        scope.time_to = windowRange.to;
      }
      var mode = document.getElementById("model-mode").value;
      var body = {
        scope: scope,
        model: {
          mode: mode,
          provider: document.getElementById("model-provider").value.trim(),
          base_url: document.getElementById("model-base").value.trim(),
          model_name: document.getElementById("model-name").value.trim(),
          api_key: document.getElementById("model-key").value.trim(),
        },
      };
      return api("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (data) {
        status("Insights generated", "ok");
        renderReport(data, []);
        if (data.report_id) {
          lastReportId = data.report_id;
          return loadHistory().then(function () {
            return loadReport(data.report_id);
          });
        }
        return loadHistory();
      }).catch(function (err) {
        status(err.message || "Insights generation failed", "err");
      }).finally(function () {
        setGenerateDisabled(false);
      });
    }

    document.getElementById("btn-save").addEventListener("click", function () {
      void saveSettings();
    });
    document.getElementById("btn-test").addEventListener("click", function () {
      void testConnection();
    });
    document.getElementById("btn-generate").addEventListener("click", function () {
      void generate();
    });
    document.getElementById("scope-workspace").addEventListener("change", function () {
      void loadHistory();
    });
    document.getElementById("history").addEventListener("click", function (e) {
      var id = getReportIdFromEventTarget(e.target);
      if (id > 0) {
        void loadReport(id);
      }
    });

    renderSourceChecks();
    Promise.all([loadSettings(), loadWorkspaces()])
      .then(function () {
        return loadHistory();
      })
      .then(function () {
        if (lastReportId) return loadReport(lastReportId);
      })
      .catch(function (err) {
        status(err.message || "Failed to initialize insights page", "err");
      });
  </script>
</body>
</html>`;
}

function getQueryParams(url: string): URLSearchParams {
  try {
    return new URL(url, "http://localhost").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

const SOURCE_LABELS: Record<string, string> = {
  cursor: "Cursor IDE",
  copilot: "Copilot (VS Code)",
  "cursor-cli": "Cursor CLI",
  "claude-code": "Claude Code",
  codex: "Codex",
  gemini: "Gemini",
};

function serveSearchApi(
  query: string,
  limit: number,
  source: string | null
): { results: db.MessageResult[] } {
  const limitNum = Math.min(100, Math.max(1, limit || 20));
  const sourceFilter =
    source && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, source) ? (source as db.Source) : undefined;
  
  let results: db.MessageResult[];
  if (!query) {
      results = db.listMessages(limitNum, sourceFilter);
  } else {
      results = db.searchMessages(query, limitNum, sourceFilter);
  }
  return { results };
}

function serveSessionsApi(
  source: string | null,
  workspace: string | null,
  limit: number,
  offset: number,
  query: string | null,
  timeFrom: number | null,
  timeTo: number | null
): {
  sessions: db.SessionListItem[];
  sourceLabels: Record<string, string>;
  total: number;
} {
  const limitNum = Math.min(500, Math.max(1, limit || 100));
  const offsetNum = Math.max(0, offset || 0);
  const sourceFilter =
    source && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, source) ? (source as db.Source) : undefined;
  const workspaceFilter = (workspace ?? "").trim() || undefined;
  const q = (query ?? "").trim();
  const sessions = db.listSessionsAdvanced({
    source: sourceFilter,
    workspace: workspaceFilter,
    limit: limitNum,
    offset: offsetNum,
    query: q,
    timeFrom: typeof timeFrom === "number" ? timeFrom : undefined,
    timeTo: typeof timeTo === "number" ? timeTo : undefined,
  });
  const total = db.countSessionsAdvanced({
    source: sourceFilter,
    workspace: workspaceFilter,
    query: q,
    timeFrom: typeof timeFrom === "number" ? timeFrom : undefined,
    timeTo: typeof timeTo === "number" ? timeTo : undefined,
  });
  return { sessions, sourceLabels: SOURCE_LABELS, total };
}

function serveSessionDetailApi(
  sessionId: number,
  limit: number,
  offset: number,
  order: "asc" | "desc"
): db.SessionDetail | null {
  return db.getSessionDetail(sessionId, limit, offset, order);
}

let runtimeModelApiKey: string | null = null;

function parseIntSafe(value: string | null, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseOptInt(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendLegacyError(res: ServerResponse, status: number, code: string, message: string, extra: Record<string, unknown> = {}): void {
  sendJson(res, status, { error: message, code, ...extra });
}

function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function resolveModelApiKey(settings: db.ModelSettings, apiKeyFromRequest?: string): string | null {
  if (typeof apiKeyFromRequest === "string" && apiKeyFromRequest.trim()) {
    return apiKeyFromRequest.trim();
  }
  if (runtimeModelApiKey && runtimeModelApiKey.trim()) {
    return runtimeModelApiKey.trim();
  }
  const keyRef = settings.key_ref.trim();
  if (keyRef.startsWith("env:")) {
    const envName = keyRef.slice(4).trim();
    if (!envName) return null;
    return process.env[envName] ?? null;
  }
  if (!keyRef) return process.env.ASSISTANT_MEMORY_MODEL_API_KEY ?? null;
  return null;
}

async function testModelConnection(
  settings: db.ModelSettings,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  const baseUrl = (settings.base_url || "https://api.openai.com/v1").replace(/\/+$/, "");
  try {
    const resp = await fetch(baseUrl + "/models", {
      method: "GET",
      headers: { Authorization: "Bearer " + apiKey },
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, message: `Provider error ${resp.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, message: "Connection successful" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { ok: false, message };
  }
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function createHandler() {
  return function handler(req: IncomingMessage, res: ServerResponse): void {
    void (async () => {
      const url = req.url ?? "/";
      const method = req.method ?? "GET";
      const path = url.split("?")[0];
      const userAgent = req.headers["user-agent"] ?? "-";

      console.log(`[${new Date().toISOString()}] ${method} ${url} - ${userAgent}`);

      if (path === "/api/index" && method === "POST") {
        try {
          const stats = runIngest({});
          sendJson(res, 200, { sessions: stats.sessions, messages: stats.messages });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Index failed";
          sendLegacyError(res, 500, "INDEX_FAILED", message, { sessions: 0, messages: 0 });
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
          const workspace =
            (typeof scopeRaw.workspace === "string" ? scopeRaw.workspace.trim() : "") || db.getMostRecentWorkspace() || "";
          if (!workspace) {
            sendError(res, 400, "INVALID_ARGUMENT", "workspace is required");
            return;
          }
          const sources =
            Array.isArray(scopeRaw.sources)
              ? scopeRaw.sources
                  .filter((s): s is string => typeof s === "string" && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, s))
                  .map((s) => s as db.Source)
              : [];
          const timeFrom = typeof scopeRaw.time_from === "number" ? Math.trunc(scopeRaw.time_from) : undefined;
          const timeTo = typeof scopeRaw.time_to === "number" ? Math.trunc(scopeRaw.time_to) : undefined;
          const settings = db.getModelSettings();
          const mode =
            modelRaw.mode === "external" || modelRaw.mode === "local"
              ? modelRaw.mode
              : settings.mode_default;
          if (mode === "external" && !settings.external_enabled) {
            sendError(res, 400, "INSIGHTS_MODEL_NOT_CONFIGURED", "External model is disabled");
            return;
          }
          const modelConfig: InsightModelConfig = { mode };
          if (mode === "external") {
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
          const messages = db.getMessagesForInsightScope({
            workspace,
            timeFrom,
            timeTo,
            sources,
          });
          if (messages.length === 0) {
            sendError(res, 400, "INVALID_ARGUMENT", "No messages found in selected scope");
            return;
          }
          const insight = await generateInsight(messages, modelConfig);
          const reportId = db.insertInsightReport({
            workspace,
            scopeJson: JSON.stringify({ workspace, time_from: timeFrom ?? null, time_to: timeTo ?? null, sources }),
            modelMode: mode,
            provider: modelConfig.provider ?? null,
            modelName: modelConfig.modelName ?? null,
            summaryMd: insight.summary,
            patternsJson: JSON.stringify(insight.patterns),
            feedbackJson: JSON.stringify(insight.feedback),
            scoreEfficiency: insight.scores.efficiency,
            scoreStability: insight.scores.stability,
            scoreDecisionClarity: insight.scores.decision_clarity,
            status: "completed",
          });
          db.insertInsightEvidence(reportId, insight.evidence);
          sendJson(res, 200, {
            report_id: reportId,
            status: "completed",
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
          if (body.mode_default === "local" || body.mode_default === "external") {
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
          if (typeof body.api_key === "string" && body.api_key.trim()) {
            runtimeModelApiKey = body.api_key.trim();
            if (!patch.key_ref) {
              patch.key_ref = "runtime";
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

      if (path === "/api/stats" && method === "GET") {
        try {
          const stats = db.getStats();
          const dbPath = db.getDbPath();
          sendJson(res, 200, { sessions: stats.sessions, messages: stats.messages, dbPath });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to read database";
          sendLegacyError(res, 500, "DB_QUERY_FAILED", message, { sessions: 0, messages: 0, dbPath: null });
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

      if (path === "/insights") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getInsightsPage());
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

      if (url.startsWith("/api/search")) {
        const params = getQueryParams(url);
        const q = (params.get("q") ?? "").trim();
        const limit = parseInt(params.get("limit") ?? "20", 10) || 20;
        const source = params.get("source") || null;
        try {
          const data = serveSearchApi(q, limit, source);
          sendJson(res, 200, data);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Search failed";
          sendLegacyError(res, 500, "SEARCH_FAILED", message, { results: [] });
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
          const reports = rows.map((r) => ({
            id: r.id,
            workspace: r.workspace,
            scope: parseJsonObject(r.scope_json),
            model_mode: r.model_mode,
            provider: r.provider,
            model_name: r.model_name,
            summary: r.summary_md,
            patterns: parseJsonArray(r.patterns_json),
            feedback: parseJsonArray(r.feedback_json),
            scores: {
              efficiency: r.score_efficiency,
              stability: r.score_stability,
              decision_clarity: r.score_decision_clarity,
            },
            status: r.status,
            created_at: r.created_at,
            updated_at: r.updated_at,
          }));
          sendJson(res, 200, { reports, total });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to list insights";
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
              workspace: data.report.workspace,
              scope: parseJsonObject(data.report.scope_json),
              model_mode: data.report.model_mode,
              provider: data.report.provider,
              model_name: data.report.model_name,
              summary: data.report.summary_md,
              patterns: parseJsonArray(data.report.patterns_json),
              feedback: parseJsonArray(data.report.feedback_json),
              scores: {
                efficiency: data.report.score_efficiency,
                stability: data.report.score_stability,
                decision_clarity: data.report.score_decision_clarity,
              },
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
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load insight report";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (url.startsWith("/api/sessions")) {
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
          sendLegacyError(res, 500, "DB_QUERY_FAILED", message, { sessions: [] });
        }
        return;
      }

      if (url.startsWith("/api/session")) {
        const params = getQueryParams(url);
        const sessionId = parseInt(params.get("session_id") ?? "0", 10);
        if (!sessionId) {
          sendLegacyError(res, 400, "INVALID_ARGUMENT", "Missing session_id");
          return;
        }
        const limit = parseIntSafe(params.get("limit"), 2000);
        const offset = parseIntSafe(params.get("offset"), 0);
        const order = params.get("order") === "asc" ? "asc" : "desc";
        try {
          const data = serveSessionDetailApi(sessionId, limit, offset, order);
          if (!data) {
            sendLegacyError(res, 404, "NOT_FOUND", "Session not found");
            return;
          }
          sendJson(res, 200, data);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load session";
          sendLegacyError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Internal server error";
      sendLegacyError(res, 500, "INTERNAL_ERROR", message);
    });
  };
}

export function startServer(port: number = DEFAULT_PORT): void {
  const server = createServer(createHandler());
  server.listen(port, () => {
    console.error("Assistant Memory – web search");
    console.error("Open http://localhost:" + port + " in your browser.");
  });
}
