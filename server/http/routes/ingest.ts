import type { IncomingMessage, ServerResponse } from "http";
import * as db from "../../storage/db.js";
import { runIngest } from "../../ingest/index.js";
import { sendJson, sendError } from "../utils/http.js";

export async function handleIndex(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const enabledSources = db.listEnabledSources();
  if (enabledSources.length === 0) {
    sendError(res, 400, "NO_ENABLED_SOURCE", "No AI tool enabled. Enable at least one source in Advanced.");
    return;
  }
  const sources = enabledSources;
  const stats = runIngest({ sources });
  const syncAt = Date.now();
  for (const source of sources) {
    db.updateSourceSettings(source, { last_sync_at: syncAt });
  }
  sendJson(res, 200, {
    sessions: stats.sessions,
    messages: stats.messages,
    sources,
    last_sync_at: syncAt,
    source_results: stats.sourceResults,
  });
}
