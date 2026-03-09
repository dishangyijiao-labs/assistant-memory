import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { applyCors, handlePreflight } from "./middleware/cors.js";
import { serveSpaFile, serveSpaFallback } from "./middleware/spa.js";
import { sendError } from "./utils/http.js";
import * as ingestRoutes from "./routes/ingest.js";
import * as settingsRoutes from "./routes/settings.js";
import * as sessionsRoutes from "./routes/sessions.js";
import * as integrationsRoutes from "./routes/integrations.js";

const DEFAULT_PORT = 3939;

export function createHandler() {
  return function handler(req: IncomingMessage, res: ServerResponse): void {
    void (async () => {
      const url = req.url ?? "/";
      const method = req.method ?? "GET";
      const path = url.split("?")[0];
      const userAgent = req.headers["user-agent"] ?? "-";

      applyCors(req, res);
      if (handlePreflight(req, res)) return;

      console.log(`[${new Date().toISOString()}] ${method} ${url} - ${userAgent}`);

      // --- POST routes ---
      if (path === "/api/index" && method === "POST") {
        return await ingestRoutes.handleIndex(req, res);
      }
      if (path === "/api/model/test" && method === "POST") {
        return await settingsRoutes.handleTestModel(req, res);
      }
      if (path === "/api/mcp/install" && method === "POST") {
        return await integrationsRoutes.handleMcpInstall(req, res);
      }
      if (path === "/api/mcp/remove" && method === "POST") {
        return await integrationsRoutes.handleMcpRemove(req, res);
      }
      if (path === "/api/mcp/test" && method === "POST") {
        return await integrationsRoutes.handleMcpTest(req, res);
      }

      // --- PUT routes ---
      if (path === "/api/settings/model" && method === "PUT") {
        return await settingsRoutes.handleUpdateModel(req, res);
      }
      const sourceUpdateMatch = path.match(/^\/api\/settings\/sources\/([a-z-]+)$/);
      if (sourceUpdateMatch && method === "PUT") {
        return await settingsRoutes.handleUpdateSource(req, res, sourceUpdateMatch[1] ?? "");
      }
      const sourceSyncMatch = path.match(/^\/api\/settings\/sources\/([a-z-]+)\/sync$/);
      if (sourceSyncMatch && method === "POST") {
        return await settingsRoutes.handleSyncSource(req, res, sourceSyncMatch[1] ?? "");
      }

      // --- Method guard for non-GET ---
      if (method !== "GET") {
        res.writeHead(405, { "Content-Type": "text/plain" });
        res.end("Method Not Allowed");
        return;
      }

      // --- SPA static file serving ---
      if (serveSpaFile(path, res)) return;

      // --- GET routes ---
      if (path === "/api/search") return await sessionsRoutes.handleSearch(req, res, url);
      if (path === "/api/sessions") return await sessionsRoutes.handleListSessions(req, res, url);
      if (path === "/api/session") return await sessionsRoutes.handleGetSession(req, res, url);
      if (path === "/api/workspaces") return await sessionsRoutes.handleWorkspaces(req, res, url);
      if (path === "/api/stats") return await sessionsRoutes.handleStats(req, res);
      if (path === "/api/integrations") return await integrationsRoutes.handleGetIntegrations(req, res);
      if (path === "/api/mcp") return await integrationsRoutes.handleGetMcp(req, res);
      if (path === "/api/settings/sources") return await settingsRoutes.handleGetSources(req, res);
      if (path === "/api/settings/model") return await settingsRoutes.handleGetModel(req, res);

      // --- SPA fallback ---
      if (serveSpaFallback(path, res)) return;

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Internal server error";
      sendError(res, 500, "INTERNAL_ERROR", message);
    });
  };
}

export function startServer(port: number = DEFAULT_PORT): void {
  const server = createServer(createHandler());
  server.listen(port, () => {
    console.error("AssistMem – web search");
    console.error("Open http://localhost:" + port + " in your browser.");
  });
}
