import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./operations.controller.js";

export const operationsRouter = Router();

operationsRouter.get("/health", controller.health);
operationsRouter.get("/ready", asyncHandler(controller.readiness));
