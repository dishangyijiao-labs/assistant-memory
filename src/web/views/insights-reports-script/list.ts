export const insightsReportsScriptList = `
    function renderReportList(reports) {
      if (!reports.length) {
        return '<div class="empty">No reports yet. Click "New Report" to generate your first insight report.</div>';
      }
      return reports.map(function(r) {
        var tags = Array.isArray(r.sources) ? r.sources : [];
        return '<div class="report-card" data-report-id="' + r.id + '">' +
          '<div>' +
            '<div class="report-title">' + escapeHtml(r.title || ("Report #" + r.id)) + '</div>' +
            '<div class="report-meta">' + escapeHtml(formatTime(r.created_at)) + " · " + formatNumber(r.session_count || 0) + " sessions · " + formatNumber(r.message_count || 0) + " messages</div>" +
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
      if (row.preview) {
        var preview = safeText(row.preview.trim());
        if (preview.length > 60) {
          return preview.substring(0, 60) + "…";
        }
        return preview;
      }
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
`;
