"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  ASSETS_SURFACE_CARD,
  TABLE_SERIAL_HEADER_LABEL,
  tableRowSerial,
  tableSerialCellClassName,
  tableSerialHeaderClassName,
} from "@/components/assets/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isAuthenticated } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  assetOperationsService,
  documentService,
  type DocumentRow,
  type DocumentUploadLimits,
  type AssetsRow,
} from "@/services/assets-service";

const ASSET_PAGE_SIZE = 25;
const DOC_PAGE_SIZE = 100;

/** UI document types. Values map to backend DOCUMENT_TYPES where possible. */
export const ASSET_DOCUMENT_TYPE_OPTIONS = [
  { value: "invoice", label: "Invoice", apiType: "invoice" },
  { value: "purchase_order", label: "Purchase Order", apiType: "other" },
  { value: "warranty", label: "Warranty", apiType: "warranty" },
  { value: "amc", label: "AMC", apiType: "other" },
  { value: "insurance", label: "Insurance", apiType: "insurance" },
  { value: "delivery_challan", label: "Delivery Challan", apiType: "other" },
  { value: "grn", label: "GRN", apiType: "other" },
  { value: "photo", label: "Asset Photo", apiType: "photo" },
  { value: "manual", label: "User Manual", apiType: "manual" },
  { value: "specification", label: "Specification", apiType: "other" },
  { value: "other", label: "Other", apiType: "other" },
] as const;

export type AssetDocumentTypeValue = (typeof ASSET_DOCUMENT_TYPE_OPTIONS)[number]["value"];

type AssetListItem = {
  id: string;
  assetCode: string;
  assetName: string;
  assetType: string;
  holder: string;
};

type DraftDocumentErrors = {
  documentType?: string;
  file?: string;
  form?: string;
};

type DraftDocument = {
  key: string;
  documentType: AssetDocumentTypeValue | "";
  documentDate: string;
  remarks: string;
  file: File | null;
  errors: DraftDocumentErrors;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function mapAssetRow(row: AssetsRow): AssetListItem {
  const type =
    asText(row.asset_type_name) ||
    asText(row.asset_type) ||
    asText(row.category_name) ||
    "—";
  const holder =
    asText(row.assignee_label) ||
    asText(row.current_holder) ||
    asText(row.custodian_label) ||
    "—";
  return {
    id: asText(row.id),
    assetCode: asText(row.asset_code) || asText(row.document_number) || "—",
    assetName: asText(row.asset_name) || "—",
    assetType: type,
    holder,
  };
}

function formatBytes(size?: number | null): string {
  if (size == null || !Number.isFinite(size) || size < 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function fileTypeLabel(doc: DocumentRow): string {
  const mime = (doc.content_type || "").toLowerCase();
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("wordprocessingml") || mime.endsWith("msword"))
    return mime.includes("wordprocessingml") ? "DOCX" : "DOC";
  if (mime.includes("spreadsheetml") || mime.includes("ms-excel")) {
    return mime.includes("spreadsheetml") ? "XLSX" : "XLS";
  }
  if (mime.includes("jpeg")) return "JPG";
  if (mime.includes("png")) return "PNG";
  const ext = doc.document_name.includes(".")
    ? doc.document_name.split(".").pop()?.toUpperCase()
    : "";
  return ext || "FILE";
}

function documentTypeLabel(type: string): string {
  const normalized = type.trim().toLowerCase();
  const fromUi = ASSET_DOCUMENT_TYPE_OPTIONS.find(
    (opt) => opt.value === normalized || opt.apiType === normalized,
  );
  if (fromUi && fromUi.apiType === normalized && fromUi.value === normalized) {
    return fromUi.label;
  }
  const apiLabels: Record<string, string> = {
    invoice: "Invoice",
    warranty: "Warranty",
    insurance: "Insurance",
    manual: "User Manual",
    photo: "Asset Photo",
    other: "Other",
  };
  return apiLabels[normalized] || type || "—";
}

function FileTypeIcon({ doc }: { doc: DocumentRow }) {
  const label = fileTypeLabel(doc);
  const className = "size-4 shrink-0 text-muted-foreground";
  if (label === "PNG" || label === "JPG") return <FileImage className={className} aria-hidden />;
  if (label === "XLS" || label === "XLSX") return <FileSpreadsheet className={className} aria-hidden />;
  return <FileText className={className} aria-hidden />;
}

function formatUploadedAt(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function acceptAttribute(limits: DocumentUploadLimits): string {
  const mimes = limits.allowed_content_types.join(",");
  const exts = limits.accepted_extensions.map((e) => `.${e.replace(/^\./, "")}`).join(",");
  return [mimes, exts].filter(Boolean).join(",");
}

function acceptedFormatsLabel(limits: DocumentUploadLimits): string {
  const exts = limits.accepted_extensions
    .map((e) => e.replace(/^\./, "").toUpperCase())
    .filter(Boolean);
  if (!exts.length) return "PDF, DOC, DOCX, XLS, XLSX, PNG, JPG";
  return exts.join(", ");
}

function friendlyUploadError(err: unknown, maxMb: number): string {
  if (err instanceof ApiClientError) {
    if (err.status === 0) {
      return "Cannot reach the API. Confirm the backend is running and try again.";
    }
    const raw = (err.message || "").trim();
    const msg = raw.toLowerCase();
    if (msg.includes("larger") || msg.includes("upload limit") || msg.includes("too large")) {
      return `This file exceeds the ${maxMb} MB upload limit. Choose a smaller file.`;
    }
    if (
      msg.includes("type") ||
      msg.includes("allowed") ||
      msg.includes("supported") ||
      msg.includes("contents do not match") ||
      msg.includes("empty")
    ) {
      return raw || `This file type is not supported. Maximum size is ${maxMb} MB.`;
    }
    if (raw && raw.toLowerCase() !== "api request failed") {
      return raw;
    }
  }
  return `Unable to upload this file. Use PDF, DOC, DOCX, XLS, XLSX, JPG, or PNG up to ${maxMb} MB.`;
}

function normalizeExtension(ext: string): string {
  return ext.replace(/^\./, "").toLowerCase();
}

function validateSelectedFile(file: File, limits: DocumentUploadLimits): string | null {
  const maxMb = Math.max(limits.max_upload_mb, 1);
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size <= 0) {
    return "The selected file is empty. Choose a valid document file.";
  }
  if (file.size > maxBytes) {
    return `This file is ${formatBytes(file.size)}. Maximum allowed size is ${maxMb} MB.`;
  }
  const allowed = new Set(limits.allowed_content_types.map((t) => t.toLowerCase()));
  const mime = (file.type || "").toLowerCase().split(";")[0]?.trim() ?? "";
  const ext = file.name.includes(".")
    ? normalizeExtension(file.name.split(".").pop() || "")
    : "";
  const extAllowed = new Set(limits.accepted_extensions.map(normalizeExtension));

  if (mime && allowed.has(mime)) return null;
  if (mime === "image/jpg" && allowed.has("image/jpeg")) return null;
  // Browsers sometimes omit MIME for PDFs/Office files — accept by extension.
  if (ext && extAllowed.has(ext)) return null;
  const formats = acceptedFormatsLabel(limits);
  return `This file type is not supported. Accepted formats: ${formats} (up to ${maxMb} MB).`;
}

function createDraftKey(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyDraft(): DraftDocument {
  return {
    key: createDraftKey(),
    documentType: "",
    documentDate: new Date().toISOString().slice(0, 10),
    remarks: "",
    file: null,
    errors: {},
  };
}

function resolveApiDocumentType(uiType: AssetDocumentTypeValue): string {
  const opt = ASSET_DOCUMENT_TYPE_OPTIONS.find((o) => o.value === uiType);
  return opt?.apiType ?? "other";
}

function resolveUiTypeLabel(uiType: AssetDocumentTypeValue | ""): string {
  if (!uiType) return "Document";
  return ASSET_DOCUMENT_TYPE_OPTIONS.find((o) => o.value === uiType)?.label ?? "Document";
}

/** Prefer the original uploaded filename for storage / display. */
function resolveDocumentNameFromFile(file: File): string {
  const raw = file.name.replace(/[\\/:*?"<>|]/g, "_").trim() || "document";
  return raw.slice(0, 255);
}

export function AssetDocumentWorkspace() {
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [assetTotal, setAssetTotal] = useState(0);
  const [assetPage, setAssetPage] = useState(1);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetsLoading, setAssetsLoading] = useState(true);

  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [uploadLimits, setUploadLimits] = useState<DocumentUploadLimits | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftDocument[]>([createEmptyDraft()]);
  const [uploading, setUploading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const loadUploadLimits = useCallback(async () => {
    const limits = await documentService.getUploadLimits();
    setUploadLimits(limits);
  }, []);

  const loadDocCounts = useCallback(async () => {
    try {
      const payload = await documentService.search({
        page: 1,
        page_size: 200,
        status: "active",
      });
      const counts: Record<string, number> = {};
      for (const doc of payload.items) {
        counts[doc.asset_id] = (counts[doc.asset_id] ?? 0) + 1;
      }
      setDocCounts(counts);
    } catch {
      setDocCounts({});
    }
  }, []);

  const loadAssets = useCallback(async () => {
    if (!isAuthenticated()) return;
    setAssetsLoading(true);
    setError(null);
    try {
      const result = await assetOperationsService.listAssets({
        page: assetPage,
        page_size: ASSET_PAGE_SIZE,
        q: assetSearch.trim() || undefined,
        status: "active",
      });
      setAssets(result.items.map(mapAssetRow).filter((a) => a.id));
      setAssetTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load assets");
      setAssets([]);
      setAssetTotal(0);
    } finally {
      setAssetsLoading(false);
    }
  }, [assetPage, assetSearch]);

  const loadDocumentsForAsset = useCallback(async (assetId: string) => {
    setDocsLoading(true);
    setError(null);
    try {
      const payload = await documentService.search({
        page: 1,
        page_size: DOC_PAGE_SIZE,
        asset_id: assetId,
        status: "active",
      });
      setDocuments(payload.items);
      setDocCounts((prev) => ({ ...prev, [assetId]: payload.total }));
    } catch (err) {
      setDocuments([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load documents");
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadUploadLimits();
    });
  }, [loadUploadLimits]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadAssets();
      void loadDocCounts();
    });
  }, [loadAssets, loadDocCounts]);

  const openAssetDocuments = (assetId: string) => {
    setSuccess(null);
    setError(null);
    setDocuments([]);
    setSelectedAssetId(assetId);
    setDrafts([createEmptyDraft()]);
    setUploadOpen(true);
    void loadDocumentsForAsset(assetId);
  };

  const closeUpload = () => {
    if (uploading) return;
    setUploadOpen(false);
    setDrafts([createEmptyDraft()]);
  };

  const updateDraft = (
    key: string,
    patch: Partial<Omit<DraftDocument, "errors">> & { errors?: DraftDocumentErrors },
  ) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d;
        const { errors, ...rest } = patch;
        return {
          ...d,
          ...rest,
          errors: errors !== undefined ? errors : d.errors,
        };
      }),
    );
  };

  const updateDraftField = <K extends keyof Omit<DraftDocument, "key" | "errors">>(
    key: string,
    field: K,
    value: DraftDocument[K],
    errorField?: keyof DraftDocumentErrors,
  ) => {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d;
        const nextErrors = { ...d.errors };
        if (errorField) delete nextErrors[errorField];
        return { ...d, [field]: value, errors: nextErrors };
      }),
    );
  };

  const addAnotherDocument = () => {
    setDrafts((prev) => [...prev, createEmptyDraft()]);
  };

  const removeDraft = (key: string) => {
    setDrafts((prev) => {
      if (prev.length <= 1) return [createEmptyDraft()];
      return prev.filter((d) => d.key !== key);
    });
  };

  const handleDraftFilePick = (key: string, file: File | null) => {
    if (!file) {
      updateDraft(key, { file: null, errors: { file: undefined } });
      return;
    }
    if (!uploadLimits) {
      setDrafts((prev) =>
        prev.map((d) =>
          d.key === key
            ? {
                ...d,
                file: null,
                errors: {
                  ...d.errors,
                  file: "Upload limits are still loading. Wait a moment and try again.",
                },
              }
            : d,
        ),
      );
      return;
    }
    const validationError = validateSelectedFile(file, uploadLimits);
    if (validationError) {
      setDrafts((prev) =>
        prev.map((d) =>
          d.key === key
            ? {
                ...d,
                file: null,
                errors: { ...d.errors, file: validationError },
              }
            : d,
        ),
      );
      return;
    }
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d;
        const nextErrors = { ...d.errors };
        delete nextErrors.file;
        delete nextErrors.form;
        return {
          ...d,
          file,
          errors: nextErrors,
        };
      }),
    );
  };

  const validateDrafts = (entries: DraftDocument[]): { ok: boolean; next: DraftDocument[] } => {
    let ok = true;
    const next = entries.map((d) => {
      const errors: DraftDocumentErrors = {};
      if (!d.documentType) {
        errors.documentType = "Document type is required.";
        ok = false;
      }
      if (!d.file) {
        errors.file = "A file is required.";
        ok = false;
      } else if (uploadLimits) {
        const fileErr = validateSelectedFile(d.file, uploadLimits);
        if (fileErr) {
          errors.file = fileErr;
          ok = false;
        }
      }
      return { ...d, errors };
    });
    return { ok, next };
  };

  const handleSaveDocuments = async () => {
    if (!selectedAsset || !uploadLimits) return;
    const { ok, next } = validateDrafts(drafts);
    setDrafts(next);
    if (!ok) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    const remaining: DraftDocument[] = [];
    let successCount = 0;
    const maxMb = Math.max(uploadLimits.max_upload_mb, 1);

    for (const draft of next) {
      if (!draft.file || !draft.documentType) {
        remaining.push(draft);
        continue;
      }
      try {
        await documentService.upload(selectedAsset.id, draft.file, {
          documentType: resolveApiDocumentType(draft.documentType),
          documentName: resolveDocumentNameFromFile(draft.file),
        });
        successCount += 1;
      } catch (err) {
        remaining.push({
          ...draft,
          errors: {
            ...draft.errors,
            form: friendlyUploadError(err, maxMb),
          },
        });
      }
    }

    await loadDocumentsForAsset(selectedAsset.id);
    await loadDocCounts();

    if (remaining.length === 0) {
      setUploadOpen(false);
      setDrafts([createEmptyDraft()]);
      setSuccess(
        successCount === 1
          ? "Document uploaded successfully."
          : `${successCount} documents uploaded successfully.`,
      );
    } else {
      setDrafts(remaining);
      setError(
        successCount > 0
          ? `${successCount} document${successCount === 1 ? "" : "s"} saved. ${remaining.length} could not be uploaded — fix the errors and try again.`
          : "Unable to upload documents. Please fix the errors and try again.",
      );
    }
    setUploading(false);
  };

  const handleViewOrDownload = async (doc: DocumentRow, disposition: "inline" | "attachment") => {
    if (!doc.downloadable) {
      if (doc.storage_uri?.startsWith("https://")) {
        window.open(doc.storage_uri, "_blank", "noopener,noreferrer");
        return;
      }
      setError("This document cannot be opened from storage.");
      return;
    }
    setActionLoadingId(doc.id);
    setError(null);
    try {
      const { blob, filename } = await documentService.getContentBlob(doc.id, disposition);
      if (!blob || blob.size === 0) {
        setError("Unable to open this document — the file appears empty.");
        return;
      }
      const url = URL.createObjectURL(blob);
      if (disposition === "inline") {
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || doc.document_name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      const message =
        err instanceof ApiClientError && err.message
          ? err.message
          : "Unable to open this document. Please try again.";
      setError(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemove = async (doc: DocumentRow) => {
    setActionLoadingId(doc.id);
    setError(null);
    try {
      await documentService.archive(doc.id);
      setSuccess(`Removed ${doc.document_name}`);
      if (selectedAssetId) await loadDocumentsForAsset(selectedAssetId);
      await loadDocCounts();
    } catch {
      setError("Unable to remove this document. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const limits = uploadLimits;
  const existingDocuments = uploadOpen && selectedAssetId ? documents : [];
  const readyDraftCount = drafts.filter((d) => d.file && d.documentType).length;

  return (
    <div className="space-y-5" data-testid="asset-document-workspace">
      <PageHeader
        title="Asset Documents"
        description="Manage asset documents from the assets list."
        actions={
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => {
              void loadAssets();
              void loadDocCounts();
            }}
            disabled={assetsLoading}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", assetsLoading && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{success}</span>
        </div>
      ) : null}

      <Card className={ASSETS_SURFACE_CARD}>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Assets</CardTitle>
          <Input
            aria-label="Search assets"
            placeholder="Search by asset name or number…"
            value={assetSearch}
            onChange={(e) => {
              setAssetPage(1);
              setAssetSearch(e.target.value);
            }}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {assetsLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading assets…
            </div>
          ) : assets.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No assets found.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left text-sm" data-testid="asset-documents-asset-table">
                <thead className="border-b bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className={tableSerialHeaderClassName()} scope="col">
                      {TABLE_SERIAL_HEADER_LABEL}
                    </th>
                    <th className="px-3 py-2 font-medium">Asset</th>
                    <th className="px-3 py-2 font-medium">Asset No.</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Current User</th>
                    <th className="px-3 py-2 font-medium">Documents</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset, index) => {
                    const count = docCounts[asset.id] ?? 0;
                    const active = uploadOpen && selectedAssetId === asset.id;
                    return (
                      <tr
                        key={asset.id}
                        className={cn(
                          "border-b transition-colors duration-200 hover:bg-muted/40",
                          active && "bg-muted/60",
                        )}
                        data-testid={`asset-documents-row-${asset.assetCode}`}
                      >
                        <td className={tableSerialCellClassName()}>
                          {tableRowSerial(assetPage, ASSET_PAGE_SIZE, index)}
                        </td>
                        <td className="px-3 py-2 font-medium">{asset.assetName}</td>
                        <td className="px-3 py-2 font-mono text-xs">{asset.assetCode}</td>
                        <td className="px-3 py-2">{asset.assetType}</td>
                        <td className="px-3 py-2 text-muted-foreground">{asset.holder}</td>
                        <td className="px-3 py-2">
                          {count === 0 ? "0 files" : `${count} file${count === 1 ? "" : "s"}`}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="cursor-pointer transition-colors duration-200"
                            onClick={() => openAssetDocuments(asset.id)}
                          >
                            {count === 0 ? (
                              <>
                                <Plus className="size-3.5" aria-hidden />
                                Add Document
                              </>
                            ) : (
                              <>
                                <Eye className="size-3.5" aria-hidden />
                                View Documents
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 flex items-center justify-end gap-2 text-sm text-muted-foreground">
            <span>
              Page {assetPage} · {assetTotal} total
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={assetPage <= 1}
              onClick={() => setAssetPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              disabled={assetPage * ASSET_PAGE_SIZE >= assetTotal}
              onClick={() => setAssetPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      {uploadOpen && selectedAsset && limits ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[1px] sm:p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !uploading) closeUpload();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-doc-upload-title"
            data-testid="asset-document-upload-dialog"
            className="flex w-full max-w-2xl max-h-[min(90vh,720px)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="min-w-0 space-y-1">
                <h2
                  id="asset-doc-upload-title"
                  className="text-base font-semibold tracking-tight text-foreground sm:text-lg"
                >
                  Add Asset Document
                </h2>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span className="truncate font-medium text-foreground/90">
                    {selectedAsset.assetName}
                  </span>
                  <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground/80 ring-1 ring-border/70">
                    {selectedAsset.assetCode}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 cursor-pointer transition-colors duration-200"
                disabled={uploading}
                aria-label="Close"
                onClick={closeUpload}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <section data-testid="asset-documents-existing" className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Existing documents
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {docsLoading
                      ? "Loading…"
                      : `${existingDocuments.length} file${existingDocuments.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                {docsLoading ? (
                  <div className="flex min-h-[72px] items-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading documents…
                  </div>
                ) : existingDocuments.length === 0 ? (
                  <p className="flex min-h-[72px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                    No documents uploaded yet for this asset.
                  </p>
                ) : (
                  <ul
                    className="divide-y divide-border overflow-hidden rounded-lg border border-border"
                    data-testid="asset-documents-file-table"
                  >
                    {existingDocuments.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex flex-col gap-2 px-3 py-2.5 transition-colors duration-150 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/70 ring-1 ring-border/60">
                            <FileTypeIcon doc={doc} />
                          </span>
                          <div className="min-w-0 space-y-0.5">
                            <p
                              className="truncate text-sm font-medium text-foreground"
                              title={doc.document_name}
                            >
                              {doc.document_name}
                            </p>
                            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                              <span>{documentTypeLabel(doc.document_type)}</span>
                              <span className="text-border" aria-hidden>
                                ·
                              </span>
                              <span>{fileTypeLabel(doc)}</span>
                              <span className="text-border" aria-hidden>
                                ·
                              </span>
                              <span>{formatUploadedAt(doc.created_at)}</span>
                            </p>
                          </div>
                        </div>
                        <div
                          className="flex shrink-0 items-center gap-1 self-end sm:self-center"
                          role="group"
                          aria-label={`Actions for ${doc.document_name}`}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 cursor-pointer gap-1 px-2 transition-colors duration-200"
                            disabled={actionLoadingId === doc.id || uploading}
                            aria-label={`View ${doc.document_name}`}
                            title="View"
                            onClick={() => void handleViewOrDownload(doc, "inline")}
                          >
                            {actionLoadingId === doc.id ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Eye className="size-3.5 shrink-0" aria-hidden />
                            )}
                            <span className="text-xs">View</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 cursor-pointer transition-colors duration-200"
                            disabled={actionLoadingId === doc.id || uploading}
                            aria-label={`Download ${doc.document_name}`}
                            title="Download"
                            onClick={() => void handleViewOrDownload(doc, "attachment")}
                          >
                            <Download className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 cursor-pointer text-destructive transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
                            disabled={actionLoadingId === doc.id || uploading}
                            aria-label={`Delete ${doc.document_name}`}
                            title="Delete"
                            onClick={() => void handleRemove(doc)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    New uploads
                  </h3>
                  {readyDraftCount > 0 ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {readyDraftCount} ready
                    </span>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {drafts.map((draft, index) => (
                    <div
                      key={draft.key}
                      className="space-y-3 rounded-lg border border-border bg-background p-3 sm:p-4"
                      data-testid={`asset-document-draft-${index + 1}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          Document {index + 1}
                          {draft.documentType ? (
                            <span className="ml-2 font-normal text-muted-foreground">
                              · {resolveUiTypeLabel(draft.documentType)}
                            </span>
                          ) : null}
                        </p>
                        {drafts.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 cursor-pointer text-destructive transition-colors duration-200 hover:text-destructive"
                            disabled={uploading}
                            onClick={() => removeDraft(draft.key)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`doc-type-${draft.key}`}>
                            Document Type <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={draft.documentType}
                            disabled={uploading}
                            onValueChange={(value) => {
                              updateDraftField(
                                draft.key,
                                "documentType",
                                value as AssetDocumentTypeValue,
                                "documentType",
                              );
                            }}
                          >
                            <SelectTrigger
                              id={`doc-type-${draft.key}`}
                              className="h-9 w-full cursor-pointer"
                              aria-label={`Document type ${index + 1}`}
                            >
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSET_DOCUMENT_TYPE_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="cursor-pointer"
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {draft.errors.documentType ? (
                            <p className="text-xs text-destructive" role="alert">
                              {draft.errors.documentType}
                            </p>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`doc-date-${draft.key}`}>Document Date</Label>
                          <Input
                            id={`doc-date-${draft.key}`}
                            type="date"
                            value={draft.documentDate}
                            disabled={uploading}
                            className="h-9 w-full cursor-pointer"
                            onChange={(e) =>
                              updateDraftField(draft.key, "documentDate", e.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`doc-remarks-${draft.key}`}>Description / Remarks</Label>
                          <textarea
                            id={`doc-remarks-${draft.key}`}
                            value={draft.remarks}
                            placeholder="Optional notes about this document"
                            disabled={uploading}
                            rows={2}
                            className={cn(
                              "flex min-h-[56px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors duration-200",
                              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                              "disabled:pointer-events-none disabled:opacity-50",
                            )}
                            onChange={(e) =>
                              updateDraftField(draft.key, "remarks", e.target.value)
                            }
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>
                            File <span className="text-destructive">*</span>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            The uploaded filename is used as the document name.
                          </p>
                          <input
                            type="file"
                            className="sr-only"
                            id={`doc-file-${draft.key}`}
                            accept={acceptAttribute(limits)}
                            disabled={uploading}
                            data-testid={`asset-document-file-input-${index + 1}`}
                            onChange={(e) => {
                              handleDraftFilePick(draft.key, e.target.files?.[0] ?? null);
                              e.target.value = "";
                            }}
                          />
                          <div
                            className={cn(
                              "flex flex-col gap-2.5 rounded-md border border-dashed px-3 py-3 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between",
                              draft.errors.file
                                ? "border-destructive/50 bg-destructive/5"
                                : draft.file
                                  ? "border-emerald-300/80 bg-emerald-50/50"
                                  : "border-border bg-muted/15 hover:border-border hover:bg-muted/25",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              {draft.file ? (
                                <div
                                  className="space-y-0.5"
                                  data-testid={`asset-document-selected-file-${index + 1}`}
                                >
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {draft.file.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatBytes(draft.file.size)} · will save as document name
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <p className="text-sm font-medium text-foreground">
                                    Drop or choose a file to upload
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {acceptedFormatsLabel(limits)} · max {limits.max_upload_mb} MB
                                  </p>
                                </div>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant={draft.file ? "outline" : "default"}
                              className="h-9 shrink-0 cursor-pointer transition-colors duration-200"
                              disabled={uploading}
                              onClick={() =>
                                document.getElementById(`doc-file-${draft.key}`)?.click()
                              }
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {draft.file ? "Change File" : "Choose File"}
                            </Button>
                          </div>
                          {draft.errors.file ? (
                            <p className="text-xs text-destructive" role="alert">
                              {draft.errors.file}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {draft.errors.form ? (
                        <p
                          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                          role="alert"
                        >
                          {draft.errors.form}
                        </p>
                      ) : null}

                      {draft.file || draft.documentType ? (
                        <div className="sr-only" data-testid={`asset-document-summary-${index + 1}`}>
                          {resolveUiTypeLabel(draft.documentType)}{" "}
                          {draft.file?.name || "No file selected"}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <Button
                type="button"
                variant="outline"
                className="h-9 cursor-pointer border-dashed transition-colors duration-200"
                disabled={uploading}
                onClick={addAnotherDocument}
                data-testid="asset-document-add-another"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Another Document
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 cursor-pointer transition-colors duration-200"
                  disabled={uploading}
                  onClick={closeUpload}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-9 min-w-[140px] cursor-pointer transition-colors duration-200"
                  disabled={uploading}
                  onClick={() => void handleSaveDocuments()}
                  data-testid="asset-document-save"
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Documents
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
