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
import type { Requirement } from "@/lib/types";

interface EditRequirementDialogProps {
  requirement: Requirement;
  onUpdated: (requirement: Requirement) => void;
}

export function EditRequirementDialog({ requirement, onUpdated }: EditRequirementDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(requirement.title);
  const [content, setContent] = useState(requirement.currentContent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setTitle(requirement.title);
      setContent(requirement.currentContent);
      setError("");
    }
    setOpen(nextOpen);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const contentChanged = content.trim() !== requirement.currentContent.trim();
    if (requirement.status === "NEEDS_CLARIFICATION" && !contentChanged) {
      setError("Update the requirement with the missing decisions before marking it ready.");
      return;
    }

    setLoading(true);
    try {
      const data = await api<{ requirement: Requirement }>(`/requirements/${requirement.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          content,
          status: "READY",
        }),
      });
      onUpdated(data.requirement);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Requirement could not be updated");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Pencil className="h-4 w-4" /> Edit requirement</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Update requirement</DialogTitle>
          <DialogDescription>
            Add the missing business decisions to create a new version. The updated requirement will be ready for reanalysis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor={`requirement-title-${requirement.id}`}>Title</Label>
            <Input
              id={`requirement-title-${requirement.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor={`requirement-content-${requirement.id}`}>Requirement</Label>
            <Textarea
              id={`requirement-content-${requirement.id}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-64"
              required
            />
          </div>
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button className="w-full" disabled={loading}>
            {loading ? <><Spinner /> Saving</> : "Save new version"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
