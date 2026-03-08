import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ingestGemini } from "../src/ingest/gemini.js";

describe("ingestGemini E2E", () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "gemini-test-"));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it("returns empty for nonexistent dir", () => {
    assert.deepEqual(ingestGemini("/nonexistent"), []);
  });

  it("returns empty for empty project dir", () => {
    const projDir = join(baseDir, "proj-hash");
    mkdirSync(projDir, { recursive: true });
    // No chats dir
    assert.deepEqual(ingestGemini(baseDir), []);
  });

  it("ingests JSON array format", () => {
    const chatsDir = join(baseDir, "proj-1", "chats");
    mkdirSync(chatsDir, { recursive: true });
    const data = [
      { role: "user", text: "How to use Gemini API?", timestamp: 1000 },
      { role: "model", text: "Here is how...", timestamp: 2000 },
    ];
    writeFileSync(join(chatsDir, "chat-1.json"), JSON.stringify(data), "utf-8");

    const sessions = ingestGemini(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].source, "gemini");
    assert.equal(sessions[0].workspace, "proj-1");
    assert.equal(sessions[0].messages.length, 2);
    assert.equal(sessions[0].messages[0].role, "user");
    assert.equal(sessions[0].messages[1].role, "assistant"); // model → assistant
  });

  it("ingests JSON object with turns", () => {
    const chatsDir = join(baseDir, "proj-2", "chats");
    mkdirSync(chatsDir, { recursive: true });
    const data = {
      turns: [
        { role: "user", content: "Hello", timestamp: 100 },
        { role: "gemini", content: "Hi!", timestamp: 200 },
      ],
    };
    writeFileSync(join(chatsDir, "chat-2.json"), JSON.stringify(data), "utf-8");

    const sessions = ingestGemini(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages[0].role, "user");
    assert.equal(sessions[0].messages[1].role, "assistant"); // gemini → assistant
  });

  it("ingests JSONL format (no-extension file with multiple JSON lines)", () => {
    const chatsDir = join(baseDir, "proj-3", "chats");
    mkdirSync(chatsDir, { recursive: true });
    // Use a file without extension that has multiple lines, each starting with {
    // The parser detects JSONL when content doesn't start with [ or { at the trimmed level,
    // or when a { file fails to extract messages from the wrapper object.
    // Actually, the JSONL branch runs when content doesn't start with [ or {.
    // So we prepend a comment-like line to trigger it:
    const lines = [
      "# chat log",
      JSON.stringify({ role: "user", text: "Line 1", timestamp: 100 }),
      JSON.stringify({ role: "model", text: "Line 2", timestamp: 200 }),
    ];
    writeFileSync(join(chatsDir, "chat-3"), lines.join("\n"), "utf-8");

    const sessions = ingestGemini(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 2);
  });

  it("handles parts array in messages", () => {
    const chatsDir = join(baseDir, "proj-4", "chats");
    mkdirSync(chatsDir, { recursive: true });
    const data = [
      { role: "user", parts: [{ text: "Part A" }, { text: "Part B" }], timestamp: 100 },
    ];
    writeFileSync(join(chatsDir, "parts.json"), JSON.stringify(data), "utf-8");

    const sessions = ingestGemini(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages[0].content, "Part A\nPart B");
  });

  it("ingests files without extension", () => {
    const chatsDir = join(baseDir, "proj-5", "chats");
    mkdirSync(chatsDir, { recursive: true });
    const data = [{ role: "user", text: "no ext", timestamp: 100 }];
    writeFileSync(join(chatsDir, "noext"), JSON.stringify(data), "utf-8");

    const sessions = ingestGemini(baseDir);
    assert.equal(sessions.length, 1);
  });

  it("handles JSON object with parts/content at top level", () => {
    const chatsDir = join(baseDir, "proj-6", "chats");
    mkdirSync(chatsDir, { recursive: true });
    const data = {
      parts: [
        { text: "Top-level part", role: "user", timestamp: 100 },
      ],
    };
    writeFileSync(join(chatsDir, "top-parts.json"), JSON.stringify(data), "utf-8");

    const sessions = ingestGemini(baseDir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages[0].content, "Top-level part");
  });

  it("skips files with empty messages", () => {
    const chatsDir = join(baseDir, "proj-7", "chats");
    mkdirSync(chatsDir, { recursive: true });
    writeFileSync(join(chatsDir, "empty.json"), JSON.stringify([{ role: "user", text: "" }]), "utf-8");

    assert.deepEqual(ingestGemini(baseDir), []);
  });

  it("multiple projects produce separate sessions", () => {
    for (const proj of ["p1", "p2"]) {
      const chatsDir = join(baseDir, proj, "chats");
      mkdirSync(chatsDir, { recursive: true });
      writeFileSync(join(chatsDir, "c.json"),
        JSON.stringify([{ role: "user", text: `from ${proj}`, timestamp: 100 }]), "utf-8");
    }
    const sessions = ingestGemini(baseDir);
    assert.equal(sessions.length, 2);
  });
});
