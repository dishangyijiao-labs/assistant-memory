export const insightsReportsScriptList = `
    var MIN_INSIGHT_TOTAL_MESSAGES = 10;
    var MIN_INSIGHT_USER_MESSAGES = 5;
    function renderTomorrowPlan(items) {
      var list = Array.isArray(items) ? items : [];
      if (!list.length) {
        return '<div class="plan-empty">No items yet. Add action items from report details.</div>';
      }
      return list.map(function(item) {
        var done = item.status === "done";
        var cls = "plan-item" + (done ? " done" : "");
        var reportLink = item.source_report_id
          ? '<a class="plan-link" href="/insights/' + encodeURIComponent(String(item.source_report_id)) + '">View source report</a>'
          : "";
        return '<div class="' + cls + '" data-plan-id="' + escapeHtml(item.id || "") + '">' +
          '<div class="plan-main">' +
            '<div class="plan-action">' + escapeHtml(item.action || "") + '</div>' +
            '<div class="plan-meta">' + escapeHtml(formatTime(item.created_at)) + reportLink + '</div>' +
          '</div>' +
          '<div class="plan-actions">' +
            '<button type="button" class="btn-ghost plan-toggle" data-next-status="' + (done ? "open" : "done") + '">' + (done ? "Reopen" : "Done") + '</button>' +
            '<button type="button" class="delete-btn plan-delete" title="Delete">🗑</button>' +
          '</div>' +
        '</div>';
      }).join("");
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
      Promise.all([api("/api/insights?limit=50"), api("/api/insights/tomorrow-plan?limit=3")])
        .then(function(res) {
          var data = res[0] || {};
          var planData = res[1] || {};
          var summary = data.summary || { total_reports: 0, sessions_analyzed: 0, messages_analyzed: 0 };
          var planItems = Array.isArray(planData.items) ? planData.items : [];
          var html =
            '<div class="reports-head">' +
              '<div>' +
                '<div style="font-size:1.7rem;font-weight:700;line-height:1.1;">Report History</div>' +
                '<p class="subtitle" style="margin-top:0.4rem;">Select sessions, generate targeted insights reports, and review your history.</p>' +
              '</div>' +
              '<button id="btn-new-report" class="btn-primary" type="button">＋ New Report</button>' +
            '</div>' +
            '<div class="plan-panel">' +
              '<div class="plan-head"><h3>Tomorrow Plan</h3><span class="plan-count">' + formatNumber(planItems.length) + ' item(s)</span></div>' +
              renderTomorrowPlan(planItems) +
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
      var selectedRows = (insightState.candidates || []).filter(function(item) { return insightState.selected.has(item.id); });
      var estimatedTotalMessages = selectedRows.reduce(function(sum, item) { return sum + Number(item.message_count || 0); }, 0);
      var estimatedUserMessages = Math.floor(estimatedTotalMessages / 2);
      if (estimatedTotalMessages < MIN_INSIGHT_TOTAL_MESSAGES || estimatedUserMessages < MIN_INSIGHT_USER_MESSAGES) {
        status(
          "Sample too small for reliable insights. Need at least " +
            MIN_INSIGHT_TOTAL_MESSAGES + " total messages and " +
            MIN_INSIGHT_USER_MESSAGES + " user messages (estimated).",
          "err"
        );
        return;
      }
      if (!isModelReadyForGeneration()) {
        status("External model API key is missing. Configure it in the panel above before generating.", "err");
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
        if (err && err.code === "INSIGHTS_SAMPLE_TOO_SMALL") {
          status(err.message || "Sample too small for reliable insights.", "err");
        } else if (err && err.code === "INSIGHTS_MODEL_NOT_CONFIGURED") {
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
