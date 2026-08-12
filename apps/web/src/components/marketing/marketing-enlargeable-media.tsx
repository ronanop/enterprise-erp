"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { marketingAssetUrl, type MarketingLinkedAsset } from "@/services/marketing-service";
import { cn } from "@/lib/utils";

export type MarketingEnlargeableMediaProps = {
  src: string;
  alt?: string;
  isVideo?: boolean;
  className?: string;
  mediaClassName?: string;
  caption?: string | null;
  showCaption?: boolean;
  showVideoControls?: boolean;
  enlargeable?: boolean;
};

function isVideoMedia(isVideo: boolean | undefined, src: string): boolean {
  if (isVideo !== undefined) return isVideo;
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(src);
}

export function MarketingEnlargeableMedia({
  src,
  alt = "Media preview",
  isVideo,
  className,
  mediaClassName,
  caption,
  showCaption = true,
  showVideoControls = true,
  enlargeable = true,
}: MarketingEnlargeableMediaProps) {
  const video = isVideoMedia(isVideo, src);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openLightbox = useCallback((event?: MouseEvent) => {
    event?.stopPropagation();
    if (!enlargeable) return;
    setOpen(true);
  }, [enlargeable]);

  const closeLightbox = useCallback((event?: MouseEvent) => {
    event?.stopPropagation();
    setOpen(false);
  }, []);

  return (
    <>
      <div
        className={cn(
          "group relative overflow-hidden rounded-lg border border-border/60 bg-muted/20 shadow-sm",
          className,
        )}
      >
        {video ? (
          <video
            src={src}
            controls={showVideoControls}
            className={cn("w-full bg-black", mediaClassName)}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            className={cn(enlargeable ? "cursor-zoom-in" : "", "w-full object-contain", mediaClassName)}
            onClick={openLightbox}
          />
        )}

        {enlargeable ? (
          <button
            type="button"
            onClick={openLightbox}
            className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-md border border-border/60 bg-background/90 text-foreground shadow-sm opacity-100 transition-opacity hover:bg-background sm:opacity-0 sm:group-hover:opacity-100"
            aria-label="Enlarge"
            title="Enlarge"
          >
            <Maximize2 className="size-4" />
          </button>
        ) : null}

        {showCaption && caption ? (
          <p className="truncate border-t border-border/50 px-2 py-1 text-[11px] text-muted-foreground">{caption}</p>
        ) : null}
      </div>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
              role="dialog"
              aria-modal="true"
              aria-label={video ? "Video preview" : "Image preview"}
              onClick={closeLightbox}
            >
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" aria-hidden />

              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-4 top-4 z-[2] size-9 rounded-full shadow-lg"
                onClick={closeLightbox}
                aria-label="Close preview"
              >
                <X className="size-4" />
              </Button>

              <div
                className="relative z-[1] flex max-h-[90vh] max-w-[min(96vw,1200px)] flex-col items-center"
                onClick={(event) => event.stopPropagation()}
              >
                {video ? (
                  <video
                    src={src}
                    controls
                    autoPlay
                    className="max-h-[85vh] max-w-full rounded-lg bg-black shadow-2xl"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={alt}
                    className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
                  />
                )}
                {caption ? (
                  <p className="mt-3 max-w-full truncate px-2 text-center text-sm text-white/80">{caption}</p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

type MarketingLinkedAssetMediaProps = {
  link: MarketingLinkedAsset;
  className?: string;
  mediaClassName?: string;
  showCaption?: boolean;
};

export function MarketingLinkedAssetMedia({
  link,
  className,
  mediaClassName = "max-h-56 min-w-[200px] max-w-sm",
  showCaption = true,
}: MarketingLinkedAssetMediaProps) {
  const url = marketingAssetUrl(link.asset.file_url);
  const isVideo = link.asset.asset_kind === "video" || link.asset.mime_type?.startsWith("video/");

  return (
    <MarketingEnlargeableMedia
      src={url}
      alt={link.asset.name || "Post media"}
      isVideo={isVideo}
      caption={link.asset.name}
      showCaption={showCaption}
      className={className}
      mediaClassName={cn("max-h-56 min-w-[200px] max-w-sm", mediaClassName)}
    />
  );
}
