export const insightsStyles = `
  <style>
    :root {
      --bg: #ffffff;
      --surface: #f6f7fb;
      --border: #e1e5ee;
      --text: #1b1d26;
      --muted: #6b7280;
      --accent: #1f4bff;
      --accent-hover: #1a3fda;
      --accent-soft: #e8eeff;
      --success: #2f7d32;
      --warning: #a85700;
      --error: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 2rem; min-height: 100vh;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { color: var(--accent-hover); }
    .title { margin: 0; font-size: 1.2rem; }
    .sub { margin: 0.3rem 0 0; font-size: 0.82rem; color: var(--muted); }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 1rem; align-items: start; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
    .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.9rem; }
    .section-title { margin: 0 0 0.55rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.74rem; }
    .controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 0.85rem; }
    @media (max-width: 860px) { .controls { grid-template-columns: 1fr; } }
    label { display: block; font-size: 0.78rem; color: var(--muted); margin-bottom: 0.35rem; }
    input[type="text"], input[type="password"], select {
      width: 100%; border: 1px solid var(--border); background: #fff;
      color: var(--text); border-radius: 6px; padding: 0.45rem 0.55rem; font: inherit; font-size: 0.82rem;
    }
    .checkbox-row { display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text); }
    .source-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .source-item {
      display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem;
      color: var(--text); background: #fff; border: 1px solid var(--border);
      border-radius: 999px; padding: 0.2rem 0.5rem;
    }
    .btn-row { display: flex; flex-wrap: wrap; gap: 0.55rem; margin: 0.9rem 0 0.65rem; }
    button {
      border: none; border-radius: 6px; padding: 0.45rem 0.8rem;
      font: inherit; font-size: 0.8rem; cursor: pointer; background: var(--accent); color: #fff;
    }
    button:hover { background: var(--accent-hover); }
    button.secondary { background: var(--accent-soft); color: var(--text); border: 1px solid var(--border); }
    button.secondary:hover { border-color: var(--accent); }
    button:disabled { opacity: 0.65; cursor: not-allowed; }
    .status { min-height: 1.2rem; font-size: 0.8rem; color: var(--muted); margin: 0.3rem 0 0.8rem; }
    .status.ok { color: var(--success); }
    .status.warn { color: var(--warning); }
    .status.err { color: var(--error); }
    .progress-steps { display: flex; gap: 0.75rem; margin-bottom: 0.5rem; font-size: 0.78rem; }
    .progress-step { color: var(--muted); }
    .progress-step.active { color: var(--accent); font-weight: 600; }
    .progress-step.done { color: var(--success); }
    .result-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; margin-bottom: 0.75rem; }
    @media (max-width: 860px) { .result-grid { grid-template-columns: 1fr; } }
    .score-card { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 0.65rem; }
    .score-name { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .score-value { font-size: 1.2rem; margin-top: 0.2rem; font-weight: 700; }
    .score-reason { font-size: 0.72rem; color: var(--muted); margin-top: 0.3rem; line-height: 1.4; font-style: italic; }
    .block { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 0.7rem; margin-bottom: 0.65rem; }
    .block h3 { margin: 0 0 0.45rem; font-size: 0.82rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .block p, .block li, .block a { font-size: 0.82rem; line-height: 1.45; color: var(--text); }
    .block ul { margin: 0; padding-left: 1rem; }
    .history-list {
      list-style: none; margin: 0; padding: 0;
      flex: 1; overflow-y: auto; min-height: 0; max-height: 70vh;
    }
    .history-item {
      padding: 0.6rem 1rem;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.12s, border-color 0.12s;
    }
    .history-item:hover { background: var(--surface); }
    .history-item.active {
      background: var(--accent-soft);
      border-left-color: var(--accent);
    }
    .history-item button { width: 100%; text-align: left; background: transparent; border: none; color: var(--text); padding: 0; font-size: 0.8rem; cursor: pointer; }
    .history-meta { margin-top: 0.25rem; font-size: 0.72rem; color: var(--muted); }
    .external-fields { transition: opacity 0.2s; }
    .external-fields.hidden-fields { opacity: 0.35; pointer-events: none; }
    .toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem; background: var(--text);
      color: #fff; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.82rem;
      opacity: 0; transition: opacity 0.25s; pointer-events: none; z-index: 9999;
    }
    .toast.show { opacity: 1; }
  </style>
`;
