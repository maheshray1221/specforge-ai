import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

interface StructuredRequest<T> {
  schemaName: string;
  schema: Record<string, unknown>;
  system: string;
  prompt: string;
  parse: (value: unknown) => T;
  maxOutputTokens?: number;
}

interface GroqResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function generateStructuredOutput<T>(request: StructuredRequest<T>) {
  if (!env.GROQ_API_KEY) throw new ApiError(503, "GROQ_API_KEY is not configured");

  if (request.prompt.length > env.AI_MAX_INPUT_CHARACTERS) {
    throw new ApiError(413, "AI input is too large");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= env.AI_MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL,
          temperature: 0,
          reasoning_effort: env.GROQ_REASONING_EFFORT,
          max_completion_tokens: request.maxOutputTokens ?? 2500,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: request.schemaName, strict: true, schema: request.schema },
          },
        }),
        signal: AbortSignal.timeout(env.AI_REQUEST_TIMEOUT_MS),
      });

      const payload = (await response.json()) as GroqResponse;
      if (!response.ok) {
        const message = payload.error?.message ?? `Groq request failed with status ${response.status}`;
        if ((response.status === 429 || response.status >= 500) && attempt < env.AI_MAX_RETRIES) {
          await wait(500 * 2 ** attempt);
          continue;
        }
        throw new ApiError(response.status === 429 ? 429 : 502, message);
      }

      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new ApiError(502, "Groq returned an empty response");
      const parsedJson: unknown = JSON.parse(content);
      return { data: request.parse(parsedJson), usage: payload.usage ?? null };
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError) throw error;
      if (attempt < env.AI_MAX_RETRIES) {
        await wait(500 * 2 ** attempt);
        continue;
      }
    }
  }
  throw new ApiError(502, "AI generation failed", lastError instanceof Error ? lastError.message : lastError);
}
