"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Braces,
  CheckCircle2,
  CircleDot,
  Database,
  FileText,
  ListChecks,
  RefreshCcw,
  Rocket,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreateRequirementDialog } from "@/components/requirements/create-requirement-dialog";
import { CreateSprintDialog } from "@/components/sprints/create-sprint-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiClientError } from "@/lib/api";
import type { AIAnalysis, Project, Requirement, Sprint, Task, TaskStatus } from "@/lib/types";

const taskColumns: Array<{ key: TaskStatus; label: string }> = [
  { key: "BACKLOG", label: "Backlog" },
  { key: "TODO", label: "To do" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "REVIEW", label: "Review" },
  { key: "DONE", label: "Done" },
];

const priorityClass: Record<Task["priority"], string> = {
  LOW: "border-slate-200 bg-slate-50 text-slate-600",
  MEDIUM: "border-sky-200 bg-sky-50 text-sky-700",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700",
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700",
};

function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</div>;
}

function EmptyState({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <Card className="grid min-h-64 place-items-center p-8 text-center">
      <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-600"><Icon className="h-5 w-5" /></span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{text}</p></div>
    </Card>
  );
}

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>("");
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string>("");
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projectData, requirementData, taskData, sprintData] = await Promise.all([
        api<{ project: Project }>(`/projects/${projectId}`),
        api<{ requirements: Requirement[] }>(`/projects/${projectId}/requirements`),
        api<{ tasks: Task[] }>(`/projects/${projectId}/tasks`),
        api<{ sprints: Sprint[] }>(`/projects/${projectId}/sprints`),
      ]);
      setProject(projectData.project);
      setRequirements(requirementData.requirements);
      setTasks(taskData.tasks);
      setSprints(sprintData.sprints);
      setSelectedRequirementId((current) => current || requirementData.requirements[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Project workspace could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadAll();
    });
  }, [loadAll]);

  useEffect(() => {
    if (!selectedRequirementId) {
      queueMicrotask(() => {
        setAnalysis(null);
      });
      return;
    }
    queueMicrotask(() => {
      api<{ analyses: AIAnalysis[] }>(`/requirements/${selectedRequirementId}/analyses`)
        .then((data) => setAnalysis(data.analyses.find((item) => item.status === "COMPLETED") ?? data.analyses[0] ?? null))
        .catch(() => setAnalysis(null));
    });
  }, [selectedRequirementId]);

  const selectedRequirement = requirements.find((item) => item.id === selectedRequirementId) ?? null;
  const groupedTasks = useMemo(() => Object.fromEntries(taskColumns.map(({ key }) => [key, tasks.filter((task) => task.status === key)])) as Record<TaskStatus, Task[]>, [tasks]);

  async function runAnalysis(force = false) {
    if (!selectedRequirement) return;
    setAction("analyze");
    setError("");
    try {
      const data = await api<{ analysis: AIAnalysis; reused: boolean }>(`/requirements/${selectedRequirement.id}/analyze`, { method: "POST", body: JSON.stringify({ force }) });
      setAnalysis(data.analysis);
      const refreshed = await api<{ requirements: Requirement[] }>(`/projects/${projectId}/requirements`);
      setRequirements(refreshed.requirements);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "AI analysis failed");
    } finally {
      setAction("");
    }
  }

  async function markRequirementReady() {
    if (!selectedRequirement) return;
    setAction("ready");
    setError("");
    try {
      const data = await api<{ requirement: Requirement }>(`/requirements/${selectedRequirement.id}`, { method: "PATCH", body: JSON.stringify({ status: "READY" }) });
      setRequirements((current) => current.map((item) => item.id === data.requirement.id ? data.requirement : item));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Requirement could not be updated");
    } finally {
      setAction("");
    }
  }

  async function generateTasks(regenerate = false) {
    if (!analysis) return;
    setAction("tasks");
    setError("");
    try {
      const data = await api<{ tasks: Task[]; generationNotes: string[]; reused: boolean }>(`/analyses/${analysis.id}/tasks/generate`, { method: "POST", body: JSON.stringify({ regenerate }) });
      setTasks((current) => [...current.filter((task) => task.analysisId !== analysis.id), ...data.tasks]);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Task generation failed");
    } finally {
      setAction("");
    }
  }

  async function updateTaskStatus(task: Task, status: TaskStatus) {
    try {
      const data = await api<{ task: Task }>(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setTasks((current) => current.map((item) => item.id === task.id ? data.task : item));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Task could not be updated");
    }
  }

  async function assignSprint(task: Task, sprintId: string) {
    setError("");
    try {
      if (sprintId) {
        await api(`/sprints/${sprintId}/tasks/${task.id}`, { method: "POST" });
      } else if (task.sprintId) {
        await api(`/sprints/${task.sprintId}/tasks/${task.id}`, { method: "DELETE" });
      }
      const [taskData, sprintData] = await Promise.all([
        api<{ tasks: Task[] }>(`/projects/${projectId}/tasks`),
        api<{ sprints: Sprint[] }>(`/projects/${projectId}/sprints`),
      ]);
      setTasks(taskData.tasks);
      setSprints(sprintData.sprints);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Task could not be assigned to the sprint");
    }
  }

  if (loading) return <div className="space-y-5"><div className="h-28 animate-pulse rounded-2xl bg-slate-200" /><div className="h-96 animate-pulse rounded-2xl bg-slate-200" /></div>;
  if (!project) return <ErrorNotice message={error || "Project was not found"} />;

  return (
    <div>
      <Link href="/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Back to projects</Link>
      <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><div className="flex flex-wrap items-center gap-2"><Badge>{project.key}</Badge><Badge className={project.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{project.status}</Badge></div><h1 className="mt-3 font-[var(--font-manrope)] text-3xl font-bold tracking-tight">{project.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{project.description || "No description added."}</p></div>
        <CreateRequirementDialog projectId={projectId} onCreated={(requirement) => { setRequirements((current) => [requirement, ...current]); setSelectedRequirementId(requirement.id); }} />
      </div>

      <div className="mt-5"><ErrorNotice message={error} /></div>

      <Tabs defaultValue="requirements">
        <TabsList>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="analysis">AI analysis</TabsTrigger>
          <TabsTrigger value="tasks">Tasks <span className="ml-1 opacity-60">{tasks.length}</span></TabsTrigger>
          <TabsTrigger value="sprints">Sprints <span className="ml-1 opacity-60">{sprints.length}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="requirements">
          {requirements.length === 0 ? <EmptyState icon={FileText} title="No requirements yet" text="Add a client requirement to start the AI planning workflow." /> : (
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <div className="space-y-2">{requirements.map((requirement) => <button key={requirement.id} onClick={() => setSelectedRequirementId(requirement.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedRequirementId === requirement.id ? "border-sky-300 bg-sky-50/70 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}><div className="flex items-start justify-between gap-3"><p className="font-semibold text-slate-900">{requirement.title}</p><Badge className="shrink-0">v{requirement.versions[0]?.versionNumber ?? 1}</Badge></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{requirement.currentContent}</p><p className={`mt-3 text-xs font-medium ${requirement.status === "NEEDS_CLARIFICATION" ? "text-amber-700" : "text-emerald-700"}`}>{requirement.status.replaceAll("_", " ")}</p></button>)}</div>
              {selectedRequirement && <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{selectedRequirement.title}</CardTitle><CardDescription>Latest version {selectedRequirement.versions[0]?.versionNumber ?? 1}</CardDescription></div><div className="flex flex-wrap gap-2">{selectedRequirement.status === "NEEDS_CLARIFICATION" && <Button variant="outline" onClick={markRequirementReady} disabled={action === "ready"}>{action === "ready" && <Spinner />} Mark ready</Button>}<Button onClick={() => runAnalysis(false)} disabled={action === "analyze"}>{action === "analyze" ? <><Spinner /> Analyzing</> : <><Sparkles className="h-4 w-4" /> Analyze</>}</Button></div></div></CardHeader><CardContent><div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{selectedRequirement.currentContent}</div></CardContent></Card>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis">
          {!selectedRequirement ? <EmptyState icon={Sparkles} title="Select a requirement" text="Choose a requirement before running AI analysis." /> : !analysis ? <Card className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Sparkles className="h-6 w-6" /></span><h3 className="mt-4 font-semibold">Ready for analysis</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Generate clarification questions, user stories, technical plans and risk analysis.</p><Button className="mt-5" onClick={() => runAnalysis(false)} disabled={action === "analyze"}>{action === "analyze" ? <><Spinner /> Analyzing</> : "Run AI analysis"}</Button></div></Card> : analysis.status !== "COMPLETED" ? <Card className="p-6"><h3 className="font-semibold">Analysis {analysis.status.toLowerCase()}</h3><p className="mt-2 text-sm text-slate-500">{analysis.errorMessage || "Please try again."}</p><Button className="mt-4" onClick={() => runAnalysis(true)}><RefreshCcw className="h-4 w-4" /> Retry</Button></Card> : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-violet-600">{analysis.provider} · {analysis.model}</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Development blueprint</h2></div><div className="flex gap-2"><Button variant="outline" onClick={() => runAnalysis(true)} disabled={action === "analyze"}><RefreshCcw className="h-4 w-4" /> Reanalyze</Button><Button onClick={() => generateTasks(false)} disabled={action === "tasks" || selectedRequirement.status === "NEEDS_CLARIFICATION"}>{action === "tasks" ? <><Spinner /> Generating</> : <><ListChecks className="h-4 w-4" /> Generate tasks</>}</Button></div></div>
              {selectedRequirement.status === "NEEDS_CLARIFICATION" && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Resolve the required questions, update the requirement, then mark it ready before generating tasks.</div>}
              <div className="grid gap-5 lg:grid-cols-2">
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Clarification questions</CardTitle></CardHeader><CardContent className="space-y-3">{analysis.clarificationQuestions?.length ? analysis.clarificationQuestions.map((question, index) => <div key={`${question.question}-${index}`} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start gap-2"><CircleDot className={`mt-1 h-3.5 w-3.5 ${question.required ? "text-rose-500" : "text-slate-400"}`} /><div><p className="text-sm font-medium">{question.question}</p><p className="mt-1 text-xs leading-5 text-slate-500">{question.reason}</p>{question.options.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{question.options.map((option) => <Badge key={option}>{option}</Badge>)}</div>}</div></div></div>) : <p className="text-sm text-slate-500">No blocking questions detected.</p>}</CardContent></Card>
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Functional requirements</CardTitle></CardHeader><CardContent className="space-y-3">{analysis.functionalRequirements?.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{item.id} · {item.title}</p><Badge>{item.priority}</Badge></div><p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p></div>)}</CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Workflow className="h-4 w-4 text-sky-600" /> User stories</CardTitle></CardHeader><CardContent><div className="grid gap-3 lg:grid-cols-2">{analysis.userStories?.map((story) => <div key={story.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><Badge>{story.id}</Badge><Badge>{story.storyPoints} points</Badge></div><p className="mt-3 text-sm font-medium">As {story.role}, I want {story.goal}, so that {story.benefit}.</p><ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-500">{story.acceptanceCriteria.map((criterion) => <li key={criterion} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{criterion}</li>)}</ul></div>)}</div></CardContent></Card>
              {analysis.technicalPlan && <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Braces className="h-4 w-4 text-violet-600" /> Technical plan</CardTitle><CardDescription>{analysis.technicalPlan.summary}</CardDescription></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2">{[["Frontend", analysis.technicalPlan.frontend], ["Backend", analysis.technicalPlan.backend], ["Database", analysis.technicalPlan.database], ["Integrations", analysis.technicalPlan.integrations]].map(([title, items]) => <div key={title as string}><p className="text-sm font-semibold">{title as string}</p><ul className="mt-2 space-y-1 text-xs leading-5 text-slate-500">{(items as string[]).map((item) => <li key={item}>• {item}</li>)}</ul></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-4 w-4 text-sky-600" /> API plan</CardTitle></CardHeader><CardContent className="space-y-2">{analysis.technicalPlan.apiEndpoints.map((endpoint, index) => <div key={`${endpoint.method}-${endpoint.path}-${index}`} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[74px_1fr]"><Badge className="justify-center font-mono">{endpoint.method}</Badge><div><p className="font-mono text-xs font-semibold text-slate-800">{endpoint.path}</p><p className="mt-1 text-xs text-slate-500">{endpoint.purpose}</p></div></div>)}</CardContent></Card></div>}
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-500" /> Risks</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{analysis.risks?.map((risk) => <div key={risk.title} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">{risk.title}</p><p className="mt-2 text-xs leading-5 text-rose-600">Impact: {risk.impact}</p><p className="mt-2 text-xs leading-5 text-slate-500">Mitigation: {risk.mitigation}</p></div>)}</CardContent></Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Engineering backlog</h2><p className="mt-1 text-sm text-slate-500">Move tasks through the workflow and assign them to a sprint.</p></div>{analysis && <Button variant="outline" onClick={() => generateTasks(tasks.some((task) => task.analysisId === analysis.id))} disabled={action === "tasks"}>{action === "tasks" && <Spinner />} {tasks.some((task) => task.analysisId === analysis.id) ? "Regenerate tasks" : "Generate tasks"}</Button>}</div>
          {tasks.length === 0 ? <EmptyState icon={ListChecks} title="No tasks generated" text="Analyze a requirement and generate a development-ready backlog." /> : <div className="overflow-x-auto pb-3"><div className="grid min-w-[1100px] grid-cols-5 gap-3">{taskColumns.map((column) => <div key={column.key} className="rounded-2xl bg-slate-100/80 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{column.label}</h3><Badge>{groupedTasks[column.key].length}</Badge></div><div className="space-y-3">{groupedTasks[column.key].map((task) => <motion.div layout key={task.id}><Card className="p-3.5"><div className="flex items-start justify-between gap-2"><Badge>{task.type}</Badge><Badge className={priorityClass[task.priority]}>{task.priority}</Badge></div><h4 className="mt-3 text-sm font-semibold leading-5">{task.title}</h4><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{task.description}</p><div className="mt-3 flex flex-wrap gap-1">{task.labels.slice(0, 3).map((label) => <span key={label} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{label}</span>)}</div><div className="mt-4 grid gap-2"><select aria-label="Task status" value={task.status} onChange={(event) => void updateTaskStatus(task, event.target.value as TaskStatus)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none">{taskColumns.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><select aria-label="Sprint assignment" value={task.sprintId ?? ""} onChange={(event) => void assignSprint(task, event.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"><option value="">No sprint</option>{sprints.filter((sprint) => sprint.status !== "COMPLETED").map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{task.storyPoints ?? "—"} points</span><span>{task.sprint?.name ?? "Backlog"}</span></div></Card></motion.div>)}</div></div>)}</div></div>}
        </TabsContent>

        <TabsContent value="sprints">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Sprint planning</h2><p className="mt-1 text-sm text-slate-500">Organize backlog tasks into focused delivery cycles.</p></div><CreateSprintDialog projectId={projectId} onCreated={(sprint) => setSprints((current) => [sprint, ...current])} /></div>
          {sprints.length === 0 ? <EmptyState icon={Rocket} title="No sprints planned" text="Create a sprint, set a capacity and assign generated tasks from the task board." /> : <div className="grid gap-4 lg:grid-cols-2">{sprints.map((sprint) => { const totalPoints = sprint.tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0); const done = sprint.tasks.filter((task) => task.status === "DONE").length; return <Card key={sprint.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{sprint.name}</CardTitle><CardDescription>{sprint.goal || "No sprint goal."}</CardDescription></div><Badge className={sprint.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{sprint.status}</Badge></div></CardHeader><CardContent><div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center"><div><p className="text-lg font-bold">{sprint.tasks.length}</p><p className="text-[11px] text-slate-500">Tasks</p></div><div><p className="text-lg font-bold">{totalPoints}</p><p className="text-[11px] text-slate-500">Points</p></div><div><p className="text-lg font-bold">{done}</p><p className="text-[11px] text-slate-500">Done</p></div></div><div className="mt-4 space-y-2">{sprint.tasks.slice(0, 6).map((task) => <div key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"><CheckCircle2 className={`h-4 w-4 ${task.status === "DONE" ? "text-emerald-500" : "text-slate-300"}`} /><p className="min-w-0 flex-1 truncate text-sm">{task.title}</p><span className="text-xs text-slate-500">{task.storyPoints ?? "—"}p</span></div>)}{sprint.tasks.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Assign tasks from the task board.</p>}</div></CardContent></Card>; })}</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
