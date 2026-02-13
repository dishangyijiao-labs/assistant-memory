# AssistMem

**Local indexer and keyword search** for chat history from **Cursor IDE**, **Copilot (VS Code)**, **Cursor CLI**, **Claude Code CLI**, **Codex CLI**, and **Gemini CLI**. One SQLite database, FTS5 keyword search, no login.

## Features

- **Ingest** from: Cursor IDE (`state.vscdb`), Copilot in VS Code (`chatSessions/*.json`), Cursor CLI (`~/.cursor/`), Claude Code CLI (`~/.claude/projects/`), Codex CLI (`~/.codex/sessions/`), Gemini CLI (`~/.gemini/tmp/*/chats/`).
- **Single SQLite DB** at `~/.assistmem.db` (or `ASSISTMEM_DB_PATH`).
- **Keyword search** via SQLite FTS5.
- **Local only** — no accounts, no telemetry.

## Install

**Clone (or rename your local folder to `assistmem`):**

```bash
git clone https://github.com/dishangyijiao/assistmem.git
cd assistmem
```

Then install and build:

```bash
npm install
npm run build
```

Optional global link:

```bash
npm link
# then: assistmem index && assistmem search "your query"
```

## Usage

```bash
# Index all sources (Cursor IDE, Copilot, Cursor/Claude Code/Codex/Gemini CLI)
npx assistmem index

# Index only some sources
npx assistmem index --sources cursor,copilot,cursor-cli,claude-code,codex,gemini

# Keyword search
npx assistmem search "authentication"
npx assistmem search "bug fix" --limit 10

# Stats (DB path and counts)
npx assistmem stats

# Web search (browser UI at http://localhost:3000)
npx assistmem serve
npx assistmem serve --port 4000

# Print prompt-quality kit (scorer+rewriter prompt and daily report template)
npx assistmem quality-kit
npx assistmem quality-kit --format json
```

## Database

- **Path:** `~/.assistmem.db` (macOS/Linux) or `%LOCALAPPDATA%\assistmem\assistmem.db` (Windows). Override with `ASSISTMEM_DB_PATH`.
- **Schema:** `sessions` (source, workspace, external_id, timestamps) and `messages` (session_id, role, content, timestamp) with FTS5 on `messages.content`.

## Sources

| Source       | Where data is read from |
|-------------|--------------------------|
| Cursor IDE  | `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb` (macOS) |
| Copilot (VS Code) | `~/Library/Application Support/Code/User/workspaceStorage/*/chatSessions/*.json` (macOS) |
| Cursor CLI  | `~/.cursor/globalStorage/global-state.vscdb`, `~/.cursor/chats/` |
| Claude Code CLI | `~/.claude/projects/*/*.jsonl` |
| Codex CLI   | `~/.codex/sessions/` (JSONL/JSON) |
| Gemini CLI  | `~/.gemini/tmp/<project_hash>/chats/` |

## Naming

The package name **assistmem** is used so the tool is not limited to “IDE” only: it includes Cursor IDE, Copilot (VS Code), and CLI tools (Cursor, Claude Code, Codex, Gemini). 
## License

MIT
