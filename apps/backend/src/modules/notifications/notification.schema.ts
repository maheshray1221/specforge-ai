import { z } from "zod";

export const listNotificationsSchema = z.object({
  query: z.object({
    unreadOnly: z.coerce.boolean().default(false),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({ notificationId: z.string().uuid() }),
});
