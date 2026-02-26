export const insightsReportsScriptDetail = `
    function firstSentence(text) {
      var s = safeText(text).trim();
      if (!s) return "";
      var idx = s.search(/[。.!?;；]/);
      return idx > 0 ? s.slice(0, idx + 1) : s;
    }

    function scoreLevel(report) {
      var scores = report && report.scores ? report.scores : {};
      var eff = Number(scores.efficiency || 0);
      var sta = Number(scores.stability || 0);
      var dec = Number(scores.decision_clarity || 0);
      var avg = (eff + sta + dec) / 3;
      if (avg >= 80) return { label: "Positive", cls: "decision-positive", avg: avg };
      if (avg >= 65) return { label: "Neutral", cls: "decision-neutral", avg: avg };
      return { label: "Negative", cls: "decision-negative", avg: avg };
    }

    function confidenceLevel(report) {
      var messages = Number((report && report.message_count) || 0);
      var sessions = Number((report && report.session_count) || 0);
      if (messages >= 120 && sessions >= 8) return { label: "High", cls: "confidence-high" };
      if (messages >= 40 && sessions >= 3) return { label: "Medium", cls: "confidence-medium" };
      return { label: "Low", cls: "confidence-low" };
    }

    function sampleWarning(report) {
      var messages = Number((report && report.message_count) || 0);
      var sessions = Number((report && report.session_count) || 0);
      return messages < 20 || sessions < 3;
    }

    function renderAtGlance(report, details) {
      var ag = details.at_a_glance || {};
      var level = scoreLevel(report);
      var confidence = confidenceLevel(report);
      var lowSample = sampleWarning(report);
      var impressive = details.impressive_things || {};
      var wrong = details.where_things_go_wrong || {};
      var impressiveItems = Array.isArray(impressive.items) ? impressive.items : [];
      var wrongItems = Array.isArray(wrong.items) ? wrong.items : [];
      var positives = [
        firstSentence(ag.working && ag.working.body),
        firstSentence(impressiveItems[0] && impressiveItems[0].body),
      ].filter(Boolean).slice(0, 2);
      var negatives = [
        firstSentence(ag.hindering && ag.hindering.body),
        firstSentence(wrongItems[0] && wrongItems[0].body),
      ].filter(Boolean).slice(0, 2);
      var nextAction = firstSentence(ag.quick_wins && ag.quick_wins.body) || "Narrow one session to one objective and add explicit done criteria.";

      var scores = report && report.scores ? report.scores : {};
      var weakest = [
        { key: "Efficiency", value: Number(scores.efficiency || 0) },
        { key: "Stability", value: Number(scores.stability || 0) },
        { key: "Decision Clarity", value: Number(scores.decision_clarity || 0) },
      ].sort(function(a, b) { return a.value - b.value; })[0];
      var targetLine = weakest
        ? "Target: improve " + weakest.key + " from " + weakest.value + " to " + (weakest.value + 5) + " next cycle."
        : "Target: improve one core score by +5 next cycle.";

      function cardHtml(card, cls) {
        if (!card) return "";
        return '<div class="section-card ' + cls + '">' +
          '<h3>' + escapeHtml(card.title || "") + '</h3>' +
          '<p>' + escapeHtml(card.body || "") + '</p>' +
          '<p style="margin-top:0.45rem;"><a href="javascript:void(0)">' + escapeHtml(card.cta || "") + "  ›</a></p>" +
        '</div>';
      }
      var summaryHtml =
        '<div class="decision-strip">' +
          '<div class="decision-main">' +
            '<div class="decision-label">Overall</div>' +
            '<div class="decision-value ' + level.cls + '">' + escapeHtml(level.label) + '</div>' +
          '</div>' +
          '<div class="decision-metric">' +
            '<div class="decision-label">Average Score</div>' +
            '<div class="decision-value">' + escapeHtml(level.avg.toFixed(1)) + '</div>' +
          '</div>' +
          '<div class="decision-metric">' +
            '<div class="decision-label">Confidence</div>' +
            '<div class="decision-value ' + confidence.cls + '">' + escapeHtml(confidence.label) + '</div>' +
          '</div>' +
        '</div>';

      var lowSampleHtml = lowSample
        ? '<div class="sample-warning">Low sample size: this report is directional only. Increase sessions/messages before making strategic decisions.</div>'
        : "";

      var positiveHtml = positives.length
        ? positives.map(function(x) { return "<li>" + escapeHtml(x) + "</li>"; }).join("")
        : "<li>No strong positive signal yet.</li>";
      var negativeHtml = negatives.length
        ? negatives.map(function(x) { return "<li>" + escapeHtml(x) + "</li>"; }).join("")
        : "<li>No critical risk detected.</li>";

      var reportId = Number((report && report.id) || 0);
      return summaryHtml +
        lowSampleHtml +
        '<div class="feedback-grid">' +
          '<div class="section-card callout-green"><h3>Positive Feedback</h3><ul class="mini-list">' + positiveHtml + "</ul></div>" +
          '<div class="section-card callout-amber"><h3>Negative Feedback</h3><ul class="mini-list">' + negativeHtml + "</ul></div>" +
        "</div>" +
        '<div class="section-card callout-blue"><h3>Next Action (P1)</h3><p>' + escapeHtml(nextAction) + '</p><p><strong>' + escapeHtml(targetLine) + '</strong></p>' +
          '<div class="action-row"><button type="button" class="btn-ghost" id="btn-add-tomorrow" data-action="' + escapeHtml(nextAction) + '" data-report-id="' + escapeHtml(String(reportId)) + '">Add to tomorrow plan</button></div>' +
        "</div>" +
        '<details class="detail-more"><summary>Full narrative cards</summary>' +
          cardHtml(ag.working, "callout-green") +
          cardHtml(ag.hindering, "callout-amber") +
          cardHtml(ag.quick_wins, "callout-blue") +
          cardHtml(ag.ambitious, "callout-dark") +
        "</details>";
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

    function renderPromptCoach(details) {
      var pc = details.prompt_coach;
      if (!pc) {
        return '<div class="empty">Run a report with an AI model to unlock Prompt Coach insights.</div>';
      }

      var kpis = pc.kpis || {};
      function isFiniteNumber(v) {
        return typeof v === "number" && Number.isFinite(v);
      }
      function scoreLabel(v) {
        return isFiniteNumber(v) ? String(v) : "N/A";
      }
      function ratioLabel(v) {
        return isFiniteNumber(v) ? (v * 100).toFixed(0) + "%" : "N/A";
      }
      function scoreClass(v, good, neutral) {
        if (!isFiniteNumber(v)) return "neutral";
        if (v >= good) return "good";
        if (v >= neutral) return "neutral";
        return "bad";
      }
      function kpiCard(label, value, cls) {
        return '<div class="coach-kpi-card ' + (cls || "neutral") + '">' +
          '<div class="coach-kpi-value">' + escapeHtml(value != null ? String(value) : "N/A") + '</div>' +
          '<div class="coach-kpi-label">' + escapeHtml(label) + '</div>' +
        '</div>';
      }
      var qualitySampled = isFiniteNumber(kpis.first_pass_resolution_rate) &&
        isFiniteNumber(kpis.high_quality_ratio) &&
        isFiniteNumber(kpis.repeated_question_ratio);
      var kpiHtml = '<div class="coach-kpi-grid">' +
        kpiCard("Depth Score", scoreLabel(kpis.depth_score), scoreClass(kpis.depth_score, 70, 40)) +
        kpiCard("Token Efficiency", scoreLabel(kpis.token_efficiency_score), scoreClass(kpis.token_efficiency_score, 70, 40)) +
        kpiCard("First-Pass Resolution", ratioLabel(kpis.first_pass_resolution_rate), scoreClass(kpis.first_pass_resolution_rate, 0.7, 0.4)) +
        kpiCard("High-Quality Ratio", ratioLabel(kpis.high_quality_ratio), scoreClass(kpis.high_quality_ratio, 0.7, 0.4)) +
        kpiCard("Repeated Question Ratio", ratioLabel(kpis.repeated_question_ratio), scoreClass((isFiniteNumber(kpis.repeated_question_ratio) ? 1 - kpis.repeated_question_ratio : null), 0.7, 0.4)) +
      '</div>' +
      (!qualitySampled
        ? '<div class="coach-unsampled">未采样 (Not sampled): quality KPI metrics are unavailable because this scope has no quality scoring data yet.</div>'
        : "");

      var issues = Array.isArray(pc.top_issues) ? pc.top_issues.slice(0, 3) : [];
      function impactBadge(impact) {
        var cls = impact === "high" ? "impact-high" : impact === "medium" ? "impact-medium" : "impact-low";
        return '<span class="impact-badge ' + cls + '">' + escapeHtml(impact || "low") + '</span>';
      }
      var issuesHtml = issues.length ? issues.map(function(issue) {
        var evidence = Array.isArray(issue.evidence) ? issue.evidence : [];
        var evidenceHtml = evidence.map(function(item) {
          var sid = Number(item && item.session_id);
          var mid = Number(item && item.message_id);
          if (!(sid > 0 && mid > 0)) return "";
          var href = "/session?session_id=" + encodeURIComponent(String(sid)) + "&message_id=" + encodeURIComponent(String(mid));
          return '<div class="bullet-note">Evidence: <a class="evidence-link" href="' + href + '">Session ' + escapeHtml(String(sid)) + ", message " + escapeHtml(String(mid)) + "</a></div>";
        }).join("");
        return '<div class="section-card">' +
          '<div style="display:flex;align-items:center;gap:0.55rem;margin-bottom:0.45rem;">' +
            '<h3 style="margin:0;">' + escapeHtml(issue.issue || "") + '</h3>' +
            '<span class="chip">' + formatNumber(issue.frequency || 0) + 'x</span>' +
            impactBadge(issue.impact) +
          '</div>' +
          '<p>' + escapeHtml(issue.why_it_hurts || "") + '</p>' +
          evidenceHtml +
        '</div>';
      }).join("") : '<div class="empty">No top issues recorded.</div>';

      var playbooks = Array.isArray(pc.playbooks) ? pc.playbooks : [];
      var playbooksHtml = playbooks.map(function(pb, pbIdx) {
        var checklist = Array.isArray(pb.checklist) ? pb.checklist : [];
        var variants = ['short', 'deep', 'token_lean'];
        var variantLabels = { short: 'Short', deep: 'Deep', token_lean: 'Token-Lean' };
        var uid = 'pb-' + pbIdx;
        var btnHtml = variants.map(function(variant, vi) {
          var activeClass = vi === 0 ? " active" : "";
          var contentId = uid + '-' + variant;
          return '<button type="button" class="rewrite-tab-btn' + activeClass + '" onclick="(function(btn){var p=btn.closest(\'.rewrite-tabs\');p.querySelectorAll(\'.rewrite-tab-btn\').forEach(function(b){b.classList.remove(\'active\')});p.querySelectorAll(\'.rewrite-tab-content\').forEach(function(c){c.style.display=\'none\'});btn.classList.add(\'active\');document.getElementById(\'' + contentId + '\').style.display=\'block\'})(this)">' + variantLabels[variant] + '</button>';
        }).join("");
        var contentHtml = variants.map(function(variant, vi) {
          var contentId = uid + '-' + variant;
          return '<div class="rewrite-tab-content" id="' + contentId + '" style="' + (vi === 0 ? '' : 'display:none') + '">' +
            codeBlock(pb['rewrite_' + variant] || "") +
          '</div>';
        }).join("");
        var checklistHtml = checklist.length
          ? '<ul class="mini-list">' + checklist.map(function(c) { return '<li>' + escapeHtml(c) + '</li>'; }).join("") + '</ul>'
          : '';
        return '<div class="playbook-card">' +
          '<h3>' + escapeHtml(pb.name || "") + '</h3>' +
          '<p><strong>When to use:</strong> ' + escapeHtml(pb.when_to_use || "") + '</p>' +
          '<div class="rewrite-tabs">' + btnHtml + contentHtml + '</div>' +
          checklistHtml +
          (pb.token_budget_hint ? '<p style="margin-top:0.5rem;color:var(--muted);font-size:0.88rem;">' + escapeHtml(pb.token_budget_hint) + '</p>' : '') +
          (pb.expected_gain ? '<p style="margin-top:0.3rem;"><strong>Expected gain:</strong> ' + escapeHtml(pb.expected_gain) + '</p>' : '') +
        '</div>';
      }).join("");

      var nextPlan = Array.isArray(pc.next_week_plan) ? pc.next_week_plan : [];
      var nextPlanHtml = nextPlan.length
        ? '<ol class="next-plan-list">' + nextPlan.map(function(item) { return '<li>' + escapeHtml(item) + '</li>'; }).join("") + '</ol>'
        : '';

      return '<div class="section-card"><h3>Prompt Quality KPIs</h3>' + kpiHtml + '</div>' +
        '<div class="section-card"><h3>Top Issues</h3>' + issuesHtml + '</div>' +
        (playbooksHtml ? '<div class="section-card"><h3>Playbooks</h3>' + playbooksHtml + '</div>' : '') +
        (nextPlanHtml ? '<div class="section-card"><h3>Next-Week Plan</h3>' + nextPlanHtml + '</div>' : '');
    }

    function renderDetailTab(tab, details) {
      if (tab === "at_a_glance") return renderAtGlance(insightState.currentReport || {}, details);
      if (tab === "what_you_work_on") return renderWhatYouWorkOn(details);
      if (tab === "how_you_use_ai") return renderHowYouUseAI(details);
      if (tab === "impressive_things") return renderImpressive(details);
      if (tab === "where_things_go_wrong") return renderWhereWrong(details);
      if (tab === "prompt_coach") return renderPromptCoach(details);
      if (tab === "features_to_try") return renderFeatures(details);
      return renderHorizon(details);
    }

    function renderDetailPage(reportId) {
      status("Loading report...", "warn");
      api("/api/insights/" + reportId)
        .then(function(data) {
          var report = data.report || {};
          insightState.currentReport = report;
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
            { key: "prompt_coach", label: "Prompt Coach" },
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
