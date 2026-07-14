import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./notification.controller.js";
import { listNotificationsSchema, notificationIdSchema } from "./notification.schema.js";

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

notificationRouter.get("/notifications", validate(listNotificationsSchema), asyncHandler(controller.list));
notificationRouter.patch("/notifications/:notificationId/read", validate(notificationIdSchema), asyncHandler(controller.markRead));
