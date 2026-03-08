import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { timeAgo, formatNumber } from "../format";
import Toast from "../components/Toast";
import "../styles/integrations.css";

interface McpTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; required: boolean }>;
}

interface McpClient {
  id: string;
  name: string;
  description: string;
  supported: boolean;
  configured: boolean;
  last_used_at: number | null;
  call_count: number;
  config_snippet: string | null;
}

interface IntegrationsData {
  mcp: {
    server_name: string;
    version: string;
    transport: string;
    tools: McpTool[];
    clients: McpClient[];
    usage: {
      last_client: string | null;
      last_tool: string | null;
      last_used_at: number | null;
    };
  };
  data_sources: {
    summary: {
      active_sources: number;
      total_sessions: number;
      total_messages: number;
    };
  };
}

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedConfigs, setExpandedConfigs] = useState<Set<string>>(new Set());

  useEffect(() => {
    api<IntegrationsData>("/api/integrations")
      .then(setData)
      .catch((err) => setError(err?.message || "Failed to load integrations"));
  }, []);

  const toggleConfig = useCallback((clientId: string) => {
    setExpandedConfigs((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="integrations-page">
        <main className="main">
          <Link className="back-link" to="/">&larr; Back</Link>
          <h1 className="page-title">Integrations</h1>
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
          <h1 className="page-title">Integrations</h1>
          <div className="loading">Loading...</div>
        </main>
      </div>
    );
  }

  const { mcp, data_sources } = data;

  return (
    <>
      <div className="integrations-page">
        <main className="main">
          <Link className="back-link" to="/">&larr; Back</Link>
          <h1 className="page-title">Integrations</h1>
          <p className="page-sub">
            AssistMem MCP Server &middot; v{mcp.version} &middot; {mcp.transport} transport
          </p>

          {/* MCP Tools */}
          <section>
            <div className="section-head">
              <h2 className="section-title">MCP Tools</h2>
            </div>
            <div className="card-list">
              {mcp.tools.map((tool) => (
                <div key={tool.name} className="card">
                  <div className="card-info">
                    <h3 className="card-title">{tool.name}</h3>
                    <p className="card-desc">{tool.description}</p>
                    <div className="tool-params">
                      {Object.entries(tool.parameters).map(([name, param]) => (
                        <span key={name} style={{ marginRight: "0.8rem" }}>
                          <code>{name}</code>
                          {param.required ? "" : " (optional)"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* AI Clients */}
          <section>
            <div className="section-head">
              <h2 className="section-title">AI Clients</h2>
            </div>
            <div className="card-list">
              {mcp.clients.map((client) => (
                <div key={client.id} className="card">
                  <div className="card-header">
                    <div className="card-info">
                      <h3 className="card-title">{client.name}</h3>
                      <p className="card-desc">{client.description}</p>
                      <div className="badges">
                        {client.supported && (
                          <span className="badge supported">Supported</span>
                        )}
                        {client.configured && (
                          <span className="badge configured">Configured</span>
                        )}
                        {client.last_used_at && (
                          <span className="badge last-used">
                            Last used {timeAgo(client.last_used_at)}
                          </span>
                        )}
                      </div>
                      {client.configured && (
                        <div className="card-meta">
                          <span>{formatNumber(client.call_count)} calls</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {client.config_snippet && (
                    <div className="config-toggle">
                      <button type="button" onClick={() => toggleConfig(client.id)}>
                        {expandedConfigs.has(client.id) ? "Hide setup" : "Show setup"}
                      </button>
                      {expandedConfigs.has(client.id) && (
                        <div className="config-block">
                          <pre>{client.config_snippet}</pre>
                          <button
                            type="button"
                            className="copy-btn"
                            onClick={() => copyToClipboard(client.config_snippet!)}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Data Sources Summary */}
          <section>
            <div className="section-head">
              <h2 className="section-title">Data Sources</h2>
            </div>
            <div className="summary-card">
              <span className="summary-stats">
                {formatNumber(data_sources.summary.active_sources)} sources active
                &middot; {formatNumber(data_sources.summary.total_sessions)} sessions
                &middot; {formatNumber(data_sources.summary.total_messages)} messages
              </span>
              <Link className="summary-link" to="/advanced">
                Go to Advanced Settings &rarr;
              </Link>
            </div>
          </section>
        </main>
      </div>
      <Toast />
    </>
  );
}
