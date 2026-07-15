"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Braces,
  CheckCircle2,
  CircleDot,
  MessageSquare,
  Database,
  Download,
  FileText,
  ListChecks,
  Bell,
  Plug,
  RefreshCcw,
  Rocket,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreateRequirementDialog } from "@/components/requirements/create-requirement-dialog";
import { EditRequirementDialog } from "@/components/requirements/edit-requirement-dialog";
import { CreateSprintDialog } from "@/components/sprints/create-sprint-dialog";
import { EditSprintDialog } from "@/components/sprints/edit-sprint-dialog";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiClientError, apiBlob, apiText } from "@/lib/api";
import type { AIAnalysis, IntegrationProvider, IntegrationStatus, Notification, Project, ProjectActivity, ProjectAnalyticsSummary, ProjectIntegration, ProjectInvitation, ProjectMember, ProjectUsage, Requirement, Sprint, Task, TaskComment, TaskStatus, WorkspaceRole } from "@/lib/types";

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

const integrationProviders: IntegrationProvider[] = ["GITHUB", "JIRA", "LINEAR", "SLACK", "WEBHOOK"];

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

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return "—";
  if (milliseconds < 1000) return `${milliseconds}ms`;
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function formatNumber(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function formatPercent(used: number, quota: number) {
  if (quota <= 0) return 0;
  return Math.min(100, Math.round((used / quota) * 100));
}

function UsageQuotaCard({ usage }: { usage: ProjectUsage | null }) {
  if (!usage) return null;

  const periodStart = new Date(usage.period.start).toLocaleDateString();
  const periodEnd = new Date(usage.period.end).toLocaleDateString();
  const metrics = [
    {
      label: "AI jobs",
      used: usage.usage.aiJobs,
      remaining: usage.remaining.aiJobs,
      quota: usage.quotas.aiJobs,
      percent: formatPercent(usage.usage.aiJobs, usage.quotas.aiJobs),
    },
    {
      label: "AI tokens",
      used: usage.usage.totalTokens,
      remaining: usage.remaining.totalTokens,
      quota: usage.quotas.totalTokens,
      percent: formatPercent(usage.usage.totalTokens, usage.quotas.totalTokens),
    },
  ];

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /> Usage & quotas</CardTitle>
        <CardDescription>Current monthly AI usage window: {periodStart} to {periodEnd}.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{metric.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatNumber(metric.remaining)} remaining</p>
                </div>
                <Badge>{metric.percent}% used</Badge>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-violet-500" style={{ width: `${metric.percent}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{formatNumber(metric.used)} used</span>
                <span>{formatNumber(metric.quota)} quota</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(usage.usage.aiJobsByStatus).map(([status, count]) => (
            <div key={status} className="rounded-xl bg-white p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{status.replaceAll("_", " ")}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatNumber(count)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsSummaryCard({ analytics }: { analytics: ProjectAnalyticsSummary | null }) {
  if (!analytics) return <EmptyState icon={BarChart3} title="No analytics yet" text="Product analytics will appear after users create requirements, run AI analysis, approve work and generate tasks." />;

  const funnel = [
    { label: "Projects", value: analytics.activationFunnel.projectCreated },
    { label: "Requirements", value: analytics.activationFunnel.requirementCreated },
    { label: "Analyzed", value: analytics.activationFunnel.requirementAnalyzed },
    { label: "Approved", value: analytics.activationFunnel.requirementApproved },
    { label: "Tasks generated", value: analytics.activationFunnel.tasksGenerated },
    { label: "Sprints", value: analytics.activationFunnel.sprintCreated },
  ];
  const maxFunnelValue = Math.max(1, ...funnel.map((item) => item.value));
  const eventRows = Object.entries(analytics.eventsByType).filter(([, count]) => count > 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-sky-600" /> Activation funnel</CardTitle>
          <CardDescription>Last {analytics.period.days} days, from {new Date(analytics.period.since).toLocaleDateString()} to {new Date(analytics.period.until).toLocaleDateString()}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {funnel.map((item) => {
              const percent = Math.round((item.value / maxFunnelValue) * 100);
              return (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xl font-bold text-slate-950">{formatNumber(item.value)}</p>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Tracked events</CardTitle>
            <CardDescription>Only non-zero events are shown to keep the panel readable.</CardDescription>
          </CardHeader>
          <CardContent>
            {eventRows.length === 0 ? <p className="text-sm text-slate-500">No tracked events in this period.</p> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {eventRows.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{type.replaceAll("_", " ")}</p>
                    <Badge>{formatNumber(count)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI feedback</CardTitle>
            <CardDescription>Feedback events help improve prompt quality without storing requirement content.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-950">{formatNumber(analytics.aiFeedback.submitted)}</p>
            <p className="mt-2 text-sm text-slate-500">feedback submissions</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CollaborationPanel({
  activity,
  notifications,
  members,
  invitations,
  inviteDraft,
  inviteToken,
  loading,
  onInviteDraftChange,
  onCreateInvitation,
  onCancelInvitation,
  onMarkRead,
}: {
  activity: ProjectActivity[];
  notifications: Notification[];
  members: ProjectMember[];
  invitations: ProjectInvitation[];
  inviteDraft: { email: string; role: Exclude<WorkspaceRole, "OWNER"> };
  inviteToken: string;
  loading: string;
  onInviteDraftChange: (draft: { email: string; role: Exclude<WorkspaceRole, "OWNER"> }) => void;
  onCreateInvitation: () => Promise<void>;
  onCancelInvitation: (invitation: ProjectInvitation) => Promise<void>;
  onMarkRead: (notificationId: string) => Promise<void>;
}) {
  const unread = notifications.filter((notification) => !notification.readAt);
  const pendingInvitations = invitations.filter((invitation) => !invitation.acceptedAt && !invitation.cancelledAt && new Date(invitation.expiresAt) > new Date());

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-emerald-600" /> Invite member</CardTitle>
            <CardDescription>Admins can create secure one-time invite tokens for workspace collaborators.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              value={inviteDraft.email}
              onChange={(event) => onInviteDraftChange({ ...inviteDraft, email: event.target.value })}
              placeholder="teammate@example.com"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
            <select
              value={inviteDraft.role}
              onChange={(event) => onInviteDraftChange({ ...inviteDraft, role: event.target.value as Exclude<WorkspaceRole, "OWNER"> })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <Button onClick={() => void onCreateInvitation()} disabled={loading === "invite" || !inviteDraft.email.trim()}>
              {loading === "invite" ? <><Spinner /> Creating</> : <><UserPlus className="h-4 w-4" /> Create invite</>}
            </Button>
            {inviteToken && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold text-emerald-800">One-time acceptance token</p>
                <p className="mt-2 break-all font-mono text-xs text-emerald-900">{inviteToken}</p>
                <p className="mt-2 text-xs text-emerald-700">Show this only to the invited user. It is not stored in plain text.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members & pending invites</CardTitle>
            <CardDescription>{members.length} active member{members.length === 1 ? "" : "s"} · {pendingInvitations.length} pending invite{pendingInvitations.length === 1 ? "" : "s"}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active members</p>
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{member.user.name}</p>
                      <p className="text-xs text-slate-500">{member.user.email}</p>
                    </div>
                    <Badge>{member.role}</Badge>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending invites</p>
                {pendingInvitations.length === 0 ? <p className="text-sm text-slate-500">No pending invitations.</p> : pendingInvitations.map((invitation) => (
                  <div key={invitation.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{invitation.email}</p>
                        <p className="mt-1 text-xs text-slate-500">Invited by {invitation.invitedBy.name} · expires {new Date(invitation.expiresAt).toLocaleDateString()}</p>
                      </div>
                      <Badge>{invitation.role}</Badge>
                    </div>
                    <Button className="mt-3" size="sm" variant="outline" onClick={() => void onCancelInvitation(invitation)} disabled={loading === `invite-cancel-${invitation.id}`}>
                      {loading === `invite-cancel-${invitation.id}` ? <><Spinner /> Cancelling</> : "Cancel invite"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-sky-600" /> Project activity</CardTitle>
            <CardDescription>Recent collaboration events across tasks, comments and workflow changes.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? <p className="text-sm text-slate-500">No activity recorded yet.</p> : (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.action.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-xs text-slate-500">By {item.actor.name} · {item.entityType.toLowerCase()}</p>
                      </div>
                      <Badge>{new Date(item.createdAt).toLocaleString()}</Badge>
                    </div>
                    {typeof item.metadata.taskTitle === "string" && <p className="mt-3 text-sm text-slate-600">{item.metadata.taskTitle}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4 text-violet-600" /> Notifications</CardTitle>
            <CardDescription>{unread.length} unread notification{unread.length === 1 ? "" : "s"}.</CardDescription>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? <p className="text-sm text-slate-500">No notifications yet.</p> : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div key={notification.id} className={`rounded-2xl border p-4 ${notification.readAt ? "border-slate-200 bg-white" : "border-violet-200 bg-violet-50/60"}`}>
                    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                    {notification.body && <p className="mt-1 text-xs leading-5 text-slate-500">{notification.body}</p>}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</span>
                      {!notification.readAt && <Button size="sm" variant="outline" onClick={() => onMarkRead(notification.id)}>Mark read</Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IntegrationsPanel({
  integrations,
  draft,
  loading,
  onDraftChange,
  onCreate,
  onUpdateStatus,
  onDelete,
}: {
  integrations: ProjectIntegration[];
  draft: { provider: IntegrationProvider; displayName: string; externalRef: string; config: string };
  loading: string;
  onDraftChange: (draft: { provider: IntegrationProvider; displayName: string; externalRef: string; config: string }) => void;
  onCreate: () => Promise<void>;
  onUpdateStatus: (integration: ProjectIntegration, status: IntegrationStatus) => Promise<void>;
  onDelete: (integration: ProjectIntegration) => Promise<void>;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="h-4 w-4 text-sky-600" /> Add integration</CardTitle>
          <CardDescription>Store only non-secret routing config here. API tokens belong in a secure secret store.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Provider</label>
          <select
            value={draft.provider}
            onChange={(event) => onDraftChange({ ...draft, provider: event.target.value as IntegrationProvider })}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
          >
            {integrationProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
          </select>

          <label className="block text-sm font-medium text-slate-700">Display name</label>
          <input
            value={draft.displayName}
            onChange={(event) => onDraftChange({ ...draft, displayName: event.target.value })}
            placeholder="GitHub issues"
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
          />

          <label className="block text-sm font-medium text-slate-700">External reference</label>
          <input
            value={draft.externalRef}
            onChange={(event) => onDraftChange({ ...draft, externalRef: event.target.value })}
            placeholder="owner/repo, board key, channel, or webhook URL"
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
          />

          <label className="block text-sm font-medium text-slate-700">Config JSON</label>
          <Textarea
            className="min-h-28 bg-white font-mono text-xs"
            value={draft.config}
            onChange={(event) => onDraftChange({ ...draft, config: event.target.value })}
            placeholder='{"labels":["specforge"],"dryRun":true}'
          />

          <Button onClick={() => void onCreate()} disabled={loading === "integration-create" || !draft.displayName.trim()}>
            {loading === "integration-create" ? <><Spinner /> Saving</> : "Create integration"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured integrations</CardTitle>
          <CardDescription>Manage provider status and external routing references for this project.</CardDescription>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? <EmptyState icon={Plug} title="No integrations configured" text="Add GitHub, Jira, Linear, Slack or webhook routing when the project needs external handoff." /> : (
            <div className="grid gap-3 xl:grid-cols-2">
              {integrations.map((integration) => (
                <div key={integration.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><Badge>{integration.provider}</Badge><Badge className={integration.status === "CONNECTED" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : integration.status === "ERROR" ? "border-rose-200 bg-rose-50 text-rose-700" : ""}>{integration.status}</Badge></div>
                      <h3 className="mt-3 font-semibold text-slate-900">{integration.displayName}</h3>
                      <p className="mt-1 text-xs text-slate-500">{integration.externalRef || "No external reference"}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => void onDelete(integration)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                  </div>
                  {integration.lastError && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{integration.lastError}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={loading === `integration-${integration.id}`} onClick={() => void onUpdateStatus(integration, integration.status === "PAUSED" ? "CONNECTED" : "PAUSED")}>
                      {integration.status === "PAUSED" ? "Resume" : "Pause"}
                    </Button>
                    <span className="text-xs text-slate-500">Updated {new Date(integration.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskCommentsPanel({
  task,
  comments,
  draft,
  loading,
  onDraftChange,
  onSubmit,
}: {
  task: Task;
  comments: TaskComment[];
  draft: string;
  loading: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="space-y-2">
        {comments.length === 0 ? <p className="text-xs text-slate-500">No comments yet.</p> : comments.map((comment) => (
          <div key={comment.id} className="rounded-lg bg-white p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-slate-700">{comment.author.name}</p>
              <span className="text-[10px] text-slate-400">{new Date(comment.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{comment.body}</p>
          </div>
        ))}
      </div>
      <Textarea
        className="mt-3 min-h-20 bg-white text-xs"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={`Comment on "${task.title}"...`}
      />
      <Button size="sm" className="mt-2" disabled={loading || !draft.trim()} onClick={() => void onSubmit()}>
        {loading ? <><Spinner /> Posting</> : "Post comment"}
      </Button>
    </div>
  );
}

function TelemetryGrid({ analysis }: { analysis: AIAnalysis }) {
  const items = [
    { label: "Analysis attempts", value: analysis.attempts.toString() },
    { label: "Analysis duration", value: formatDuration(analysis.durationMs) },
    { label: "Analysis tokens", value: formatNumber(analysis.totalTokens) },
    { label: "Prompt schema", value: analysis.promptSchemaVersion },
    { label: "Task attempts", value: analysis.taskGenerationAttempts.toString() },
    { label: "Task duration", value: formatDuration(analysis.taskGenerationDurationMs) },
    { label: "Task tokens", value: formatNumber(analysis.taskGenerationTotalTokens) },
    { label: "Last updated", value: new Date(analysis.updatedAt).toLocaleString() },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /> AI telemetry</CardTitle>
        <CardDescription>Attempts, duration, token usage and safe error categories.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
        {(analysis.errorCategory || analysis.taskGenerationErrorCategory) && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {analysis.errorCategory && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <p className="font-semibold">Analysis error: {analysis.errorCategory.replaceAll("_", " ")}</p>
                {analysis.errorMessage && <p className="mt-1 text-xs leading-5">{analysis.errorMessage}</p>}
              </div>
            )}
            {analysis.taskGenerationErrorCategory && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-semibold">Task generation error: {analysis.taskGenerationErrorCategory.replaceAll("_", " ")}</p>
                {analysis.taskGenerationErrorMessage && <p className="mt-1 text-xs leading-5">{analysis.taskGenerationErrorMessage}</p>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ClarificationAnswerCard({
  analysis,
  requirement,
  loading,
  onSubmit,
}: {
  analysis: AIAnalysis;
  requirement: Requirement;
  loading: boolean;
  onSubmit: (answers: Array<{ question: string; answer: string; required: boolean }>) => Promise<void>;
}) {
  const questions = analysis.clarificationQuestions?.filter((question) => question.required) ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries((requirement.clarificationAnswers ?? []).map((item) => [item.question, item.answer])));

  if (requirement.status !== "NEEDS_CLARIFICATION" || questions.length === 0) return null;

  const canSubmit = questions.every((question) => answers[question.question]?.trim());

  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Required clarification answers</CardTitle>
        <CardDescription>Answer each required question to mark this requirement ready for human approval.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((question, index) => (
          <div key={`${question.question}-${index}`} className="rounded-xl bg-white p-3">
            <p className="text-sm font-medium text-slate-900">{question.question}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{question.reason}</p>
            <Textarea
              className="mt-3 min-h-20 bg-white"
              value={answers[question.question] ?? ""}
              onChange={(event) => setAnswers((current) => ({ ...current, [question.question]: event.target.value }))}
              placeholder="Write the decision or answer here..."
            />
          </div>
        ))}
        <Button
          disabled={loading || !canSubmit}
          onClick={() => onSubmit(questions.map((question) => ({
            question: question.question,
            answer: answers[question.question]?.trim() ?? "",
            required: question.required,
          })))}
        >
          {loading ? <><Spinner /> Saving answers</> : "Save answers and mark ready"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [usage, setUsage] = useState<ProjectUsage | null>(null);
  const [analytics, setAnalytics] = useState<ProjectAnalyticsSummary | null>(null);
  const [activity, setActivity] = useState<ProjectActivity[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [inviteDraft, setInviteDraft] = useState<{ email: string; role: Exclude<WorkspaceRole, "OWNER"> }>({ email: "", role: "MEMBER" });
  const [inviteToken, setInviteToken] = useState("");
  const [integrations, setIntegrations] = useState<ProjectIntegration[]>([]);
  const [integrationDraft, setIntegrationDraft] = useState<{ provider: IntegrationProvider; displayName: string; externalRef: string; config: string }>({
    provider: "GITHUB",
    displayName: "",
    externalRef: "",
    config: "{}",
  });
  const [openCommentsTaskId, setOpenCommentsTaskId] = useState<string>("");
  const [commentsByTask, setCommentsByTask] = useState<Record<string, TaskComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selectedRequirementId, setSelectedRequirementId] = useState<string>("");
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string>("");
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projectData, requirementData, taskData, sprintData, usageData, analyticsData, activityData, notificationData, memberData, invitationData, integrationData] = await Promise.all([
        api<{ project: Project }>(`/projects/${projectId}`),
        api<{ requirements: Requirement[] }>(`/projects/${projectId}/requirements`),
        api<{ tasks: Task[] }>(`/projects/${projectId}/tasks`),
        api<{ sprints: Sprint[] }>(`/projects/${projectId}/sprints`),
        api<ProjectUsage>(`/projects/${projectId}/usage`),
        api<ProjectAnalyticsSummary>(`/projects/${projectId}/analytics/summary?days=30`),
        api<{ activity: ProjectActivity[] }>(`/projects/${projectId}/activity?limit=25`),
        api<{ notifications: Notification[] }>("/notifications?limit=10"),
        api<{ members: ProjectMember[] }>(`/projects/${projectId}/members`),
        api<{ invitations: ProjectInvitation[] }>(`/projects/${projectId}/invitations`),
        api<{ integrations: ProjectIntegration[] }>(`/projects/${projectId}/integrations`),
      ]);
      setProject(projectData.project);
      setRequirements(requirementData.requirements);
      setTasks(taskData.tasks);
      setSprints(sprintData.sprints);
      setUsage(usageData);
      setAnalytics(analyticsData);
      setActivity(activityData.activity);
      setNotifications(notificationData.notifications);
      setMembers(memberData.members);
      setInvitations(invitationData.invitations);
      setIntegrations(integrationData.integrations);
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
      const [refreshed, usageData, analyticsData] = await Promise.all([
        api<{ requirements: Requirement[] }>(`/projects/${projectId}/requirements`),
        api<ProjectUsage>(`/projects/${projectId}/usage`),
        api<ProjectAnalyticsSummary>(`/projects/${projectId}/analytics/summary?days=30`),
      ]);
      setRequirements(refreshed.requirements);
      setUsage(usageData);
      setAnalytics(analyticsData);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "AI analysis failed");
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
      const [usageData, analyticsData] = await Promise.all([
        api<ProjectUsage>(`/projects/${projectId}/usage`),
        api<ProjectAnalyticsSummary>(`/projects/${projectId}/analytics/summary?days=30`),
      ]);
      setUsage(usageData);
      setAnalytics(analyticsData);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Task generation failed");
    } finally {
      setAction("");
    }
  }

  async function saveClarificationAnswers(answers: Array<{ question: string; answer: string; required: boolean }>) {
    if (!selectedRequirement) return;
    setAction("clarifications");
    setError("");
    try {
      const data = await api<{ requirement: Requirement }>(`/requirements/${selectedRequirement.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          clarificationAnswers: answers,
          status: "READY",
        }),
      });
      setRequirements((current) => current.map((item) => item.id === data.requirement.id ? data.requirement : item));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Clarification answers could not be saved");
    } finally {
      setAction("");
    }
  }

  async function approveRequirement() {
    if (!selectedRequirement) return;
    setAction("approve");
    setError("");
    try {
      const data = await api<{ requirement: Requirement }>(`/requirements/${selectedRequirement.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
      });
      setRequirements((current) => current.map((item) => item.id === data.requirement.id ? data.requirement : item));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Requirement could not be approved");
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

  async function assignTaskMember(task: Task, assigneeId: string) {
    setError("");
    try {
      const data = await api<{ task: Task }>(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeId: assigneeId || null }),
      });
      setTasks((current) => current.map((item) => item.id === task.id ? data.task : item));
      const refreshed = await api<{ activity: ProjectActivity[] }>(`/projects/${projectId}/activity?limit=25`);
      setActivity(refreshed.activity);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Task assignee could not be updated");
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

  async function downloadExport(path: string, filename: string, type: string) {
    setError("");
    try {
      const content = await apiText(path);
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Export failed");
    }
  }

  async function downloadBlobExport(path: string, filename: string) {
    setError("");
    try {
      const blob = await apiBlob(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Export failed");
    }
  }

  async function exportTasksCsv() {
    await downloadExport(
      `/projects/${projectId}/exports/tasks.csv`,
      `specforge-tasks-${project?.key ?? projectId}.csv`,
      "text/csv;charset=utf-8",
    );
  }

  async function exportSprintsCsv() {
    await downloadExport(
      `/projects/${projectId}/exports/sprints.csv`,
      `specforge-sprints-${project?.key ?? projectId}.csv`,
      "text/csv;charset=utf-8",
    );
  }

  async function exportPlanningJson() {
    await downloadExport(
      `/projects/${projectId}/exports/planning.json`,
      `specforge-planning-${project?.key ?? projectId}.json`,
      "application/json;charset=utf-8",
    );
  }

  async function exportPlanningPdf() {
    await downloadBlobExport(
      `/projects/${projectId}/exports/planning.pdf`,
      `specforge-planning-${project?.key ?? projectId}.pdf`,
    );
  }

  async function submitAnalysisFeedback(useful: boolean) {
    if (!analysis) return;
    setAction(useful ? "feedback-useful" : "feedback-not-useful");
    setError("");
    setFeedbackMessage("");
    try {
      await api(`/analyses/${analysis.id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ useful }),
      });
      setFeedbackMessage(useful ? "Thanks — marked this AI output as useful." : "Thanks — marked this AI output for improvement.");
      const refreshed = await api<ProjectAnalyticsSummary>(`/projects/${projectId}/analytics/summary?days=30`);
      setAnalytics(refreshed);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "AI feedback could not be saved");
    } finally {
      setAction("");
    }
  }

  async function toggleTaskComments(taskId: string) {
    const nextTaskId = openCommentsTaskId === taskId ? "" : taskId;
    setOpenCommentsTaskId(nextTaskId);
    if (!nextTaskId || commentsByTask[taskId]) return;
    setAction(`comments-${taskId}`);
    setError("");
    try {
      const data = await api<{ comments: TaskComment[] }>(`/tasks/${taskId}/comments`);
      setCommentsByTask((current) => ({ ...current, [taskId]: data.comments }));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Task comments could not be loaded");
    } finally {
      setAction("");
    }
  }

  async function postTaskComment(taskId: string) {
    const body = commentDrafts[taskId]?.trim();
    if (!body) return;
    setAction(`comment-post-${taskId}`);
    setError("");
    try {
      const data = await api<{ comment: TaskComment }>(`/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setCommentsByTask((current) => ({ ...current, [taskId]: [...(current[taskId] ?? []), data.comment] }));
      setCommentDrafts((current) => ({ ...current, [taskId]: "" }));
      const refreshed = await api<{ activity: ProjectActivity[] }>(`/projects/${projectId}/activity?limit=25`);
      setActivity(refreshed.activity);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Task comment could not be posted");
    } finally {
      setAction("");
    }
  }

  async function markNotificationRead(notificationId: string) {
    setError("");
    try {
      const data = await api<{ notification: Notification }>(`/notifications/${notificationId}/read`, { method: "PATCH" });
      setNotifications((current) => current.map((notification) => notification.id === notificationId ? data.notification : notification));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Notification could not be updated");
    }
  }

  async function createInvitation() {
    setAction("invite");
    setError("");
    setInviteToken("");
    try {
      const data = await api<{ invitation: ProjectInvitation }>(`/projects/${projectId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: inviteDraft.email.trim(), role: inviteDraft.role }),
      });
      setInvitations((current) => [data.invitation, ...current]);
      setInviteToken(data.invitation.acceptanceToken ?? "");
      setInviteDraft({ email: "", role: "MEMBER" });
      const refreshed = await api<{ activity: ProjectActivity[] }>(`/projects/${projectId}/activity?limit=25`);
      setActivity(refreshed.activity);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Invitation could not be created");
    } finally {
      setAction("");
    }
  }

  async function cancelInvitation(invitation: ProjectInvitation) {
    setAction(`invite-cancel-${invitation.id}`);
    setError("");
    try {
      const data = await api<{ invitation: ProjectInvitation }>(`/invitations/${invitation.id}`, { method: "DELETE" });
      setInvitations((current) => current.map((item) => item.id === invitation.id ? data.invitation : item));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Invitation could not be cancelled");
    } finally {
      setAction("");
    }
  }

  async function createIntegration() {
    setAction("integration-create");
    setError("");
    try {
      const parsedConfig = JSON.parse(integrationDraft.config || "{}") as Record<string, unknown>;
      const data = await api<{ integration: ProjectIntegration }>(`/projects/${projectId}/integrations`, {
        method: "POST",
        body: JSON.stringify({
          provider: integrationDraft.provider,
          displayName: integrationDraft.displayName.trim(),
          externalRef: integrationDraft.externalRef.trim() || undefined,
          config: parsedConfig,
        }),
      });
      setIntegrations((current) => [...current, data.integration].sort((left, right) => left.provider.localeCompare(right.provider)));
      setIntegrationDraft({ provider: "GITHUB", displayName: "", externalRef: "", config: "{}" });
    } catch (reason) {
      setError(reason instanceof SyntaxError ? "Integration config must be valid JSON" : reason instanceof ApiClientError ? reason.message : "Integration could not be created");
    } finally {
      setAction("");
    }
  }

  async function updateIntegrationStatus(integration: ProjectIntegration, status: IntegrationStatus) {
    setAction(`integration-${integration.id}`);
    setError("");
    try {
      const data = await api<{ integration: ProjectIntegration }>(`/integrations/${integration.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setIntegrations((current) => current.map((item) => item.id === integration.id ? data.integration : item));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Integration could not be updated");
    } finally {
      setAction("");
    }
  }

  async function deleteIntegration(integration: ProjectIntegration) {
    setAction(`integration-${integration.id}`);
    setError("");
    try {
      await api(`/integrations/${integration.id}`, { method: "DELETE" });
      setIntegrations((current) => current.filter((item) => item.id !== integration.id));
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Integration could not be deleted");
    } finally {
      setAction("");
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

      <UsageQuotaCard usage={usage} />

      <Tabs defaultValue="requirements">
        <TabsList>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="analysis">AI analysis</TabsTrigger>
          <TabsTrigger value="tasks">Tasks <span className="ml-1 opacity-60">{tasks.length}</span></TabsTrigger>
          <TabsTrigger value="sprints">Sprints <span className="ml-1 opacity-60">{sprints.length}</span></TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="requirements">
          {requirements.length === 0 ? <EmptyState icon={FileText} title="No requirements yet" text="Add a client requirement to start the AI planning workflow." /> : (
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <div className="space-y-2">{requirements.map((requirement) => <button key={requirement.id} onClick={() => setSelectedRequirementId(requirement.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedRequirementId === requirement.id ? "border-sky-300 bg-sky-50/70 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}><div className="flex items-start justify-between gap-3"><p className="font-semibold text-slate-900">{requirement.title}</p><Badge className="shrink-0">v{requirement.versions[0]?.versionNumber ?? 1}</Badge></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{requirement.currentContent}</p><p className={`mt-3 text-xs font-medium ${requirement.status === "NEEDS_CLARIFICATION" ? "text-amber-700" : "text-emerald-700"}`}>{requirement.status.replaceAll("_", " ")}</p></button>)}</div>
              {selectedRequirement && <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{selectedRequirement.title}</CardTitle><CardDescription>Latest version {selectedRequirement.versions[0]?.versionNumber ?? 1}</CardDescription></div><div className="flex flex-wrap gap-2"><EditRequirementDialog requirement={selectedRequirement} onUpdated={(updated) => { setRequirements((current) => current.map((item) => item.id === updated.id ? updated : item)); setAnalysis(null); }} /><Button onClick={() => runAnalysis(false)} disabled={action === "analyze"}>{action === "analyze" ? <><Spinner /> Analyzing</> : <><Sparkles className="h-4 w-4" /> Analyze</>}</Button></div></div></CardHeader><CardContent><div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">{selectedRequirement.currentContent}</div></CardContent></Card>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis">
          {!selectedRequirement ? <EmptyState icon={Sparkles} title="Select a requirement" text="Choose a requirement before running AI analysis." /> : !analysis ? <Card className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Sparkles className="h-6 w-6" /></span><h3 className="mt-4 font-semibold">Ready for analysis</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Generate clarification questions, user stories, technical plans and risk analysis.</p><Button className="mt-5" onClick={() => runAnalysis(false)} disabled={action === "analyze"}>{action === "analyze" ? <><Spinner /> Analyzing</> : "Run AI analysis"}</Button></div></Card> : analysis.status !== "COMPLETED" ? <div className="space-y-5"><TelemetryGrid analysis={analysis} /><Card className="p-6"><h3 className="font-semibold">Analysis {analysis.status.toLowerCase()}</h3><p className="mt-2 text-sm text-slate-500">{analysis.errorMessage || "Please try again."}</p><Button className="mt-4" onClick={() => runAnalysis(true)}><RefreshCcw className="h-4 w-4" /> Retry</Button></Card></div> : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-violet-600">{analysis.provider} · {analysis.model}</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Development blueprint</h2></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => runAnalysis(true)} disabled={action === "analyze"}><RefreshCcw className="h-4 w-4" /> Reanalyze</Button>{selectedRequirement.status === "READY" && <Button variant="outline" onClick={() => approveRequirement()} disabled={action === "approve"}>{action === "approve" ? <><Spinner /> Approving</> : <><CheckCircle2 className="h-4 w-4" /> Approve</>}</Button>}<Button onClick={() => generateTasks(false)} disabled={action === "tasks" || selectedRequirement.status !== "APPROVED"}>{action === "tasks" ? <><Spinner /> Generating</> : <><ListChecks className="h-4 w-4" /> Generate tasks</>}</Button></div></div>
              {selectedRequirement.status === "NEEDS_CLARIFICATION" && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Resolve the required questions, update the requirement, then mark it ready before generating tasks.</div>}
              {selectedRequirement.status !== "APPROVED" && selectedRequirement.status !== "NEEDS_CLARIFICATION" && <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">Approve this requirement before generating tasks.</div>}
              <TelemetryGrid analysis={analysis} />
              <Card>
                <CardHeader>
                  <CardTitle>AI output feedback</CardTitle>
                  <CardDescription>Rate this output so analytics can guide prompt and schema improvements.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => submitAnalysisFeedback(true)} disabled={action.startsWith("feedback")}><ThumbsUp className="h-4 w-4" /> Useful</Button>
                    <Button variant="outline" onClick={() => submitAnalysisFeedback(false)} disabled={action.startsWith("feedback")}><ThumbsDown className="h-4 w-4" /> Needs improvement</Button>
                  </div>
                  {feedbackMessage && <p className="mt-3 text-sm text-emerald-700">{feedbackMessage}</p>}
                </CardContent>
              </Card>
              <ClarificationAnswerCard analysis={analysis} requirement={selectedRequirement} loading={action === "clarifications"} onSubmit={saveClarificationAnswers} />
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Engineering backlog</h2><p className="mt-1 text-sm text-slate-500">Move tasks through the workflow and assign them to a sprint.</p>{selectedRequirement && selectedRequirement.status !== "APPROVED" && <p className="mt-1 text-xs text-amber-700">Approve the selected requirement before generating tasks.</p>}</div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void exportTasksCsv()} disabled={tasks.length === 0}><Download className="h-4 w-4" /> Tasks CSV</Button><Button variant="outline" onClick={() => void exportPlanningJson()} disabled={!project}><Download className="h-4 w-4" /> Planning JSON</Button><Button variant="outline" onClick={() => void exportPlanningPdf()} disabled={!project}><Download className="h-4 w-4" /> Planning PDF</Button>{analysis && <Button variant="outline" onClick={() => generateTasks(tasks.some((task) => task.analysisId === analysis.id))} disabled={action === "tasks" || selectedRequirement?.status !== "APPROVED"}>{action === "tasks" && <Spinner />} {tasks.some((task) => task.analysisId === analysis.id) ? "Regenerate tasks" : "Generate tasks"}</Button>}</div></div>
          {tasks.length === 0 ? <EmptyState icon={ListChecks} title="No tasks generated" text="Analyze a requirement and generate a development-ready backlog." /> : <div className="overflow-x-auto pb-3"><div className="grid min-w-[1100px] grid-cols-5 gap-3">{taskColumns.map((column) => <div key={column.key} className="rounded-2xl bg-slate-100/80 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{column.label}</h3><Badge>{groupedTasks[column.key].length}</Badge></div><div className="space-y-3">{groupedTasks[column.key].map((task) => <motion.div layout key={task.id}><Card className="p-3.5"><div className="flex items-start justify-between gap-2"><Badge>{task.type}</Badge><Badge className={priorityClass[task.priority]}>{task.priority}</Badge></div><h4 className="mt-3 text-sm font-semibold leading-5">{task.title}</h4><p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">{task.description}</p><div className="mt-2 flex flex-wrap gap-2"><EditTaskDialog task={task} onUpdated={(updated) => setTasks((current) => current.map((item) => item.id === updated.id ? updated : item))} /><Button size="sm" variant="outline" onClick={() => void toggleTaskComments(task.id)}><MessageSquare className="h-3.5 w-3.5" /> Comments</Button></div><div className="mt-3 flex flex-wrap gap-1">{task.labels.slice(0, 3).map((label) => <span key={label} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{label}</span>)}</div><div className="mt-4 grid gap-2"><select aria-label="Task status" value={task.status} onChange={(event) => void updateTaskStatus(task, event.target.value as TaskStatus)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none">{taskColumns.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><select aria-label="Sprint assignment" value={task.sprintId ?? ""} onChange={(event) => void assignSprint(task, event.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"><option value="">No sprint</option>{sprints.filter((sprint) => sprint.status !== "COMPLETED").map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select><select aria-label="Task assignee" value={task.assigneeId ?? ""} onChange={(event) => void assignTaskMember(task, event.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none"><option value="">Unassigned</option>{members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name} · {member.role}</option>)}</select></div>{openCommentsTaskId === task.id && <TaskCommentsPanel task={task} comments={commentsByTask[task.id] ?? []} draft={commentDrafts[task.id] ?? ""} loading={action === `comment-post-${task.id}` || action === `comments-${task.id}`} onDraftChange={(value) => setCommentDrafts((current) => ({ ...current, [task.id]: value }))} onSubmit={() => postTaskComment(task.id)} />}<div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500"><span>{task.storyPoints ?? "—"} points</span><span>{task.assignee?.name ?? "Unassigned"} · {task.sprint?.name ?? "Backlog"}</span></div></Card></motion.div>)}</div></div>)}</div></div>}
        </TabsContent>

        <TabsContent value="sprints">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Sprint planning</h2><p className="mt-1 text-sm text-slate-500">Organize backlog tasks into focused delivery cycles.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void exportSprintsCsv()} disabled={sprints.length === 0}><Download className="h-4 w-4" /> Sprints CSV</Button><CreateSprintDialog projectId={projectId} onCreated={(sprint) => setSprints((current) => [sprint, ...current])} /></div></div>
          {sprints.length === 0 ? <EmptyState icon={Rocket} title="No sprints planned" text="Create a sprint, set a capacity and assign generated tasks from the task board." /> : (
            <div className="grid gap-4 lg:grid-cols-2">
              {sprints.map((sprint) => {
                const totalPoints = sprint.tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
                const done = sprint.tasks.filter((task) => task.status === "DONE").length;
                const capacityPercent = sprint.capacityPoints ? Math.min(100, Math.round((totalPoints / sprint.capacityPoints) * 100)) : 0;
                return (
                  <Card key={sprint.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div><CardTitle>{sprint.name}</CardTitle><CardDescription>{sprint.goal || "No sprint goal."}</CardDescription></div>
                        <div className="flex items-center gap-2"><Badge className={sprint.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{sprint.status}</Badge><EditSprintDialog sprint={sprint} onUpdated={(updated) => setSprints((current) => current.map((item) => item.id === updated.id ? updated : item))} /></div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center"><div><p className="text-lg font-bold">{sprint.tasks.length}</p><p className="text-[11px] text-slate-500">Tasks</p></div><div><p className="text-lg font-bold">{totalPoints}</p><p className="text-[11px] text-slate-500">Points</p></div><div><p className="text-lg font-bold">{done}</p><p className="text-[11px] text-slate-500">Done</p></div></div>
                      {sprint.capacityPoints ? <div className="mt-4"><div className="flex justify-between text-xs text-slate-500"><span>Capacity</span><span>{totalPoints} / {sprint.capacityPoints} points</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${capacityPercent}%` }} /></div></div> : null}
                      {(sprint.startDate || sprint.endDate) ? <p className="mt-3 text-xs text-slate-500">{sprint.startDate ? new Date(sprint.startDate).toLocaleDateString() : "No start date"} – {sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : "No end date"}</p> : null}
                      <div className="mt-4 space-y-2">{sprint.tasks.slice(0, 6).map((task) => <div key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2"><CheckCircle2 className={`h-4 w-4 ${task.status === "DONE" ? "text-emerald-500" : "text-slate-300"}`} /><p className="min-w-0 flex-1 truncate text-sm">{task.title}</p><span className="text-xs text-slate-500">{task.storyPoints ?? "—"}p</span></div>)}{sprint.tasks.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Assign tasks from the task board.</p>}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsSummaryCard analytics={analytics} />
        </TabsContent>

        <TabsContent value="collaboration">
          <CollaborationPanel
            activity={activity}
            notifications={notifications}
            members={members}
            invitations={invitations}
            inviteDraft={inviteDraft}
            inviteToken={inviteToken}
            loading={action}
            onInviteDraftChange={setInviteDraft}
            onCreateInvitation={createInvitation}
            onCancelInvitation={cancelInvitation}
            onMarkRead={markNotificationRead}
          />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsPanel
            integrations={integrations}
            draft={integrationDraft}
            loading={action}
            onDraftChange={setIntegrationDraft}
            onCreate={createIntegration}
            onUpdateStatus={updateIntegrationStatus}
            onDelete={deleteIntegration}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
