"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError } from "@/lib/api";
import type { Project } from "@/lib/types";

export function CreateProjectDialog({ workspaceId, onCreated }: { workspaceId: string; onCreated: (project: Project) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{ project: Project }>("/projects", { method: "POST", body: JSON.stringify({ workspaceId, name, key, description: description || undefined }) });
      onCreated(data.project);
      setOpen(false);
      setName(""); setKey(""); setDescription("");
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Project could not be created");
    } finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New project</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create project</DialogTitle><DialogDescription>Set up the workspace where requirements, analyses and tasks will live.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div><Label htmlFor="project-name">Project name</Label><Input id="project-name" value={name} onChange={(event) => { setName(event.target.value); if (!key) setKey(event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()); }} placeholder="Customer portal" required /></div>
          <div><Label htmlFor="project-key">Project key</Label><Input id="project-key" value={key} onChange={(event) => setKey(event.target.value.toUpperCase())} placeholder="PORTAL" maxLength={12} required /></div>
          <div><Label htmlFor="project-description">Description</Label><Textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you planning to build?" className="min-h-24" /></div>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? <><Spinner /> Creating</> : "Create project"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
