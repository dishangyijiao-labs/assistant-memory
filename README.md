# AssistMem

**Local indexer and keyword search** for chat history from **Cursor IDE**, **Copilot (VS Code)**, **Cursor CLI**, **Claude Code CLI**, **Codex CLI**, and **Gemini CLI**. One SQLite database, FTS5 keyword search, no login.

## Features

- **Ingest** from: Cursor IDE (`state.vscdb`), Copilot in VS Code (`chatSessions/*.json`), Cursor CLI (`~/.cursor/`), Claude Code CLI (`~/.claude/projects/`), Codex CLI (`~/.codex/sessions/`), Gemini CLI (`~/.gemini/tmp/*/chats/`).
- **Single SQLite DB** at `~/.assistmem.db` (or `ASSISTMEM_DB_PATH`).
- **Keyword search** via SQLite FTS5.
- **React + Vite SPA** frontend with session browsing, insights reports, and skill growth tracking.
- **Tauri desktop app** for macOS (Apple Silicon).
- **Local only** — no accounts, no telemetry.

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

Optional global link:

```bash
npm link
# then: assistmem index && assistmem search "your query"
```

## Usage

### CLI

```bash
# Index all sources
npx assistmem index

# Index only some sources
npx assistmem index --sources cursor,copilot,cursor-cli,claude-code,codex,gemini

# Keyword search
npx assistmem search "authentication"
npx assistmem search "bug fix" --limit 10

# Stats (DB path and counts)
npx assistmem stats

# Print prompt-quality kit
npx assistmem quality-kit
npx assistmem quality-kit --format json

# Generate daily quality report
npx assistmem quality-report
npx assistmem quality-report --days 7 --limit 10 -o report.md

# Eval stats
npx assistmem eval-report
npx assistmem eval-report --days 30
```

### Web UI

```bash
npx assistmem serve
# Open http://localhost:3939

npx assistmem serve --port 4000
```

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
├── server/                     # Backend (TypeScript → dist/)
│   ├── cli.ts                  # CLI entry point
│   ├── index.ts                # Main entry
│   ├── ingest/                 # Source ingestors (Cursor, Copilot, Claude Code, etc.)
│   ├── insights/               # Insights generation, LLM client, quality analysis
│   ├── storage/                # SQLite database, queries, schema
│   └── http/                   # HTTP server layer
│       ├── server.ts           # Server entry point
│       ├── handler.ts          # Request routing and dispatch
│       ├── middleware/         # CORS, SPA static file serving
│       ├── routes/             # Route handlers (ingest, sessions, settings, insights, quality)
│       ├── services/           # Business logic (decoupled from HTTP)
│       └── utils/              # Request parsing, response helpers
├── frontend/                   # Frontend (React 19 + Vite 7 SPA)
│   ├── index.html              # SPA entry point
│   ├── vite.config.ts          # Vite configuration
│   ├── tsconfig.json           # Frontend TypeScript config
│   └── src/
│       ├── main.tsx            # React entry point
│       ├── App.tsx             # Router and page layout
│       ├── api.ts              # API client
│       ├── pages/              # Page components
│       ├── components/         # Reusable components
│       └── styles/             # CSS (one file per page + global)
├── src-tauri/                  # Tauri desktop wrapper (Rust)
│   └── splash/                 # Boot/loading page shown while backend starts
├── tests/                      # Test suite (523 tests)
│   ├── cli/                    # CLI command tests
│   ├── http/                   # HTTP endpoint tests
│   ├── ingest/                 # Source ingestion tests
│   ├── storage/                # Database and query tests
│   └── insights/               # Quality analysis and report tests
├── scripts/                    # Build helper scripts
└── dist/                       # Compiled backend output (generated)
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

During development, Vite proxies API requests to the backend:

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

## Prompt Quality Analysis

1. Run `npx assistmem serve` and open http://localhost:3939
2. Go to **Settings** → enable **External model**, configure API key and model
3. Select a session → click **Analyze** to open session detail
4. Click **Analyze quality** to score each user question and get rewrites
5. Use **Copy** on rewrite chips (Short / Engineering / Exploratory) to improve prompts

Quality analysis uses **RAG**: similar high-quality questions from your history are retrieved via FTS5 and injected as few-shot examples into the LLM context for more targeted feedback.

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
