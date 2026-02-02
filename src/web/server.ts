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
      --bg: #0f0f12;
      --surface: #1a1a1f;
      --border: #2a2a32;
      --text: #e8e8ec;
      --muted: #888;
      --accent: #6b7fff;
      --accent-hover: #8492ff;
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
    .container { max-width: 800px; margin: 0 auto; }
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
    #list, #results { margin-top: 0.5rem; min-height: 120px; }
    #list.chat-list { display: block !important; }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.6rem;
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
        <input type="search" name="q" id="q" placeholder="Keyword search (or empty for recent messages)…" />
        <button type="submit">Search</button>
      </form>
      <button type="button" class="btn-index" id="btn-index" title="Index local chat history from Cursor, Copilot, CLI">Index now</button>
    </div>
    <p class="count" id="count"></p>
    <p class="count" id="db-status" aria-live="polite"></p>
    <div id="results" class="chat-list" role="region" aria-label="Search results"></div>
    <div id="list" style="display:none"></div>
  </div>
  <script>
    var currentSource = "";
    var sourceLabels = { cursor: "Cursor IDE", copilot: "Copilot (VS Code)", "cursor-cli": "Cursor CLI", "claude-code": "Claude Code", codex: "Codex", gemini: "Gemini" };

    function escapeHtml(s) {
      var div = document.createElement("div");
      div.textContent = s;
      return div.innerHTML;
    }

    function renderSearchResults(results, error) {
      console.log("renderSearchResults called with:", results ? results.length + " results" : "error", error);
      
      var resultsEl = document.getElementById("results");
      var countEl = document.getElementById("count");
      
      if (!resultsEl) {
        console.error("Results element not found in renderSearchResults!");
        return;
      }
      
      resultsEl.style.display = "block";

      if (error) {
        console.error("Rendering error state:", error);
        countEl.textContent = "Error";
        resultsEl.innerHTML = '<div class="empty-state"><p class="error">' + escapeHtml(String(error)) + '</p></div>';
        return;
      }
      if (!results || results.length === 0) {
        console.log("No results to display");
        countEl.textContent = "";
        resultsEl.innerHTML = '<div class="empty-state"><p class="empty">No matches found. Try Indexing if you have not yet.</p></div>';
        return;
      }
      
      try {
        console.log("Rendering", results.length, "results");
        countEl.textContent = results.length + " message(s)";
        var html = results.map(function (r) {
          var dateVal = r.last_at ? new Date(r.last_at) : new Date();
          var date = !isNaN(dateVal.getTime()) ? dateVal.toISOString() : "Unknown date";
          var label = sourceLabels[r.source] || r.source || "?";
          return '<div class="card"><div class="card-meta"><span class="source">' + escapeHtml(label) + '</span><span>' + escapeHtml(r.workspace || "(default)") + '</span><span>' + escapeHtml(date) + '</span></div><div class="card-snippet">' + escapeHtml(r.snippet || "(no content)") + '</div></div>';
        }).join("");
        resultsEl.innerHTML = html;
        console.log("Rendered HTML length:", html.length);
      } catch (e) {
          console.error("Render error:", e);
          resultsEl.innerHTML = '<div class="empty-state"><p class="error">Render error: ' + escapeHtml(String(e)) + '</p></div>';
      }
    }

    function runSearch(query) {
      var q = (query || "").trim();
      var countEl = document.getElementById("count");
      var resultsEl = document.getElementById("results");
      
      if (!resultsEl) {
        console.error("Results element not found!");
        return;
      }
      
      countEl.textContent = q ? "Searching…" : "Loading recent messages…";
      resultsEl.style.display = "block";
      
      var params = "q=" + encodeURIComponent(q) + "&limit=50";
      if (currentSource) params += "&source=" + encodeURIComponent(currentSource);
      
      console.log("Fetching:", "/api/search?" + params);
      
      fetch("/api/search?" + params)
        .then(function (res) { 
          console.log("Response status:", res.status);
          return res.json(); 
        })
        .then(function (data) { 
          console.log("Data received:", data);
          renderSearchResults(data.results);
          loadDbStatus();
        })
        .catch(function (err) { 
          console.error("Fetch error:", err);
          renderSearchResults(null, err.message || "Request failed"); 
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
      var resultsEl = document.getElementById("results");
      if (btn) { btn.disabled = true; btn.textContent = "Indexing…"; }
      document.getElementById("count").textContent = "Indexing local chat history…";
      resultsEl.innerHTML = '<div class="empty-state"><p>Reading Cursor, Copilot, Cursor CLI, Claude Code, Codex, Gemini data from disk…</p></div>';
      fetch("/api/index", { method: "POST" })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (out) {
          if (!out.ok) {
            document.getElementById("count").textContent = "Index failed";
            resultsEl.innerHTML = '<div class="empty-state"><p class="error">Error: ' + escapeHtml(out.data.error || "Index failed") + '</p><p>Run <code>npx assistant-memory index</code> in a terminal to index from the same machine.</p></div>';
            if (btn) { btn.disabled = false; btn.textContent = "Index now"; }
            loadDbStatus();
            return;
          }
          document.getElementById("count").textContent = "Indexed " + (out.data.sessions || 0) + " sessions, " + (out.data.messages || 0) + " messages. Reloading…";
          runSearch("");
          if (btn) { btn.disabled = false; btn.textContent = "Index now"; }
        })
        .catch(function (err) {
          document.getElementById("count").textContent = "Index failed";
          resultsEl.innerHTML = '<div class="empty-state"><p class="error">Error: ' + escapeHtml(err.message || "Index failed") + '</p><p>Run <code>npx assistant-memory index</code> in a terminal, then refresh this page.</p></div>';
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
      runSearch(document.getElementById("q").value || "");
    });

    document.getElementById("search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      runSearch(document.getElementById("q").value || "");
    });

    document.getElementById("btn-index").addEventListener("click", runIndex);
    // Load recent messages by default
    runSearch(""); 
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

function serveSessionsApi(source: string | null, limit: number, offset: number): {
  sessions: db.SessionListItem[];
  sourceLabels: Record<string, string>;
} {
  const limitNum = Math.min(500, Math.max(1, limit || 100));
  const offsetNum = Math.max(0, offset || 0);
  const sourceFilter =
    source && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, source) ? (source as db.Source) : undefined;
  const sessions = db.listSessions({ source: sourceFilter, limit: limitNum, offset: offsetNum });
  return { sessions, sourceLabels: SOURCE_LABELS };
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
      console.log(`List sessions source: ${source}, limit: ${limit}, offset: ${offset}`);
      try {
        const data = serveSessionsApi(source, limit, offset);
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
