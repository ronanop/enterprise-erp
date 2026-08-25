"use client";

import { useEffect } from "react";
import { Eye, X } from "lucide-react";

import { HrStatusBadge } from "@/components/hr/hr-primitives";
import { Button } from "@/components/ui/button";
import {
  canPreviewOnboardingDocument,
  documentMimeType,
  downloadOnboardingDocument,
} from "@/lib/onboarding-document";
import type { OnboardingDocument } from "@/types/onboarding-management";

type PreviewDialogProps = {
  doc: OnboardingDocument | null;
  subtitle?: string;
  onClose: () => void;
};

export function OnboardingDocumentPreviewDialog({ doc, subtitle, onClose }: PreviewDialogProps) {
  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, onClose]);

  if (!doc) return null;

  const mime = documentMimeType(doc);
  const canPreview = canPreviewOnboardingDocument(doc);
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onb-doc-preview-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <h3 id="onb-doc-preview-title" className="truncate text-sm font-semibold">
              {doc.fileName}
            </h3>
            <p className="text-[10px] uppercase text-muted-foreground">
              {subtitle ?? doc.kind.replace(/_/g, " ")}
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer shrink-0 rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-muted"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-[200px] flex-1 overflow-auto bg-muted/20 p-4">
          {!doc.fileDataUrl ? (
            <p className="text-sm text-muted-foreground">
              Preview is not available for this upload. Ask the candidate to upload the file again
              from the portal so HR can view it.
            </p>
          ) : canPreview && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.fileDataUrl}
              alt={doc.fileName}
              className="mx-auto max-h-[65vh] w-auto max-w-full rounded-md border border-border/60 object-contain"
            />
          ) : canPreview && isPdf ? (
            <iframe
              title={doc.fileName}
              src={doc.fileDataUrl}
              className="h-[65vh] w-full rounded-md border border-border/60 bg-white"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              This file type cannot be previewed in the browser. Use Download to open it locally.
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-4 py-3">
          {doc.fileDataUrl ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => downloadOnboardingDocument(doc)}
            >
              Download
            </Button>
          ) : null}
          <Button type="button" size="sm" className="cursor-pointer" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

type DocumentRowProps = {
  doc: OnboardingDocument;
  subtitle?: string;
  acting?: boolean;
  onView: (doc: OnboardingDocument) => void;
  onVerify?: () => void;
  onReject?: () => void;
  className?: string;
};

export function OnboardingDocumentRow({
  doc,
  subtitle,
  acting,
  onView,
  onVerify,
  onReject,
  className,
}: DocumentRowProps) {
  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs"
      }
    >
      <button
        type="button"
        className="min-w-0 flex-1 cursor-pointer rounded-md text-left transition-colors duration-200 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 px-1 py-0.5 -mx-1"
        onClick={() => onView(doc)}
      >
        <p className="font-medium text-primary underline-offset-2 hover:underline">{doc.fileName}</p>
        <p className="text-[10px] text-muted-foreground uppercase">
          {subtitle ?? doc.kind.replace(/_/g, " ")}
        </p>
      </button>
      <div className="flex items-center gap-1">
        <HrStatusBadge status={doc.verifyStatus} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 cursor-pointer gap-1"
          onClick={() => onView(doc)}
        >
          <Eye className="size-3" />
          View
        </Button>
        {doc.verifyStatus === "pending" && onVerify ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 cursor-pointer"
            disabled={acting}
            onClick={(e) => {
              e.stopPropagation();
              onVerify();
            }}
          >
            Verify
          </Button>
        ) : null}
        {doc.verifyStatus === "pending" && onReject ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 cursor-pointer text-destructive"
            disabled={acting}
            onClick={(e) => {
              e.stopPropagation();
              onReject();
            }}
          >
            Reject
          </Button>
        ) : null}
      </div>
    </div>
  );
}
