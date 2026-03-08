import type { IncomingMessage, ServerResponse } from "http";
import * as db from "../../storage/db.js";

export function getQueryParams(url: string): URLSearchParams {
  try {
    return new URL(url, "http://localhost").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

export const SOURCE_LABELS: Record<string, string> = {
  cursor: "Cursor IDE",
  copilot: "Copilot (VS Code)",
  "cursor-cli": "Cursor CLI",
  "claude-code": "Claude Code",
  codex: "Codex",
  gemini: "Gemini",
};

export const SOURCE_DESCRIPTIONS: Record<db.Source, string> = {
  cursor: "Local SQLite database from Cursor editor sessions.",
  copilot: "Copilot Chat conversation logs from VS Code / JetBrains.",
  "cursor-cli": "Terminal-based Cursor CLI session history.",
  "claude-code": "Anthropic Claude Code project session files.",
  codex: "OpenAI Codex CLI local session files.",
  gemini: "Google Gemini exported conversation files.",
};

export function parseSourceKey(raw: string): db.Source | null {
  if (!Object.prototype.hasOwnProperty.call(SOURCE_LABELS, raw)) return null;
  return raw as db.Source;
}

let runtimeModelApiKey: string | null = null;

export function setRuntimeModelApiKey(key: string | null): void {
  runtimeModelApiKey = key;
}

export function parseIntSafe(value: string | null, fallback: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parseOptInt(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

export function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { error: { code, message } });
}

export async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function resolveModelApiKey(settings: db.ModelSettings, apiKeyFromRequest?: string): string | null {
  if (typeof apiKeyFromRequest === "string" && apiKeyFromRequest.trim()) {
    return apiKeyFromRequest.trim();
  }
  if (runtimeModelApiKey && runtimeModelApiKey.trim()) {
    return runtimeModelApiKey.trim();
  }
  if (typeof settings.api_key === "string" && settings.api_key.trim()) {
    return settings.api_key.trim();
  }
  const keyRef = settings.key_ref.trim();
  if (keyRef.startsWith("env:")) {
    const envName = keyRef.slice(4).trim();
    if (!envName) return null;
    return process.env[envName] ?? null;
  }
  if (!keyRef) return process.env.ASSISTMEM_MODEL_API_KEY ?? process.env.ASSISTANT_MEMORY_MODEL_API_KEY ?? null;
  return null;
}

export async function testModelConnection(
  settings: db.ModelSettings,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  const baseUrl = (settings.base_url || "https://api.openai.com/v1").replace(/\/+$/, "");
  try {
    const resp = await fetch(baseUrl + "/models", {
      method: "GET",
      headers: { Authorization: "Bearer " + apiKey },
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, message: `Provider error ${resp.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, message: "Connection successful" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return { ok: false, message };
  }
}

export function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function parseJsonStringArray(value: string): string[] {
  return parseJsonArray(value).filter((item): item is string => typeof item === "string");
}
