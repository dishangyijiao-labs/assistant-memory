import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { useTempDb } from "./helpers.js";
import {
  setSetting,
  getModelSettings,
  updateModelSettings,
  getSourceSettings,
  listSourceSettings,
  listEnabledSources,
  updateSourceSettings,
  listTomorrowPlanItems,
  appendTomorrowPlanItem,
  updateTomorrowPlanItemStatus,
  removeTomorrowPlanItem,
} from "../src/storage/queries/settings.js";

describe("settings queries", () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = useTempDb());
  });

  afterEach(() => {
    cleanup();
  });

  describe("setSetting / getModelSettings", () => {
    it("returns defaults when nothing is set", () => {
      const s = getModelSettings();
      assert.equal(s.mode_default, "local");
      assert.equal(s.external_enabled, false);
      assert.equal(s.provider, "");
      assert.equal(s.model_name, "");
    });

    it("updates and reads model settings", () => {
      const updated = updateModelSettings({
        mode_default: "external",
        external_enabled: true,
        provider: "openai",
        model_name: "gpt-4",
        api_key: "sk-test",
      });
      assert.equal(updated.mode_default, "external");
      assert.equal(updated.external_enabled, true);
      assert.equal(updated.provider, "openai");
      assert.equal(updated.model_name, "gpt-4");
      assert.equal(updated.api_key, "sk-test");
    });

    it("partial update preserves other fields", () => {
      updateModelSettings({ provider: "anthropic" });
      updateModelSettings({ model_name: "claude-3" });
      const s = getModelSettings();
      assert.equal(s.provider, "anthropic");
      assert.equal(s.model_name, "claude-3");
      assert.equal(s.mode_default, "local"); // unchanged
    });

    it("handles agent mode", () => {
      updateModelSettings({ mode_default: "agent" });
      assert.equal(getModelSettings().mode_default, "agent");
    });
  });

  describe("source settings", () => {
    it("returns defaults for all sources", () => {
      const all = listSourceSettings();
      assert.equal(all.length, 6);
      for (const s of all) {
        assert.equal(s.enabled, true);
        assert.ok(s.path.length > 0);
      }
    });

    it("updates source enabled/mode/path", () => {
      const updated = updateSourceSettings("cursor", {
        enabled: false,
        mode: "api",
        path: "/custom/path",
      });
      assert.equal(updated.enabled, false);
      assert.equal(updated.mode, "api");
      assert.equal(updated.path, "/custom/path");
    });

    it("listEnabledSources reflects disabled sources", () => {
      const before = listEnabledSources();
      assert.ok(before.includes("cursor"));
      updateSourceSettings("cursor", { enabled: false });
      const after = listEnabledSources();
      assert.ok(!after.includes("cursor"));
    });

    it("updates last_sync_at", () => {
      const now = Date.now();
      updateSourceSettings("copilot", { last_sync_at: now });
      assert.equal(getSourceSettings("copilot").last_sync_at, now);
    });

    it("clears last_sync_at with null", () => {
      updateSourceSettings("copilot", { last_sync_at: Date.now() });
      updateSourceSettings("copilot", { last_sync_at: null });
      assert.equal(getSourceSettings("copilot").last_sync_at, null);
    });

    it("normalizes invalid mode to default", () => {
      // Force an invalid mode via raw setSetting
      setSetting("source.cursor.mode", "invalid_mode");
      const s = getSourceSettings("cursor");
      assert.equal(s.mode, "local_files"); // falls back to default
    });
  });

  describe("tomorrow plan items", () => {
    it("returns empty array initially", () => {
      assert.deepEqual(listTomorrowPlanItems(), []);
    });

    it("appends an item", () => {
      const item = appendTomorrowPlanItem("Fix the bug");
      assert.equal(item.action, "Fix the bug");
      assert.equal(item.status, "open");
      assert.ok(item.id.length > 0);
      const items = listTomorrowPlanItems();
      assert.equal(items.length, 1);
    });

    it("deduplicates by normalized action", () => {
      const item1 = appendTomorrowPlanItem("Fix the bug");
      const item2 = appendTomorrowPlanItem("  fix  the  BUG  ");
      assert.equal(item1.id, item2.id);
      assert.equal(listTomorrowPlanItems().length, 1);
    });

    it("throws on empty action", () => {
      assert.throws(() => appendTomorrowPlanItem(""), { message: "TOMORROW_PLAN_ACTION_EMPTY" });
      assert.throws(() => appendTomorrowPlanItem("   "), { message: "TOMORROW_PLAN_ACTION_EMPTY" });
    });

    it("updates item status", () => {
      const item = appendTomorrowPlanItem("Task A");
      const updated = updateTomorrowPlanItemStatus(item.id, "done");
      assert.ok(updated);
      assert.equal(updated!.status, "done");
    });

    it("returns null for nonexistent item update", () => {
      assert.equal(updateTomorrowPlanItemStatus("no-such-id", "done"), null);
    });

    it("removes an item", () => {
      const item = appendTomorrowPlanItem("Remove me");
      assert.equal(removeTomorrowPlanItem(item.id), true);
      assert.equal(listTomorrowPlanItems().length, 0);
    });

    it("returns false when removing nonexistent item", () => {
      assert.equal(removeTomorrowPlanItem("no-such-id"), false);
    });

    it("stores source_report_id", () => {
      const item = appendTomorrowPlanItem("From report", 42);
      assert.equal(item.source_report_id, 42);
    });
  });
});
