export interface McpClientInfo {
  id: string;
  name: string;
  description: string;
  supported: boolean;
  configSnippet?: string;
  detectHint?: string;
}

export const MCP_CLIENTS: McpClientInfo[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic's CLI for Claude",
    supported: true,
    configSnippet: JSON.stringify(
      {
        mcpServers: {
          assistmem: {
            command: "npx",
            args: ["assistmem", "mcp", "--client", "claude-code"],
          },
        },
      },
      null,
      2,
    ),
    detectHint: "Use --client claude-code or set CLAUDE_CODE env var",
  },
  {
    id: "cursor",
    name: "Cursor",
    description: "AI-powered code editor",
    supported: true,
    configSnippet: JSON.stringify(
      {
        mcpServers: {
          assistmem: {
            command: "npx",
            args: ["assistmem", "mcp", "--client", "cursor"],
          },
        },
      },
      null,
      2,
    ),
    detectHint: "Use --client cursor",
  },
  {
    id: "other",
    name: "Other MCP Clients",
    description: "Any MCP-compatible client",
    supported: true,
    configSnippet: "npx assistmem mcp --client <client-name>",
    detectHint: "Pass --client flag with your client name",
  },
];
