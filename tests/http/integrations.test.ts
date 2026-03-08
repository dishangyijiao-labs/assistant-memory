import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { useTempDb } from "../helpers.js";
import { createHandler } from "../../server/http/handler.js";
import { logMcpToolUsage } from "../../server/mcp/usage.js";

function request(server: http.Server, path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    http.get(`http://127.0.0.1:${addr.port}${path}`, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>;
        resolve({ status: res.statusCode!, body });
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

describe("GET /api/integrations", () => {
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

  it("returns integrations data with correct structure", async () => {
    const { status, body } = await request(server, "/api/integrations");
    assert.equal(status, 200);

    // Top-level keys
    assert.ok("mcp" in body);
    assert.ok("data_sources" in body);

    const mcp = body.mcp as Record<string, unknown>;
    assert.equal(mcp.server_name, "assistmem");
    assert.equal(mcp.version, "0.1.0");
    assert.equal(mcp.transport, "stdio");

    // Tools
    const tools = mcp.tools as Array<Record<string, unknown>>;
    assert.ok(tools.length > 0);
    assert.equal(tools[0].name, "get_relevant_context");

    // Clients
    const clients = mcp.clients as Array<Record<string, unknown>>;
    assert.ok(clients.length > 0);
    const claudeCode = clients.find((c) => c.id === "claude-code");
    assert.ok(claudeCode);
    assert.equal(claudeCode!.supported, true);
    assert.equal(claudeCode!.configured, false);
    assert.equal(typeof claudeCode!.config_snippet, "string");

    // Usage
    const usage = mcp.usage as Record<string, unknown>;
    assert.equal(usage.last_client, null);
    assert.equal(usage.last_tool, null);

    // Data sources
    const ds = body.data_sources as Record<string, unknown>;
    assert.ok("summary" in ds);
    assert.ok("sources" in ds);
  });

  it("reflects MCP usage in integrations response", async () => {
    logMcpToolUsage("claude-code", "get_relevant_context");
    logMcpToolUsage("claude-code", "get_relevant_context");

    const { body } = await request(server, "/api/integrations");
    const mcp = body.mcp as Record<string, unknown>;
    const clients = mcp.clients as Array<Record<string, unknown>>;
    const claudeCode = clients.find((c) => c.id === "claude-code")!;

    assert.equal(claudeCode.configured, true);
    assert.equal(claudeCode.call_count, 2);
    assert.ok(claudeCode.last_used_at !== null);

    const usage = mcp.usage as Record<string, unknown>;
    assert.equal(usage.last_client, "claude-code");
    assert.equal(usage.last_tool, "get_relevant_context");
  });
});
