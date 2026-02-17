export const insightsScript = `
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
      if (mode === "external" || mode === "agent") {
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
        document.getElementById("model-key").value = s.api_key || "";
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
`;
