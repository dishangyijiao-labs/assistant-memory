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
