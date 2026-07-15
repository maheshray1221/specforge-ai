import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
const runIfDatabase = hasTestDatabase ? describe : describe.skip;

runIfDatabase("auth and project API integration", () => {
  let app: Awaited<typeof import("../src/app.js")>["app"];
  let prisma: Awaited<typeof import("../src/config/prisma.js")>["prisma"];

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
