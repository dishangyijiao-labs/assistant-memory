import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { homedir, platform } from "os";
import { getCursorWorkspaceStorageDir } from "../src/ingest/cursor.js";
import { getCursorCliPaths } from "../src/ingest/cursor-cli.js";

/**
 * Test the exported path-detection functions for cursor / cursor-cli.
 * These are platform-dependent — we assert against the current platform.
 */

describe("getCursorWorkspaceStorageDir", () => {
  const originalAppdata = process.env.APPDATA;

  afterEach(() => {
    // Restore APPDATA
    if (originalAppdata !== undefined) {
      process.env.APPDATA = originalAppdata;
    } else {
      delete process.env.APPDATA;
    }
  });

  it("returns a string on the current platform", () => {
    const result = getCursorWorkspaceStorageDir();
    if (platform() === "win32" && !process.env.APPDATA) {
      assert.equal(result, null);
    } else {
      assert.ok(typeof result === "string");
      assert.ok(result!.includes("workspaceStorage"));
    }
  });

  if (platform() === "darwin") {
    it("returns Library/Application Support path on darwin", () => {
      const result = getCursorWorkspaceStorageDir();
      assert.ok(result);
      assert.ok(result!.includes("Library/Application Support/Cursor"));
      assert.ok(result!.endsWith("workspaceStorage"));
    });
  }

  if (platform() === "linux") {
    it("returns .config/Cursor path on linux", () => {
      const result = getCursorWorkspaceStorageDir();
      assert.ok(result);
      assert.ok(result!.includes(".config/Cursor"));
      assert.ok(result!.endsWith("workspaceStorage"));
    });
  }

  it("path includes User/workspaceStorage", () => {
    const result = getCursorWorkspaceStorageDir();
    if (result) {
      assert.ok(result.includes(join("User", "workspaceStorage")));
    }
  });
});

describe("getCursorCliPaths", () => {
  const originalAppdata = process.env.APPDATA;

  afterEach(() => {
    if (originalAppdata !== undefined) {
      process.env.APPDATA = originalAppdata;
    } else {
      delete process.env.APPDATA;
    }
  });

  it("returns globalState and chatsDir", () => {
    const paths = getCursorCliPaths();
    assert.ok(typeof paths.globalState === "string");
    assert.ok(typeof paths.chatsDir === "string");
    assert.ok(paths.globalState.includes("global-state.vscdb"));
    assert.ok(paths.chatsDir.includes("chats"));
  });

  if (platform() !== "win32") {
    it("non-win32: uses ~/.cursor for globalStorage", () => {
      const paths = getCursorCliPaths();
      assert.ok(paths.globalState.includes(join(homedir(), ".cursor", "globalStorage")));
      assert.ok(paths.chatsDir.includes(join(homedir(), ".cursor", "chats")));
    });
  }

  it("chatsDir always points to ~/.cursor/chats regardless of platform", () => {
    const paths = getCursorCliPaths();
    // On all platforms, chatsDir uses ~/.cursor/chats
    assert.ok(paths.chatsDir.endsWith(join(".cursor", "chats")));
  });

  if (platform() === "win32" || process.env.CI) {
    // Can simulate win32 behavior by setting APPDATA
    it("win32 with APPDATA: globalState uses APPDATA/Cursor path", () => {
      if (platform() !== "win32") return; // skip on non-win32
      const paths = getCursorCliPaths();
      const ap = process.env.APPDATA;
      if (ap) {
        assert.ok(paths.globalState.includes(join(ap, "Cursor")));
      }
    });
  }
});
