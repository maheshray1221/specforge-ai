import { Prisma } from "@prisma/client";
import type { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import PDFDocument from "pdfkit";
import { prisma } from "../../config/prisma.js";
import { toCsv } from "../../utils/csv.js";
import { getProjectAccess } from "../projects/project.access.js";

interface ExportProjectTasksFilters {
  status?: TaskStatus;
  type?: TaskType;
  priority?: TaskPriority;
  sprintId?: string;
  search?: string;
}

const taskExportColumns = [
  "id",
  "title",
  "description",
  "type",
  "priority",
  "status",
  "storyPoints",
  "labels",
  "requirementTitle",
  "sprintName",
  "createdAt",
  "updatedAt",
];

const sprintExportColumns = [
  "id",
  "name",
  "goal",
  "status",
  "startDate",
  "endDate",
  "capacityPoints",
  "taskCount",
  "totalStoryPoints",
  "doneTaskCount",
  "createdAt",
  "updatedAt",
];

export async function exportProjectTasksCsv(userId: string, projectId: string, filters: ExportProjectTasksFilters) {
  await getProjectAccess(userId, projectId);

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
              { description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      priority: true,
      status: true,
      storyPoints: true,
      labels: true,
      createdAt: true,
      updatedAt: true,
      requirement: { select: { title: true } },
      sprint: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });

  return toCsv(
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      status: task.status,
      storyPoints: task.storyPoints,
      labels: task.labels,
      requirementTitle: task.requirement?.title ?? "",
      sprintName: task.sprint?.name ?? "",
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    taskExportColumns,
  );
}

export async function exportProjectSprintsCsv(userId: string, projectId: string) {
  await getProjectAccess(userId, projectId);

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      startDate: true,
      endDate: true,
      capacityPoints: true,
      createdAt: true,
      updatedAt: true,
      tasks: { select: { status: true, storyPoints: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
  });

  return toCsv(
    sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal ?? "",
      status: sprint.status,
      startDate: sprint.startDate?.toISOString() ?? "",
      endDate: sprint.endDate?.toISOString() ?? "",
      capacityPoints: sprint.capacityPoints,
      taskCount: sprint.tasks.length,
      totalStoryPoints: sprint.tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0),
      doneTaskCount: sprint.tasks.filter((task) => task.status === "DONE").length,
      createdAt: sprint.createdAt.toISOString(),
      updatedAt: sprint.updatedAt.toISOString(),
    })),
    sprintExportColumns,
  );
}

export async function exportProjectPlanningJson(userId: string, projectId: string) {
  await getProjectAccess(userId, projectId);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      requirements: {
        select: {
          id: true,
          title: true,
          status: true,
          currentContent: true,
          clarificationAnswers: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            select: { id: true, versionNumber: true, content: true, createdAt: true },
            orderBy: { versionNumber: "desc" },
          },
          analyses: {
            select: {
              id: true,
              status: true,
              provider: true,
              model: true,
              promptSchemaVersion: true,
              clarificationQuestions: true,
              functionalRequirements: true,
              nonFunctionalRequirements: true,
              userStories: true,
              technicalPlan: true,
              risks: true,
              errorCategory: true,
              errorMessage: true,
              attempts: true,
              durationMs: true,
              totalTokens: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      tasks: {
        select: {
          id: true,
          requirementId: true,
          analysisId: true,
          sprintId: true,
          assigneeId: true,
          title: true,
          description: true,
          type: true,
          priority: true,
          status: true,
          storyPoints: true,
          acceptanceCriteria: true,
          labels: true,
          position: true,
          createdAt: true,
          updatedAt: true,
          assignee: { select: { id: true, name: true, email: true } },
          sprint: { select: { id: true, name: true, status: true } },
        },
        orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      },
      sprints: {
        select: {
          id: true,
          name: true,
          goal: true,
          status: true,
          startDate: true,
          endDate: true,
          capacityPoints: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ status: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: "planning-package-v1",
    project,
  };
}

function writeSectionTitle(document: PDFKit.PDFDocument, title: string) {
  document.moveDown(1.2);
  document.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a").text(title);
  document.moveTo(document.x, document.y + 4).lineTo(552, document.y + 4).strokeColor("#cbd5e1").stroke();
  document.moveDown(0.8);
}

function writeKeyValue(document: PDFKit.PDFDocument, label: string, value: unknown) {
  const text = value === null || value === undefined || value === "" ? "Not set" : String(value);
  document.font("Helvetica-Bold").fontSize(9).fillColor("#334155").text(`${label}: `, { continued: true });
  document.font("Helvetica").fontSize(9).fillColor("#475569").text(text);
}

function truncateText(text: string | null | undefined, maxLength = 220) {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function formatExportDate(value: Date | string | null | undefined) {
  if (!value) return "Not set";
  return new Date(value).toISOString().slice(0, 10);
}

function collectPdf(document: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
}

export async function exportProjectPlanningPdf(userId: string, projectId: string) {
  const planningPackage = await exportProjectPlanningJson(userId, projectId);
  const { project } = planningPackage;
  const document = new PDFDocument({ size: "A4", margin: 42, bufferPages: true });
  const pdf = collectPdf(document);

  document.font("Helvetica-Bold").fontSize(24).fillColor("#0f172a").text("SpecForge AI Planning Package");
  document.moveDown(0.4);
  document.font("Helvetica").fontSize(11).fillColor("#64748b").text(`Exported ${planningPackage.exportedAt}`);
  document.moveDown(1.2);
  document.roundedRect(42, document.y, 511, 92, 10).fillAndStroke("#f8fafc", "#e2e8f0");
  document.fillColor("#0f172a").font("Helvetica-Bold").fontSize(17).text(project.name, 58, document.y + 16);
  document.font("Helvetica").fontSize(10).fillColor("#475569").text(`${project.key} - ${project.status}`, 58, document.y + 4);
  document.moveDown(0.4);
  document.fontSize(10).text(truncateText(project.description, 260) || "No project description added.", 58, document.y, { width: 470 });
  document.y = 165;

  writeSectionTitle(document, "Project summary");
  writeKeyValue(document, "Requirements", project.requirements.length);
  writeKeyValue(document, "Tasks", project.tasks.length);
  writeKeyValue(document, "Sprints", project.sprints.length);
  writeKeyValue(document, "Created", formatExportDate(project.createdAt));

  writeSectionTitle(document, "Requirements and AI blueprint");
  if (project.requirements.length === 0) {
    document.font("Helvetica").fontSize(10).fillColor("#64748b").text("No requirements available.");
  }
  for (const requirement of project.requirements.slice(0, 8)) {
    const latestAnalysis = requirement.analyses[0];
    document.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(requirement.title);
    document.font("Helvetica").fontSize(9).fillColor("#64748b").text(`Status: ${requirement.status} - Versions: ${requirement.versions.length}`);
    document.moveDown(0.25);
    document.font("Helvetica").fontSize(9).fillColor("#475569").text(truncateText(requirement.currentContent, 300), { width: 500 });
    if (latestAnalysis) {
      document.moveDown(0.25);
      document.font("Helvetica-Bold").fontSize(9).fillColor("#334155").text(`Latest AI analysis: ${latestAnalysis.status} - ${latestAnalysis.provider}/${latestAnalysis.model}`);
      if (latestAnalysis.technicalPlan && typeof latestAnalysis.technicalPlan === "object" && "summary" in latestAnalysis.technicalPlan) {
        document.font("Helvetica").fontSize(9).fillColor("#475569").text(truncateText(String(latestAnalysis.technicalPlan.summary), 260), { width: 500 });
      }
    }
    document.moveDown(0.9);
  }

  writeSectionTitle(document, "Engineering backlog");
  if (project.tasks.length === 0) {
    document.font("Helvetica").fontSize(10).fillColor("#64748b").text("No tasks generated.");
  }
  for (const task of project.tasks.slice(0, 24)) {
    document.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(task.title);
    document.font("Helvetica").fontSize(8.5).fillColor("#64748b").text(`${task.type} - ${task.priority} - ${task.status} - ${task.storyPoints ?? "?"} points - ${task.assignee?.name ?? "Unassigned"}`);
    document.font("Helvetica").fontSize(9).fillColor("#475569").text(truncateText(task.description, 210), { width: 500 });
    document.moveDown(0.55);
  }
  if (project.tasks.length > 24) {
    document.font("Helvetica").fontSize(9).fillColor("#64748b").text(`Plus ${project.tasks.length - 24} more tasks in the JSON/CSV exports.`);
  }

  writeSectionTitle(document, "Sprint plan");
  if (project.sprints.length === 0) {
    document.font("Helvetica").fontSize(10).fillColor("#64748b").text("No sprints planned.");
  }
  for (const sprint of project.sprints.slice(0, 12)) {
    document.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(sprint.name);
    document.font("Helvetica").fontSize(9).fillColor("#64748b").text(`${sprint.status} - ${formatExportDate(sprint.startDate)} to ${formatExportDate(sprint.endDate)} - Capacity: ${sprint.capacityPoints ?? "Not set"}`);
    if (sprint.goal) document.font("Helvetica").fontSize(9).fillColor("#475569").text(truncateText(sprint.goal, 180), { width: 500 });
    document.moveDown(0.55);
  }

  const pages = document.bufferedPageRange();
  for (let index = 0; index < pages.count; index += 1) {
    document.switchToPage(index);
    document.font("Helvetica").fontSize(8).fillColor("#94a3b8").text(`SpecForge AI - Page ${index + 1} of ${pages.count}`, 42, 810, { align: "center", width: 511 });
  }

  document.end();
  return pdf;
}
