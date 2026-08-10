"use client";

import { useCallback, useEffect, useState } from "react";

import {
  SectionApprovalStatusBadge,
  SectionHeadRemarks,
} from "@/components/marketing/marketing-section-status-badge";
import { Button } from "@/components/ui/button";
import {
  canHeadApproveLinkedInSection,
  getLinkedInSectionDisplayStatus,
  isLinkedInPriorSectionApproved,
  LINKEDIN_HEAD_SECTIONS,
  linkedInSectionRemarks,
  linkedInSectionWaitingMessage,
  type LinkedInHeadSectionId,
} from "@/lib/linkedin-section-approval";
import { cn } from "@/lib/utils";
import {
  ApiClientError,
  getContentItem,
  linkedInHeadReviewSection,
  listContentAssets,
  marketingAssetUrl,
  type MarketingContentItem,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";

type MarketingLinkedInHeadSectionApprovalProps = {
  item: MarketingContentItem;
  onUpdated: () => void;
  compact?: boolean;
};

export function MarketingLinkedInHeadSectionApproval({
  item: initialItem,
  onUpdated,
  compact = false,
}: MarketingLinkedInHeadSectionApprovalProps) {
  const [item, setItem] = useState(initialItem);
  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const [fresh, linked] = await Promise.all([
        getContentItem(initialItem.id),
        listContentAssets(initialItem.id),
      ]);
      setItem(fresh);
      setAssets(linked);
    } catch {
      setItem(initialItem);
    }
  }, [initialItem]);

  useEffect(() => {
    setItem(initialItem);
    void refresh();
  }, [initialItem, refresh]);

  const mediaAssets = assets.filter((link) =>
    ["linkedin_post_image", "linkedin_post_video", "social_image", "social_video"].includes(
      link.asset_role ?? "",
    ),
  );

  const runSectionReview = async (
    sectionId: LinkedInHeadSectionId,
    status: "approved" | "changes_requested" | "rejected",
  ) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await linkedInHeadReviewSection(item.id, {
        section: sectionId,
        status,
        comments: comments[sectionId] || undefined,
      });
      setItem(updated);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Approval action failed");
    } finally {
      setBusy(false);
    }
  };

  const sections = item.linkedin_head_sections;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        LinkedIn section approval — approve in order: Content → Theme → Fonts
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {LINKEDIN_HEAD_SECTIONS.map((section) => {
        const sectionId = section.id;
        const displayStatus = getLinkedInSectionDisplayStatus(sections, sectionId, item);
        const canApprove = canHeadApproveLinkedInSection(sections, sectionId, item);
        const waitingMessage = linkedInSectionWaitingMessage(sections, sectionId, item);
        const sectionLocked = !isLinkedInPriorSectionApproved(sections, sectionId);
        const remarks = linkedInSectionRemarks(sections, sectionId);

        return (
          <section
            key={section.id}
            className={cn(
              "space-y-3 rounded-xl border border-border/80 bg-card p-4",
              sectionLocked && "opacity-75",
              compact && "p-3",
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
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
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
                {mediaAssets.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {mediaAssets.map((link) => {
                      const url = marketingAssetUrl(link.asset.file_url);
                      const isVideo =
                        link.asset.asset_kind === "video" || link.asset.mime_type?.startsWith("video/");
                      return isVideo ? (
                        <video key={link.id} src={url} controls className="max-h-36 rounded border" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={link.id} src={url} alt={link.asset.name} className="max-h-36 rounded border object-contain" />
                      );
                    })}
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
                <dl className="grid gap-2 sm:grid-cols-3">
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
                    onClick={() => void runSectionReview(sectionId, "approved")}
                  >
                    Approve {section.label}
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
