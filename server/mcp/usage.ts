import { getDb } from "../storage/db-core.js";
import { setSetting } from "../storage/queries/settings.js";

export interface McpClientUsage {
  last_used_at: number | null;
  call_count: number;
}

export interface McpUsageSummary {
  last_client: string | null;
  last_tool: string | null;
  last_used_at: number | null;
  clients: Record<string, McpClientUsage>;
}

function getSettingRaw(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function logMcpToolUsage(clientId: string, toolName: string): void {
  const now = Date.now();
  setSetting("mcp.last_client", clientId);
  setSetting("mcp.last_tool", toolName);
  setSetting("mcp.last_used_at", String(now));
  setSetting(`mcp.clients.${clientId}.last_used_at`, String(now));

  const countRaw = getSettingRaw(`mcp.clients.${clientId}.call_count`);
  const count = countRaw ? parseInt(countRaw, 10) || 0 : 0;
  setSetting(`mcp.clients.${clientId}.call_count`, String(count + 1));
}

export function getMcpUsageSummary(): McpUsageSummary {
  const lastClient = getSettingRaw("mcp.last_client");
  const lastTool = getSettingRaw("mcp.last_tool");
  const lastUsedRaw = getSettingRaw("mcp.last_used_at");
  const lastUsedAt = lastUsedRaw ? parseInt(lastUsedRaw, 10) || null : null;

  // Collect per-client usage from app_settings
  const rows = getDb()
    .prepare("SELECT key, value FROM app_settings WHERE key LIKE 'mcp.clients.%'")
    .all() as Array<{ key: string; value: string }>;

  const clients: Record<string, McpClientUsage> = {};
  for (const row of rows) {
    // key format: mcp.clients.<clientId>.<field>
    const parts = row.key.split(".");
    if (parts.length !== 4) continue;
    const cid = parts[2];
    const field = parts[3];
    if (!clients[cid]) {
      clients[cid] = { last_used_at: null, call_count: 0 };
    }
    if (field === "last_used_at") {
      clients[cid].last_used_at = parseInt(row.value, 10) || null;
    } else if (field === "call_count") {
      clients[cid].call_count = parseInt(row.value, 10) || 0;
    }
  }

  return { last_client: lastClient, last_tool: lastTool, last_used_at: lastUsedAt, clients };
}
