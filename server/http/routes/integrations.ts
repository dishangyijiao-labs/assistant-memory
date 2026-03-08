import type { IncomingMessage, ServerResponse } from "http";
import { MCP_CLIENTS } from "../../integrations/clients.js";
import { getMcpUsageSummary } from "../../mcp/usage.js";
import * as db from "../../storage/db.js";
import { SOURCE_LABELS, SOURCE_DESCRIPTIONS, sendJson } from "../utils/http.js";

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
