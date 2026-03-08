export const SOURCE_LABELS: Record<string, string> = {
  cursor: "Cursor IDE",
  copilot: "Copilot",
  "cursor-cli": "Cursor CLI",
  "claude-code": "Claude Code",
  codex: "Codex",
  gemini: "Gemini",
};

export function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function formatTime(ts: number | null | undefined): string {
  if (!ts) return "Unknown";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "Unknown";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    /* ignore */
  }
  return d.toISOString();
}

export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  const days = Math.floor(hr / 24);
  if (days < 7) return days + "d ago";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(ts));
  } catch {
    /* ignore */
  }
  return formatTime(ts);
}

export function formatNumber(v: number | undefined | null): string {
  return (typeof v === "number" ? v : 0).toLocaleString();
}

export function getTimeGroup(ts: number | null | undefined): string {
  if (!ts) return "Older";
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;
  if (ts >= todayStart) return "Today";
  if (ts >= yesterdayStart) return "Yesterday";
  if (ts >= weekStart) return "This Week";
  return "Older";
}

export function getSessionTitle(session: {
  preview?: string;
  workspace?: string;
  id: number;
}): string {
  if (session.preview) return session.preview.trim();
  const ws = session.workspace || "";
  if (!ws) return "Session #" + session.id;
  const parts = ws
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  const name = parts[parts.length - 1] || "";
  if (!name) return "Session #" + session.id;
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function getDateKey(ts: number | null | undefined): string {
  const d = ts ? new Date(ts) : new Date();
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}

export function formatDateLabel(ts: number | null | undefined): string {
  if (!ts) return "Unknown date";
  const d = new Date(ts);
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayStart = todayStart - 86400000;
  if (ts >= todayStart) return "Today";
  if (ts >= yesterdayStart) return "Yesterday";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    /* ignore */
  }
  return d.toDateString();
}
