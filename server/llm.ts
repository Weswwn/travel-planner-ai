import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAI as getClaude } from "./claude";

const CLAUDE_MODEL = "claude-opus-5";

// Set LLM_PROVIDER=ollama to run against a local Ollama server instead of the
// (paid, no-free-tier) Claude API - useful for development/testing without
// burning API credits. Reuses the exact same Zod schemas for both providers.
const USE_OLLAMA = process.env.LLM_PROVIDER === "ollama";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1";

const generateWithOllama = async <T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
): Promise<z.infer<T> | null> => {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: "user", content: prompt }],
      format: z.toJSONSchema(schema),
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data?.message?.content;
  if (!content) return null;

  // Local models are far less reliable than Claude at strictly honoring a
  // schema - validate rather than trust, and let the caller's existing
  // "empty result" handling take over on failure instead of crashing.
  const parsed = schema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    console.error("Ollama response failed schema validation:", parsed.error);
    return null;
  }
  return parsed.data;
};

const generateWithClaude = async <T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
): Promise<z.infer<T> | null> => {
  const ai = getClaude();
  const response = await ai.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(schema) },
  });
  return response.parsed_output;
};

export const generateStructured = <T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
): Promise<z.infer<T> | null> =>
  USE_OLLAMA ? generateWithOllama(prompt, schema) : generateWithClaude(prompt, schema);
