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
import type { Sprint } from "@/lib/types";

export function CreateSprintDialog({ projectId, onCreated }: { projectId: string; onCreated: (sprint: Sprint) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [capacity, setCapacity] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{ sprint: Sprint }>(`/projects/${projectId}/sprints`, {
        method: "POST",
        body: JSON.stringify({ name, goal: goal || undefined, capacityPoints: capacity ? Number(capacity) : undefined }),
      });
      onCreated(data.sprint);
      setOpen(false);
      setName("");
      setGoal("");
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Sprint could not be created");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New sprint</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create sprint</DialogTitle><DialogDescription>Define a focused delivery window and planning capacity.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><Label htmlFor="sprint-name">Sprint name</Label><Input id="sprint-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Sprint 1 — Foundation" required /></div>
          <div><Label htmlFor="sprint-goal">Goal</Label><Textarea id="sprint-goal" value={goal} onChange={(event) => setGoal(event.target.value)} className="min-h-24" placeholder="Deliver authentication and project setup" /></div>
          <div><Label htmlFor="sprint-capacity">Capacity points</Label><Input id="sprint-capacity" type="number" min={1} max={500} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></div>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? <><Spinner /> Creating</> : "Create sprint"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
