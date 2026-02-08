# Tauri Desktop Setup (Prototype)

## Run Dev Shell

```bash
npm run build
npm run desktop:dev
```

Dev mode behavior:
1. Tauri uses `beforeDevCommand` to run `node scripts/tauri-dev-backend.mjs`.
2. If `3939` already has a healthy backend (`/api/stats`), it will reuse it.
3. If `3939` is occupied by a non-backend process, dev startup fails fast with a clear hint.
4. Desktop window opens `http://127.0.0.1:3939`.

## Build Desktop App

```bash
npm run build
npm run desktop:build
```

Release behavior:
1. Desktop starts from `desktop/web/index.html`.
2. Rust setup spawns `node dist/index.js serve --port 3939`.
3. Startup page polls `/api/stats` and redirects to `/`.

## Optional Env Vars

1. `ASSISTANT_MEMORY_DB_PATH`  
   Override SQLite path for backend.
2. `ASSISTANT_MEMORY_DESKTOP_PORT`  
   Override desktop backend port (default `3939`).

## Known Constraint

`cargo check` / `tauri build` may fail if `crates.io` access is slow or blocked. Retry in a stable network environment.
