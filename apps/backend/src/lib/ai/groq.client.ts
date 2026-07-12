import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

type AIErrorCategory =
  | "CONFIGURATION"
  | "INPUT_TOO_LARGE"
  | "RATE_LIMIT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_BAD_RESPONSE"
  | "TIMEOUT"
  | "VALIDATION"
  | "UNKNOWN";

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

export interface AITelemetry {
  attempts: number;
  durationMs: number;
  errorCategory: AIErrorCategory | null;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
}

export interface AIErrorDetails {
  aiErrorCategory: AIErrorCategory;
  attempts: number;
  durationMs: number;
  providerStatus?: number;
  cause?: unknown;
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function durationSince(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

function buildAIError(
  statusCode: number,
  message: string,
  details: AIErrorDetails,
): ApiError {
  return new ApiError(statusCode, message, details);
}

function categoryForStatus(status: number): AIErrorCategory {
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "PROVIDER_BAD_RESPONSE";
}

function categoryForError(error: unknown): AIErrorCategory {
  if (error instanceof SyntaxError) return "PROVIDER_BAD_RESPONSE";

  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return "TIMEOUT";
    }

    if (error.name === "ZodError") {
      return "VALIDATION";
    }
  }

  return "UNKNOWN";
}

export async function generateStructuredOutput<T>(request: StructuredRequest<T>) {
  const startedAt = Date.now();

  if (!env.GROQ_API_KEY) {
    throw buildAIError(503, "GROQ_API_KEY is not configured", {
      aiErrorCategory: "CONFIGURATION",
      attempts: 0,
      durationMs: durationSince(startedAt),
    });
  }

  if (request.prompt.length > env.AI_MAX_INPUT_CHARACTERS) {
    throw buildAIError(413, "AI input is too large", {
      aiErrorCategory: "INPUT_TOO_LARGE",
      attempts: 0,
      durationMs: durationSince(startedAt),
    });
  }

  let lastError: unknown;
  let attempts = 0;
  for (let attempt = 0; attempt <= env.AI_MAX_RETRIES; attempt += 1) {
    attempts = attempt + 1;
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
        throw buildAIError(response.status === 429 ? 429 : 502, message, {
          aiErrorCategory: categoryForStatus(response.status),
          attempts,
          durationMs: durationSince(startedAt),
          providerStatus: response.status,
        });
      }

      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw buildAIError(502, "Groq returned an empty response", {
          aiErrorCategory: "PROVIDER_BAD_RESPONSE",
          attempts,
          durationMs: durationSince(startedAt),
        });
      }
      const parsedJson: unknown = JSON.parse(content);
      const data = request.parse(parsedJson);
      const usage = payload.usage ?? null;

      return {
        data,
        usage,
        telemetry: {
          attempts,
          durationMs: durationSince(startedAt),
          errorCategory: null,
          usage,
        } satisfies AITelemetry,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError) throw error;
      if (attempt < env.AI_MAX_RETRIES) {
        await wait(500 * 2 ** attempt);
        continue;
      }
    }
  }

  const category = categoryForError(lastError);

  throw buildAIError(502, "AI generation failed", {
    aiErrorCategory: category,
    attempts,
    durationMs: durationSince(startedAt),
    cause: lastError instanceof Error ? lastError.message : lastError,
  });
}
