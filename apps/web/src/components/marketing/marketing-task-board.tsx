"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, ListTodo, Loader2, RefreshCw, Upload } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MarketingSignedInProfile } from "@/components/marketing/marketing-signed-in-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { canViewAllModuleScreens } from "@/lib/module-access";
import { formatApiError } from "@/services/api-client";
import {
  executeMarketingTask,
  listMarketingTasks,
  submitDeliverableContent,
  type MarketingTask,
} from "@/services/marketing-service";
import { fileToBase64 } from "@/services/sales-crm-service";
import { getAccessToken } from "@/lib/auth";
import { getApiUrl } from "@/utils/env";

function isDeliverable(task: MarketingTask): boolean {
  return task.metadata_json?.is_deliverable === true || Boolean(task.metadata_json?.deliverable_type);
}

function dueLabel(dueAt?: string | null): string {
  if (!dueAt) return "—";
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

  function isContentProvider(task: MarketingTask): boolean {
    const uid = user?.id;
    if (!uid) return false;
    const meta = task.metadata_json;
    return (
      sameUser(meta?.content_provider_user_id, uid) ||
      sameUser(task.owner_user_id, uid)
    );
  }

  function canSubmitContent(task: MarketingTask): boolean {
    if (!isDeliverable(task)) return false;
    if (["completed", "cancelled"].includes(task.status)) return false;
    const meta = task.metadata_json;
    if (meta?.submission_status === "approved") return false;
    // Content provider, marketing head, or module admin can attach/submit.
    if (viewAll) return true;
    if (moduleRoles.marketing === "marketing_head") return true;
    return isContentProvider(task);
  }

  function openDeliverable(task: MarketingTask) {
    const meta = task.metadata_json;
    setExpandedId((prev) => (prev === task.id ? null : task.id));
    setSubmitError(null);
    setContentUrl(meta?.external_link || (meta?.content_url?.startsWith("http") ? meta.content_url : "") || "");
    setDocumentName(meta?.document_name || "");
    setNotes(meta?.submission_notes || "");
    setSubmitMode(meta?.submission_kind === "file" ? "file" : "link");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function openSubmittedContent(task: MarketingTask) {
    const meta = task.metadata_json;
    const external = meta?.external_link;
    if (external && /^https?:\/\//i.test(external)) {
      window.open(external, "_blank", "noopener,noreferrer");
      return;
    }
    const contentUrlValue = meta?.content_url;
    if (contentUrlValue && /^https?:\/\//i.test(contentUrlValue)) {
      window.open(contentUrlValue, "_blank", "noopener,noreferrer");
      return;
    }
    if (meta?.file_storage_path || contentUrlValue?.includes("/submission-file")) {
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/marketing/tasks/${task.id}/submission-file`, {
        headers: {
          Accept: "*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Could not download file");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return;
    }
    throw new Error("No content attached yet");
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
      } = {
        document_name: documentName.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      if (submitMode === "link") {
        payload.content_url = contentUrl.trim() || undefined;
      } else if (selectedFile) {
        payload.content_base64 = await fileToBase64(selectedFile);
        payload.content_type = selectedFile.type || "application/octet-stream";
        payload.file_name = selectedFile.name;
        payload.document_name = documentName.trim() || selectedFile.name;
        // Optional: also keep a pasteable link if user filled one
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
      if (fileInputRef.current) fileInputRef.current.value = "";
      await reload();
    } catch (err) {
      setSubmitError(formatApiError(err, "Could not submit content"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tasks"
        description="Open a deliverable to attach a brochure link or document, then submit it for approval."
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
                          {meta?.improvement_comment ? (
                            <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-400">
                              Improve: {meta.improvement_comment}
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
                          {meta?.content_url || meta?.document_name || meta?.external_link ? (
                            <button
                              type="button"
                              className="inline-flex cursor-pointer items-center gap-1 text-primary transition-colors duration-200 hover:underline"
                              onClick={() => {
                                void openSubmittedContent(row).catch((err) =>
                                  setError(formatApiError(err, "Could not open content")),
                                );
                              }}
                            >
                              <Link2 className="size-3.5" aria-hidden />
                              {meta?.submission_kind === "file" || meta?.file_storage_path
                                ? meta?.document_name || "File"
                                : "Open link"}
                            </button>
                          ) : (
                            "—"
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
                                {canSubmit
                                  ? "Attach brochure / content link and submit for approval"
                                  : "Deliverable details"}
                              </p>
                              {meta?.submission_status ? (
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {meta.submission_status.replaceAll("_", " ")}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mb-3 grid gap-2 text-[12px] text-muted-foreground md:grid-cols-3">
                              <p>
                                <span className="font-medium text-foreground">Content: </span>
                                {meta?.content_provider_name ?? "—"}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Approval: </span>
                                {meta?.approval_head_name ?? "—"}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Editor: </span>
                                {meta?.editor_name ?? "—"}
                              </p>
                            </div>
                            {canSubmit ? (
                              <>
                                <div className="mb-2 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={submitMode === "link" ? "secondary" : "outline"}
                                    className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
                                    disabled={busy}
                                    onClick={() => setSubmitMode("link")}
                                  >
                                    <Link2 className="size-3.5" aria-hidden />
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
                                    <Upload className="size-3.5" aria-hidden />
                                    Upload file
                                  </Button>
                                </div>
                                <div className="grid gap-2 md:grid-cols-3">
                                  {submitMode === "link" ? (
                                    <Input
                                      value={contentUrl}
                                      onChange={(e) => setContentUrl(e.target.value)}
                                      placeholder="Brochure / content URL"
                                      className="h-9"
                                      disabled={busy}
                                      aria-label="Content URL"
                                    />
                                  ) : (
                                    <div className="flex flex-col gap-1.5">
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
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-9 cursor-pointer justify-start gap-1.5 transition-colors duration-200"
                                        disabled={busy}
                                        onClick={() => fileInputRef.current?.click()}
                                      >
                                        <Upload className="size-3.5" aria-hidden />
                                        {selectedFile ? selectedFile.name : "Choose file…"}
                                      </Button>
                                      <p className="text-[11px] text-muted-foreground">
                                        PDF, Office, image, or zip — max 25 MB
                                      </p>
                                    </div>
                                  )}
                                  <Input
                                    value={documentName}
                                    onChange={(e) => setDocumentName(e.target.value)}
                                    placeholder="Document name (e.g. Brochure v1)"
                                    className="h-9"
                                    disabled={busy}
                                    aria-label="Document name"
                                  />
                                  <Input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Notes for approval head"
                                    className="h-9"
                                    disabled={busy}
                                    aria-label="Submission notes"
                                  />
                                </div>
                                {submitMode === "file" ? (
                                  <Input
                                    value={contentUrl}
                                    onChange={(e) => setContentUrl(e.target.value)}
                                    placeholder="Optional share link (in addition to file)"
                                    className="mt-2 h-9"
                                    disabled={busy}
                                    aria-label="Optional content URL"
                                  />
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
                                    disabled={busy}
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
                              </>
                            ) : (
                              <p className="text-[12px] text-muted-foreground">
                                Only the assigned content provider (or Marketing module admin) can
                                submit content for this deliverable.
                              </p>
                            )}
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
