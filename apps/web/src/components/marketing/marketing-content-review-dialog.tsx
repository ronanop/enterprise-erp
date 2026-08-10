"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { inferSubmitterRole, isMarketingHead, isPublisherOnly } from "@/lib/marketing-verification";
import {
  ApiClientError,
  archiveContentItem,
  canUserReportPosting,
  formatMarketingStatus,
  getContentTimeline,
  getContentWorkflow,
  publishContentItem,
  reportContentPosting,
  submitContentItem,
  updateContentItem,
  type MarketingActivityLog,
  type MarketingContentItem,
} from "@/services/marketing-service";
import { MarketingVerificationPanel } from "@/components/marketing/marketing-verification-panel";

type MarketingContentReviewDialogProps = {
  item: MarketingContentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
};

export function MarketingContentReviewDialog({
  item,
  open,
  onOpenChange,
  onDone,
}: MarketingContentReviewDialogProps) {
  const perms = useMarketingPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<MarketingActivityLog[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [editTheme, setEditTheme] = useState("");
  const [editFontName, setEditFontName] = useState("");
  const [editFontSize, setEditFontSize] = useState("");
  const [editColorCodes, setEditColorCodes] = useState("");
  const [canPublishWorkflow, setCanPublishWorkflow] = useState(false);
  const [postingReportNotes, setPostingReportNotes] = useState("");
  const [postingReportUrl, setPostingReportUrl] = useState("");

  const head = isMarketingHead(perms);
  const publisher = isPublisherOnly(perms);
  const submitterRole = inferSubmitterRole(perms);

  useEffect(() => {
    if (!item || !open) return;
    setEditTitle(item.title);
    setEditBody(item.body ?? "");
    setEditHashtags(item.hashtags ?? "");
    setEditTheme(item.theme ?? "");
    setEditFontName(item.font_name ?? "");
    setEditFontSize(item.font_size ?? "");
    setEditColorCodes(item.color_codes ?? "");
    setError(null);
    setCanPublishWorkflow(false);
    setPostingReportNotes("");
    setPostingReportUrl(item.target_url ?? "");
    void getContentTimeline(item.id)
      .then(setTimeline)
      .catch(() => setTimeline([]));
    void getContentWorkflow(item.id)
      .then((wf) => setCanPublishWorkflow(wf.can_publish))
      .catch(() => setCanPublishWorkflow(false));
  }, [item, open]);

  if (!open || !item) return null;

  const run = async (action: () => Promise<unknown>, closeOnDone = true) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
      if (closeOnDone) onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const canEdit =
    !head &&
    perms.canUpdate &&
    Boolean(submitterRole) &&
    (item.status === "draft" || item.status === "changes_required" || item.status === "in_review");

  const needsPostingReport = canUserReportPosting(item, perms.userId, {
    canSubmit: perms.canSubmit,
    canPublish: perms.canPublish,
    canApprove: perms.canApprove,
    canVerify: perms.canVerify,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close review panel"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="font-mono text-xs text-muted-foreground">{item.content_number}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <FinanceStatusBadge status={item.status} />
            <span className="text-xs text-muted-foreground">{formatMarketingStatus(item.content_type)}</span>
          </div>

          {item.rejection_reason ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="text-xs font-medium uppercase text-amber-800 dark:text-amber-200">Marketing head feedback</p>
              <p className="mt-1 whitespace-pre-wrap">{item.rejection_reason}</p>
            </div>
          ) : null}

          {canEdit ? (
            <div className="space-y-3 rounded-lg border border-border/80 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Edit content</p>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Title</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Post text / body</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Hashtags</label>
                <Input value={editHashtags} onChange={(e) => setEditHashtags(e.target.value)} placeholder="#launch #product" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Theme</label>
                <Input value={editTheme} onChange={(e) => setEditTheme(e.target.value)} placeholder="e.g. Product launch, festive" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Font name</label>
                  <Input value={editFontName} onChange={(e) => setEditFontName(e.target.value)} placeholder="Arial" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Font size</label>
                  <Input value={editFontSize} onChange={(e) => setEditFontSize(e.target.value)} placeholder="14px" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Color codes</label>
                  <Input value={editColorCodes} onChange={(e) => setEditColorCodes(e.target.value)} placeholder="#003366" />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      updateContentItem(item.id, {
                        title: editTitle.trim(),
                        body: editBody.trim() || null,
                        hashtags: editHashtags.trim() || null,
                        theme: editTheme.trim() || null,
                        font_name: editFontName.trim() || null,
                        font_size: editFontSize.trim() || null,
                        color_codes: editColorCodes.trim() || null,
                      }),
                    false,
                  )
                }
              >
                Save edits
              </Button>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm">
              {item.body ? (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Post text</p>
                  <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
                </div>
              ) : null}
              {item.hashtags ? (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Hashtags</p>
                  <p className="mt-1">{item.hashtags}</p>
                </div>
              ) : null}
              {item.theme ? (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Theme</p>
                  <p className="mt-1">{item.theme}</p>
                </div>
              ) : null}
            </div>
          )}

          <MarketingVerificationPanel item={item} onUpdated={onDone} />

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Activity</p>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
              {timeline.map((log) => (
                <li key={log.id}>
                  <span className="font-medium">{formatMarketingStatus(log.action)}</span>
                  {log.details ? <span className="text-muted-foreground"> — {log.details}</span> : null}
                  <span className="ml-2 text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                </li>
              ))}
              {timeline.length === 0 ? <li className="text-muted-foreground">No activity yet.</li> : null}
            </ul>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(item.status === "draft" || item.status === "changes_required") && submitterRole ? (
            <Button type="button" disabled={busy} onClick={() => void run(() => submitContentItem(item.id))}>
              {item.status === "changes_required" ? "Resubmit for verification" : "Start verification workflow"}
            </Button>
          ) : null}

          {publisher && canPublishWorkflow ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  publishContentItem(item.id, {
                    content_item_id: item.id,
                    published_url: item.target_url ?? undefined,
                    notes: "Posted via marketing pipeline",
                  }),
                )
              }
            >
              Log as posted (final)
            </Button>
          ) : null}

          {needsPostingReport ? (
            <>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    reportContentPosting(item.id, {
                      posted: true,
                      notes: postingReportNotes.trim() || undefined,
                      published_url: postingReportUrl.trim() || undefined,
                    }),
                  )
                }
              >
                Yes — I posted it
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    reportContentPosting(item.id, {
                      posted: false,
                      notes: postingReportNotes.trim() || undefined,
                    }),
                  )
                }
              >
                Not posted yet
              </Button>
            </>
          ) : null}

          {item.status === "published" && perms.canArchive ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => archiveContentItem(item.id))}>
              Move to archive
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
