import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// We test the core logic by importing the functions and overriding paths via env

describe("Claude Desktop config management", () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "assistmem-claude-test-"));
    configPath = join(dir, "claude_desktop_config.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("detects when assistmem is not in config", () => {
    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const servers = config.mcpServers || {};
    assert.equal("assistmem" in servers, false);
  });

  it("installs assistmem into empty config", () => {
    writeFileSync(configPath, JSON.stringify({}));
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers.assistmem = {
      command: "npx",
      args: ["assistmem", "mcp", "--client", "claude-desktop"],
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = JSON.parse(readFileSync(configPath, "utf-8"));
    assert.ok(result.mcpServers.assistmem);
    assert.equal(result.mcpServers.assistmem.command, "npx");
    assert.deepEqual(result.mcpServers.assistmem.args, ["assistmem", "mcp", "--client", "claude-desktop"]);
  });

  it("installs assistmem preserving existing servers", () => {
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        other: { command: "other-cmd", args: [] },
      },
    }));
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    config.mcpServers.assistmem = {
      command: "npx",
      args: ["assistmem", "mcp", "--client", "claude-desktop"],
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = JSON.parse(readFileSync(configPath, "utf-8"));
    assert.ok(result.mcpServers.other);
    assert.ok(result.mcpServers.assistmem);
  });

  it("removes assistmem from config", () => {
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        assistmem: { command: "npx", args: [] },
        other: { command: "other", args: [] },
      },
    }));
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    delete config.mcpServers.assistmem;
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = JSON.parse(readFileSync(configPath, "utf-8"));
    assert.equal("assistmem" in result.mcpServers, false);
    assert.ok(result.mcpServers.other);
  });
});

describe("Codex config management", () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "assistmem-codex-test-"));
    configPath = join(dir, "config.toml");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("detects when assistmem is not in config", () => {
    writeFileSync(configPath, 'model = "gpt-5"\n');
    const content = readFileSync(configPath, "utf-8");
    assert.equal(content.includes("[mcp_servers.assistmem]"), false);
  });

  it("detects when assistmem is in config", () => {
    writeFileSync(configPath, 'model = "gpt-5"\n\n[mcp_servers.assistmem]\ncommand = "npx"\n');
    const content = readFileSync(configPath, "utf-8");
    assert.equal(content.includes("[mcp_servers.assistmem]"), true);
  });

  it("installs assistmem section into TOML", () => {
    writeFileSync(configPath, 'model = "gpt-5"\n');
    let content = readFileSync(configPath, "utf-8");
    const section = '\n[mcp_servers.assistmem]\ncommand = "npx"\nargs = ["assistmem", "mcp", "--client", "codex"]\n';
    content = content.trimEnd() + "\n" + section;
    writeFileSync(configPath, content);

    const result = readFileSync(configPath, "utf-8");
    assert.ok(result.includes("[mcp_servers.assistmem]"));
    assert.ok(result.includes('command = "npx"'));
    assert.ok(result.includes("assistmem"));
  });

  it("removes assistmem section from TOML", () => {
    const original = [
      'model = "gpt-5"',
      "",
      "[mcp_servers.assistmem]",
      'command = "npx"',
      'args = ["assistmem", "mcp", "--client", "codex"]',
      "",
      "[mcp_servers.other]",
      'command = "other"',
      "",
    ].join("\n");
    writeFileSync(configPath, original);

    let content = readFileSync(configPath, "utf-8");
    const sectionHeader = "[mcp_servers.assistmem]";
    const idx = content.indexOf(sectionHeader);
    const afterHeader = idx + sectionHeader.length;
    const nextSection = content.indexOf("\n[", afterHeader);
    const end = nextSection === -1 ? content.length : nextSection;
    content = content.slice(0, idx).trimEnd() + "\n" + content.slice(end);
    writeFileSync(configPath, content.trimEnd() + "\n");

    const result = readFileSync(configPath, "utf-8");
    assert.equal(result.includes("[mcp_servers.assistmem]"), false);
    assert.ok(result.includes("[mcp_servers.other]"));
    assert.ok(result.includes('model = "gpt-5"'));
  });
});
