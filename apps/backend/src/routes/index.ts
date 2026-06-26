import { Router } from "express";
import { authRouter } from "../modules/auth/auth.route.js";
import { aiAnalysisRouter } from "../modules/ai-analysis/ai-analysis.route.js";
import { projectRouter } from "../modules/projects/project.route.js";
import { projectRequirementRouter, requirementRouter } from "../modules/requirements/requirement.route.js";
import { sprintRouter } from "../modules/sprints/sprint.route.js";
import { taskRouter } from "../modules/tasks/task.route.js";

export const apiRouter = Router();
apiRouter.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } }));
apiRouter.use("/auth", authRouter);
apiRouter.use("/projects", projectRouter);
apiRouter.use("/projects/:projectId/requirements", projectRequirementRouter);
apiRouter.use("/requirements", requirementRouter);
apiRouter.use(aiAnalysisRouter);
apiRouter.use(taskRouter);
apiRouter.use(sprintRouter);
