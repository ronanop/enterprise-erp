"use client";

import { useState } from "react";
import { Download, Eye, Trash2 } from "lucide-react";

import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  deleteAttachment,
  downloadAttachment,
  openAttachmentInNewTab,
} from "@/services/sales-crm-service";

export function AttachmentDocumentCell({
  row,
  onChanged,
}: {
  row: { attachmentId: string | null; name: string };
  onChanged?: () => void | Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!row.attachmentId) {
    return <span className="text-muted-foreground">{row.name}</span>;
  }

  async function onView() {
    setMenuOpen(false);
    try {
      await openAttachmentInNewTab(row.attachmentId!);
    } catch {
      window.alert("Could not open this attachment.");
    }
  }

  async function onDownload() {
    setMenuOpen(false);
    setBusy(true);
    try {
      await downloadAttachment(row.attachmentId!, row.name);
    } catch {
      window.alert("Could not download this attachment.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setMenuOpen(false);
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteAttachment(row.attachmentId!);
      await onChanged?.();
    } catch (err) {
      window.alert(err instanceof ApiClientError ? err.message : "Failed to delete attachment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "group/attach flex min-w-0 items-center gap-1",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={row.name}>
        {row.name}
      </span>
      <div
        className={cn(
          "shrink-0 opacity-0 transition-opacity duration-200 group-hover/attach:opacity-100 focus-within:opacity-100",
          menuOpen && "opacity-100",
        )}
      >
        <RowActionsMenu open={menuOpen} onOpenChange={setMenuOpen} align="end" buttonSize="icon-xs">
          <RowActionsItem onClick={() => void onView()}>
            <Eye className="size-3.5 text-muted-foreground" />
            View
          </RowActionsItem>
          <RowActionsItem onClick={() => void onDownload()}>
            <Download className="size-3.5 text-muted-foreground" />
            Download
          </RowActionsItem>
          <RowActionsItem destructive onClick={() => void onDelete()}>
            <Trash2 className="size-3.5" />
            Delete
          </RowActionsItem>
        </RowActionsMenu>
      </div>
    </div>
  );
}
