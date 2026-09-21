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
  documentName?: string;
  file?: string;
  form?: string;
};

type DraftDocument = {
  key: string;
  documentType: AssetDocumentTypeValue | "";
  documentName: string;
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

function friendlyUploadError(err: unknown): string {
  if (err instanceof ApiClientError) {
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("larger") || msg.includes("type") || msg.includes("allowed") || msg.includes("empty")) {
      return "Unable to upload this file. Please check the file type and size and try again.";
    }
    if (err.status === 0) {
      return "Unable to upload this file. Please check your connection and try again.";
    }
  }
  return "Unable to upload this file. Please check the file type and size and try again.";
}

function validateSelectedFile(file: File, limits: DocumentUploadLimits): string | null {
  const maxBytes = Math.max(limits.max_upload_mb, 1) * 1024 * 1024;
  if (file.size <= 0) {
    return "Unable to upload this file. Please check the file type and size and try again.";
  }
  if (file.size > maxBytes) {
    return "Unable to upload this file. Please check the file type and size and try again.";
  }
  const allowed = new Set(limits.allowed_content_types.map((t) => t.toLowerCase()));
  const mime = (file.type || "").toLowerCase();
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
  const extAllowed = limits.accepted_extensions.map((e) => e.toLowerCase());
  if (mime && allowed.has(mime)) return null;
  if (mime === "image/jpg" && allowed.has("image/jpeg")) return null;
  if (ext && extAllowed.includes(ext)) return null;
  if (!mime && ext && extAllowed.includes(ext)) return null;
  return "Unable to upload this file. Please check the file type and size and try again.";
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

function createDraftKey(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyDraft(): DraftDocument {
  return {
    key: createDraftKey(),
    documentType: "",
    documentName: "",
    documentDate: "",
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

/** Build a storage filename from the display name, preserving the source file extension. */
function buildUploadFilename(documentName: string, file: File): string {
  const trimmed = documentName.trim() || "document";
  const safeBase = trimmed.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim() || "document";
  const fileExt = file.name.includes(".")
    ? `.${file.name.split(".").pop()!.toLowerCase()}`
    : "";
  if (!fileExt) return safeBase.slice(0, 255);
  const lower = safeBase.toLowerCase();
  if (lower.endsWith(fileExt)) return safeBase.slice(0, 255);
  const withoutTrailingDot = safeBase.replace(/\.[^.]+$/, "");
  return `${withoutTrailingDot.slice(0, 255 - fileExt.length)}${fileExt}`;
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
    if (!file || !uploadLimits) {
      updateDraft(key, { file: null, errors: {} });
      clearDraftFieldError(key, "file");
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
        const nextName =
          d.documentName.trim() ||
          file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
        const nextErrors = { ...d.errors };
        delete nextErrors.file;
        if (nextName) delete nextErrors.documentName;
        return {
          ...d,
          file,
          documentName: d.documentName.trim() ? d.documentName : nextName,
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
      if (!d.documentName.trim()) {
        errors.documentName = "Document name is required.";
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

    for (const draft of next) {
      if (!draft.file || !draft.documentType) {
        remaining.push(draft);
        continue;
      }
      try {
        const uploadName = buildUploadFilename(draft.documentName.trim(), draft.file);
        await documentService.upload(selectedAsset.id, draft.file, {
          documentType: resolveApiDocumentType(draft.documentType),
          documentName: uploadName,
        });
        successCount += 1;
      } catch (err) {
        remaining.push({
          ...draft,
          errors: {
            ...draft.errors,
            form: friendlyUploadError(err),
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
    } catch {
      setError("Unable to open this document. Please try again.");
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
  const summaryDrafts = drafts.filter((d) => d.documentType || d.documentName.trim() || d.file);
  const existingDocuments = uploadOpen && selectedAssetId ? documents : [];

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-md border border-border bg-background shadow-lg"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 id="asset-doc-upload-title" className="text-base font-semibold">
                  Add Asset Document
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedAsset.assetName} —{" "}
                  <span className="font-mono text-xs">{selectedAsset.assetCode}</span>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 cursor-pointer"
                disabled={uploading}
                aria-label="Close"
                onClick={closeUpload}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div data-testid="asset-documents-existing">
                <p className="mb-2 text-sm font-medium">Existing documents</p>
                {docsLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading documents…
                  </div>
                ) : existingDocuments.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                    No documents uploaded yet for this asset.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table
                      className="w-full text-left text-sm"
                      data-testid="asset-documents-file-table"
                    >
                      <thead className="border-b bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Document Name</th>
                          <th className="px-3 py-2 font-medium">Document Type</th>
                          <th className="px-3 py-2 font-medium">File Type</th>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {existingDocuments.map((doc) => (
                          <tr key={doc.id} className="border-b">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <FileTypeIcon doc={doc} />
                                <span className="font-medium break-all">{doc.document_name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">{documentTypeLabel(doc.document_type)}</td>
                            <td className="px-3 py-2">{fileTypeLabel(doc)}</td>
                            <td className="px-3 py-2">{formatUploadedAt(doc.created_at)}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  className="cursor-pointer transition-colors duration-200"
                                  disabled={actionLoadingId === doc.id || uploading}
                                  onClick={() => void handleViewOrDownload(doc, "inline")}
                                >
                                  <Eye className="size-3.5" aria-hidden />
                                  View
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="cursor-pointer transition-colors duration-200"
                                  disabled={actionLoadingId === doc.id || uploading}
                                  onClick={() => void handleViewOrDownload(doc, "attachment")}
                                >
                                  <Download className="size-3.5" aria-hidden />
                                  Download
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="cursor-pointer transition-colors duration-200"
                                  disabled={actionLoadingId === doc.id || uploading}
                                  onClick={() => void handleRemove(doc)}
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {summaryDrafts.length > 0 ? (
                <div data-testid="asset-document-upload-summary">
                  <p className="mb-2 text-sm font-medium">Documents to upload</p>
                  <ul className="space-y-2">
                    {summaryDrafts.map((draft, index) => (
                      <li
                        key={`summary-${draft.key}`}
                        className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                        data-testid={`asset-document-summary-${index + 1}`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium">
                            {index + 1}. {resolveUiTypeLabel(draft.documentType)}
                          </p>
                          <p className="mt-0.5 break-all text-muted-foreground">
                            {draft.documentName.trim() || "Untitled"}
                          </p>
                          <p className="mt-0.5 break-all text-xs text-muted-foreground">
                            {draft.file?.name || "No file selected"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="shrink-0 cursor-pointer text-destructive transition-colors duration-200 hover:text-destructive"
                          disabled={uploading}
                          onClick={() => removeDraft(draft.key)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-4">
                {drafts.map((draft, index) => (
                  <div
                    key={draft.key}
                    className="space-y-3 rounded-md border p-4"
                    data-testid={`asset-document-draft-${index + 1}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Document {index + 1}</p>
                      {drafts.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer text-destructive transition-colors duration-200 hover:text-destructive"
                          disabled={uploading}
                          onClick={() => removeDraft(draft.key)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
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
                            className="cursor-pointer"
                            aria-label={`Document type ${index + 1}`}
                          >
                            <SelectValue placeholder="Select document type" />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSET_DOCUMENT_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="cursor-pointer">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {draft.errors.documentType ? (
                          <p className="mt-1 text-xs text-destructive" role="alert">
                            {draft.errors.documentType}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <Label htmlFor={`doc-name-${draft.key}`}>
                          Document Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`doc-name-${draft.key}`}
                          value={draft.documentName}
                          placeholder="e.g. Dell Invoice 2026"
                          disabled={uploading}
                          onChange={(e) => {
                            updateDraftField(
                              draft.key,
                              "documentName",
                              e.target.value,
                              "documentName",
                            );
                          }}
                        />
                        {draft.errors.documentName ? (
                          <p className="mt-1 text-xs text-destructive" role="alert">
                            {draft.errors.documentName}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <Label htmlFor={`doc-date-${draft.key}`}>Document Date</Label>
                        <Input
                          id={`doc-date-${draft.key}`}
                          type="date"
                          value={draft.documentDate}
                          disabled={uploading}
                          onChange={(e) =>
                            updateDraftField(draft.key, "documentDate", e.target.value)
                          }
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label htmlFor={`doc-remarks-${draft.key}`}>Description / Remarks</Label>
                        <textarea
                          id={`doc-remarks-${draft.key}`}
                          value={draft.remarks}
                          placeholder="Optional notes"
                          disabled={uploading}
                          rows={2}
                          className={cn(
                            "flex min-h-[64px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors duration-200",
                            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                            "disabled:pointer-events-none disabled:opacity-50",
                          )}
                          onChange={(e) =>
                            updateDraftField(draft.key, "remarks", e.target.value)
                          }
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label>
                          File <span className="text-destructive">*</span>
                        </Label>
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
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer transition-colors duration-200"
                            disabled={uploading}
                            onClick={() => document.getElementById(`doc-file-${draft.key}`)?.click()}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            {draft.file ? "Change File" : "Choose File"}
                          </Button>
                          {draft.file ? (
                            <span
                              className="text-sm text-muted-foreground break-all"
                              data-testid={`asset-document-selected-file-${index + 1}`}
                            >
                              {draft.file.name} · {formatBytes(draft.file.size)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Accepted formats: {acceptedFormatsLabel(limits)} (up to{" "}
                          {limits.max_upload_mb} MB).
                        </p>
                        {draft.errors.file ? (
                          <p className="mt-1 text-xs text-destructive" role="alert">
                            {draft.errors.file}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {draft.errors.form ? (
                      <p className="text-xs text-destructive" role="alert">
                        {draft.errors.form}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                disabled={uploading}
                onClick={addAnotherDocument}
                data-testid="asset-document-add-another"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Another Document
              </Button>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-4">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                disabled={uploading}
                onClick={closeUpload}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
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
      ) : null}
    </div>
  );
}
