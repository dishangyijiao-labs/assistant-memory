import { searchPageStyles } from "./search-styles.js";
import { searchPageScript } from "./search-script.js";

export default function getSearchPage(): string {
  const bodyHtml = `
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <svg class="brand-logo" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="bl-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#4ADE80"/>
              <stop offset="100%" stop-color="#15803D"/>
            </linearGradient>
          </defs>
          <rect width="36" height="36" rx="8" fill="url(#bl-bg)"/>
          <line x1="18" y1="18" x2="18" y2="9"  stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
          <line x1="18" y1="18" x2="26" y2="14" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
          <line x1="18" y1="18" x2="26" y2="23" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
          <line x1="18" y1="18" x2="18" y2="27" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
          <line x1="18" y1="18" x2="10" y2="23" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
          <line x1="18" y1="18" x2="10" y2="14" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
          <circle cx="18" cy="18" r="4"   fill="white"/>
          <circle cx="18" cy="9"  r="2.5" fill="white"/>
          <circle cx="26" cy="14" r="2.5" fill="white"/>
          <circle cx="26" cy="23" r="2.5" fill="white"/>
          <circle cx="18" cy="27" r="2.5" fill="white"/>
          <circle cx="10" cy="23" r="2.5" fill="white"/>
          <circle cx="10" cy="14" r="2.5" fill="white"/>
        </svg>
        <span class="brand-name">AssistMem</span>
      </div>
      <div class="sidebar-filters">
        <form id="search-form" class="search-wrap" role="search">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
          <input type="search" id="q" name="q" placeholder="Search sessions..." />
        </form>
        <div class="sync-btn-group">
          <button type="button" class="btn-index-now" id="btn-index-now">Sync Local Chats</button>
          <button type="button" class="btn-sync-options" id="btn-sync-options" aria-expanded="false" title="Select sync sources">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/></svg>
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
        <a href="/insights" class="btn-insights" id="btn-insights" title="Insights">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M0 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z"/></svg>
          <span>Insights</span>
        </a>
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
          <a href="#" class="action-btn" id="analyze-session" title="View session detail" style="display:none">Insights</a>
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
