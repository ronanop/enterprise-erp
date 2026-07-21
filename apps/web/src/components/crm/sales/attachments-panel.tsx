"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Upload } from "lucide-react";

import { FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  createAttachment,
  fileToBase64,
  listAttachments,
  type Attachment,
} from "@/services/sales-crm-service";

const DEFAULT_CATEGORIES = ["vendor_quote", "customer_po", "other"];

/**
 * Generic attachment list + uploader for any sales-blueprint entity
 * (quote, ovf, …) that does not have a dedicated blueprint "attach" action.
 * Uses the shared `/crm/attachments` API (base64 upload).
 */
export function AttachmentsPanel({
  entityType,
  entityId,
  branchId,
  companyId,
  title = "Attachments",
  categories = DEFAULT_CATEGORIES,
  readOnly,
  onChanged,
}: {
  entityType: string;
  entityId: string;
  branchId: string;
  companyId?: string | null;
  title?: string;
  categories?: string[];
  readOnly?: boolean;
  onChanged?: (rows: Attachment[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState(categories[0] ?? "other");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAttachments(entityType, entityId);
      setRows(data);
      onChanged?.(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload() {
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const content_base64 = await fileToBase64(file);
      await createAttachment({
        entity_type: entityType,
        entity_id: entityId,
        branch_id: branchId,
        company_id: companyId,
        file_name: file.name,
        category,
        content_base64,
        content_type: file.type || "application/octet-stream",
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to upload attachment");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-medium tracking-tight">
        <Paperclip className="size-3.5" /> {title}
      </h2>

      {!readOnly ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FinanceSelect
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-40"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll("_", " ")}
              </option>
            ))}
          </FinanceSelect>
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-3.5" />
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="max-w-56 truncate text-xs text-muted-foreground">
              {file?.name ?? "No file selected"}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={uploading || !file}
            onClick={() => void onUpload()}
          >
            <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      ) : null}
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}

      {loading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading attachments…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No files attached yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-xs">
          {rows.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5"
            >
              <span className="truncate">{a.file_name}</span>
              <Badge variant="secondary" className="capitalize">
                {a.category.replaceAll("_", " ")}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
