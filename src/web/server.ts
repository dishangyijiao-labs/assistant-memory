import { createServer, type IncomingMessage, type ServerResponse } from "http";
import * as db from "../storage/db.js";
import { runIngest } from "../ingest/index.js";

const DEFAULT_PORT = 3000;

function getSearchPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Assistant Memory – Chats & Search</title>
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
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; }
    .sub { color: var(--muted); font-size: 0.875rem; margin-bottom: 1rem; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
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
    #list { margin-top: 0.5rem; min-height: 120px; }
    #list.chat-list { display: block !important; }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.6rem;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .card:hover { border-color: var(--accent); background: #f0f4ff; }
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
    .card-workspace {
      font-size: 0.875rem;
      color: var(--text);
      word-break: break-all;
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
    .count { font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem; }
    .empty-state {
      padding: 1.5rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-top: 0.5rem;
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
    .section-title {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin: 1rem 0 0.5rem;
    }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-top: 0.75rem;
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
  </style>
</head>
<body>
  <div class="container">
    <h1>Assistant Memory</h1>
    <p class="sub">Browse chat records and search by keyword (Cursor IDE, Copilot, Cursor/Claude Code/Codex/Gemini CLI)</p>
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
      <button type="button" class="btn-index" id="btn-index" title="Index local chat history from Cursor, Copilot, CLI">Index now</button>
    </div>
    <p class="count" id="db-status" aria-live="polite"></p>
    <div class="section-title">Sessions</div>
    <p class="count" id="session-count"></p>
    <div id="list" class="chat-list" role="region" aria-label="Sessions list"></div>
    <div class="pagination" id="pagination">
      <button type="button" id="prev-page">Previous</button>
      <span class="page-info" id="page-info"></span>
      <button type="button" id="next-page">Next</button>
    </div>
  </div>
  <script>
    var currentSource = "";
    var currentQuery = "";
    var currentPage = 1;
    var pageSize = 50;
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
      } catch (_e) {
        // Fall back to manual UTC+8 formatting below
      }
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
            document.getElementById("list").innerHTML = '<div class="empty-state"><p class="error">' + escapeHtml(data.error) + '</p></div>';
            if (countEl) countEl.textContent = "Error";
            updatePagination(0);
            return;
          }
          if (!data.sessions || data.sessions.length === 0) {
            document.getElementById("list").innerHTML = '<div class="empty-state"><p class="empty">No sessions found.</p></div>';
            if (countEl) countEl.textContent = "0 sessions";
            updatePagination(0);
            return;
          }
          if (countEl && typeof data.total === "number") countEl.textContent = data.total + " session(s)";
          var html = data.sessions.map(function (s) {
            var date = formatBeijingTime(s.last_at);
            var label = sourceLabels[s.source] || s.source || "?";
            return '<div class="card" data-session-id="' + s.id + '">' +
              '<div class="card-meta"><span class="source">' + escapeHtml(label) + '</span><span>' + escapeHtml(s.workspace || "(default)") + '</span><span>' + escapeHtml(date) + '</span></div>' +
              '<div class="card-snippet">' + escapeHtml(String(s.message_count || 0)) + ' messages</div>' +
            '</div>';
          }).join("");
          document.getElementById("list").innerHTML = html;
          updatePagination(typeof data.total === "number" ? data.total : data.sessions.length);
        })
        .catch(function () {
          document.getElementById("list").innerHTML = '<div class="empty-state"><p class="error">Failed to load sessions.</p></div>';
          var countEl = document.getElementById("session-count");
          if (countEl) countEl.textContent = "Error";
          updatePagination(0);
        });
    }

    function goToSessionDetail(sessionId, messageId) {
      if (!sessionId) return;
      var url = "/session?session_id=" + encodeURIComponent(String(sessionId));
      if (messageId) url += "&message_id=" + encodeURIComponent(String(messageId));
      window.location.href = url;
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
      var listEl = document.getElementById("list");
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
      loadSessions();
    });

    document.getElementById("list").addEventListener("click", function (e) {
      var card = e.target.closest(".card[data-session-id]");
      if (!card) return;
      var sessionId = card.getAttribute("data-session-id");
      goToSessionDetail(sessionId, null);
    });

    document.getElementById("search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      currentQuery = document.getElementById("q").value || "";
      currentPage = 1;
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

    document.getElementById("btn-index").addEventListener("click", runIndex);
    // Load recent messages by default
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

function serveSessionsApi(source: string | null, limit: number, offset: number, query: string | null): {
  sessions: db.SessionListItem[];
  sourceLabels: Record<string, string>;
  total: number;
} {
  const limitNum = Math.min(500, Math.max(1, limit || 100));
  const offsetNum = Math.max(0, offset || 0);
  const sourceFilter =
    source && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, source) ? (source as db.Source) : undefined;
  const q = (query ?? "").trim();
  const sessions = db.listSessions({ source: sourceFilter, limit: limitNum, offset: offsetNum, query: q });
  const total = db.countSessions({ source: sourceFilter, query: q });
  return { sessions, sourceLabels: SOURCE_LABELS, total };
}

function serveSessionDetailApi(sessionId: number): db.SessionDetail | null {
  return db.getSessionDetail(sessionId);
}

export function createHandler() {
  return function handler(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";
    const path = url.split("?")[0];
    const userAgent = req.headers["user-agent"] ?? "-";

    console.log(`[${new Date().toISOString()}] ${method} ${url} - ${userAgent}`);

    if (path === "/api/index" && method === "POST") {
      try {
        const stats = runIngest({});
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ sessions: stats.sessions, messages: stats.messages }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Index failed";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message, sessions: 0, messages: 0 }));
      }
      return;
    }

    if (path === "/api/stats" && method === "GET") {
      try {
        const stats = db.getStats();
        const dbPath = db.getDbPath();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ sessions: stats.sessions, messages: stats.messages, dbPath }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to read database";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message, sessions: 0, messages: 0, dbPath: null }));
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

    if (url.startsWith("/api/search")) {
      const params = getQueryParams(url);
      const q = (params.get("q") ?? "").trim();
      const limit = parseInt(params.get("limit") ?? "20", 10) || 20;
      console.log(`Search query: "${q}", limit: ${limit}, source: ${params.get("source")}`);
      // Allow empty query to list recent messages
      const source = params.get("source") || null;
      try {
        const data = serveSearchApi(q, limit, source);
        console.log(`Search found ${data.results.length} results`);
        res.writeHead(200, { "Content-Type": "application/json" });
        const json = JSON.stringify(data);
        res.end(json);
      } catch (err) {
        console.error("Search error:", err);
        const message = err instanceof Error ? err.message : "Search failed";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message, results: [] }));
      }
      return;
    }

    if (url.startsWith("/api/sessions")) {
      const params = getQueryParams(url);
      const source = params.get("source") || null;
      const limit = parseInt(params.get("limit") ?? "500", 10) || 100;
      const offset = parseInt(params.get("offset") ?? "0", 10) || 0;
      const query = params.get("q");
      console.log(`List sessions source: ${source}, limit: ${limit}, offset: ${offset}`);
      try {
        const data = serveSessionsApi(source, limit, offset, query);
        console.log(`Sessions found: ${data.sessions.length}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        const json = JSON.stringify(data);
        res.end(json);
      } catch (err) {
        console.error("List sessions error:", err);
        const message = err instanceof Error ? err.message : "Failed to list sessions";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message, sessions: [] }));
      }
      return;
    }

    if (url.startsWith("/api/session")) {
      const params = getQueryParams(url);
      const sessionId = parseInt(params.get("session_id") ?? "0", 10);
      if (!sessionId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing session_id" }));
        return;
      }
      try {
        const data = serveSessionDetailApi(sessionId);
        if (!data) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Session not found" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load session";
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  };
}

export function startServer(port: number = DEFAULT_PORT): void {
  const server = createServer(createHandler());
  server.listen(port, () => {
    console.error("Assistant Memory – web search");
    console.error("Open http://localhost:" + port + " in your browser.");
  });
}
