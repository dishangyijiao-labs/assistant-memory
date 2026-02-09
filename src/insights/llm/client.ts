import type { InsightMessage } from "../../storage/db.js";
import type { InsightGenerationResult, InsightModelConfig, LocalAnalysis } from "../types/index.js";

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const generic = trimmed.match(/\{[\s\S]*\}/);
  if (generic?.[0]) return generic[0].trim();
  throw new Error("MODEL_RESPONSE_NOT_JSON");
}

export async function externalRewrite(
  messages: InsightMessage[],
  local: LocalAnalysis,
  model: InsightModelConfig
): Promise<Pick<InsightGenerationResult, "summary" | "patterns" | "feedback">> {
  if (!model.baseUrl || !model.modelName || !model.apiKey) {
    throw new Error("EXTERNAL_MODEL_CONFIG_MISSING");
  }
  const compactSample = messages
    .slice(-120)
    .map((message) => `[${message.role}] ${message.content.slice(0, 220)}`)
    .join("\n");
  const prompt = [
    "You are generating development insights.",
    "Return strict JSON with keys: summary (string), patterns (string[]), feedback (string[]).",
    "Keep feedback actionable and concise.",
    `Local summary: ${local.summary}`,
    `Local patterns: ${local.patterns.join(" | ")}`,
    `Local feedback: ${local.feedback.join(" | ")}`,
    `Chat sample:\n${compactSample}`,
  ].join("\n");

  const endpoint = model.baseUrl.endsWith("/")
    ? `${model.baseUrl}chat/completions`
    : `${model.baseUrl}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.modelName,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`MODEL_PROVIDER_HTTP_${response.status}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJsonBlock(content)) as {
    summary?: unknown;
    patterns?: unknown;
    feedback?: unknown;
  };
  if (typeof parsed.summary !== "string" || !Array.isArray(parsed.patterns) || !Array.isArray(parsed.feedback)) {
    throw new Error("MODEL_RESPONSE_INVALID_SHAPE");
  }
  return {
    summary: parsed.summary,
    patterns: parsed.patterns.filter((item): item is string => typeof item === "string").slice(0, 6),
    feedback: parsed.feedback.filter((item): item is string => typeof item === "string").slice(0, 6),
  };
}
