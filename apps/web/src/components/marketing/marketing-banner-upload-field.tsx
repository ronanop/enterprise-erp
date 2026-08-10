"use client";

import { Input } from "@/components/ui/input";

type MarketingBannerUploadFieldProps = {
  disabled?: boolean;
  previewUrl?: string | null;
  onFileSelected: (file: File) => void;
  hint?: string;
  accept?: string;
  title?: string;
  chooseLabel?: string;
  previewIsVideo?: boolean;
};

export function MarketingBannerUploadField({
  disabled,
  previewUrl,
  onFileSelected,
  hint = "Upload your banner or ad image (PNG, JPG, WebP).",
  accept = "image/*",
  title = "Banner / image upload",
  chooseLabel = "Choose photo / banner",
  previewIsVideo = false,
}: MarketingBannerUploadFieldProps) {
  return (
    <div className="space-y-2 rounded-md border border-dashed border-primary/50 bg-primary/5 p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <label className="inline-flex cursor-pointer">
        <Input
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
            e.target.value = "";
          }}
        />
        <span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted">
          {chooseLabel}
        </span>
      </label>
      {previewUrl ? (
        <div className="mt-2 max-w-xs overflow-hidden rounded border border-border/70">
          {previewIsVideo ? (
            <video src={previewUrl} controls className="max-h-40 w-full bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Upload preview" className="max-h-40 w-full object-contain" />
          )}
        </div>
      ) : null}
    </div>
  );
}
