"use client";

import { FolderKanban, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiClientError } from "@/lib/api";
import type { Project } from "@/lib/types";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectCard } from "./project-card";

export function ProjectsDashboard() {
  const { user } = useAuth();
  const workspace = user?.workspaces[0];
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!workspace) return;
    setLoading(true);
    api<{ projects: Project[] }>(`/projects?workspaceId=${workspace.id}`)
      .then((data) => setProjects(data.projects))
      .catch((reason) => setError(reason instanceof ApiClientError ? reason.message : "Projects could not be loaded"))
      .finally(() => setLoading(false));
  }, [workspace]);

  const filtered = useMemo(() => projects.filter((project) => `${project.name} ${project.key}`.toLowerCase().includes(search.toLowerCase())), [projects, search]);
  if (!workspace) return null;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-sky-600">{workspace.name}</p><h1 className="mt-1 font-[var(--font-manrope)] text-3xl font-bold tracking-tight">Projects</h1><p className="mt-2 text-sm text-slate-500">Manage requirements, AI planning, tasks and sprints.</p></div><CreateProjectDialog workspaceId={workspace.id} onCreated={(project) => setProjects((current) => [project, ...current])} /></div>
      <div className="relative mt-8 max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {error && <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {loading ? <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Card key={index} className="h-56 animate-pulse bg-slate-100" />)}</div> : filtered.length ? <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((project, index) => <ProjectCard key={project.id} project={project} index={index} />)}</div> : <Card className="mt-8 grid min-h-80 place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sky-50 text-sky-600"><FolderKanban className="h-6 w-6" /></span><h2 className="mt-4 font-semibold">No projects found</h2><p className="mt-2 text-sm text-slate-500">Create your first project to begin planning.</p></div></Card>}
    </div>
  );
}
