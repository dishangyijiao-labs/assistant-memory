export default function getGrowthPage(): string {
  const styles = `<style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#0f1117;--surface:#1a1d27;--border:#2a2d3a;--text:#e2e8f0;--muted:#64748b;
      --accent:#4ade80;--accent2:#60a5fa;--amber:#fbbf24;--red:#f87171;
      --good:#4ade80;--neutral:#fbbf24;--bad:#f87171;
    }
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);padding:1.5rem;min-height:100vh;}
    .page-header{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;}
    .back-link{color:var(--muted);text-decoration:none;font-size:0.9rem;}
    .back-link:hover{color:var(--text);}
    h1{font-size:1.4rem;font-weight:700;}
    .controls{display:flex;gap:0.75rem;margin-left:auto;align-items:center;flex-wrap:wrap;}
    select{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:0.35rem 0.6rem;border-radius:6px;font-size:0.88rem;cursor:pointer;}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:1.25rem;margin-bottom:1.25rem;}
    .card-title{font-size:0.95rem;font-weight:600;color:var(--muted);margin-bottom:1rem;text-transform:uppercase;letter-spacing:0.04em;}
    .kpi-row{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;}
    .kpi{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:0.85rem 1.1rem;min-width:120px;flex:1;}
    .kpi-val{font-size:1.6rem;font-weight:700;line-height:1;}
    .kpi-label{font-size:0.78rem;color:var(--muted);margin-top:0.3rem;}
    .chart-wrap{overflow-x:auto;}
    svg.chart{display:block;width:100%;min-width:300px;}
    .empty{color:var(--muted);padding:2rem;text-align:center;font-size:0.95rem;}
    .legend{display:flex;gap:1rem;flex-wrap:wrap;margin-top:0.75rem;}
    .legend-item{display:flex;align-items:center;gap:0.4rem;font-size:0.82rem;color:var(--muted);}
    .legend-dot{width:10px;height:10px;border-radius:50%;}
    .table-wrap{overflow-x:auto;}
    table{width:100%;border-collapse:collapse;font-size:0.88rem;}
    th,td{padding:0.5rem 0.75rem;text-align:left;border-bottom:1px solid var(--border);}
    th{color:var(--muted);font-weight:600;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;}
    .grade-A{color:var(--good);}
    .grade-B{color:var(--accent2);}
    .grade-C{color:var(--neutral);}
    .grade-D,.grade-F{color:var(--bad);}
    #status{color:var(--muted);font-size:0.88rem;padding:0.5rem 0;}
  </style>`;

  const script = `<script>
    var state = { range: "30d", workspace: "", data: [] };

    function api(path) {
      return fetch(path).then(function(r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
    }

    function escapeHtml(s) {
      return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    function fmt(n, dec) {
      return Number(n || 0).toFixed(dec || 0);
    }

    function scoreColor(v) {
      if (v >= 80) return "var(--good)";
      if (v >= 60) return "var(--neutral)";
      return "var(--bad)";
    }

    function buildSvgChart(data) {
      if (!data || data.length === 0) {
        return '<div class="empty">No quality score data yet. Score some sessions first.</div>';
      }

      var PAD_L = 48, PAD_R = 20, PAD_T = 20, PAD_B = 40;
      var W = 800, H = 220;
      var innerW = W - PAD_L - PAD_R;
      var innerH = H - PAD_T - PAD_B;

      var minScore = 0, maxScore = 100;
      var n = data.length;

      function xPos(i) { return PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW); }
      function yPos(v) { return PAD_T + innerH - ((v - minScore) / (maxScore - minScore)) * innerH; }

      // Grid lines at 0, 25, 50, 75, 100
      var gridLines = [0, 25, 50, 75, 100].map(function(v) {
        var y = yPos(v);
        return '<line x1="' + PAD_L + '" y1="' + y + '" x2="' + (W - PAD_R) + '" y2="' + y + '" stroke="#2a2d3a" stroke-width="1"/>' +
          '<text x="' + (PAD_L - 6) + '" y="' + (y + 4) + '" fill="#64748b" font-size="11" text-anchor="end">' + v + '</text>';
      }).join("");

      // Avg score polyline
      var scorePoints = data.map(function(d, i) { return xPos(i) + "," + yPos(d.avg_score); }).join(" ");
      var scorePath = "M " + data.map(function(d, i) { return xPos(i) + " " + yPos(d.avg_score); }).join(" L ");

      // Fill under avg score line
      var fillPath = scorePath +
        " L " + xPos(n - 1) + " " + (PAD_T + innerH) +
        " L " + xPos(0) + " " + (PAD_T + innerH) + " Z";

      // High ratio as second line (scaled 0-100)
      var ratioPath = "M " + data.map(function(d, i) { return xPos(i) + " " + yPos(d.high_ratio * 100); }).join(" L ");

      // X-axis labels: show up to 8 evenly spaced labels
      var labelStep = Math.max(1, Math.ceil(n / 8));
      var xLabels = data.map(function(d, i) {
        if (i % labelStep !== 0 && i !== n - 1) return "";
        var x = xPos(i);
        var label = d.date ? d.date.slice(5) : ""; // MM-DD
        return '<text x="' + x + '" y="' + (H - 8) + '" fill="#64748b" font-size="10" text-anchor="middle">' + escapeHtml(label) + '</text>';
      }).join("");

      // Dots for avg score
      var dots = data.map(function(d, i) {
        var x = xPos(i);
        var y = yPos(d.avg_score);
        var c = scoreColor(d.avg_score);
        return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + c + '" stroke="var(--surface)" stroke-width="1.5">' +
          '<title>' + escapeHtml(d.date) + ': avg=' + fmt(d.avg_score, 1) + ', count=' + d.count + ', high%=' + fmt(d.high_ratio * 100, 0) + '%</title>' +
          '</circle>';
      }).join("");

      return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#4ade80" stop-opacity="0.25"/>' +
            '<stop offset="100%" stop-color="#4ade80" stop-opacity="0"/>' +
          '</linearGradient>' +
        '</defs>' +
        gridLines +
        '<path d="' + fillPath + '" fill="url(#scoreGrad)"/>' +
        '<path d="' + ratioPath + '" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>' +
        '<path d="' + scorePath + '" fill="none" stroke="#4ade80" stroke-width="2"/>' +
        dots +
        xLabels +
        '</svg>';
    }

    function renderKpis(data) {
      if (!data || data.length === 0) return "";
      var totalCount = data.reduce(function(s, d) { return s + d.count; }, 0);
      var avgAll = data.reduce(function(s, d) { return s + d.avg_score * d.count; }, 0) / (totalCount || 1);
      var latest = data[data.length - 1] || {};
      var first = data[0] || {};
      var trend = data.length >= 2 ? latest.avg_score - first.avg_score : null;
      var trendHtml = trend !== null
        ? '<span style="color:' + (trend >= 0 ? "var(--good)" : "var(--bad)") + '">' +
            (trend >= 0 ? "+" : "") + fmt(trend, 1) + ' vs start' +
          '</span>'
        : "";
      return '<div class="kpi-row">' +
        '<div class="kpi"><div class="kpi-val" style="color:' + scoreColor(avgAll) + '">' + fmt(avgAll, 1) + '</div><div class="kpi-label">Overall Avg Score</div></div>' +
        '<div class="kpi"><div class="kpi-val">' + totalCount + '</div><div class="kpi-label">Scored Messages</div></div>' +
        '<div class="kpi"><div class="kpi-val" style="color:' + scoreColor(latest.avg_score || 0) + '">' + fmt(latest.avg_score, 1) + '</div><div class="kpi-label">Latest Day Avg ' + trendHtml + '</div></div>' +
        '<div class="kpi"><div class="kpi-val" style="color:var(--accent2)">' + fmt((latest.high_ratio || 0) * 100, 0) + '%</div><div class="kpi-label">Latest High-Quality %</div></div>' +
      '</div>';
    }

    function renderTable(data) {
      if (!data || data.length === 0) return "";
      var rows = data.slice().reverse().slice(0, 30).map(function(d) {
        return '<tr>' +
          '<td>' + escapeHtml(d.date) + '</td>' +
          '<td style="color:' + scoreColor(d.avg_score) + '">' + fmt(d.avg_score, 1) + '</td>' +
          '<td>' + d.count + '</td>' +
          '<td style="color:var(--accent2)">' + fmt(d.high_ratio * 100, 0) + '%</td>' +
        '</tr>';
      }).join("");
      return '<div class="table-wrap"><table>' +
        '<thead><tr><th>Date</th><th>Avg Score</th><th>Scored</th><th>High Quality</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
    }

    function render() {
      var data = state.data || [];
      var chart = buildSvgChart(data);
      var kpis = renderKpis(data);
      var table = renderTable(data);

      document.getElementById("kpis").innerHTML = kpis;
      document.getElementById("chart-area").innerHTML =
        '<div class="chart-wrap">' + chart + '</div>' +
        '<div class="legend">' +
          '<div class="legend-item"><div class="legend-dot" style="background:var(--good)"></div>Avg Score (0–100)</div>' +
          '<div class="legend-item"><div class="legend-dot" style="background:var(--accent2)"></div>High-Quality % (dashed)</div>' +
        '</div>';
      document.getElementById("table-area").innerHTML = table
        ? '<div class="card-title">Recent Days</div>' + table
        : "";
    }

    function load() {
      var url = "/api/growth?range=" + encodeURIComponent(state.range);
      if (state.workspace) url += "&workspace=" + encodeURIComponent(state.workspace);
      document.getElementById("status").textContent = "Loading…";
      api(url).then(function(res) {
        state.data = Array.isArray(res.data) ? res.data : [];
        document.getElementById("status").textContent = state.data.length + " day(s) of data";
        render();
      }).catch(function(err) {
        document.getElementById("status").textContent = "Error: " + err.message;
      });
    }

    function loadWorkspaces() {
      api("/api/workspaces").then(function(res) {
        var ws = Array.isArray(res.workspaces) ? res.workspaces : [];
        var sel = document.getElementById("ws-select");
        ws.forEach(function(w) {
          var opt = document.createElement("option");
          opt.value = w;
          opt.textContent = w || "(default)";
          sel.appendChild(opt);
        });
      }).catch(function() {});
    }

    document.addEventListener("DOMContentLoaded", function() {
      loadWorkspaces();
      load();

      document.getElementById("range-select").addEventListener("change", function() {
        state.range = this.value;
        load();
      });
      document.getElementById("ws-select").addEventListener("change", function() {
        state.workspace = this.value;
        load();
      });
    });
  </script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AssistMem – Skill Growth</title>
  ${styles}
</head>
<body>
  <div class="page-header">
    <a href="/" class="back-link">← Sessions</a>
    <h1>Skill Growth</h1>
    <div class="controls">
      <select id="ws-select"><option value="">All Workspaces</option></select>
      <select id="range-select">
        <option value="7d">Last 7 days</option>
        <option value="30d" selected>Last 30 days</option>
        <option value="90d">Last 90 days</option>
        <option value="all">All time</option>
      </select>
    </div>
  </div>
  <div id="status"></div>
  <div id="kpis"></div>
  <div class="card">
    <div class="card-title">Average Prompt Score Over Time</div>
    <div id="chart-area"></div>
  </div>
  <div class="card" id="table-area"></div>
  ${script}
</body>
</html>`;
}
