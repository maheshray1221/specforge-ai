import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./integration.controller.js";
import {
  createProjectIntegrationSchema,
  executeProjectIntegrationSchema,
  integrationIdSchema,
  listProjectIntegrationRunsSchema,
  listProjectIntegrationsSchema,
  updateProjectIntegrationSchema,
} from "./integration.schema.js";

export const integrationRouter = Router();
integrationRouter.use(requireAuth);

integrationRouter.get("/projects/:projectId/integrations", validate(listProjectIntegrationsSchema), asyncHandler(controller.listForProject));
integrationRouter.post("/projects/:projectId/integrations", validate(createProjectIntegrationSchema), asyncHandler(controller.createForProject));
integrationRouter.patch("/integrations/:integrationId", validate(updateProjectIntegrationSchema), asyncHandler(controller.update));
integrationRouter.delete("/integrations/:integrationId", validate(integrationIdSchema), asyncHandler(controller.remove));
integrationRouter.get("/integrations/:integrationId/runs", validate(listProjectIntegrationRunsSchema), asyncHandler(controller.listRuns));
integrationRouter.post("/integrations/:integrationId/execute", validate(executeProjectIntegrationSchema), asyncHandler(controller.execute));
