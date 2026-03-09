import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

export interface McpClientDef {
  id: string;
  name: string;
  configPath: string;
  detect: () => boolean;
  install: () => void;
  remove: () => void;
}

const ASSISTMEM_SERVER_KEY = "assistmem";

// --- Claude Desktop ---

function claudeDesktopConfigPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (platform === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  }
  return join(homedir(), ".config", "claude", "claude_desktop_config.json");
}

function readJsonConfig(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeJsonConfig(path: string, data: Record<string, unknown>): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function claudeDesktopDetect(): boolean {
  const config = readJsonConfig(claudeDesktopConfigPath());
  const servers = config.mcpServers as Record<string, unknown> | undefined;
  return servers != null && ASSISTMEM_SERVER_KEY in servers;
}

function claudeDesktopInstall(): void {
  const configPath = claudeDesktopConfigPath();
  const config = readJsonConfig(configPath);
  if (!config.mcpServers || typeof config.mcpServers !== "object") {
    config.mcpServers = {};
  }
  (config.mcpServers as Record<string, unknown>)[ASSISTMEM_SERVER_KEY] = {
    command: "npx",
    args: ["assistmem", "mcp", "--client", "claude-desktop"],
  };
  writeJsonConfig(configPath, config);
}

function claudeDesktopRemove(): void {
  const configPath = claudeDesktopConfigPath();
  const config = readJsonConfig(configPath);
  const servers = config.mcpServers as Record<string, unknown> | undefined;
  if (servers && ASSISTMEM_SERVER_KEY in servers) {
    delete servers[ASSISTMEM_SERVER_KEY];
    writeJsonConfig(configPath, config);
  }
}

// --- Codex ---

function codexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}

function codexDetect(): boolean {
  const path = codexConfigPath();
  if (!existsSync(path)) return false;
  try {
    const content = readFileSync(path, "utf-8");
    return content.includes(`[mcp_servers.${ASSISTMEM_SERVER_KEY}]`);
  } catch {
    return false;
  }
}

function codexInstall(): void {
  const configPath = codexConfigPath();
  const dir = dirname(configPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let content = "";
  if (existsSync(configPath)) {
    content = readFileSync(configPath, "utf-8");
  }

  if (content.includes(`[mcp_servers.${ASSISTMEM_SERVER_KEY}]`)) {
    return; // already installed
  }

  const section = [
    "",
    `[mcp_servers.${ASSISTMEM_SERVER_KEY}]`,
    `command = "npx"`,
    `args = ["assistmem", "mcp", "--client", "codex"]`,
    "",
  ].join("\n");

  content = content.trimEnd() + "\n" + section;
  writeFileSync(configPath, content, "utf-8");
}

function codexRemove(): void {
  const configPath = codexConfigPath();
  if (!existsSync(configPath)) return;

  let content = readFileSync(configPath, "utf-8");
  const sectionHeader = `[mcp_servers.${ASSISTMEM_SERVER_KEY}]`;
  const idx = content.indexOf(sectionHeader);
  if (idx === -1) return;

  // Find the end of this section (next [section] or EOF)
  const afterHeader = idx + sectionHeader.length;
  const nextSection = content.indexOf("\n[", afterHeader);
  const end = nextSection === -1 ? content.length : nextSection;

  content = content.slice(0, idx).trimEnd() + "\n" + content.slice(end);
  writeFileSync(configPath, content.trimEnd() + "\n", "utf-8");
}

// --- Registry ---

export const MCP_CLIENT_DEFS: McpClientDef[] = [
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    configPath: claudeDesktopConfigPath(),
    detect: claudeDesktopDetect,
    install: claudeDesktopInstall,
    remove: claudeDesktopRemove,
  },
  {
    id: "codex",
    name: "Codex",
    configPath: codexConfigPath(),
    detect: codexDetect,
    install: codexInstall,
    remove: codexRemove,
  },
];

export function getClientDef(clientId: string): McpClientDef | undefined {
  return MCP_CLIENT_DEFS.find((c) => c.id === clientId);
}
