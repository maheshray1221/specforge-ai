import type { RequestHandler } from "express";
import { getRouteParam } from "../../utils/route.param.js";
import * as service from "./notification.service.js";

export const list: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      notifications: await service.listNotifications(req.user!.id, req.query as never),
    },
  });

export const markRead: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      notification: await service.markNotificationRead(
        req.user!.id,
        getRouteParam(req.params.notificationId, "notificationId"),
      ),
    },
  });
