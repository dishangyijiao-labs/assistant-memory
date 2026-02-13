export const settingsStyles = `
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --panel: #f3f4f6;
      --border: #e5e7eb;
      --text: #111827;
      --muted: #6b7280;
      --accent: #2563eb;
      --accent-soft: #e8efff;
      --success: #166534;
      --warning: #b45309;
      --error: #b91c1c;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .layout {
      max-width: 1160px;
      margin: 0 auto;
      min-height: 100vh;
      padding: 1.4rem;
    }
    .back-link {
      display: inline-block;
      font-size: 0.86rem;
      color: var(--accent);
      margin-bottom: 0.6rem;
    }
    .main {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
      min-height: 560px;
    }
    .page-title { margin: 0; font-size: 1.3rem; }
    .page-sub {
      margin: 0.4rem 0 0.9rem;
      color: var(--muted);
      font-size: 0.88rem;
      line-height: 1.45;
    }
    .status {
      min-height: 1.25rem;
      font-size: 0.82rem;
      color: var(--muted);
      margin-bottom: 0.8rem;
    }
    .status.ok { color: var(--success); }
    .status.warn { color: var(--warning); }
    .status.err { color: var(--error); }
    .section { display: none; }
    .section.active { display: block; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.65rem;
      margin-bottom: 0.9rem;
    }
    @media (max-width: 780px) {
      .summary-grid { grid-template-columns: 1fr; }
    }
    .summary-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.75rem 0.8rem;
    }
    .summary-value { font-size: 1.35rem; font-weight: 700; line-height: 1; }
    .summary-label { margin-top: 0.3rem; font-size: 0.8rem; color: var(--muted); }
    .source-list {
      display: flex;
      flex-direction: column;
      gap: 0.62rem;
    }
    .source-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.72rem;
    }
    .source-card.disabled { opacity: 0.74; }
    .source-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.6rem;
    }
    .source-main {
      display: flex;
      gap: 0.58rem;
      min-width: 0;
      flex: 1;
    }
    .source-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #eef2ff;
      color: #1d4ed8;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.86rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .source-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.38rem;
    }
    .source-title { font-size: 1rem; font-weight: 700; }
    .source-kind {
      border: 1px solid var(--border);
      background: #f9fafb;
      color: var(--muted);
      border-radius: 999px;
      font-size: 0.68rem;
      padding: 0.1rem 0.36rem;
    }
    .source-path {
      margin-top: 0.16rem;
      color: var(--muted);
      font-size: 0.79rem;
      word-break: break-all;
    }
    .source-desc {
      margin-top: 0.18rem;
      color: var(--muted);
      font-size: 0.79rem;
      line-height: 1.4;
    }
    .source-meta {
      margin-top: 0.55rem;
      padding-top: 0.45rem;
      border-top: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .source-actions {
      margin-top: 0.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
    button.btn {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.42rem 0.7rem;
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
      background: #fff;
      color: var(--text);
    }
    button.btn:hover { border-color: var(--accent); }
    button.btn.primary {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    button.btn.primary:hover { filter: brightness(0.95); }
    button.btn:disabled { opacity: 0.65; cursor: not-allowed; }
    .source-config {
      margin-top: 0.58rem;
      border-top: 1px dashed var(--border);
      padding-top: 0.58rem;
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr) auto;
      gap: 0.45rem;
      align-items: center;
    }
    @media (max-width: 840px) {
      .source-config { grid-template-columns: 1fr; }
    }
    .source-config.hidden { display: none; }
    select, input[type="text"] {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
      color: var(--text);
      padding: 0.44rem 0.5rem;
      font: inherit;
      font-size: 0.8rem;
    }
    .section-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.78rem;
      margin-bottom: 0.6rem;
    }
    .section-card h3 {
      margin: 0 0 0.4rem;
      font-size: 0.9rem;
    }
    .muted { color: var(--muted); font-size: 0.82rem; line-height: 1.45; }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.52rem;
      align-items: center;
    }
    .footer-note {
      margin-top: 0.7rem;
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 10px;
      padding: 0.62rem 0.72rem;
      font-size: 0.79rem;
      color: var(--muted);
      line-height: 1.45;
    }
    .switch {
      position: relative;
      width: 38px;
      height: 22px;
      display: inline-block;
      flex-shrink: 0;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      inset: 0;
      background: #d1d5db;
      border-radius: 999px;
      transition: 0.2s;
      cursor: pointer;
    }
    .slider::before {
      content: "";
      position: absolute;
      width: 16px;
      height: 16px;
      left: 3px;
      top: 3px;
      background: #fff;
      border-radius: 50%;
      transition: 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    }
    .switch input:checked + .slider { background: var(--accent); }
    .switch input:checked + .slider::before { transform: translateX(16px); }
  </style>
`;
