"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Printer, X } from "lucide-react";

import {
  previewKindFromDocument,
  printBlobUrl,
  type DcDocumentKind,
} from "@/components/assets/dc-challan/dc-challan-document";
import { Button } from "@/components/ui/button";
import { dcChallanService, type DcChallanDocument, type DcChallanRow } from "@/services/assets-service";
import { ApiClientError } from "@/services/api-client";

export type DcChallanDocumentPreviewState = {
  row: DcChallanRow;
  kind: DcDocumentKind;
  document: DcChallanDocument;
};

type DcChallanDocumentPreviewModalProps = {
  open: DcChallanDocumentPreviewState | null;
  onOpenChange: (open: DcChallanDocumentPreviewState | null) => void;
};

export function DcChallanDocumentPreviewModal({
  open,
  onOpenChange,
}: DcChallanDocumentPreviewModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [legacyUrl, setLegacyUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setObjectUrl(null);
      setError(null);
      setLegacyUrl(null);
      return;
    }
    if (open.document.is_legacy && open.document.external_url) {
      window.open(open.document.external_url, "_blank", "noopener,noreferrer");
      onOpenChange(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLegacyUrl(null);
    void dcChallanService
      .getDocumentBlob(open.row.id, open.kind, "inline")
      .then((result) => {
        if (cancelled) return;
        if (result.kind === "legacy") {
          setLegacyUrl(result.externalUrl);
          window.open(result.externalUrl, "_blank", "noopener,noreferrer");
          return;
        }
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
        const created = URL.createObjectURL(result.blob);
        blobUrlRef.current = created;
        setObjectUrl(created);
        setContentType(result.contentType);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : "Could not load document preview");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const kindLabel = open.kind === "signed" ? "Signed document" : "SCM challan document";
  const filename = open.document.original_filename || kindLabel;
  const previewKind =
    contentType.includes("pdf") || previewKindFromDocument(open.document) === "pdf"
      ? "pdf"
      : contentType.startsWith("image/") || previewKindFromDocument(open.document) === "image"
        ? "image"
        : previewKindFromDocument(open.document);

  const download = async () => {
    if (legacyUrl || open.document.external_url) {
      window.open(legacyUrl || open.document.external_url || "", "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const result = await dcChallanService.getDocumentBlob(open.row.id, open.kind, "attachment");
      if (result.kind === "legacy") {
        window.open(result.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }
      const href = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = result.filename || filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Download failed");
    }
  };

  const printDoc = async () => {
    if (objectUrl) {
      try {
        await printBlobUrl(objectUrl);
      } catch {
        setError("Could not open print preview. Try Download instead.");
      }
      return;
    }
    void download();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => onOpenChange(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dc-doc-preview-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="dc-document-preview-modal"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{open.row.dc_number}</p>
            <h2 id="dc-doc-preview-title" className="truncate text-sm font-medium">
              {kindLabel}
            </h2>
            <p className="truncate text-xs text-muted-foreground">{filename}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-pointer"
            aria-label="Close preview"
            onClick={() => onOpenChange(null)}
          >
            <X className="size-4" />
          </Button>
        </header>
        <div className="min-h-64 flex-1 overflow-auto bg-muted/30 p-3">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading preview…</p>
          ) : error ? (
            <div className="space-y-3 p-6">
              <p className="text-sm text-destructive">{error}</p>
              <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => void download()}>
                Download instead
              </Button>
            </div>
          ) : objectUrl && previewKind === "pdf" ? (
            <iframe title={filename} src={objectUrl} className="h-[60vh] w-full rounded border border-border/70 bg-white" />
          ) : objectUrl && previewKind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={objectUrl} alt={filename} className="mx-auto max-h-[60vh] max-w-full object-contain" />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Preview is not available for this file. Use Download.</p>
          )}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-4 py-3">
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => void download()}>
            <Download className="size-3.5" />
            Download
          </Button>
          <Button type="button" size="sm" className="cursor-pointer" onClick={() => void printDoc()}>
            <Printer className="size-3.5" />
            Print
          </Button>
        </footer>
      </div>
    </div>
  );
}
