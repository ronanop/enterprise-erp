"use client";

import { useCallback, useEffect, useState } from "react";

import { MarketingVideoSectionPreview } from "@/components/marketing/marketing-video-section-preview";
import {
  SectionApprovalStatusBadge,
  SectionHeadRemarks,
} from "@/components/marketing/marketing-section-status-badge";
import { Button } from "@/components/ui/button";
import {
  canHeadApproveVideoSection,
  getVideoSectionDisplayStatus,
  VIDEO_HEAD_SECTIONS,
  videoSectionRemarks,
  videoSectionWaitingMessage,
  type VideoHeadSectionId,
} from "@/lib/video-section-approval";
import { VIDEO_CONTENT_MEDIA_ROLES } from "@/lib/marketing-verification";
import { cn } from "@/lib/utils";
import {
  ApiClientError,
  getContentItem,
  listContentAssets,
  videoHeadReviewSection,
  type MarketingContentItem,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";

type MarketingVideoHeadSectionApprovalProps = {
  item: MarketingContentItem;
  onUpdated: () => void;
  compact?: boolean;
};

export function MarketingVideoHeadSectionApproval({
  item: initialItem,
  onUpdated,
  compact = false,
}: MarketingVideoHeadSectionApprovalProps) {
  const [item, setItem] = useState(initialItem);
  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const [fresh, linked] = await Promise.all([
        getContentItem(initialItem.id),
        listContentAssets(initialItem.id),
      ]);
      setItem(fresh);
      setAssets(
        linked.filter(
          (link) =>
            VIDEO_CONTENT_MEDIA_ROLES.includes(
              (link.asset_role ?? "") as (typeof VIDEO_CONTENT_MEDIA_ROLES)[number],
            ) ||
            link.asset.asset_kind === "image" ||
            link.asset.asset_kind === "video",
        ),
      );
    } catch {
      setItem(initialItem);
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [initialItem]);

  useEffect(() => {
    setItem(initialItem);
    void refresh();
  }, [initialItem, refresh]);

  const runSectionReview = async (
    sectionId: VideoHeadSectionId,
    status: "approved" | "changes_requested" | "rejected",
  ) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await videoHeadReviewSection(item.id, {
        section: "post",
        status,
        comments: comments[sectionId] || comments.post || undefined,
      });
      setItem(updated);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Approval action failed");
    } finally {
      setBusy(false);
    }
  };

  const sections = item.video_head_sections;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Video content approval</p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {VIDEO_HEAD_SECTIONS.map((section) => {
        const sectionId = section.id;
        const displayStatus = getVideoSectionDisplayStatus(sections, sectionId, item);
        const canApprove = canHeadApproveVideoSection(sections, sectionId, item);
        const waitingMessage = videoSectionWaitingMessage(sections, sectionId, item);
        const remarks = videoSectionRemarks(sections, sectionId);

        return (
          <section
            key={section.id}
            className={cn("space-y-3 rounded-xl border border-border/80 bg-card p-4", compact && "p-3")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{section.label}</p>
              <SectionApprovalStatusBadge status={displayStatus} />
            </div>

            <MarketingVideoSectionPreview item={item} mediaAssets={assets} assetsLoading={assetsLoading} />

            <SectionHeadRemarks remarks={remarks} status={displayStatus} />

            {waitingMessage && !canApprove ? (
              <p className="text-xs text-muted-foreground">{waitingMessage}</p>
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
                  <Button type="button" size="sm" disabled={busy} onClick={() => void runSectionReview(sectionId, "approved")}>
                    Approve video
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void runSectionReview(sectionId, "changes_requested")}
                  >
                    Send feedback
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => void runSectionReview(sectionId, "rejected")}
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
  );
}
