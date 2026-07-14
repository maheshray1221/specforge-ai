import { z } from "zod";

export const projectUsageSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
});
