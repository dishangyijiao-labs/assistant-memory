import { settingsStyles } from "./settings-styles.js";
import { settingsScript } from "./settings-script.js";

export default function getSettingsPage(): string {
  const bodyHtml = `
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-head">
        <a class="back-link" href="/">← Back</a>
        <div class="sidebar-title">Settings</div>
      </div>
      <div class="menu" id="settings-nav">
        <button type="button" data-section="data-sources" class="active">Data Sources</button>
        <button type="button" data-section="index-sync">Index & Sync</button>
        <button type="button" data-section="storage">Storage</button>
        <button type="button" data-section="display">Display</button>
        <button type="button" data-section="privacy-security">Privacy & Security</button>
        <button type="button" data-section="export-backup">Export & Backup</button>
      </div>
    </aside>

    <main class="main">
      <h1 class="page-title" id="section-title">Data Sources</h1>
      <p class="page-sub" id="section-sub">Configure where Assistant Memory reads your AI conversation data.</p>
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
        <div class="row">
          <button class="btn" id="btn-add-source" type="button">+ Add New Source</button>
          <button class="btn" id="btn-refresh-sources" type="button">Refresh</button>
        </div>
        <div class="footer-note">
          Supported sources: Cursor IDE, GitHub Copilot, Cursor CLI, Claude Code, Codex, Gemini.
          Each source can be toggled independently and synced on demand.
        </div>
      </section>

      <section class="section" id="section-index-sync">
        <div class="section-card">
          <h3>Manual Sync</h3>
          <div class="muted">Run indexing for all enabled sources now.</div>
          <div class="row">
            <button class="btn primary" id="btn-sync-enabled" type="button">Sync Enabled Sources</button>
          </div>
          <div class="muted" id="index-sync-meta"></div>
        </div>
        <div class="section-card">
          <h3>Single Source Sync</h3>
          <div class="muted">Use Data Sources tab to sync one source at a time and inspect its status.</div>
        </div>
      </section>

      <section class="section" id="section-storage">
        <div class="section-card">
          <h3>Database</h3>
          <div class="muted" id="storage-db-path">DB path: -</div>
          <div class="muted" id="storage-db-stats">Sessions: 0 · Messages: 0</div>
          <div class="row">
            <button class="btn" id="btn-storage-refresh" type="button">Refresh Stats</button>
          </div>
        </div>
      </section>

      <section class="section" id="section-display">
        <div class="section-card">
          <h3>Display Preferences</h3>
          <div class="muted">Use compact list density for sessions.</div>
          <div class="row">
            <label><input type="checkbox" id="display-compact" /> Compact mode</label>
          </div>
        </div>
      </section>

      <section class="section" id="section-privacy-security">
        <div class="section-card">
          <h3>Privacy & External API</h3>
          <div class="muted" id="privacy-model-status">External API: unknown</div>
          <div class="row">
            <a href="/insights">Open Insights Model Settings</a>
          </div>
        </div>
      </section>

      <section class="section" id="section-export-backup">
        <div class="section-card">
          <h3>Export</h3>
          <div class="muted">Download current source settings as JSON.</div>
          <div class="row">
            <button class="btn" id="btn-export-settings" type="button">Export Source Settings</button>
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
  <title>Assistant Memory – Settings</title>
${settingsStyles}
${bodyHtml}
${settingsScript}
</body>
</html>`;
}
