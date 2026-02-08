import { spawn } from "node:child_process";
import net from "node:net";

const port = Number.parseInt(process.env.ASSISTANT_MEMORY_DESKTOP_PORT ?? "3939", 10) || 3939;
const host = "127.0.0.1";
const baseUrl = `http://${host}:${port}`;
const healthUrl = `${baseUrl}/api/stats`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isHealthy() {
  try {
    const res = await fetch(healthUrl, { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    return typeof data === "object" && data !== null;
  } catch {
    return false;
  }
}

async function isPortInUse() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1200, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function keepAliveWithExistingBackend() {
  console.log(`[tauri-dev-backend] Reusing backend at ${baseUrl}.`);
  console.log("[tauri-dev-backend] Press Ctrl+C to stop Tauri dev.");
  const interval = setInterval(() => {}, 24 * 60 * 60 * 1000);
  function shutdown() {
    clearInterval(interval);
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function waitForHealth(maxTries = 60, intervalMs = 500) {
  for (let i = 0; i < maxTries; i += 1) {
    if (await isHealthy()) return true;
    await delay(intervalMs);
  }
  return false;
}

function wireChild(child) {
  function killChild() {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.on("SIGINT", killChild);
  process.on("SIGTERM", killChild);
  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(0);
      return;
    }
    process.exit(code ?? 0);
  });
}

async function main() {
  if (await isHealthy()) {
    keepAliveWithExistingBackend();
    return;
  }

  if (await isPortInUse()) {
    console.error(`[tauri-dev-backend] Port ${port} is in use, but ${healthUrl} is not healthy.`);
    console.error(`[tauri-dev-backend] Resolve conflict and retry. Example: lsof -nP -iTCP:${port} -sTCP:LISTEN`);
    process.exit(1);
    return;
  }

  console.log(`[tauri-dev-backend] Starting backend: node dist/index.js serve --port ${port}`);
  const child = spawn("node", ["dist/index.js", "serve", "--port", String(port)], {
    stdio: "inherit",
    env: process.env,
  });
  wireChild(child);

  const ok = await waitForHealth();
  if (!ok) {
    console.error(`[tauri-dev-backend] Backend failed health check at ${healthUrl}`);
    if (!child.killed) child.kill("SIGTERM");
    process.exit(1);
    return;
  }
  console.log(`[tauri-dev-backend] Backend is healthy at ${baseUrl}`);
}

main().catch((err) => {
  console.error("[tauri-dev-backend] Unexpected error:", err);
  process.exit(1);
});
