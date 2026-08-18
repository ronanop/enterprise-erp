"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Paperclip, Plus, Upload } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  listScmOrderCommercialDocuments,
  openScmCommercialAttachment,
  openReceiptBatchAttachment,
  uploadScmPoAttachment,
  type ReceiptBatchAttachment,
  type ScmCommercialAttachment,
  type ScmReceiptBatch,
} from "@/services/procurement-service";
import { fileToBase64 } from "@/services/sales-crm-service";

const PRESET_SLOTS = [
  { category: "customer_po", label: "Customer PO" },
  { category: "vendor_quote", label: "Vendor Quote" },
] as const;

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    customer_po: "Customer PO",
    vendor_quote: "Vendor Quote",
    vendor_invoice: "Vendor invoice",
    boq: "BOQ",
    sow: "SOW",
    oem_quote: "OEM quote",
    other: "Other",
  };
  return labels[category] || category.replaceAll("_", " ");
}

function sourceLabel(entityType: string, grnNumber?: string | null): string {
  if (entityType === "receipt_batch") {
    return grnNumber ? `GRN ${grnNumber}` : "GRN";
  }
  if (entityType === "purchase_order") return "PO";
  if (entityType === "ovf") return "OVF";
  if (entityType === "quote") return "Quote";
  if (entityType === "opportunity") return "Opportunity";
  return entityType.replaceAll("_", " ");
}

type UnifiedDocument = {
  id: string;
  displayName: string;
  category: string;
  source: string;
  open: () => Promise<void>;
};

export function PoOrderDocumentsCard({
  orderId,
  branchId,
  companyId,
  receiptBatches,
  allowUpload = true,
  className,
  onChanged,
}: {
  orderId: string;
  branchId?: string | null;
  companyId?: string | null;
  receiptBatches: ScmReceiptBatch[];
  allowUpload?: boolean;
  className?: string;
  onChanged?: () => void;
}) {
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [commercialRows, setCommercialRows] = useState<ScmCommercialAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [attachTarget, setAttachTarget] = useState<
    { kind: "preset"; category: string; label: string } | { kind: "other" } | null
  >(null);
  const [otherDocName, setOtherDocName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listScmOrderCommercialDocuments(orderId);
      setCommercialRows(data);
    } catch (err) {
      setCommercialRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grnAttachments = useMemo(() => {
    const rows: Array<ReceiptBatchAttachment & { grnNumber: string; batchId: string }> = [];
    for (const batch of receiptBatches) {
      if (!batch.id) continue;
      for (const attachment of batch.attachments ?? []) {
        rows.push({
          ...attachment,
          grnNumber: batch.grn_number,
          batchId: batch.id,
        });
      }
    }
    return rows;
  }, [receiptBatches]);

  const documents = useMemo<UnifiedDocument[]>(() => {
    const commercial = commercialRows.map((row) => ({
      id: `commercial-${row.id}`,
      displayName: row.remarks?.trim() || row.file_name,
      category: row.category || "other",
      source: sourceLabel(row.entity_type),
      open: async () => {
        setOpeningId(row.id);
        try {
          await openScmCommercialAttachment(row.id);
        } finally {
          setOpeningId(null);
        }
      },
    }));
    const grn = grnAttachments.map((row) => ({
      id: `grn-${row.id}`,
      displayName: row.file_name,
      category: "vendor_invoice",
      source: sourceLabel("receipt_batch", row.grnNumber),
      open: async () => {
        setOpeningId(row.id);
        try {
          await openReceiptBatchAttachment(row.id);
        } finally {
          setOpeningId(null);
        }
      },
    }));
    return [...commercial, ...grn].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
    );
  }, [commercialRows, grnAttachments]);

  function openAttachTarget(
    target: { kind: "preset"; category: string; label: string } | { kind: "other" },
  ) {
    setAttachTarget(target);
    setError(null);
    attachInputRef.current?.click();
  }

  async function onAttachFilePicked(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !attachTarget || !branchId) return;
    if (attachInputRef.current) attachInputRef.current.value = "";

    setUploading(true);
    setError(null);
    try {
      const content_base64 = await fileToBase64(file);
      const category =
        attachTarget.kind === "preset" ? attachTarget.category : "other";
      const remarks =
        attachTarget.kind === "preset"
          ? attachTarget.label
          : otherDocName.trim() || file.name;
      await uploadScmPoAttachment(orderId, {
        file_name: file.name,
        content_base64,
        content_type: file.type || "application/octet-stream",
        branch_id: branchId,
        company_id: companyId ?? null,
        category,
        remarks,
      });
      if (attachTarget.kind === "other") setOtherDocName("");
      setAttachTarget(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to attach document");
    } finally {
      setUploading(false);
    }
  }

  const presetAttached = useMemo(() => {
    const map = new Map<string, UnifiedDocument>();
    for (const row of documents) {
      if (row.category === "customer_po" || row.category === "vendor_quote") {
        if (!map.has(row.category)) map.set(row.category, row);
      }
    }
    return map;
  }, [documents]);

  const canUpload = allowUpload && Boolean(branchId);

  return (
    <section
      className={cn(
        "space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <input
        ref={attachInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void onAttachFilePicked(e.target.files)}
      />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <Paperclip className="size-3.5 text-[#0369A1]" aria-hidden />
            SCM documents
          </h2>
          <p className="text-xs text-muted-foreground">
            PO attachments, vendor quotes, customer POs, and GRN vendor invoices in one place.
          </p>
        </div>
        {canUpload ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
            disabled={uploading}
            onClick={() => setAttachDialogOpen(true)}
          >
            <Upload className="size-3.5" />
            Attach document
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading documents…</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents attached yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{row.displayName}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{row.source}</Badge>
                  <Badge variant="outline">{categoryLabel(row.category)}</Badge>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
                disabled={openingId != null}
                onClick={() => void row.open()}
              >
                <Eye className="size-3.5" />
                View
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={attachDialogOpen}
        title="Attach SCM document"
        description="Attach customer PO and vendor quote for admin review, or add any other named document."
        confirmLabel="Done"
        cancelLabel="Close"
        busy={uploading}
        contentClassName="max-w-md p-6"
        overlayClassName="z-[90]"
        onConfirm={() => setAttachDialogOpen(false)}
        onCancel={() => {
          if (!uploading) setAttachDialogOpen(false);
        }}
      >
        <div className="mt-4 space-y-4">
          {PRESET_SLOTS.map((slot) => {
            const attached = presetAttached.get(slot.category);
            return (
              <div
                key={slot.category}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{slot.label}</p>
                  {attached ? (
                    <p className="truncate text-xs text-muted-foreground">{attached.displayName}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not attached</p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 cursor-pointer transition-colors duration-200"
                  disabled={uploading}
                  onClick={() =>
                    openAttachTarget({
                      kind: "preset",
                      category: slot.category,
                      label: slot.label,
                    })
                  }
                >
                  {attached ? "Replace" : "Attach"}
                </Button>
              </div>
            );
          })}

          <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs font-medium text-foreground">Other document</p>
            <Input
              value={otherDocName}
              disabled={uploading}
              onChange={(e) => setOtherDocName(e.target.value)}
              placeholder="Document name"
              className="h-9"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={uploading || !otherDocName.trim()}
              onClick={() => openAttachTarget({ kind: "other" })}
            >
              <Plus className="size-3.5" />
              Choose file &amp; attach
            </Button>
          </div>
        </div>
      </ConfirmDialog>
    </section>
  );
}
