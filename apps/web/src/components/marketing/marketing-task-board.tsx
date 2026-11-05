"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Link2, ListTodo, Loader2, RefreshCw, Upload, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MarketingSignedInProfile } from "@/components/marketing/marketing-signed-in-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canViewAllModuleScreens } from "@/lib/module-access";
import { formatApiError } from "@/services/api-client";
import {
  delegateMarketingTask,
  executeMarketingTask,
  listMarketingTasks,
  listMarketingTeamMembers,
  reviewDeliverableTask,
  submitDeliverableContent,
  type MarketingTask,
  type MarketingTeamMember,
} from "@/services/marketing-service";
import { fileToBase64 } from "@/services/sales-crm-service";
import { getAccessToken } from "@/lib/auth";
import { getApiUrl } from "@/utils/env";

function isDeliverable(task: MarketingTask): boolean {
  return task.metadata_json?.is_deliverable === true || Boolean(task.metadata_json?.deliverable_type);
}

function dueLabel(dueAt?: string | null): string {
  if (!dueAt) return "-";
  return dueAt.slice(0, 10);
}

function sameUser(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function MarketingTaskBoard({ mineOnly = true }: { mineOnly?: boolean }) {
  const { user, adminModuleKeys, moduleRoles, loading: authLoading } = useAuthUser();
  const viewAll = canViewAllModuleScreens(
    "marketing",
    adminModuleKeys,
    user?.userType,
    moduleRoles,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MarketingTask[]>([]);
  const [showAll, setShowAll] = useState(!mineOnly || viewAll);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contentUrl, setContentUrl] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<"link" | "file">("link");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selfChecked, setSelfChecked] = useState(false);
  const [delegateTo, setDelegateTo] = useState("");
  const [teamMembers, setTeamMembers] = useState<MarketingTeamMember[]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (viewAll) setShowAll(true);
  }, [viewAll]);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setRows(await listMarketingTasks(!showAll));
    } catch (err) {
      setRows([]);
      setError(formatApiError(err, "Failed to load tasks"));
    }
  }, [showAll]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aDel = isDeliverable(a) ? 0 : 1;
      const bDel = isDeliverable(b) ? 0 : 1;
      if (aDel !== bDel) return aDel - bDel;
      return (a.due_at || "").localeCompare(b.due_at || "");
    });
  }, [rows]);

  function isMaker(task: MarketingTask): boolean {
    const uid = user?.id;
    if (!uid) return false;
    const meta = task.metadata_json;
    return (
      sameUser(meta?.content_provider_user_id, uid) ||
      sameUser(meta?.editor_user_id, uid) ||
      sameUser(task.owner_user_id, uid) ||
      sameUser(task.assignee_user_id, uid)
    );
  }

  function isApprovalHead(task: MarketingTask): boolean {
    const uid = user?.id;
    if (!uid) return false;
    const meta = task.metadata_json;
    if (sameUser(meta?.approval_head_user_id, uid) || sameUser(task.reviewer_user_id, uid)) {
      return true;
    }
    return (meta?.approval_head_user_ids ?? []).some((id) => sameUser(id, uid));
  }

  function approvalHeadsLabel(task: MarketingTask): string {
    const meta = task.metadata_json;
    const names = (meta?.approval_head_names ?? []).filter(Boolean);
    if (names.length) return names.join(", ");
    return meta?.approval_head_name || "-";
  }

  function canSubmitContent(task: MarketingTask): boolean {
    if (!isDeliverable(task)) return false;
    if (["completed", "cancelled"].includes(task.status)) return false;
    const meta = task.metadata_json;
    const submission = (meta?.submission_status || "").toLowerCase();
    if (submission === "approved") return false;
    // Waiting on approval — makers should not re-submit until reject/improve.
    if (submission === "in_review" || task.status === "in_review") return false;
    if (viewAll) return true;
    return isMaker(task);
  }

  function canReviewContent(task: MarketingTask): boolean {
    if (!isDeliverable(task)) return false;
    if (["completed", "cancelled"].includes(task.status)) return false;
    const meta = task.metadata_json;
    const submission = (meta?.submission_status || "").toLowerCase();
    if (submission !== "in_review" && task.status !== "in_review") return false;
    if (viewAll) return true;
    if (
      moduleRoles.marketing === "approval_head" ||
      moduleRoles.marketing === "marketing_head"
    ) {
      return isApprovalHead(task) || moduleRoles.marketing === "marketing_head";
    }
    return isApprovalHead(task);
  }

  function canTransfer(task: MarketingTask): boolean {
    if (!isDeliverable(task)) return false;
    if (["completed", "cancelled"].includes(task.status)) return false;
    if (viewAll) return true;
    const role = moduleRoles.marketing;
    if (role === "marketing_head" || role === "marketing_associate" || role === "content_creator") {
      return true;
    }
    return isMaker(task);
  }

  function openDeliverable(task: MarketingTask) {
    const meta = task.metadata_json;
    setExpandedId((prev) => (prev === task.id ? null : task.id));
    setSubmitError(null);
    setReviewComment("");
    setContentUrl(meta?.external_link || (meta?.content_url?.startsWith("http") ? meta.content_url : "") || "");
    setDocumentName(meta?.document_name || "");
    setNotes(meta?.submission_notes || "");
    setSubmitMode(meta?.submission_kind === "file" ? "file" : "link");
    setSelectedFile(null);
    setSelfChecked(Boolean(meta?.self_checked));
    setDelegateTo("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (teamMembers.length === 0) {
      void listMarketingTeamMembers()
        .then(setTeamMembers)
        .catch(() => setTeamMembers([]));
    }
  }

  async function onReview(taskId: string, action: "approve" | "reject") {
    if (action === "reject" && !reviewComment.trim()) {
      setSubmitError("Add a reason before rejecting.");
      return;
    }
    setBusy(true);
    setSubmitError(null);
    setError(null);
    try {
      await reviewDeliverableTask(taskId, {
        action,
        comment: reviewComment.trim() || undefined,
      });
      setExpandedId(null);
      setReviewComment("");
      await reload();
    } catch (err) {
      setSubmitError(formatApiError(err, action === "approve" ? "Approve failed" : "Reject failed"));
    } finally {
      setBusy(false);
    }
  }

  function submissionLabel(task: MarketingTask): string {
    const meta = task.metadata_json;
    if (meta?.document_name) return meta.document_name;
    if (meta?.external_link && /^https?:\/\//i.test(meta.external_link)) return "Open link";
    if (meta?.content_url && /^https?:\/\//i.test(meta.content_url)) return "Open link";
    if (meta?.file_storage_path || meta?.submission_kind === "file") return "Open file";
    return "Open";
  }

  function hasOpenableSubmission(task: MarketingTask): boolean {
    const meta = task.metadata_json;
    if (!meta) return false;
    if (meta.external_link && /^https?:\/\//i.test(meta.external_link)) return true;
    if (meta.content_url && /^https?:\/\//i.test(meta.content_url)) return true;
    if (meta.file_storage_path) return true;
    if (meta.content_url?.includes("submission-file")) return true;
    if (meta.submission_kind === "file" && meta.document_name) return true;
    return false;
  }

  async function openSubmittedContent(task: MarketingTask) {
    const meta = task.metadata_json;
    // Prefer real external http(s) links (Canva / Drive / share URLs).
    for (const candidate of [meta?.external_link, meta?.content_url]) {
      if (candidate && /^https?:\/\//i.test(candidate)) {
        window.open(candidate, "_blank", "noopener,noreferrer");
        return;
      }
    }

    const hasFile =
      Boolean(meta?.file_storage_path) ||
      meta?.submission_kind === "file" ||
      Boolean(meta?.content_url?.includes("submission-file"));
    if (!hasFile) {
      throw new Error("No link or file attached yet");
    }

    const token = getAccessToken();
    const base = getApiUrl().replace(/\/+$/, "");
    const res = await fetch(`${base}/marketing/tasks/${task.id}/submission-file`, {
      headers: {
        Accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(res.status === 404 ? "File not found" : "Could not open file");
    }
    const raw = await res.blob();
    const headerType = (res.headers.get("content-type") || "").split(";")[0].trim();
    const name = (meta?.document_name || "").toLowerCase();
    const guessed =
      headerType && headerType !== "application/octet-stream"
        ? headerType
        : name.endsWith(".png")
          ? "image/png"
          : name.endsWith(".jpg") || name.endsWith(".jpeg")
            ? "image/jpeg"
            : name.endsWith(".webp")
              ? "image/webp"
              : name.endsWith(".gif")
                ? "image/gif"
                : name.endsWith(".mp4")
                  ? "video/mp4"
                  : name.endsWith(".webm")
                    ? "video/webm"
                    : name.endsWith(".pdf")
                      ? "application/pdf"
                      : raw.type || "application/octet-stream";
    const blob =
      guessed && guessed !== raw.type ? new Blob([await raw.arrayBuffer()], { type: guessed }) : raw;
    const objectUrl = URL.createObjectURL(blob);
    const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Popup blocked — fall back to same-tab navigation.
      window.location.assign(objectUrl);
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
  }

  async function onExecute(id: string) {
    setBusy(true);
    setError(null);
    try {
      await executeMarketingTask(id);
      await reload();
    } catch (err) {
      setError(formatApiError(err, "Execute failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitContent(taskId: string) {
    if (!selfChecked) {
      setSubmitError("Tick self-check before submitting for approval.");
      return;
    }
    if (submitMode === "link" && !contentUrl.trim() && !documentName.trim() && !notes.trim()) {
      setSubmitError("Add a content link, document name, or notes.");
      return;
    }
    if (submitMode === "file" && !selectedFile && !documentName.trim() && !notes.trim()) {
      setSubmitError("Choose a file to upload, or add a document name / notes.");
      return;
    }
    setBusy(true);
    setSubmitError(null);
    setError(null);
    try {
      const payload: {
        content_url?: string;
        document_name?: string;
        notes?: string;
        content_base64?: string;
        content_type?: string;
        file_name?: string;
        self_checked: boolean;
      } = {
        document_name: documentName.trim() || undefined,
        notes: notes.trim() || undefined,
        self_checked: true,
      };
      if (submitMode === "link") {
        payload.content_url = contentUrl.trim() || undefined;
      } else if (selectedFile) {
        payload.content_base64 = await fileToBase64(selectedFile);
        payload.content_type = selectedFile.type || "application/octet-stream";
        payload.file_name = selectedFile.name;
        payload.document_name = documentName.trim() || selectedFile.name;
        if (contentUrl.trim()) payload.content_url = contentUrl.trim();
      } else if (contentUrl.trim()) {
        payload.content_url = contentUrl.trim();
      }
      await submitDeliverableContent(taskId, payload);
      setExpandedId(null);
      setContentUrl("");
      setDocumentName("");
      setNotes("");
      setSelectedFile(null);
      setSelfChecked(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await reload();
    } catch (err) {
      setSubmitError(formatApiError(err, "Could not submit content"));
    } finally {
      setBusy(false);
    }
  }

  async function onDelegate(taskId: string) {
    if (!delegateTo) {
      setSubmitError("Pick a teammate to transfer this work to.");
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      await delegateMarketingTask(taskId, delegateTo);
      setExpandedId(null);
      await reload();
    } catch (err) {
      setSubmitError(formatApiError(err, "Transfer failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks"
        description="Makers submit content; assigned approval heads approve or reject with a reason. Status updates for everyone on the deliverable."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MarketingSignedInProfile />
            <Button
              type="button"
              size="sm"
              variant={showAll ? "outline" : "secondary"}
              className="h-9 cursor-pointer transition-colors duration-200"
              onClick={() => setShowAll(false)}
            >
              My tasks
            </Button>
            <Button
              type="button"
              size="sm"
              variant={showAll ? "secondary" : "outline"}
              className="h-9 cursor-pointer transition-colors duration-200"
              onClick={() => setShowAll(true)}
            >
              All tasks
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              onClick={() => void reload()}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Task</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Due</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Submission</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-muted-foreground" colSpan={6}>
                    {showAll
                      ? "No tasks yet."
                      : "No tasks assigned to you yet. When a campaign deliverable is assigned, it appears here."}
                  </td>
                </tr>
              ) : (
                sorted.map((row) => {
                  const deliverable = isDeliverable(row);
                  const open = expandedId === row.id;
                  const meta = row.metadata_json;
                  const canSubmit = canSubmitContent(row);
                  const canReview = canReviewContent(row);
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-b border-border/50 transition-colors duration-150 hover:bg-accent/30 ${
                          open ? "bg-accent/20" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-foreground">{row.title}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {row.task_code}
                          </div>
                          {meta?.content_provider_name ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Content: {meta.content_provider_name}
                            </p>
                          ) : null}
                          {meta?.rejection_reason || meta?.improvement_comment ? (
                            <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-400">
                              {meta.submission_status === "rejected" ? "Rejected: " : "Feedback: "}
                              {meta.rejection_reason || meta.improvement_comment}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 capitalize text-muted-foreground">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {deliverable
                              ? (meta?.deliverable_type || row.task_kind).replaceAll("_", " ")
                              : row.task_kind}
                            {deliverable ? (
                              <Badge variant="outline" className="text-[10px] uppercase">
                                Deliverable
                              </Badge>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                          {dueLabel(row.due_at)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {hasOpenableSubmission(row) ? (
                            <button
                              type="button"
                              className="inline-flex max-w-[16rem] cursor-pointer items-center gap-1.5 text-left text-primary transition-colors duration-200 hover:underline"
                              title={submissionLabel(row)}
                              onClick={(e) => {
                                e.stopPropagation();
                                void openSubmittedContent(row).catch((err) =>
                                  setError(formatApiError(err, "Could not open content")),
                                );
                              }}
                            >
                              <Link2 className="size-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{submissionLabel(row)}</span>
                            </button>
                          ) : meta?.document_name || meta?.submission_notes ? (
                            <span className="truncate text-muted-foreground" title={meta.document_name || undefined}>
                              {meta.document_name || "Notes only"}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {deliverable ? (
                              <Button
                                type="button"
                                size="sm"
                                variant={open ? "secondary" : "outline"}
                                className="h-8 cursor-pointer px-3 transition-colors duration-200"
                                disabled={authLoading}
                                onClick={() => openDeliverable(row)}
                              >
                                {open ? "Close" : "Open"}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 cursor-pointer transition-colors duration-200"
                                disabled={busy}
                                onClick={() => void onExecute(row.id)}
                              >
                                <ListTodo className="size-3.5" aria-hidden />
                                Execute
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {open && deliverable ? (
                        <tr className="border-b border-border/50 bg-muted/15">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[12px] font-medium text-foreground">
                                {canReview
                                  ? "Review submitted content — approve or reject with a reason"
                                  : canSubmit
                                    ? "Attach brochure / content link and submit for approval"
                                    : "Deliverable details"}
                              </p>
                              {meta?.submission_status ? (
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {meta.submission_status.replaceAll("_", " ")}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
                              <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-background px-2.5 py-1 text-muted-foreground">
                                <span className="font-medium text-foreground">Content</span>
                                <span className="truncate">{meta?.content_provider_name ?? "-"}</span>
                              </span>
                              <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-background px-2.5 py-1 text-muted-foreground">
                                <span className="font-medium text-foreground">Approval</span>
                                <span className="truncate">{approvalHeadsLabel(row)}</span>
                              </span>
                              <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-background px-2.5 py-1 text-muted-foreground">
                                <span className="font-medium text-foreground">Editor</span>
                                <span className="truncate">{meta?.editor_name ?? "-"}</span>
                              </span>
                            </div>
                            {(meta?.rejection_reason || meta?.improvement_comment) &&
                            meta?.submission_status !== "approved" ? (
                              <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-200">
                                <span className="font-medium">
                                  {meta.submission_status === "rejected"
                                    ? "Rejection reason: "
                                    : "Feedback: "}
                                </span>
                                {meta.rejection_reason || meta.improvement_comment}
                              </div>
                            ) : null}
                            {canReview ? (
                              <div className="mb-3 space-y-2 rounded-md border border-border/60 bg-background/80 p-3">
                                <p className="text-[12px] text-muted-foreground">
                                  Open the submission above, then approve or reject. Reject requires a
                                  reason — it is shown to the content provider and editor, and they can
                                  resubmit.
                                </p>
                                <Textarea
                                  value={reviewComment}
                                  onChange={(e) => setReviewComment(e.target.value)}
                                  placeholder="Reason for reject (required) / optional note for approve"
                                  className="min-h-[4rem] text-sm"
                                  disabled={busy}
                                  aria-label="Review reason"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                                    disabled={busy}
                                    onClick={() => void onReview(row.id, "approve")}
                                  >
                                    {busy ? (
                                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                                    ) : (
                                      <Check className="size-3.5" aria-hidden />
                                    )}
                                    Approve
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                                    disabled={busy}
                                    onClick={() => void onReview(row.id, "reject")}
                                  >
                                    <X className="size-3.5" aria-hidden />
                                    Reject
                                  </Button>
                                  {submitError ? (
                                    <p className="text-[12px] text-destructive">{submitError}</p>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                            {canSubmit ? (
                              <div className="max-w-2xl space-y-3 rounded-md border border-border/60 bg-background/80 p-3">
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={submitMode === "link" ? "secondary" : "outline"}
                                    className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
                                    disabled={busy}
                                    onClick={() => setSubmitMode("link")}
                                  >
                                    <Link2 className="size-3.5 shrink-0" aria-hidden />
                                    Submit link
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={submitMode === "file" ? "secondary" : "outline"}
                                    className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
                                    disabled={busy}
                                    onClick={() => setSubmitMode("file")}
                                  >
                                    <Upload className="size-3.5 shrink-0" aria-hidden />
                                    Upload file
                                  </Button>
                                </div>

                                {submitMode === "link" ? (
                                  <label className="block space-y-1">
                                    <span className="text-[11px] font-medium text-muted-foreground">
                                      Content URL
                                    </span>
                                    <Input
                                      value={contentUrl}
                                      onChange={(e) => setContentUrl(e.target.value)}
                                      placeholder="https://…"
                                      className="h-9"
                                      disabled={busy}
                                      aria-label="Content URL"
                                    />
                                  </label>
                                ) : (
                                  <div className="space-y-2">
                                    <input
                                      ref={fileInputRef}
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.zip,.ai,.psd"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        setSelectedFile(file);
                                        if (file && !documentName.trim()) {
                                          setDocumentName(file.name);
                                        }
                                      }}
                                    />
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-9 shrink-0 cursor-pointer gap-1.5 transition-colors duration-200"
                                        disabled={busy}
                                        onClick={() => fileInputRef.current?.click()}
                                      >
                                        <Upload className="size-3.5 shrink-0" aria-hidden />
                                        {selectedFile ? "Change file" : "Choose file…"}
                                      </Button>
                                      {selectedFile ? (
                                        <span
                                          className="min-w-0 flex-1 truncate rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-[12px] text-foreground"
                                          title={selectedFile.name}
                                        >
                                          {selectedFile.name}
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-muted-foreground">
                                          PDF, Office, image, or zip — max 25 MB
                                        </span>
                                      )}
                                    </div>
                                    <label className="block space-y-1">
                                      <span className="text-[11px] font-medium text-muted-foreground">
                                        Optional share link
                                      </span>
                                      <Input
                                        value={contentUrl}
                                        onChange={(e) => setContentUrl(e.target.value)}
                                        placeholder="https://… (in addition to file)"
                                        className="h-9"
                                        disabled={busy}
                                        aria-label="Optional content URL"
                                      />
                                    </label>
                                  </div>
                                )}

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <label className="block space-y-1">
                                    <span className="text-[11px] font-medium text-muted-foreground">
                                      Document name
                                    </span>
                                    <Input
                                      value={documentName}
                                      onChange={(e) => setDocumentName(e.target.value)}
                                      placeholder="e.g. Brochure v1"
                                      className="h-9"
                                      disabled={busy}
                                      aria-label="Document name"
                                    />
                                  </label>
                                  <label className="block space-y-1">
                                    <span className="text-[11px] font-medium text-muted-foreground">
                                      Notes for approval head
                                    </span>
                                    <Input
                                      value={notes}
                                      onChange={(e) => setNotes(e.target.value)}
                                      placeholder="Optional context"
                                      className="h-9"
                                      disabled={busy}
                                      aria-label="Submission notes"
                                    />
                                  </label>
                                </div>

                                <label className="flex cursor-pointer items-start gap-2 text-[12px]">
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 cursor-pointer"
                                    checked={selfChecked}
                                    disabled={busy}
                                    onChange={(e) => setSelfChecked(e.target.checked)}
                                  />
                                  <span>Self-check done — I reviewed this before approval</span>
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                                    disabled={busy || !selfChecked}
                                    onClick={() => void onSubmitContent(row.id)}
                                  >
                                    {busy ? (
                                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                                    ) : null}
                                    Submit for approval
                                  </Button>
                                  {submitError ? (
                                    <p className="text-[12px] text-destructive">{submitError}</p>
                                  ) : null}
                                </div>
                              </div>
                            ) : !canReview ? (
                              <p className="text-[12px] text-muted-foreground">
                                {meta?.submission_status === "in_review" || row.status === "in_review"
                                  ? "Waiting for an assigned approval head to approve or reject."
                                  : "Assigned content provider / editor can submit. Assigned approval heads review after submit."}
                              </p>
                            ) : null}
                            {canTransfer(row) ? (
                              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/50 pt-3">
                                <label className="space-y-1">
                                  <span className="text-[11px] font-medium text-muted-foreground">
                                    Transfer to (Ansh → Piyush / Harshita)
                                  </span>
                                  <select
                                    value={delegateTo}
                                    onChange={(e) => setDelegateTo(e.target.value)}
                                    disabled={busy}
                                    className="flex h-9 min-w-[12rem] cursor-pointer rounded-md border border-input bg-background px-3 text-sm"
                                  >
                                    <option value="">Select teammate</option>
                                    {teamMembers.map((m) => (
                                      <option key={m.user_id} value={m.user_id}>
                                        {m.display_name} ({m.role})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-9 cursor-pointer transition-colors duration-200"
                                  disabled={busy || !delegateTo}
                                  onClick={() => void onDelegate(row.id)}
                                >
                                  Transfer work
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
