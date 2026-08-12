"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";

import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { MarketingContentPreviewCard } from "@/components/marketing/marketing-content-preview-card";
import { MarketingSectionFinalDraftPreviews } from "@/components/marketing/marketing-section-final-draft-previews";
import { hasSectionWorkflowFinalDraft } from "@/lib/marketing-section-preview";
import { MarketingLinkedInHeadFinalDraftApproval } from "@/components/marketing/marketing-linkedin-head-final-draft-approval";
import { MarketingVideoHeadFinalDraftApproval } from "@/components/marketing/marketing-video-head-final-draft-approval";
import { MarketingVideoHeadSectionApproval } from "@/components/marketing/marketing-video-head-section-approval";
import { MarketingLinkedInSectionPreview } from "@/components/marketing/marketing-linkedin-section-preview";
import { MarketingReviewSectionHeader } from "@/components/marketing/marketing-review-section-header";
import {
  SectionApprovalStatusBadge,
  SectionHeadRemarks,
} from "@/components/marketing/marketing-section-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";
import {
  canHeadReviewLinkedInFinalDraft,
  canHeadApproveLinkedInSection,
  getLinkedInSectionDisplayStatus,
  isLinkedInPriorSectionApproved,
  LINKEDIN_HEAD_SECTIONS,
  linkedInSectionRemarks,
  linkedInSectionWaitingMessage,
  usesLinkedInSectionWorkflow,
  type LinkedInHeadSectionId,
} from "@/lib/linkedin-section-approval";
import {
  canHeadReviewVideoFinalDraft,
  usesVideoSectionWorkflow,
} from "@/lib/video-section-approval";
import {
  HEAD_REVIEW_SECTIONS,
  getHeadReviewTargets,
  headSectionDisplayStatus,
  headSectionWaitingMessage,
  isMarketingHead,
  isPriorSectionApproved,
  LINKEDIN_CONTENT_MEDIA_ROLES,
  VIDEO_CONTENT_MEDIA_ROLES,
  resolveHeadReviewSectionState,
  type HeadReviewSectionId,
  VERIFIER_ROLE_LABELS,
} from "@/lib/marketing-verification";
import { BANNER_VERIFICATION_ITEM_KEY } from "@/lib/marketing-content-upload";
import { marketingCard, marketingPage } from "@/lib/marketing-ui";
import { cn } from "@/lib/utils";
import {
  ApiClientError,
  formatMarketingStatus as formatStatus,
  getContentItem,
  getContentWorkflow,
  headReviewVerificationItem,
  linkedInHeadReviewSection,
  listContentAssets,
  type MarketingContentItem,
  type MarketingContentWorkflow,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";

const POLL_MS = 10_000;

const SECTION_HINTS: Record<string, string> = {
  post: "Review topic, company, theme, and photo or video",
};

function isSectionWorkflowMediaAsset(link: MarketingLinkedAsset): boolean {
  const role = link.asset_role ?? "";
  if (
    LINKEDIN_CONTENT_MEDIA_ROLES.includes(role as (typeof LINKEDIN_CONTENT_MEDIA_ROLES)[number]) ||
    VIDEO_CONTENT_MEDIA_ROLES.includes(role as (typeof VIDEO_CONTENT_MEDIA_ROLES)[number]) ||
    role === BANNER_VERIFICATION_ITEM_KEY
  ) {
    return true;
  }
  return link.asset.asset_kind === "image" || link.asset.asset_kind === "video";
}

type MarketingHeadReviewPageProps = {
  contentId: string;
};

export function MarketingHeadReviewPage({ contentId }: MarketingHeadReviewPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const perms = useMarketingPermissions();
  const head = isMarketingHead(perms);
  const preferredRole = searchParams.get("role");

  const [item, setItem] = useState<MarketingContentItem | null>(null);
  const [workflow, setWorkflow] = useState<MarketingContentWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [mediaAssets, setMediaAssets] = useState<MarketingLinkedAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [content, wf] = await Promise.all([getContentItem(contentId), getContentWorkflow(contentId)]);
      setItem(content);
      setWorkflow(wf);
    } catch (err) {
      setItem(null);
      setWorkflow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load post for review");
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    if (perms.loading) return;
    if (!head) {
      router.replace("/marketing/approvals");
      return;
    }
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [head, load, perms.loading, router]);

  useEffect(() => {
    if (!item || (item.content_type !== "social_post" && item.content_type !== "video")) {
      setMediaAssets([]);
      setAssetsLoading(false);
      return;
    }
    let cancelled = false;
    setAssetsLoading(true);
    void listContentAssets(item.id)
      .then((rows) => {
        if (!cancelled) setMediaAssets(rows.filter(isSectionWorkflowMediaAsset));
      })
      .catch(() => {
        if (!cancelled) setMediaAssets([]);
      })
      .finally(() => {
        if (!cancelled) setAssetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.content_type]);

  const runSectionReview = async (
    sectionId: HeadReviewSectionId,
    sectionItems: Array<{ verifier_role: string; item_key: string; status: string }>,
    status: "approved" | "changes_requested" | "rejected",
  ) => {
    if (sectionItems.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const entry of sectionItems) {
        await headReviewVerificationItem(contentId, {
          verifier_role: entry.verifier_role,
          item_key: entry.item_key,
          status,
          comments: comments[sectionId] || undefined,
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Approval action failed");
    } finally {
      setBusy(false);
    }
  };

  const runLinkedInSectionReview = async (
    sectionId: LinkedInHeadSectionId,
    status: "approved" | "changes_requested" | "rejected",
  ) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await linkedInHeadReviewSection(contentId, {
        section: "post",
        status,
        comments: comments[sectionId] || comments.post || undefined,
      });
      setItem(updated);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Approval action failed");
    } finally {
      setBusy(false);
    }
  };

  if (!head || perms.loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (loading && !item) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading post for review…</div>;
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error ?? "Post not found."}</p>
        <Link href="/marketing/approvals" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Back to approvals
        </Link>
      </div>
    );
  }

  const linkedInMode = usesLinkedInSectionWorkflow(item);
  const videoMode = usesVideoSectionWorkflow(item);
  const sectionWorkflowMode = linkedInMode || videoMode;
  if (!sectionWorkflowMode && !workflow) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error ?? "Post not found."}</p>
        <Link href="/marketing/approvals" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Back to approvals
        </Link>
      </div>
    );
  }

  const submitterLabel = preferredRole
    ? VERIFIER_ROLE_LABELS[preferredRole] ?? formatStatus(preferredRole)
    : linkedInMode
      ? VERIFIER_ROLE_LABELS.linkedin_handler
      : videoMode
        ? VERIFIER_ROLE_LABELS.video_editor
        : workflow?.verifications.find((v) => v.items.some((i) => i.status === "submitted"))?.verifier_role;

  const reviewSections = linkedInMode ? LINKEDIN_HEAD_SECTIONS : HEAD_REVIEW_SECTIONS;
  const showLinkedInFinalDraft = canHeadReviewLinkedInFinalDraft(item);
  const showVideoFinalDraft = canHeadReviewVideoFinalDraft(item);
  const showFinalDraft = showLinkedInFinalDraft || showVideoFinalDraft;

  return (
    <div className={marketingPage}>
      <div className={cn(marketingCard, "overflow-hidden")}>
        <div className="border-b border-border/60 bg-gradient-to-br from-muted/50 via-background to-background px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background shadow-sm">
                  <FileText className="size-4 text-primary/80" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {item.content_number}
                  </p>
                  <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground">{item.title}</h1>
                  {submitterLabel ? (
                    <p className="text-xs text-muted-foreground">
                      Submitted by {VERIFIER_ROLE_LABELS[submitterLabel] ?? formatStatus(submitterLabel)}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-[52px]">
                <FinanceStatusBadge status={item.status} />
                <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm">
                  {formatStatus(item.content_type)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/marketing/approvals" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-background/80")}>
                <ArrowLeft className="size-3.5" />
                Back to approvals
              </Link>
              <Button type="button" variant="outline" size="sm" className="bg-background/80" onClick={() => void load()} disabled={busy}>
                <RefreshCw className={cn("size-3.5", busy && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {!sectionWorkflowMode || showFinalDraft ? (
        <MarketingContentPreviewCard item={item} sourceDraft />
      ) : null}

      {showFinalDraft ? <MarketingSectionFinalDraftPreviews item={item} /> : null}

      {showLinkedInFinalDraft ? (
        <MarketingLinkedInHeadFinalDraftApproval item={item} onUpdated={() => void load()} />
      ) : null}
      {showVideoFinalDraft ? (
        <MarketingVideoHeadFinalDraftApproval item={item} onUpdated={() => void load()} />
      ) : null}

      {!showFinalDraft && videoMode ? (
        <MarketingVideoHeadSectionApproval item={item} onUpdated={() => void load()} />
      ) : null}

      {!showFinalDraft && !videoMode ? (
        <section className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
            <MarketingReviewSectionHeader
              tone="workflow"
              title="Approval sections"
              description="Review the LinkedIn post draft and approve once"
            />
          </div>

          {reviewSections.map((section) => {
            const sectionId = section.id as HeadReviewSectionId & LinkedInHeadSectionId;
            const sections = item.linkedin_head_sections;
            const displayStatus = linkedInMode
              ? getLinkedInSectionDisplayStatus(sections, sectionId, item)
              : headSectionDisplayStatus(workflow!.verifications, sectionId, preferredRole, item);
            const canApprove = linkedInMode
              ? canHeadApproveLinkedInSection(sections, sectionId, item)
              : getHeadReviewTargets(workflow!.verifications, sectionId, preferredRole, item).length > 0;
            const waitingMessage = linkedInMode
              ? linkedInSectionWaitingMessage(sections, sectionId, item)
              : headSectionWaitingMessage(workflow!.verifications, sectionId, preferredRole, item);
            const sectionLocked = linkedInMode
              ? !isLinkedInPriorSectionApproved(sections, sectionId)
              : !isPriorSectionApproved(workflow!.verifications, sectionId, preferredRole);
            const remarks = linkedInMode
              ? linkedInSectionRemarks(sections, sectionId)
              : resolveHeadReviewSectionState(workflow!.verifications, sectionId, preferredRole).remarks;
            const reviewTargets = linkedInMode
              ? []
              : getHeadReviewTargets(workflow!.verifications, sectionId, preferredRole, item);

            return (
              <section
                key={section.id}
                id={`review-${section.id}`}
                className={cn(
                  "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
                  sectionLocked && "opacity-80",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-primary/[0.04] to-transparent px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight text-foreground">{section.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {SECTION_HINTS[section.id] ?? "Review and approve this section"}
                    </p>
                  </div>
                  <SectionApprovalStatusBadge status={displayStatus} />
                </div>

                <div className="space-y-3 p-4">
                  {linkedInMode ? (
                    <MarketingLinkedInSectionPreview
                      item={item}
                      mediaAssets={mediaAssets}
                      assetsLoading={assetsLoading}
                    />
                  ) : null}

                  <SectionHeadRemarks remarks={remarks} status={displayStatus} />

                  {waitingMessage && !canApprove ? (
                    <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      {waitingMessage}
                    </p>
                  ) : null}

                  {displayStatus === "approved" ? (
                    <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-800">
                      You approved this section
                    </p>
                  ) : null}

                  {canApprove ? (
                    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-4">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">
                        Feedback to sender
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Optional for approve. Required when sending back or rejecting."
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                        value={comments[section.id] ?? ""}
                        onChange={(e) =>
                          setComments((prev) => ({
                            ...prev,
                            [section.id]: e.target.value,
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void (linkedInMode
                              ? runLinkedInSectionReview(sectionId, "approved")
                              : runSectionReview(sectionId, reviewTargets, "approved"))
                          }
                        >
                          Approve {section.label}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="bg-background"
                          disabled={busy}
                          onClick={() =>
                            void (linkedInMode
                              ? runLinkedInSectionReview(sectionId, "changes_requested")
                              : runSectionReview(sectionId, reviewTargets, "changes_requested"))
                          }
                        >
                          Send feedback
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() =>
                            void (linkedInMode
                              ? runLinkedInSectionReview(sectionId, "rejected")
                              : runSectionReview(sectionId, reviewTargets, "rejected"))
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
