import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ingestCopilot } from "../../server/ingest/copilot.js";

describe("ingestCopilot E2E", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "copilot-test-"));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("returns empty for nonexistent dir", () => {
    assert.deepEqual(ingestCopilot("/nonexistent"), []);
  });

  it("returns empty for empty workspace dirs", () => {
    mkdirSync(join(baseDir, "ws-hash"), { recursive: true });
    // No chatSessions subdir
    assert.deepEqual(ingestCopilot(baseDir), []);
  });

  it("ingests a basic copilot session", () => {
    const chatDir = join(baseDir, "ws-abc", "chatSessions");
    mkdirSync(chatDir, { recursive: true });
    const session = {
      sessionId: "copilot-session-1",
      creationDate: 1700000000000,
      requests: [
        { prompt: "How do I center a div?", response: "Use flexbox...", timestamp: 1700000000000 },
      ],
    };
    writeFileSync(join(chatDir, "s1.json"), JSON.stringify(session), "utf-8");

    const sessions = ingestCopilot(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].source, "copilot");
    assert.equal(sessions[0].workspace, "ws-abc");
    assert.equal(sessions[0].external_id, "copilot-session-1");
    assert.equal(sessions[0].messages.length, 2);
    assert.equal(sessions[0].messages[0].role, "user");
    assert.equal(sessions[0].messages[1].role, "assistant");
  });

  it("ingests role-based messages format", () => {
    const chatDir = join(baseDir, "ws-def", "chatSessions");
    mkdirSync(chatDir, { recursive: true });
    const session = {
      sessionId: "role-session",
      messages: [
        { role: "user", content: "Question", timestamp: 1000 },
        { role: "assistant", content: "Answer", timestamp: 2000 },
        { role: "system", content: "System msg", timestamp: 500 },
      ],
    };
    writeFileSync(join(chatDir, "r1.json"), JSON.stringify(session), "utf-8");

    const sessions = ingestCopilot(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 3);
  });

  it("handles multiple workspaces and sessions", () => {
    for (const ws of ["ws1", "ws2"]) {
      const chatDir = join(baseDir, ws, "chatSessions");
      mkdirSync(chatDir, { recursive: true });
      writeFileSync(join(chatDir, "s1.json"), JSON.stringify({
        sessionId: `${ws}-s1`,
        requests: [{ prompt: "test", timestamp: 1000 }],
      }), "utf-8");
    }

    const sessions = ingestCopilot(baseDir);
    assert.equal(sessions.length, 2);
  });

  it("skips non-json files", () => {
    const chatDir = join(baseDir, "ws", "chatSessions");
    mkdirSync(chatDir, { recursive: true });
    writeFileSync(join(chatDir, "readme.txt"), "not json", "utf-8");

    assert.deepEqual(ingestCopilot(baseDir), []);
  });

  it("skips corrupted json files", () => {
    const chatDir = join(baseDir, "ws", "chatSessions");
    mkdirSync(chatDir, { recursive: true });
    writeFileSync(join(chatDir, "bad.json"), "{invalid json", "utf-8");
    writeFileSync(join(chatDir, "good.json"), JSON.stringify({
      sessionId: "valid",
      requests: [{ prompt: "hello", timestamp: 1000 }],
    }), "utf-8");

    const sessions = ingestCopilot(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].external_id, "valid");
  });

  it("skips sessions with no messages extracted", () => {
    const chatDir = join(baseDir, "ws", "chatSessions");
    mkdirSync(chatDir, { recursive: true });
    writeFileSync(join(chatDir, "empty.json"), JSON.stringify({
      sessionId: "empty",
      requests: [],
    }), "utf-8");

    assert.deepEqual(ingestCopilot(baseDir), []);
  });
});
