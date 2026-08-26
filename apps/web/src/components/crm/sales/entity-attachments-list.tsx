"use client";

import { useRef, useState } from "react";
import { Download, Eye, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  createAttachment,
  deleteAttachment,
  downloadAttachment,
  fileToBase64,
  openAttachmentInNewTab,
  type Attachment,
} from "@/services/sales-crm-service";

type Props = {
  attachments: Attachment[];
  entityType: string;
  entityId: string;
  branchId: string;
  companyId?: string | null;
  readOnly?: boolean;
  highlightCategory?: string | null;
  onChanged: () => void | Promise<void>;
};

export function EntityAttachmentsList({
  attachments,
  entityType,
  entityId,
  branchId,
  companyId,
  readOnly,
  highlightCategory,
  onChanged,
}: Props) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<Attachment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(row: Attachment) {
    if (
      !window.confirm(
        `Delete "${row.file_name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError(null);
    try {
      await deleteAttachment(row.id);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete attachment");
    } finally {
      setBusyId(null);
    }
  }

  function onReplaceClick(row: Attachment) {
    replaceTargetRef.current = row;
    replaceInputRef.current?.click();
  }

  async function onReplaceFileSelected(file: File | null) {
    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !target) return;

    setBusyId(target.id);
    setError(null);
    try {
      const content_base64 = await fileToBase64(file);
      await createAttachment({
        entity_type: entityType,
        entity_id: entityId,
        branch_id: branchId,
        company_id: companyId,
        file_name: file.name,
        category: target.category,
        content_base64,
        content_type: file.type || "application/octet-stream",
      });
      await deleteAttachment(target.id);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to replace attachment");
    } finally {
      setBusyId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  }

  async function onOpen(row: Attachment) {
    setBusyId(row.id);
    try {
      await openAttachmentInNewTab(row);
    } catch {
      window.alert("Could not open this attachment.");
    } finally {
      setBusyId(null);
    }
  }

  async function onDownload(row: Attachment) {
    setBusyId(row.id);
    try {
      await downloadAttachment(row.id, row.file_name, row);
    } catch {
      window.alert("Could not download this attachment.");
    } finally {
      setBusyId(null);
    }
  }

  if (attachments.length === 0) {
    return <p className="text-xs text-muted-foreground">No files attached yet.</p>;
  }

  return (
    <div className="space-y-2">
      <input
        ref={replaceInputRef}
        type="file"
        className="sr-only"
        disabled={Boolean(busyId)}
        onChange={(e) => void onReplaceFileSelected(e.target.files?.[0] ?? null)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <ul className="space-y-1.5 text-xs">
        {attachments.map((row) => {
          const busy = busyId === row.id;
          const highlighted = Boolean(highlightCategory && row.category === highlightCategory);
          return (
            <li
              key={row.id}
              className={
                highlighted
                  ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2"
                  : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5"
              }
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{row.file_name}</p>
                <Badge variant="secondary" className="mt-1 capitalize">
                  {row.category.replaceAll("_", " ")}
                </Badge>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 cursor-pointer px-2 text-[11px] transition-colors duration-200"
                  disabled={Boolean(busyId)}
                  onClick={() => void onOpen(row)}
                >
                  <Eye className="size-3" />
                  {busy ? "…" : "Open"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 cursor-pointer px-2 text-[11px] transition-colors duration-200"
                  disabled={Boolean(busyId)}
                  onClick={() => void onDownload(row)}
                >
                  <Download className="size-3" />
                  Download
                </Button>
                {!readOnly ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 cursor-pointer px-2 text-[11px]"
                      disabled={Boolean(busyId)}
                      onClick={() => onReplaceClick(row)}
                    >
                      <RefreshCw className="size-3" />
                      Replace
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 cursor-pointer px-2 text-[11px] text-destructive hover:text-destructive"
                      disabled={Boolean(busyId)}
                      onClick={() => void onDelete(row)}
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
