export const insightsReportsStyles = `
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
      --chip: #f0f3f8;
      --code-bg: #1e293b;
      --code-text: #e2e8f0;
      --success: #13a86c;
      --warning: #f39c12;
      --danger: #e74c3c;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: var(--text);
      background: var(--bg);
    }
    .app { display: grid; grid-template-columns: minmax(0, 1fr); min-height: 100vh; }
    .sidebar {
      border-right: 1px solid var(--border);
      background: var(--sidebar-bg);
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .sidebar-head {
      padding: 1.2rem 1rem 0.9rem;
      font-size: 1.03rem;
      font-weight: 700;
    }
    .sidebar-filter { padding: 0 1rem 0.6rem; }
    .source-select {
      width: 100%;
      padding: 0.52rem 0.7rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      font: inherit;
      font-size: 0.9rem;
      background: #fff;
      color: var(--text);
    }
    .chip-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.42rem; margin-top: 0.48rem; }
    .chip-select {
      width: 100%;
      padding: 0.45rem 0.58rem;
      border-radius: 7px;
      border: 1px solid var(--border);
      font: inherit;
      font-size: 0.82rem;
      background: #fff;
      color: var(--muted);
    }
    .search-wrap { margin-top: 0.48rem; }
    .search-input {
      width: 100%;
      padding: 0.52rem 0.7rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      font: inherit;
      background: #fff;
      color: var(--text);
      font-size: 0.88rem;
    }
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
    .pager {
      border-top: 1px solid var(--border);
      padding: 0.62rem 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.72rem;
      color: var(--muted);
      font-size: 0.82rem;
    }
    .pager button {
      border: none;
      background: transparent;
      font-size: 1.1rem;
      color: var(--muted);
      cursor: pointer;
      padding: 0.15rem 0.28rem;
    }
    .sidebar-foot {
      padding: 0.65rem 1rem; border-top: 1px solid var(--border);
      display: flex; align-items: center; justify-content: flex-start;
    }
    .btn-settings {
      background: none; border: none; color: var(--muted); cursor: pointer;
      display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem;
      font: inherit; font-size: 0.85rem; font-weight: 500;
    }
    .btn-settings:hover { color: var(--text); }
    .btn-settings svg { width: 16px; height: 16px; }
    .settings-label { color: var(--muted); }
    .btn-settings:hover .settings-label { color: var(--text); }
    .main { min-width: 0; display: flex; flex-direction: column; }
    .topbar {
      padding: 1.25rem 1.8rem 0.92rem;
      border-bottom: 1px solid var(--border);
      background: #fff;
    }
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      font-size: 0.95rem;
      color: var(--muted);
    }
    .breadcrumbs a { color: var(--accent); text-decoration: none; }
    .title {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1.12;
      margin: 0.45rem 0 0.15rem;
    }
    .subtitle { color: var(--muted); font-size: 1.05rem; margin: 0; }
    .content {
      padding: 1.35rem 1.8rem 2.2rem;
      overflow: auto;
      min-height: 0;
    }
    .status {
      min-height: 1.3rem;
      margin-bottom: 0.8rem;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .status.ok { color: var(--success); }
    .status.warn { color: #a46a00; }
    .status.err { color: var(--danger); }
    .model-config-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
      padding: 0.9rem 0.95rem;
      margin-bottom: 0.9rem;
    }
    .model-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.7rem;
      margin-bottom: 0.72rem;
      flex-wrap: wrap;
    }
    .model-title {
      font-size: 0.96rem;
      font-weight: 650;
    }
    .model-badge {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.15rem 0.5rem;
      font-size: 0.76rem;
      color: var(--muted);
      background: #f7f9ff;
    }
    .model-badge.ok {
      color: #10764d;
      border-color: #bfe7d2;
      background: #eaf9f1;
    }
    .model-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.6rem;
      align-items: end;
    }
    .model-grid.two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 0.6rem;
    }
    .model-field label {
      display: block;
      font-size: 0.8rem;
      color: var(--muted);
      margin-bottom: 0.28rem;
    }
    .model-field input,
    .model-field select {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
      color: var(--text);
      font: inherit;
      font-size: 0.88rem;
      padding: 0.45rem 0.55rem;
    }
    .model-field input:disabled,
    .model-field select:disabled {
      background: #f7f8fb;
      color: #8a92a3;
    }
    .model-actions {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      flex-wrap: wrap;
    }
    .model-note {
      margin-top: 0.45rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .model-hint {
      margin-top: 0.5rem;
      font-size: 0.88rem;
      color: var(--muted);
      min-height: 1.1rem;
    }
    .model-hint.err { color: var(--danger); }
    .model-hint.ok { color: var(--success); }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.8rem;
      margin-bottom: 1rem;
    }
    .summary-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 0.95rem 0.9rem;
      text-align: center;
    }
    .summary-value { font-size: 2rem; font-weight: 700; line-height: 1; margin-bottom: 0.26rem; }
    .summary-label { font-size: 0.94rem; color: var(--muted); }
    .reports-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      gap: 0.8rem;
    }
    .plan-panel {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
      padding: 0.9rem 0.95rem;
      margin-bottom: 1rem;
    }
    .plan-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 0.65rem;
    }
    .plan-head h3 {
      margin: 0;
      font-size: 1rem;
    }
    .plan-count {
      color: var(--muted);
      font-size: 0.82rem;
    }
    .plan-item {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.62rem 0.72rem;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.6rem;
      align-items: center;
      margin-bottom: 0.52rem;
    }
    .plan-item.done .plan-action {
      color: var(--muted);
      text-decoration: line-through;
    }
    .plan-main { min-width: 0; }
    .plan-action {
      font-size: 0.92rem;
      color: var(--text);
      line-height: 1.4;
    }
    .plan-meta {
      margin-top: 0.2rem;
      font-size: 0.78rem;
      color: var(--muted);
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .plan-link {
      color: var(--accent);
      text-decoration: none;
    }
    .plan-link:hover { text-decoration: underline; }
    .plan-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .plan-empty {
      color: var(--muted);
      font-size: 0.88rem;
      border: 1px dashed var(--border);
      border-radius: 8px;
      padding: 0.72rem;
      text-align: center;
    }
    .btn-primary {
      border: 1px solid var(--accent);
      border-radius: 10px;
      background: var(--accent);
      color: #fff;
      font: inherit;
      font-size: 0.95rem;
      padding: 0.56rem 0.94rem;
      cursor: pointer;
    }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-ghost {
      border: 1px solid var(--border);
      border-radius: 9px;
      background: #fff;
      color: var(--text);
      font: inherit;
      font-size: 0.92rem;
      padding: 0.45rem 0.85rem;
      cursor: pointer;
    }
    .report-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 1rem 1rem;
      margin-bottom: 0.72rem;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.8rem;
      align-items: center;
    }
    .report-title { font-size: 1.04rem; font-weight: 650; margin-bottom: 0.2rem; }
    .report-meta { color: var(--muted); font-size: 0.88rem; margin-bottom: 0.35rem; }
    .tag-row { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .tag {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.08rem 0.36rem;
      font-size: 0.74rem;
      color: var(--muted);
      background: #fafbfe;
    }
    .report-actions { display: flex; align-items: center; gap: 0.55rem; }
    .delete-btn {
      border: none;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      font-size: 1.05rem;
      padding: 0.12rem;
    }
    .metrics-strip {
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      padding: 0.8rem 1.8rem;
      background: #fff;
      display: flex;
      flex-wrap: wrap;
      gap: 1.05rem;
      color: var(--muted);
      font-size: 0.86rem;
      align-items: center;
    }
    .metric-strong { color: var(--text); font-weight: 700; font-size: 0.98rem; }
    .tabs {
      border-bottom: 1px solid var(--border);
      background: #fff;
      padding: 0 1.8rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .tab {
      border: none;
      background: transparent;
      border-bottom: 3px solid transparent;
      color: var(--muted);
      font: inherit;
      font-size: 0.9rem;
      padding: 0.78rem 0.35rem 0.72rem;
      cursor: pointer;
    }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
    .section-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
      padding: 1rem 1rem;
      margin-bottom: 0.72rem;
    }
    .section-card h3 { margin: 0 0 0.56rem; font-size: 1.03rem; }
    .section-card p {
      margin: 0.2rem 0;
      font-size: 0.96rem;
      color: #5d667a;
      line-height: 1.48;
    }
    .section-card p strong { color: var(--text); }
    .decision-strip {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) repeat(2, minmax(0, 1fr));
      gap: 0.72rem;
      margin-bottom: 0.72rem;
    }
    .decision-main,
    .decision-metric {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #fff;
      padding: 0.82rem 0.9rem;
    }
    .decision-label {
      color: var(--muted);
      font-size: 0.82rem;
      margin-bottom: 0.22rem;
    }
    .decision-value {
      font-size: 1.12rem;
      font-weight: 700;
      color: var(--text);
    }
    .decision-positive { color: #127946; }
    .decision-neutral { color: #996600; }
    .decision-negative { color: #b42318; }
    .confidence-high { color: #127946; }
    .confidence-medium { color: #996600; }
    .confidence-low { color: #b42318; }
    .sample-warning {
      margin-bottom: 0.72rem;
      border: 1px solid #f3d7a1;
      background: #fff8ea;
      color: #9a5f00;
      border-radius: 10px;
      padding: 0.62rem 0.78rem;
      font-size: 0.9rem;
      line-height: 1.4;
    }
    .feedback-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.72rem;
      margin-bottom: 0.72rem;
    }
    .mini-list {
      margin: 0;
      padding-left: 1rem;
      color: #5d667a;
      line-height: 1.45;
      font-size: 0.93rem;
    }
    .mini-list li { margin: 0.22rem 0; }
    .detail-more {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 0.55rem 0.7rem;
      margin-bottom: 0.72rem;
    }
    .action-row {
      margin-top: 0.65rem;
      display: flex;
      justify-content: flex-start;
    }
    .detail-more > summary {
      cursor: pointer;
      color: var(--muted);
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .callout-green { border-left: 4px solid #15b876; }
    .callout-amber { border-left: 4px solid #f0a61d; }
    .callout-blue { border-left: 4px solid #3567ff; }
    .callout-dark { border-left: 4px solid #1f2533; }
    .two-col {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 270px;
      gap: 0.82rem;
    }
    .stats-box {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 0.82rem 0.85rem;
      margin-bottom: 0.72rem;
    }
    .stats-title {
      font-size: 0.78rem;
      color: var(--muted);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 0.4rem;
    }
    .stats-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.55rem;
      margin-bottom: 0.28rem;
      font-size: 0.93rem;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 120px 1fr 32px;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 0.48rem;
      font-size: 0.9rem;
      color: var(--muted);
    }
    .bar-track {
      background: #edf1fa;
      height: 14px;
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #5b79f5 0%, #5270f2 100%);
    }
    .code-block {
      margin-top: 0.55rem;
      background: var(--code-bg);
      color: var(--code-text);
      border-radius: 8px;
      padding: 0.72rem 0.82rem;
      font-family: "SF Mono", "Consolas", "Monaco", monospace;
      font-size: 0.93rem;
      line-height: 1.45;
      position: relative;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .copy-btn {
      position: absolute;
      right: 0.6rem;
      top: 0.6rem;
      border: none;
      background: transparent;
      color: #98a4cc;
      cursor: pointer;
      font-size: 1rem;
      padding: 0.2rem;
    }
    .bullet-note {
      margin: 0.35rem 0 0;
      padding-left: 0.8rem;
      border-left: 3px solid #f2c14c;
      color: #677089;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.6rem; }
    .chip {
      border-radius: 8px;
      background: #eff3ff;
      color: #364469;
      border: 1px solid #dde6ff;
      padding: 0.22rem 0.45rem;
      font-size: 0.88rem;
    }
    .chip-success { background: #e7f7ef; color: #127946; border-color: #c3ebd7; }
    .chip-warning { background: #fff4e6; color: #af6d03; border-color: #f4d9ae; }
    .select-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.6rem;
      margin-bottom: 0.9rem;
      flex-wrap: wrap;
    }
    .source-tabs { display: flex; flex-wrap: wrap; gap: 0.38rem; }
    .source-tab {
      border: 1px solid var(--border);
      background: #f6f7fb;
      color: var(--muted);
      border-radius: 8px;
      padding: 0.36rem 0.58rem;
      font: inherit;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .source-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    .select-all {
      color: var(--accent);
      background: transparent;
      border: none;
      font: inherit;
      font-size: 0.94rem;
      cursor: pointer;
      padding: 0;
    }
    .candidate-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      padding: 0.8rem 0.85rem;
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 0.6rem;
    }
    .candidate-card.selected { border-color: #b9c9ff; box-shadow: 0 0 0 1px #dfe7ff inset; }
    .candidate-check {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #fff;
      cursor: pointer;
    }
    .candidate-title { font-size: 1rem; margin-bottom: 0.2rem; }
    .candidate-meta { font-size: 0.86rem; color: var(--muted); display: flex; gap: 0.45rem; align-items: center; }
    .candidate-count { text-align: right; color: var(--muted); font-size: 0.88rem; min-width: 90px; }
    .empty {
      border: 1px dashed var(--border);
      border-radius: 10px;
      background: #fff;
      color: var(--muted);
      padding: 1.1rem;
      text-align: center;
    }
    .mobile-hidden { display: inline; }
    @media (max-width: 1200px) {
      .two-col { grid-template-columns: 1fr; }
      .summary-grid { grid-template-columns: 1fr; }
      .model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .decision-strip,
      .feedback-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 960px) {
      .app { grid-template-columns: 1fr; }
      .sidebar { min-height: auto; }
      .mobile-hidden { display: none; }
      .content, .topbar, .metrics-strip, .tabs { padding-left: 1rem; padding-right: 1rem; }
      .model-grid,
      .model-grid.two { grid-template-columns: 1fr; }
    }
  </style>
`;
