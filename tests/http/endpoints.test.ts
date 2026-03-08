import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "http";
import { createHandler } from "../../server/http/server.js";
import { useTempDb } from "../helpers.js";
import { updateSourceSettings } from "../../server/storage/queries/settings.js";
import { SOURCES } from "../../server/storage/types.js";

function startTestServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const handler = createHandler();
    const server = createServer(handler);
    // Listen on port 0 = OS picks random available port
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Unexpected address format"));
        return;
      }
      resolve({ server, port: addr.port });
    });
    server.on("error", reject);
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function fetchJson(port: number, path: string, options?: RequestInit) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, options);
  const body = await res.json();
  return { status: res.status, body };
}

async function fetchText(port: number, path: string) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const text = await res.text();
  return { status: res.status, text, contentType: res.headers.get("content-type") ?? "" };
}

describe("serve command HTTP endpoints", () => {
  let server: Server;
  let port: number;
  let cleanup: () => void;

  beforeEach(async () => {
    ({ cleanup } = useTempDb());
    const started = await startTestServer();
    server = started.server;
    port = started.port;
  });

  afterEach(async () => {
    await stopServer(server);
    cleanup();
  });

  describe("GET /api/stats", () => {
    it("returns stats with zero sessions and messages for empty DB", async () => {
      const { status, body } = await fetchJson(port, "/api/stats");
      assert.equal(status, 200);
      assert.equal(body.sessions, 0);
      assert.equal(body.messages, 0);
      assert.ok(typeof body.dbPath === "string");
    });
  });

  describe("GET /api/search", () => {
    it("returns empty results for empty DB", async () => {
      const { status, body } = await fetchJson(port, "/api/search?q=hello");
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.results));
      assert.equal(body.results.length, 0);
    });

    it("handles missing query parameter", async () => {
      const { status, body } = await fetchJson(port, "/api/search");
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.results));
    });
  });

  describe("GET /api/sessions", () => {
    it("returns empty session list for empty DB", async () => {
      const { status, body } = await fetchJson(port, "/api/sessions");
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.sessions));
      assert.equal(body.sessions.length, 0);
    });
  });

  describe("GET /api/session", () => {
    it("returns 400 for missing session_id", async () => {
      const { status, body } = await fetchJson(port, "/api/session");
      assert.equal(status, 400);
      assert.equal(body.error.code, "INVALID_ARGUMENT");
    });

    it("returns 404 for non-existent session", async () => {
      const { status, body } = await fetchJson(port, "/api/session?session_id=99999");
      assert.equal(status, 404);
      assert.equal(body.error.code, "NOT_FOUND");
    });
  });

  describe("GET /api/workspaces", () => {
    it("returns empty workspaces list for empty DB", async () => {
      const { status, body } = await fetchJson(port, "/api/workspaces");
      assert.equal(status, 200);
      assert.ok(Array.isArray(body.workspaces));
    });
  });

  describe("GET /api/settings/sources", () => {
    it("returns source settings with summary", async () => {
      const { status, body } = await fetchJson(port, "/api/settings/sources");
      assert.equal(status, 200);
      assert.ok(body.summary);
      assert.ok(Array.isArray(body.sources));
      assert.ok(typeof body.db_path === "string");
    });
  });

  describe("GET /api/settings/model", () => {
    it("returns model settings", async () => {
      const { status, body } = await fetchJson(port, "/api/settings/model");
      assert.equal(status, 200);
      assert.ok(body.settings);
      assert.equal(typeof body.has_api_key, "boolean");
    });
  });

  describe("HTML pages", () => {
    it("serves search page at /", async () => {
      const { status, contentType } = await fetchText(port, "/");
      assert.equal(status, 200);
      assert.ok(contentType.includes("text/html"));
    });

    it("serves session page at /session", async () => {
      const { status, contentType } = await fetchText(port, "/session");
      assert.equal(status, 200);
      assert.ok(contentType.includes("text/html"));
    });

    it("serves settings page at /settings", async () => {
      const { status, contentType } = await fetchText(port, "/settings");
      assert.equal(status, 200);
      assert.ok(contentType.includes("text/html"));
    });
  });

  describe("error handling", () => {
    it("returns 404 for unknown path", async () => {
      const { status } = await fetchText(port, "/api/nonexistent");
      assert.equal(status, 404);
    });

    it("returns 405 for non-GET on unknown paths", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/nonexistent`, { method: "POST" });
      assert.equal(res.status, 405);
    });

    it("handles CORS preflight (OPTIONS)", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/stats`, {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3939" },
      });
      assert.equal(res.status, 204);
    });

    it("sets CORS headers for allowed origins", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/stats`, {
        headers: { Origin: "http://localhost:3939" },
      });
      assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:3939");
    });

    it("does not set CORS headers for disallowed origins", async () => {
      const res = await fetch(`http://127.0.0.1:${port}/api/stats`, {
        headers: { Origin: "http://evil.com" },
      });
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    });
  });

  describe("POST endpoints", () => {
    it("POST /api/index returns 400 when all sources are disabled", async () => {
      for (const source of SOURCES) {
        updateSourceSettings(source, { enabled: false });
      }
      const { status, body } = await fetchJson(port, "/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "NO_ENABLED_SOURCE");
    });

    it("POST /api/index runs ingest and returns result when sources are enabled", async () => {
      const { status, body } = await fetchJson(port, "/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(status, 200);
      assert.ok(typeof body.sessions === "number");
      assert.ok(typeof body.messages === "number");
      assert.ok(Array.isArray(body.sources));
    });
  });
});
