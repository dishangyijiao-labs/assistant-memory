export default function getSessionPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AssistMem – Session</title>
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
    .quality-badge { font-size: 0.7rem; padding: 0.15rem 0.45rem; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem; margin-top: 0.35rem; }
    .quality-badge.grade-a, .quality-badge.grade-b { background: #d1fae5; color: #065f46; }
    .quality-badge.grade-c { background: #fef3c7; color: #92400e; }
    .quality-badge.grade-d, .quality-badge.grade-f { background: #fee2e2; color: #991b1b; }
    .quality-panel { margin-top: 0.5rem; padding: 0.6rem; background: rgba(0,0,0,0.03); border-radius: 6px; font-size: 0.78rem; }
    .quality-panel .deductions { color: var(--muted); margin-bottom: 0.4rem; }
    .quality-panel .rewrites { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
    .rewrite-chip { display: inline-flex; align-items: center; gap: 0.3rem; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 0.25rem 0.5rem; max-width: 100%; }
    .rewrite-chip .label { font-size: 0.68rem; color: var(--muted); text-transform: uppercase; flex-shrink: 0; }
    .rewrite-chip .text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
    .rewrite-chip button { flex-shrink: 0; background: var(--accent-soft); color: var(--accent); border: none; border-radius: 4px; padding: 0.2rem 0.4rem; font-size: 0.7rem; cursor: pointer; }
    .rewrite-chip button:hover { background: var(--accent); color: #fff; }
    .btn-analyze { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 0.4rem 0.75rem; font-size: 0.8rem; cursor: pointer; }
    .btn-analyze:hover { background: var(--accent-hover); }
    .btn-analyze:disabled { opacity: 0.6; cursor: not-allowed; }
    .analyze-status { margin-top: 0.35rem; font-size: 0.78rem; color: var(--muted); text-align: right; min-height: 1.1rem; }
    .analyze-status.error { color: #b91c1c; }
    .analyze-status.ok { color: #166534; }
    .analyze-status a { color: inherit; text-decoration: underline; }
    .date-separator {
      align-self: center;
      font-size: 0.72rem;
      color: var(--muted);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.18rem 0.65rem;
      margin: 0.4rem 0;
      user-select: none;
      pointer-events: none;
    }
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
      <div>
        <button type="button" class="btn-analyze" id="btnAnalyze" style="display:none">Insights</button>
        <div class="analyze-status" id="analyzeStatus"></div>
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

    function copyToClipboard(text, btn) {
      navigator.clipboard.writeText(text).then(function() {
        var orig = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(function() { btn.textContent = orig; }, 800);
      });
    }

    function buildQualityHtml(q) {
      if (!q) return "";
      var gradeClass = "grade-" + (q.grade ? q.grade.toLowerCase() : "c").charAt(0);
      var badge = '<div class="quality-badge ' + gradeClass + '">' + escapeHtml(String(q.score)) + " " + escapeHtml(q.grade || "?") + "</div>";
      var deductions = Array.isArray(q.deductions) && q.deductions.length ? q.deductions.map(function(d) { return (d.reason || d.code || "").trim(); }).filter(Boolean).slice(0, 3) : [];
      var rewrites = q.rewrites && typeof q.rewrites === "object" ? q.rewrites : {};
      var shortR = rewrites.short || "";
      var engR = rewrites.engineering || "";
      var expR = rewrites.exploratory || "";
      var hasRewrites = shortR || engR || expR;
      if (!deductions.length && !hasRewrites) return badge;
      var panel = '<div class="quality-panel">';
      if (deductions.length) panel += '<div class="deductions">' + escapeHtml(deductions.join(" · ")) + "</div>";
      if (hasRewrites) {
        panel += '<div class="rewrites">';
        if (shortR) panel += '<div class="rewrite-chip"><span class="label">Short</span><span class="text">' + escapeHtml(shortR.slice(0, 50) + (shortR.length > 50 ? "…" : "")) + '</span><span class="copy-src" style="display:none">' + escapeHtml(shortR) + '</span><button type="button">Copy</button></div>';
        if (engR) panel += '<div class="rewrite-chip"><span class="label">Engineering</span><span class="text">' + escapeHtml(engR.slice(0, 50) + (engR.length > 50 ? "…" : "")) + '</span><span class="copy-src" style="display:none">' + escapeHtml(engR) + '</span><button type="button">Copy</button></div>';
        if (expR) panel += '<div class="rewrite-chip"><span class="label">Exploratory</span><span class="text">' + escapeHtml(expR.slice(0, 50) + (expR.length > 50 ? "…" : "")) + '</span><span class="copy-src" style="display:none">' + escapeHtml(expR) + '</span><button type="button">Copy</button></div>';
        panel += "</div>";
      }
      panel += "</div>";
      return badge + panel;
    }

    function getDateKey(ts) {
      var d = ts ? new Date(ts) : new Date();
      return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    }

    function formatDateLabel(ts) {
      if (!ts) return "Unknown date";
      var d = new Date(ts);
      var now = new Date();
      var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      var yesterdayStart = todayStart - 86400000;
      if (ts >= todayStart) return "Today";
      if (ts >= yesterdayStart) return "Yesterday";
      try {
        return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(d);
      } catch (_e) {}
      return d.toDateString();
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

      var userCount = (data.messages || []).filter(function(m) { return (m.role || "").toLowerCase() === "user"; }).length;
      var btn = document.getElementById("btnAnalyze");
      var status = document.getElementById("analyzeStatus");
      if (btn) {
        btn.style.display = userCount > 0 ? "inline-block" : "none";
        btn.disabled = false;
        btn.textContent = "Insights";
        if (userCount > 0) {
          btn.dataset.sessionId = String(s.id);
        } else {
          delete btn.dataset.sessionId;
        }
      }
      if (status) {
        status.textContent = "";
        status.className = "analyze-status";
      }

      var qualityScores = data.quality_scores || {};
      var html = "";
      var lastDateKey = null;
      (data.messages || []).forEach(function (m) {
        var dk = getDateKey(m.timestamp);
        if (dk !== lastDateKey) {
          html += '<div class="date-separator">' + escapeHtml(formatDateLabel(m.timestamp)) + '</div>';
          lastDateKey = dk;
        }
        var ts = formatTime(m.timestamp);
        var role = (m.role || "assistant").toLowerCase();
        var roleClass = role === "user" ? "role-user" : role === "assistant" ? "role-assistant" : "role-system";
        var highlight = highlightMessageId && String(m.id) === String(highlightMessageId) ? " highlight" : "";
        var content = renderMarkdown(m.content || "(empty)");
        var qualityHtml = role === "user" ? buildQualityHtml(qualityScores[m.id]) : "";
        html += '<div class="message ' + roleClass + highlight + '" data-message-id="' + m.id + '">' +
          '<div class="message-meta"><span class="role">' + escapeHtml(m.role || "assistant") + '</span><span>' + escapeHtml(ts) + '</span></div>' +
          '<div class="message-content">' + content + '</div>' +
          (qualityHtml ? '<div class="quality-feedback">' + qualityHtml + "</div>" : "") +
        '</div>';
      });
      document.getElementById("messages").innerHTML = html || '<div class="empty-state">No messages found.</div>';

      document.querySelectorAll(".rewrite-chip").forEach(function(chip) {
        var src = chip.querySelector(".copy-src");
        var btn = chip.querySelector("button");
        if (src && btn) btn.addEventListener("click", function() { copyToClipboard(src.textContent || "", btn); });
      });

      if (highlightMessageId) {
        var target = document.querySelector('.message[data-message-id="' + highlightMessageId + '"]');
        if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    function runAnalyze(sessionId, btn) {
      if (!btn) return;
      if (!sessionId || !Number.isFinite(sessionId)) return;
      var status = document.getElementById("analyzeStatus");
      btn.disabled = true;
      btn.textContent = "Analyzing…";
      if (status) {
        status.textContent = "Running quality analysis...";
        status.className = "analyze-status";
      }
      fetch("/api/quality/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then(function(res) {
          return res.text().then(function(text) {
            var data;
            try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
            if (!res.ok) {
              var msg = (data && data.error && data.error.message) ? data.error.message : (data && data.error) ? String(data.error) : text ? text.slice(0, 200) : "Analysis failed";
              var err = new Error(msg);
              if (data && data.error && typeof data.error.code === "string") err.code = data.error.code;
              throw err;
            }
            return data;
          });
        })
        .then(function(result) {
          btn.textContent = "Analyzed " + (result.analyzed || 0);
          if (status) {
            status.textContent = "Done. Refreshing...";
            status.className = "analyze-status ok";
          }
          setTimeout(function() { location.reload(); }, 600);
        })
        .catch(function(err) {
          btn.disabled = false;
          btn.textContent = "Insights";
          var msg = err && err.message ? err.message : "Analysis failed. Configure Insights Setup first.";
          var code = err && err.code ? String(err.code) : "";
          var needsApiKeyLink = code === "QUALITY_MODEL_NOT_CONFIGURED" || /api key/i.test(msg);
          if (status) {
            if (needsApiKeyLink) {
              status.innerHTML = escapeHtml(msg) + ' <a href="/insights/new">Configure API key</a>';
            } else {
              status.textContent = msg;
            }
            status.className = "analyze-status error";
          }
        });
    }

    var btnAnalyze = document.getElementById("btnAnalyze");
    if (btnAnalyze) {
      btnAnalyze.addEventListener("click", function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (btnAnalyze.disabled) return;
        var sidRaw = btnAnalyze.dataset.sessionId || "";
        var sid = parseInt(sidRaw, 10);
        if (!sid || !Number.isFinite(sid)) return;
        runAnalyze(sid, btnAnalyze);
      });
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
