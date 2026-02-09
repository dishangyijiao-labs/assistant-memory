export default function getSessionPage(): string {
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

