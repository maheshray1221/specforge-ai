import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./requirement.controller.js";
import { createRequirementSchema, listRequirementsSchema, requirementIdSchema, updateRequirementSchema } from "./requirement.schema.js";

export const projectRequirementRouter = Router({ mergeParams: true });
projectRequirementRouter.use(requireAuth);
projectRequirementRouter.post("/", validate(createRequirementSchema), asyncHandler(controller.create));
projectRequirementRouter.get("/", validate(listRequirementsSchema), asyncHandler(controller.list));

export const requirementRouter = Router();
requirementRouter.use(requireAuth);
requirementRouter.get("/:requirementId", validate(requirementIdSchema), asyncHandler(controller.getOne));
requirementRouter.patch("/:requirementId", validate(updateRequirementSchema), asyncHandler(controller.update));
requirementRouter.delete("/:requirementId", validate(requirementIdSchema), asyncHandler(controller.remove));
