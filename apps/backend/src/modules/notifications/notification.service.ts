import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

const notificationSelect = {
  id: true,
  projectId: true,
  title: true,
  body: true,
  readAt: true,
  metadata: true,
  createdAt: true,
} as const;

export async function listNotifications(userId: string, input: { unreadOnly?: boolean; limit?: number }) {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(input.unreadOnly ? { readAt: null } : {}),
    },
    select: notificationSelect,
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 50,
  });
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  if (!notification) throw new ApiError(404, "Notification was not found");

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
    select: notificationSelect,
  });
}
