import { AIJobStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";

export function getHealthStatus() {
  return {
    status: "ok",
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export async function getReadinessStatus() {
  const database = await prisma.$queryRaw`SELECT 1 as ready`;
  const aiJobCounts = await prisma.aIJob.groupBy({
    by: ["status"],
    _count: {
      status: true,
    },
  });

  return {
    status: "ready",
    checks: {
      database: Array.isArray(database) ? "ok" : "unknown",
      aiJobs: Object.fromEntries(
        Object.values(AIJobStatus).map((status) => [
          status,
          aiJobCounts.find((item) => item.status === status)?._count.status ?? 0,
        ]),
      ),
    },
    timestamp: new Date().toISOString(),
  };
}
