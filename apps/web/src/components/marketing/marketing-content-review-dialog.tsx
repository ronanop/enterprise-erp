"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, X } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { Button } from "@/components/ui/button";
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
import {
  canHeadReviewVideoFinalDraft,
  canMarkVideoAsPublished,
  canVideoEditorSendToPublisher,
  canVideoEditorSubmitFinalDraftToHead,
  hasVideoSectionApproval,
  usesVideoSectionWorkflow,
  videoEditorAwaitingPublisher,
  videoFinalDraftAwaitingHead,
  videoPublishStatusLabel,
} from "@/lib/video-section-approval";
import { MarketingLinkedInFinalDraftPanel } from "@/components/marketing/marketing-linkedin-final-draft-panel";
import { MarketingVideoFinalDraftPanel } from "@/components/marketing/marketing-video-final-draft-panel";
import { MarketingSectionFinalDraftPreviews } from "@/components/marketing/marketing-section-final-draft-previews";
import { MarketingSectionSourceDraftEditor } from "@/components/marketing/marketing-section-source-draft-editor";
import {
  canEditSectionSourceDraft,
  hasSectionWorkflowFinalDraft,
  publisherSeesFinalDraftOnly,
} from "@/lib/marketing-section-preview";
import { MarketingContentActivityTimeline } from "@/components/marketing/marketing-content-activity-timeline";
import { MarketingContentPreviewCard } from "@/components/marketing/marketing-content-preview-card";
import { MarketingLinkedInHeadFinalDraftApproval } from "@/components/marketing/marketing-linkedin-head-final-draft-approval";
import { MarketingLinkedInHeadSectionApproval } from "@/components/marketing/marketing-linkedin-head-section-approval";
import { MarketingVideoHeadFinalDraftApproval } from "@/components/marketing/marketing-video-head-final-draft-approval";
import { MarketingVideoHeadSectionApproval } from "@/components/marketing/marketing-video-head-section-approval";
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
  videoSendToPublisher,
  type MarketingActivityLog,
  type MarketingContentItem,
} from "@/services/marketing-service";
import { cn } from "@/lib/utils";
import {
  marketingDialogHero,
  marketingDialogOverlay,
  marketingDialogPanel,
  marketingFeedbackBanner,
} from "@/lib/marketing-ui";
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
  const publisherFinalDraftOnly = publisherSeesFinalDraftOnly(currentItem, publisher);
  const showFinalDraftPreview = hasSectionWorkflowFinalDraft(currentItem);
  const showSourceDraftEditor = canEditSectionSourceDraft(currentItem, perms.userId);
  const showSourcePreview = !publisherFinalDraftOnly && !showSourceDraftEditor;

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
  const videoHeadReview =
    !locked &&
    head &&
    usesVideoSectionWorkflow(currentItem) &&
    hasVideoSectionApproval(currentItem) &&
    !canHeadReviewVideoFinalDraft(currentItem);
  const videoHeadFinalDraftReview = !locked && head && canHeadReviewVideoFinalDraft(currentItem);
  const handlerFinalDraftReview =
    !locked &&
    !head &&
    Boolean(submitterRole) &&
    usesLinkedInSectionWorkflow(currentItem) &&
    (canLinkedInHandlerSubmitFinalDraftToHead(currentItem, perms.userId) ||
      canLinkedInHandlerSendToPublisher(currentItem, perms.userId) ||
      linkedInFinalDraftAwaitingHead(currentItem) ||
      linkedInHandlerAwaitingPublisher(currentItem));
  const videoHandlerFinalDraftReview =
    !locked &&
    !head &&
    Boolean(submitterRole) &&
    usesVideoSectionWorkflow(currentItem) &&
    (canVideoEditorSubmitFinalDraftToHead(currentItem, perms.userId) ||
      canVideoEditorSendToPublisher(currentItem, perms.userId) ||
      videoFinalDraftAwaitingHead(currentItem) ||
      videoEditorAwaitingPublisher(currentItem));

  const showFooterSubmit =
    !showSourceDraftEditor &&
    (currentItem.status === "draft" || currentItem.status === "changes_required") &&
    Boolean(submitterRole);
  const showFooterSendToPublisher =
    (canLinkedInHandlerSendToPublisher(currentItem, perms.userId) && !handlerFinalDraftReview) ||
    (canVideoEditorSendToPublisher(currentItem, perms.userId) && !videoHandlerFinalDraftReview);
  const showFooterGenericPublish =
    publisher &&
    canPublishWorkflow &&
    !hasLinkedInSectionApproval(currentItem) &&
    !hasVideoSectionApproval(currentItem);
  const showDialogFooter =
    !head && !locked && (showFooterSubmit || showFooterSendToPublisher || showFooterGenericPublish || needsPostingReport);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4">
      <button
        type="button"
        className={marketingDialogOverlay}
        aria-label="Close review panel"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={marketingDialogPanel}
      >
        <div className={cn("shrink-0", marketingDialogHero)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background shadow-sm">
                  <FileText className="size-4 text-primary/80" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {currentItem.content_number}
                  </p>
                  <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
                    {currentItem.title}
                  </h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-[52px]">
                <FinanceStatusBadge status={currentItem.status} />
                <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">
                  {formatMarketingStatus(currentItem.content_type)}
                </span>
                {hasLinkedInSectionApproval(currentItem) && linkedInPublishStatusLabel(currentItem) ? (
                  <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    {linkedInPublishStatusLabel(currentItem)}
                  </span>
                ) : null}
                {hasVideoSectionApproval(currentItem) && videoPublishStatusLabel(currentItem) ? (
                  <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    {videoPublishStatusLabel(currentItem)}
                  </span>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 bg-background/80"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/[0.03] p-5">
          <div className="space-y-4">
            {currentItem.rejection_reason ? (
              <div className={marketingFeedbackBanner}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
                  Marketing head feedback
                </p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{currentItem.rejection_reason}</p>
              </div>
            ) : null}

            {showSourceDraftEditor ? (
              <MarketingSectionSourceDraftEditor
                item={currentItem}
                externalBusy={busy}
                onUpdated={(updated) => void refreshDialogItem(updated)}
              />
            ) : showSourcePreview ? (
              <MarketingContentPreviewCard item={currentItem} locked={locked} sourceDraft />
            ) : null}

            {showFinalDraftPreview ? <MarketingSectionFinalDraftPreviews item={currentItem} /> : null}

            {linkedInHeadFinalDraftReview ? (
              <MarketingLinkedInHeadFinalDraftApproval
                item={currentItem}
                onUpdated={(updated) => void refreshDialogItem(updated)}
              />
            ) : videoHeadFinalDraftReview ? (
              <MarketingVideoHeadFinalDraftApproval
                item={currentItem}
                onUpdated={(updated) => void refreshDialogItem(updated)}
              />
            ) : linkedInHeadReview ? (
              <MarketingLinkedInHeadSectionApproval
                item={currentItem}
                onUpdated={() => void refreshDialogItem()}
              />
            ) : videoHeadReview ? (
              <MarketingVideoHeadSectionApproval
                item={currentItem}
                onUpdated={() => void refreshDialogItem()}
              />
            ) : handlerFinalDraftReview ? (
              <MarketingLinkedInFinalDraftPanel
                item={currentItem}
                userId={perms.userId}
                onUpdated={(updated) => void refreshDialogItem(updated)}
              />
            ) : videoHandlerFinalDraftReview ? (
              <MarketingVideoFinalDraftPanel
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
          <div className="shrink-0 border-t border-border/60 bg-muted/10 p-5 pt-4">
            <MarketingHeadApprovalFooter item={currentItem} onUpdated={() => void refreshDialogItem()} />
          </div>
        ) : head ? null : locked ? null : showDialogFooter ? (
          <div className="shrink-0 border-t border-border/60 bg-muted/10 p-5 pt-4">
            <div className="flex flex-wrap gap-2">
              {showFooterSubmit ? (
                <Button type="button" disabled={busy} onClick={() => void run(() => submitContentItem(currentItem.id))}>
                  {currentItem.status === "changes_required" ? "Resubmit for verification" : "Start verification workflow"}
                </Button>
              ) : null}

              {showFooterSendToPublisher ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      usesVideoSectionWorkflow(currentItem)
                        ? videoSendToPublisher(currentItem.id)
                        : linkedInSendToPublisher(currentItem.id),
                    )
                  }
                >
                  Send final draft to publisher
                </Button>
              ) : null}

              {showFooterGenericPublish ? (
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
        ) : null}
      </div>
    </div>
  );
}
