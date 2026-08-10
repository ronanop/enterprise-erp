"use client";

import type { ReactNode } from "react";
import { Archive, Hash, Lock, Palette, Type } from "lucide-react";

import { formatMarketingStatus, type MarketingContentItem } from "@/services/marketing-service";
import { cn } from "@/lib/utils";

type MarketingContentPreviewCardProps = {
  item: MarketingContentItem;
  locked?: boolean;
  className?: string;
};

function PreviewField({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Type;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5 border-b border-border/50 pb-4 last:border-b-0 last:pb-0">
      <h4 className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-3.5 text-muted-foreground" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">{label}</span>
      </h4>
      <div className="pl-8 text-sm font-normal leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground/70">{children}</dt>
  );
}

function HashtagPills({ value }: { value: string }) {
  const tags = value
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tags.length === 0) return <span className="text-foreground">{value}</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
        >
          {tag.startsWith("#") ? tag : `#${tag}`}
        </span>
      ))}
    </div>
  );
}

export function MarketingContentPreviewCard({ item, locked = false, className }: MarketingContentPreviewCardProps) {
  const hasFontInfo = Boolean(item.font_name || item.font_size || item.color_codes);
  const hasContent = Boolean(item.title || item.body || item.hashtags || item.theme || hasFontInfo);

  if (!hasContent) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center", className)}>
        <p className="text-sm text-muted-foreground">No content details to preview.</p>
      </div>
    );
  }

  return (
    <section className={cn("overflow-hidden rounded-xl border border-border/80 bg-card", className)}>
      <div className="border-b border-border/60 bg-muted/20 px-4 py-3.5">
        <h3 className="text-base font-semibold text-foreground">Content preview</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{formatMarketingStatus(item.content_type)}</p>
      </div>

      <div className="space-y-4 p-4">
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

        {item.title ? (
          <PreviewField icon={Type} label="Post title">
            <p className="text-base font-medium text-foreground">{item.title}</p>
          </PreviewField>
        ) : null}

        {item.body ? (
          <PreviewField icon={Type} label="Post text">
            <p className="whitespace-pre-wrap rounded-lg border border-border/50 bg-muted/25 px-3 py-2.5 text-sm text-foreground">
              {item.body}
            </p>
          </PreviewField>
        ) : null}

        {item.hashtags ? (
          <PreviewField icon={Hash} label="Hashtags">
            <HashtagPills value={item.hashtags} />
          </PreviewField>
        ) : null}

        {item.theme ? (
          <PreviewField icon={Palette} label="Theme">
            <p className="whitespace-pre-wrap text-foreground">{item.theme}</p>
          </PreviewField>
        ) : null}

        {hasFontInfo ? (
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
