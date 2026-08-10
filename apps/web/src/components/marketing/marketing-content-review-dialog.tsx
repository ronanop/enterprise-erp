"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import { inferSubmitterRole, isMarketingHead, isPublisherOnly } from "@/lib/marketing-verification";
import {
  canLinkedInHandlerSendToPublisher,
  canLinkedInHandlerSubmitFinalDraftToHead,
  canHeadReviewLinkedInFinalDraft,
  canMarkLinkedInAsPublished,
  hasLinkedInSectionApproval,
  isMarketingContentLocked,
  linkedInFinalDraftAwaitingHead,
  linkedInHandlerAwaitingPublisher,
  linkedInPublishStatusLabel,
  usesLinkedInSectionWorkflow,
} from "@/lib/linkedin-section-approval";
import { MarketingLinkedInFinalDraftPanel } from "@/components/marketing/marketing-linkedin-final-draft-panel";
import { MarketingContentActivityTimeline } from "@/components/marketing/marketing-content-activity-timeline";
import { MarketingContentPreviewCard } from "@/components/marketing/marketing-content-preview-card";
import { MarketingLinkedInHeadFinalDraftApproval } from "@/components/marketing/marketing-linkedin-head-final-draft-approval";
import { MarketingLinkedInHeadSectionApproval } from "@/components/marketing/marketing-linkedin-head-section-approval";
import {
  ApiClientError,
  canUserReportPosting,
  formatMarketingStatus,
  getContentItem,
  getContentTimeline,
  getContentWorkflow,
  linkedInSendToPublisher,
  publishContentItem,
  reportContentPosting,
  submitContentItem,
  updateContentItem,
  type MarketingActivityLog,
  type MarketingContentItem,
} from "@/services/marketing-service";
import { MarketingVerificationPanel, MarketingHeadApprovalFooter } from "@/components/marketing/marketing-verification-panel";

type MarketingContentReviewDialogProps = {
  item: MarketingContentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (updatedItem?: MarketingContentItem) => void;
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
  const [liveItem, setLiveItem] = useState<MarketingContentItem | null>(null);

  const head = isMarketingHead(perms);
  const publisher = isPublisherOnly(perms);
  const submitterRole = inferSubmitterRole(perms);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open && item) {
      setLiveItem(item);
    }
  }, [item, open]);

  const refreshDialogItem = useCallback(
    async (updated?: MarketingContentItem) => {
      const base = updated ?? liveItem ?? item;
      if (!base) return;
      let next = updated ?? base;
      if (!updated) {
        try {
          next = await getContentItem(base.id);
        } catch {
          next = base;
        }
      }
      setLiveItem(next);
      void getContentTimeline(next.id)
        .then(setTimeline)
        .catch(() => setTimeline([]));
      void getContentWorkflow(next.id)
        .then((wf) => setCanPublishWorkflow(wf.can_publish))
        .catch(() => setCanPublishWorkflow(false));
      onDone(next);
    },
    [item, liveItem, onDone],
  );

  const currentItem = liveItem ?? item;

  useEffect(() => {
    if (!currentItem || !open) return;
    setEditTitle(currentItem.title);
    setEditBody(currentItem.body ?? "");
    setEditHashtags(currentItem.hashtags ?? "");
    setEditTheme(currentItem.theme ?? "");
    setEditFontName(currentItem.font_name ?? "");
    setEditFontSize(currentItem.font_size ?? "");
    setEditColorCodes(currentItem.color_codes ?? "");
    setError(null);
    setPostingReportNotes("");
    setPostingReportUrl(currentItem.target_url ?? "");
    void getContentTimeline(currentItem.id)
      .then(setTimeline)
      .catch(() => setTimeline([]));
    void getContentWorkflow(currentItem.id)
      .then((wf) => setCanPublishWorkflow(wf.can_publish))
      .catch(() => setCanPublishWorkflow(false));
  }, [currentItem, open]);

  if (!open || !currentItem) return null;

  const run = async (action: () => Promise<unknown>, closeOnDone = true) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refreshDialogItem();
      if (closeOnDone) onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const locked = isMarketingContentLocked(currentItem);

  const canEdit =
    !locked &&
    !head &&
    perms.canUpdate &&
    Boolean(submitterRole) &&
    (currentItem.status === "draft" || currentItem.status === "changes_required" || currentItem.status === "in_review");

  const needsPostingReport =
    !locked &&
    canUserReportPosting(currentItem, perms.userId, {
      canSubmit: perms.canSubmit,
      canPublish: perms.canPublish,
      canApprove: perms.canApprove,
      canVerify: perms.canVerify,
    });

  const linkedInHeadReview =
    !locked &&
    head &&
    usesLinkedInSectionWorkflow(currentItem) &&
    hasLinkedInSectionApproval(currentItem) &&
    !canHeadReviewLinkedInFinalDraft(currentItem);
  const linkedInHeadFinalDraftReview = !locked && head && canHeadReviewLinkedInFinalDraft(currentItem);
  const handlerFinalDraftReview =
    !locked &&
    !head &&
    Boolean(submitterRole) &&
    usesLinkedInSectionWorkflow(currentItem) &&
    (canLinkedInHandlerSubmitFinalDraftToHead(currentItem, perms.userId) ||
      canLinkedInHandlerSendToPublisher(currentItem, perms.userId) ||
      linkedInFinalDraftAwaitingHead(currentItem) ||
      linkedInHandlerAwaitingPublisher(currentItem));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close review panel"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg"
      >
        <div className="shrink-0 border-b border-border/60 bg-muted/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <h2 className="truncate text-lg font-semibold tracking-tight">{currentItem.title}</h2>
              <p className="font-mono text-[11px] text-muted-foreground">{currentItem.content_number}</p>
              <div className="flex flex-wrap items-center gap-2">
                <FinanceStatusBadge status={currentItem.status} />
                <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {formatMarketingStatus(currentItem.content_type)}
                </span>
                {hasLinkedInSectionApproval(currentItem) && linkedInPublishStatusLabel(currentItem) ? (
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    {linkedInPublishStatusLabel(currentItem)}
                  </span>
                ) : null}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/5 p-5">
          <div className="space-y-5">
            {currentItem.rejection_reason ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Marketing head feedback
                </p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{currentItem.rejection_reason}</p>
              </div>
            ) : null}

            {canEdit ? (
              <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit content</p>
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
                        updateContentItem(currentItem.id, {
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
              <MarketingContentPreviewCard item={currentItem} locked={locked} />
            )}

            {linkedInHeadFinalDraftReview ? (
              <MarketingLinkedInHeadFinalDraftApproval
                item={currentItem}
                onUpdated={(updated) => void refreshDialogItem(updated)}
              />
            ) : linkedInHeadReview ? (
              <MarketingLinkedInHeadSectionApproval
                item={currentItem}
                onUpdated={() => void refreshDialogItem()}
              />
            ) : handlerFinalDraftReview ? (
              <MarketingLinkedInFinalDraftPanel
                item={currentItem}
                userId={perms.userId}
                onUpdated={(updated) => void refreshDialogItem(updated)}
              />
            ) : !locked ? (
              <MarketingVerificationPanel
                item={currentItem}
                onUpdated={() => void refreshDialogItem()}
                headApprovalInFooter={head}
              />
            ) : null}

            <MarketingContentActivityTimeline entries={timeline} />

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        {locked ? null : head && !linkedInHeadReview ? (
          <div className="shrink-0 border-t border-border/60 bg-background p-5 pt-4">
            <MarketingHeadApprovalFooter item={currentItem} onUpdated={() => void refreshDialogItem()} />
          </div>
        ) : head ? null : locked ? null : (
          <div className="shrink-0 border-t border-border/60 p-5 pt-4">
            <div className="flex flex-wrap gap-2">
              {(currentItem.status === "draft" || currentItem.status === "changes_required") && submitterRole ? (
                <Button type="button" disabled={busy} onClick={() => void run(() => submitContentItem(currentItem.id))}>
                  {currentItem.status === "changes_required" ? "Resubmit for verification" : "Start verification workflow"}
                </Button>
              ) : null}

              {canLinkedInHandlerSendToPublisher(currentItem, perms.userId) && !handlerFinalDraftReview ? (
                <Button type="button" disabled={busy} onClick={() => void run(() => linkedInSendToPublisher(currentItem.id))}>
                  Send final draft to publisher
                </Button>
              ) : null}

              {canMarkLinkedInAsPublished(perms, currentItem) && canPublishWorkflow ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      publishContentItem(currentItem.id, {
                        content_item_id: currentItem.id,
                        published_url: postingReportUrl.trim() || undefined,
                        notes: postingReportNotes.trim() || "Marked as published",
                      }),
                    )
                  }
                >
                  Mark as published
                </Button>
              ) : null}

              {publisher && canPublishWorkflow && !hasLinkedInSectionApproval(currentItem) ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      publishContentItem(currentItem.id, {
                        content_item_id: currentItem.id,
                        published_url: currentItem.target_url ?? undefined,
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
                        reportContentPosting(currentItem.id, {
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
                        reportContentPosting(currentItem.id, {
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
