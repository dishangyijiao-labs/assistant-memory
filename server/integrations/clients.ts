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
    id: "claude-desktop",
    name: "Claude Desktop",
    description: "Anthropic's desktop app for Claude",
    supported: true,
    configSnippet: JSON.stringify(
      {
        mcpServers: {
          assistmem: {
            command: "npx",
            args: ["assistmem", "mcp", "--client", "claude-desktop"],
          },
        },
      },
      null,
      2,
    ),
  },
  {
    id: "codex",
    name: "Codex",
    description: "OpenAI Codex CLI",
    supported: true,
    configSnippet: [
      "[mcp_servers.assistmem]",
      'command = "npx"',
      'args = ["assistmem", "mcp", "--client", "codex"]',
    ].join("\n"),
  },
];
