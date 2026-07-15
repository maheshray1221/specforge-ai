import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const runIfDatabase = hasTestDatabase ? describe : describe.skip;

runIfDatabase("auth and project API integration", () => {
  let app: Awaited<typeof import("../src/app.js")>["app"];
  let prisma: Awaited<typeof import("../src/config/prisma.js")>["prisma"];

  async function registerUserAndCreateProject(suffix: string) {
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: `Integration ${suffix}`,
        email: `integration-${suffix}-${Date.now()}@example.com`,
        password: "StrongPass123",
      })
      .expect(201);

    const accessToken = registration.body.data.accessToken as string;
    const userId = registration.body.data.user.id as string;
    const workspaceId = registration.body.data.user.workspaces[0].id as string;

    const createdProject = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        workspaceId,
        name: `Integration Project ${suffix}`,
        key: suffix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase(),
        description: "Created by backend integration tests.",
      })
      .expect(201);

    return {
      accessToken,
      userId,
      workspaceId,
      projectId: createdProject.body.data.project.id as string,
    };
  }

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "integration-test-secret-with-at-least-32-characters";
    process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
    process.env.COOKIE_SECURE = "false";
    process.env.LOG_LEVEL = "silent";

    ({ app } = await import("../src/app.js"));
    ({ prisma } = await import("../src/config/prisma.js"));
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.projectIntegrationRun.deleteMany();
    await prisma.projectIntegrationSecret.deleteMany();
    await prisma.projectIntegration.deleteMany();
    await prisma.analyticsEvent.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.projectActivity.deleteMany();
    await prisma.taskComment.deleteMany();
    await prisma.task.deleteMany();
    await prisma.sprint.deleteMany();
    await prisma.aIJob.deleteMany();
    await prisma.aIAnalysis.deleteMany();
    await prisma.requirementVersion.deleteMany();
    await prisma.requirement.deleteMany();
    await prisma.project.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.workspaceInvitation.deleteMany();
    await prisma.workspaceMember.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it("registers a user, creates a project, and enforces workspace-scoped listing", async () => {
    const unique = Date.now();
    const registration = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Integration Tester",
        email: `integration-${unique}@example.com`,
        password: "StrongPass123",
      })
      .expect(201);

    const accessToken = registration.body.data.accessToken as string;
    const workspaceId = registration.body.data.user.workspaces[0].id as string;

    const createdProject = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        workspaceId,
        name: "Integration Project",
        key: "INT",
        description: "Created by backend integration tests.",
      })
      .expect(201);

    expect(createdProject.body.data.project.key).toBe("INT");

    const listedProjects = await request(app)
      .get("/api/v1/projects")
      .query({ workspaceId })
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(listedProjects.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: createdProject.body.data.project.id, key: "INT" }),
      ]),
    );
  });

  it("creates requirement versions and blocks cross-workspace reads", async () => {
    const owner = await registerUserAndCreateProject("REQA");
    const outsider = await registerUserAndCreateProject("REQB");

    const requirement = await request(app)
      .post(`/api/v1/projects/${owner.projectId}/requirements`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "Customer onboarding",
        content: "The app must guide new customers through a secure onboarding checklist.",
      })
      .expect(201);

    expect(requirement.body.data.requirement.versions).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/v1/requirements/${requirement.body.data.requirement.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        content: "The app must guide new customers through a secure onboarding checklist with saved progress.",
        status: "APPROVED",
      })
      .expect(200);

    expect(updated.body.data.requirement.status).toBe("APPROVED");
    expect(updated.body.data.requirement.versions).toHaveLength(2);

    await request(app)
      .get(`/api/v1/requirements/${requirement.body.data.requirement.id}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .expect(404);
  });

  it("plans sprint tasks and rejects capacity overflow", async () => {
    const owner = await registerUserAndCreateProject("SPRT");

    const sprint = await request(app)
      .post(`/api/v1/projects/${owner.projectId}/sprints`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Sprint Capacity",
        goal: "Validate capacity enforcement",
        capacityPoints: 3,
      })
      .expect(201);

    const fittingTask = await prisma.task.create({
      data: {
        projectId: owner.projectId,
        createdById: owner.userId,
        title: "Build onboarding checklist",
        description: "Create the checklist UI and persist completion state.",
        type: "FRONTEND",
        priority: "HIGH",
        storyPoints: 3,
        acceptanceCriteria: ["Checklist can be completed and saved."],
      },
    });

    const overflowTask = await prisma.task.create({
      data: {
        projectId: owner.projectId,
        createdById: owner.userId,
        title: "Create onboarding audit trail",
        description: "Persist audit history for onboarding checklist activity.",
        type: "BACKEND",
        priority: "MEDIUM",
        storyPoints: 5,
        acceptanceCriteria: ["Audit entries are queryable by project admins."],
        position: 1,
      },
    });

    const planned = await request(app)
      .post(`/api/v1/sprints/${sprint.body.data.sprint.id}/tasks/${fittingTask.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(planned.body.data.sprint.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fittingTask.id, status: "TODO", storyPoints: 3 }),
      ]),
    );

    await request(app)
      .post(`/api/v1/sprints/${sprint.body.data.sprint.id}/tasks/${overflowTask.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(409);

    const listedTasks = await request(app)
      .get(`/api/v1/projects/${owner.projectId}/tasks`)
      .query({ status: "TODO" })
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(listedTasks.body.data.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: fittingTask.id, sprintId: sprint.body.data.sprint.id }),
      ]),
    );
  });
});

describe("backend integration test preflight", () => {
  it("documents how to enable DB-backed integration tests", () => {
    if (hasTestDatabase) {
      expect(process.env.TEST_DATABASE_URL).toContain("postgres");
      return;
    }

    expect(process.env.TEST_DATABASE_URL).toBeUndefined();
  });
});
