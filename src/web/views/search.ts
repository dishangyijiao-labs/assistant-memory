import { searchPageStyles } from "./search-styles.js";
import { searchPageScript } from "./search-script.js";

export default function getSearchPage(): string {
  const bodyHtml = `
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>AssistMem</h1>
      </div>
      <div class="sidebar-filters">
        <form id="search-form" class="search-wrap" role="search">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
          <input type="search" id="q" name="q" placeholder="Search..." />
        </form>
        <div class="sync-actions">
          <button type="button" class="btn-index-now" id="btn-index-now">Sync Local Chats</button>
          <button type="button" class="btn-sync-options" id="btn-sync-options" aria-expanded="false" title="Sync options">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.669.864 8 0 6.331.864l-.25 1.814a5.4 5.4 0 0 0-1.214.703L3.122 2.59 1.944 3.767l.792 1.746a5.4 5.4 0 0 0-.703 1.214l-1.814.25L0 8l.864 1.669 1.814.25c.165.435.4.845.703 1.214l-.792 1.746 1.178 1.177 1.746-.792c.369.303.779.538 1.214.703L6.331 16 8 15.136l.25-1.814a5.4 5.4 0 0 0 1.214-.703l1.746.792 1.177-1.177-.792-1.746c.303-.369.538-.779.703-1.214l1.814-.25L16 8l-.864-1.669-1.814-.25a5.4 5.4 0 0 0-.703-1.214l.792-1.746-1.177-1.178-1.746.792a5.4 5.4 0 0 0-1.214-.703zM8 5.25A2.75 2.75 0 1 1 8 10.75 2.75 2.75 0 0 1 8 5.25"/></svg>
          </button>
        </div>
        <div class="sync-options-panel hidden" id="sync-options-panel">
          <div class="sync-options-title">Sync Options</div>
          <div class="sync-options-status" id="sync-options-status">Loading…</div>
          <div class="sync-options-list" id="sync-options-list"></div>
          <button type="button" class="btn-sync-inline" id="btn-sync-inline">Sync Enabled Now</button>
          <a class="sync-options-link" href="/advanced">Open Advanced</a>
        </div>
      </div>
      <div class="session-list" id="session-list" role="listbox" tabindex="0"></div>
      <div class="sidebar-foot">
        <button type="button" class="btn-settings" id="btn-settings" title="Advanced">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/></svg>
          <span class="settings-label">Advanced</span>
        </button>
      </div>
    </aside>
    <main class="content">
      <div class="content-header" id="content-header">
        <h2 id="session-title">Select a session</h2>
        <div class="header-actions">
          <a href="#" class="action-btn" id="analyze-session" title="Analyze prompt quality" style="display:none">Analyze</a>
          <button type="button" class="action-btn" id="copy-session" disabled title="Copy session">Copy</button>
        </div>
      </div>
      <div class="messages-area" id="messages">
        <div class="empty-state">
          <p>Select a session from the sidebar</p>
          <p class="guidance">If no sessions appear, run <code>npx assistmem index</code></p>
        </div>
      </div>
    </main>
  </div>
  <div class="toast" id="toast"></div>
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AssistMem</title>
${searchPageStyles}
${bodyHtml}
${searchPageScript}
</body>
</html>`;
}
