import * as Sentry from "@sentry/node";
import type { Request } from "express";
import { env } from "../config/env.js";

const enabled = Boolean(env.SENTRY_DSN);

if (enabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
}

export function captureException(error: unknown, context?: { request?: Request; tags?: Record<string, string>; extra?: Record<string, unknown> }) {
  if (!enabled) return;

  Sentry.withScope((scope) => {
    if (context?.request) {
      scope.setTag("request_id", String(context.request.id));
      scope.setContext("request", {
        method: context.request.method,
        path: context.request.path,
        originalUrl: context.request.originalUrl,
      });
    }
    for (const [key, value] of Object.entries(context?.tags ?? {})) scope.setTag(key, value);
    for (const [key, value] of Object.entries(context?.extra ?? {})) scope.setExtra(key, value);
    Sentry.captureException(error);
  });
}

export async function flushMonitoring(timeoutMs = 2000) {
  if (!enabled) return true;
  return Sentry.flush(timeoutMs);
}
