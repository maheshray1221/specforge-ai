import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default("/api/v1"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  LOG_LEVEL: z.string().default("info"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  GROQ_MODEL: z.enum(["openai/gpt-oss-20b", "openai/gpt-oss-120b"]).default("openai/gpt-oss-120b"),
  GROQ_REASONING_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  AI_MAX_INPUT_CHARACTERS: z.coerce.number().int().min(1000).max(200000).default(60000),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(5000).max(300000).default(120000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
