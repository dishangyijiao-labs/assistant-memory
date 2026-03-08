# AssistMem Desktop (macOS)

Native Mac desktop client built with Tauri 2, embedding the React SPA frontend and local Node backend.

## Prerequisites

- **Node.js** >= 24 (required for built-in `node:sqlite`)
- **Rust** ([rustup](https://rustup.rs/))
- **Xcode Command Line Tools**: `xcode-select --install`

## Architecture

The desktop app bundles three components:

1. **Node.js binary** — embedded in `resources/bundled-node/`
2. **Backend** — compiled TypeScript in `resources/dist/`, serves REST API on localhost
3. **Frontend** — Vite-built React SPA in `resources/web-dist/`, served as static files by the backend

Tauri launches the Node backend, then opens a webview pointing to `http://127.0.0.1:<port>/`.

### Build artifacts

| Artifact | Source | Output | Consumed by |
|----------|--------|--------|-------------|
| Backend JS | `server/` | `dist/` | `resources/dist/` (Tauri bundle) |
| Frontend SPA | `frontend/` | `frontend/dist/` | `resources/web-dist/` (Tauri bundle) |
| Node binary | Downloaded | `resources/bundled-node/node` | Tauri sidecar |

## Development

```bash
npm run mac
```

This builds the backend + frontend, copies resources, and launches the Tauri dev window.

**After changing icons**: Run `npm run desktop:clean` first, then `npm run mac`. Tauri caches the build; a clean build picks up new icons.

Or step by step:

```bash
npm run build                    # Compile backend + frontend
npm run desktop:prepare          # Copy dist + frontend/dist to Tauri resources
npm run desktop:dev              # Start Tauri dev mode
```

In dev mode:

1. Local backend starts: `node dist/index.js serve --port 3939`
2. Tauri window opens and navigates to http://127.0.0.1:3939/

## Production build (.app)

```bash
npm run mac:build
```

Output: `src-tauri/target/release/bundle/macos/AssistMem.app`

## Beta release (Mac Apple Silicon)

On **Apple Silicon (M1/M2/M3/M4) Mac**, build `.app` and `.dmg`:

```bash
npm run mac:release
```

- **Target**: `aarch64-apple-darwin` (Apple Silicon only)
- **CI** (see [Actions](https://github.com/dishangyijiao/assistmem/actions)):
  - **Push to main**: Builds DMG (artifact) and syncs repo About (description, topics) from `package.json`.
  - **Push tag `v*`** (e.g. `v0.1.0-beta.1`): Creates a GitHub Release with DMG attached. Use `beta`/`alpha`/`rc` in the tag for prerelease.
- **Output**: `src-tauri/target/release/bundle/macos/`
  - `AssistMem.app` — Run directly or distribute
  - `AssistMem_<version>_aarch64.dmg` — Installer; user drags app to Applications
- **Unsigned**: Beta uses `--no-sign`. User must right-click → Open on first launch to bypass Gatekeeper.

## Web-only (no desktop window)

```bash
npm run build
npx assistmem serve --port 3939
# Open http://localhost:3939 in browser
```

## Build scripts

| Script | Description |
|--------|------------|
| `npm run mac` | Full dev build + launch |
| `npm run mac:build` | Production .app |
| `npm run mac:release` | Production .app + .dmg (Apple Silicon) |
| `npm run desktop:prepare` | Copy backend dist, frontend dist, Node binary to Tauri resources |
| `npm run desktop:dev` | Start Tauri dev mode |
| `npm run desktop:check` | Cargo check (verify Rust compiles) |
| `npm run desktop:clean` | Cargo clean (clear Tauri build cache) |

## Troubleshooting

- **Build fails**: Ensure `npm run build` succeeds first; check that both `dist/` and `frontend/dist/` exist
- **Blank page / "Not Found"**: Verify `frontend/dist/index.html` exists and `src-tauri/resources/web-dist/` was populated by `desktop:prepare`
- **Port in use**: Default 3939; set `ASSISTMEM_DESKTOP_PORT=4000` to use a different port
- **Rust not installed**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
