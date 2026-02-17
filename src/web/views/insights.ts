import { insightsStyles } from "./insights-styles.js";
import { insightsScript } from "./insights-script.js";

export default function getInsightsPage(): string {
  const bodyHtml = `
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div><a href="/">← Back to sessions</a></div>
        <h1 class="title">Insights</h1>
        <p class="sub">Manual reports with scores, evidence links, and actionable feedback</p>
      </div>
    </div>

    <div class="layout">
      <div class="panel">
        <p class="section-title">Scope</p>
        <div class="controls">
          <div>
            <label for="scope-workspace">Workspace</label>
            <select id="scope-workspace"></select>
          </div>
          <div>
            <label for="scope-range">Time Range</label>
            <select id="scope-range">
              <option value="7d">Last 7 days</option>
              <option value="30d" selected>Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
        <div>
          <label>Sources</label>
          <div class="source-list" id="source-list"></div>
        </div>

        <p class="section-title" style="margin-top:0.9rem;">Model</p>
        <div class="controls">
          <div>
            <label for="model-mode">Mode</label>
            <select id="model-mode">
              <option value="local">Local (rule-based)</option>
              <option value="external">External API</option>
              <option value="agent">Agent (tool calling)</option>
            </select>
          </div>
          <div style="display:flex;align-items:flex-end;">
            <label class="checkbox-row"><input id="model-enabled" type="checkbox" /> Enable External API</label>
          </div>
        </div>
        <div class="external-fields" id="external-fields">
          <div class="controls">
            <div>
              <label for="model-provider">Provider</label>
              <input id="model-provider" type="text" placeholder="openai-compatible" />
            </div>
            <div>
              <label for="model-base">Base URL</label>
              <input id="model-base" type="text" placeholder="https://api.openai.com/v1" />
            </div>
            <div>
              <label for="model-name">Model Name</label>
              <input id="model-name" type="text" placeholder="gpt-4o-mini" />
            </div>
            <div>
              <label for="model-key">API Key (saved locally)</label>
              <input id="model-key" type="password" placeholder="Saved in local app database" />
            </div>
          </div>
        </div>

        <div class="btn-row">
          <button class="secondary" id="btn-save">Save Settings</button>
          <button class="secondary" id="btn-test">Test Connection</button>
          <button id="btn-generate">Generate Insights</button>
          <button class="secondary" id="btn-copy-md" disabled>Copy Markdown</button>
          <button class="secondary" id="btn-export-md" disabled>Export .md</button>
        </div>
        <div class="progress-steps hidden" id="progress-steps">
          <span class="progress-step" id="step-collect">1. Collecting conversations</span>
          <span class="progress-step" id="step-analyze">2. Analyzing patterns</span>
          <span class="progress-step" id="step-draft">3. Drafting report</span>
        </div>
        <p id="status" class="status"></p>

        <div class="block">
          <h3>Summary</h3>
          <p id="summary">No report yet.</p>
        </div>
        <div class="result-grid">
          <div class="score-card">
            <div class="score-name">Efficiency</div>
            <div class="score-value" id="score-eff">-</div>
            <div class="score-reason" id="reason-eff"></div>
          </div>
          <div class="score-card">
            <div class="score-name">Stability</div>
            <div class="score-value" id="score-sta">-</div>
            <div class="score-reason" id="reason-sta"></div>
          </div>
          <div class="score-card">
            <div class="score-name">Decision Clarity</div>
            <div class="score-value" id="score-dec">-</div>
            <div class="score-reason" id="reason-dec"></div>
          </div>
        </div>
        <div class="block">
          <h3>Patterns</h3>
          <ul id="patterns"><li>No report yet.</li></ul>
        </div>
        <div class="block">
          <h3>Feedback</h3>
          <ul id="feedback"><li>No report yet.</li></ul>
        </div>
        <div class="block">
          <h3>Evidence</h3>
          <ul id="evidence"><li>No report yet.</li></ul>
        </div>
      </div>

      <div class="panel">
        <p class="section-title">History</p>
        <ul id="history" class="history-list">
          <li class="history-item"><div class="history-meta">Loading…</div></li>
        </ul>
      </div>
    </div>
  </div>
  <div class="toast" id="toast"></div>
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AssistMem – Insights</title>
${insightsStyles}
${bodyHtml}
${insightsScript}
</body>
</html>`;
}
