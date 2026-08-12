"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Building2, ImageIcon, Palette, PenLine, type LucideIcon } from "lucide-react";

import { MarketingBannerUploadField } from "@/components/marketing/marketing-banner-upload-field";
import { MarketingReviewSectionHeader } from "@/components/marketing/marketing-review-section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadContentAssetForItem } from "@/lib/marketing-content-upload";
import { filterSourcePreviewMedia } from "@/lib/marketing-section-preview";
import { usesLinkedInSectionWorkflow } from "@/lib/linkedin-section-approval";
import { cn } from "@/lib/utils";
import { marketingCard, marketingFieldShell } from "@/lib/marketing-ui";
import {
  ApiClientError,
  listContentAssets,
  marketingAssetUrl,
  submitContentItem,
  updateContentItem,
  type MarketingContentItem,
} from "@/services/marketing-service";

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

function titleFromTopic(topic: string): string {
  const trimmed = topic.trim();
  const firstLine = trimmed.split(/\r?\n/)[0] ?? trimmed;
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function DraftFormField({
  icon: Icon,
  label,
  required = false,
  highlight = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  required?: boolean;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={marketingFieldShell}>
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md border",
            highlight ? "border-primary/20 bg-primary/5" : "border-border/60 bg-muted/40",
          )}
        >
          <Icon className={cn("size-3.5", highlight ? "text-primary" : "text-muted-foreground")} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </span>
      </div>
      {children}
    </div>
  );
}

type MarketingSectionSourceDraftEditorProps = {
  item: MarketingContentItem;
  onUpdated: (item?: MarketingContentItem) => void;
  externalBusy?: boolean;
};

export function MarketingSectionSourceDraftEditor({
  item,
  onUpdated,
  externalBusy = false,
}: MarketingSectionSourceDraftEditorProps) {
  const isLinkedIn = usesLinkedInSectionWorkflow(item);
  const mediaRole = isLinkedIn ? "linkedin_content" : "video_content";

  const [body, setBody] = useState(item.body ?? "");
  const [companyName, setCompanyName] = useState(item.summary ?? "");
  const [theme, setTheme] = useState(item.theme ?? "");
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [postMediaPreview, setPostMediaPreview] = useState<string | null>(null);
  const [postMediaIsVideo, setPostMediaIsVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isBusy = busy || externalBusy;
  const formReady = Boolean(body.trim() && companyName.trim());

  const loadExistingMedia = useCallback(async () => {
    try {
      const assets = await listContentAssets(item.id);
      const source = filterSourcePreviewMedia(assets, item)[0];
      if (!source) {
        setPostMediaPreview(null);
        setPostMediaIsVideo(false);
        return;
      }
      const url = marketingAssetUrl(source.asset.file_url);
      setPostMediaPreview(url);
      setPostMediaIsVideo(
        source.asset.asset_kind === "video" || Boolean(source.asset.mime_type?.startsWith("video/")),
      );
    } catch {
      setPostMediaPreview(null);
    }
  }, [item]);

  useEffect(() => {
    setBody(item.body ?? "");
    setCompanyName(item.summary ?? "");
    setTheme(item.theme ?? "");
    setPostMediaFile(null);
    void loadExistingMedia();
  }, [item, loadExistingMedia]);

  useEffect(() => {
    return () => {
      if (postMediaPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(postMediaPreview);
      }
    };
  }, [postMediaPreview]);

  const onPostMediaSelected = (file: File) => {
    setPostMediaFile(file);
    setPostMediaIsVideo(file.type.startsWith("video/"));
    if (postMediaPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(postMediaPreview);
    }
    setPostMediaPreview(URL.createObjectURL(file));
  };

  const persist = async (resubmit: boolean) => {
    if (!formReady) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      let updated = await updateContentItem(item.id, {
        body: body.trim(),
        summary: companyName.trim(),
        theme: theme.trim() || null,
        title: titleFromTopic(body),
      });
      if (postMediaFile) {
        await uploadContentAssetForItem(
          item.id,
          item.company_id,
          postMediaFile,
          mediaRole,
          postMediaIsVideo ? "video" : "image",
        );
        setPostMediaFile(null);
        updated = await updateContentItem(item.id, {
          body: body.trim(),
          summary: companyName.trim(),
        });
      }
      if (resubmit) {
        updated = await submitContentItem(item.id);
        setSuccess("Sent to marketing head for review.");
      } else {
        setSuccess("Changes saved.");
      }
      await loadExistingMedia();
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save changes");
    } finally {
      setBusy(false);
    }
  };

  const contentLabel = isLinkedIn ? "LinkedIn post" : "video";

  return (
    <section className={marketingCard}>
      <MarketingReviewSectionHeader
        tone="preview"
        title="Edit source draft"
        description={`Update the ${contentLabel} details based on marketing head feedback, then send again for approval`}
      />

      <div className="space-y-3 p-4">
        <DraftFormField icon={PenLine} label="Topic" required highlight>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="What is this post about?"
            className={fieldClass}
            disabled={isBusy}
          />
        </DraftFormField>

        <DraftFormField icon={Building2} label="Company" required highlight>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Which company is this for?"
            className="h-10 rounded-lg shadow-sm"
            disabled={isBusy}
          />
        </DraftFormField>

        <DraftFormField icon={Palette} label="Theme">
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            rows={3}
            placeholder="Mood, layout, and visual direction…"
            className={fieldClass}
            disabled={isBusy}
          />
        </DraftFormField>

        <DraftFormField icon={ImageIcon} label="Photo or video">
          <MarketingBannerUploadField
            disabled={isBusy}
            previewUrl={postMediaPreview}
            previewIsVideo={postMediaIsVideo}
            accept="image/*,video/*"
            title="Upload media"
            chooseLabel="Choose image or video"
            hint="Replace the source image or video if marketing head asked for changes."
            onFileSelected={onPostMediaSelected}
          />
        </DraftFormField>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-4 py-3.5">
        <p className="text-xs text-muted-foreground">
          <span className="text-destructive">*</span> Topic and company are required
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="bg-background"
            disabled={!formReady || isBusy}
            onClick={() => void persist(false)}
          >
            Save changes
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!formReady || isBusy}
            onClick={() => void persist(true)}
          >
            Send for approval
          </Button>
        </div>
      </div>
    </section>
  );
}
