# AssistMem

Local search tool for chat history from Cursor, Copilot, Claude Code, Codex, and Gemini. Data stays local in one SQLite database.

## Features

- Import chats from local app and CLI data sources.
- Store everything in one SQLite database.
- Search with SQLite FTS5.
- Browse sessions in the web UI.
- Run as CLI, local web app, or macOS desktop app.
- Local only. No account or telemetry.

## Prerequisites

- **Node.js >= 24** (uses the built-in `node:sqlite` module)
- **npm** (included with Node.js)

## Install

```bash
git clone https://github.com/dishangyijiao/assistmem.git
cd assistmem
npm install
npm run build
```

Optional:

```bash
npm link
# then: assistmem index && assistmem search "your query"
```

## Usage

### CLI

```bash
npx assistmem index

npx assistmem index --sources cursor,copilot,cursor-cli,claude-code,codex,gemini

npx assistmem search "authentication"
npx assistmem search "bug fix" --limit 10

npx assistmem stats
```

### Web UI

```bash
npx assistmem serve

npx assistmem serve --port 4000
```

Open `http://localhost:3939` by default.

### MCP Server

AssistMem exposes an MCP (Model Context Protocol) server so AI clients like Claude Code can query your local chat history for context.

```bash
npx assistmem mcp
npx assistmem mcp --client claude-code
```

The `--client` flag identifies which AI client is using the MCP server. This is used for usage tracking visible on the Integrations page. If omitted, the server tries to auto-detect the client from environment variables.

This starts a stdio-based MCP server with one tool:

- **`get_relevant_context`** — Search local chat history and return up to 3 relevant snippets.
  - `query` (string, required): Search query
  - `workspaceHint` (string, optional): Workspace path hint for boosting relevance

#### Claude Code setup

Add to your Claude Code MCP config (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "assistmem": {
      "command": "npx",
      "args": ["assistmem", "mcp", "--client", "claude-code"]
    }
  }
}
```

#### Cursor setup

Add to Cursor's MCP settings:

```json
{
  "mcpServers": {
    "assistmem": {
      "command": "npx",
      "args": ["assistmem", "mcp", "--client", "cursor"]
    }
  }
}
```

### Integrations Page

The web UI includes an **Integrations** page (`/integrations`) that shows:

- **MCP Tools** — the tools exposed by the AssistMem MCP server
- **AI Clients** — supported clients with setup instructions and usage status
  - **Supported**: the client is known to work with AssistMem MCP
  - **Configured**: the client has actually used the MCP server (based on logged calls)
  - **Last used**: when the client last called an MCP tool
- **Data Sources** — summary of ingested chat history sources (details in Advanced Settings)

The Integrations page is accessible from the sidebar on the main search page.

### Desktop App (macOS)

See [DESKTOP.md](DESKTOP.md) for full instructions.

```bash
npm run mac          # development
npm run mac:build    # production .app
npm run mac:release  # .app + .dmg (Apple Silicon)
```

## Project Structure

```
assistmem/
├── server/       # TypeScript backend, CLI, HTTP API, storage, ingest
├── frontend/     # React + Vite web UI
├── src-tauri/    # Tauri desktop wrapper
├── tests/        # Test suite
├── scripts/      # Build helpers
└── dist/         # Generated backend output
```

## Development

### Build

```bash
npm run build            # Build backend + frontend
npm run build:backend    # Build backend only (TypeScript)
npm run build:frontend   # Build frontend only (Vite)
```

### Quality checks

```bash
npm test                # Run test suite
npm run typecheck       # TypeScript checks (backend + frontend)
npm run lint            # ESLint
npm run format:check    # Prettier check
```

### Frontend development

Vite proxies `/api` requests to the backend during development:

```bash
# Terminal 1: start the backend
npx assistmem serve

# Terminal 2: start Vite dev server (hot reload)
npx vite --config frontend/vite.config.ts
# Open http://localhost:5173
```

### Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 24, TypeScript, `node:sqlite`, FTS5 |
| Frontend | React 19, Vite 7, React Router, TypeScript |
| Desktop | Tauri 2 (Rust) |
| Database | SQLite (single file, `~/.assistmem.db`) |

## Database

- **Path:** `~/.assistmem.db` (macOS/Linux) or `%LOCALAPPDATA%\assistmem\assistmem.db` (Windows). Override with `ASSISTMEM_DB_PATH`.
- **Schema:** `sessions` (source, workspace, external_id, timestamps) and `messages` (session_id, role, content, timestamp) with FTS5 on `messages.content`.

## Sources

| Source | Where data is read from |
|--------|------------------------|
| Cursor IDE | `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb` (macOS) |
| Copilot (VS Code) | `~/Library/Application Support/Code/User/workspaceStorage/*/chatSessions/*.json` (macOS) |
| Cursor CLI | `~/.cursor/globalStorage/global-state.vscdb`, `~/.cursor/chats/` |
| Claude Code CLI | `~/.claude/projects/*/*.jsonl` |
| Codex CLI | `~/.codex/sessions/` (JSONL/JSON) |
| Gemini CLI | `~/.gemini/tmp/<project_hash>/chats/` |

## License

MIT — see [LICENSE](LICENSE).
