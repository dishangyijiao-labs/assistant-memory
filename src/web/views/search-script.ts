export const searchPageScript = `
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
      if (session.preview) {
        var preview = session.preview.trim();
        if (preview.length > 60) {
          return preview.substring(0, 60) + "…";
        }
        return preview;
      }
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
        html += '<p class="guidance">Click <strong>Index Now</strong> to scan AI chat history, or run <code>npx assistmem index</code></p>';
      }
      html += '</div>';
      document.getElementById("messages").innerHTML = html;
      document.getElementById("copy-session").disabled = true;
    }

    function renderMessages(messages, qualityScores) {
      selectedMessages = messages || [];
      qualityScores = qualityScores || {};
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
        var q = role === "user" ? qualityScores[m.id] : null;
        var badgeHtml = q ? '<a href="/session?session_id=' + escapeHtml(String(selectedSession.id)) + '&message_id=' + escapeHtml(String(m.id)) + '" class="quality-badge quality-' + (q.grade || "c").toLowerCase().charAt(0) + '" title="Prompt quality">' + escapeHtml(String(q.score || "?")) + ' ' + escapeHtml(q.grade || "?") + '</a>' : '';
        return '<div class="chat-msg ' + msgClass + '">' +
          avatarHtml +
          '<div class="bubble-wrap"><div class="bubble ' + bubbleClass + '">' + content + '</div>' + badgeHtml + '</div>' +
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
      var analyzeEl = document.getElementById("analyze-session");
      if (!session) {
        titleEl.textContent = "Select a session";
        if (analyzeEl) {
          analyzeEl.style.display = "none";
          analyzeEl.setAttribute("href", "#");
          delete analyzeEl.dataset.sessionId;
        }
        return;
      }
      titleEl.textContent = getSessionTitle(session);
      if (analyzeEl) {
        var sid = String(session.id || "");
        analyzeEl.href = "/session?session_id=" + encodeURIComponent(sid);
        analyzeEl.dataset.sessionId = sid;
        analyzeEl.style.display = "";
      }
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
          renderMessages(data.messages || [], data.quality_scores || {});
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

    document.getElementById("analyze-session").addEventListener("click", function (e) {
      e.preventDefault();
      var sid = this.dataset.sessionId || (selectedSession && selectedSession.id ? String(selectedSession.id) : "");
      if (!sid) {
        showToast("Select a session first");
        return;
      }
      window.location.href = "/session?session_id=" + encodeURIComponent(sid);
    });

    /* Init */
    loadSessions();
  </script>
`;
