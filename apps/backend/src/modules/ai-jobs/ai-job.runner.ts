import { logger } from "../../lib/logger.js";

interface RunAIJobInBackgroundInput {
  jobId: string;
  jobName: string;
  run: () => Promise<void>;
}

export function runAIJobInBackground(input: RunAIJobInBackgroundInput): void {
  setImmediate(() => {
    void input
      .run()
      .catch((error: unknown) => {
        logger.error(
          {
            error,
            jobId: input.jobId,
            jobName: input.jobName,
          },
          "Background AI job failed",
        );
      });
  });
}
