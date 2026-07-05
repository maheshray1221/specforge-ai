"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError } from "@/lib/api";
import type { Task } from "@/lib/types";

interface EditTaskDialogProps {
  task: Task;
  onUpdated: (task: Task) => void;
}

export function EditTaskDialog({ task, onUpdated }: EditTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [type, setType] = useState<Task["type"]>(task.type);
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const [storyPoints, setStoryPoints] = useState(task.storyPoints?.toString() ?? "");
  const [labels, setLabels] = useState(task.labels.join(", "));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setTitle(task.title);
      setDescription(task.description);
      setType(task.type);
      setPriority(task.priority);
      setStoryPoints(task.storyPoints?.toString() ?? "");
      setLabels(task.labels.join(", "));
      setError("");
    }
    setOpen(nextOpen);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api<{ task: Task }>(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          description,
          type,
          priority,
          storyPoints: storyPoints ? Number(storyPoints) : null,
          labels: labels.split(",").map((label) => label.trim()).filter(Boolean),
        }),
      });
      onUpdated(data.task);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Task could not be updated");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Edit ${task.title}`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>Review and refine the AI-generated task before sprint planning.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><Label htmlFor={`task-title-${task.id}`}>Title</Label><Input id={`task-title-${task.id}`} value={title} onChange={(event) => setTitle(event.target.value)} required /></div>
          <div><Label htmlFor={`task-description-${task.id}`}>Description</Label><Textarea id={`task-description-${task.id}`} value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-36" required /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor={`task-type-${task.id}`}>Type</Label><select id={`task-type-${task.id}`} value={type} onChange={(event) => setType(event.target.value as Task["type"])} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{["FRONTEND", "BACKEND", "QA", "DEVOPS", "DESIGN", "DOCUMENTATION"].map((value) => <option key={value}>{value}</option>)}</select></div>
            <div><Label htmlFor={`task-priority-${task.id}`}>Priority</Label><select id={`task-priority-${task.id}`} value={priority} onChange={(event) => setPriority(event.target.value as Task["priority"])} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((value) => <option key={value}>{value}</option>)}</select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor={`task-points-${task.id}`}>Story points</Label><select id={`task-points-${task.id}`} value={storyPoints} onChange={(event) => setStoryPoints(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Unestimated</option>{[1, 2, 3, 5, 8, 13].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div><Label htmlFor={`task-labels-${task.id}`}>Labels</Label><Input id={`task-labels-${task.id}`} value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="api, security, story:US-1" /></div>
          </div>
          {task.acceptanceCriteria?.length ? <div><Label>Acceptance criteria</Label><ul className="mt-2 space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{task.acceptanceCriteria.map((criterion) => <li key={criterion}>• {criterion}</li>)}</ul></div> : null}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? <><Spinner /> Saving</> : "Save task"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
