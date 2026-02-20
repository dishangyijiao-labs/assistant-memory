export const insightsReportsScriptCommon = `
    var sourceLabels = {
      cursor: "Cursor IDE",
      copilot: "Copilot",
      "cursor-cli": "Cursor CLI",
      "claude-code": "Claude Code",
      codex: "Codex",
      gemini: "Gemini"
    };

    var insightState = {
      candidates: [],
      selected: new Set(),
      sourceFilter: "all",
      tab: "at_a_glance",
      currentReport: null
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

`;
