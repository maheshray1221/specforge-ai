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
import type { Requirement } from "@/lib/types";

export function CreateRequirementDialog({ projectId, onCreated }: { projectId: string; onCreated: (requirement: Requirement) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{ requirement: Requirement }>(`/projects/${projectId}/requirements`, {
        method: "POST",
        body: JSON.stringify({ title, content, status: "READY" }),
      });
      onCreated(data.requirement);
      setOpen(false);
      setTitle("");
      setContent("");
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Requirement could not be created");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add requirement</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Add client requirement</DialogTitle><DialogDescription>Paste a clear requirement, meeting note or client message. The AI will turn it into planning data.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><Label htmlFor="requirement-title">Title</Label><Input id="requirement-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Customer authentication and onboarding" required /></div>
          <div><Label htmlFor="requirement-content">Requirement</Label><Textarea id="requirement-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="The client needs..." className="min-h-56" required /></div>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" disabled={loading}>{loading ? <><Spinner /> Saving</> : "Save requirement"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
