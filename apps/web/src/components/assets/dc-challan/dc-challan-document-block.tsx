"use client";

import { useRef, useState } from "react";
import { Download, Eye, Printer, RefreshCw, Upload } from "lucide-react";

import {
  documentSourceLabel,
  formatFileSize,
  formatUploadedAt,
  uploadedByLabel,
  validateDcChallanFile,
  type DcDocumentKind,
} from "@/components/assets/dc-challan/dc-challan-document";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DcChallanDocument, DcChallanRow, DcChallanUploadLimits } from "@/services/assets-service";

type DcChallanDocumentBlockProps = {
  title: string;
  row: DcChallanRow;
  kind: DcDocumentKind;
  document: DcChallanDocument | null;
  emptyHint?: string;
  helperText?: string;
  canUpload?: boolean;
  canReplace?: boolean;
  uploadLabel?: string;
  uploading?: boolean;
  uploadLimits?: DcChallanUploadLimits | null;
  onUpload?: (file: File) => void;
  onView?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  showUploader?: boolean;
};

export function DcChallanDocumentBlock({
  title,
  kind,
  document,
  emptyHint,
  helperText,
  canUpload = false,
  canReplace = false,
  uploadLabel = "Choose file",
  uploading = false,
  uploadLimits,
  onUpload,
  onView,
  onDownload,
  onPrint,
  showUploader = false,
}: DcChallanDocumentBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file || !onUpload) return;
    const message = validateDcChallanFile(file, uploadLimits);
    if (message) {
      setClientError(message);
      return;
    }
    setClientError(null);
    setConfirmReplace(false);
    onUpload(file);
  };

  return (
    <div className="space-y-2 rounded-md border border-border/70 p-3" data-testid={`dc-doc-block-${title}`}>
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      {document ? (
        <div className="space-y-2">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm @min-[26rem]:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Filename</dt>
              <dd className="break-all">{document.original_filename || document.external_url || "Document"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Size</dt>
              <dd>{formatFileSize(document.file_size_bytes)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Uploaded</dt>
              <dd>{formatUploadedAt(document.uploaded_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Source</dt>
              <dd>
                <span className="inline-flex rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-xs">
                  {documentSourceLabel(document.source)}
                </span>
              </dd>
            </div>
            {kind === "signed" ? (
              <div className="@min-[26rem]:col-span-2">
                <dt className="text-xs text-muted-foreground">Uploaded by</dt>
                <dd>{uploadedByLabel(document)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onView}>
              <Eye className="size-3.5" />
              View
            </Button>
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onDownload}>
              <Download className="size-3.5" />
              Download
            </Button>
            <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onPrint}>
              <Printer className="size-3.5" />
              Print
            </Button>
            {canReplace ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer"
                disabled={uploading}
                onClick={() => setConfirmReplace(true)}
              >
                <RefreshCw className="size-3.5" />
                Replace document
              </Button>
            ) : null}
          </div>
          {confirmReplace ? (
            <div
              role="alertdialog"
              aria-labelledby={`${kind}-replace-title`}
              data-testid={`dc-doc-replace-confirm-${kind}`}
              className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3"
            >
              <p id={`${kind}-replace-title`} className="text-sm font-medium text-amber-950">
                Replace this document?
              </p>
              <p className="text-xs text-amber-900">
                The previous file stays in the audit history but will no longer be the active document.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer"
                  disabled={uploading}
                  onClick={() => replaceInputRef.current?.click()}
                >
                  Confirm
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={uploading}
                  onClick={() => setConfirmReplace(false)}
                >
                  Cancel
                </Button>
              </div>
              <input
                ref={replaceInputRef}
                type="file"
                className="sr-only"
                data-testid={`dc-doc-replace-input-${kind}`}
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyHint || "No document yet."}</p>
      )}

      {showUploader && canUpload ? (
        <div className="space-y-1.5">
          <button
            type="button"
            disabled={uploading}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border px-3 py-6 text-sm transition-colors duration-200",
              dragOver ? "border-sky-400 bg-sky-50" : "bg-muted/20 hover:bg-muted/40",
              uploading && "pointer-events-none opacity-60",
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
          >
            <Upload className="mb-1 size-4 text-muted-foreground" />
            {uploading ? "Uploading…" : uploadLabel}
          </button>
          {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      ) : null}
      {clientError ? (
        <p className="text-xs text-destructive" data-testid="dc-doc-client-error">
          {clientError}
        </p>
      ) : null}
    </div>
  );
}
