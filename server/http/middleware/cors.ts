import type { IncomingMessage, ServerResponse } from "http";

const ALLOWED_ORIGINS = [
  "http://localhost:3939",
  "http://127.0.0.1:3939",
  "tauri://localhost",
];

export function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

export function handlePreflight(req: IncomingMessage, res: ServerResponse): boolean {
  if ((req.method ?? "GET") === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}
