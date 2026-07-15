import { expect, test } from "@playwright/test";

const apiPattern = /\/api\/v1\/(.*)$/;

const user = {
  id: "user-e2e",
  name: "Mahesh Ray",
  email: "mahesh.e2e@example.com",
  workspaces: [
    {
      id: "workspace-e2e",
      name: "Mahesh Ray's Workspace",
      role: "OWNER",
    },
  ],
};

const createdProject = {
  id: "project-e2e",
  workspaceId: "workspace-e2e",
  name: "Customer Portal",
  key: "PORTAL",
  description: "Self-service portal for customers.",
  status: "ACTIVE",
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
  _count: {
    requirements: 0,
    tasks: 0,
    sprints: 0,
  },
};

const requirement = {
  id: "requirement-e2e",
  projectId: createdProject.id,
  title: "Customer onboarding",
  currentContent: "Customers need to sign up, verify their email, and complete onboarding before using the portal.",
  status: "READY",
  clarificationAnswers: null,
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
  versions: [
    {
      id: "requirement-version-e2e",
      versionNumber: 1,
      content: "Customers need to sign up, verify their email, and complete onboarding before using the portal.",
      createdAt: "2026-07-12T00:00:00.000Z",
    },
  ],
  analyses: [],
};

const completedAnalysis = {
  id: "analysis-e2e",
  requirementId: requirement.id,
  requirementVersionId: "requirement-version-e2e",
  provider: "groq",
  model: "openai/gpt-oss-120b",
  status: "COMPLETED",
  errorMessage: null,
  errorCategory: null,
  promptSchemaVersion: "requirement-analysis:v1",
  attempts: 1,
  durationMs: 1200,
  promptTokens: 100,
  completionTokens: 200,
  totalTokens: 300,
  taskGenerationAttempts: 0,
  taskGenerationDurationMs: null,
  taskGenerationPromptTokens: null,
  taskGenerationCompletionTokens: null,
  taskGenerationTotalTokens: null,
  taskGenerationErrorCategory: null,
  taskGenerationErrorMessage: null,
  clarificationQuestions: [
    {
      question: "Which email provider should be used?",
      reason: "Email verification depends on provider capabilities.",
      options: ["SendGrid", "AWS SES"],
      required: true,
    },
  ],
  functionalRequirements: [
    {
      id: "FR-1",
      title: "Email verification",
      description: "Users must verify email before onboarding is complete.",
      priority: "HIGH",
    },
  ],
  nonFunctionalRequirements: [
    {
      category: "Security",
      description: "Verification links must expire.",
      measurableTarget: "Links expire within 30 minutes.",
    },
  ],
  userStories: [
    {
      id: "US-1",
      role: "customer",
      goal: "verify my email",
      benefit: "my account is secure",
      acceptanceCriteria: ["Verification email is sent", "Expired links are rejected"],
      storyPoints: 3,
    },
  ],
  technicalPlan: {
    summary: "Build an onboarding flow with email verification.",
    frontend: ["Signup form", "Verification status page"],
    backend: ["Verification token service"],
    database: ["User verification fields"],
    integrations: ["Email provider"],
    apiEndpoints: [
      {
        method: "POST",
        path: "/auth/register",
        purpose: "Create customer account",
      },
    ],
    entities: [
      {
        name: "User",
        fields: ["email", "emailVerifiedAt"],
        relationships: [],
      },
    ],
  },
  risks: [
    {
      title: "Email delivery",
      impact: "Users may not receive verification links.",
      mitigation: "Use retries and provider monitoring.",
    },
  ],
  rawOutput: null,
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
};

const generatedTask = {
  id: "task-e2e",
  projectId: createdProject.id,
  requirementId: requirement.id,
  analysisId: completedAnalysis.id,
  sprintId: null,
  assigneeId: null,
  createdById: user.id,
  title: "Implement email verification",
  description: "Create verification token generation and validation.",
  type: "BACKEND",
  priority: "HIGH",
  status: "BACKLOG",
  storyPoints: 3,
  acceptanceCriteria: ["Verification token is generated", "Expired token is rejected"],
  labels: ["story:US-1"],
  position: 0,
  sprint: null,
  assignee: null,
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
};

test("new user can register and create a project", async ({ page }) => {
  let isAuthenticated = false;
  let projects: typeof createdProject[] = [];

  await page.route(apiPattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (path === "/auth/me") {
      if (!isAuthenticated) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: { message: "Unauthorized" },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { user } }),
      });
      return;
    }

    if (path === "/auth/register" && request.method() === "POST") {
      isAuthenticated = true;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { user, accessToken: "e2e-access-token" },
        }),
      });
      return;
    }

    if (path === "/projects" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { projects },
        }),
      });
      return;
    }

    if (path === "/projects" && request.method() === "POST") {
      projects = [createdProject, ...projects];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { project: createdProject },
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto("/register");
  await page.getByLabel("Full name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("Password1");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByText("No projects found")).toBeVisible();

  await page.getByRole("button", { name: /new project/i }).click();
  await page.getByLabel("Project name").fill(createdProject.name);
  await page.getByLabel("Project key").fill(createdProject.key);
  await page.getByLabel("Description").fill(createdProject.description);
  await page.getByRole("button", { name: /^create project$/i }).click();

  await expect(page.getByText(createdProject.name)).toBeVisible();
  await expect(page.getByText(createdProject.key, { exact: true })).toBeVisible();
});

test("user resolves clarifications, approves a requirement, and generates tasks", async ({ page }) => {
  let currentRequirement: typeof requirement | null = null;
  let currentAnalysis: typeof completedAnalysis | null = null;
  let tasks: typeof generatedTask[] = [];
  let feedbackSubmitted = 0;
  let comments: Array<{
    id: string;
    taskId: string;
    projectId: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    author: { id: string; name: string; email: string };
  }> = [];
  let notifications = [{
    id: "550e8400-e29b-41d4-a716-446655440098",
    projectId: createdProject.id,
    title: "Task generated",
    body: "Your AI-generated task backlog is ready.",
    readAt: null as string | null,
    metadata: {},
    createdAt: "2026-07-12T00:00:00.000Z",
  }];
  let integrations = [{
    id: "550e8400-e29b-41d4-a716-446655440097",
    projectId: createdProject.id,
    provider: "GITHUB",
    status: "CONNECTED",
    displayName: "GitHub issues",
    externalRef: "specforge/demo",
    config: { labels: ["specforge"], dryRun: true },
    lastSyncedAt: null,
    lastError: null,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  }];
  let invitations: Array<{
    id: string;
    workspaceId: string;
    email: string;
    role: "ADMIN" | "MEMBER" | "VIEWER";
    acceptedAt: string | null;
    cancelledAt: string | null;
    expiresAt: string;
    createdAt: string;
    invitedBy: { id: string; name: string; email: string };
    acceptanceToken?: string;
  }> = [];

  await page.route(apiPattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (path === "/auth/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { user } }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { project: createdProject } }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/requirements` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { requirements: currentRequirement ? [currentRequirement] : [] },
        }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/requirements` && request.method() === "POST") {
      currentRequirement = { ...requirement };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { requirement: currentRequirement },
        }),
      });
      return;
    }

    if (path === `/requirements/${requirement.id}/analyses` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { analyses: currentAnalysis ? [currentAnalysis] : [] },
        }),
      });
      return;
    }

    if (path === `/requirements/${requirement.id}/analyze` && request.method() === "POST") {
      currentRequirement = currentRequirement
        ? { ...currentRequirement, status: "NEEDS_CLARIFICATION", analyses: [{ id: completedAnalysis.id, status: "COMPLETED", provider: "groq", model: completedAnalysis.model, createdAt: completedAnalysis.createdAt }] }
        : currentRequirement;
      currentAnalysis = { ...completedAnalysis };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { analysis: currentAnalysis, reused: false },
        }),
      });
      return;
    }

    if (path === `/requirements/${requirement.id}` && request.method() === "PATCH") {
      const payload = await request.postDataJSON();
      currentRequirement = {
        ...(currentRequirement ?? requirement),
        status: payload.status,
        clarificationAnswers: payload.clarificationAnswers
          ? payload.clarificationAnswers.map((item: { question: string; answer: string; required: boolean }) => ({
            ...item,
            resolvedAt: "2026-07-12T00:00:00.000Z",
            resolvedBy: user.id,
          }))
          : currentRequirement?.clarificationAnswers ?? null,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { requirement: currentRequirement },
        }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/tasks` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { tasks } }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/usage` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            period: { start: "2026-07-01T00:00:00.000Z", end: "2026-07-31T23:59:59.999Z" },
            usage: {
              aiJobs: currentAnalysis ? 1 : 0,
              promptTokens: currentAnalysis?.promptTokens ?? 0,
              completionTokens: currentAnalysis?.completionTokens ?? 0,
              totalTokens: currentAnalysis?.totalTokens ?? 0,
              aiJobsByStatus: {
                QUEUED: 0,
                PROCESSING: 0,
                COMPLETED: currentAnalysis ? 1 : 0,
                FAILED: 0,
              },
            },
            quotas: { aiJobs: 100, totalTokens: 100000 },
            remaining: { aiJobs: currentAnalysis ? 99 : 100, totalTokens: 100000 - (currentAnalysis?.totalTokens ?? 0) },
          },
        }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/analytics/summary` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            period: { since: "2026-07-01T00:00:00.000Z", until: "2026-07-31T23:59:59.999Z", days: 30 },
            eventsByType: {
              USER_REGISTERED: 1,
              PROJECT_CREATED: 1,
              REQUIREMENT_CREATED: currentRequirement ? 1 : 0,
              REQUIREMENT_ANALYZED: currentAnalysis ? 1 : 0,
              REQUIREMENT_APPROVED: currentRequirement?.status === "APPROVED" ? 1 : 0,
              TASKS_GENERATED: tasks.length > 0 ? 1 : 0,
              SPRINT_CREATED: 0,
              ANALYSIS_FEEDBACK_SUBMITTED: feedbackSubmitted,
            },
            activationFunnel: {
              projectCreated: 1,
              requirementCreated: currentRequirement ? 1 : 0,
              requirementAnalyzed: currentAnalysis ? 1 : 0,
              requirementApproved: currentRequirement?.status === "APPROVED" ? 1 : 0,
              tasksGenerated: tasks.length > 0 ? 1 : 0,
              sprintCreated: 0,
            },
            aiFeedback: { submitted: feedbackSubmitted },
          },
        }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/activity` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            activity: tasks.length > 0 ? [{
              id: "550e8400-e29b-41d4-a716-446655440099",
              projectId: createdProject.id,
              action: "TASK_COMMENTED",
              entityType: "TASK",
              entityId: generatedTask.id,
              metadata: { taskTitle: generatedTask.title },
              createdAt: "2026-07-12T00:00:00.000Z",
              actor: { id: user.id, name: user.name, email: user.email },
            }] : [],
          },
        }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/members` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            members: [{
              id: "workspace-member-e2e",
              role: "OWNER",
              createdAt: "2026-07-12T00:00:00.000Z",
              user: { id: user.id, name: user.name, email: user.email },
            }],
          },
        }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/invitations` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { invitations } }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/invitations` && request.method() === "POST") {
      const payload = await request.postDataJSON();
      const invitation = {
        id: "550e8400-e29b-41d4-a716-446655440096",
        workspaceId: createdProject.workspaceId,
        email: payload.email,
        role: payload.role,
        acceptedAt: null,
        cancelledAt: null,
        expiresAt: "2026-07-26T00:00:00.000Z",
        createdAt: "2026-07-12T00:00:00.000Z",
        invitedBy: { id: user.id, name: user.name, email: user.email },
        acceptanceToken: "e2e-invite-token-12345678901234567890123456789012",
      };
      invitations = [invitation, ...invitations];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { invitation } }),
      });
      return;
    }

    if (path === "/invitations/550e8400-e29b-41d4-a716-446655440096" && request.method() === "DELETE") {
      invitations = invitations.map((invitation) => ({ ...invitation, cancelledAt: "2026-07-12T00:02:00.000Z" }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { invitation: invitations[0] } }),
      });
      return;
    }

    if (path === "/notifications" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            notifications,
          },
        }),
      });
      return;
    }

    if (path === `/notifications/${notifications[0].id}/read` && request.method() === "PATCH") {
      notifications = notifications.map((notification) => ({
        ...notification,
        readAt: "2026-07-12T00:01:00.000Z",
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { notification: notifications[0] } }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/integrations` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            integrations,
          },
        }),
      });
      return;
    }

    if (path === `/integrations/${integrations[0].id}/runs` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { runs: [] } }),
      });
      return;
    }

    if (path === `/integrations/${integrations[0].id}/secrets` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { secrets: [] } }),
      });
      return;
    }

    if (path === `/integrations/${integrations[0].id}` && request.method() === "PATCH") {
      const payload = await request.postDataJSON();
      integrations = integrations.map((integration) => ({
        ...integration,
        status: payload.status ?? integration.status,
        updatedAt: "2026-07-12T00:02:00.000Z",
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { integration: integrations[0] } }),
      });
      return;
    }

    if (path === `/analyses/${completedAnalysis.id}/feedback` && request.method() === "POST") {
      feedbackSubmitted += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            event: {
              id: "550e8400-e29b-41d4-a716-446655440096",
              type: "ANALYSIS_FEEDBACK_SUBMITTED",
              userId: user.id,
              projectId: createdProject.id,
              entityType: "AIAnalysis",
              entityId: completedAnalysis.id,
              metadata: { useful: true },
              createdAt: "2026-07-12T00:03:00.000Z",
            },
          },
        }),
      });
      return;
    }

    if (path === `/tasks/${generatedTask.id}/comments` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { comments } }),
      });
      return;
    }

    if (path === `/tasks/${generatedTask.id}` && request.method() === "PATCH") {
      const payload = await request.postDataJSON();
      tasks = tasks.map((task) => ({
        ...task,
        ...payload,
        assigneeId: payload.assigneeId ?? task.assigneeId,
        assignee: payload.assigneeId ? { id: user.id, name: user.name, email: user.email } : null,
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { task: tasks[0] } }),
      });
      return;
    }

    if (path === `/tasks/${generatedTask.id}/comments` && request.method() === "POST") {
      const payload = await request.postDataJSON();
      const comment = {
        id: "550e8400-e29b-41d4-a716-446655440095",
        taskId: generatedTask.id,
        projectId: createdProject.id,
        body: payload.body,
        createdAt: "2026-07-12T00:04:00.000Z",
        updatedAt: "2026-07-12T00:04:00.000Z",
        author: { id: user.id, name: user.name, email: user.email },
      };
      comments = [...comments, comment];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { comment } }),
      });
      return;
    }

    if (path === `/analyses/${completedAnalysis.id}/tasks/generate` && request.method() === "POST") {
      tasks = [generatedTask];
      currentAnalysis = currentAnalysis
        ? {
          ...currentAnalysis,
          taskGenerationAttempts: 1,
          taskGenerationDurationMs: 900,
          taskGenerationPromptTokens: 120,
          taskGenerationCompletionTokens: 160,
          taskGenerationTotalTokens: 280,
        }
        : currentAnalysis;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { tasks, generationNotes: [], reused: false },
        }),
      });
      return;
    }

    if (path === `/projects/${createdProject.id}/sprints` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { sprints: [] } }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/dashboard/projects/${createdProject.id}`);
  await expect(page.getByRole("heading", { name: createdProject.name })).toBeVisible();

  await page.getByRole("button", { name: /add requirement/i }).click();
  const requirementDialog = page.getByRole("dialog", { name: "Add client requirement" });
  await requirementDialog.getByLabel("Title").fill(requirement.title);
  await requirementDialog.getByLabel("Requirement").fill(requirement.currentContent);
  await requirementDialog.getByRole("button", { name: /save requirement/i }).click();

  await page.getByRole("tab", { name: /ai analysis/i }).click();
  await page.getByRole("button", { name: /run ai analysis/i }).click();
  await expect(page.getByText("Required clarification answers")).toBeVisible();

  await page.getByPlaceholder("Write the decision or answer here...").fill("Use SendGrid for transactional email.");
  await page.getByRole("button", { name: /save answers and mark ready/i }).click();
  await expect(page.getByText("Approve this requirement before generating tasks.")).toBeVisible();

  await page.getByRole("button", { name: /^approve$/i }).click();
  await expect(page.getByRole("button", { name: /generate tasks/i })).toBeEnabled();

  await page.getByRole("button", { name: /generate tasks/i }).click();
  await page.getByRole("tab", { name: /tasks/i }).click();
  await expect(page.getByText(generatedTask.title)).toBeVisible();

  await expect(page.getByText("Usage & quotas")).toBeVisible();
  await expect(page.getByText("99 remaining")).toBeVisible();

  await page.getByRole("tab", { name: /ai analysis/i }).click();
  await page.getByRole("button", { name: /^useful$/i }).click();
  await expect(page.getByText("Thanks — marked this AI output as useful.")).toBeVisible();

  await page.getByRole("tab", { name: /analytics/i }).click();
  await expect(page.getByText("Activation funnel")).toBeVisible();
  await expect(page.getByText("feedback submissions")).toBeVisible();

  await page.getByRole("tab", { name: /collaboration/i }).click();
  await expect(page.getByText("Project activity")).toBeVisible();
  await expect(page.getByText("Task generated")).toBeVisible();
  await page.getByRole("button", { name: /mark read/i }).click();
  await expect(page.getByText("0 unread notifications.")).toBeVisible();
  await page.getByPlaceholder("teammate@example.com").fill("teammate@example.com");
  await page.getByRole("button", { name: /create invite/i }).click();
  await expect(page.getByText("One-time acceptance token")).toBeVisible();
  await expect(page.getByText("teammate@example.com")).toBeVisible();
  await page.getByRole("button", { name: /cancel invite/i }).click();
  await expect(page.getByText("No pending invitations.")).toBeVisible();

  await page.getByRole("tab", { name: /tasks/i }).click();
  await page.getByLabel("Task assignee").selectOption(user.id);
  await expect(page.getByText(`${user.name} · Backlog`)).toBeVisible();
  await page.getByRole("button", { name: /comments/i }).click();
  await page.getByPlaceholder(`Comment on "${generatedTask.title}"...`).fill("Looks good for backend implementation.");
  await page.getByRole("button", { name: /post comment/i }).click();
  await expect(page.getByText("Looks good for backend implementation.")).toBeVisible();

  await page.getByRole("tab", { name: /integrations/i }).click();
  await expect(page.getByText("GitHub issues")).toBeVisible();
  await expect(page.getByText("CONNECTED")).toBeVisible();
  await page.getByRole("button", { name: /^pause$/i }).click();
  await expect(page.getByText("PAUSED")).toBeVisible();
});
