import { settingsStyles } from "./settings-styles.js";
import { settingsScript } from "./settings-script.js";

export default function getSettingsPage(): string {
  const bodyHtml = `
</head>
<body>
  <div class="layout">
    <main class="main">
      <a class="back-link" href="/">← Back</a>
      <h1 class="page-title">Data & Sync</h1>
      <p class="page-sub">Configure data sources, sync status, and model connectivity.</p>
      <div class="status" id="status"></div>

      <section class="section active" id="section-data-sources">
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-value" id="summary-active">0</div>
            <div class="summary-label">Active Sources</div>
          </div>
          <div class="summary-card">
            <div class="summary-value" id="summary-sessions">0</div>
            <div class="summary-label">Total Sessions</div>
          </div>
          <div class="summary-card">
            <div class="summary-value" id="summary-messages">0</div>
            <div class="summary-label">Total Messages</div>
          </div>
        </div>
        <div class="source-list" id="source-list"></div>
        <div class="footer-note">
          Supported sources: Cursor IDE, GitHub Copilot, Cursor CLI, Claude Code, Codex, Gemini.
          Each source can be toggled independently and synced on demand.
        </div>
      </section>

      <section class="section active" id="section-index-sync">
        <div class="section-card">
          <h3>Manual Sync</h3>
          <div class="muted">Run indexing for all enabled sources now.</div>
          <div class="row">
            <button class="btn primary" id="btn-sync-enabled" type="button">Sync Enabled Sources</button>
          </div>
          <div class="muted" id="index-sync-meta"></div>
        </div>
        <div class="section-card">
          <h3>Database Status</h3>
          <div class="muted" id="storage-db-path">DB path: -</div>
          <div class="muted" id="storage-db-stats">Sessions: 0 · Messages: 0</div>
        </div>
        <div class="section-card">
          <h3>Privacy & External API</h3>
          <div class="muted" id="privacy-model-status">External API: unknown</div>
          <div class="row">
            <a href="/insights">Open Insights Model Settings</a>
          </div>
        </div>
      </section>

    </main>
  </div>

`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AssistMem – Data & Sync</title>
${settingsStyles}
${bodyHtml}
${settingsScript}
</body>
</html>`;
}
