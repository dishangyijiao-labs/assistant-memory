import { settingsStyles } from "./settings-styles.js";
import { settingsScript } from "./settings-script.js";

export default function getSettingsPage(): string {
  const bodyHtml = `
</head>
<body>
  <div class="layout">
    <main class="main">
      <a class="back-link" href="/">← Back</a>
      <h1 class="page-title">Advanced</h1>
      <p class="page-sub">Data source paths and low-frequency local configuration. Daily sync runs from Home.</p>
      <div class="status" id="status"></div>

      <section class="section active" id="section-data-sources">
        <div class="section-head">
          <h2 class="section-title">Connected Tools</h2>
          <span class="count-chip" id="active-count">0 enabled</span>
        </div>
        <div class="source-list" id="source-list"></div>
        <div class="section-card">
          <h3>Insights API</h3>
          <div class="muted" id="insights-api-status">External API: unknown</div>
          <div class="row">
            <a href="/insights/new">Open Insights Setup</a>
          </div>
        </div>
        <div class="footer-note">
          Supported: Cursor IDE, GitHub Copilot, Cursor CLI, Claude Code, Codex, Gemini.
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
  <title>AssistMem – Advanced</title>
${settingsStyles}
${bodyHtml}
${settingsScript}
</body>
</html>`;
}
