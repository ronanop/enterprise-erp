"use client";



import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";

import { ArrowLeft, RefreshCw } from "lucide-react";



import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";

import { PageHeader } from "@/components/layout/page-header";

import {

  SectionApprovalStatusBadge,

  SectionHeadRemarks,

} from "@/components/marketing/marketing-section-status-badge";

import { Button, buttonVariants } from "@/components/ui/button";

import { useMarketingPermissions } from "@/hooks/use-marketing-permissions";

import {
  HEAD_REVIEW_SECTIONS,
  getHeadReviewTargets,
  headSectionDisplayStatus,
  headSectionWaitingMessage,
  isMarketingHead,
  isPriorSectionApproved,
  LINKEDIN_CONTENT_MEDIA_ROLES,
  resolveHeadReviewSectionState,
  type HeadReviewSectionId,
  VERIFIER_ROLE_LABELS,
} from "@/lib/marketing-verification";
import {
  canHeadApproveLinkedInSection,
  getLinkedInSectionDisplayStatus,
  isLinkedInPriorSectionApproved,
  LINKEDIN_HEAD_SECTIONS,
  linkedInSectionRemarks,
  linkedInSectionWaitingMessage,
  usesLinkedInSectionWorkflow,
  canHeadReviewLinkedInFinalDraft,
  type LinkedInHeadSectionId,
} from "@/lib/linkedin-section-approval";
import { MarketingLinkedInHeadFinalDraftApproval } from "@/components/marketing/marketing-linkedin-head-final-draft-approval";
import { cn } from "@/lib/utils";

import {

  ApiClientError,

  formatMarketingStatus as formatStatus,

  getContentItem,

  getContentWorkflow,

  headReviewVerificationItem,

  linkedInHeadReviewSection,

  listContentAssets,

  marketingAssetUrl,

  type MarketingContentItem,

  type MarketingContentWorkflow,

  type MarketingLinkedAsset,

} from "@/services/marketing-service";



const POLL_MS = 10_000;



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

  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<Record<string, string>>({});



  const load = useCallback(async () => {

    setError(null);

    try {

      const [content, wf, linked] = await Promise.all([

        getContentItem(contentId),

        getContentWorkflow(contentId),

        listContentAssets(contentId),

      ]);

      setItem(content);

      setWorkflow(wf);

      setAssets(linked);

    } catch (err) {

      setItem(null);

      setWorkflow(null);

      setAssets([]);

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



  const mediaAssets = assets.filter(

    (a) => a.asset_role && LINKEDIN_CONTENT_MEDIA_ROLES.includes(a.asset_role as (typeof LINKEDIN_CONTENT_MEDIA_ROLES)[number]),

  );



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
        section: sectionId,
        status,
        comments: comments[sectionId] || undefined,
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

  if (!linkedInMode && !workflow) {

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

      : workflow?.verifications.find((v) => v.items.some((i) => i.status === "submitted"))?.verifier_role;

  const reviewSections = linkedInMode ? LINKEDIN_HEAD_SECTIONS : HEAD_REVIEW_SECTIONS;



  return (

    <div className="space-y-6">

      <PageHeader

        title={item.title}

        description={`${item.content_number}${submitterLabel ? ` · ${VERIFIER_ROLE_LABELS[submitterLabel] ?? formatStatus(submitterLabel)}` : ""}`}

        actions={

          <div className="flex flex-wrap gap-2">

            <Link href="/marketing/approvals" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                <ArrowLeft className="size-3.5" />
                Back to approvals
              </Link>

            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={busy}>

              <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />

              Refresh

            </Button>

          </div>

        }

      />



      <div className="flex flex-wrap items-center gap-2">

        <FinanceStatusBadge status={item.status} />

        <span className="text-xs text-muted-foreground">{formatStatus(item.content_type)}</span>

      </div>



      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {canHeadReviewLinkedInFinalDraft(item) ? (
        <MarketingLinkedInHeadFinalDraftApproval item={item} onUpdated={() => void load()} />
      ) : null}

      {!canHeadReviewLinkedInFinalDraft(item) ? (
      <div className="space-y-4">

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
                "space-y-3 rounded-xl border border-border/80 bg-card p-4",
                sectionLocked && "opacity-75",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{section.label}</p>
                <SectionApprovalStatusBadge status={displayStatus} />
              </div>

              <SectionHeadRemarks remarks={remarks} status={displayStatus} />

              {waitingMessage && !canApprove ? (
                <p className="text-xs text-muted-foreground">{waitingMessage}</p>
              ) : null}

              {section.id === "content" ? (

                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">

                  {item.title ? (

                    <div>

                      <p className="text-xs font-medium uppercase text-muted-foreground">Post title</p>

                      <p className="mt-1">{item.title}</p>

                    </div>

                  ) : null}

                  {item.body ? (

                    <div>

                      <p className="text-xs font-medium uppercase text-muted-foreground">LinkedIn post copy</p>

                      <p className="mt-1 whitespace-pre-wrap">{item.body}</p>

                    </div>

                  ) : null}

                  {item.hashtags ? (

                    <div>

                      <p className="text-xs font-medium uppercase text-muted-foreground">Hashtags</p>

                      <p className="mt-1">{item.hashtags}</p>

                    </div>

                  ) : null}

                  {mediaAssets.length > 0 ? (

                    <div>

                      <p className="text-xs font-medium uppercase text-muted-foreground">Post image / video</p>

                      <div className="mt-2 flex flex-wrap gap-2">

                        {mediaAssets.map((link) => {

                          const url = marketingAssetUrl(link.asset.file_url);

                          const isVideo =

                            link.asset.asset_kind === "video" || link.asset.mime_type?.startsWith("video/");

                          return (

                            <div key={link.id} className="max-w-xs overflow-hidden rounded border border-border/70">

                              {isVideo ? (

                                <video src={url} controls className="max-h-48 w-full bg-black" />

                              ) : (

                                // eslint-disable-next-line @next/next/no-img-element

                                <img src={url} alt={link.asset.name} className="max-h-48 w-full object-contain" />

                              )}

                            </div>

                          );

                        })}

                      </div>

                    </div>

                  ) : null}

                </div>

              ) : null}



              {section.id === "theme" ? (

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">

                  <p className="text-xs font-medium uppercase text-muted-foreground">Visual theme</p>

                  <p className="mt-1 whitespace-pre-wrap">{item.theme?.trim() || "—"}</p>

                </div>

              ) : null}



              {section.id === "fonts" ? (

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">

                  <dl className="grid gap-3 sm:grid-cols-3">

                    <div>

                      <dt className="text-xs font-medium uppercase text-muted-foreground">Font family</dt>

                      <dd className="mt-1">{item.font_name?.trim() || "—"}</dd>

                    </div>

                    <div>

                      <dt className="text-xs font-medium uppercase text-muted-foreground">Font size</dt>

                      <dd className="mt-1">{item.font_size?.trim() || "—"}</dd>

                    </div>

                    <div>

                      <dt className="text-xs font-medium uppercase text-muted-foreground">Color codes</dt>

                      <dd className="mt-1">{item.color_codes?.trim() || "—"}</dd>

                    </div>

                  </dl>

                </div>

              ) : null}



              {canApprove ? (
                <div className="space-y-2 border-t border-border/60 pt-3">

                  <textarea

                    rows={2}

                    placeholder="Feedback to sender (for send back or reject)…"

                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

                    value={comments[section.id] ?? ""}

                    onChange={(e) =>

                      setComments((prev) => ({

                        ...prev,

                        [section.id]: e.target.value,

                      }))

                    }

                  />

                  <div className="flex flex-wrap gap-2">

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

            </section>

          );

        })}

      </div>
      ) : null}

    </div>

  );

}


