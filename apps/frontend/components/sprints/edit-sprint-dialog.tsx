"use client";

import { Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError } from "@/lib/api";
import type { Sprint } from "@/lib/types";

const toDateInput = (value: string | null) => value ? value.slice(0, 10) : "";
const toIsoDate = (value: string) => value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null;

export function EditSprintDialog({ sprint, onUpdated }: { sprint: Sprint; onUpdated: (sprint: Sprint) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const [status, setStatus] = useState<Sprint["status"]>(sprint.status);
  const [startDate, setStartDate] = useState(toDateInput(sprint.startDate));
  const [endDate, setEndDate] = useState(toDateInput(sprint.endDate));
  const [capacity, setCapacity] = useState(sprint.capacityPoints?.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const unfinishedTasks = sprint.tasks.filter((task) => task.status !== "DONE").length;
  const completed = sprint.status === "COMPLETED";
  const allowedStatuses: Sprint["status"][] = sprint.status === "PLANNED"
    ? ["PLANNED", "ACTIVE"]
    : sprint.status === "ACTIVE"
      ? ["ACTIVE", "COMPLETED"]
      : ["COMPLETED"];

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setName(sprint.name);
      setGoal(sprint.goal ?? "");
      setStatus(sprint.status);
      setStartDate(toDateInput(sprint.startDate));
      setEndDate(toDateInput(sprint.endDate));
      setCapacity(sprint.capacityPoints?.toString() ?? "");
      setError("");
    }
    setOpen(nextOpen);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (startDate && endDate && startDate > endDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    if (status === "COMPLETED" && unfinishedTasks > 0) {
      setError(`Complete the remaining ${unfinishedTasks} task${unfinishedTasks === 1 ? "" : "s"} before closing this sprint.`);
      return;
    }

    setLoading(true);
    try {
      const data = await api<{ sprint: Sprint }>(`/sprints/${sprint.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          goal: goal.trim() || null,
          status,
          startDate: toIsoDate(startDate),
          endDate: toIsoDate(endDate),
          capacityPoints: capacity ? Number(capacity) : null,
        }),
      });
      onUpdated(data.sprint);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Sprint could not be updated");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Settings2 className="h-3.5 w-3.5" /> Manage</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage sprint</DialogTitle>
          <DialogDescription>{completed ? "Completed sprints are read-only." : "Update planning details and move the sprint through its lifecycle."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div><Label htmlFor={`sprint-name-${sprint.id}`}>Name</Label><Input id={`sprint-name-${sprint.id}`} value={name} onChange={(event) => setName(event.target.value)} disabled={completed} required /></div>
          <div><Label htmlFor={`sprint-goal-${sprint.id}`}>Goal</Label><Textarea id={`sprint-goal-${sprint.id}`} value={goal} onChange={(event) => setGoal(event.target.value)} disabled={completed} className="min-h-20" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor={`sprint-start-${sprint.id}`}>Start date</Label><Input id={`sprint-start-${sprint.id}`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={completed} /></div>
            <div><Label htmlFor={`sprint-end-${sprint.id}`}>End date</Label><Input id={`sprint-end-${sprint.id}`} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} disabled={completed} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor={`sprint-capacity-${sprint.id}`}>Capacity points</Label><Input id={`sprint-capacity-${sprint.id}`} type="number" min={1} max={500} value={capacity} onChange={(event) => setCapacity(event.target.value)} disabled={completed} /></div>
            <div><Label htmlFor={`sprint-status-${sprint.id}`}>Status</Label><select id={`sprint-status-${sprint.id}`} value={status} onChange={(event) => setStatus(event.target.value as Sprint["status"])} disabled={completed} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100">{allowedStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
          </div>
          {status === "COMPLETED" && unfinishedTasks > 0 ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{unfinishedTasks} unfinished task{unfinishedTasks === 1 ? "" : "s"} block completion.</p> : null}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {!completed && <Button className="w-full" disabled={loading}>{loading ? <><Spinner /> Saving</> : "Save sprint"}</Button>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
