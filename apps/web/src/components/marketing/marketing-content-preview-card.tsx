"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Archive, Building2, ImageIcon, Lock, Palette, Sparkles, Type } from "lucide-react";

import { MarketingReviewSectionHeader } from "@/components/marketing/marketing-review-section-header";
import { MarketingLinkedAssetMedia } from "@/components/marketing/marketing-enlargeable-media";
import { BANNER_VERIFICATION_ITEM_KEY } from "@/lib/marketing-content-upload";
import {
  filterSourcePreviewMedia,
  usesSectionContentWorkflow,
} from "@/lib/marketing-section-preview";
import { LINKEDIN_CONTENT_MEDIA_ROLES } from "@/lib/marketing-verification";
import {
  formatMarketingStatus,
  listContentAssets,
  type MarketingContentItem,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";
import { cn } from "@/lib/utils";
import { marketingCard, marketingFieldShell } from "@/lib/marketing-ui";

type MarketingContentPreviewCardProps = {
  item: MarketingContentItem;
  locked?: boolean;
  className?: string;
  /** When true, label as source draft and exclude final-render media. */
  sourceDraft?: boolean;
};

function PreviewField({
  icon: Icon,
  label,
  children,
  accent = "default",
}: {
  icon: typeof Type;
  label: string;
  children: ReactNode;
  accent?: "default" | "highlight";
}) {
  return (
    <div className={marketingFieldShell}>
      <h4 className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border",
            accent === "highlight"
              ? "border-primary/20 bg-primary/5"
              : "border-border/60 bg-muted/40",
          )}
        >
          <Icon className={cn("size-3.5", accent === "highlight" ? "text-primary" : "text-muted-foreground")} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">{label}</span>
      </h4>
      <div className="text-sm font-normal leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground/70">{children}</dt>
  );
}

function isMediaAsset(link: MarketingLinkedAsset): boolean {
  const role = link.asset_role ?? "";
  if (
    LINKEDIN_CONTENT_MEDIA_ROLES.includes(role as (typeof LINKEDIN_CONTENT_MEDIA_ROLES)[number]) ||
    role === BANNER_VERIFICATION_ITEM_KEY
  ) {
    return true;
  }
  return link.asset.asset_kind === "image" || link.asset.asset_kind === "video";
}

export function MarketingContentPreviewCard({
  item,
  locked = false,
  className,
  sourceDraft = false,
}: MarketingContentPreviewCardProps) {
  const [assets, setAssets] = useState<MarketingLinkedAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setAssetsLoading(true);
    void listContentAssets(item.id)
      .then((rows) => {
        if (!cancelled) setAssets(rows);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      })
      .finally(() => {
        if (!cancelled) setAssetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const isSectionWorkflowPreview = usesSectionContentWorkflow(item);
  const showAsSourceDraft = sourceDraft || isSectionWorkflowPreview;
  const mediaAssets = showAsSourceDraft
    ? filterSourcePreviewMedia(assets, item)
    : assets.filter(isMediaAsset);
  const hasFontInfo = Boolean(item.font_name || item.font_size || item.color_codes);
  const hasContent = Boolean(
    isSectionWorkflowPreview
      ? item.body || item.summary || item.theme || mediaAssets.length > 0
      : item.title || item.body || item.summary || item.hashtags || item.theme || hasFontInfo || mediaAssets.length > 0,
  );

  if (!hasContent && !assetsLoading) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center", className)}>
        <p className="text-sm text-muted-foreground">No content details to preview.</p>
      </div>
    );
  }

  return (
    <section className={cn(marketingCard, className)}>
      <MarketingReviewSectionHeader
        tone="preview"
        icon={Sparkles}
        title={showAsSourceDraft ? "Source draft" : "Content preview"}
        description={
          showAsSourceDraft
            ? "Topic, company, theme, and source media from the handler or editor"
            : formatMarketingStatus(item.content_type)
        }
      />

      <div className="space-y-3 p-4">
        {locked ? (
          <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background">
              <Lock className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-foreground">Published &amp; archived</h4>
              <p className="mt-1 text-xs font-normal leading-relaxed text-muted-foreground">
                This post is locked and stored in the archive. It cannot be edited by anyone.
              </p>
              {item.published_at || item.archived_at ? (
                <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {item.published_at ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Archive className="size-3.5 shrink-0" />
                      <span>
                        <span className="font-semibold text-foreground/80">Published</span>{" "}
                        {new Date(item.published_at).toLocaleString()}
                      </span>
                    </span>
                  ) : null}
                  {item.archived_at ? (
                    <span>
                      <span className="font-semibold text-foreground/80">Archived</span>{" "}
                      {new Date(item.archived_at).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {item.summary ? (
          <PreviewField icon={Building2} label="Company" accent="highlight">
            <p className="text-sm font-medium text-foreground">{item.summary}</p>
          </PreviewField>
        ) : null}

        {!isSectionWorkflowPreview && item.title ? (
          <PreviewField icon={Type} label="Post title">
            <p className="text-base font-medium text-foreground">{item.title}</p>
          </PreviewField>
        ) : null}

        {item.body ? (
          <PreviewField icon={Type} label={isSectionWorkflowPreview ? "Topic" : "Post text"} accent="highlight">
            <p className="whitespace-pre-wrap rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-sm text-foreground">
              {item.body}
            </p>
          </PreviewField>
        ) : null}

        {!isSectionWorkflowPreview && item.hashtags ? (
          <PreviewField icon={Type} label="Hashtags">
            <p className="text-foreground">{item.hashtags}</p>
          </PreviewField>
        ) : null}

        {item.theme ? (
          <PreviewField icon={Palette} label="Theme">
            <p className="whitespace-pre-wrap text-foreground">{item.theme}</p>
          </PreviewField>
        ) : null}

        {assetsLoading ? (
          <PreviewField icon={ImageIcon} label="Photo or video">
            <p className="text-sm text-muted-foreground">Loading media…</p>
          </PreviewField>
        ) : mediaAssets.length > 0 ? (
          <PreviewField
            icon={ImageIcon}
            label={showAsSourceDraft ? "Source photo or video" : "Photo or video"}
            accent="highlight"
          >
            <div className="flex flex-wrap gap-3">
              {mediaAssets.map((link) => (
                <MarketingLinkedAssetMedia key={link.id} link={link} />
              ))}
            </div>
          </PreviewField>
        ) : null}

        {!isSectionWorkflowPreview && hasFontInfo ? (
          <PreviewField icon={Type} label="Font styling">
            <dl className="grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-3">
              <div>
                <SubLabel>Font family</SubLabel>
                <dd className="mt-1 text-sm font-medium text-foreground">{item.font_name || "—"}</dd>
              </div>
              <div>
                <SubLabel>Font size</SubLabel>
                <dd className="mt-1 text-sm font-medium text-foreground">{item.font_size || "—"}</dd>
              </div>
              <div>
                <SubLabel>Color codes</SubLabel>
                <dd className="mt-1 text-sm font-medium text-foreground">{item.color_codes || "—"}</dd>
              </div>
            </dl>
          </PreviewField>
        ) : null}
      </div>
    </section>
  );
}
