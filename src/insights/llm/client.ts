import type { InsightMessage } from "../../storage/db.js";
import { retrieveSimilarUserQuestions } from "../../storage/queries/rag.js";
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

  let ragContext = "";
  const userQuestions = messages.filter((m) => m.role === "user").map((m) => m.content.trim()).filter((c) => c.length > 10);
  if (userQuestions.length > 0) {
    const query = userQuestions.slice(0, 3).join(" ");
    const similar = retrieveSimilarUserQuestions({
      query,
      limit: 5,
      minScore: 80,
    });
    if (similar.length > 0) {
      ragContext = "\n\nHigh-quality prompt examples from this user's history (use as reference for actionable feedback):\n" +
        similar.map((s, i) => `[${i + 1}] (score ${s.score ?? "?"}) ${s.content.slice(0, 200)}...`).join("\n") +
        "\n";
    }
  }

  const prompt = [
    "You are generating development insights. Goal: help the user ask BETTER questions next time.",
    "Return strict JSON with keys: summary (string), patterns (string[]), feedback (string[]).",
    "Feedback MUST be actionable: 'Next time when X, ask like: [concrete prompt example]' — NOT generic advice.",
    `Local summary: ${local.summary}`,
    `Local patterns: ${local.patterns.join(" | ")}`,
    `Local feedback: ${local.feedback.join(" | ")}`,
    ragContext,
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
