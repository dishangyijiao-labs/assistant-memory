import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getRelevantContext, type ContextSnippet } from "./retrieval.js";
import { logMcpToolUsage } from "./usage.js";

function detectClient(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.CLAUDE_CODE) return "claude-code";
  return "unknown";
}

export async function startMcpServer(clientId?: string): Promise<void> {
  const resolvedClient = detectClient(clientId);

  const server = new McpServer({
    name: "assistmem",
    version: "0.1.0",
  });

  server.tool(
    "get_relevant_context",
    "Search local AI chat history and return relevant context snippets",
    {
      query: z.string().describe("Search query"),
      workspaceHint: z
        .string()
        .optional()
        .describe("Optional workspace path hint for boosting relevance"),
    },
    async ({ query, workspaceHint }): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
      const results: ContextSnippet[] = getRelevantContext(query, workspaceHint);
      logMcpToolUsage(resolvedClient, "get_relevant_context");
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`AssistMem MCP server running on stdio (client: ${resolvedClient})`);
}
