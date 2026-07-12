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
