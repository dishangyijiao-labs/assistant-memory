import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { timeAgo } from "../format";
import Toast from "../components/Toast";
import "../styles/integrations.css";

interface McpClient {
  id: string;
  name: string;
  installed: boolean;
  last_used_at: number | null;
  call_count: number;
}

interface McpData {
  clients: McpClient[];
  usage: {
    last_client: string | null;
    last_tool: string | null;
    last_used_at: number | null;
  };
}

export default function IntegrationsPage() {
  const [data, setData] = useState<McpData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(() => {
    api<McpData>("/api/mcp")
      .then(setData)
      .catch((err) => setError(err?.message || "Failed to load"));
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = useCallback(async (clientId: string, action: "install" | "remove") => {
    setBusy(clientId);
    setTestResult(null);
    try {
      await api(`/api/mcp/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }, [load]);

  const doTest = useCallback(async () => {
    setBusy("test");
    try {
      const result = await api<{ ok: boolean; message: string }>("/api/mcp/test", {
        method: "POST",
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : "Test failed" });
    } finally {
      setBusy(null);
    }
  }, []);

  if (error) {
    return (
      <div className="integrations-page">
        <main className="main">
          <Link className="back-link" to="/">&larr; Back</Link>
          <h1 className="page-title">MCP</h1>
          <div className="error">{error}</div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="integrations-page">
        <main className="main">
          <Link className="back-link" to="/">&larr; Back</Link>
          <h1 className="page-title">MCP</h1>
          <div className="loading">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="integrations-page">
        <main className="main">
          <Link className="back-link" to="/">&larr; Back</Link>
          <h1 className="page-title">MCP</h1>
          <p className="page-sub">
            Manage AssistMem MCP server connections
          </p>

          {/* Client rows */}
          <section>
            <div className="mcp-client-list">
              {data.clients.map((client) => (
                <div key={client.id} className="mcp-client-row">
                  <div className="mcp-client-info">
                    <span className="mcp-client-name">{client.name}</span>
                  </div>
                  <div className="mcp-client-actions">
                    {client.installed ? (
                      <>
                        <button
                          type="button"
                          className="mcp-btn mcp-btn-secondary"
                          disabled={busy === client.id}
                          onClick={() => doAction(client.id, "install")}
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          className="mcp-btn mcp-btn-danger"
                          disabled={busy === client.id}
                          onClick={() => doAction(client.id, "remove")}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="mcp-btn mcp-btn-primary"
                        disabled={busy === client.id}
                        onClick={() => doAction(client.id, "install")}
                      >
                        Install
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Test connection */}
          <section className="mcp-test-section">
            <button
              type="button"
              className="mcp-btn mcp-btn-secondary"
              disabled={busy === "test"}
              onClick={doTest}
            >
              Test Connection
            </button>
            {testResult && (
              <span className={`mcp-test-result ${testResult.ok ? "ok" : "fail"}`}>
                {testResult.message}
              </span>
            )}
          </section>

          {/* Usage footer */}
          {data.usage.last_used_at && (
            <div className="mcp-usage-footer">
              Last used {timeAgo(data.usage.last_used_at)}
              {data.usage.last_client && <> by {data.usage.last_client}</>}
            </div>
          )}
        </main>
      </div>
      <Toast />
    </>
  );
}
