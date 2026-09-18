"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type AssetListItem = {
  id: string;
  assetCode: string;
  assetName: string;
  assetType: string;
  holder: string;
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
  if (mime.includes("wordprocessingml") || mime.endsWith("msword")) return mime.includes("wordprocessingml") ? "DOCX" : "DOC";
  if (mime.includes("spreadsheetml") || mime.includes("ms-excel")) {
    return mime.includes("spreadsheetml") ? "XLSX" : "XLS";
  }
  if (mime.includes("jpeg")) return "JPG";
  if (mime.includes("png")) return "PNG";
  const ext = doc.document_name.includes(".")
    ? doc.document_name.split(".").pop()?.toUpperCase()
    : "";
  return ext || doc.document_type?.toUpperCase() || "FILE";
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
    return `Unable to upload this file. Please check the file type and size and try again.`;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!selectedAssetId) return;
    void Promise.resolve().then(() => {
      void loadDocumentsForAsset(selectedAssetId);
    });
  }, [selectedAssetId, loadDocumentsForAsset]);

  const visibleDocuments = selectedAssetId ? documents : [];

  const openAsset = (assetId: string) => {
    setSuccess(null);
    setError(null);
    setDocuments([]);
    setSelectedAssetId(assetId);
  };

  const openUpload = () => {
    setSelectedFile(null);
    setError(null);
    setSuccess(null);
    setUploadOpen(true);
  };

  const closeUpload = () => {
    if (uploading) return;
    setUploadOpen(false);
    setSelectedFile(null);
  };

  const handleFilePick = (file: File | null) => {
    setError(null);
    if (!file || !uploadLimits) {
      setSelectedFile(null);
      return;
    }
    const validationError = validateSelectedFile(file, uploadLimits);
    if (validationError) {
      setSelectedFile(null);
      setError(validationError);
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedAsset || !selectedFile) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await documentService.upload(selectedAsset.id, selectedFile);
      setSuccess(`Document uploaded successfully — ${created.document_name}`);
      setUploadOpen(false);
      setSelectedFile(null);
      await loadDocumentsForAsset(selectedAsset.id);
      await loadDocCounts();
    } catch (err) {
      setError(friendlyUploadError(err));
    } finally {
      setUploading(false);
    }
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

  return (
    <div className="space-y-5" data-testid="asset-document-workspace">
      <PageHeader
        title="Asset Documents"
        description="Select an asset and upload or view its documents."
        actions={
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            onClick={() => {
              void loadAssets();
              void loadDocCounts();
              if (selectedAssetId) void loadDocumentsForAsset(selectedAssetId);
            }}
            disabled={assetsLoading || docsLoading}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", (assetsLoading || docsLoading) && "animate-spin")}
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

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
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
                      const active = selectedAssetId === asset.id;
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
                              variant="outline"
                              size="sm"
                              className="cursor-pointer transition-colors duration-200"
                              onClick={() => openAsset(asset.id)}
                            >
                              {count === 0 ? "Add Document" : "View Documents"}
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

        <Card className={ASSETS_SURFACE_CARD} data-testid="asset-documents-detail">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Documents</CardTitle>
              {selectedAsset ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedAsset.assetName}</span>
                  <span className="mx-1.5">·</span>
                  <span className="font-mono text-xs">{selectedAsset.assetCode}</span>
                  {visibleDocuments.length > 0 ? (
                    <span className="ml-2">({visibleDocuments.length})</span>
                  ) : null}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Select an asset to view or upload documents.
                </p>
              )}
            </div>
            {selectedAsset ? (
              <Button
                type="button"
                className="cursor-pointer transition-colors duration-200"
                onClick={openUpload}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Document
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {!selectedAsset ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Choose an asset from the list to manage its documents.
              </p>
            ) : docsLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading documents…
              </div>
            ) : visibleDocuments.length === 0 ? (
              <div className="space-y-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No documents uploaded for this asset.
                </p>
                <Button
                  type="button"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={openUpload}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Document
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm" data-testid="asset-documents-file-table">
                  <thead className="border-b bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">File Name</th>
                      <th className="px-3 py-2 font-medium">File Type</th>
                      <th className="px-3 py-2 font-medium">File Size</th>
                      <th className="px-3 py-2 font-medium">Uploaded</th>
                      <th className="px-3 py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDocuments.map((doc) => (
                      <tr key={doc.id} className="border-b">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <FileTypeIcon doc={doc} />
                            <span className="font-medium break-all">{doc.document_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">{fileTypeLabel(doc)}</td>
                        <td className="px-3 py-2">{formatBytes(doc.file_size_bytes)}</td>
                        <td className="px-3 py-2">{formatUploadedAt(doc.created_at)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer transition-colors duration-200"
                              disabled={actionLoadingId === doc.id}
                              onClick={() => void handleViewOrDownload(doc, "inline")}
                            >
                              <Eye className="mr-1 size-3.5" aria-hidden />
                              Open
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer transition-colors duration-200"
                              disabled={actionLoadingId === doc.id}
                              onClick={() => void handleViewOrDownload(doc, "attachment")}
                            >
                              <Download className="mr-1 size-3.5" aria-hidden />
                              Download
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="cursor-pointer text-destructive transition-colors duration-200 hover:text-destructive"
                              disabled={actionLoadingId === doc.id}
                              onClick={() => void handleRemove(doc)}
                            >
                              <Trash2 className="mr-1 size-3.5" aria-hidden />
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
            className="w-full max-w-md rounded-md border border-border bg-background p-4 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="asset-doc-upload-title" className="text-base font-semibold">
                  Upload document
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

            <div className="mt-4 space-y-3">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept={acceptAttribute(limits)}
                  onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full cursor-pointer transition-colors duration-200"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  Accepted formats: {acceptedFormatsLabel(limits)} (up to {limits.max_upload_mb}{" "}
                  MB).
                </p>
              </div>

              {selectedFile ? (
                <div
                  className="rounded-md border bg-muted/40 px-3 py-2 text-sm"
                  data-testid="asset-document-selected-file"
                >
                  <p className="font-medium break-all">{selectedFile.name}</p>
                  <p className="mt-1 text-muted-foreground">
                    {formatBytes(selectedFile.size)}
                    <span className="mx-1.5">·</span>
                    {selectedFile.name.split(".").pop()?.toUpperCase() || "FILE"}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end gap-2">
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
                disabled={!selectedFile || uploading}
                onClick={() => void handleUpload()}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
