# AssistMem

[English](README.md)

索引本地 AI 聊天记录，通过 MCP 提供给任意 AI 助手 — 让 Claude、Codex、Cursor 等工具能够回忆你之前的对话。

## 功能特性

- **统一搜索** — 在一个界面中检索所有 AI 工具的聊天记录。
- **完全本地** — 数据不离开你的电脑，无需账号，无遥测。
- **MCP 集成** — AI 助手通过 Model Context Protocol 自动检索历史对话作为上下文。
- **全文检索** — 基于 SQLite FTS5 的高性能搜索。

## 支持的数据源

| 来源 | 数据读取路径 |
|------|------------|
| Cursor IDE | `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb` (macOS) |
| Copilot (VS Code) | `~/Library/Application Support/Code/User/workspaceStorage/*/chatSessions/*.json` (macOS) |
| Cursor CLI | `~/.cursor/globalStorage/global-state.vscdb`、`~/.cursor/chats/` |
| Claude Code | `~/.claude/projects/*/*.jsonl` |
| Codex CLI | `~/.codex/sessions/` (JSONL/JSON) |
| Gemini CLI | `~/.gemini/tmp/<project_hash>/chats/` |

## 安装

从 [Releases](https://github.com/dishangyijiao/assistmem/releases) 页面下载最新的 `.dmg` 文件，打开后将 AssistMem 拖入应用程序文件夹。

## MCP 集成

AssistMem 提供 MCP（Model Context Protocol）服务，让 AI 助手在对话时自动检索你的历史聊天记录作为上下文。

**Claude Desktop** 和 **Codex** 可在应用内直接安装 MCP 服务。

其他支持 MCP 的客户端（如 Cursor），需手动添加配置：

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

## 数据库

- **路径：** `~/.assistmem.db`（macOS/Linux）或 `%LOCALAPPDATA%\assistmem\assistmem.db`（Windows），可通过 `ASSISTMEM_DB_PATH` 环境变量自定义。
- **结构：** `sessions` 和 `messages` 表，消息内容建有 FTS5 全文索引。

## 许可证

MIT — 详见 [LICENSE](LICENSE)。
