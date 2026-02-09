export const insightsReportsScriptDetail = `
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
`;
