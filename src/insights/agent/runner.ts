import { AGENT_TOOLS, executeTool } from "./tools.js";

export interface AgentConfig {
  baseUrl: string;
  modelName: string;
  apiKey: string;
}

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content?: string; tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }
  | { role: "tool"; content: string; tool_call_id: string };

const MAX_TURNS = 8;

/**
 * Run agent loop: LLM can call tools (search_sessions, get_session_detail, etc.),
 * we execute tools and feed results back until LLM produces final text response.
 */
export async function runAgentLoop(
  config: AgentConfig,
  userPrompt: string,
  systemPrompt: string
): Promise<{ summary: string; patterns: string[]; feedback: string[] }> {
  const endpoint = config.baseUrl.endsWith("/")
    ? `${config.baseUrl}chat/completions`
    : `${config.baseUrl}/chat/completions`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const body: Record<string, unknown> = {
      model: config.modelName,
      temperature: 0.2,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: turn === 0 ? "auto" : "auto",
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`AGENT_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const msg = payload.choices?.[0]?.message;
    if (!msg) throw new Error("AGENT_EMPTY_RESPONSE");

    messages.push({
      role: "assistant",
      content: msg.content ?? undefined,
      tool_calls: msg.tool_calls?.map((tc) => ({
        ...tc,
        type: "function" as const,
      })),
    });

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const content = (msg.content ?? "").trim();
      return parseFinalResponse(content);
    }

    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        // ignore parse error
      }
      const result = executeTool(name, args);
      messages.push({ role: "tool", content: result, tool_call_id: tc.id });
    }
  }

  throw new Error("AGENT_MAX_TURNS_EXCEEDED");
}

function parseFinalResponse(content: string): { summary: string; patterns: string[]; feedback: string[] } {
  const m = content.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]) as { summary?: string; patterns?: unknown; feedback?: unknown };
      return {
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        patterns: Array.isArray(parsed.patterns) ? parsed.patterns.filter((p): p is string => typeof p === "string").slice(0, 6) : [],
        feedback: Array.isArray(parsed.feedback) ? parsed.feedback.filter((f): f is string => typeof f === "string").slice(0, 6) : [],
      };
    } catch {
      // fall through
    }
  }
  return {
    summary: content.slice(0, 500),
    patterns: [],
    feedback: [],
  };
}
