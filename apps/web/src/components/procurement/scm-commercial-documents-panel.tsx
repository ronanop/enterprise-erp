"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Paperclip, Plus, Trash2, Upload } from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  listScmOrderCommercialDocuments,
  listScmOvfAttachments,
  openScmCommercialAttachment,
  uploadScmOvfAttachment,
  uploadScmPoAttachment,
  type ScmCommercialAttachment,
} from "@/services/procurement-service";
import { fileToBase64 } from "@/services/sales-crm-service";

const PRESET_SLOTS = [
  { category: "customer_po", label: "Customer PO" },
  { category: "vendor_quote", label: "Vendor Quote" },
] as const;

function sourceLabel(entityType: string): string {
  if (entityType === "purchase_order") return "PO";
  if (entityType === "ovf") return "OVF";
  if (entityType === "quote") return "Quote";
  if (entityType === "opportunity") return "Opportunity";
  return entityType.replaceAll("_", " ");
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    customer_po: "Customer PO",
    vendor_quote: "Vendor Quote",
    vendor_invoice: "Vendor invoice",
    other: "Other",
  };
  return labels[category] || category.replaceAll("_", " ");
}

type PendingDocument = {
  id: string;
  file: File;
  category: string;
  remarks: string;
};

export type PendingScmCommercialDocument = PendingDocument;

export function ScmCommercialDocumentsPanel({
  ovfId,
  orderId,
  branchId,
  companyId,
  title = "Documents",
  description,
  allowUpload = false,
  className,
  onChanged,
  draftOnly = false,
  onDraftDocumentsChange,
}: {
  ovfId?: string | null;
  orderId?: string | null;
  branchId?: string | null;
  companyId?: string | null;
  title?: string;
  description?: string;
  allowUpload?: boolean;
  className?: string;
  onChanged?: (rows: ScmCommercialAttachment[]) => void;
  /** Queue files before a PO exists; the parent uploads them after PO creation. */
  draftOnly?: boolean;
  onDraftDocumentsChange?: (documents: PendingScmCommercialDocument[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ScmCommercialAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [otherDocName, setOtherDocName] = useState("");
  const [attachTarget, setAttachTarget] = useState<
    { kind: "preset"; category: string; label: string } | { kind: "other" } | null
  >(null);

  const canUpload =
    allowUpload &&
    Boolean(branchId) &&
    (draftOnly || Boolean(orderId));

  const load = useCallback(async () => {
    if (draftOnly) {
      setRows([]);
      setLoading(false);
      return;
    }
    if (!orderId && !ovfId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = orderId
        ? await listScmOrderCommercialDocuments(orderId)
        : await listScmOvfAttachments(ovfId!);
      setRows(data);
      onChanged?.(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftOnly, orderId, ovfId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onDraftDocumentsChange?.(pendingDocuments);
  }, [onDraftDocumentsChange, pendingDocuments]);

  const presetAttached = useMemo(() => {
    const map = new Map<string, PendingDocument>();
    for (const document of pendingDocuments) {
      if (document.category === "customer_po" || document.category === "vendor_quote") {
        map.set(document.category, document);
      }
    }
    return map;
  }, [pendingDocuments]);

  const otherPendingDocuments = useMemo(
    () =>
      pendingDocuments.filter(
        (document) =>
          document.category !== "customer_po" && document.category !== "vendor_quote",
      ),
    [pendingDocuments],
  );

  function queueFiles(fileList: FileList | null) {
    if (!fileList) return;
    const queued = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      category: "other",
      remarks: "",
    }));
    setPendingDocuments((current) => [...current, ...queued]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function attachDraftFile(file: File) {
    if (!attachTarget) return;
    const nextDocument: PendingDocument =
      attachTarget.kind === "preset"
        ? {
            id: crypto.randomUUID(),
            file,
            category: attachTarget.category,
            remarks: attachTarget.label,
          }
        : {
            id: crypto.randomUUID(),
            file,
            category: "other",
            remarks: otherDocName.trim() || file.name,
          };

    setPendingDocuments((current) => {
      if (attachTarget.kind === "preset") {
        return [
          ...current.filter((document) => document.category !== attachTarget.category),
          nextDocument,
        ];
      }
      return [...current, nextDocument];
    });

    if (attachTarget.kind === "other") setOtherDocName("");
    setAttachTarget(null);
  }

  function openAttachTarget(
    target: { kind: "preset"; category: string; label: string } | { kind: "other" },
  ) {
    if (target.kind === "other" && !otherDocName.trim()) {
      setError("Enter a document name first.");
      return;
    }
    setError(null);
    setAttachTarget(target);
    attachInputRef.current?.click();
  }

  function updatePendingDocument(id: string, field: "remarks", value: string) {
    setPendingDocuments((current) =>
      current.map((document) => (document.id === id ? { ...document, [field]: value } : document)),
    );
  }

  async function onUpload() {
    if (!branchId || pendingDocuments.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const document of pendingDocuments) {
        const content_base64 = await fileToBase64(document.file);
        const body = {
          file_name: document.file.name,
          content_base64,
          content_type: document.file.type || "application/octet-stream",
          branch_id: branchId,
          company_id: companyId ?? null,
          category: document.category,
          remarks: document.remarks.trim() || null,
        };
        if (orderId) {
          await uploadScmPoAttachment(orderId, body);
        } else if (ovfId) {
          await uploadScmOvfAttachment(ovfId, body);
        }
      }
      setPendingDocuments([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  async function onOpen(row: ScmCommercialAttachment) {
    setOpeningId(row.id);
    setError(null);
    try {
      await openScmCommercialAttachment(row.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open document");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <section
      className={cn(
        "space-y-3 rounded-lg border border-border/80 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => queueFiles(e.target.files)}
      />
      <input
        ref={attachInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) attachDraftFile(file);
          if (attachInputRef.current) attachInputRef.current.value = "";
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <Paperclip className="size-3.5 text-[#0369A1]" aria-hidden />
            {title}
          </h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {canUpload ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
            disabled={uploading}
            onClick={() => {
              if (draftOnly) {
                setAttachDialogOpen(true);
                return;
              }
              fileInputRef.current?.click();
            }}
          >
            <Upload className="size-3.5" />
            {draftOnly ? "Attach document" : "Add PO documents"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {draftOnly && pendingDocuments.length > 0 ? (
        <ul className="space-y-1.5">
          {pendingDocuments.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {document.remarks.trim() || document.file.name}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="outline">{categoryLabel(document.category)}</Badge>
                  <span className="truncate text-xs text-muted-foreground">{document.file.name}</span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 cursor-pointer px-2 text-xs text-muted-foreground transition-colors duration-200 hover:text-destructive"
                disabled={uploading}
                onClick={() =>
                  setPendingDocuments((current) =>
                    current.filter((pending) => pending.id !== document.id),
                  )
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {!draftOnly && pendingDocuments.length > 0 ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Review each document, then upload.</p>
            <Button
              type="button"
              size="sm"
              className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={uploading}
              onClick={() => void onUpload()}
            >
              <Upload className="size-3.5" />
              {uploading
                ? "Uploading…"
                : `Upload ${pendingDocuments.length} document${pendingDocuments.length === 1 ? "" : "s"}`}
            </Button>
          </div>
          <ul className="space-y-2">
            {pendingDocuments.map((document) => (
              <li key={document.id} className="rounded-md border border-border bg-background p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">
                    {document.file.name}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 cursor-pointer px-2 text-xs text-muted-foreground transition-colors duration-200 hover:text-destructive"
                    disabled={uploading}
                    onClick={() =>
                      setPendingDocuments((current) =>
                        current.filter((pending) => pending.id !== document.id),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
                <label className="space-y-1 text-xs font-medium text-foreground">
                  Remark
                  <Textarea
                    value={document.remarks}
                    disabled={uploading}
                    onChange={(e) => updatePendingDocument(document.id, "remarks", e.target.value)}
                    className="min-h-8 resize-y py-1.5 text-xs"
                  />
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!draftOnly && loading ? (
        <p className="text-xs text-muted-foreground">Loading documents…</p>
      ) : !draftOnly && rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents attached yet.</p>
      ) : !draftOnly ? (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{row.file_name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="capitalize">
                    {sourceLabel(row.entity_type)}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {categoryLabel(row.category)}
                  </Badge>
                </div>
                {row.remarks ? (
                  <p className="mt-1 text-xs text-muted-foreground">{row.remarks}</p>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
                disabled={openingId === row.id}
                onClick={() => void onOpen(row)}
              >
                <Eye className="size-3.5" />
                {openingId === row.id ? "Opening…" : "View"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {draftOnly ? (
        <ConfirmDialog
          open={attachDialogOpen}
          title="Attach SCM documents"
          confirmLabel="Done"
          cancelLabel="Close"
          contentClassName="max-w-md p-6"
          overlayClassName="z-[90]"
          onConfirm={() => setAttachDialogOpen(false)}
          onCancel={() => setAttachDialogOpen(false)}
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
                      <p className="truncate text-xs text-muted-foreground">{attached.file.name}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not attached</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 cursor-pointer transition-colors duration-200"
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
                    {attached ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        disabled={uploading}
                        onClick={() =>
                          setPendingDocuments((current) =>
                            current.filter((document) => document.category !== slot.category),
                          )
                        }
                        aria-label={`Remove ${slot.label}`}
                        title={`Remove ${slot.label}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {otherPendingDocuments.length > 0 ? (
              <ul className="space-y-1.5">
                {otherPendingDocuments.map((document) => (
                  <li
                    key={document.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">
                        {document.remarks || document.file.name}
                      </p>
                      <p className="truncate text-muted-foreground">{document.file.name}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 cursor-pointer px-2 text-muted-foreground hover:text-destructive gap-1.5"
                      onClick={() =>
                        setPendingDocuments((current) =>
                          current.filter((pending) => pending.id !== document.id),
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground">Other document</p>
              <Input
                value={otherDocName}
                onChange={(e) => {
                  setOtherDocName(e.target.value);
                  setError(null);
                }}
                placeholder="Document name"
                className="h-9"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 w-full cursor-pointer gap-1.5 transition-colors duration-200"
                disabled={!otherDocName.trim()}
                onClick={() => openAttachTarget({ kind: "other" })}
              >
                <Plus className="size-3.5" />
                Choose file &amp; attach
              </Button>
            </div>
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
