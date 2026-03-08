import { existsSync, readFileSync, statSync } from "fs";
import { join, extname } from "path";
import type { ServerResponse } from "http";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveSpaRoot(): string | null {
  const candidates = [
    join(import.meta.dirname, "../../frontend/dist"),   // dev: dist/http/middleware/spa.js → frontend/dist
    join(import.meta.dirname, "../../../frontend/dist"), // alternate layout
    join(import.meta.dirname, "../../../web-dist"),      // desktop: resources/dist/http/middleware/ → resources/web-dist
    join(import.meta.dirname, "../../web-dist"),         // desktop fallback
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  return null;
}

let _spaRoot: string | null | undefined;
function getSpaRoot(): string | null {
  if (_spaRoot === undefined) _spaRoot = resolveSpaRoot();
  return _spaRoot;
}

export function serveSpaFile(urlPath: string, res: ServerResponse): boolean {
  const root = getSpaRoot();
  if (!root) return false;

  const safePath = urlPath.replace(/\.\./g, "").replace(/\/+/g, "/");
  const filePath = join(root, safePath === "/" ? "/index.html" : safePath);

  if (!filePath.startsWith(root)) return false;

  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return false;
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const body = readFileSync(filePath);
    const cacheControl = ext === ".html"
      ? "no-cache, no-store, must-revalidate"
      : "public, max-age=31536000, immutable";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": cacheControl });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

export function serveSpaFallback(path: string, res: ServerResponse): boolean {
  if (!path.startsWith("/api/")) {
    return serveSpaFile("/index.html", res);
  }
  return false;
}
