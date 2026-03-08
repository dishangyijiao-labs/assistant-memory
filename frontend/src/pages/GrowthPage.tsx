import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { escapeHtml, formatNumber } from "../format";
import Toast, { showToast } from "../components/Toast";
import "../styles/growth.css";

interface GrowthDay {
  date: string;
  avg_score: number;
  count: number;
  high_ratio: number;
}

function fmt(n: number | undefined | null, dec = 0): string {
  return Number(n || 0).toFixed(dec);
}

function scoreColor(v: number): string {
  if (v >= 80) return "var(--gp-good)";
  if (v >= 60) return "var(--gp-neutral)";
  return "var(--gp-bad)";
}

function buildSvgChart(data: GrowthDay[]): string {
  if (!data || data.length === 0) {
    return '<div class="empty">No scores yet. Open a session and click <strong>Score Messages</strong> to start tracking your growth.</div>';
  }

  const PAD_L = 48,
    PAD_R = 20,
    PAD_T = 20,
    PAD_B = 40;
  const W = 800,
    H = 220;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const minScore = 0,
    maxScore = 100;
  const n = data.length;

  function xPos(i: number): number {
    return PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  }
  function yPos(v: number): number {
    return PAD_T + innerH - ((v - minScore) / (maxScore - minScore)) * innerH;
  }

  // Grid lines at 0, 25, 50, 75, 100
  const gridLines = [0, 25, 50, 75, 100]
    .map((v) => {
      const y = yPos(v);
      return (
        '<line x1="' + PAD_L + '" y1="' + y + '" x2="' + (W - PAD_R) + '" y2="' + y + '" stroke="#e1e5ee" stroke-width="1"/>' +
        '<text x="' + (PAD_L - 6) + '" y="' + (y + 4) + '" fill="#6b7280" font-size="11" text-anchor="end">' + v + "</text>"
      );
    })
    .join("");

  // Avg score polyline
  const scorePath =
    "M " +
    data.map((d, i) => xPos(i) + " " + yPos(d.avg_score)).join(" L ");

  // Fill under avg score line
  const fillPath =
    scorePath +
    " L " + xPos(n - 1) + " " + (PAD_T + innerH) +
    " L " + xPos(0) + " " + (PAD_T + innerH) + " Z";

  // High ratio as second line (scaled 0-100)
  const ratioPath =
    "M " +
    data.map((d, i) => xPos(i) + " " + yPos(d.high_ratio * 100)).join(" L ");

  // X-axis labels: show up to 8 evenly spaced labels
  const labelStep = Math.max(1, Math.ceil(n / 8));
  const xLabels = data
    .map((d, i) => {
      if (i % labelStep !== 0 && i !== n - 1) return "";
      const x = xPos(i);
      const label = d.date ? d.date.slice(5) : "";
      return (
        '<text x="' + x + '" y="' + (H - 8) + '" fill="#6b7280" font-size="10" text-anchor="middle">' +
        escapeHtml(label) +
        "</text>"
      );
    })
    .join("");

  // Dots for avg score
  const dots = data
    .map((d, i) => {
      const x = xPos(i);
      const y = yPos(d.avg_score);
      const c = scoreColor(d.avg_score);
      return (
        '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + c + '" stroke="var(--gp-surface)" stroke-width="1.5">' +
        "<title>" +
        escapeHtml(d.date) +
        ": avg=" + fmt(d.avg_score, 1) +
        ", count=" + d.count +
        ", high%=" + fmt(d.high_ratio * 100, 0) + "%" +
        "</title>" +
        "</circle>"
      );
    })
    .join("");

  return (
    '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" xmlns="http://www.w3.org/2000/svg">' +
    "<defs>" +
    '<linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#22c55e" stop-opacity="0.18"/>' +
    '<stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>' +
    "</linearGradient>" +
    "</defs>" +
    gridLines +
    '<path d="' + fillPath + '" fill="url(#scoreGrad)"/>' +
    '<path d="' + ratioPath + '" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7"/>' +
    '<path d="' + scorePath + '" fill="none" stroke="#22c55e" stroke-width="2"/>' +
    dots +
    xLabels +
    "</svg>"
  );
}

function buildKpisHtml(data: GrowthDay[]): string {
  if (!data || data.length === 0) return "";

  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const avgAll =
    data.reduce((s, d) => s + d.avg_score * d.count, 0) / (totalCount || 1);
  const latest = data[data.length - 1];
  const first = data[0];
  const trend =
    data.length >= 2 ? latest.avg_score - first.avg_score : null;
  const trendHtml =
    trend !== null
      ? '<span style="color:' +
        (trend >= 0 ? "var(--gp-good)" : "var(--gp-bad)") +
        '">' +
        (trend >= 0 ? "+" : "") +
        fmt(trend, 1) +
        " vs start</span>"
      : "";

  return (
    '<div class="kpi-row">' +
    '<div class="kpi"><div class="kpi-val" style="color:' + scoreColor(avgAll) + '">' + fmt(avgAll, 1) + '</div><div class="kpi-label">Overall Avg Score</div></div>' +
    '<div class="kpi"><div class="kpi-val">' + formatNumber(totalCount) + '</div><div class="kpi-label">Scored Messages</div></div>' +
    '<div class="kpi"><div class="kpi-val" style="color:' + scoreColor(latest.avg_score || 0) + '">' + fmt(latest.avg_score, 1) + '</div><div class="kpi-label">Latest Day Avg ' + trendHtml + "</div></div>" +
    '<div class="kpi"><div class="kpi-val" style="color:var(--gp-accent2)">' + fmt((latest.high_ratio || 0) * 100, 0) + '%</div><div class="kpi-label">Latest High-Quality %</div></div>' +
    "</div>"
  );
}

function buildTableHtml(data: GrowthDay[]): string {
  if (!data || data.length === 0) return "";

  const rows = data
    .slice()
    .reverse()
    .slice(0, 30)
    .map(
      (d) =>
        "<tr>" +
        "<td>" + escapeHtml(d.date) + "</td>" +
        '<td style="color:' + scoreColor(d.avg_score) + '">' + fmt(d.avg_score, 1) + "</td>" +
        "<td>" + d.count + "</td>" +
        '<td style="color:var(--gp-accent2)">' + fmt(d.high_ratio * 100, 0) + "%</td>" +
        "</tr>"
    )
    .join("");

  return (
    '<div class="table-wrap"><table>' +
    "<thead><tr><th>Date</th><th>Avg Score</th><th>Scored</th><th>High Quality</th></tr></thead>" +
    "<tbody>" + rows + "</tbody>" +
    "</table></div>"
  );
}

export default function GrowthPage() {
  const [range, setRange] = useState("30d");
  const [workspace, setWorkspace] = useState("");
  const [workspaces, setWorkspaces] = useState<{ name: string }[]>([]);
  const [data, setData] = useState<GrowthDay[]>([]);
  const [status, setStatus] = useState("");

  const loadData = useCallback(() => {
    let url = "/api/growth?range=" + encodeURIComponent(range);
    if (workspace) url += "&workspace=" + encodeURIComponent(workspace);
    setStatus("Loading\u2026");
    api<{ data?: GrowthDay[] }>(url)
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : [];
        setData(items);
        setStatus(items.length + " day(s) of data");
      })
      .catch((err) => {
        setStatus("Error: " + (err?.message || "Failed to load"));
        showToast(err?.message || "Failed to load growth data");
      });
  }, [range, workspace]);

  useEffect(() => {
    api<{ workspaces?: { name: string }[] }>("/api/workspaces")
      .then((res) => {
        setWorkspaces(Array.isArray(res.workspaces) ? res.workspaces : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chartHtml =
    '<div class="chart-wrap">' +
    buildSvgChart(data) +
    "</div>" +
    '<div class="legend">' +
    '<div class="legend-item"><div class="legend-dot" style="background:var(--gp-good)"></div>Avg Score (0\u2013100)</div>' +
    '<div class="legend-item"><div class="legend-dot" style="background:var(--gp-accent2)"></div>High-Quality % (dashed)</div>' +
    "</div>";

  const kpisHtml = buildKpisHtml(data);
  const tableHtml = buildTableHtml(data);

  return (
    <div className="growth-page">
      <div className="page-header">
        <Link to="/" className="back-link">
          &larr; Sessions
        </Link>
        <h1>Skill Growth</h1>
        <div className="controls">
          <select
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
          >
            <option value="">All Workspaces</option>
            {workspaces.map((w) => (
              <option key={w.name} value={w.name}>
                {w.name || "(default)"}
              </option>
            ))}
          </select>
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      <div className="status">{status}</div>

      {kpisHtml && (
        <div dangerouslySetInnerHTML={{ __html: kpisHtml }} />
      )}

      <div className="card">
        <div className="card-title">Average Prompt Score Over Time</div>
        <div dangerouslySetInnerHTML={{ __html: chartHtml }} />
      </div>

      {tableHtml && (
        <div className="card">
          <div className="card-title">Recent Days</div>
          <div dangerouslySetInnerHTML={{ __html: tableHtml }} />
        </div>
      )}

      <Toast />
    </div>
  );
}
