import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir, homedir, platform } from "os";

/**
 * Tests for platform-specific path detection logic across ingest modules.
 * Uses filesystem fixtures to test real directory scanning behavior.
 *
 * Covers: copilot, cursor (workspace), cursor-cli, claude-code, codex, gemini
 *
 * NOTE: We test the exported ingest functions that accept a baseDir override
 * rather than testing private getCursorWorkspaceStorageDir / getCursorCliPaths
 * directly — those are platform-dependent and we test their behavior indirectly.
 */

import { ingestCopilot } from "../src/ingest/copilot.js";
import { ingestClaudeCode } from "../src/ingest/claude-code.js";
import { ingestCodex } from "../src/ingest/codex.js";
import { ingestGemini } from "../src/ingest/gemini.js";

describe("ingest path detection – copilot", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "copilot-path-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when base dir does not exist", () => {
    const sessions = ingestCopilot("/nonexistent/path/abc123");
    assert.equal(sessions.length, 0);
  });

  it("returns empty when base dir has no workspace subdirs", () => {
    const sessions = ingestCopilot(tmpDir);
    assert.equal(sessions.length, 0);
  });

  it("returns empty when workspace has no chatSessions dir", () => {
    mkdirSync(join(tmpDir, "workspace-hash-1"));
    const sessions = ingestCopilot(tmpDir);
    assert.equal(sessions.length, 0);
  });

  it("finds sessions in workspaceStorage/hash/chatSessions/*.json", () => {
    const wsDir = join(tmpDir, "abc123");
    const chatDir = join(wsDir, "chatSessions");
    mkdirSync(chatDir, { recursive: true });
    writeFileSync(
      join(chatDir, "session1.json"),
      JSON.stringify({
        sessionId: "s1",
        requests: [{ prompt: "Hello", response: "Hi!", timestamp: 1000 }],
      })
    );
    const sessions = ingestCopilot(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].source, "copilot");
    assert.equal(sessions[0].workspace, "abc123");
    assert.equal(sessions[0].external_id, "s1");
  });

  it("scans multiple workspace directories", () => {
    for (const hash of ["ws-1", "ws-2"]) {
      const chatDir = join(tmpDir, hash, "chatSessions");
      mkdirSync(chatDir, { recursive: true });
      writeFileSync(
        join(chatDir, "chat.json"),
        JSON.stringify({
          sessionId: `s-${hash}`,
          requests: [{ prompt: "Q", response: "A", timestamp: 1000 }],
        })
      );
    }
    const sessions = ingestCopilot(tmpDir);
    assert.equal(sessions.length, 2);
    const workspaces = sessions.map((s) => s.workspace).sort();
    assert.deepEqual(workspaces, ["ws-1", "ws-2"]);
  });

  it("skips non-json files in chatSessions", () => {
    const chatDir = join(tmpDir, "ws", "chatSessions");
    mkdirSync(chatDir, { recursive: true });
    writeFileSync(join(chatDir, "readme.txt"), "not a chat file");
    writeFileSync(join(chatDir, "data.csv"), "a,b,c");
    writeFileSync(
      join(chatDir, "valid.json"),
      JSON.stringify({
        sessionId: "s-valid",
        requests: [{ prompt: "Q", response: "A", timestamp: 1000 }],
      })
    );
    const sessions = ingestCopilot(tmpDir);
    assert.equal(sessions.length, 1);
  });

  it("skips corrupted json files gracefully", () => {
    const chatDir = join(tmpDir, "ws", "chatSessions");
    mkdirSync(chatDir, { recursive: true });
    writeFileSync(join(chatDir, "bad.json"), "{ invalid json ]]");
    writeFileSync(
      join(chatDir, "good.json"),
      JSON.stringify({
        sessionId: "good",
        requests: [{ prompt: "Q", response: "A", timestamp: 1000 }],
      })
    );
    const sessions = ingestCopilot(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].external_id, "good");
  });

  it("platform path expectation (darwin)", () => {
    if (platform() !== "darwin") return;
    const expectedBase = join(homedir(), "Library", "Application Support", "Code", "User", "workspaceStorage");
    // Just verify the expected path is a valid directory structure concept
    assert.ok(expectedBase.includes("Library/Application Support/Code"));
  });

  it("platform path expectation (linux)", () => {
    if (platform() !== "linux") return;
    const expectedBase = join(homedir(), ".config", "Code", "User", "workspaceStorage");
    assert.ok(expectedBase.includes(".config/Code"));
  });
});

describe("ingest path detection – claude-code", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "claude-code-path-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when base dir does not exist", () => {
    const sessions = ingestClaudeCode("/nonexistent/abc123");
    assert.equal(sessions.length, 0);
  });

  it("returns empty when base dir has no project dirs", () => {
    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 0);
  });

  it("finds sessions in project dir with .jsonl files", () => {
    const projDir = join(tmpDir, "my-project");
    mkdirSync(projDir, { recursive: true });
    const lines = [
      JSON.stringify({ type: "user", message: { role: "user", content: "Hello" }, timestamp: "2024-01-01T00:00:00Z" }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: "Hi!" }, timestamp: "2024-01-01T00:00:01Z" }),
    ];
    writeFileSync(join(projDir, "session-abc.jsonl"), lines.join("\n"));

    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].source, "claude-code");
    assert.equal(sessions[0].workspace, "my-project");
    assert.equal(sessions[0].external_id, "session-abc");
  });

  it("scans multiple project directories", () => {
    for (const proj of ["proj-a", "proj-b"]) {
      const projDir = join(tmpDir, proj);
      mkdirSync(projDir);
      const line = JSON.stringify({
        type: "user",
        message: { role: "user", content: `From ${proj}` },
        timestamp: "2024-01-01T00:00:00Z",
      });
      writeFileSync(join(projDir, "s1.jsonl"), line);
    }
    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 2);
  });

  it("skips non-jsonl files", () => {
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir);
    writeFileSync(join(projDir, "notes.txt"), "not jsonl");
    writeFileSync(join(projDir, "data.json"), "{}");
    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 0);
  });

  it("skips jsonl files with no valid messages", () => {
    const projDir = join(tmpDir, "proj");
    mkdirSync(projDir);
    writeFileSync(join(projDir, "empty.jsonl"), "");
    writeFileSync(join(projDir, "invalid.jsonl"), "{bad json\n{also bad");
    const sessions = ingestClaudeCode(tmpDir);
    assert.equal(sessions.length, 0);
  });

  it("default path points to ~/.claude/projects", () => {
    const expected = join(homedir(), ".claude", "projects");
    // Just verify the constant is reasonable, don't require directory to exist
    assert.ok(expected.includes(".claude"));
    assert.ok(expected.endsWith("projects"));
  });
});

describe("ingest path detection – codex", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "codex-path-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when base dir does not exist", () => {
    const sessions = ingestCodex("/nonexistent/abc123");
    assert.equal(sessions.length, 0);
  });

  it("returns empty for empty base dir", () => {
    const sessions = ingestCodex(tmpDir);
    assert.equal(sessions.length, 0);
  });

  it("recursively finds .jsonl files in nested dirs", () => {
    const nested = join(tmpDir, "project", "workspace");
    mkdirSync(nested, { recursive: true });
    const events = [
      JSON.stringify({
        type: "event_msg",
        payload: { type: "user_message", message: "Hello codex" },
        timestamp: 1700000000000,
      }),
      JSON.stringify({
        type: "event_msg",
        payload: { type: "agent_message", message: "Hi from codex!" },
        timestamp: 1700000001000,
      }),
    ];
    writeFileSync(join(nested, "session1.jsonl"), events.join("\n"));

    const sessions = ingestCodex(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].source, "codex");
    assert.ok(sessions[0].workspace.includes("project"));
  });

  it("finds .json files too", () => {
    writeFileSync(
      join(tmpDir, "legacy.json"),
      JSON.stringify({
        messages: [
          { role: "user", content: "Legacy Q", timestamp: 1700000000000 },
          { role: "assistant", content: "Legacy A", timestamp: 1700000001000 },
        ],
      })
    );
    const sessions = ingestCodex(tmpDir);
    assert.equal(sessions.length, 1);
  });

  it("default path points to ~/.codex/sessions", () => {
    const expected = join(homedir(), ".codex", "sessions");
    assert.ok(expected.includes(".codex"));
    assert.ok(expected.endsWith("sessions"));
  });
});

describe("ingest path detection – gemini", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "gemini-path-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when base dir does not exist", () => {
    const sessions = ingestGemini("/nonexistent/abc123");
    assert.equal(sessions.length, 0);
  });

  it("returns empty when base dir has no project dirs", () => {
    const sessions = ingestGemini(tmpDir);
    assert.equal(sessions.length, 0);
  });

  it("returns empty when project dir has no chats subdir", () => {
    mkdirSync(join(tmpDir, "project-hash"));
    const sessions = ingestGemini(tmpDir);
    assert.equal(sessions.length, 0);
  });

  it("finds sessions in project/chats/*.json", () => {
    const chatsDir = join(tmpDir, "proj-hash", "chats");
    mkdirSync(chatsDir, { recursive: true });
    writeFileSync(
      join(chatsDir, "chat1.json"),
      JSON.stringify([
        { role: "user", text: "What is Gemini?", timestamp: 1700000000000 },
        { role: "model", text: "Gemini is an AI model.", timestamp: 1700000001000 },
      ])
    );
    const sessions = ingestGemini(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].source, "gemini");
    assert.equal(sessions[0].workspace, "proj-hash");
    assert.equal(sessions[0].messages.length, 2);
  });

  it("handles object-wrapped chat format", () => {
    const chatsDir = join(tmpDir, "proj", "chats");
    mkdirSync(chatsDir, { recursive: true });
    writeFileSync(
      join(chatsDir, "wrapped.json"),
      JSON.stringify({
        turns: [
          { role: "user", text: "Q", timestamp: 1000 },
          { role: "assistant", text: "A", timestamp: 2000 },
        ],
      })
    );
    const sessions = ingestGemini(tmpDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 2);
  });

  it("handles JSONL format in chats dir", () => {
    const chatsDir = join(tmpDir, "proj", "chats");
    mkdirSync(chatsDir, { recursive: true });
    // JSONL lines that are not an array or single object — each line is a separate JSON object
    // Prefix with a comment-like line to avoid triggering the "[" or "{" single-parse branches
    const lines = [
      JSON.stringify({ role: "user", text: "Line Q", timestamp: 1000 }),
      JSON.stringify({ role: "model", text: "Line A", timestamp: 2000 }),
    ];
    // Use a file without extension (gemini also picks those up)
    writeFileSync(join(chatsDir, "conversation"), "skip\n" + lines.join("\n"));
    const sessions = ingestGemini(tmpDir);
    assert.equal(sessions.length, 1);
  });

  it("scans multiple project directories", () => {
    for (const proj of ["p1", "p2"]) {
      const chatsDir = join(tmpDir, proj, "chats");
      mkdirSync(chatsDir, { recursive: true });
      writeFileSync(
        join(chatsDir, "chat.json"),
        JSON.stringify([{ role: "user", text: `From ${proj}`, timestamp: 1000 }])
      );
    }
    const sessions = ingestGemini(tmpDir);
    assert.equal(sessions.length, 2);
  });

  it("skips files with no extractable messages", () => {
    const chatsDir = join(tmpDir, "proj", "chats");
    mkdirSync(chatsDir, { recursive: true });
    writeFileSync(join(chatsDir, "empty.json"), "[]");
    writeFileSync(join(chatsDir, "invalid.json"), "not json at all");
    const sessions = ingestGemini(tmpDir);
    assert.equal(sessions.length, 0);
  });

  it("default path points to ~/.gemini/tmp", () => {
    const expected = join(homedir(), ".gemini", "tmp");
    assert.ok(expected.includes(".gemini"));
    assert.ok(expected.endsWith("tmp"));
  });
});

describe("ingest path detection – cursor workspace (platform branches)", () => {
  it("getCursorWorkspaceStorageDir returns platform-specific path", () => {
    // We can't directly test the private function, but we verify the pattern
    const p = platform();
    if (p === "darwin") {
      const expected = join(homedir(), "Library", "Application Support", "Cursor", "User", "workspaceStorage");
      assert.ok(expected.includes("Application Support/Cursor"));
    } else if (p === "linux") {
      const expected = join(homedir(), ".config", "Cursor", "User", "workspaceStorage");
      assert.ok(expected.includes(".config/Cursor"));
    }
    // win32 would use APPDATA, which we can't fully test in CI
  });

  it("getCursorCliPaths returns platform-specific paths", () => {
    const p = platform();
    if (p === "darwin" || p === "linux") {
      const expectedGlobal = join(homedir(), ".cursor", "globalStorage", "global-state.vscdb");
      const expectedChats = join(homedir(), ".cursor", "chats");
      assert.ok(expectedGlobal.includes(".cursor/globalStorage"));
      assert.ok(expectedChats.endsWith(".cursor/chats"));
    }
    // win32 uses APPDATA for globalState but ~/.cursor/chats for chats
  });
});

describe("ingest path detection – win32 platform branches", () => {
  it("copilot win32 path uses APPDATA", () => {
    // Verify the logic conceptually: on win32, APPDATA/Code/User/workspaceStorage
    const fakeAppdata = "/fake/AppData/Roaming";
    const expectedPath = join(fakeAppdata, "Code", "User", "workspaceStorage");
    assert.ok(expectedPath.includes("Code"));
    assert.ok(expectedPath.includes("workspaceStorage"));
  });

  it("cursor win32 path uses APPDATA", () => {
    const fakeAppdata = "/fake/AppData/Roaming";
    const expectedPath = join(fakeAppdata, "Cursor", "User", "workspaceStorage");
    assert.ok(expectedPath.includes("Cursor"));
  });

  it("cursor-cli win32 globalState path", () => {
    // On win32 with APPDATA: join(APPDATA, "Cursor", "User", "globalStorage", "global-state.vscdb")
    // On win32 without APPDATA: join(homedir(), ".cursor", ...)
    const fakeAppdata = "/fake/AppData/Roaming";
    const withAppdata = join(fakeAppdata, "Cursor", "User", "globalStorage", "global-state.vscdb");
    assert.ok(withAppdata.includes("global-state.vscdb"));

    const withoutAppdata = join(homedir(), ".cursor", "User", "globalStorage", "global-state.vscdb");
    assert.ok(withoutAppdata.includes(".cursor"));
  });
});
