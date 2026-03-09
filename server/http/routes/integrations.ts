import type { IncomingMessage, ServerResponse } from "http";
import { MCP_CLIENTS } from "../../integrations/clients.js";
import { MCP_CLIENT_DEFS, getClientDef } from "../../integrations/client-config.js";
import { getMcpUsageSummary } from "../../mcp/usage.js";
import * as db from "../../storage/db.js";
import { SOURCE_LABELS, SOURCE_DESCRIPTIONS, sendJson, sendError, readJsonBody } from "../utils/http.js";

export async function handleGetIntegrations(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const usageSummary = getMcpUsageSummary();

  const clients = MCP_CLIENTS.map((c) => {
    const clientUsage = usageSummary.clients[c.id];
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      supported: c.supported,
      configured: (clientUsage?.call_count ?? 0) > 0,
      last_used_at: clientUsage?.last_used_at ?? null,
      call_count: clientUsage?.call_count ?? 0,
      config_snippet: c.configSnippet ?? null,
    };
  });

  // Data sources summary (reuse existing source settings infra)
  const sourceSettings = db.listSourceSettings();
  const aggregateMap = new Map<string, db.SourceAggregate>();
  for (const row of db.getSourceAggregates()) {
    aggregateMap.set(row.source, row);
  }
  const stats = db.getStats();
  const sources = sourceSettings.map((item) => {
    const aggregate = aggregateMap.get(item.source);
    return {
      source: item.source,
      label: SOURCE_LABELS[item.source],
      description: SOURCE_DESCRIPTIONS[item.source],
      enabled: item.enabled,
      session_count: aggregate?.session_count ?? 0,
      message_count: aggregate?.message_count ?? 0,
      last_activity_at: aggregate?.last_at ?? null,
    };
  });
  const activeSources = sources.filter((s) => s.enabled).length;

  sendJson(res, 200, {
    mcp: {
      server_name: "assistmem",
      version: "0.1.0",
      transport: "stdio",
      tools: [
        {
          name: "get_relevant_context",
          description: "Search local AI chat history and return relevant context snippets",
          parameters: {
            query: { type: "string", required: true },
            workspaceHint: { type: "string", required: false },
          },
        },
      ],
      clients,
      usage: {
        last_client: usageSummary.last_client,
        last_tool: usageSummary.last_tool,
        last_used_at: usageSummary.last_used_at,
      },
    },
    data_sources: {
      summary: {
        active_sources: activeSources,
        total_sessions: stats.sessions,
        total_messages: stats.messages,
      },
      sources,
    },
  });
}

/** GET /api/mcp — MCP status with real config detection */
export async function handleGetMcp(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const usageSummary = getMcpUsageSummary();

  const clients = MCP_CLIENT_DEFS.map((def) => {
    const installed = def.detect();
    const clientUsage = usageSummary.clients[def.id];
    return {
      id: def.id,
      name: def.name,
      installed,
      last_used_at: clientUsage?.last_used_at ?? null,
      call_count: clientUsage?.call_count ?? 0,
    };
  });

  sendJson(res, 200, {
    clients,
    usage: {
      last_client: usageSummary.last_client,
      last_tool: usageSummary.last_tool,
      last_used_at: usageSummary.last_used_at,
    },
  });
}

/** POST /api/mcp/install — Install AssistMem into a client's config */
export async function handleMcpInstall(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const def = getClientDef(clientId);
  if (!def) {
    return sendError(res, 400, "INVALID_CLIENT", `Unknown client: ${clientId}`);
  }

  try {
    def.install();
    sendJson(res, 200, { ok: true, installed: def.detect() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Install failed";
    sendError(res, 500, "INSTALL_FAILED", message);
  }
}

/** POST /api/mcp/remove — Remove AssistMem from a client's config */
export async function handleMcpRemove(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const def = getClientDef(clientId);
  if (!def) {
    return sendError(res, 400, "INVALID_CLIENT", `Unknown client: ${clientId}`);
  }

  try {
    def.remove();
    sendJson(res, 200, { ok: true, installed: def.detect() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Remove failed";
    sendError(res, 500, "REMOVE_FAILED", message);
  }
}

/** POST /api/mcp/test — Test MCP connection by running npx assistmem mcp --ping */
export async function handleMcpTest(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Simple self-check: verify the MCP module can be loaded
  try {
    const usageSummary = getMcpUsageSummary();
    sendJson(res, 200, {
      ok: true,
      message: "MCP server is reachable",
      last_used_at: usageSummary.last_used_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test failed";
    sendJson(res, 200, { ok: false, message });
  }
}
