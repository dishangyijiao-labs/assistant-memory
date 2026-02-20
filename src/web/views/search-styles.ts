export const searchPageStyles = `
  <style>
    :root {
      --bg: #f9fafb;
      --sidebar-bg: #ffffff;
      --surface: #f3f4f6;
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --accent-soft: #eff6ff;
      --user-bubble: #f3f4f6;
      --assistant-bg: #ffffff;
      --code-bg: #1e293b;
      --code-text: #e2e8f0;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 1.5;
    }

    /* Layout */
    .layout { display: flex; height: 100vh; }

    /* Sidebar */
    .sidebar {
      width: 280px;
      min-width: 280px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      height: 100vh;
      position: relative;
    }
    .sidebar-header { padding: 1.25rem 1rem 0.5rem; }
    .sidebar-header h1 { font-size: 1.05rem; font-weight: 700; color: var(--text); }

    .sidebar-filters { padding: 0 1rem; padding-bottom: 0.5rem; }

    .search-wrap { position: relative; }
    .search-wrap input {
      width: 100%; padding: 0.45rem 0.75rem 0.45rem 2.1rem;
      font: inherit; font-size: 0.85rem;
      background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text);
    }
    .search-wrap input::placeholder { color: var(--muted); }
    .search-wrap input:focus { outline: none; border-color: var(--accent); }
    .search-icon {
      position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%);
      width: 14px; height: 14px; color: var(--muted); pointer-events: none;
    }
    .sync-actions {
      margin-top: 0.5rem;
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }
    .btn-index-now {
      flex: 1;
      padding: 0.42rem 0.65rem;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      background: var(--accent-soft);
      color: #1d4ed8;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s, color 0.12s, opacity 0.12s;
    }
    .btn-index-now:hover { background: #dbeafe; border-color: #93c5fd; color: #1e40af; }
    .btn-index-now:disabled { background: var(--surface); border-color: var(--border); color: var(--muted); opacity: 0.85; cursor: wait; }
    .btn-sync-options {
      width: 34px;
      height: 34px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: border-color 0.12s, color 0.12s, background 0.12s;
    }
    .btn-sync-options:hover {
      border-color: #93c5fd;
      color: #1e40af;
      background: #eef2ff;
    }
    .btn-sync-options svg { width: 15px; height: 15px; }
    .sync-options-panel {
      margin-top: 0.45rem;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 0.55rem;
      box-shadow: 0 10px 20px rgba(15, 23, 42, 0.06);
    }
    .sync-options-title {
      font-size: 0.75rem;
      color: var(--muted);
      font-weight: 700;
      margin-bottom: 0.45rem;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .sync-options-status {
      margin-bottom: 0.45rem;
      font-size: 0.72rem;
      color: var(--muted);
      padding: 0.32rem 0.4rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #f8fafc;
      line-height: 1.35;
    }
    .sync-options-list { display: flex; flex-direction: column; gap: 0.35rem; }
    .sync-source-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.3rem 0.35rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fafafa;
    }
    .sync-source-main { min-width: 0; }
    .sync-source-name { font-size: 0.77rem; color: var(--text); font-weight: 600; }
    .sync-source-meta { font-size: 0.7rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sync-source-toggle { width: 14px; height: 14px; cursor: pointer; }
    .sync-options-link {
      margin-top: 0.5rem;
      display: inline-block;
      font-size: 0.74rem;
      color: var(--accent);
      text-decoration: none;
    }
    .sync-options-link:hover { text-decoration: underline; }
    .btn-sync-inline {
      margin-top: 0.5rem;
      width: 100%;
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 8px;
      padding: 0.38rem 0.55rem;
      font: inherit;
      font-size: 0.76rem;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-sync-inline:hover { background: #dbeafe; border-color: #93c5fd; color: #1e40af; }
    .btn-sync-inline:disabled { background: var(--surface); border-color: var(--border); color: var(--muted); cursor: wait; }

    /* Session list */
    .session-list { flex: 1; overflow-y: auto; min-height: 0; }
    .session-item {
      padding: 0.6rem 1rem;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.12s, border-color 0.12s;
    }
    .session-item:hover { background: var(--surface); }
    .session-item.active {
      background: var(--accent-soft);
      border-left-color: var(--accent);
    }
    .session-item.focused { background: var(--surface); }
    .session-item-title {
      font-size: 0.88rem; font-weight: 600; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 0.15rem;
    }
    .session-item-meta {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.75rem;
    }
    .source-badge { font-weight: 600; font-size: 0.72rem; color: var(--muted); }
    .session-time { color: var(--muted); }

    /* Sidebar footer */
    .sidebar-foot {
      padding: 0.65rem 1rem; border-top: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
    }
    .btn-insights {
      background: none; border: none; color: var(--accent); cursor: pointer;
      display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem;
      font: inherit; font-size: 0.85rem; font-weight: 600;
      text-decoration: none; border-radius: 6px;
      transition: background 0.12s, color 0.12s;
    }
    .btn-insights:hover { background: var(--accent-soft); color: var(--accent-hover); }
    .btn-insights svg { width: 16px; height: 16px; }
    .btn-settings {
      background: none; border: none; color: var(--muted); cursor: pointer;
      display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem;
      font: inherit; font-size: 0.85rem; font-weight: 500;
    }
    .btn-settings:hover { color: var(--text); }
    .btn-settings svg { width: 16px; height: 16px; }
    .settings-label { color: var(--muted); }
    .btn-settings:hover .settings-label { color: var(--text); }

    /* Content panel */
    .content {
      flex: 1; display: flex; flex-direction: column;
      height: 100vh; min-width: 0; background: var(--bg);
    }
    .content-header {
      padding: 1.1rem 1.5rem 0.75rem;
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 1rem;
    }
    .content-header h2 {
      font-size: 1.05rem; font-weight: 600; color: var(--text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
    }
    .header-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
    .action-btn {
      padding: 0.3rem 0.65rem; font: inherit; font-size: 0.75rem;
      background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
      color: var(--muted); cursor: pointer; transition: border-color 0.12s, color 0.12s;
    }
    .action-btn:hover { border-color: var(--accent); color: var(--text); }
    .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    a.action-btn { text-decoration: none; }

    /* Messages area */
    .messages-area {
      flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem;
      display: flex; flex-direction: column; gap: 1rem; min-height: 0;
    }

    /* Chat messages */
    .chat-msg { display: flex; gap: 0.6rem; max-width: 82%; }
    .chat-msg.msg-user { align-self: flex-end; flex-direction: row-reverse; }
    .chat-msg.msg-assistant { align-self: flex-start; }
    .chat-msg.msg-system { align-self: center; max-width: 90%; }

    .avatar {
      width: 32px; height: 32px; min-width: 32px;
      border-radius: 50%; background: var(--accent);
      display: flex; align-items: center; justify-content: center;
      margin-top: 0.15rem; flex-shrink: 0;
    }
    .avatar svg { width: 16px; height: 16px; fill: white; }

    .bubble {
      padding: 0.7rem 1rem; border-radius: 14px;
      font-size: 0.88rem; line-height: 1.6; word-break: break-word;
    }
    .bubble-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; }
    .bubble-wrap .quality-badge {
      font-size: 0.68rem; padding: 0.12rem 0.35rem; border-radius: 4px;
      font-weight: 600; text-decoration: none;
    }
    .bubble-wrap .quality-badge.quality-a, .bubble-wrap .quality-badge.quality-b { background: #d1fae5; color: #065f46; }
    .bubble-wrap .quality-badge.quality-c { background: #fef3c7; color: #92400e; }
    .bubble-wrap .quality-badge.quality-d, .bubble-wrap .quality-badge.quality-f { background: #fee2e2; color: #991b1b; }
    .bubble-wrap .quality-badge:hover { opacity: 0.85; }
    .bubble-user {
      background: var(--user-bubble); color: var(--text);
      border: 1px solid var(--border); border-bottom-right-radius: 4px;
    }
    .bubble-assistant {
      background: var(--assistant-bg); color: var(--text);
      border: 1px solid var(--border); border-bottom-left-radius: 4px;
    }
    .bubble-system {
      background: #fef3c7; color: var(--text); border: 1px solid #fde68a;
    }

    /* Markdown in bubbles */
    .bubble p { margin: 0.25rem 0; }
    .bubble p:first-child { margin-top: 0; }
    .bubble p:last-child { margin-bottom: 0; }
    .bubble ul, .bubble ol { margin: 0.3rem 0; padding-left: 1.2rem; }
    .bubble li { margin: 0.12rem 0; }
    .bubble h1, .bubble h2, .bubble h3, .bubble h4 {
      margin: 0.5rem 0 0.2rem; font-size: 0.92rem; font-weight: 600;
    }
    .bubble blockquote {
      border-left: 3px solid var(--border); margin: 0.3rem 0;
      padding: 0.2rem 0.6rem; color: var(--muted);
    }
    .bubble a { color: var(--accent); text-decoration: underline; }
    .bubble strong { font-weight: 600; }
    .bubble code {
      background: rgba(0,0,0,0.07); padding: 0.1rem 0.3rem; border-radius: 3px;
      font-family: "SF Mono", Consolas, Monaco, monospace; font-size: 0.82rem;
    }
    .bubble table { border-collapse: collapse; margin: 0.3rem 0; font-size: 0.8rem; }
    .bubble th, .bubble td { border: 1px solid var(--border); padding: 0.2rem 0.45rem; }
    .bubble th { background: var(--surface); }

    /* Code blocks */
    .code-wrap {
      margin: 0.45rem 0; border-radius: 8px; overflow: hidden;
      background: var(--code-bg);
    }
    .code-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.35rem 0.75rem;
      background: rgba(255,255,255,0.06);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .code-lang {
      font-size: 0.72rem; color: rgba(255,255,255,0.45);
      font-family: "SF Mono", Consolas, monospace;
    }
    .code-copy {
      background: none; border: none; color: rgba(255,255,255,0.45);
      cursor: pointer; padding: 0.1rem 0.25rem; border-radius: 3px;
      font-size: 0.72rem; transition: color 0.12s, background 0.12s;
      display: flex; align-items: center; gap: 0.25rem;
    }
    .code-copy:hover { color: #fff; background: rgba(255,255,255,0.1); }
    .code-copy svg { width: 13px; height: 13px; }
    .code-wrap pre {
      margin: 0; padding: 0.75rem; overflow-x: auto;
      color: var(--code-text);
      font-family: "SF Mono", Consolas, Monaco, monospace;
      font-size: 0.8rem; line-height: 1.55;
    }
    .code-wrap pre code { background: none; padding: 0; color: inherit; font-size: inherit; }

    /* Utilities */
    mark { background: #fef08a; padding: 0 0.1rem; border-radius: 2px; }
    .hidden { display: none !important; }
    .toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      background: var(--text); color: #fff;
      padding: 0.5rem 1rem; border-radius: 8px;
      font-size: 0.82rem; opacity: 0; transition: opacity 0.25s;
      pointer-events: none; z-index: 9999;
    }
    .toast.show { opacity: 1; }
    .skeleton {
      background: linear-gradient(90deg, var(--surface) 25%, #e8ebf0 50%, var(--surface) 75%);
      background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .skeleton-session { height: 48px; margin: 0.3rem 1rem; border-radius: 4px; }
    .skeleton-msg { height: 56px; margin-bottom: 0.75rem; border-radius: 14px; max-width: 65%; }
    .skeleton-msg:nth-child(odd) { align-self: flex-end; max-width: 55%; }
    .empty-state {
      padding: 2rem 1.5rem; text-align: center; color: var(--muted);
    }
    .empty-state p { margin: 0 0 0.5rem; }
    .empty-state .guidance { font-size: 0.82rem; line-height: 1.6; }
    .empty-state code { background: var(--surface); padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.78rem; }
    .error { color: #ef4444; }

    @media (max-width: 768px) {
      .sidebar { width: 240px; min-width: 240px; }
    }
  </style>
`;
