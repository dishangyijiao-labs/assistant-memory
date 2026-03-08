import { escapeHtml } from "../../format";
import type { Candidate, ModelSettings, Report } from "./types";

export function safeText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function firstSentence(text: unknown): string {
  const s = safeText(text).trim();
  if (!s) return "";
  const idx = s.search(/[。.!?;；]/);
  return idx > 0 ? s.slice(0, idx + 1) : s;
}

export function sessionDisplayName(row: Candidate): string {
  if (row.preview) {
    const preview = safeText(row.preview.trim());
    return preview.length > 60 ? preview.substring(0, 60) + "\u2026" : preview;
  }
  const w = safeText(row.workspace || "");
  if (w) {
    const parts = w.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return safeText(row.external_id || "Session " + row.id);
}

export function normalizeModelSettings(settings: Partial<ModelSettings> | null): ModelSettings {
  const s = settings || {};
  return {
    mode_default: s.mode_default === "agent" || s.mode_default === "external" ? s.mode_default : "local",
    external_enabled: !!s.external_enabled,
    provider: safeText(s.provider) || "openai-compatible",
    base_url: safeText(s.base_url) || "https://api.openai.com/v1",
    model_name: safeText(s.model_name),
    api_key: safeText(s.api_key),
  };
}

export function codeBlockHtml(text: string): string {
  return '<div class="code-block">' + escapeHtml(text || "") + '<button class="copy-btn" type="button" title="Copy">\u29C9</button></div>';
}

export function scoreLevel(report: Report) {
  const scores = report?.scores || {};
  const eff = Number(scores.efficiency || 0);
  const sta = Number(scores.stability || 0);
  const dec = Number(scores.decision_clarity || 0);
  const avg = (eff + sta + dec) / 3;
  if (avg >= 80) return { label: "Positive", cls: "decision-positive", avg };
  if (avg >= 65) return { label: "Neutral", cls: "decision-neutral", avg };
  return { label: "Negative", cls: "decision-negative", avg };
}

export function confidenceLevel(report: Report) {
  const messages = Number(report?.message_count || 0);
  const sessions = Number(report?.session_count || 0);
  if (messages >= 120 && sessions >= 8) return { label: "High", cls: "confidence-high" };
  if (messages >= 40 && sessions >= 3) return { label: "Medium", cls: "confidence-medium" };
  return { label: "Low", cls: "confidence-low" };
}

export function sampleWarning(report: Report): boolean {
  const messages = Number(report?.message_count || 0);
  const sessions = Number(report?.session_count || 0);
  return messages < 20 || sessions < 3;
}
