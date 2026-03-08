import { escapeHtml, formatNumber } from "../../format";
import { codeBlockHtml, safeText, firstSentence, scoreLevel, confidenceLevel, sampleWarning } from "./helpers";
import type { Report } from "./types";

function renderAtGlance(report: Report, details: Record<string, any>): string {
  const ag = details.at_a_glance || {};
  const level = scoreLevel(report);
  const confidence = confidenceLevel(report);
  const lowSample = sampleWarning(report);
  const impressive = details.impressive_things || {};
  const wrong = details.where_things_go_wrong || {};
  const impressiveItems = Array.isArray(impressive.items) ? impressive.items : [];
  const wrongItems = Array.isArray(wrong.items) ? wrong.items : [];
  const positives = [
    firstSentence(ag.working?.body),
    firstSentence(impressiveItems[0]?.body),
  ].filter(Boolean).slice(0, 2);
  const negatives = [
    firstSentence(ag.hindering?.body),
    firstSentence(wrongItems[0]?.body),
  ].filter(Boolean).slice(0, 2);
  const nextAction = firstSentence(ag.quick_wins?.body) || "Narrow one session to one objective and add explicit done criteria.";

  const scores = report?.scores || {};
  const weakest = [
    { key: "Efficiency", value: Number(scores.efficiency || 0) },
    { key: "Stability", value: Number(scores.stability || 0) },
    { key: "Decision Clarity", value: Number(scores.decision_clarity || 0) },
  ].sort((a, b) => a.value - b.value)[0];
  const targetLine = weakest
    ? "Target: improve " + weakest.key + " from " + weakest.value + " to " + (weakest.value + 5) + " next cycle."
    : "Target: improve one core score by +5 next cycle.";

  function cardHtml(card: any, cls: string): string {
    if (!card) return "";
    return '<div class="section-card ' + cls + '">' +
      '<h3>' + escapeHtml(card.title || "") + '</h3>' +
      '<p>' + escapeHtml(card.body || "") + '</p>' +
      '<p style="margin-top:0.45rem;"><a href="javascript:void(0)">' + escapeHtml(card.cta || "") + "  \u203A</a></p>" +
      '</div>';
  }

  const summaryHtml =
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

  const lowSampleHtml = lowSample
    ? '<div class="sample-warning">Low sample size: this report is directional only. Increase sessions/messages before making strategic decisions.</div>'
    : "";

  const positiveHtml = positives.length
    ? positives.map((x) => "<li>" + escapeHtml(x) + "</li>").join("")
    : "<li>No strong positive signal yet.</li>";
  const negativeHtml = negatives.length
    ? negatives.map((x) => "<li>" + escapeHtml(x) + "</li>").join("")
    : "<li>No critical risk detected.</li>";

  const reportId = Number(report?.id || 0);
  return summaryHtml +
    lowSampleHtml +
    '<div class="feedback-grid">' +
      '<div class="section-card callout-green"><h3>Positive Feedback</h3><ul class="mini-list">' + positiveHtml + "</ul></div>" +
      '<div class="section-card callout-amber"><h3>Negative Feedback</h3><ul class="mini-list">' + negativeHtml + "</ul></div>" +
    "</div>" +
    '<div class="section-card callout-blue"><h3>Next Action (P1)</h3><p>' + escapeHtml(nextAction) + '</p><p><strong>' + escapeHtml(targetLine) + '</strong></p>' +
      '<div class="action-row"><button type="button" class="btn-ghost" data-add-tomorrow="1" data-action="' + escapeHtml(nextAction) + '" data-report-id="' + escapeHtml(String(reportId)) + '">Add to tomorrow plan</button></div>' +
    "</div>" +
    '<details class="detail-more"><summary>Full narrative cards</summary>' +
      cardHtml(ag.working, "callout-green") +
      cardHtml(ag.hindering, "callout-amber") +
      cardHtml(ag.quick_wins, "callout-blue") +
      cardHtml(ag.ambitious, "callout-dark") +
    "</details>";
}

function renderWhatYouWorkOn(details: Record<string, any>): string {
  const data = details.what_you_work_on || {};
  const topics = Array.isArray(data.topics) ? data.topics : [];
  const caps = Array.isArray(data.top_capabilities) ? data.top_capabilities : [];
  const langs = Array.isArray(data.languages) ? data.languages : [];
  const sessionTypes = Array.isArray(data.session_types) ? data.session_types : [];
  const left = topics.map((item: any) =>
    '<div class="section-card">' +
      '<div style="display:flex;justify-content:space-between;gap:0.65rem;align-items:flex-start;">' +
        '<h3>' + escapeHtml(item.title || "") + '</h3>' +
        '<div style="color:var(--muted);font-size:0.88rem;">~' + formatNumber(item.sessions || 0) + " sessions</div>" +
      '</div>' +
      '<p>' + escapeHtml(item.summary || "") + '</p>' +
    '</div>'
  ).join("");

  function statList(title: string, list: any[]): string {
    return '<div class="stats-box"><div class="stats-title">' + escapeHtml(title) + '</div>' +
      list.map((x: any) => '<div class="stats-line"><span>' + escapeHtml(x.name || "") + '</span><strong>' + formatNumber(x.count || 0) + "</strong></div>").join("") +
    '</div>';
  }
  return '<div class="two-col">' +
    '<div>' + left + '</div>' +
    '<div>' + statList("Top Capabilities", caps) + statList("Languages", langs) + statList("Session Types", sessionTypes) + '</div>' +
  '</div>';
}

function renderHowYouUseAI(details: Record<string, any>): string {
  const data = details.how_you_use_ai || {};
  const dist = Array.isArray(data.response_time_distribution) ? data.response_time_distribution : [];
  const tod = Array.isArray(data.messages_by_time_of_day) ? data.messages_by_time_of_day : [];
  const maxDist = dist.reduce((m: number, x: any) => Math.max(m, x.count || 0), 1);
  const maxTod = tod.reduce((m: number, x: any) => Math.max(m, x.count || 0), 1);
  const distHtml = dist.map((item: any) => {
    const pct = Math.max(8, Math.round(((item.count || 0) / maxDist) * 100));
    return '<div class="bar-row"><span>' + escapeHtml(item.name || "") + '</span><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><strong>' + formatNumber(item.count || 0) + '</strong></div>';
  }).join("");
  const todHtml = tod.map((item: any) => {
    const pct = Math.max(8, Math.round(((item.count || 0) / maxTod) * 100));
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

function renderImpressive(details: Record<string, any>): string {
  const data = details.impressive_things || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const capabilities = Array.isArray(data.helped_capabilities) ? data.helped_capabilities : [];
  const outcomes = data.outcomes || {};
  const cards = items.map((item: any) =>
    '<div class="section-card"><h3>\u2B50 ' + escapeHtml(item.title || "") + '</h3><p>' + escapeHtml(item.body || "") + '</p></div>'
  ).join("");
  const chips = capabilities.map((item: any) =>
    '<span class="chip">' + escapeHtml(item.name || "") + " " + formatNumber(item.count || 0) + "</span>"
  ).join("");
  return '<div class="section-card"><p>' + escapeHtml(data.intro || "") + '</p></div>' +
    cards +
    '<div class="section-card"><h3>What Helped Most (AI Capabilities)</h3>' +
    '<div class="chips">' + chips + '</div>' +
    '<div style="margin-top:0.85rem;border-top:1px solid var(--border);padding-top:0.7rem;">' +
      '<span class="chip chip-success">Fully Achieved: ' + formatNumber(outcomes.fully_achieved || 0) + '</span> ' +
      '<span class="chip chip-warning">Partially Achieved: ' + formatNumber(outcomes.partially_achieved || 0) + '</span>' +
    '</div></div>';
}

function renderWhereWrong(details: Record<string, any>): string {
  const data = details.where_things_go_wrong || {};
  const items = Array.isArray(data.items) ? data.items : [];
  const frictions = Array.isArray(data.friction_types) ? data.friction_types : [];
  const cards = items.map((item: any) => {
    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    return '<div class="section-card callout-amber">' +
      '<h3>\u26A0 ' + escapeHtml(item.title || "") + '</h3>' +
      '<p>' + escapeHtml(item.body || "") + '</p>' +
      evidence.map((e: string) => '<div class="bullet-note">' + escapeHtml(e) + "</div>").join("") +
    '</div>';
  }).join("");
  const chips = frictions.map((item: any) =>
    '<span class="chip">' + escapeHtml(item.name || "") + " " + formatNumber(item.count || 0) + "</span>"
  ).join("");
  return '<div class="section-card"><p>' + escapeHtml(data.intro || "") + '</p></div>' + cards +
    '<div class="section-card"><h3>Primary Friction Types</h3><div class="chips">' + chips + '</div></div>';
}

function renderPromptCoach(details: Record<string, any>): string {
  const pc = details.prompt_coach;
  if (!pc) {
    return '<div class="empty">Run a report with an AI model to unlock Prompt Coach insights.</div>';
  }

  const kpis = pc.kpis || {};
  function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
  }
  function scoreLabel(v: unknown): string {
    return isFiniteNumber(v) ? String(v) : "N/A";
  }
  function ratioLabel(v: unknown): string {
    return isFiniteNumber(v) ? (v * 100).toFixed(0) + "%" : "N/A";
  }
  function scoreClass(v: unknown, good: number, neutral: number): string {
    if (!isFiniteNumber(v)) return "neutral";
    if (v >= good) return "good";
    if (v >= neutral) return "neutral";
    return "bad";
  }
  function kpiCard(label: string, value: string, cls: string): string {
    return '<div class="coach-kpi-card ' + (cls || "neutral") + '">' +
      '<div class="coach-kpi-value">' + escapeHtml(value != null ? String(value) : "N/A") + '</div>' +
      '<div class="coach-kpi-label">' + escapeHtml(label) + '</div>' +
    '</div>';
  }
  const qualitySampled = isFiniteNumber(kpis.first_pass_resolution_rate) &&
    isFiniteNumber(kpis.high_quality_ratio) &&
    isFiniteNumber(kpis.repeated_question_ratio);
  const kpiHtml = '<div class="coach-kpi-grid">' +
    kpiCard("Depth Score", scoreLabel(kpis.depth_score), scoreClass(kpis.depth_score, 70, 40)) +
    kpiCard("Token Efficiency", scoreLabel(kpis.token_efficiency_score), scoreClass(kpis.token_efficiency_score, 70, 40)) +
    kpiCard("First-Pass Resolution", ratioLabel(kpis.first_pass_resolution_rate), scoreClass(kpis.first_pass_resolution_rate, 0.7, 0.4)) +
    kpiCard("High-Quality Ratio", ratioLabel(kpis.high_quality_ratio), scoreClass(kpis.high_quality_ratio, 0.7, 0.4)) +
    kpiCard("Repeated Question Ratio", ratioLabel(kpis.repeated_question_ratio), scoreClass(isFiniteNumber(kpis.repeated_question_ratio) ? 1 - kpis.repeated_question_ratio : null, 0.7, 0.4)) +
  '</div>' +
  (!qualitySampled
    ? '<div class="coach-unsampled">\u672A\u91C7\u6837 (Not sampled): quality KPI metrics are unavailable because this scope has no quality scoring data yet.</div>'
    : "");

  const issues = Array.isArray(pc.top_issues) ? pc.top_issues.slice(0, 3) : [];
  function impactBadge(impact: string): string {
    const cls = impact === "high" ? "impact-high" : impact === "medium" ? "impact-medium" : "impact-low";
    return '<span class="impact-badge ' + cls + '">' + escapeHtml(impact || "low") + '</span>';
  }
  const issuesHtml = issues.length ? issues.map((issue: any) => {
    const evidence = Array.isArray(issue.evidence) ? issue.evidence : [];
    const evidenceHtml = evidence.map((item: any) => {
      const sid = Number(item?.session_id);
      const mid = Number(item?.message_id);
      if (!(sid > 0 && mid > 0)) return "";
      const href = "/session?session_id=" + encodeURIComponent(String(sid)) + "&message_id=" + encodeURIComponent(String(mid));
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

  const playbooks = Array.isArray(pc.playbooks) ? pc.playbooks : [];
  const playbooksHtml = playbooks.map((pb: any, pbIdx: number) => {
    const checklist = Array.isArray(pb.checklist) ? pb.checklist : [];
    const variants = ["short", "deep", "token_lean"] as const;
    const variantLabels: Record<string, string> = { short: "Short", deep: "Deep", token_lean: "Token-Lean" };
    const uid = "pb-" + pbIdx;
    const btnHtml = variants.map((variant, vi) => {
      const activeClass = vi === 0 ? " active" : "";
      const contentId = uid + "-" + variant;
      return '<button type="button" class="rewrite-tab-btn' + activeClass + '" onclick="(function(btn){var p=btn.closest(\'.rewrite-tabs\');p.querySelectorAll(\'.rewrite-tab-btn\').forEach(function(b){b.classList.remove(\'active\')});p.querySelectorAll(\'.rewrite-tab-content\').forEach(function(c){c.style.display=\'none\'});btn.classList.add(\'active\');document.getElementById(\'' + contentId + '\').style.display=\'block\'})(this)">' + variantLabels[variant] + '</button>';
    }).join("");
    const contentHtml = variants.map((variant, vi) => {
      const contentId = uid + "-" + variant;
      return '<div class="rewrite-tab-content" id="' + contentId + '" style="' + (vi === 0 ? "" : "display:none") + '">' +
        codeBlockHtml(pb["rewrite_" + variant] || "") +
      '</div>';
    }).join("");
    const checklistHtml = checklist.length
      ? '<ul class="mini-list">' + checklist.map((c: string) => '<li>' + escapeHtml(c) + '</li>').join("") + '</ul>'
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

  const nextPlan = Array.isArray(pc.next_week_plan) ? pc.next_week_plan : [];
  const nextPlanHtml = nextPlan.length
    ? '<ol class="next-plan-list">' + nextPlan.map((item: string) => '<li>' + escapeHtml(item) + '</li>').join("") + '</ol>'
    : '';

  return '<div class="section-card"><h3>Prompt Quality KPIs</h3>' + kpiHtml + '</div>' +
    '<div class="section-card"><h3>Top Issues</h3>' + issuesHtml + '</div>' +
    (playbooksHtml ? '<div class="section-card"><h3>Playbooks</h3>' + playbooksHtml + '</div>' : '') +
    (nextPlanHtml ? '<div class="section-card"><h3>Next-Week Plan</h3>' + nextPlanHtml + '</div>' : '');
}

function renderFeatures(details: Record<string, any>): string {
  const data = details.features_to_try || {};
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const additions = Array.isArray(data.claude_md_additions) ? data.claude_md_additions : [];
  const actionCards = cards.map((item: any) =>
    '<div class="section-card">' +
      '<h3>' + escapeHtml(item.title || "") + '</h3>' +
      '<p>' + escapeHtml(item.body || "") + '</p>' +
      codeBlockHtml(item.command || "") +
    '</div>'
  ).join("");
  const additionsHtml = additions.map((line: string) => codeBlockHtml(line)).join("");
  return actionCards +
    '<div class="section-card"><h3>Suggested CLAUDE.md Additions</h3><p>Copy these into your project to improve assistant context.</p>' +
    additionsHtml +
    '</div>';
}

function renderHorizon(details: Record<string, any>): string {
  const data = details.on_the_horizon || {};
  const cards = Array.isArray(data.cards) ? data.cards : [];
  return '<div class="section-card"><p>' + escapeHtml(data.intro || "") + '</p></div>' +
    cards.map((item: any) =>
      '<div class="section-card">' +
        '<h3>\uD83D\uDE80 ' + escapeHtml(item.title || "") + '</h3>' +
        '<p>' + escapeHtml(item.body || "") + '</p>' +
        '<p style="margin-top:0.55rem;color:var(--muted);">Paste into your assistant:</p>' +
        codeBlockHtml(item.prompt || "") +
      '</div>'
    ).join("");
}

function renderReflections(details: Record<string, any>): string {
  const reflections = Array.isArray(details.reflections) ? details.reflections : [];
  if (reflections.length === 0) {
    return '<div class="empty">No reflection prompts available yet. Run a report with Prompt Coach enabled to generate personalized reflections.</div>';
  }
  const cards = reflections.map((r: any, i: number) =>
    '<div class="section-card">' +
      '<div style="display:flex;align-items:flex-start;gap:0.65rem;">' +
        '<div style="min-width:1.75rem;height:1.75rem;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;">' + (i + 1) + '</div>' +
        '<div style="flex:1;">' +
          '<p style="margin:0 0 0.55rem;font-weight:600;">' + escapeHtml(r.question || "") + '</p>' +
          (r.hint ? '<p style="margin:0;color:var(--muted);font-size:0.9rem;">\uD83D\uDCA1 ' + escapeHtml(r.hint) + '</p>' : '') +
        '</div>' +
      '</div>' +
    '</div>'
  ).join("");
  return '<div class="section-card"><h3>Reflection Prompts</h3>' +
    '<p style="color:var(--muted);">Use these prompts to deepen your thinking about how you collaborate with AI. Spend 2\u20133 minutes on each.</p>' +
    '</div>' + cards;
}

export function renderDetailTab(tab: string, report: Report, details: Record<string, any>): string {
  if (tab === "at_a_glance") return renderAtGlance(report, details);
  if (tab === "what_you_work_on") return renderWhatYouWorkOn(details);
  if (tab === "how_you_use_ai") return renderHowYouUseAI(details);
  if (tab === "impressive_things") return renderImpressive(details);
  if (tab === "where_things_go_wrong") return renderWhereWrong(details);
  if (tab === "prompt_coach") return renderPromptCoach(details);
  if (tab === "features_to_try") return renderFeatures(details);
  if (tab === "reflect") return renderReflections(details);
  return renderHorizon(details);
}
