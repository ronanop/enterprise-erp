"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Check, Link2, Loader2, MessageSquareWarning, RefreshCw, Upload, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MarketingSignedInProfile } from "@/components/marketing/marketing-signed-in-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthUser } from "@/hooks/use-auth-user";
import { getAccessToken } from "@/lib/auth";
import { canViewAllModuleScreens } from "@/lib/module-access";
import { formatApiError } from "@/services/api-client";
import {
  listContentReviewQueue,
  reviewContentRequest,
  type MarketingContentReviewItem,
} from "@/services/marketing-service";
import { getApiUrl } from "@/utils/env";

function canReview(
  moduleRoles: Record<string, string>,
  adminModuleKeys: string[],
  userType?: string,
): boolean {
  if (canViewAllModuleScreens("marketing", adminModuleKeys, userType, moduleRoles)) return true;
  const role = moduleRoles.marketing;
  return role === "approval_head" || role === "marketing_head";
}

export function MarketingContentRequestsPage() {
  const { user, moduleRoles, adminModuleKeys, loading: authLoading } = useAuthUser();
  const reviewer = canReview(moduleRoles, adminModuleKeys, user?.userType);

  const [rows, setRows] = useState<MarketingContentReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commentById, setCommentById] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  async function openSubmittedContent(row: MarketingContentReviewItem) {
    const url = row.content_url?.trim() || "";
    if (/^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const taskId = row.deliverable_task_id;
    if (taskId && (url.includes("/submission-file") || url.startsWith("/marketing/"))) {
      const token = getAccessToken();
      const res = await fetch(`${getApiUrl()}/marketing/tasks/${taskId}/submission-file`, {
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listContentReviewQueue());
    } catch (err) {
      setRows([]);
      setError(formatApiError(err, "Failed to load content requests"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onReview(
    id: string,
    action: "approve" | "reject" | "improve",
  ) {
    const comment = (commentById[id] || "").trim();
    if ((action === "reject" || action === "improve") && !comment) {
      setActionError("Add a comment for reject or improve.");
      return;
    }
    setBusyId(id);
    setActionError(null);
    try {
      await reviewContentRequest(id, { action, comment: comment || undefined });
      setCommentById((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err) {
      setActionError(formatApiError(err, "Review action failed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Content requests"
        description="Deliverable submissions awaiting approval. Approval heads can approve, reject, or request improvements with comments."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MarketingSignedInProfile />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {!reviewer && !authLoading ? (
        <p className="text-[12px] text-muted-foreground">
          You can view submissions assigned to you. Approve / reject / improve requires Approval head access.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="erp-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                <th className="px-4 py-2.5">Request</th>
                <th className="px-4 py-2.5">Content</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Due</th>
                <th className="px-4 py-2.5">Review</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Loading requests…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No deliverable submissions yet. Content providers submit from Tasks.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const pending = row.content_status === "in_review";
                  const busy = busyId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-border/50 transition-colors duration-150 hover:bg-accent/30">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-foreground">{row.topic}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {row.request_code}
                          </div>
                          {row.improvement_comment ? (
                            <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-400">
                              Last comment: {row.improvement_comment}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {row.content_url || row.document_name ? (
                            <button
                              type="button"
                              className="inline-flex cursor-pointer items-center gap-1 text-primary transition-colors duration-200 hover:underline"
                              onClick={() => {
                                void openSubmittedContent(row).catch((err) =>
                                  setError(formatApiError(err, "Could not open content")),
                                );
                              }}
                            >
                              {row.content_url?.includes("/submission-file") ? (
                                <Upload className="size-3.5" aria-hidden />
                              ) : (
                                <Link2 className="size-3.5" aria-hidden />
                              )}
                              {row.content_url?.includes("/submission-file")
                                ? row.document_name || "Download file"
                                : row.document_name || "Open link"}
                            </button>
                          ) : (
                            row.submission_notes || "—"
                          )}
                          {row.submission_notes && (row.content_url || row.document_name) ? (
                            <p className="mt-1 text-[12px]">{row.submission_notes}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {row.content_status || row.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                          {row.due_at ? String(row.due_at).slice(0, 10) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {pending && reviewer ? (
                            <div className="space-y-2">
                              <Input
                                value={commentById[row.id] || ""}
                                onChange={(e) =>
                                  setCommentById((prev) => ({ ...prev, [row.id]: e.target.value }))
                                }
                                placeholder="Comment (required for reject / improve)"
                                className="h-9 max-w-sm"
                                disabled={busy}
                                aria-label="Review comment"
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 cursor-pointer gap-1 transition-colors duration-200"
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
                                  variant="outline"
                                  className="h-8 cursor-pointer gap-1 transition-colors duration-200"
                                  disabled={busy}
                                  onClick={() => void onReview(row.id, "improve")}
                                >
                                  <MessageSquareWarning className="size-3.5" aria-hidden />
                                  Improve
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 cursor-pointer gap-1 transition-colors duration-200"
                                  disabled={busy}
                                  onClick={() => void onReview(row.id, "reject")}
                                >
                                  <X className="size-3.5" aria-hidden />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              {pending ? "Awaiting approval head" : "Reviewed"}
                            </span>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
