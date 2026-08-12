"use client";

import type { ReactNode } from "react";
import { Building2, ImageIcon, Palette, Type } from "lucide-react";

import {
  type MarketingContentItem,
  type MarketingLinkedAsset,
} from "@/services/marketing-service";
import { MarketingLinkedAssetMedia } from "@/components/marketing/marketing-enlargeable-media";
import { cn } from "@/lib/utils";

type MarketingLinkedInSectionPreviewProps = {
  item: MarketingContentItem;
  mediaAssets: MarketingLinkedAsset[];
  assetsLoading?: boolean;
  className?: string;
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
    <div className="rounded-lg border border-border/50 bg-background/60 p-3.5 shadow-sm">
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

export function MarketingLinkedInSectionPreview({
  item,
  mediaAssets,
  assetsLoading = false,
  className,
}: MarketingLinkedInSectionPreviewProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {item.summary ? (
        <PreviewField icon={Building2} label="Company" accent="highlight">
          <p className="text-sm font-medium text-foreground">{item.summary}</p>
        </PreviewField>
      ) : null}

      {item.body ? (
        <PreviewField icon={Type} label="Topic" accent="highlight">
          <p className="whitespace-pre-wrap rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-sm text-foreground">
            {item.body}
          </p>
        </PreviewField>
      ) : null}

      {item.theme?.trim() ? (
        <PreviewField icon={Palette} label="Theme" accent="highlight">
          <p className="whitespace-pre-wrap text-foreground">{item.theme}</p>
        </PreviewField>
      ) : null}

      {assetsLoading ? (
        <PreviewField icon={ImageIcon} label="Photo or video">
          <p className="text-sm text-muted-foreground">Loading media…</p>
        </PreviewField>
      ) : mediaAssets.length > 0 ? (
        <PreviewField icon={ImageIcon} label="Photo or video" accent="highlight">
          <div className="flex flex-wrap gap-3">
            {mediaAssets.map((link) => (
              <MarketingLinkedAssetMedia key={link.id} link={link} />
            ))}
          </div>
        </PreviewField>
      ) : null}

      {!item.summary && !item.body && !item.theme?.trim() && !assetsLoading && mediaAssets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
          No post details submitted yet.
        </p>
      ) : null}
    </div>
  );
}
