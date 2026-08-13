"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Paperclip, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function sourceLabel(entityType: string): string {
  if (entityType === "purchase_order") return "PO";
  if (entityType === "ovf") return "OVF";
  if (entityType === "quote") return "Quote";
  if (entityType === "opportunity") return "Opportunity";
  return entityType.replaceAll("_", " ");
}

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
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ScmCommercialAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const canUpload =
    allowUpload &&
    Boolean(branchId) &&
    (Boolean(orderId) || Boolean(ovfId));

  const load = useCallback(async () => {
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
  }, [orderId, ovfId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !branchId) return;
    setUploading(true);
    setError(null);
    try {
      const content_base64 = await fileToBase64(file);
      const body = {
        file_name: file.name,
        content_base64,
        content_type: file.type || "application/octet-stream",
        branch_id: branchId,
        company_id: companyId ?? null,
        category: "other",
      };
      if (orderId) {
        await uploadScmPoAttachment(orderId, body);
      } else if (ovfId) {
        await uploadScmOvfAttachment(ovfId, body);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
            <Paperclip className="size-3.5 text-[#0369A1]" aria-hidden />
            {title}
          </h2>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {canUpload ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => void onUpload(e.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 cursor-pointer gap-1.5 transition-colors duration-200"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              {uploading ? "Uploading…" : orderId ? "Attach to PO" : "Attach to OVF"}
            </Button>
          </>
        ) : null}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading documents…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents attached yet.</p>
      ) : (
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
                    {(row.category || "other").replaceAll("_", " ")}
                  </Badge>
                </div>
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
      )}
    </section>
  );
}
