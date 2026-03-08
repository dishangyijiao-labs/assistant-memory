import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";

/**
 * Tests for cursor / cursor-cli SQLite DB reading paths.
 * Creates real .vscdb fixture files with better-sqlite3 and verifies
 * that the parsers can extract sessions from them.
 */

// cursor.ts exports
import { parseCursorChatData } from "../src/ingest/cursor.js";
// cursor-cli.ts exports
import { parseCursorCliChatFile } from "../src/ingest/cursor-cli.js";

/**
 * Create a temporary .vscdb file (SQLite) with an ItemTable containing the given key-value pairs.
 */
function createFixtureVscdb(dir: string, filename: string, rows: Array<{ key: string; value: string }>): string {
  const dbPath = join(dir, filename);
  const db = new Database(dbPath);
  db.exec("CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value TEXT)");
  const insert = db.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)");
  for (const row of rows) {
    insert.run(row.key, row.value);
  }
  db.close();
  return dbPath;
}

describe("cursor SQLite DB reading (fixture .vscdb)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "cursor-sqlite-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("parseCursorChatData with real DB content", () => {
    it("reads chat data from array format stored in vscdb", () => {
      const chatData = JSON.stringify([
        {
          id: "conv-1",
          messages: [
            { role: "user", content: "What is TypeScript?" },
            { role: "assistant", content: "TypeScript is a typed superset of JavaScript." },
          ],
        },
      ]);

      createFixtureVscdb(tmpDir, "state.vscdb", [
        { key: "workbench.panel.aichat.view.aichat.chatdata", value: chatData },
      ]);

      // Read the value back and parse it like cursor.ts / cursor-cli.ts would
      const db = new Database(join(tmpDir, "state.vscdb"), { readonly: true });
      const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(
        "workbench.panel.aichat.view.aichat.chatdata"
      ) as { value: string } | undefined;
      db.close();

      assert.ok(row);
      const sessions = parseCursorChatData(row!.value);
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].external_id, "conv-1");
      assert.equal(sessions[0].messages.length, 2);
      assert.equal(sessions[0].messages[0].role, "user");
      assert.equal(sessions[0].messages[0].content, "What is TypeScript?");
    });

    it("reads allComposers format from vscdb", () => {
      const chatData = JSON.stringify({
        allComposers: [
          {
            composer: {
              id: "comp-1",
              bubbles: [
                { prompt: "Fix the bug", response: "Done, I refactored the handler." },
              ],
            },
          },
        ],
      });

      createFixtureVscdb(tmpDir, "state.vscdb", [
        { key: "workbench.panel.aichat.chatdata", value: chatData },
      ]);

      const db = new Database(join(tmpDir, "state.vscdb"), { readonly: true });
      const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(
        "workbench.panel.aichat.chatdata"
      ) as { value: string } | undefined;
      db.close();

      assert.ok(row);
      const sessions = parseCursorChatData(row!.value);
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].external_id, "comp-1");
      assert.equal(sessions[0].messages.length, 2);
      assert.equal(sessions[0].messages[0].content, "Fix the bug");
      assert.equal(sessions[0].messages[1].content, "Done, I refactored the handler.");
    });

    it("reads Buffer value from vscdb (simulates binary storage)", () => {
      const chatData = JSON.stringify([
        {
          id: "buf-conv",
          messages: [
            { role: "user", content: "Buffer test" },
            { role: "assistant", content: "Works!" },
          ],
        },
      ]);

      // Store as Buffer value in the DB
      const dbPath = join(tmpDir, "buf-state.vscdb");
      const db = new Database(dbPath);
      db.exec("CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value BLOB)");
      db.prepare("INSERT INTO ItemTable (key, value) VALUES (?, ?)").run(
        "workbench.panel.aichat.view.aichat.chatdata",
        Buffer.from(chatData, "utf-8")
      );
      db.close();

      const db2 = new Database(dbPath, { readonly: true });
      const row = db2.prepare("SELECT value FROM ItemTable WHERE key = ?").get(
        "workbench.panel.aichat.view.aichat.chatdata"
      ) as { value: unknown } | undefined;
      db2.close();

      assert.ok(row);
      // Simulate asText function behavior
      const value = row!.value;
      let text: string | null = null;
      if (typeof value === "string") text = value;
      else if (value && Buffer.isBuffer(value)) text = value.toString("utf-8");

      assert.ok(text);
      const sessions = parseCursorChatData(text!);
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].external_id, "buf-conv");
    });

    it("tries multiple keys and stops after first success", () => {
      // Only second key has data
      const chatData = JSON.stringify([
        {
          id: "key2-conv",
          messages: [{ role: "user", content: "Found via second key" }],
        },
      ]);

      createFixtureVscdb(tmpDir, "multi-key.vscdb", [
        { key: "workbench.panel.aichat.view.aichat.chatdata", value: "invalid json" },
        { key: "workbench.panel.aichat.chatdata", value: chatData },
      ]);

      const CURSOR_KEYS = [
        "workbench.panel.aichat.view.aichat.chatdata",
        "workbench.panel.aichat.chatdata",
        "aiService.prompts",
      ];

      const db = new Database(join(tmpDir, "multi-key.vscdb"), { readonly: true });
      let foundSessions: ReturnType<typeof parseCursorChatData> = [];
      for (const key of CURSOR_KEYS) {
        const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key) as
          | { value: string }
          | undefined;
        if (!row?.value) continue;
        const data = parseCursorChatData(row.value);
        if (data.length > 0) {
          foundSessions = data;
          break;
        }
      }
      db.close();

      assert.equal(foundSessions.length, 1);
      assert.equal(foundSessions[0].external_id, "key2-conv");
    });

    it("handles empty DB gracefully", () => {
      createFixtureVscdb(tmpDir, "empty.vscdb", []);

      const db = new Database(join(tmpDir, "empty.vscdb"), { readonly: true });
      const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(
        "workbench.panel.aichat.view.aichat.chatdata"
      ) as { value: string } | undefined;
      db.close();

      assert.equal(row, undefined);
    });

    it("handles DB with key but null/empty value", () => {
      createFixtureVscdb(tmpDir, "null-val.vscdb", [
        { key: "workbench.panel.aichat.view.aichat.chatdata", value: "" },
      ]);

      const db = new Database(join(tmpDir, "null-val.vscdb"), { readonly: true });
      const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(
        "workbench.panel.aichat.view.aichat.chatdata"
      ) as { value: string } | undefined;
      db.close();

      assert.ok(row);
      const sessions = parseCursorChatData(row!.value);
      assert.equal(sessions.length, 0);
    });

    it("reads composer.composerData key (cursor.ts specific)", () => {
      const chatData = JSON.stringify({
        allComposers: [
          {
            id: "raw-composer",
            messages: [
              { role: "user", content: "Compose this" },
              { role: "assistant", content: "Composed!" },
            ],
          },
        ],
      });

      createFixtureVscdb(tmpDir, "composer.vscdb", [
        { key: "composer.composerData", value: chatData },
      ]);

      const db = new Database(join(tmpDir, "composer.vscdb"), { readonly: true });
      const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(
        "composer.composerData"
      ) as { value: string } | undefined;
      db.close();

      assert.ok(row);
      const sessions = parseCursorChatData(row!.value);
      assert.equal(sessions.length, 1);
    });
  });

  describe("cursor-cli chat file fixtures", () => {
    it("reads .json chat file from disk", () => {
      const chatFile = join(tmpDir, "session-abc.json");
      writeFileSync(
        chatFile,
        JSON.stringify({
          id: "abc",
          messages: [
            { role: "user", content: "Hello from file" },
            { role: "assistant", content: "Hi from file!" },
          ],
        })
      );

      const raw = readFileSync(chatFile, "utf-8");
      const session = parseCursorCliChatFile(raw, "session-abc.json");
      assert.ok(session);
      assert.equal(session!.external_id, "abc");
      assert.equal(session!.messages.length, 2);
    });

    it("reads .jsonl chat file from disk", () => {
      const chatFile = join(tmpDir, "multi.jsonl");
      const lines = [
        JSON.stringify({
          messages: [
            { role: "user", content: "First conversation" },
            { role: "assistant", content: "Reply 1" },
          ],
        }),
        JSON.stringify({
          messages: [
            { role: "user", content: "Second conversation" },
          ],
        }),
      ];
      writeFileSync(chatFile, lines.join("\n"));

      const raw = readFileSync(chatFile, "utf-8");
      const session = parseCursorCliChatFile(raw, "multi.jsonl");
      assert.ok(session);
      assert.ok(session!.messages.length >= 3);
    });

    it("simulates chats directory scan", () => {
      const chatsDir = join(tmpDir, "chats");
      mkdirSync(chatsDir);
      writeFileSync(
        join(chatsDir, "chat1.json"),
        JSON.stringify({
          id: "c1",
          messages: [{ role: "user", content: "Q1" }],
        })
      );
      writeFileSync(
        join(chatsDir, "chat2.json"),
        JSON.stringify({
          id: "c2",
          bubbles: [{ prompt: "Q2", response: "A2" }],
        })
      );
      writeFileSync(join(chatsDir, "readme.txt"), "not a chat file");

      const files = readdirSync(chatsDir).filter(
        (f: string) => f.endsWith(".json") || f.endsWith(".jsonl")
      );
      assert.equal(files.length, 2);

      const sessions = files
        .map((f: string) => {
          const raw = readFileSync(join(chatsDir, f), "utf-8");
          return parseCursorCliChatFile(raw, f);
        })
        .filter((s) => s && s.messages.length > 0);

      assert.equal(sessions.length, 2);
    });
  });
});
