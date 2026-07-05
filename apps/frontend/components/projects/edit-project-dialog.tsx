"use client";

import { Archive, Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError } from "@/lib/api";
import type { Project } from "@/lib/types";

interface EditProjectDialogProps {
  project: Project;
  canArchive: boolean;
  onUpdated: (project: Project) => void;
  onArchived: (projectId: string) => void;
}

export function EditProjectDialog({ project, canArchive, onUpdated, onArchived }: EditProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [action, setAction] = useState<"save" | "archive" | "">("");
  const [error, setError] = useState("");

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setName(project.name);
      setDescription(project.description ?? "");
      setConfirmArchive(false);
      setError("");
    }
    setOpen(nextOpen);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setAction("save");
    setError("");
    try {
      const data = await api<{ project: Project }>(`/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description: description.trim() || null }),
      });
      onUpdated(data.project);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Project could not be updated");
    } finally {
      setAction("");
    }
  }

  async function archive() {
    setAction("archive");
    setError("");
    try {
      await api<{ project: Project }>(`/projects/${project.id}`, { method: "DELETE" });
      onArchived(project.id);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Project could not be archived");
    } finally {
      setAction("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Manage ${project.name}`}>
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Update project details or archive it when planning is complete.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div><Label htmlFor={`project-name-${project.id}`}>Project name</Label><Input id={`project-name-${project.id}`} value={name} onChange={(event) => setName(event.target.value)} required /></div>
          <div><Label htmlFor={`project-description-${project.id}`}>Description</Label><Textarea id={`project-description-${project.id}`} value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24" /></div>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" disabled={Boolean(action)}>{action === "save" ? <><Spinner /> Saving</> : "Save changes"}</Button>
        </form>
        {canArchive && (
          <div className="mt-5 border-t border-slate-200 pt-5">
            {!confirmArchive ? (
              <Button variant="danger" className="w-full" onClick={() => setConfirmArchive(true)} disabled={Boolean(action)}>
                <Archive className="h-4 w-4" /> Archive project
              </Button>
            ) : (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm text-rose-800">Archive this project? Its history remains available through the API, but it will leave the active dashboard.</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmArchive(false)} disabled={Boolean(action)}>Cancel</Button>
                  <Button variant="danger" className="flex-1" onClick={() => void archive()} disabled={Boolean(action)}>{action === "archive" ? <><Spinner /> Archiving</> : "Confirm archive"}</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
