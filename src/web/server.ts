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
  <title>Assistant Memory</title>
  <style>
    :root {
      --bg: #f9fafb;
      --sidebar-bg: #ffffff;
      --surface: #f3f4f6;
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --accent-soft: #eff6ff;
      --user-bubble: #f3f4f6;
      --assistant-bg: #ffffff;
      --code-bg: #1e293b;
      --code-text: #e2e8f0;
      --index-bg: #f97316;
      --index-hover: #ea580c;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 1.5;
    }

    /* Layout */
    .layout { display: flex; height: 100vh; }

    /* Sidebar */
    .sidebar {
      width: 280px;
      min-width: 280px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      height: 100vh;
      position: relative;
    }
    .sidebar-header { padding: 1.25rem 1rem 0.5rem; }
    .sidebar-header h1 { font-size: 1.05rem; font-weight: 700; color: var(--text); }

    .sidebar-filters { padding: 0 1rem; padding-bottom: 0.5rem; }

    .search-wrap { position: relative; }
    .search-wrap input {
      width: 100%; padding: 0.45rem 0.75rem 0.45rem 2.1rem;
      font: inherit; font-size: 0.85rem;
      background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text);
    }
    .search-wrap input::placeholder { color: var(--muted); }
    .search-wrap input:focus { outline: none; border-color: var(--accent); }
    .search-icon {
      position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%);
      width: 14px; height: 14px; color: var(--muted); pointer-events: none;
    }

    /* Session list */
    .session-list { flex: 1; overflow-y: auto; min-height: 0; }
    .session-item {
      padding: 0.6rem 1rem;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.12s, border-color 0.12s;
    }
    .session-item:hover { background: var(--surface); }
    .session-item.active {
      background: var(--accent-soft);
      border-left-color: var(--accent);
    }
    .session-item.focused { background: var(--surface); }
    .session-item-title {
      font-size: 0.88rem; font-weight: 600; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 0.15rem;
    }
    .session-item-meta {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.75rem;
    }
    .source-badge { font-weight: 600; font-size: 0.72rem; color: var(--muted); }
    .session-time { color: var(--muted); }

    /* Sidebar footer */
    .sidebar-foot {
      padding: 0.65rem 1rem; border-top: 1px solid var(--border);
      display: flex; align-items: center; justify-content: flex-start;
    }
    .btn-settings {
      background: none; border: none; color: var(--muted); cursor: pointer;
      display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem;
      font: inherit; font-size: 0.85rem; font-weight: 500;
    }
    .btn-settings:hover { color: var(--text); }
    .btn-settings svg { width: 16px; height: 16px; }
    .settings-label { color: var(--muted); }
    .btn-settings:hover .settings-label { color: var(--text); }

    /* Content panel */
    .content {
      flex: 1; display: flex; flex-direction: column;
      height: 100vh; min-width: 0; background: var(--bg);
    }
    .content-header {
      padding: 1.1rem 1.5rem 0.75rem;
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 1rem;
    }
    .content-header h2 {
      font-size: 1.05rem; font-weight: 600; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
    }
    .header-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
    .action-btn {
      padding: 0.3rem 0.65rem; font: inherit; font-size: 0.75rem;
      background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
      color: var(--muted); cursor: pointer; transition: border-color 0.12s, color 0.12s;
    }
    .action-btn:hover { border-color: var(--accent); color: var(--text); }
    .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Messages area */
    .messages-area {
      flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem;
      display: flex; flex-direction: column; gap: 1rem; min-height: 0;
    }

    /* Chat messages */
    .chat-msg { display: flex; gap: 0.6rem; max-width: 82%; }
    .chat-msg.msg-user { align-self: flex-end; flex-direction: row-reverse; }
    .chat-msg.msg-assistant { align-self: flex-start; }
    .chat-msg.msg-system { align-self: center; max-width: 90%; }

    .avatar {
      width: 32px; height: 32px; min-width: 32px;
      border-radius: 50%; background: var(--accent);
      display: flex; align-items: center; justify-content: center;
      margin-top: 0.15rem; flex-shrink: 0;
    }
    .avatar svg { width: 16px; height: 16px; fill: white; }

    .bubble {
      padding: 0.7rem 1rem; border-radius: 14px;
      font-size: 0.88rem; line-height: 1.6; word-break: break-word;
    }
    .bubble-user {
      background: var(--user-bubble); color: var(--text);
      border: 1px solid var(--border); border-bottom-right-radius: 4px;
    }
    .bubble-assistant {
      background: var(--assistant-bg); color: var(--text);
      border: 1px solid var(--border); border-bottom-left-radius: 4px;
    }
    .bubble-system {
      background: #fef3c7; color: var(--text); border: 1px solid #fde68a;
    }

    /* Markdown in bubbles */
    .bubble p { margin: 0.25rem 0; }
    .bubble p:first-child { margin-top: 0; }
    .bubble p:last-child { margin-bottom: 0; }
    .bubble ul, .bubble ol { margin: 0.3rem 0; padding-left: 1.2rem; }
    .bubble li { margin: 0.12rem 0; }
    .bubble h1, .bubble h2, .bubble h3, .bubble h4 {
      margin: 0.5rem 0 0.2rem; font-size: 0.92rem; font-weight: 600;
    }
    .bubble blockquote {
      border-left: 3px solid var(--border); margin: 0.3rem 0;
      padding: 0.2rem 0.6rem; color: var(--muted);
    }
    .bubble a { color: var(--accent); text-decoration: underline; }
    .bubble strong { font-weight: 600; }
    .bubble code {
      background: rgba(0,0,0,0.07); padding: 0.1rem 0.3rem; border-radius: 3px;
      font-family: "SF Mono", Consolas, Monaco, monospace; font-size: 0.82rem;
    }
    .bubble table { border-collapse: collapse; margin: 0.3rem 0; font-size: 0.8rem; }
    .bubble th, .bubble td { border: 1px solid var(--border); padding: 0.2rem 0.45rem; }
    .bubble th { background: var(--surface); }

    /* Code blocks */
    .code-wrap {
      margin: 0.45rem 0; border-radius: 8px; overflow: hidden;
      background: var(--code-bg);
    }
    .code-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.35rem 0.75rem;
      background: rgba(255,255,255,0.06);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .code-lang {
      font-size: 0.72rem; color: rgba(255,255,255,0.45);
      font-family: "SF Mono", Consolas, monospace;
    }
    .code-copy {
      background: none; border: none; color: rgba(255,255,255,0.45);
      cursor: pointer; padding: 0.1rem 0.25rem; border-radius: 3px;
      font-size: 0.72rem; transition: color 0.12s, background 0.12s;
      display: flex; align-items: center; gap: 0.25rem;
    }
    .code-copy:hover { color: #fff; background: rgba(255,255,255,0.1); }
    .code-copy svg { width: 13px; height: 13px; }
    .code-wrap pre {
      margin: 0; padding: 0.75rem; overflow-x: auto;
      color: var(--code-text);
      font-family: "SF Mono", Consolas, Monaco, monospace;
      font-size: 0.8rem; line-height: 1.55;
    }
    .code-wrap pre code { background: none; padding: 0; color: inherit; font-size: inherit; }

    /* Utilities */
    mark { background: #fef08a; padding: 0 0.1rem; border-radius: 2px; }
    .hidden { display: none !important; }
    .toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      background: var(--text); color: #fff;
      padding: 0.5rem 1rem; border-radius: 8px;
      font-size: 0.82rem; opacity: 0; transition: opacity 0.25s;
      pointer-events: none; z-index: 9999;
    }
    .toast.show { opacity: 1; }
    .skeleton {
      background: linear-gradient(90deg, var(--surface) 25%, #e8ebf0 50%, var(--surface) 75%);
      background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .skeleton-session { height: 48px; margin: 0.3rem 1rem; border-radius: 4px; }
    .skeleton-msg { height: 56px; margin-bottom: 0.75rem; border-radius: 14px; max-width: 65%; }
    .skeleton-msg:nth-child(odd) { align-self: flex-end; max-width: 55%; }
    .empty-state {
      padding: 2rem 1.5rem; text-align: center; color: var(--muted);
    }
    .empty-state p { margin: 0 0 0.5rem; }
    .empty-state .guidance { font-size: 0.82rem; line-height: 1.6; }
    .empty-state code { background: var(--surface); padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.78rem; }
    .error { color: #ef4444; }

    @media (max-width: 768px) {
      .sidebar { width: 240px; min-width: 240px; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>Assistant Memory</h1>
      </div>
      <div class="sidebar-filters">
        <form id="search-form" class="search-wrap" role="search">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
          <input type="search" id="q" name="q" placeholder="Search..." />
        </form>
      </div>
      <div class="session-list" id="session-list" role="listbox" tabindex="0"></div>
      <div class="sidebar-foot">
        <button type="button" class="btn-settings" id="btn-settings" title="Settings">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/></svg>
          <span class="settings-label">Settings</span>
        </button>
      </div>
    </aside>
    <main class="content">
      <div class="content-header" id="content-header">
        <h2 id="session-title">Select a session</h2>
        <div class="header-actions">
          <button type="button" class="action-btn" id="copy-session" disabled title="Copy session">Copy</button>
        </div>
      </div>
      <div class="messages-area" id="messages">
        <div class="empty-state">
          <p>Select a session from the sidebar</p>
          <p class="guidance">If no sessions appear, run <code>npx assistant-memory index</code></p>
        </div>
      </div>
    </main>
  </div>
  <div class="toast" id="toast"></div>
  <script>
    var currentQuery = "";
    var currentSessions = [];
    var selectedSession = null;
    var selectedMessages = [];
    var focusedIndex = -1;
    var loadedOffset = 0;
    var batchSize = 50;
    var isLoadingMore = false;
    var hasMoreSessions = true;
    var sourceLabels = {
      cursor: "Cursor IDE", copilot: "Copilot", "cursor-cli": "Cursor CLI",
      "claude-code": "Claude Code", codex: "Codex", gemini: "Gemini"
    };

    function showToast(text) {
      var el = document.getElementById("toast");
      el.textContent = text;
      el.classList.add("show");
      clearTimeout(el._timer);
      el._timer = setTimeout(function () { el.classList.remove("show"); }, 2000);
    }

    function copyToClipboard(text, label) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showToast(label || "Copied!");
        }).catch(function () { showToast("Copy failed"); });
      }
    }

    function escapeHtml(s) {
      var div = document.createElement("div");
      div.textContent = s;
      return div.innerHTML;
    }

    function formatTime(ts) {
      var d = ts ? new Date(ts) : new Date();
      if (isNaN(d.getTime())) return "Unknown";
      try {
        return new Intl.DateTimeFormat(undefined, {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", hour12: false,
        }).format(d);
      } catch (_e) {}
      return d.toISOString();
    }

    function timeAgo(ts) {
      if (!ts) return "";
      var now = Date.now();
      var diff = now - ts;
      if (diff < 0) diff = 0;
      var sec = Math.floor(diff / 1000);
      if (sec < 60) return "just now";
      var min = Math.floor(sec / 60);
      if (min < 60) return min + " min ago";
      var hr = Math.floor(min / 60);
      if (hr < 24) return hr + (hr === 1 ? " hour ago" : " hours ago");
      var days = Math.floor(hr / 24);
      if (days === 1) return "Yesterday";
      if (days < 7) return days + " days ago";
      return formatTime(ts);
    }

    function getSessionTitle(session) {
      var ws = session.workspace || "";
      if (!ws) return "Session #" + session.id;
      var parts = ws.replace(/\\\\/g, "/").split("/").filter(Boolean);
      var name = parts[parts.length - 1] || "";
      if (!name) return "Session #" + session.id;
      return name.replace(/[-_]/g, " ").replace(/\\b[a-z]/g, function(c) { return c.toUpperCase(); });
    }

    var avatarSvg = '<svg viewBox="0 0 16 16" fill="white"><path d="M8 1l1.3 3.9L13.2 6.2l-3.9 1.3L8 11.4 6.7 7.5 2.8 6.2l3.9-1.3z"/><path d="M12 10l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" opacity=".6"/></svg>';
    var copySvg = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="5" y="5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 10.5H3a1.5 1.5 0 01-1.5-1.5V3A1.5 1.5 0 013 1.5h6A1.5 1.5 0 0110.5 3v.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';

    function renderMarkdown(raw) {
      if (!raw) return "<p>(empty)</p>";
      var s = raw;
      var blocks = [];
      s = s.replace(/\\\`\\\`\\\`(\\w*?)\\n([\\s\\S]*?)\\\`\\\`\\\`/g, function(_, lang, code) {
        var idx = blocks.length;
        var langLabel = lang || "code";
        blocks.push('<div class="code-wrap"><div class="code-head"><span class="code-lang">' + escapeHtml(langLabel) + '</span><button type="button" class="code-copy" title="Copy code">' + copySvg + '</button></div><pre><code>' + escapeHtml(code.replace(/\\n$/, '')) + '</code></pre></div>');
        return '%%BLOCK' + idx + '%%';
      });
      s = escapeHtml(s);
      for (var i = 0; i < blocks.length; i++) {
        s = s.replace('%%BLOCK' + i + '%%', blocks[i]);
      }
      s = s.replace(/\\\`([^\\\`]+?)\\\`/g, '<code>$1</code>');
      s = s.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      s = s.replace(/(?:^|\\n)#{3}\\s+(.+)/g, '<h3>$1</h3>');
      s = s.replace(/(?:^|\\n)#{2}\\s+(.+)/g, '<h2>$1</h2>');
      s = s.replace(/(?:^|\\n)#{1}\\s+(.+)/g, '<h1>$1</h1>');
      s = s.replace(/(?:^|\\n)&gt;\\s?(.+)/g, '<blockquote>$1</blockquote>');
      s = s.replace(/(?:^|\\n)[-*]\\s+(.+)/g, '<li>$1</li>');
      s = s.replace(/(<li>.*<\\/li>)/gs, '<ul>$1</ul>');
      s = s.replace(/<\\/ul>\\s*<ul>/g, '');
      s = s.replace(/(?:^|\\n)(\\d+)\\.\\s+(.+)/g, '<li>$2</li>');
      s = s.replace(/\\n{2,}/g, '</p><p>');
      s = s.replace(/\\n/g, '<br/>');
      if (!s.startsWith('<')) s = '<p>' + s + '</p>';
      return s;
    }

    function highlightSearchTerms(html, query) {
      if (!query || !query.trim()) return html;
      var terms = query.trim().split(/\\s+/).filter(function(t) { return t.length >= 2; });
      if (!terms.length) return html;
      var regex = new RegExp('(' + terms.map(function(t) { return t.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$$&'); }).join('|') + ')', 'gi');
      return html.replace(/>([^<]+)</g, function(match, text) {
        return '>' + text.replace(regex, '<mark>$1</mark>') + '<';
      });
    }

    function showSessionSkeleton() {
      document.getElementById("session-list").innerHTML =
        '<div class="skeleton skeleton-session"></div>'.repeat(8);
    }

    function showMessageSkeleton() {
      document.getElementById("messages").innerHTML =
        '<div class="skeleton skeleton-msg" style="width:58%"></div>' +
        '<div class="skeleton skeleton-msg" style="width:72%"></div>' +
        '<div class="skeleton skeleton-msg" style="width:50%"></div>' +
        '<div class="skeleton skeleton-msg" style="width:65%"></div>';
    }


    function setMessagePanelEmpty(text, showGuide) {
      selectedMessages = [];
      var html = '<div class="empty-state"><p>' + escapeHtml(text) + '</p>';
      if (showGuide) {
        html += '<p class="guidance">Click <strong>Index Now</strong> to scan AI chat history, or run <code>npx assistant-memory index</code></p>';
      }
      html += '</div>';
      document.getElementById("messages").innerHTML = html;
      document.getElementById("copy-session").disabled = true;
    }

    function renderMessages(messages) {
      selectedMessages = messages || [];
      if (!messages || messages.length === 0) {
        setMessagePanelEmpty("No messages found in this session.", false);
        return;
      }
      var html = messages.map(function (m) {
        var role = (m.role || "assistant").toLowerCase();
        var msgClass = role === "user" ? "msg-user" : role === "assistant" ? "msg-assistant" : "msg-system";
        var bubbleClass = role === "user" ? "bubble-user" : role === "assistant" ? "bubble-assistant" : "bubble-system";
        var content = renderMarkdown(m.content || "(empty)");
        if (currentQuery) content = highlightSearchTerms(content, currentQuery);
        var avatarHtml = role === "assistant" ? '<div class="avatar">' + avatarSvg + '</div>' : '';
        return '<div class="chat-msg ' + msgClass + '">' +
          avatarHtml +
          '<div class="bubble ' + bubbleClass + '">' + content + '</div>' +
        '</div>';
      }).join("");
      document.getElementById("messages").innerHTML = html;
      document.getElementById("copy-session").disabled = false;
    }

    function renderSessions(list) {
      var host = document.getElementById("session-list");
      if (!list || list.length === 0) {
        host.innerHTML = '<div class="empty-state"><p>No sessions found.</p><p class="guidance">Try adjusting your filters, or click <strong>Index Now</strong>.</p></div>';
        return;
      }
      var html = list.map(function (s, idx) {
        var active = selectedSession && String(selectedSession.id) === String(s.id) ? " active" : "";
        var focused = idx === focusedIndex ? " focused" : "";
        var title = getSessionTitle(s);
        var label = sourceLabels[s.source] || s.source || "?";
        var ago = timeAgo(s.last_at);
        return '<div class="session-item' + active + focused + '" data-session-id="' + s.id + '" data-index="' + idx + '" role="option"' + (active ? ' aria-selected="true"' : '') + '>' +
          '<div class="session-item-title" title="' + escapeHtml(s.workspace || "") + '">' + escapeHtml(title) + '</div>' +
          '<div class="session-item-meta">' +
            '<span class="source-badge">' + escapeHtml(label) + '</span>' +
            '<span class="session-time">' + escapeHtml(ago) + '</span>' +
          '</div>' +
        '</div>';
      }).join("");
      host.innerHTML = html;
    }

    function setSessionHeader(session) {
      var titleEl = document.getElementById("session-title");
      if (!session) {
        titleEl.textContent = "Select a session";
        return;
      }
      titleEl.textContent = getSessionTitle(session);
    }

    function loadSessionDetail(sessionId) {
      if (!sessionId) {
        selectedSession = null;
        setSessionHeader(null);
        setMessagePanelEmpty("Select a session from the sidebar.", true);
        return;
      }
      showMessageSkeleton();
      fetch("/api/session?session_id=" + encodeURIComponent(String(sessionId)) + "&order=asc&limit=5000")
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) {
            setMessagePanelEmpty(typeof data.error === "string" ? data.error : data.error.message || "Error", false);
            return;
          }
          selectedSession = data.session || selectedSession;
          setSessionHeader(selectedSession);
          renderMessages(data.messages || []);
        })
        .catch(function () {
          setMessagePanelEmpty("Failed to load session messages.", false);
        });
    }

    function loadSessions() {
      showSessionSkeleton();
      loadedOffset = 0;
      hasMoreSessions = true;
      var params = "limit=" + batchSize + "&offset=0";
      if (currentQuery) params += "&q=" + encodeURIComponent(currentQuery);
      fetch("/api/sessions?" + params)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var errMsg = data.error ? (typeof data.error === "string" ? data.error : data.error.message || "Error") : null;
          if (errMsg) {
            document.getElementById("session-list").innerHTML = '<div class="empty-state"><p class="error">' + escapeHtml(errMsg) + '</p></div>';
            setSessionHeader(null);
            setMessagePanelEmpty("Select a session from the sidebar.", false);
            return;
          }
          var list = data.sessions || [];
          currentSessions = list;
          loadedOffset = list.length;
          hasMoreSessions = list.length >= batchSize;
          focusedIndex = -1;
          if (!list.length) {
            document.getElementById("session-list").innerHTML = '<div class="empty-state"><p>No sessions found.</p><p class="guidance">Click <strong>Index Now</strong> to scan chat history.</p></div>';
            selectedSession = null;
            setSessionHeader(null);
            setMessagePanelEmpty("No sessions found.", true);
            return;
          }
          if (!selectedSession || !list.some(function (s) { return String(s.id) === String(selectedSession.id); })) {
            selectedSession = list[0];
            focusedIndex = 0;
          } else {
            selectedSession = list.find(function (s) { return String(s.id) === String(selectedSession.id); }) || list[0];
            focusedIndex = list.indexOf(selectedSession);
          }
          renderSessions(list);
          setSessionHeader(selectedSession);
          loadSessionDetail(selectedSession.id);
        })
        .catch(function () {
          document.getElementById("session-list").innerHTML = '<div class="empty-state"><p class="error">Failed to load sessions.</p></div>';
          setSessionHeader(null);
          setMessagePanelEmpty("Select a session from the sidebar.", false);
        });
    }

    function loadMoreSessions() {
      if (isLoadingMore || !hasMoreSessions) return;
      isLoadingMore = true;
      var params = "limit=" + batchSize + "&offset=" + loadedOffset;
      if (currentQuery) params += "&q=" + encodeURIComponent(currentQuery);
      fetch("/api/sessions?" + params)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          isLoadingMore = false;
          var errMsg = data.error ? (typeof data.error === "string" ? data.error : data.error.message || "Error") : null;
          if (errMsg) return;
          var list = data.sessions || [];
          if (list.length === 0) {
            hasMoreSessions = false;
            return;
          }
          currentSessions = currentSessions.concat(list);
          loadedOffset += list.length;
          hasMoreSessions = list.length >= batchSize;
          renderSessions(currentSessions);
        })
        .catch(function () {
          isLoadingMore = false;
        });
    }


    function selectSessionByIndex(idx) {
      if (idx < 0 || idx >= currentSessions.length) return;
      focusedIndex = idx;
      selectedSession = currentSessions[idx];
      renderSessions(currentSessions);
      setSessionHeader(selectedSession);
      loadSessionDetail(selectedSession.id);
      var item = document.querySelector('.session-item[data-index="' + idx + '"]');
      if (item) item.scrollIntoView({ block: "nearest" });
    }

    /* Event listeners */
    document.addEventListener("keydown", function (e) {
      var tag = document.activeElement ? document.activeElement.tagName : "";
      var isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        document.getElementById("q").focus();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        window.location.href = "/insights";
        return;
      }
      if (isInput) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        var next = Math.min(focusedIndex + 1, currentSessions.length - 1);
        if (next !== focusedIndex) {
          focusedIndex = next;
          renderSessions(currentSessions);
          var item = document.querySelector('.session-item[data-index="' + next + '"]');
          if (item) item.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        var prev = Math.max(focusedIndex - 1, 0);
        if (prev !== focusedIndex) {
          focusedIndex = prev;
          renderSessions(currentSessions);
          var item = document.querySelector('.session-item[data-index="' + prev + '"]');
          if (item) item.scrollIntoView({ block: "nearest" });
        }
        return;
      }
      if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < currentSessions.length) {
        e.preventDefault();
        selectSessionByIndex(focusedIndex);
        return;
      }
    });

    document.getElementById("session-list").addEventListener("click", function (e) {
      var item = e.target.closest(".session-item[data-session-id]");
      if (!item) return;
      var idx = parseInt(item.getAttribute("data-index") || "0", 10);
      selectSessionByIndex(idx);
    });

    document.getElementById("session-list").addEventListener("scroll", function () {
      var el = this;
      var scrollTop = el.scrollTop;
      var scrollHeight = el.scrollHeight;
      var clientHeight = el.clientHeight;
      var threshold = 200;
      if (scrollTop + clientHeight >= scrollHeight - threshold) {
        loadMoreSessions();
      }
    });

    document.getElementById("search-form").addEventListener("submit", function (e) {
      e.preventDefault();
      currentQuery = document.getElementById("q").value || "";
      selectedSession = null;
      loadSessions();
    });

    document.getElementById("q").addEventListener("input", function (e) {
      var value = this.value || "";
      if (value === "" && currentQuery !== "") {
        currentQuery = "";
        selectedSession = null;
        loadSessions();
      }
    });

    document.getElementById("copy-session").addEventListener("click", function () {
      if (!selectedMessages || !selectedMessages.length) return;
      var text = selectedMessages.map(function (m) {
        return "[" + (m.role || "assistant") + "] " + formatTime(m.timestamp) + "\\n" + (m.content || "");
      }).join("\\n\\n");
      copyToClipboard(text, "Session copied!");
    });

    document.getElementById("messages").addEventListener("click", function (e) {
      var btn = e.target.closest(".code-copy");
      if (btn) {
        var wrap = btn.closest(".code-wrap");
        var code = wrap ? wrap.querySelector("code") : null;
        if (code) copyToClipboard(code.textContent || "", "Code copied!");
        return;
      }
    });

    document.getElementById("btn-settings").addEventListener("click", function () {
      window.location.href = "/settings";
    });

    /* Init */
    loadSessions();
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
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
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
    .title { font-size: 1.05rem; font-weight: 600; margin: 0.2rem 0; }
    .meta { font-size: 0.8rem; color: var(--muted); }
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
    #messages { display: flex; flex-direction: column; gap: 0.6rem; }
    .message.role-user { align-self: flex-end; background: #f4f6ff; border-color: #cfd8ff; }
    .message.role-assistant { align-self: flex-start; background: #f1fff4; border-color: #bfe5c8; }
    .message.role-system { align-self: center; background: #fff7e8; border-color: #f2d3a7; max-width: 90%; }
    .message.role-user .message-meta { justify-content: flex-end; }
    .message-meta {
      font-size: 0.72rem;
      color: var(--muted);
      margin-bottom: 0.35rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .role { font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text); }
    .message-content { word-break: break-word; font-size: 0.84rem; line-height: 1.55; }
    .message-content pre {
      background: #1e1e2e; color: #cdd6f4; border-radius: 6px;
      padding: 0.6rem 0.75rem; overflow-x: auto;
      font-family: "SF Mono", "Consolas", "Monaco", monospace;
      font-size: 0.78rem; line-height: 1.5; margin: 0.4rem 0;
    }
    .message-content code {
      background: var(--surface); padding: 0.1rem 0.3rem; border-radius: 3px;
      font-family: "SF Mono", "Consolas", "Monaco", monospace; font-size: 0.78rem;
    }
    .message-content pre code { background: none; padding: 0; }
    .message-content p { margin: 0.3rem 0; }
    .message-content ul, .message-content ol { margin: 0.3rem 0; padding-left: 1.2rem; }
    .message-content li { margin: 0.15rem 0; }
    .message-content h1, .message-content h2, .message-content h3 { margin: 0.5rem 0 0.25rem; font-weight: 600; }
    .message-content blockquote { border-left: 3px solid var(--border); margin: 0.3rem 0; padding: 0.2rem 0.6rem; color: var(--muted); }
    .message-content a { color: var(--accent); text-decoration: underline; }
    .empty-state {
      padding: 1rem; background: var(--surface);
      border: 1px solid var(--border); border-radius: 8px; color: var(--muted);
    }
    .skeleton {
      background: linear-gradient(90deg, var(--surface) 25%, #edf0f7 50%, var(--surface) 75%);
      background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .skeleton-msg { height: 48px; margin-bottom: 0.5rem; border-radius: 8px; max-width: 70%; }
    .skeleton-msg:nth-child(odd) { align-self: flex-end; max-width: 60%; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div><a href="/">← Back to sessions</a></div>
        <div class="title" id="title">Session</div>
        <div class="meta" id="meta"></div>
      </div>
    </div>
    <div id="messages">
      <div class="skeleton skeleton-msg" style="width:60%"></div>
      <div class="skeleton skeleton-msg" style="width:75%"></div>
      <div class="skeleton skeleton-msg" style="width:55%"></div>
    </div>
  </div>
  <script>
    var sourceLabels = { cursor: "Cursor IDE", copilot: "Copilot (VS Code)", "cursor-cli": "Cursor CLI", "claude-code": "Claude Code", codex: "Codex", gemini: "Gemini" };

    function formatTime(ts) {
      var d = ts ? new Date(ts) : new Date();
      if (isNaN(d.getTime())) return "Unknown date";
      try {
        return new Intl.DateTimeFormat(undefined, {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        }).format(d);
      } catch (_e) {}
      return d.toISOString();
    }

    function escapeHtml(s) {
      var div = document.createElement("div");
      div.textContent = s;
      return div.innerHTML;
    }

    function renderMarkdown(raw) {
      if (!raw) return "<p>(empty)</p>";
      var s = raw;
      var blocks = [];
      s = s.replace(/\`\`\`(\\w*?)\\n([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
        var idx = blocks.length;
        blocks.push('<pre><code>' + escapeHtml(code.replace(/\\n$/, '')) + '</code></pre>');
        return '%%BLOCK' + idx + '%%';
      });
      s = escapeHtml(s);
      for (var i = 0; i < blocks.length; i++) {
        s = s.replace('%%BLOCK' + i + '%%', blocks[i]);
      }
      s = s.replace(/\`([^\`]+?)\`/g, '<code>$1</code>');
      s = s.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      s = s.replace(/(?:^|\\n)#{3}\\s+(.+)/g, '<h3>$1</h3>');
      s = s.replace(/(?:^|\\n)#{2}\\s+(.+)/g, '<h2>$1</h2>');
      s = s.replace(/(?:^|\\n)#{1}\\s+(.+)/g, '<h1>$1</h1>');
      s = s.replace(/(?:^|\\n)&gt;\\s?(.+)/g, '<blockquote>$1</blockquote>');
      s = s.replace(/(?:^|\\n)[-*]\\s+(.+)/g, '<li>$1</li>');
      s = s.replace(/(<li>.*<\\/li>)/gs, '<ul>$1</ul>');
      s = s.replace(/<\\/ul>\\s*<ul>/g, '');
      s = s.replace(/\\n{2,}/g, '</p><p>');
      s = s.replace(/\\n/g, '<br/>');
      if (!s.startsWith('<')) s = '<p>' + s + '</p>';
      return s;
    }

    function getQueryParams() {
      try { return new URL(window.location.href).searchParams; }
      catch (e) { return new URLSearchParams(); }
    }

    function renderSession(data, highlightMessageId) {
      if (!data || !data.session) {
        document.getElementById("messages").innerHTML = '<div class="empty-state">Session not found.</div>';
        return;
      }
      var s = data.session;
      var label = sourceLabels[s.source] || s.source || "?";
      document.getElementById("title").textContent = label + " — " + (s.workspace || "(default)");
      document.getElementById("meta").textContent = "Session " + s.id + " · " + formatTime(s.last_at) + " · " + (s.message_count || 0) + " messages";

      var html = (data.messages || []).map(function (m) {
        var ts = formatTime(m.timestamp);
        var role = (m.role || "assistant").toLowerCase();
        var roleClass = role === "user" ? "role-user" : role === "assistant" ? "role-assistant" : "role-system";
        var highlight = highlightMessageId && String(m.id) === String(highlightMessageId) ? " highlight" : "";
        var content = renderMarkdown(m.content || "(empty)");
        return '<div class="message ' + roleClass + highlight + '" data-message-id="' + m.id + '">' +
          '<div class="message-meta"><span class="role">' + escapeHtml(m.role || "assistant") + '</span><span>' + escapeHtml(ts) + '</span></div>' +
          '<div class="message-content">' + content + '</div>' +
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
      fetch("/api/session?session_id=" + encodeURIComponent(String(sessionId)) + "&order=asc&limit=5000")
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
      margin: 0; padding: 2rem; min-height: 100vh;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { color: var(--accent-hover); }
    .title { margin: 0; font-size: 1.2rem; }
    .sub { margin: 0.3rem 0 0; font-size: 0.82rem; color: var(--muted); }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 1rem; align-items: start; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
    .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem; }
    .section-title { margin: 0 0 0.55rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.74rem; }
    .controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 0.85rem; }
    @media (max-width: 860px) { .controls { grid-template-columns: 1fr; } }
    label { display: block; font-size: 0.78rem; color: var(--muted); margin-bottom: 0.35rem; }
    input[type="text"], input[type="password"], select {
      width: 100%; border: 1px solid var(--border); background: #fff;
      color: var(--text); border-radius: 6px; padding: 0.45rem 0.55rem; font: inherit; font-size: 0.82rem;
    }
    .checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
    .source-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .source-item {
      display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem;
      color: var(--text); background: #fff; border: 1px solid var(--border);
      border-radius: 999px; padding: 0.2rem 0.5rem;
    }
    .btn-row { display: flex; flex-wrap: wrap; gap: 0.55rem; margin: 0.9rem 0 0.65rem; }
    button {
      border: none; border-radius: 6px; padding: 0.45rem 0.8rem;
      font: inherit; font-size: 0.8rem; cursor: pointer; background: var(--accent); color: #fff;
    }
    button:hover { background: var(--accent-hover); }
    button.secondary { background: var(--accent-soft); color: var(--text); border: 1px solid var(--border); }
    button.secondary:hover { border-color: var(--accent); }
    button:disabled { opacity: 0.65; cursor: not-allowed; }
    .status { min-height: 1.2rem; font-size: 0.8rem; color: var(--muted); margin: 0.3rem 0 0.8rem; }
    .status.ok { color: var(--success); }
    .status.warn { color: var(--warning); }
    .status.err { color: var(--error); }
    .progress-steps { display: flex; gap: 0.75rem; margin-bottom: 0.5rem; font-size: 0.78rem; }
    .progress-step { color: var(--muted); }
    .progress-step.active { color: var(--accent); font-weight: 600; }
    .progress-step.done { color: var(--success); }
    .result-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; margin-bottom: 0.75rem; }
    @media (max-width: 860px) { .result-grid { grid-template-columns: 1fr; } }
    .score-card { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 0.65rem; }
    .score-name { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .score-value { font-size: 1.2rem; margin-top: 0.2rem; font-weight: 700; }
    .score-reason { font-size: 0.72rem; color: var(--muted); margin-top: 0.3rem; line-height: 1.4; font-style: italic; }
    .block { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 0.7rem; margin-bottom: 0.65rem; }
    .block h3 { margin: 0 0 0.45rem; font-size: 0.82rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .block p, .block li, .block a { font-size: 0.82rem; line-height: 1.45; color: var(--text); }
    .block ul { margin: 0; padding-left: 1rem; }
    .history-list {
      list-style: none; margin: 0; padding: 0;
      flex: 1; overflow-y: auto; min-height: 0; max-height: 70vh;
    }
    .history-item {
      padding: 0.6rem 1rem;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.12s, border-color 0.12s;
    }
    .history-item:hover { background: var(--surface); }
    .history-item.active {
      background: var(--accent-soft);
      border-left-color: var(--accent);
    }
    .history-item button { width: 100%; text-align: left; background: transparent; border: none; color: var(--text); padding: 0; font-size: 0.8rem; cursor: pointer; }
    .history-meta { margin-top: 0.25rem; font-size: 0.72rem; color: var(--muted); }
    .external-fields { transition: opacity 0.2s; }
    .external-fields.hidden-fields { opacity: 0.35; pointer-events: none; }
    .toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem; background: var(--text);
      color: #fff; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.82rem;
      opacity: 0; transition: opacity 0.25s; pointer-events: none; z-index: 9999;
    }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div><a href="/">← Back to sessions</a></div>
        <h1 class="title">Insights</h1>
        <p class="sub">Manual reports with scores, evidence links, and actionable feedback</p>
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
              <option value="local">Local (rule-based)</option>
              <option value="external">External API</option>
            </select>
          </div>
          <div style="display:flex;align-items:flex-end;">
            <label class="checkbox-row"><input id="model-enabled" type="checkbox" /> Enable External API</label>
          </div>
        </div>
        <div class="external-fields" id="external-fields">
          <div class="controls">
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
              <label for="model-key">API Key (runtime only)</label>
              <input id="model-key" type="password" placeholder="Not persisted in database" />
            </div>
          </div>
        </div>

        <div class="btn-row">
          <button class="secondary" id="btn-save">Save Settings</button>
          <button class="secondary" id="btn-test">Test Connection</button>
          <button id="btn-generate">Generate Insights</button>
          <button class="secondary" id="btn-copy-md" disabled>Copy Markdown</button>
          <button class="secondary" id="btn-export-md" disabled>Export .md</button>
        </div>
        <div class="progress-steps hidden" id="progress-steps">
          <span class="progress-step" id="step-collect">1. Collecting conversations</span>
          <span class="progress-step" id="step-analyze">2. Analyzing patterns</span>
          <span class="progress-step" id="step-draft">3. Drafting report</span>
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
            <div class="score-reason" id="reason-eff"></div>
          </div>
          <div class="score-card">
            <div class="score-name">Stability</div>
            <div class="score-value" id="score-sta">-</div>
            <div class="score-reason" id="reason-sta"></div>
          </div>
          <div class="score-card">
            <div class="score-name">Decision Clarity</div>
            <div class="score-value" id="score-dec">-</div>
            <div class="score-reason" id="reason-dec"></div>
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
  <div class="toast" id="toast"></div>
  <script>
    var sourceLabels = { cursor: "Cursor IDE", copilot: "Copilot", "cursor-cli": "Cursor CLI", "claude-code": "Claude Code", codex: "Codex", gemini: "Gemini" };
    var sourceKeys = Object.keys(sourceLabels);
    var lastReportId = null;
    var lastReportData = null;
    var lastReportEvidence = null;

    function showToast(text) {
      var el = document.getElementById("toast");
      el.textContent = text;
      el.classList.add("show");
      clearTimeout(el._timer);
      el._timer = setTimeout(function () { el.classList.remove("show"); }, 2000);
    }

    function status(text, kind) {
      var el = document.getElementById("status");
      el.textContent = text || "";
      el.className = "status" + (kind ? " " + kind : "");
    }

    function safeText(v) { return v == null ? "" : String(v); }

    function escapeHtml(v) {
      return safeText(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
          if (!res.ok) throw new Error(parseError(payload));
          return payload;
        });
      });
    }

    function updateExternalFieldsVisibility() {
      var mode = document.getElementById("model-mode").value;
      var fields = document.getElementById("external-fields");
      if (mode === "external") {
        fields.classList.remove("hidden-fields");
      } else {
        fields.classList.add("hidden-fields");
      }
    }

    function renderSourceChecks() {
      document.getElementById("source-list").innerHTML = sourceKeys.map(function (key) {
        return '<label class="source-item"><input type="checkbox" data-source="' + key + '" checked />' + sourceLabels[key] + '</label>';
      }).join("");
    }

    function selectedSources() {
      return Array.from(document.querySelectorAll('#source-list input:checked')).map(function (n) { return n.getAttribute("data-source"); }).filter(Boolean);
    }

    function msDays(d) { return d * 86400000; }

    function resolveTimeRange() {
      var r = document.getElementById("scope-range").value;
      var now = Date.now();
      if (r === "7d") return { from: now - msDays(7), to: now };
      if (r === "30d") return { from: now - msDays(30), to: now };
      if (r === "90d") return { from: now - msDays(90), to: now };
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
      if (!items || !items.length) return "<li>None</li>";
      return items.map(function (i) { return "<li>" + escapeHtml(i) + "</li>"; }).join("");
    }

    function showProgress(step) {
      var el = document.getElementById("progress-steps");
      el.classList.remove("hidden");
      ["step-collect", "step-analyze", "step-draft"].forEach(function(id, idx) {
        var s = document.getElementById(id);
        s.className = "progress-step" + (idx < step ? " done" : idx === step ? " active" : "");
      });
    }

    function hideProgress() {
      document.getElementById("progress-steps").classList.add("hidden");
    }

    function scoreDisplay(v) { return v != null && v !== "" ? String(v) : "-"; }

    function renderReport(data, evidence, scoreReasons) {
      lastReportData = data;
      lastReportEvidence = evidence;
      document.getElementById("summary").textContent = safeText(data.summary || "No summary.");
      document.getElementById("patterns").innerHTML = asListHtml(data.patterns || []);
      document.getElementById("feedback").innerHTML = asListHtml(data.feedback || []);
      var scores = data.scores || {};
      document.getElementById("score-eff").textContent = scoreDisplay(scores.efficiency);
      document.getElementById("score-sta").textContent = scoreDisplay(scores.stability);
      document.getElementById("score-dec").textContent = scoreDisplay(scores.decision_clarity);
      var reasons = scoreReasons || data.score_reasons || [];
      document.getElementById("reason-eff").textContent = reasons[0] || "";
      document.getElementById("reason-sta").textContent = reasons[1] || "";
      document.getElementById("reason-dec").textContent = reasons[2] || "";
      var evidenceList = Array.isArray(evidence) ? evidence : [];
      if (!evidenceList.length) {
        document.getElementById("evidence").innerHTML = "<li>No evidence links.</li>";
      } else {
        document.getElementById("evidence").innerHTML = evidenceList.map(function (e) {
          var text = escapeHtml(e.claim || e.claim_text || "Evidence");
          var href = "/session?session_id=" + encodeURIComponent(String(e.session_id)) + "&message_id=" + encodeURIComponent(String(e.message_id));
          return '<li><a href="' + href + '" target="_blank" rel="noopener">' + text + "</a></li>";
        }).join("");
      }
      document.getElementById("btn-copy-md").disabled = false;
      document.getElementById("btn-export-md").disabled = false;
    }

    function buildReportMarkdown() {
      if (!lastReportData) return "";
      var d = lastReportData;
      var scores = d.scores || {};
      var reasons = d.score_reasons || [];
      var lines = [
        "# Insights Report",
        "",
        "## Summary",
        d.summary || "No summary.",
        "",
        "## Scores",
        "- **Efficiency**: " + scoreDisplay(scores.efficiency) + (reasons[0] ? " — " + reasons[0] : ""),
        "- **Stability**: " + scoreDisplay(scores.stability) + (reasons[1] ? " — " + reasons[1] : ""),
        "- **Decision Clarity**: " + scoreDisplay(scores.decision_clarity) + (reasons[2] ? " — " + reasons[2] : ""),
        "",
        "## Patterns",
      ];
      (d.patterns || []).forEach(function(p) { lines.push("- " + p); });
      lines.push("", "## Feedback");
      (d.feedback || []).forEach(function(f) { lines.push("- " + f); });
      if (lastReportEvidence && lastReportEvidence.length) {
        lines.push("", "## Evidence");
        lastReportEvidence.forEach(function(e) {
          lines.push("- " + (e.claim || e.claim_text || "Evidence") + " (session " + e.session_id + ", message " + e.message_id + ")");
        });
      }
      return lines.join("\\n");
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
          '<div class="history-meta">#' + r.id + " · " + when + "</div></li>";
      }).join("");
      setActiveHistoryItem(lastReportId);
    }

    function setActiveHistoryItem(id) {
      document.querySelectorAll("#history .history-item").forEach(function (n) { n.classList.remove("active"); });
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
      return parseInt(holder.getAttribute("data-report-id") || "0", 10) || 0;
    }

    function loadHistory() {
      var ws = currentWorkspace();
      var q = ws ? "?workspace=" + encodeURIComponent(ws) + "&limit=30" : "?limit=30";
      return api("/api/insights" + q).then(renderHistory).catch(function (err) {
        status(err.message || "Failed to load report history", "err");
      });
    }

    function loadReport(id) {
      return api("/api/insights/" + encodeURIComponent(String(id))).then(function (data) {
        lastReportId = id;
        renderReport(data.report || {}, data.evidence || [], (data.report || {}).score_reasons);
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
        if (!list.length) { select.innerHTML = '<option value="">(no workspace)</option>'; return; }
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
        updateExternalFieldsVisibility();
      });
    }

    function saveSettings() {
      status("Saving model settings…", "warn");
      return api("/api/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode_default: document.getElementById("model-mode").value,
          provider: document.getElementById("model-provider").value.trim(),
          base_url: document.getElementById("model-base").value.trim(),
          model_name: document.getElementById("model-name").value.trim(),
          external_enabled: !!document.getElementById("model-enabled").checked,
          api_key: document.getElementById("model-key").value.trim(),
        }),
      }).then(function () { status("Model settings saved", "ok"); showToast("Settings saved"); })
        .catch(function (err) { status(err.message || "Failed to save model settings", "err"); });
    }

    function testConnection() {
      status("Testing model connection…", "warn");
      return api("/api/model/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: document.getElementById("model-provider").value.trim(),
          base_url: document.getElementById("model-base").value.trim(),
          model_name: document.getElementById("model-name").value.trim(),
          external_enabled: !!document.getElementById("model-enabled").checked,
          api_key: document.getElementById("model-key").value.trim(),
        }),
      }).then(function (out) { status(out.message || "Connection successful", "ok"); })
        .catch(function (err) { status(err.message || "Connection test failed", "err"); });
    }

    function generate() {
      setGenerateDisabled(true);
      showProgress(0);
      status("Collecting conversations…", "warn");
      var windowRange = resolveTimeRange();
      var scope = { workspace: currentWorkspace(), sources: selectedSources() };
      if (windowRange) { scope.time_from = windowRange.from; scope.time_to = windowRange.to; }
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
      setTimeout(function() { showProgress(1); status("Analyzing patterns…", "warn"); }, 800);
      setTimeout(function() { showProgress(2); status("Drafting report…", "warn"); }, 1800);
      return api("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(function (data) {
        hideProgress();
        status("Insights generated", "ok");
        showToast("Report generated!");
        renderReport(data, [], data.score_reasons);
        if (data.report_id) {
          lastReportId = data.report_id;
          return loadHistory().then(function () { return loadReport(data.report_id); });
        }
        return loadHistory();
      }).catch(function (err) {
        hideProgress();
        status(err.message || "Insights generation failed", "err");
      }).finally(function () { setGenerateDisabled(false); });
    }

    document.getElementById("model-mode").addEventListener("change", updateExternalFieldsVisibility);
    document.getElementById("btn-save").addEventListener("click", function () { void saveSettings(); });
    document.getElementById("btn-test").addEventListener("click", function () { void testConnection(); });
    document.getElementById("btn-generate").addEventListener("click", function () { void generate(); });
    document.getElementById("scope-workspace").addEventListener("change", function () { void loadHistory(); });
    document.getElementById("history").addEventListener("click", function (e) {
      var id = getReportIdFromEventTarget(e.target);
      if (id > 0) void loadReport(id);
    });
    document.getElementById("btn-copy-md").addEventListener("click", function () {
      var md = buildReportMarkdown();
      if (md && navigator.clipboard) {
        navigator.clipboard.writeText(md).then(function() { showToast("Markdown copied!"); }).catch(function() { showToast("Copy failed"); });
      }
    });
    document.getElementById("btn-export-md").addEventListener("click", function () {
      var md = buildReportMarkdown();
      if (!md) return;
      var blob = new Blob([md], { type: "text/markdown" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "insights-report-" + (lastReportId || "draft") + ".md";
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("Exported .md file");
    });
    document.addEventListener("keydown", function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "i") { e.preventDefault(); }
    });

    renderSourceChecks();
    Promise.all([loadSettings(), loadWorkspaces()])
      .then(function () { return loadHistory(); })
      .then(function () { if (lastReportId) return loadReport(lastReportId); })
      .catch(function (err) { status(err.message || "Failed to initialize", "err"); });
  </script>
</body>
</html>`;
}

function getSettingsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Assistant Memory – Settings</title>
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --panel: #f3f4f6;
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --accent: #2563eb;
      --accent-soft: #e8efff;
      --success: #166534;
      --warning: #b45309;
      --error: #b91c1c;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .layout {
      max-width: 1160px;
      margin: 0 auto;
      min-height: 100vh;
      padding: 1.4rem;
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 1rem;
    }
    @media (max-width: 960px) {
      .layout { grid-template-columns: 1fr; }
    }
    .sidebar {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.9rem;
      height: fit-content;
    }
    .sidebar-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.7rem;
      padding-bottom: 0.7rem;
      border-bottom: 1px solid var(--border);
    }
    .sidebar-title { font-size: 0.98rem; font-weight: 700; }
    .back-link { font-size: 0.86rem; color: var(--accent); }
    .menu {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-top: 0.35rem;
    }
    .menu button {
      text-align: left;
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted);
      border-radius: 8px;
      padding: 0.52rem 0.62rem;
      font: inherit;
      font-size: 0.86rem;
      cursor: pointer;
    }
    .menu button:hover { border-color: var(--border); color: var(--text); }
    .menu button.active {
      background: var(--accent-soft);
      border-color: #d6e2ff;
      color: var(--accent);
      font-weight: 600;
    }
    .main {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
      min-height: 560px;
    }
    .page-title { margin: 0; font-size: 1.3rem; }
    .page-sub {
      margin: 0.4rem 0 0.9rem;
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.45;
    }
    .status {
      min-height: 1.25rem;
      font-size: 0.82rem;
      color: var(--muted);
      margin-bottom: 0.8rem;
    }
    .status.ok { color: var(--success); }
    .status.warn { color: var(--warning); }
    .status.err { color: var(--error); }
    .section { display: none; }
    .section.active { display: block; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.65rem;
      margin-bottom: 0.9rem;
    }
    @media (max-width: 780px) {
      .summary-grid { grid-template-columns: 1fr; }
    }
    .summary-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.75rem 0.8rem;
    }
    .summary-value { font-size: 1.35rem; font-weight: 700; line-height: 1; }
    .summary-label { margin-top: 0.3rem; font-size: 0.8rem; color: var(--muted); }
    .source-list {
      display: flex;
      flex-direction: column;
      gap: 0.62rem;
    }
    .source-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.72rem;
    }
    .source-card.disabled { opacity: 0.74; }
    .source-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.6rem;
    }
    .source-main {
      display: flex;
      gap: 0.58rem;
      min-width: 0;
      flex: 1;
    }
    .source-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #eef2ff;
      color: #1d4ed8;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.86rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .source-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.38rem;
    }
    .source-title { font-size: 1rem; font-weight: 700; }
    .source-kind {
      border: 1px solid var(--border);
      background: #f9fafb;
      color: var(--muted);
      border-radius: 999px;
      font-size: 0.68rem;
      padding: 0.1rem 0.36rem;
    }
    .source-path {
      margin-top: 0.16rem;
      color: var(--muted);
      font-size: 0.79rem;
      word-break: break-all;
    }
    .source-desc {
      margin-top: 0.18rem;
      color: var(--muted);
      font-size: 0.79rem;
      line-height: 1.4;
    }
    .source-meta {
      margin-top: 0.55rem;
      padding-top: 0.45rem;
      border-top: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .source-actions {
      margin-top: 0.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
    button.btn {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.42rem 0.7rem;
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
      background: #fff;
      color: var(--text);
    }
    button.btn:hover { border-color: var(--accent); }
    button.btn.primary {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    button.btn.primary:hover { filter: brightness(0.95); }
    button.btn:disabled { opacity: 0.65; cursor: not-allowed; }
    .source-config {
      margin-top: 0.58rem;
      border-top: 1px dashed var(--border);
      padding-top: 0.58rem;
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr) auto;
      gap: 0.45rem;
      align-items: center;
    }
    @media (max-width: 840px) {
      .source-config { grid-template-columns: 1fr; }
    }
    .source-config.hidden { display: none; }
    select, input[type="text"] {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
      color: var(--text);
      padding: 0.44rem 0.5rem;
      font: inherit;
      font-size: 0.8rem;
    }
    .section-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.78rem;
      margin-bottom: 0.6rem;
    }
    .section-card h3 {
      margin: 0 0 0.4rem;
      font-size: 0.9rem;
    }
    .muted { color: var(--muted); font-size: 0.82rem; line-height: 1.45; }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.52rem;
      align-items: center;
    }
    .footer-note {
      margin-top: 0.7rem;
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 10px;
      padding: 0.62rem 0.72rem;
      font-size: 0.79rem;
      color: var(--muted);
      line-height: 1.45;
    }
    .switch {
      position: relative;
      width: 38px;
      height: 22px;
      display: inline-block;
      flex-shrink: 0;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      inset: 0;
      background: #d1d5db;
      border-radius: 999px;
      transition: 0.2s;
      cursor: pointer;
    }
    .slider::before {
      content: "";
      position: absolute;
      width: 16px;
      height: 16px;
      left: 3px;
      top: 3px;
      background: #fff;
      border-radius: 50%;
      transition: 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }
    .switch input:checked + .slider { background: var(--accent); }
    .switch input:checked + .slider::before { transform: translateX(16px); }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-head">
        <a class="back-link" href="/">← Back</a>
        <div class="sidebar-title">Settings</div>
      </div>
      <div class="menu" id="settings-nav">
        <button type="button" data-section="data-sources" class="active">Data Sources</button>
        <button type="button" data-section="index-sync">Index & Sync</button>
        <button type="button" data-section="storage">Storage</button>
        <button type="button" data-section="display">Display</button>
        <button type="button" data-section="privacy-security">Privacy & Security</button>
        <button type="button" data-section="export-backup">Export & Backup</button>
      </div>
    </aside>

    <main class="main">
      <h1 class="page-title" id="section-title">Data Sources</h1>
      <p class="page-sub" id="section-sub">Configure where Assistant Memory reads your AI conversation data.</p>
      <div class="status" id="status"></div>

      <section class="section active" id="section-data-sources">
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-value" id="summary-active">0</div>
            <div class="summary-label">Active Sources</div>
          </div>
          <div class="summary-card">
            <div class="summary-value" id="summary-sessions">0</div>
            <div class="summary-label">Total Sessions</div>
          </div>
          <div class="summary-card">
            <div class="summary-value" id="summary-messages">0</div>
            <div class="summary-label">Total Messages</div>
          </div>
        </div>
        <div class="source-list" id="source-list"></div>
        <div class="row">
          <button class="btn" id="btn-add-source" type="button">+ Add New Source</button>
          <button class="btn" id="btn-refresh-sources" type="button">Refresh</button>
        </div>
        <div class="footer-note">
          Supported sources: Cursor IDE, GitHub Copilot, Cursor CLI, Claude Code, Codex, Gemini.
          Each source can be toggled independently and synced on demand.
        </div>
      </section>

      <section class="section" id="section-index-sync">
        <div class="section-card">
          <h3>Manual Sync</h3>
          <div class="muted">Run indexing for all enabled sources now.</div>
          <div class="row">
            <button class="btn primary" id="btn-sync-enabled" type="button">Sync Enabled Sources</button>
          </div>
          <div class="muted" id="index-sync-meta"></div>
        </div>
        <div class="section-card">
          <h3>Single Source Sync</h3>
          <div class="muted">Use Data Sources tab to sync one source at a time and inspect its status.</div>
        </div>
      </section>

      <section class="section" id="section-storage">
        <div class="section-card">
          <h3>Database</h3>
          <div class="muted" id="storage-db-path">DB path: -</div>
          <div class="muted" id="storage-db-stats">Sessions: 0 · Messages: 0</div>
          <div class="row">
            <button class="btn" id="btn-storage-refresh" type="button">Refresh Stats</button>
          </div>
        </div>
      </section>

      <section class="section" id="section-display">
        <div class="section-card">
          <h3>Display Preferences</h3>
          <div class="muted">Use compact list density for sessions.</div>
          <div class="row">
            <label><input type="checkbox" id="display-compact" /> Compact mode</label>
          </div>
        </div>
      </section>

      <section class="section" id="section-privacy-security">
        <div class="section-card">
          <h3>Privacy & External API</h3>
          <div class="muted" id="privacy-model-status">External API: unknown</div>
          <div class="row">
            <a href="/insights">Open Insights Model Settings</a>
          </div>
        </div>
      </section>

      <section class="section" id="section-export-backup">
        <div class="section-card">
          <h3>Export</h3>
          <div class="muted">Download current source settings as JSON.</div>
          <div class="row">
            <button class="btn" id="btn-export-settings" type="button">Export Source Settings</button>
          </div>
        </div>
      </section>
    </main>
  </div>

  <script>
    var sectionMeta = {
      "data-sources": {
        title: "Data Sources",
        sub: "Configure where Assistant Memory reads your AI conversation data."
      },
      "index-sync": {
        title: "Index & Sync",
        sub: "Control manual indexing and source sync operations."
      },
      "storage": {
        title: "Storage",
        sub: "Inspect the local database path and indexed volume."
      },
      "display": {
        title: "Display",
        sub: "Configure viewing preferences for the desktop client."
      },
      "privacy-security": {
        title: "Privacy & Security",
        sub: "Review external API status and privacy boundaries."
      },
      "export-backup": {
        title: "Export & Backup",
        sub: "Export reusable settings artifacts from this machine."
      }
    };

    var modeLabel = {
      local_files: "Local Files",
      file_import: "File Import",
      api: "API"
    };

    var sourcePayload = null;

    function safeText(v) {
      return typeof v === "string" ? v : "";
    }

    function escapeHtml(v) {
      return safeText(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function formatNumber(v) {
      var n = typeof v === "number" ? v : 0;
      return n.toLocaleString();
    }

    function formatTime(ts) {
      if (!ts) return "Never";
      var d = new Date(ts);
      if (isNaN(d.getTime())) return "Unknown";
      return d.toLocaleString();
    }

    function timeAgo(ts) {
      if (!ts) return "never";
      var delta = Date.now() - ts;
      if (delta < 60000) return "just now";
      if (delta < 3600000) return Math.round(delta / 60000) + " min ago";
      if (delta < 86400000) return Math.round(delta / 3600000) + " hr ago";
      return Math.round(delta / 86400000) + " day ago";
    }

    function setStatus(message, kind) {
      var el = document.getElementById("status");
      el.className = "status";
      if (kind) el.classList.add(kind);
      el.textContent = message || "";
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
          if (!res.ok) throw new Error(parseError(payload));
          return payload;
        });
      });
    }

    function activateSection(sectionId) {
      var title = document.getElementById("section-title");
      var sub = document.getElementById("section-sub");
      var meta = sectionMeta[sectionId] || sectionMeta["data-sources"];
      title.textContent = meta.title;
      sub.textContent = meta.sub;

      document.querySelectorAll("#settings-nav button").forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-section") === sectionId);
      });
      document.querySelectorAll(".section").forEach(function (sec) {
        sec.classList.toggle("active", sec.id === "section-" + sectionId);
      });
    }

    function renderSummary(payload) {
      var summary = payload && payload.summary ? payload.summary : {};
      document.getElementById("summary-active").textContent = formatNumber(summary.active_sources || 0);
      document.getElementById("summary-sessions").textContent = formatNumber(summary.total_sessions || 0);
      document.getElementById("summary-messages").textContent = formatNumber(summary.total_messages || 0);
      document.getElementById("storage-db-path").textContent = "DB path: " + safeText(payload.db_path || "-");
      document.getElementById("storage-db-stats").textContent =
        "Sessions: " + formatNumber(summary.total_sessions || 0) + " · Messages: " + formatNumber(summary.total_messages || 0);
    }

    function renderModeOptions(selected) {
      var opts = ["local_files", "file_import", "api"];
      return opts.map(function (mode) {
        var label = modeLabel[mode] || mode;
        var sel = mode === selected ? " selected" : "";
        return '<option value="' + mode + '"' + sel + ">" + escapeHtml(label) + "</option>";
      }).join("");
    }

    function renderSources(payload) {
      var list = (payload && payload.sources) || [];
      var host = document.getElementById("source-list");
      if (!list.length) {
        host.innerHTML = '<div class="section-card"><div class="muted">No source configuration available.</div></div>';
        return;
      }
      host.innerHTML = list.map(function (s) {
        var source = safeText(s.source);
        var label = safeText(s.label || source);
        var kind = modeLabel[s.mode] || safeText(s.mode);
        var enabled = !!s.enabled;
        var cardCls = "source-card" + (enabled ? "" : " disabled");
        var icon = label ? label.charAt(0).toUpperCase() : "?";
        return '<div class="' + cardCls + '" data-source="' + escapeHtml(source) + '">' +
          '<div class="source-top">' +
            '<div class="source-main">' +
              '<div class="source-icon">' + escapeHtml(icon) + '</div>' +
              '<div>' +
                '<div class="source-title-row"><span class="source-title">' + escapeHtml(label) + '</span><span class="source-kind">' + escapeHtml(kind) + '</span></div>' +
                '<div class="source-path">' + escapeHtml(safeText(s.path || "")) + '</div>' +
                '<div class="source-desc">' + escapeHtml(safeText(s.description || "")) + '</div>' +
              '</div>' +
            '</div>' +
            '<label class="switch">' +
              '<input class="source-toggle" type="checkbox"' + (enabled ? " checked" : "") + " />" +
              '<span class="slider"></span>' +
            '</label>' +
          '</div>' +
          '<div class="source-meta">' +
            '<span>' + formatNumber(s.session_count || 0) + ' sessions</span>' +
            '<span>' + formatNumber(s.message_count || 0) + ' messages</span>' +
            '<span>Last activity: ' + escapeHtml(timeAgo(s.last_activity_at)) + '</span>' +
            '<span>Last sync: ' + escapeHtml(timeAgo(s.last_sync_at)) + '</span>' +
          '</div>' +
          '<div class="source-actions">' +
            '<button type="button" class="btn sync-now">Sync Now</button>' +
            '<button type="button" class="btn configure-source">Configure</button>' +
          '</div>' +
          '<div class="source-config hidden">' +
            '<select class="source-mode">' + renderModeOptions(safeText(s.mode)) + '</select>' +
            '<input class="source-path-input" type="text" value="' + escapeHtml(safeText(s.path)) + '" placeholder="Source path" />' +
            '<div class="row" style="margin-top:0;">' +
              '<button type="button" class="btn primary save-source">Save</button>' +
              '<button type="button" class="btn cancel-source">Cancel</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join("");
    }

    function findSourceCard(node) {
      if (!node || !node.closest) return null;
      return node.closest(".source-card[data-source]");
    }

    function sourceFromCard(card) {
      if (!card) return "";
      return card.getAttribute("data-source") || "";
    }

    function patchSource(source, patch) {
      return api("/api/settings/sources/" + encodeURIComponent(source), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch || {}),
      });
    }

    function syncSource(source) {
      return api("/api/settings/sources/" + encodeURIComponent(source) + "/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    }

    function loadSourceSettings() {
      setStatus("Loading source settings...", "warn");
      return api("/api/settings/sources")
        .then(function (payload) {
          sourcePayload = payload;
          renderSummary(payload);
          renderSources(payload);
          var summary = payload.summary || {};
          setStatus(
            "Loaded " + formatNumber(summary.active_sources || 0) + " active sources.",
            "ok"
          );
        })
        .catch(function (err) {
          setStatus(err.message || "Failed to load source settings", "err");
        });
    }

    function loadModelStatus() {
      return api("/api/settings/model")
        .then(function (payload) {
          var settings = payload && payload.settings ? payload.settings : {};
          var enabled = !!settings.external_enabled;
          document.getElementById("privacy-model-status").textContent =
            "External API: " + (enabled ? "Enabled" : "Disabled");
        })
        .catch(function () {
          document.getElementById("privacy-model-status").textContent = "External API: unavailable";
        });
    }

    function refreshStorageStats() {
      return api("/api/stats")
        .then(function (payload) {
          document.getElementById("storage-db-path").textContent = "DB path: " + safeText(payload.dbPath || "-");
          document.getElementById("storage-db-stats").textContent =
            "Sessions: " + formatNumber(payload.sessions || 0) + " · Messages: " + formatNumber(payload.messages || 0);
          setStatus("Storage stats refreshed.", "ok");
        })
        .catch(function (err) {
          setStatus(err.message || "Failed to refresh storage stats", "err");
        });
    }

    function syncEnabledSources() {
      setStatus("Syncing enabled sources...", "warn");
      var btn = document.getElementById("btn-sync-enabled");
      btn.disabled = true;
      return api("/api/index", { method: "POST" })
        .then(function (payload) {
          document.getElementById("index-sync-meta").textContent =
            "Indexed " + formatNumber(payload.sessions || 0) + " sessions, " + formatNumber(payload.messages || 0) + " messages.";
          setStatus("Sync completed.", "ok");
          return loadSourceSettings();
        })
        .catch(function (err) {
          setStatus(err.message || "Sync failed", "err");
        })
        .finally(function () {
          btn.disabled = false;
        });
    }

    function exportSourceSettings() {
      if (!sourcePayload) {
        setStatus("No source settings loaded yet.", "warn");
        return;
      }
      var blob = new Blob([JSON.stringify(sourcePayload, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "assistant-memory-source-settings.json";
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus("Source settings exported.", "ok");
    }

    document.getElementById("settings-nav").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-section]");
      if (!btn) return;
      activateSection(btn.getAttribute("data-section") || "data-sources");
    });

    document.getElementById("source-list").addEventListener("change", function (e) {
      var toggle = e.target.closest(".source-toggle");
      if (!toggle) return;
      var card = findSourceCard(toggle);
      var source = sourceFromCard(card);
      if (!source) return;
      patchSource(source, { enabled: !!toggle.checked })
        .then(function () {
          setStatus("Updated " + source + " state.", "ok");
          return loadSourceSettings();
        })
        .catch(function (err) {
          setStatus(err.message || "Failed to update source", "err");
        });
    });

    document.getElementById("source-list").addEventListener("click", function (e) {
      var card = findSourceCard(e.target);
      if (!card) return;
      var source = sourceFromCard(card);
      if (!source) return;

      if (e.target.closest(".sync-now")) {
        setStatus("Syncing " + source + "...", "warn");
        syncSource(source)
          .then(function () {
            setStatus("Synced " + source + ".", "ok");
            return loadSourceSettings();
          })
          .catch(function (err) {
            setStatus(err.message || "Sync failed", "err");
          });
        return;
      }

      if (e.target.closest(".configure-source")) {
        var cfg = card.querySelector(".source-config");
        if (cfg) cfg.classList.toggle("hidden");
        return;
      }

      if (e.target.closest(".cancel-source")) {
        var cfgCancel = card.querySelector(".source-config");
        if (cfgCancel) cfgCancel.classList.add("hidden");
        return;
      }

      if (e.target.closest(".save-source")) {
        var modeEl = card.querySelector(".source-mode");
        var pathEl = card.querySelector(".source-path-input");
        var patch = {
          mode: modeEl ? modeEl.value : "local_files",
          path: pathEl ? pathEl.value : "",
        };
        patchSource(source, patch)
          .then(function () {
            setStatus("Saved config for " + source + ".", "ok");
            return loadSourceSettings();
          })
          .catch(function (err) {
            setStatus(err.message || "Failed to save source config", "err");
          });
      }
    });

    document.getElementById("btn-refresh-sources").addEventListener("click", function () {
      void loadSourceSettings();
    });
    document.getElementById("btn-add-source").addEventListener("click", function () {
      setStatus("Add source flow is reserved for a later beta iteration.", "warn");
    });
    document.getElementById("btn-sync-enabled").addEventListener("click", function () {
      void syncEnabledSources();
    });
    document.getElementById("btn-storage-refresh").addEventListener("click", function () {
      void refreshStorageStats();
    });
    document.getElementById("btn-export-settings").addEventListener("click", exportSourceSettings);

    document.getElementById("display-compact").addEventListener("change", function () {
      try {
        localStorage.setItem("assistant-memory.display.compact", this.checked ? "true" : "false");
      } catch (_err) {}
      setStatus("Display preference saved locally.", "ok");
    });

    (function initDisplayPref() {
      try {
        var compact = localStorage.getItem("assistant-memory.display.compact") === "true";
        document.getElementById("display-compact").checked = compact;
      } catch (_err) {}
    })();

    Promise.all([loadSourceSettings(), loadModelStatus(), refreshStorageStats()]).catch(function () {});
  </script>
</body>
</html>`;
}

function getInsightsReportsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Assistant Memory - Insights Reports</title>
  <style>
    :root {
      --bg: #f9fafb;
      --sidebar-bg: #ffffff;
      --surface: #f3f4f6;
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --accent-soft: #eff6ff;
      --chip: #f0f3f8;
      --code-bg: #1e293b;
      --code-text: #e2e8f0;
      --success: #13a86c;
      --warning: #f39c12;
      --danger: #e74c3c;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: var(--text);
      background: var(--bg);
    }
    .app { display: grid; grid-template-columns: 280px minmax(0, 1fr); min-height: 100vh; }
    .sidebar {
      border-right: 1px solid var(--border);
      background: var(--sidebar-bg);
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .sidebar-head {
      padding: 1.2rem 1rem 0.9rem;
      font-size: 1.03rem;
      font-weight: 700;
    }
    .sidebar-filter { padding: 0 1rem 0.6rem; }
    .source-select {
      width: 100%;
      padding: 0.52rem 0.7rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      font: inherit;
      font-size: 0.9rem;
      background: #fff;
      color: var(--text);
    }
    .chip-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.42rem; margin-top: 0.48rem; }
    .chip-select {
      width: 100%;
      padding: 0.45rem 0.58rem;
      border-radius: 7px;
      border: 1px solid var(--border);
      font: inherit;
      font-size: 0.82rem;
      background: #fff;
      color: var(--muted);
    }
    .search-wrap { margin-top: 0.48rem; }
    .search-input {
      width: 100%;
      padding: 0.52rem 0.7rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      font: inherit;
      background: #fff;
      color: var(--text);
      font-size: 0.88rem;
    }
    .session-list { flex: 1; overflow-y: auto; min-height: 0; }
    .session-item {
      padding: 0.6rem 1rem;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.12s, border-color 0.12s;
    }
    .session-item:hover { background: var(--surface); }
    .session-item.active {
      background: var(--accent-soft);
      border-left-color: var(--accent);
    }
    .session-item.focused { background: var(--surface); }
    .session-item-title {
      font-size: 0.88rem; font-weight: 600; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 0.15rem;
    }
    .session-item-meta {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.75rem;
    }
    .source-badge { font-weight: 600; font-size: 0.72rem; color: var(--muted); }
    .session-time { color: var(--muted); }
    .pager {
      border-top: 1px solid var(--border);
      padding: 0.62rem 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.72rem;
      color: var(--muted);
      font-size: 0.82rem;
    }
    .pager button {
      border: none;
      background: transparent;
      font-size: 1.1rem;
      color: var(--muted);
      cursor: pointer;
      padding: 0.15rem 0.28rem;
    }
    .sidebar-foot {
      padding: 0.65rem 1rem; border-top: 1px solid var(--border);
      display: flex; align-items: center; justify-content: flex-start;
    }
    .btn-settings {
      background: none; border: none; color: var(--muted); cursor: pointer;
      display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem;
      font: inherit; font-size: 0.85rem; font-weight: 500;
    }
    .btn-settings:hover { color: var(--text); }
    .btn-settings svg { width: 16px; height: 16px; }
    .settings-label { color: var(--muted); }
    .btn-settings:hover .settings-label { color: var(--text); }
    .main { min-width: 0; display: flex; flex-direction: column; }
    .topbar {
      padding: 1.25rem 1.8rem 0.92rem;
      border-bottom: 1px solid var(--border);
      background: #fff;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      font-size: 0.95rem;
      color: var(--muted);
    }
    .breadcrumbs a { color: var(--accent); text-decoration: none; }
    .title {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1.12;
      margin: 0.45rem 0 0.15rem;
    }
    .subtitle { color: var(--muted); font-size: 1.05rem; margin: 0; }
    .content {
      padding: 1.35rem 1.8rem 2.2rem;
      overflow: auto;
      min-height: 0;
    }
    .status {
      min-height: 1.3rem;
      margin-bottom: 0.8rem;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .status.ok { color: var(--success); }
    .status.warn { color: #a46a00; }
    .status.err { color: var(--danger); }
    .model-config-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
      padding: 0.9rem 0.95rem;
      margin-bottom: 0.9rem;
    }
    .model-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.7rem;
      margin-bottom: 0.72rem;
      flex-wrap: wrap;
    }
    .model-title {
      font-size: 0.96rem;
      font-weight: 650;
    }
    .model-badge {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.15rem 0.5rem;
      font-size: 0.76rem;
      color: var(--muted);
      background: #f7f9ff;
    }
    .model-badge.ok {
      color: #10764d;
      border-color: #bfe7d2;
      background: #eaf9f1;
    }
    .model-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.6rem;
      align-items: end;
    }
    .model-grid.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 0.6rem;
    }
    .model-field label {
      display: block;
      font-size: 0.8rem;
      color: var(--muted);
      margin-bottom: 0.28rem;
    }
    .model-field input,
    .model-field select {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
      color: var(--text);
      font: inherit;
      font-size: 0.88rem;
      padding: 0.45rem 0.55rem;
    }
    .model-field input:disabled,
    .model-field select:disabled {
      background: #f7f8fb;
      color: #8a92a3;
    }
    .model-actions {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      flex-wrap: wrap;
    }
    .model-note {
      margin-top: 0.45rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .model-hint {
      margin-top: 0.5rem;
      font-size: 0.88rem;
      color: var(--muted);
      min-height: 1.1rem;
    }
    .model-hint.err { color: var(--danger); }
    .model-hint.ok { color: var(--success); }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.8rem;
      margin-bottom: 1rem;
    }
    .summary-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 0.95rem 0.9rem;
      text-align: center;
    }
    .summary-value { font-size: 2rem; font-weight: 700; line-height: 1; margin-bottom: 0.26rem; }
    .summary-label { font-size: 0.94rem; color: var(--muted); }
    .reports-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      gap: 0.8rem;
    }
    .btn-primary {
      border: 1px solid var(--accent);
      border-radius: 10px;
      background: var(--accent);
      color: #fff;
      font: inherit;
      font-size: 0.95rem;
      padding: 0.56rem 0.94rem;
      cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-ghost {
      border: 1px solid var(--border);
      border-radius: 9px;
      background: #fff;
      color: var(--text);
      font: inherit;
      font-size: 0.92rem;
      padding: 0.45rem 0.85rem;
      cursor: pointer;
    }
    .report-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 1rem 1rem;
      margin-bottom: 0.72rem;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.8rem;
      align-items: center;
    }
    .report-title { font-size: 1.04rem; font-weight: 650; margin-bottom: 0.2rem; }
    .report-meta { color: var(--muted); font-size: 0.88rem; margin-bottom: 0.35rem; }
    .tag-row { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .tag {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.08rem 0.36rem;
      font-size: 0.74rem;
      color: var(--muted);
      background: #fafbfe;
    }
    .report-actions { display: flex; align-items: center; gap: 0.55rem; }
    .delete-btn {
      border: none;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 1.05rem;
      padding: 0.12rem;
    }
    .metrics-strip {
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      padding: 0.8rem 1.8rem;
      background: #fff;
      display: flex;
      flex-wrap: wrap;
      gap: 1.05rem;
      color: var(--muted);
      font-size: 0.86rem;
      align-items: center;
    }
    .metric-strong { color: var(--text); font-weight: 700; font-size: 0.98rem; }
    .tabs {
      border-bottom: 1px solid var(--border);
      background: #fff;
      padding: 0 1.8rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .tab {
      border: none;
      background: transparent;
      border-bottom: 3px solid transparent;
      color: var(--muted);
      font: inherit;
      font-size: 0.9rem;
      padding: 0.78rem 0.35rem 0.72rem;
      cursor: pointer;
    }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
    .section-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
      padding: 1rem 1rem;
      margin-bottom: 0.72rem;
    }
    .section-card h3 { margin: 0 0 0.56rem; font-size: 1.03rem; }
    .section-card p {
      margin: 0.2rem 0;
      font-size: 0.96rem;
      color: #5d667a;
      line-height: 1.48;
    }
    .section-card p strong { color: var(--text); }
    .callout-green { border-left: 4px solid #15b876; }
    .callout-amber { border-left: 4px solid #f0a61d; }
    .callout-blue { border-left: 4px solid #3567ff; }
    .callout-dark { border-left: 4px solid #1f2533; }
    .two-col {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 270px;
      gap: 0.82rem;
    }
    .stats-box {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 0.82rem 0.85rem;
      margin-bottom: 0.72rem;
    }
    .stats-title {
      font-size: 0.78rem;
      color: var(--muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 0.4rem;
    }
    .stats-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.55rem;
      margin-bottom: 0.28rem;
      font-size: 0.93rem;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 120px 1fr 32px;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 0.48rem;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .bar-track {
      background: #edf1fa;
      height: 14px;
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #5b79f5 0%, #5270f2 100%);
    }
    .code-block {
      margin-top: 0.55rem;
      background: var(--code-bg);
      color: var(--code-text);
      border-radius: 8px;
      padding: 0.72rem 0.82rem;
      font-family: "SF Mono", "Consolas", "Monaco", monospace;
      font-size: 0.93rem;
      line-height: 1.45;
      position: relative;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .copy-btn {
      position: absolute;
      right: 0.6rem;
      top: 0.6rem;
      border: none;
      background: transparent;
      color: #98a4cc;
      cursor: pointer;
      font-size: 1rem;
      padding: 0.2rem;
    }
    .bullet-note {
      margin: 0.35rem 0 0;
      padding-left: 0.8rem;
      border-left: 3px solid #f2c14c;
      color: #677089;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.6rem; }
    .chip {
      border-radius: 8px;
      background: #eff3ff;
      color: #364469;
      border: 1px solid #dde6ff;
      padding: 0.22rem 0.45rem;
      font-size: 0.88rem;
    }
    .chip-success { background: #e7f7ef; color: #127946; border-color: #c3ebd7; }
    .chip-warning { background: #fff4e6; color: #af6d03; border-color: #f4d9ae; }
    .select-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      margin-bottom: 0.9rem;
      flex-wrap: wrap;
    }
    .source-tabs { display: flex; flex-wrap: wrap; gap: 0.38rem; }
    .source-tab {
      border: 1px solid var(--border);
      background: #f6f7fb;
      color: var(--muted);
      border-radius: 8px;
      padding: 0.36rem 0.58rem;
      font: inherit;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .source-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .select-all {
      color: var(--accent);
      background: transparent;
      border: none;
      font: inherit;
      font-size: 0.94rem;
      cursor: pointer;
      padding: 0;
    }
    .candidate-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 0.8rem 0.85rem;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 0.6rem;
    }
    .candidate-card.selected { border-color: #b9c9ff; box-shadow: 0 0 0 1px #dfe7ff inset; }
    .candidate-check {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #fff;
      cursor: pointer;
    }
    .candidate-title { font-size: 1rem; margin-bottom: 0.2rem; }
    .candidate-meta { font-size: 0.86rem; color: var(--muted); display: flex; gap: 0.45rem; align-items: center; }
    .candidate-count { text-align: right; color: var(--muted); font-size: 0.88rem; min-width: 90px; }
    .empty {
      border: 1px dashed var(--border);
      border-radius: 10px;
      background: #fff;
      color: var(--muted);
      padding: 1.1rem;
      text-align: center;
    }
    .mobile-hidden { display: inline; }
    @media (max-width: 1200px) {
      .two-col { grid-template-columns: 1fr; }
      .summary-grid { grid-template-columns: 1fr; }
      .model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 960px) {
      .app { grid-template-columns: 1fr; }
      .sidebar { min-height: auto; }
      .mobile-hidden { display: none; }
      .content, .topbar, .metrics-strip, .tabs { padding-left: 1rem; padding-right: 1rem; }
      .model-grid,
      .model-grid.two { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-head">Assistant Memory</div>
      <div class="sidebar-filter">
        <select id="sb-source" class="source-select">
          <option value="">Source: All</option>
          <option value="cursor">Cursor IDE</option>
          <option value="copilot">Copilot</option>
          <option value="cursor-cli">Cursor CLI</option>
          <option value="claude-code">Claude Code</option>
          <option value="codex">Codex</option>
          <option value="gemini">Gemini</option>
        </select>
        <div class="chip-row">
          <select class="chip-select"><option>Workspace</option></select>
          <select class="chip-select"><option>Time Range</option></select>
        </div>
        <div class="search-wrap">
          <input id="sb-search" class="search-input" type="search" placeholder="Search..." />
        </div>
      </div>
      <div id="sb-sessions" class="session-list"></div>
      <div class="pager">
        <button id="sb-prev" type="button">&#8249;</button>
        <span id="sb-page">Page 1</span>
        <button id="sb-next" type="button">&#8250;</button>
      </div>
      <div class="sidebar-foot">
        <button type="button" class="btn-settings" id="sb-settings" title="Settings">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/></svg>
          <span class="settings-label">Settings</span>
        </button>
      </div>
    </aside>

    <main class="main">
      <div id="main-top"></div>
      <div id="main-extra"></div>
      <div class="content">
        <div id="status" class="status"></div>
        <div id="insights-root"></div>
      </div>
    </main>
  </div>

  <script>
    var sourceLabels = {
      cursor: "Cursor IDE",
      copilot: "Copilot",
      "cursor-cli": "Cursor CLI",
      "claude-code": "Claude Code",
      codex: "Codex",
      gemini: "Gemini"
    };

    var sidebarState = {
      source: "",
      q: "",
      page: 1,
      pageSize: 10,
      total: 0,
      sessions: []
    };

    var insightState = {
      candidates: [],
      selected: new Set(),
      sourceFilter: "all",
      tab: "at_a_glance"
    };

    var modelState = {
      settings: {
        mode_default: "local",
        external_enabled: false,
        provider: "openai-compatible",
        base_url: "https://api.openai.com/v1",
        model_name: ""
      },
      hasApiKey: false
    };

    function escapeHtml(v) {
      return String(v || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function safeText(v) {
      return typeof v === "string" ? v : "";
    }

    function formatNumber(v) {
      var n = typeof v === "number" ? v : 0;
      return n.toLocaleString();
    }

    function formatTime(ts) {
      if (!ts) return "Unknown";
      var d = new Date(ts);
      if (isNaN(d.getTime())) return "Unknown";
      return d.toLocaleString();
    }

    function timeAgo(ts) {
      if (!ts) return "unknown";
      var diff = Date.now() - ts;
      if (diff < 60000) return "just now";
      if (diff < 3600000) return Math.round(diff / 60000) + " min ago";
      if (diff < 86400000) return Math.round(diff / 3600000) + " hour ago";
      return Math.round(diff / 86400000) + " day ago";
    }

    function status(msg, kind) {
      var el = document.getElementById("status");
      el.className = "status";
      if (kind) el.classList.add(kind);
      el.textContent = msg || "";
    }

    function parseError(payload) {
      if (!payload) return "Request failed";
      if (typeof payload.error === "string") return payload.error;
      if (payload.error && typeof payload.error.message === "string") return payload.error.message;
      return "Request failed";
    }

    function api(path, options) {
      return fetch(path, options || {}).then(function(res) {
        return res.text().then(function(text) {
          var payload = {};
          try { payload = text ? JSON.parse(text) : {}; } catch (_e) {}
          if (!res.ok) {
            var err = new Error(parseError(payload));
            if (payload && payload.error && typeof payload.error.code === "string") {
              err.code = payload.error.code;
            }
            throw err;
          }
          return payload;
        });
      });
    }

    function normalizeModelSettings(settings) {
      return {
        mode_default: settings && settings.mode_default === "external" ? "external" : "local",
        external_enabled: !!(settings && settings.external_enabled),
        provider: safeText(settings && settings.provider) || "openai-compatible",
        base_url: safeText(settings && settings.base_url) || "https://api.openai.com/v1",
        model_name: safeText(settings && settings.model_name)
      };
    }

    function modelMode() {
      var el = document.getElementById("model-mode");
      if (el && el.value) return el.value === "external" ? "external" : "local";
      return modelState.settings.mode_default === "external" ? "external" : "local";
    }

    function runtimeApiKey() {
      var el = document.getElementById("model-api-key");
      return el ? safeText(el.value || "").trim() : "";
    }

    function hasEffectiveApiKey() {
      return modelState.hasApiKey || runtimeApiKey().length > 0;
    }

    function isModelReadyForGeneration() {
      return modelMode() !== "external" || hasEffectiveApiKey();
    }

    function getRouteInfo() {
      var path = window.location.pathname;
      if (path === "/insights/new") return { view: "new" };
      var detail = path.match(/^\\/insights\\/(\\d+)$/);
      if (detail) return { view: "detail", id: parseInt(detail[1] || "0", 10) || 0 };
      return { view: "list" };
    }

    function renderTop(html) {
      document.getElementById("main-top").innerHTML = html;
    }

    function renderExtra(html) {
      document.getElementById("main-extra").innerHTML = html || "";
    }

    function renderRoot(html) {
      document.getElementById("insights-root").innerHTML = html;
    }


    function sidebarSessionTitle(s) {
      var w = safeText(s.workspace || "");
      if (w) {
        var normalized = w.replace(/\\\\/g, "/").split("/").filter(Boolean);
        if (normalized.length > 0) return normalized[normalized.length - 1];
      }
      var eid = safeText(s.external_id || "");
      return eid ? eid.slice(0, 42) : ("Session " + s.id);
    }

    function loadSidebarSessions() {
      var offset = (sidebarState.page - 1) * sidebarState.pageSize;
      var query = "limit=" + sidebarState.pageSize + "&offset=" + offset;
      if (sidebarState.source) query += "&source=" + encodeURIComponent(sidebarState.source);
      if (sidebarState.q) query += "&q=" + encodeURIComponent(sidebarState.q);
      return api("/api/sessions?" + query)
        .then(function(data) {
          sidebarState.sessions = data.sessions || [];
          sidebarState.total = typeof data.total === "number" ? data.total : sidebarState.sessions.length;
          var host = document.getElementById("sb-sessions");
          if (!sidebarState.sessions.length) {
            host.innerHTML = '<div class="empty">No sessions</div>';
          } else {
            host.innerHTML = sidebarState.sessions.map(function(s) {
              var label = sourceLabels[s.source] || s.source || "?";
              return '<div class="session-item">' +
                '<div class="session-item-title">' + escapeHtml(sidebarSessionTitle(s)) + '</div>' +
                '<div class="session-item-meta"><span class="source-badge">' + escapeHtml(label) + '</span><span class="session-time">' + escapeHtml(timeAgo(s.last_at)) + '</span></div>' +
              '</div>';
            }).join("");
          }
          var pageCount = Math.max(1, Math.ceil(sidebarState.total / sidebarState.pageSize));
          if (sidebarState.page > pageCount) sidebarState.page = pageCount;
          document.getElementById("sb-page").textContent = "Page " + sidebarState.page;
          document.getElementById("sb-prev").disabled = sidebarState.page <= 1;
          document.getElementById("sb-next").disabled = sidebarState.page >= pageCount;
        })
        .catch(function(err) {
          status(err.message || "Failed to load sessions", "err");
        });
    }

    function renderReportList(reports) {
      if (!reports.length) {
        return '<div class="empty">No reports yet. Click "New Report" to generate your first insight report.</div>';
      }
      return reports.map(function(r) {
        var tags = Array.isArray(r.sources) ? r.sources : [];
        return '<div class="report-card" data-report-id="' + r.id + '">' +
          '<div>' +
            '<div class="report-title">' + escapeHtml(r.title || ("Report #" + r.id)) + '</div>' +
            '<div class="report-meta">' + escapeHtml(formatTime(r.created_at)) + " \u00b7 " + formatNumber(r.session_count || 0) + " sessions \u00b7 " + formatNumber(r.message_count || 0) + " messages</div>" +
            '<div class="tag-row">' + tags.map(function(t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; }).join("") + '</div>' +
          '</div>' +
          '<div class="report-actions">' +
            '<button class="btn-ghost view-report" type="button">View</button>' +
            '<button class="delete-btn delete-report" type="button" title="Delete">🗑</button>' +
          '</div>' +
        '</div>';
      }).join("");
    }

    function openRoute(path) {
      window.location.href = path;
    }

    function renderListPage() {
      renderTop(
        '<div class="topbar">' +
          '<div class="breadcrumbs"><a href="/">← Back</a><span>|</span><span class="metric-strong">Insights Reports</span></div>' +
        '</div>'
      );
      renderExtra("");
      status("Loading reports...", "warn");
      api("/api/insights?limit=50")
        .then(function(data) {
          var summary = data.summary || { total_reports: 0, sessions_analyzed: 0, messages_analyzed: 0 };
          var html =
            '<div class="reports-head">' +
              '<div>' +
                '<div style="font-size:1.7rem;font-weight:700;line-height:1.1;">Report History</div>' +
                '<p class="subtitle" style="margin-top:0.4rem;">Select sessions, generate targeted insights reports, and review your history.</p>' +
              '</div>' +
              '<button id="btn-new-report" class="btn-primary" type="button">＋ New Report</button>' +
            '</div>' +
            '<div class="summary-grid">' +
              '<div class="summary-card"><div class="summary-value">' + formatNumber(summary.total_reports || 0) + '</div><div class="summary-label">Total Reports</div></div>' +
              '<div class="summary-card"><div class="summary-value">' + formatNumber(summary.sessions_analyzed || 0) + '</div><div class="summary-label">Sessions Analyzed</div></div>' +
              '<div class="summary-card"><div class="summary-value">' + formatNumber(summary.messages_analyzed || 0) + '</div><div class="summary-label">Messages Analyzed</div></div>' +
            '</div>' +
            renderReportList(data.reports || []);
          renderRoot(html);
          status("Loaded report history.", "ok");
          var btn = document.getElementById("btn-new-report");
          if (btn) btn.addEventListener("click", function() { openRoute("/insights/new"); });
        })
        .catch(function(err) {
          status(err.message || "Failed to load reports", "err");
          renderRoot('<div class="empty">Unable to load reports.</div>');
        });
    }

    function currentSelectedCount() {
      return insightState.selected.size;
    }

    function selectedMessageCount() {
      var map = new Map();
      (insightState.candidates || []).forEach(function(item) { map.set(item.id, item); });
      var total = 0;
      insightState.selected.forEach(function(id) {
        var row = map.get(id);
        if (row) total += row.message_count || 0;
      });
      return total;
    }

    function sessionDisplayName(row) {
      var w = safeText(row.workspace || "");
      if (w) {
        var parts = w.replace(/\\\\/g, "/").split("/").filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1];
      }
      return safeText(row.external_id || ("Session " + row.id));
    }

    function renderCandidateList() {
      var filtered = (insightState.candidates || []).filter(function(item) {
        if (insightState.sourceFilter === "all") return true;
        return item.source === insightState.sourceFilter;
      });
      if (!filtered.length) return '<div class="empty">No candidate sessions in current filter.</div>';
      return filtered.map(function(item) {
        var checked = insightState.selected.has(item.id);
        var cls = "candidate-card" + (checked ? " selected" : "");
        return '<div class="' + cls + '" data-session-id="' + item.id + '">' +
          '<input class="candidate-check" type="checkbox"' + (checked ? " checked" : "") + " />" +
          '<div>' +
            '<div class="candidate-title">' + escapeHtml(sessionDisplayName(item)) + '</div>' +
            '<div class="candidate-meta"><span class="source-pill">' + escapeHtml(sourceLabels[item.source] || item.source) + '</span><span>' + escapeHtml(timeAgo(item.last_at)) + '</span></div>' +
          '</div>' +
          '<div class="candidate-count"><div class="metric-strong">' + formatNumber(item.message_count || 0) + '</div><div>messages</div></div>' +
        '</div>';
      }).join("");
    }

    function syncSelectHeader() {
      var selectedEl = document.getElementById("selected-summary");
      var generateBtn = document.getElementById("btn-generate-report");
      if (selectedEl) {
        selectedEl.textContent = currentSelectedCount() + " sessions selected   " + formatNumber(selectedMessageCount()) + " messages total";
      }
      if (generateBtn) {
        generateBtn.disabled = currentSelectedCount() === 0 || !isModelReadyForGeneration();
      }
    }

    function renderModelConfigPanel() {
      var host = document.getElementById("model-config-panel");
      if (!host) return;
      var mode = modelState.settings.mode_default === "external" ? "external" : "local";
      var provider = escapeHtml(modelState.settings.provider || "openai-compatible");
      var baseUrl = escapeHtml(modelState.settings.base_url || "https://api.openai.com/v1");
      var modelName = escapeHtml(modelState.settings.model_name || "");
      var disabled = mode === "external" ? "" : " disabled";
      var badgeClass = modelState.hasApiKey ? "model-badge ok" : "model-badge";
      var badgeText = modelState.hasApiKey ? "API key configured" : "No API key configured";
      host.innerHTML =
        '<div class="model-head">' +
          '<div class="model-title">Model Configuration</div>' +
          '<span class="' + badgeClass + '">' + badgeText + '</span>' +
        '</div>' +
        '<div class="model-grid">' +
          '<div class="model-field">' +
            '<label for="model-mode">Mode</label>' +
            '<select id="model-mode">' +
              '<option value="local"' + (mode === "local" ? " selected" : "") + '>Local Analysis (no external API)</option>' +
              '<option value="external"' + (mode === "external" ? " selected" : "") + '>External API</option>' +
            '</select>' +
          '</div>' +
          '<div class="model-field">' +
            '<label for="model-provider">Provider</label>' +
            '<input id="model-provider" type="text" value="' + provider + '"' + disabled + ' />' +
          '</div>' +
          '<div class="model-field">' +
            '<label for="model-base-url">Base URL</label>' +
            '<input id="model-base-url" type="text" value="' + baseUrl + '"' + disabled + ' />' +
          '</div>' +
          '<div class="model-field">' +
            '<label for="model-name">Model Name</label>' +
            '<input id="model-name" type="text" value="' + modelName + '"' + disabled + ' />' +
          '</div>' +
        '</div>' +
        '<div class="model-grid two">' +
          '<div class="model-field">' +
            '<label for="model-api-key">API Key (runtime only)</label>' +
            '<input id="model-api-key" type="password" placeholder="Not persisted; kept only in-memory for this process"' + disabled + ' />' +
          '</div>' +
          '<div class="model-actions">' +
            '<button id="btn-save-model" class="btn-ghost" type="button">Save Settings</button>' +
            '<button id="btn-test-model" class="btn-ghost" type="button">Test Connection</button>' +
            '<a href="/settings" class="btn-ghost" style="text-decoration:none;">Advanced Settings</a>' +
          '</div>' +
        '</div>' +
        '<p class="model-note">Best practice: use an env-based key in production. Runtime key is never written to the database.</p>' +
        '<div id="model-config-hint" class="model-hint"></div>';
      syncModelHint();
    }

    function syncModelHint() {
      var hint = document.getElementById("model-config-hint");
      if (!hint) return;
      if (modelMode() === "external" && !hasEffectiveApiKey()) {
        hint.className = "model-hint err";
        hint.textContent = "External model API key is missing. Add a runtime key or switch to Local Analysis.";
      } else if (modelMode() === "external") {
        hint.className = "model-hint ok";
        hint.textContent = "External model is ready. You can generate insights now.";
      } else {
        hint.className = "model-hint";
        hint.textContent = "Local Analysis mode uses built-in heuristics and does not require an external API key.";
      }
    }

    function modelPayloadFromForm() {
      return {
        mode: modelMode(),
        provider: safeText((document.getElementById("model-provider") || {}).value || "").trim(),
        base_url: safeText((document.getElementById("model-base-url") || {}).value || "").trim(),
        model_name: safeText((document.getElementById("model-name") || {}).value || "").trim(),
        api_key: runtimeApiKey(),
      };
    }

    function loadModelConfig() {
      return api("/api/settings/model")
        .then(function(data) {
          modelState.settings = normalizeModelSettings(data.settings || {});
          modelState.hasApiKey = !!data.has_api_key;
          renderModelConfigPanel();
          syncSelectHeader();
        })
        .catch(function(err) {
          status(err.message || "Failed to load model settings", "err");
        });
    }

    function saveModelConfig() {
      var payload = modelPayloadFromForm();
      var isExternal = payload.mode === "external";
      if (isExternal && (!payload.provider || !payload.base_url || !payload.model_name)) {
        status("Provider, Base URL, and Model Name are required for external mode.", "err");
        return;
      }
      status("Saving model settings...", "warn");
      api("/api/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode_default: payload.mode,
          external_enabled: isExternal,
          provider: payload.provider,
          base_url: payload.base_url,
          model_name: payload.model_name,
          api_key: payload.api_key,
        }),
      }).then(function(data) {
        modelState.settings = normalizeModelSettings(data.settings || {});
        modelState.hasApiKey = !!data.has_api_key;
        renderModelConfigPanel();
        syncSelectHeader();
        status("Model settings saved.", "ok");
      }).catch(function(err) {
        status(err.message || "Failed to save model settings", "err");
      });
    }

    function testModelConfig() {
      var payload = modelPayloadFromForm();
      if (payload.mode !== "external") {
        status("Local mode does not require external connection testing.", "ok");
        return;
      }
      if (!payload.provider || !payload.base_url || !payload.model_name) {
        status("Provider, Base URL, and Model Name are required for external mode.", "err");
        return;
      }
      if (!hasEffectiveApiKey()) {
        status("External model API key is missing.", "err");
        var apiKeyInput = document.getElementById("model-api-key");
        if (apiKeyInput && apiKeyInput.focus) apiKeyInput.focus();
        return;
      }
      status("Testing model connection...", "warn");
      api("/api/model/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: payload.provider,
          base_url: payload.base_url,
          model_name: payload.model_name,
          external_enabled: true,
          api_key: payload.api_key,
        }),
      }).then(function(out) {
        status(out.message || "Connection successful.", "ok");
      }).catch(function(err) {
        status(err.message || "Connection test failed", "err");
      });
    }

    function renderNewPageLayout() {
      renderTop(
        '<div class="topbar">' +
          '<div class="breadcrumbs"><a href="/insights">← Cancel</a><span>|</span><span class="metric-strong">Select Sessions</span></div>' +
        '</div>'
      );
      renderExtra("");
      renderRoot(
        '<div id="model-config-panel" class="model-config-card"></div>' +
        '<div class="reports-head">' +
          '<div id="selected-summary" class="metric-strong">0 sessions selected   0 messages total</div>' +
          '<button id="btn-generate-report" class="btn-primary" type="button" disabled>⚡ Generate Report</button>' +
        '</div>' +
        '<div class="select-toolbar">' +
          '<div class="source-tabs" id="source-tabs"></div>' +
          '<button id="btn-select-all" class="select-all" type="button">Select All</button>' +
        '</div>' +
        '<div id="candidate-list"></div>'
      );
      renderModelConfigPanel();
      syncSelectHeader();
    }

    function loadCandidates() {
      status("Loading candidate sessions...", "warn");
      return api("/api/insights/candidates?limit=120")
        .then(function(data) {
          insightState.candidates = data.sessions || [];
          var tabs = ['all', 'cursor', 'copilot', 'cursor-cli', 'claude-code', 'codex', 'gemini'];
          var tabHtml = tabs.map(function(key) {
            var active = key === insightState.sourceFilter ? " active" : "";
            var label = key === "all" ? "All" : (sourceLabels[key] || key);
            return '<button type="button" class="source-tab' + active + '" data-source="' + key + '">' + escapeHtml(label) + '</button>';
          }).join("");
          var tabsHost = document.getElementById("source-tabs");
          if (tabsHost) tabsHost.innerHTML = tabHtml;
          var listHost = document.getElementById("candidate-list");
          if (listHost) listHost.innerHTML = renderCandidateList();
          syncSelectHeader();
          status("Select sessions to generate a report.", "ok");
        })
        .catch(function(err) {
          status(err.message || "Failed to load candidates", "err");
        });
    }

    function generateFromSelected() {
      var ids = Array.from(insightState.selected);
      if (!ids.length) return;
      if (!isModelReadyForGeneration()) {
        status("External model API key is missing. Configure Model Settings before generating.", "err");
        var apiKeyInput = document.getElementById("model-api-key");
        if (apiKeyInput && apiKeyInput.focus) apiKeyInput.focus();
        return;
      }
      var payload = modelPayloadFromForm();
      status("Generating report...", "warn");
      var btn = document.getElementById("btn-generate-report");
      if (btn) btn.disabled = true;
      api("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_ids: ids, model: payload })
      }).then(function(out) {
        status("Report generated.", "ok");
        if (out.report_id) {
          openRoute("/insights/" + out.report_id);
        } else {
          openRoute("/insights");
        }
      }).catch(function(err) {
        if (err && err.code === "INSIGHTS_MODEL_NOT_CONFIGURED") {
          status("Model API not configured. Set an API key or switch to Local Analysis.", "err");
          syncModelHint();
          var keyInput = document.getElementById("model-api-key");
          if (keyInput && keyInput.focus) keyInput.focus();
        } else {
          status(err.message || "Failed to generate report", "err");
        }
        if (btn) btn.disabled = false;
      });
    }

    function renderAtGlance(details) {
      var ag = details.at_a_glance || {};
      function cardHtml(card, cls) {
        if (!card) return "";
        return '<div class="section-card ' + cls + '">' +
          '<h3>' + escapeHtml(card.title || "") + '</h3>' +
          '<p>' + escapeHtml(card.body || "") + '</p>' +
          '<p style="margin-top:0.45rem;"><a href="javascript:void(0)">' + escapeHtml(card.cta || "") + "  ›</a></p>" +
        '</div>';
      }
      return cardHtml(ag.working, "callout-green") +
        cardHtml(ag.hindering, "callout-amber") +
        cardHtml(ag.quick_wins, "callout-blue") +
        cardHtml(ag.ambitious, "callout-dark");
    }

    function renderWhatYouWorkOn(details) {
      var data = details.what_you_work_on || {};
      var topics = Array.isArray(data.topics) ? data.topics : [];
      var caps = Array.isArray(data.top_capabilities) ? data.top_capabilities : [];
      var langs = Array.isArray(data.languages) ? data.languages : [];
      var sessionTypes = Array.isArray(data.session_types) ? data.session_types : [];
      var left = topics.map(function(item) {
        return '<div class="section-card">' +
          '<div style="display:flex;justify-content:space-between;gap:0.65rem;align-items:flex-start;">' +
            '<h3>' + escapeHtml(item.title || "") + '</h3>' +
            '<div style="color:var(--muted);font-size:0.88rem;">~' + formatNumber(item.sessions || 0) + " sessions</div>" +
          '</div>' +
          '<p>' + escapeHtml(item.summary || "") + '</p>' +
        '</div>';
      }).join("");
      function statList(title, list) {
        return '<div class="stats-box"><div class="stats-title">' + escapeHtml(title) + '</div>' +
          list.map(function(x) { return '<div class="stats-line"><span>' + escapeHtml(x.name || "") + '</span><strong>' + formatNumber(x.count || 0) + "</strong></div>"; }).join("") +
        '</div>';
      }
      return '<div class="two-col">' +
        '<div>' + left + '</div>' +
        '<div>' + statList("Top Capabilities", caps) + statList("Languages", langs) + statList("Session Types", sessionTypes) + '</div>' +
      '</div>';
    }

    function renderHowYouUseAI(details) {
      var data = details.how_you_use_ai || {};
      var dist = Array.isArray(data.response_time_distribution) ? data.response_time_distribution : [];
      var tod = Array.isArray(data.messages_by_time_of_day) ? data.messages_by_time_of_day : [];
      var maxDist = dist.reduce(function(m, x) { return Math.max(m, x.count || 0); }, 1);
      var maxTod = tod.reduce(function(m, x) { return Math.max(m, x.count || 0); }, 1);
      var distHtml = dist.map(function(item) {
        var pct = Math.max(8, Math.round(((item.count || 0) / maxDist) * 100));
        return '<div class="bar-row"><span>' + escapeHtml(item.name || "") + '</span><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><strong>' + formatNumber(item.count || 0) + '</strong></div>';
      }).join("");
      var todHtml = tod.map(function(item) {
        var pct = Math.max(8, Math.round(((item.count || 0) / maxTod) * 100));
        return '<div class="bar-row"><span>' + escapeHtml(item.name || "") + '</span><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><strong>' + formatNumber(item.count || 0) + '</strong></div>';
      }).join("");
      return '<div class="section-card">' +
          '<h3>Your AI Usage Pattern</h3>' +
          '<p>' + escapeHtml(data.overview || "") + '</p>' +
          '<p style="margin-top:0.5rem;"><strong>Key pattern:</strong> ' + escapeHtml(data.key_pattern || "") + '</p>' +
        '</div>' +
        '<div class="two-col">' +
          '<div class="section-card"><h3>Response Time Distribution</h3>' + distHtml + '</div>' +
          '<div class="section-card"><h3>Messages by Time of Day</h3>' + todHtml + '</div>' +
        '</div>' +
        '<div class="section-card"><h3>Multi-Assistant Usage</h3><p>' + escapeHtml(data.multi_assistant_usage || "") + '</p></div>';
    }

    function renderImpressive(details) {
      var data = details.impressive_things || {};
      var items = Array.isArray(data.items) ? data.items : [];
      var capabilities = Array.isArray(data.helped_capabilities) ? data.helped_capabilities : [];
      var outcomes = data.outcomes || {};
      var cards = items.map(function(item) {
        return '<div class="section-card"><h3>⭐ ' + escapeHtml(item.title || "") + '</h3><p>' + escapeHtml(item.body || "") + '</p></div>';
      }).join("");
      var chips = capabilities.map(function(item) {
        return '<span class="chip">' + escapeHtml(item.name || "") + " " + formatNumber(item.count || 0) + "</span>";
      }).join("");
      return '<div class="section-card"><p>' + escapeHtml(data.intro || "") + '</p></div>' +
        cards +
        '<div class="section-card"><h3>What Helped Most (AI Capabilities)</h3>' +
        '<div class="chips">' + chips + '</div>' +
        '<div style="margin-top:0.85rem;border-top:1px solid var(--border);padding-top:0.7rem;">' +
          '<span class="chip chip-success">Fully Achieved: ' + formatNumber(outcomes.fully_achieved || 0) + '</span> ' +
          '<span class="chip chip-warning">Partially Achieved: ' + formatNumber(outcomes.partially_achieved || 0) + '</span>' +
        '</div></div>';
    }

    function renderWhereWrong(details) {
      var data = details.where_things_go_wrong || {};
      var items = Array.isArray(data.items) ? data.items : [];
      var frictions = Array.isArray(data.friction_types) ? data.friction_types : [];
      var cards = items.map(function(item) {
        var evidence = Array.isArray(item.evidence) ? item.evidence : [];
        return '<div class="section-card callout-amber">' +
          '<h3>⚠ ' + escapeHtml(item.title || "") + '</h3>' +
          '<p>' + escapeHtml(item.body || "") + '</p>' +
          evidence.map(function(e) { return '<div class="bullet-note">' + escapeHtml(e) + "</div>"; }).join("") +
        '</div>';
      }).join("");
      var chips = frictions.map(function(item) {
        return '<span class="chip">' + escapeHtml(item.name || "") + " " + formatNumber(item.count || 0) + "</span>";
      }).join("");
      return '<div class="section-card"><p>' + escapeHtml(data.intro || "") + '</p></div>' + cards +
        '<div class="section-card"><h3>Primary Friction Types</h3><div class="chips">' + chips + '</div></div>';
    }

    function codeBlock(text) {
      return '<div class="code-block">' + escapeHtml(text || "") + '<button class="copy-btn" type="button" title="Copy">⧉</button></div>';
    }

    function renderFeatures(details) {
      var data = details.features_to_try || {};
      var cards = Array.isArray(data.cards) ? data.cards : [];
      var additions = Array.isArray(data.claude_md_additions) ? data.claude_md_additions : [];
      var actionCards = cards.map(function(item) {
        return '<div class="section-card">' +
          '<h3>' + escapeHtml(item.title || "") + '</h3>' +
          '<p>' + escapeHtml(item.body || "") + '</p>' +
          codeBlock(item.command || "") +
        '</div>';
      }).join("");
      var additionsHtml = additions.map(function(line) { return codeBlock(line); }).join("");
      return actionCards +
        '<div class="section-card"><h3>Suggested CLAUDE.md Additions</h3><p>Copy these into your project to improve assistant context.</p>' +
        additionsHtml +
        '</div>';
    }

    function renderHorizon(details) {
      var data = details.on_the_horizon || {};
      var cards = Array.isArray(data.cards) ? data.cards : [];
      return '<div class="section-card"><p>' + escapeHtml(data.intro || "") + '</p></div>' +
        cards.map(function(item) {
          return '<div class="section-card">' +
            '<h3>🚀 ' + escapeHtml(item.title || "") + '</h3>' +
            '<p>' + escapeHtml(item.body || "") + '</p>' +
            '<p style="margin-top:0.55rem;color:var(--muted);">Paste into your assistant:</p>' +
            codeBlock(item.prompt || "") +
          '</div>';
        }).join("");
    }

    function renderDetailTab(tab, details) {
      if (tab === "at_a_glance") return renderAtGlance(details);
      if (tab === "what_you_work_on") return renderWhatYouWorkOn(details);
      if (tab === "how_you_use_ai") return renderHowYouUseAI(details);
      if (tab === "impressive_things") return renderImpressive(details);
      if (tab === "where_things_go_wrong") return renderWhereWrong(details);
      if (tab === "features_to_try") return renderFeatures(details);
      return renderHorizon(details);
    }

    function renderDetailPage(reportId) {
      status("Loading report...", "warn");
      api("/api/insights/" + reportId)
        .then(function(data) {
          var report = data.report || {};
          var details = report.details || {};
          var title = safeText(report.title || "Insight Report");
          renderTop(
            '<div class="topbar">' +
              '<div class="breadcrumbs"><a href="/insights">← All Reports</a><span>|</span><span class="metric-strong">' + escapeHtml(title) + '</span></div>' +
            '</div>'
          );
          renderExtra(
            '<div class="metrics-strip">' +
              '<span>' + formatNumber(report.message_count || 0) + " messages across " + formatNumber(report.session_count || 0) + " sessions</span>" +
              '<span>|</span>' +
              '<span>Generated ' + escapeHtml(formatTime(report.created_at)) + '</span>' +
              '<span class="mobile-hidden">▢ <span class="metric-strong">' + formatNumber(report.message_count || 0) + '</span> Messages</span>' +
              '<span class="mobile-hidden">▢ <span class="metric-strong">' + formatNumber(report.snippet_count || 0) + '</span> Snippets</span>' +
              '<span class="mobile-hidden">▢ <span class="metric-strong">' + formatNumber(report.session_count || 0) + '</span> Sessions</span>' +
              '<span class="mobile-hidden">⚡ <span class="metric-strong">' + (report.session_count ? (report.message_count / report.session_count).toFixed(1) : "0.0") + '</span> Msgs/Session</span>' +
            '</div>' +
            '<div class="tabs" id="detail-tabs"></div>'
          );
          var tabs = [
            { key: "at_a_glance", label: "At a Glance" },
            { key: "what_you_work_on", label: "What You Work On" },
            { key: "how_you_use_ai", label: "How You Use AI" },
            { key: "impressive_things", label: "Impressive Things" },
            { key: "where_things_go_wrong", label: "Where Things Go Wrong" },
            { key: "features_to_try", label: "Features to Try" },
            { key: "on_the_horizon", label: "On the Horizon" }
          ];
          var tabHost = document.getElementById("detail-tabs");
          if (tabHost) {
            tabHost.innerHTML = tabs.map(function(tab) {
              var active = tab.key === insightState.tab ? " active" : "";
              return '<button type="button" class="tab' + active + '" data-tab="' + tab.key + '">' + escapeHtml(tab.label) + '</button>';
            }).join("");
          }
          renderRoot(renderDetailTab(insightState.tab, details));
          status("Loaded report #" + reportId, "ok");
        })
        .catch(function(err) {
          status(err.message || "Failed to load report", "err");
          renderRoot('<div class="empty">Unable to load this report.</div>');
        });
    }

    function removeReport(id) {
      if (!window.confirm("Delete this report permanently?")) return;
      status("Deleting report...", "warn");
      api("/api/insights/" + id, { method: "DELETE" })
        .then(function() {
          status("Report deleted.", "ok");
          renderListPage();
        })
        .catch(function(err) {
          status(err.message || "Failed to delete report", "err");
        });
    }

    function wireGlobalEvents() {
      document.getElementById("sb-source").addEventListener("change", function() {
        sidebarState.source = this.value || "";
        sidebarState.page = 1;
        void loadSidebarSessions();
      });
      document.getElementById("sb-search").addEventListener("input", function() {
        sidebarState.q = this.value || "";
        sidebarState.page = 1;
        void loadSidebarSessions();
      });
      document.getElementById("sb-prev").addEventListener("click", function() {
        if (sidebarState.page <= 1) return;
        sidebarState.page -= 1;
        void loadSidebarSessions();
      });
      document.getElementById("sb-next").addEventListener("click", function() {
        sidebarState.page += 1;
        void loadSidebarSessions();
      });
      document.getElementById("sb-settings").addEventListener("click", function() {
        openRoute("/settings");
      });

      document.body.addEventListener("change", function(e) {
        if (!e || !e.target) return;
        if (e.target.id === "model-mode") {
          modelState.settings.mode_default = e.target.value === "external" ? "external" : "local";
          renderModelConfigPanel();
          syncSelectHeader();
        }
      });

      document.body.addEventListener("input", function(e) {
        if (!e || !e.target) return;
        if (e.target.id === "model-api-key") {
          syncModelHint();
          syncSelectHeader();
        }
      });

      document.body.addEventListener("click", function(e) {
        var saveModelBtn = e.target.closest("#btn-save-model");
        if (saveModelBtn) {
          saveModelConfig();
          return;
        }
        var testModelBtn = e.target.closest("#btn-test-model");
        if (testModelBtn) {
          testModelConfig();
          return;
        }
        var viewBtn = e.target.closest(".view-report");
        if (viewBtn) {
          var card = viewBtn.closest(".report-card[data-report-id]");
          if (!card) return;
          var id = parseInt(card.getAttribute("data-report-id") || "0", 10);
          if (id > 0) openRoute("/insights/" + id);
          return;
        }
        var deleteBtn = e.target.closest(".delete-report");
        if (deleteBtn) {
          var cardDelete = deleteBtn.closest(".report-card[data-report-id]");
          if (!cardDelete) return;
          var idDelete = parseInt(cardDelete.getAttribute("data-report-id") || "0", 10);
          if (idDelete > 0) removeReport(idDelete);
          return;
        }
        var sourceTab = e.target.closest(".source-tab[data-source]");
        if (sourceTab) {
          insightState.sourceFilter = sourceTab.getAttribute("data-source") || "all";
          var tabHost = document.getElementById("source-tabs");
          if (tabHost) {
            tabHost.querySelectorAll(".source-tab").forEach(function(tab) { tab.classList.remove("active"); });
            sourceTab.classList.add("active");
          }
          var listHost = document.getElementById("candidate-list");
          if (listHost) listHost.innerHTML = renderCandidateList();
          return;
        }
        var candidate = e.target.closest(".candidate-card[data-session-id]");
        if (candidate) {
          var sid = parseInt(candidate.getAttribute("data-session-id") || "0", 10);
          if (!sid) return;
          if (insightState.selected.has(sid)) insightState.selected.delete(sid);
          else insightState.selected.add(sid);
          var listHostToggle = document.getElementById("candidate-list");
          if (listHostToggle) listHostToggle.innerHTML = renderCandidateList();
          syncSelectHeader();
          return;
        }
        var selectAllBtn = e.target.closest("#btn-select-all");
        if (selectAllBtn) {
          var filtered = (insightState.candidates || []).filter(function(item) {
            return insightState.sourceFilter === "all" || item.source === insightState.sourceFilter;
          });
          var allSelected = filtered.length > 0 && filtered.every(function(item) { return insightState.selected.has(item.id); });
          if (allSelected) {
            filtered.forEach(function(item) { insightState.selected.delete(item.id); });
          } else {
            filtered.forEach(function(item) { insightState.selected.add(item.id); });
          }
          var listHostSelectAll = document.getElementById("candidate-list");
          if (listHostSelectAll) listHostSelectAll.innerHTML = renderCandidateList();
          syncSelectHeader();
          return;
        }
        var generateBtn = e.target.closest("#btn-generate-report");
        if (generateBtn) {
          generateFromSelected();
          return;
        }
        var tab = e.target.closest(".tab[data-tab]");
        if (tab) {
          var route = getRouteInfo();
          if (route.view !== "detail") return;
          insightState.tab = tab.getAttribute("data-tab") || "at_a_glance";
          renderDetailPage(route.id);
          return;
        }
        var copyBtn = e.target.closest(".copy-btn");
        if (copyBtn) {
          var parent = copyBtn.parentElement;
          if (!parent) return;
          var text = parent.textContent ? parent.textContent.replace("⧉", "").trim() : "";
          if (text && navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function() {
              status("Copied.", "ok");
            }).catch(function() {});
          }
        }
      });
    }

    function renderRoute() {
      var route = getRouteInfo();
      if (route.view === "new") {
        renderNewPageLayout();
        void Promise.all([loadModelConfig(), loadCandidates()]);
        return;
      }
      if (route.view === "detail") {
        if (!route.id) {
          renderRoot('<div class="empty">Invalid report id.</div>');
          return;
        }
        renderDetailPage(route.id);
        return;
      }
      renderListPage();
    }

    wireGlobalEvents();
    loadSidebarSessions().then(function() {
      renderRoute();
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

const SOURCE_DESCRIPTIONS: Record<db.Source, string> = {
  cursor: "Local SQLite database from Cursor editor sessions.",
  copilot: "Copilot Chat conversation logs from VS Code / JetBrains.",
  "cursor-cli": "Terminal-based Cursor CLI session history.",
  "claude-code": "Anthropic Claude Code project session files.",
  codex: "OpenAI Codex CLI local session files.",
  gemini: "Google Gemini exported conversation files.",
};

function parseSourceKey(raw: string): db.Source | null {
  if (!Object.prototype.hasOwnProperty.call(SOURCE_LABELS, raw)) return null;
  return raw as db.Source;
}

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

function parseJsonStringArray(value: string): string[] {
  return parseJsonArray(value).filter((item): item is string => typeof item === "string");
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
          const enabledSources = db.listEnabledSources();
          const fallbackSources = (Object.keys(SOURCE_LABELS) as db.Source[]);
          const sources = enabledSources.length > 0 ? enabledSources : fallbackSources;
          const stats = runIngest({ sources });
          const syncAt = Date.now();
          for (const source of sources) {
            db.updateSourceSettings(source, { last_sync_at: syncAt });
          }
          sendJson(res, 200, { sessions: stats.sessions, messages: stats.messages, sources, last_sync_at: syncAt });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Index failed";
          sendError(res, 500, "INDEX_FAILED", message);
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
          const selectedSessionIds = Array.isArray(body.session_ids)
            ? body.session_ids
                .map((id) => (typeof id === "number" ? Math.trunc(id) : Number.NaN))
                .filter((id) => Number.isFinite(id) && id > 0)
            : [];
          const uniqueSessionIds = [...new Set(selectedSessionIds)];
          const sessionsByIds = uniqueSessionIds.length > 0 ? db.listSessionsByIds(uniqueSessionIds) : [];
          const sessionIdSet = new Set(sessionsByIds.map((item) => item.id));
          const validSelectedIds = uniqueSessionIds.filter((id) => sessionIdSet.has(id));

          const workspaceFromScope = typeof scopeRaw.workspace === "string" ? scopeRaw.workspace.trim() : "";
          const workspaceFromSessions = sessionsByIds.length > 0
            ? [...new Set(sessionsByIds.map((s) => s.workspace).filter((w) => Boolean(w && w.trim())))]
            : [];
          const workspace =
            workspaceFromScope ||
            (workspaceFromSessions.length === 1
              ? workspaceFromSessions[0] ?? ""
              : workspaceFromSessions.length > 1
                ? "(mixed)"
                : "") ||
            db.getMostRecentWorkspace() ||
            "";

          const sourcesFromScope =
            Array.isArray(scopeRaw.sources)
              ? scopeRaw.sources
                  .filter((s): s is string => typeof s === "string" && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, s))
                  .map((s) => s as db.Source)
              : [];
          const sourcesFromSelected =
            sessionsByIds
              .map((s) => s.source)
              .filter((s): s is db.Source => Object.prototype.hasOwnProperty.call(SOURCE_LABELS, s));
          const sources = [...new Set(validSelectedIds.length > 0 ? sourcesFromSelected : sourcesFromScope)];
          const timeFrom = typeof scopeRaw.time_from === "number" ? Math.trunc(scopeRaw.time_from) : undefined;
          const timeTo = typeof scopeRaw.time_to === "number" ? Math.trunc(scopeRaw.time_to) : undefined;
          const settings = db.getModelSettings();
          const mode =
            modelRaw.mode === "external" || modelRaw.mode === "local"
              ? modelRaw.mode
              : settings.mode_default;
          const externalRequestedInPayload = modelRaw.mode === "external" || modelRaw.external_enabled === true;
          if (mode === "external" && !settings.external_enabled && !externalRequestedInPayload) {
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
          const messages =
            validSelectedIds.length > 0
              ? db.getMessagesForSessionIds(validSelectedIds)
              : db.getMessagesForInsightScope({
                  workspace,
                  timeFrom,
                  timeTo,
                  sources,
                });
          if (messages.length === 0) {
            sendError(res, 400, "INVALID_ARGUMENT", "No messages found in selected scope or session selection");
            return;
          }
          const insight = await generateInsight(messages, modelConfig);
          const sessionMessageCountMap = new Map<number, number>();
          for (const message of messages) {
            sessionMessageCountMap.set(message.session_id, (sessionMessageCountMap.get(message.session_id) ?? 0) + 1);
          }
          const selectedSessionsForReport =
            validSelectedIds.length > 0
              ? validSelectedIds.map((sessionId) => ({
                  sessionId,
                  messageCount: sessionMessageCountMap.get(sessionId) ?? 0,
                }))
              : [...sessionMessageCountMap.entries()].map(([sessionId, messageCount]) => ({ sessionId, messageCount }));

          const reportId = db.insertInsightReport({
            title: insight.title,
            workspace,
            scopeJson: JSON.stringify({
              workspace,
              time_from: timeFrom ?? null,
              time_to: timeTo ?? null,
              sources,
              session_ids: validSelectedIds,
            }),
            modelMode: mode,
            provider: modelConfig.provider ?? null,
            modelName: modelConfig.modelName ?? null,
            summaryMd: insight.summary,
            patternsJson: JSON.stringify(insight.patterns),
            feedbackJson: JSON.stringify(insight.feedback),
            detailsJson: JSON.stringify(insight.details),
            sessionCount: insight.sessionCount,
            messageCount: insight.messageCount,
            snippetCount: insight.snippetCount,
            sourcesJson: JSON.stringify(insight.sources),
            scoreEfficiency: insight.scores.efficiency,
            scoreStability: insight.scores.stability,
            scoreDecisionClarity: insight.scores.decision_clarity,
            scoreReasonsJson: JSON.stringify(insight.scoreReasons),
            status: "completed",
          });
          db.insertInsightEvidence(reportId, insight.evidence);
          db.insertInsightReportSessions(reportId, selectedSessionsForReport);
          sendJson(res, 200, {
            report_id: reportId,
            status: "completed",
            title: insight.title,
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

      const sourceUpdateMatch = path.match(/^\/api\/settings\/sources\/([a-z-]+)$/);
      if (sourceUpdateMatch && method === "PUT") {
        try {
          const source = parseSourceKey(sourceUpdateMatch[1] ?? "");
          if (!source) {
            sendError(res, 400, "INVALID_ARGUMENT", "Unknown source");
            return;
          }
          const body = await readJsonBody(req);
          const patch: db.SourceSettingsPatch = {};
          if (typeof body.enabled === "boolean") {
            patch.enabled = body.enabled;
          }
          if (typeof body.path === "string") {
            patch.path = body.path.trim();
          }
          if (
            body.mode === "local_files" ||
            body.mode === "file_import" ||
            body.mode === "api"
          ) {
            patch.mode = body.mode;
          }
          if (typeof body.last_sync_at === "number" && Number.isFinite(body.last_sync_at)) {
            patch.last_sync_at = Math.trunc(body.last_sync_at);
          } else if (body.last_sync_at === null) {
            patch.last_sync_at = null;
          }
          const updated = db.updateSourceSettings(source, patch);
          sendJson(res, 200, { source: updated });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to update source settings";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      const sourceSyncMatch = path.match(/^\/api\/settings\/sources\/([a-z-]+)\/sync$/);
      if (sourceSyncMatch && method === "POST") {
        try {
          const source = parseSourceKey(sourceSyncMatch[1] ?? "");
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to sync source";
          sendError(res, 500, "INDEX_FAILED", message);
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
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      const insightDeleteMatch = path.match(/^\/api\/insights\/(\d+)$/);
      if (insightDeleteMatch && method === "DELETE") {
        try {
          const reportId = parseInt(insightDeleteMatch[1] ?? "0", 10);
          if (!reportId) {
            sendError(res, 400, "INVALID_ARGUMENT", "Invalid report id");
            return;
          }
          const removed = db.deleteInsightReport(reportId);
          if (!removed) {
            sendError(res, 404, "NOT_FOUND", "Insight report not found");
            return;
          }
          sendJson(res, 200, { ok: true, report_id: reportId });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete insight report";
          sendError(res, 500, "DB_QUERY_FAILED", message);
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

      if (path === "/insights" || path === "/insights/new" || /^\/insights\/\d+$/.test(path)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getInsightsReportsPage());
        return;
      }

      if (path === "/settings") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(getSettingsPage());
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

      if (path === "/api/settings/sources") {
        try {
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
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to read source settings";
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

      if (path === "/api/search") {
        const params = getQueryParams(url);
        const q = (params.get("q") ?? "").trim();
        const limit = parseInt(params.get("limit") ?? "20", 10) || 20;
        const source = params.get("source") || null;
        try {
          const data = serveSearchApi(q, limit, source);
          sendJson(res, 200, data);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Search failed";
          sendError(res, 500, "SEARCH_FAILED", message);
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
          const summary = db.getInsightReportAggregates(workspace);
          const reports = rows.map((r) => ({
            id: r.id,
            title: r.title || "Insight Report",
            workspace: r.workspace,
            scope: parseJsonObject(r.scope_json),
            model_mode: r.model_mode,
            provider: r.provider,
            model_name: r.model_name,
            summary: r.summary_md,
            patterns: parseJsonStringArray(r.patterns_json),
            feedback: parseJsonStringArray(r.feedback_json),
            details: parseJsonObject(r.details_json),
            session_count: r.session_count,
            message_count: r.message_count,
            snippet_count: r.snippet_count,
            sources: parseJsonStringArray(r.sources_json),
            scores: {
              efficiency: r.score_efficiency,
              stability: r.score_stability,
              decision_clarity: r.score_decision_clarity,
            },
            score_reasons: parseJsonStringArray(r.score_reasons_json),
            status: r.status,
            created_at: r.created_at,
            updated_at: r.updated_at,
          }));
          sendJson(res, 200, { reports, total, summary });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to list insights";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/insights/candidates") {
        try {
          const params = getQueryParams(url);
          const source = params.get("source");
          const workspace = params.get("workspace");
          const query = params.get("q");
          const limit = parseIntSafe(params.get("limit"), 120);
          const offset = parseIntSafe(params.get("offset"), 0);
          const timeFrom = parseOptInt(params.get("time_from"));
          const timeTo = parseOptInt(params.get("time_to"));
          const parsedSource =
            source && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, source) ? (source as db.Source) : undefined;
          const sessions = db.listSessionsAdvanced({
            source: parsedSource,
            workspace: workspace && workspace.trim() ? workspace.trim() : undefined,
            query: query && query.trim() ? query.trim() : undefined,
            timeFrom: typeof timeFrom === "number" ? timeFrom : undefined,
            timeTo: typeof timeTo === "number" ? timeTo : undefined,
            limit,
            offset,
          });
          const total = db.countSessionsAdvanced({
            source: parsedSource,
            workspace: workspace && workspace.trim() ? workspace.trim() : undefined,
            query: query && query.trim() ? query.trim() : undefined,
            timeFrom: typeof timeFrom === "number" ? timeFrom : undefined,
            timeTo: typeof timeTo === "number" ? timeTo : undefined,
          });
          sendJson(res, 200, { sessions, total });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to list insight candidates";
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
              title: data.report.title || "Insight Report",
              workspace: data.report.workspace,
              scope: parseJsonObject(data.report.scope_json),
              model_mode: data.report.model_mode,
              provider: data.report.provider,
              model_name: data.report.model_name,
              summary: data.report.summary_md,
              patterns: parseJsonStringArray(data.report.patterns_json),
              feedback: parseJsonStringArray(data.report.feedback_json),
              details: parseJsonObject(data.report.details_json),
              session_count: data.report.session_count,
              message_count: data.report.message_count,
              snippet_count: data.report.snippet_count,
              sources: parseJsonStringArray(data.report.sources_json),
              scores: {
                efficiency: data.report.score_efficiency,
                stability: data.report.score_stability,
                decision_clarity: data.report.score_decision_clarity,
              },
              score_reasons: parseJsonStringArray(data.report.score_reasons_json),
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
            sessions: data.sessions.map((s) => ({
              id: s.session_id,
              source: s.source,
              workspace: s.workspace,
              external_id: s.external_id,
              last_at: s.last_at,
              message_count: s.message_count,
            })),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load insight report";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/sessions") {
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
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      if (path === "/api/session") {
        const params = getQueryParams(url);
        const sessionId = parseInt(params.get("session_id") ?? "0", 10);
        if (!sessionId) {
          sendError(res, 400, "INVALID_ARGUMENT", "Missing session_id");
          return;
        }
        const limit = parseIntSafe(params.get("limit"), 2000);
        const offset = parseIntSafe(params.get("offset"), 0);
        const order = params.get("order") === "desc" ? "desc" : "asc";
        try {
          const data = serveSessionDetailApi(sessionId, limit, offset, order);
          if (!data) {
            sendError(res, 404, "NOT_FOUND", "Session not found");
            return;
          }
          sendJson(res, 200, data);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to load session";
          sendError(res, 500, "DB_QUERY_FAILED", message);
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Internal server error";
      sendError(res, 500, "INTERNAL_ERROR", message);
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
