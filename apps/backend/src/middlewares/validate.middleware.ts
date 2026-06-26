import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { ApiError } from "../utils/api-error.js";

type ValidatedRequestData = {
  body?: unknown;
  params?: unknown;
  query?: unknown;
};

export const validate =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!parsed.success) {
      return next(
        new ApiError(
          422,
          "Validation failed",
          parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
    }

    const data = parsed.data as ValidatedRequestData;

    if (data.body !== undefined) {
      req.body = data.body;
    }

    if (data.params !== undefined) {
      req.params = data.params as typeof req.params;
    }

    /*
     * Express 5 me req.query getter hota hai.
     * Isliye direct `req.query = data.query` error deta hai.
     */
    if (data.query !== undefined) {
      Object.defineProperty(req, "query", {
        value: data.query as typeof req.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    return next();
  };
