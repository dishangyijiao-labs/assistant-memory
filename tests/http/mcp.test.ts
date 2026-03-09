import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { useTempDb } from "../helpers.js";
import { createHandler } from "../../server/http/handler.js";

function request(
  server: http.Server,
  path: string,
  options?: { method?: string; body?: string },
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const method = options?.method ?? "GET";
    const req = http.request(
      { hostname: "127.0.0.1", port: addr.port, path, method, headers: options?.body ? { "Content-Type": "application/json" } : {} },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
          resolve({ status: res.statusCode!, body });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    if (options?.body) req.write(options.body);
    req.end();
  });
}

describe("GET /api/mcp", () => {
  let cleanup: () => void;
  let server: http.Server;

  beforeEach(async () => {
    ({ cleanup } = useTempDb());
    server = http.createServer(createHandler());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it("returns clients array with correct structure", async () => {
    const { status, body } = await request(server, "/api/mcp");
    assert.equal(status, 200);
    assert.ok("clients" in body);
    assert.ok("usage" in body);

    const clients = body.clients as Array<Record<string, unknown>>;
    assert.ok(clients.length >= 2);

    const claudeDesktop = clients.find((c) => c.id === "claude-desktop");
    assert.ok(claudeDesktop);
    assert.equal(typeof claudeDesktop!.installed, "boolean");
    assert.equal(typeof claudeDesktop!.name, "string");

    const codex = clients.find((c) => c.id === "codex");
    assert.ok(codex);
    assert.equal(typeof codex!.installed, "boolean");
  });

  it("returns usage info", async () => {
    const { body } = await request(server, "/api/mcp");
    const usage = body.usage as Record<string, unknown>;
    assert.equal(usage.last_client, null);
    assert.equal(usage.last_tool, null);
    assert.equal(usage.last_used_at, null);
  });
});

describe("POST /api/mcp/test", () => {
  let cleanup: () => void;
  let server: http.Server;

  beforeEach(async () => {
    ({ cleanup } = useTempDb());
    server = http.createServer(createHandler());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it("returns ok on test", async () => {
    const { status, body } = await request(server, "/api/mcp/test", { method: "POST" });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(typeof body.message, "string");
  });
});

describe("POST /api/mcp/install and /api/mcp/remove", () => {
  let cleanup: () => void;
  let server: http.Server;

  beforeEach(async () => {
    ({ cleanup } = useTempDb());
    server = http.createServer(createHandler());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it("returns error for unknown client", async () => {
    const { status, body } = await request(server, "/api/mcp/install", {
      method: "POST",
      body: JSON.stringify({ client_id: "nonexistent" }),
    });
    assert.equal(status, 400);
    assert.ok(body.error);
  });
});
