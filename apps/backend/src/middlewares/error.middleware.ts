import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { ApiError } from "../utils/api-error.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  void _next;
  let statusCode = 500;
  let message = "Internal server error";
  let details: unknown;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 422;
    message = "Validation failed";
    details = error.issues;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      statusCode = 409;
      message = "A record with the same unique value already exists";
    } else if (error.code === "P2025") {
      statusCode = 404;
      message = "Requested record was not found";
    }
  } else if (error instanceof SyntaxError && "body" in error) {
    statusCode = 400;
    message = "Request body contains invalid JSON";
  }

  if (statusCode >= 500) {
    logger.error({ err: error, requestId: res.getHeader("x-request-id"), path: req.path }, message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(details !== undefined ? { details } : {}),
      ...(env.NODE_ENV === "development" && statusCode >= 500 && error instanceof Error
        ? { stack: error.stack }
        : {}),
    },
    requestId: res.getHeader("x-request-id"),
  });
};
