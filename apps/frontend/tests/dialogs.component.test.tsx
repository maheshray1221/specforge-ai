import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { ApiClientError } from "@/lib/api";
import type { Project, Task } from "@/lib/types";

const apiMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...actual,
    api: apiMock,
  };
});

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Customer Portal",
  key: "CUSTOM",
  description: "Customer self-service project",
  status: "ACTIVE",
  createdAt: "2026-07-15T00:00:00.000Z",
  updatedAt: "2026-07-15T00:00:00.000Z",
  _count: { requirements: 0, tasks: 0, sprints: 0 },
};

const task: Task = {
  id: "task-1",
  projectId: "project-1",
  requirementId: null,
  analysisId: null,
  sprintId: null,
  assigneeId: null,
  title: "Build onboarding form",
  description: "Create a guided onboarding form for new customers.",
  type: "FRONTEND",
  priority: "HIGH",
  status: "BACKLOG",
  storyPoints: 5,
  acceptanceCriteria: ["The form saves progress."],
  labels: ["ui", "onboarding"],
  position: 0,
  sprint: null,
  assignee: null,
};

describe("project and task dialogs", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("creates a project with an auto-generated key and resets the dialog", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    apiMock.mockResolvedValue({ project });

    render(<CreateProjectDialog workspaceId="workspace-1" onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: /new project/i }));
    await user.type(screen.getByLabelText(/project name/i), "Customer Portal");
    await user.type(screen.getByLabelText(/description/i), "Customer self-service project");
    await user.click(screen.getByRole("button", { name: /create project/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/projects",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            workspaceId: "workspace-1",
            name: "Customer Portal",
            key: "CUSTOM",
            description: "Customer self-service project",
          }),
        }),
      );
    });
    expect(onCreated).toHaveBeenCalledWith(project);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("submits edited task details as a normalized PATCH payload", async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    const updatedTask = { ...task, title: "Build onboarding wizard", storyPoints: 8, labels: ["ui", "growth"] };
    apiMock.mockResolvedValue({ task: updatedTask });

    render(<EditTaskDialog task={task} onUpdated={onUpdated} />);

    await user.click(screen.getByRole("button", { name: /edit build onboarding form/i }));
    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), "Build onboarding wizard");
    await user.selectOptions(screen.getByLabelText(/story points/i), "8");
    await user.clear(screen.getByLabelText(/labels/i));
    await user.type(screen.getByLabelText(/labels/i), "ui, growth");
    await user.click(screen.getByRole("button", { name: /save task/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/tasks/task-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            title: "Build onboarding wizard",
            description: "Create a guided onboarding form for new customers.",
            type: "FRONTEND",
            priority: "HIGH",
            storyPoints: 8,
            labels: ["ui", "growth"],
          }),
        }),
      );
    });
    expect(onUpdated).toHaveBeenCalledWith(updatedTask);
  });

  it("shows task update API errors without closing the dialog", async () => {
    const user = userEvent.setup();
    apiMock.mockRejectedValue(new ApiClientError("Tasks in completed sprints are read-only", 409));

    render(<EditTaskDialog task={task} onUpdated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /edit build onboarding form/i }));
    await user.click(screen.getByRole("button", { name: /save task/i }));

    expect(await screen.findByText("Tasks in completed sprints are read-only")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
