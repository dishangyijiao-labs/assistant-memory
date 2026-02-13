# AssistMem Desktop (macOS)

本地 Mac 桌面客户端，基于 Tauri 2 构建，内嵌 Web UI 与本地 Node 后端。

## 前置要求

- **Node.js** >= 18
- **Rust**（[rustup](https://rustup.rs/)）
- **Xcode Command Line Tools**：`xcode-select --install`

## 开发模式运行

```bash
# 一键：构建 + 复制资源 + 启动 Tauri 开发窗口
npm run mac
```

或分步执行：

```bash
npm run build                    # 编译 TypeScript
npm run desktop:prepare          # 将 dist 复制到 Tauri 资源目录
npm run desktop:dev              # 启动 Tauri 开发模式
```

开发模式下会：

1. 启动本地后端 `node dist/index.js serve --port 3939`
2. 打开 Tauri 窗口，自动跳转到 http://127.0.0.1:3939/

## 生产构建（打包 .app）

```bash
npm run mac:build
```

产物在 `src-tauri/target/release/`（或 `bundle/macos/` 下的 `.app`）。

## 仅 Web 模式（无桌面窗口）

```bash
npm run build
npx assistmem serve --port 3939
# 浏览器打开 http://localhost:3939
```

## 故障排查

- **构建失败**：确保 `npm run build` 成功，检查 `dist/` 是否包含 `storage/queries/quality.js`
- **端口占用**：默认 3939，可设置 `ASSISTMEM_DESKTOP_PORT=4000` 后重试
- **Rust 未安装**：`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
