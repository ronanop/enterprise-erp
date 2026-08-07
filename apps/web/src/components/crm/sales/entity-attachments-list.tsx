"use client";

import { useRef, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  createAttachment,
  deleteAttachment,
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
  onChanged: () => void | Promise<void>;
};

export function EntityAttachmentsList({
  attachments,
  entityType,
  entityId,
  branchId,
  companyId,
  readOnly,
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
          return (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5"
            >
              <button
                type="button"
                className="min-w-0 flex-1 cursor-pointer truncate text-left text-foreground transition-opacity duration-200 hover:opacity-80"
                disabled={busy}
                onClick={() => void openAttachmentInNewTab(row).catch(() => {
                  window.alert("Could not open this attachment.");
                })}
              >
                {row.file_name}
              </button>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="capitalize">
                  {row.category.replaceAll("_", " ")}
                </Badge>
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
                      {busy ? "…" : "Delete"}
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
