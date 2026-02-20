export const settingsScript = `
  <script>
    var modeLabel = {
      local_files: "Local Files",
      file_import: "File Import",
      api: "API"
    };

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

    function renderSummary(payload) {
      var summary = payload && payload.summary ? payload.summary : {};
      document.getElementById("active-count").textContent = formatNumber(summary.active_sources || 0) + " enabled";
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
            '<span>Last active: ' + escapeHtml(timeAgo(s.last_activity_at)) + '</span>' +
          '</div>' +
          '<div class="source-actions">' +
            '<button type="button" class="btn configure-source">Edit</button>' +
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

    function loadSourceSettings() {
      setStatus("Loading source settings...", "warn");
      return api("/api/settings/sources")
        .then(function (payload) {
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
          document.getElementById("insights-api-status").textContent =
            "External API: " + (enabled ? "Enabled" : "Disabled");
        })
        .catch(function () {
          document.getElementById("insights-api-status").textContent = "External API: unavailable";
        });
    }

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

    Promise.all([loadSourceSettings(), loadModelStatus()]).catch(function () {});
  </script>
`;
