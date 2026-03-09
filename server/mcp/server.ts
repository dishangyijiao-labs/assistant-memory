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

  const server = new McpServer(
    { name: "assistmem", version: "0.1.0" },
    {
      instructions: [
        "You have access to the user's complete local AI chat history across multiple tools (Cursor, Claude Code, Codex, Gemini, Copilot, and more).",
        "When the user mentions past conversations, previous discussions, prior work, or wants to recall something — always call get_relevant_context first.",
        "This searches a local database that is separate from your own memory, and contains conversations from other AI assistants the user has used.",
      ].join(" "),
    },
  );

  server.tool(
    "get_relevant_context",
    "Search the user's local chat history across ALL AI tools (Cursor, Claude Code, Codex, Gemini, Copilot) — not just this conversation. Use this whenever the user asks about past conversations, previous discussions, what they worked on before, or wants to recall something they discussed with any AI assistant.",
    {
      query: z.string().describe("Keywords to search for in past AI conversations"),
      workspaceHint: z
        .string()
        .optional()
        .describe("Optional workspace/project path to boost relevance"),
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
