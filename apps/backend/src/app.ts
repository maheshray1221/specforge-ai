import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openApiDocument } from "./docs/openapi.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { notFoundHandler } from "./middlewares/not-found.middleware.js";
import { apiRouter } from "./routes/index.js";

export const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  const id = req.headers["x-request-id"]?.toString() ?? randomUUID();
  res.setHeader("x-request-id", id);
  next();
});
app.use(pinoHttp({ logger }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.get("/", (_req, res) =>
  res.json({ name: "SpecForge AI API", docs: "/api-docs" }),
);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.get("/openapi.json", (_req, res) => res.json(openApiDocument));
app.use(env.API_PREFIX, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
