export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  workspaces: Workspace[];
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  _count: { requirements: number; tasks: number; sprints: number };
}

export interface ProjectUsage {
  period: { start: string; end: string };
  usage: {
    aiJobs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    aiJobsByStatus: Record<string, number>;
  };
  quotas: { aiJobs: number; totalTokens: number };
  remaining: { aiJobs: number; totalTokens: number };
}

export interface ProjectAnalyticsSummary {
  period: { since: string; until: string; days: number };
  eventsByType: Record<string, number>;
  activationFunnel: {
    projectCreated: number;
    requirementCreated: number;
    requirementAnalyzed: number;
    requirementApproved: number;
    tasksGenerated: number;
    sprintCreated: number;
  };
  aiFeedback: { submitted: number };
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; name: string; email: string };
}

export interface Notification {
  id: string;
  projectId: string | null;
  title: string;
  body: string | null;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  projectId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
}

export type IntegrationProvider = "GITHUB" | "JIRA" | "LINEAR" | "SLACK" | "WEBHOOK";
export type IntegrationStatus = "CONNECTED" | "PAUSED" | "ERROR";

export interface ProjectIntegration {
  id: string;
  projectId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  displayName: string;
  externalRef: string | null;
  config: Record<string, unknown>;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementVersion {
  id: string;
  versionNumber: number;
  content: string;
  createdAt: string;
}

export interface Requirement {
  id: string;
  projectId: string;
  title: string;
  currentContent: string;
  status: "DRAFT" | "READY" | "NEEDS_CLARIFICATION" | "APPROVED";
  clarificationAnswers: Array<{ question: string; answer: string; required: boolean; resolvedAt: string; resolvedBy: string }> | null;
  createdAt: string;
  updatedAt: string;
  versions: RequirementVersion[];
  analyses: Array<{ id: string; status: "PROCESSING" | "COMPLETED" | "FAILED"; provider: string; model: string; createdAt: string }>;
}

export interface AIAnalysis {
  id: string;
  requirementId: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  provider: string;
  model: string;
  errorCategory: string | null;
  promptSchemaVersion: string;
  attempts: number;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  taskGenerationAttempts: number;
  taskGenerationDurationMs: number | null;
  taskGenerationPromptTokens: number | null;
  taskGenerationCompletionTokens: number | null;
  taskGenerationTotalTokens: number | null;
  taskGenerationErrorCategory: string | null;
  taskGenerationErrorMessage: string | null;
  clarificationQuestions: Array<{ question: string; reason: string; options: string[]; required: boolean }> | null;
  functionalRequirements: Array<{ id: string; title: string; description: string; priority: string }> | null;
  nonFunctionalRequirements: Array<{ category: string; description: string; measurableTarget: string }> | null;
  userStories: Array<{ id: string; role: string; goal: string; benefit: string; acceptanceCriteria: string[]; storyPoints: number }> | null;
  technicalPlan: {
    summary: string;
    frontend: string[];
    backend: string[];
    database: string[];
    integrations: string[];
    apiEndpoints: Array<{ method: string; path: string; purpose: string }>;
    entities: Array<{ name: string; fields: string[]; relationships: string[] }>;
  } | null;
  risks: Array<{ title: string; impact: string; mitigation: string }> | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export interface Task {
  id: string;
  projectId: string;
  requirementId: string | null;
  analysisId: string | null;
  sprintId: string | null;
  title: string;
  description: string;
  type: "FRONTEND" | "BACKEND" | "QA" | "DEVOPS" | "DESIGN" | "DOCUMENTATION";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: TaskStatus;
  storyPoints: number | null;
  acceptanceCriteria: string[] | null;
  labels: string[];
  position: number;
  sprint: { id: string; name: string; status: string } | null;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  startDate: string | null;
  endDate: string | null;
  capacityPoints: number | null;
  tasks: Array<Pick<Task, "id" | "title" | "type" | "priority" | "status" | "storyPoints">>;
}
