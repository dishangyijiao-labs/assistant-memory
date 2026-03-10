# AssistMem

[中文文档](README_zh.md)

Index your local AI chat history and make it available to any AI assistant via MCP — so Claude, Codex, Cursor and others can recall what you've discussed before.

## Features

- **Unified search** — Query all your AI chat history from one interface, regardless of which tool you used.
- **Local-only** — All data stays on your machine. No accounts, no telemetry, no cloud.
- **MCP integration** — Let your AI assistants query your past conversations for context via the Model Context Protocol.
- **SQLite FTS5** — Fast full-text search powered by SQLite.

## Supported Sources

| Source | Where data is read from |
|--------|------------------------|
| Cursor IDE | `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb` (macOS) |
| Copilot (VS Code) | `~/Library/Application Support/Code/User/workspaceStorage/*/chatSessions/*.json` (macOS) |
| Cursor CLI | `~/.cursor/globalStorage/global-state.vscdb`, `~/.cursor/chats/` |
| Claude Code | `~/.claude/projects/*/*.jsonl` |
| Codex CLI | `~/.codex/sessions/` (JSONL/JSON) |
| Gemini CLI | `~/.gemini/tmp/<project_hash>/chats/` |

## Install

Download the latest `.dmg` file from the [Releases](https://github.com/dishangyijiao/assistmem/releases) page, open it and drag AssistMem to your Applications folder.

## MCP Integration

AssistMem provides an MCP (Model Context Protocol) server, allowing AI assistants to query your local chat history for context. This closes the loop — your AI assistants can recall what you've discussed in other tools.

**Claude Code** and **Codex** can install the MCP server directly:

For other MCP-compatible clients (e.g. Cursor), add to your MCP settings:

```json
{
  "mcpServers": {
    "assistmem": {
      "command": "npx",
      "args": ["assistmem", "mcp", "--client", "<client-name>"]
    }
  }
}
```

## Database

- **Path:** `~/.assistmem.db` (macOS/Linux) or `%LOCALAPPDATA%\assistmem\assistmem.db` (Windows). Override with `ASSISTMEM_DB_PATH`.
- **Schema:** `sessions` and `messages` tables with FTS5 full-text index on message content.

## License

MIT — see [LICENSE](LICENSE).
