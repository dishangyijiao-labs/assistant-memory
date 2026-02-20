# AssistMem Desktop (macOS)

Native Mac desktop client built with Tauri 2, embedding the Web UI and local Node backend.

## Prerequisites

- **Node.js** >= 18
- **Rust** ([rustup](https://rustup.rs/))
- **Xcode Command Line Tools**: `xcode-select --install`

## Development

```bash
npm run mac
```

This builds, copies resources, and launches the Tauri dev window.

**After changing icons**: Run `npm run desktop:clean` first, then `npm run mac`. Tauri caches the build; a clean build picks up new icons.

Or step by step:

```bash
npm run build                    # Compile TypeScript
npm run desktop:prepare          # Copy dist to Tauri resources
npm run desktop:dev             # Start Tauri dev mode
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

On **Apple Silicon (M1/M2/M3) Mac**, build `.app` and `.dmg`:

```bash
npm run mac:release
```

- **Target**: `aarch64-apple-darwin` (Apple Silicon only)
- **CI** (see [Actions](https://github.com/dishangyijiao/assistmem/actions)):
  - **Push to main**: Builds DMG (artifact) and syncs repo About (description, topics) from `package.json`.
  - **Push tag `v*`** (e.g. `v0.1.0-beta.1`): Creates a GitHub Release with DMG attached. Use `beta`/`alpha`/`rc` in the tag for prerelease.
- **Output**: `src-tauri/target/release/bundle/macos/`
  - `AssistMem.app` — Run directly or distribute
  - `AssistMem_0.1.0-beta.1_aarch64.dmg` — Installer; user drags app to Applications
- **Unsigned**: Beta uses `--no-sign`. User must right-click → Open on first launch to bypass Gatekeeper.

## Web-only (no desktop window)

```bash
npm run build
npx assistmem serve --port 3939
# Open http://localhost:3939 in browser
```

## Troubleshooting

- **Build fails**: Ensure `npm run build` succeeds; verify `dist/` contains `storage/queries/quality.js`
- **Port in use**: Default 3939; set `ASSISTMEM_DESKTOP_PORT=4000` to use a different port
- **Rust not installed**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
