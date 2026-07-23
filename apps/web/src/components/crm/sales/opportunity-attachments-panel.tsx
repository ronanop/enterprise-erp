"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cloud,
  ExternalLink,
  Link2,
  Paperclip,
  Upload,
  X,
} from "lucide-react";

import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  createAttachment,
  fileToBase64,
  listAttachments,
  listOvfs,
  listQuotes,
  openAttachmentInNewTab,
  type Attachment,
  type Opportunity,
} from "@/services/sales-crm-service";

type AddMode = "upload" | "link" | "cloud";
type CloudProvider = "google_drive" | "onedrive" | "dropbox" | "box";

const CLOUD_OPTIONS: Array<{ value: CloudProvider; label: string }> = [
  { value: "google_drive", label: "Google Drive" },
  { value: "onedrive", label: "OneDrive" },
  { value: "dropbox", label: "Dropbox" },
  { value: "box", label: "Box" },
];

function sourceLabel(source: Attachment["source"] | undefined): string {
  switch (source) {
    case "link":
      return "Link";
    case "google_drive":
      return "Google Drive";
    case "onedrive":
      return "OneDrive";
    case "dropbox":
      return "Dropbox";
    case "box":
      return "Box";
    default:
      return "Upload";
  }
}

function formatSize(size: number | null | undefined): string {
  if (size == null || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function OpportunityAttachmentsPanel({
  opportunityId,
  opportunity,
  open,
  onClose,
}: {
  opportunityId: string;
  opportunity?: Opportunity | null;
  open: boolean;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AddMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>("google_drive");
  const [cloudName, setCloudName] = useState("");
  const [cloudUrl, setCloudUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [direct, quotes, ovfs] = await Promise.all([
        listAttachments("opportunity", opportunityId).catch(() => [] as Attachment[]),
        listQuotes({ opportunity_id: opportunityId }).catch(() => []),
        listOvfs({ opportunity_id: opportunityId }).catch(() => []),
      ]);
      const related = await Promise.all([
        ...quotes.map((quote) =>
          listAttachments("quote", quote.id).catch(() => [] as Attachment[]),
        ),
        ...ovfs.map((ovf) => listAttachments("ovf", ovf.id).catch(() => [] as Attachment[])),
      ]);
      const merged = [...direct, ...related.flat()];
      const byId = new Map(merged.map((row) => [row.id, row]));
      setRows(
        Array.from(byId.values()).sort((a, b) => a.file_name.localeCompare(b.file_name)),
      );
    } catch (err) {
      setRows([]);
      setError(err instanceof ApiClientError ? err.message : "Failed to load attachments");
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  async function onUploadFile() {
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!opportunity?.branch_id) {
      setError("Opportunity branch is missing.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const content_base64 = await fileToBase64(file);
      await createAttachment({
        entity_type: "opportunity",
        entity_id: opportunityId,
        branch_id: opportunity.branch_id,
        company_id: opportunity.company_id,
        file_name: file.name,
        category: "other",
        source: "upload",
        content_base64,
        content_type: file.type || "application/octet-stream",
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to upload file");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveLink() {
    const name = linkName.trim();
    const url = linkUrl.trim();
    if (!name || !url) {
      setError("Name and URL are required for a link.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("Enter a valid http(s) URL.");
      return;
    }
    if (!opportunity?.branch_id) {
      setError("Opportunity branch is missing.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAttachment({
        entity_type: "opportunity",
        entity_id: opportunityId,
        branch_id: opportunity.branch_id,
        company_id: opportunity.company_id,
        file_name: name,
        category: "other",
        source: "link",
        file_path: url,
        content_type: "text/uri-list",
      });
      setLinkName("");
      setLinkUrl("");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save link");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveCloud() {
    const name = cloudName.trim();
    const url = cloudUrl.trim();
    if (!name || !url) {
      setError("Name and share URL are required for cloud files.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("Enter a valid cloud share URL.");
      return;
    }
    if (!opportunity?.branch_id) {
      setError("Opportunity branch is missing.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAttachment({
        entity_type: "opportunity",
        entity_id: opportunityId,
        branch_id: opportunity.branch_id,
        company_id: opportunity.company_id,
        file_name: name,
        category: "other",
        source: cloudProvider,
        file_path: url,
        content_type: "text/uri-list",
      });
      setCloudName("");
      setCloudUrl("");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save cloud file");
    } finally {
      setSaving(false);
    }
  }

  async function onOpen(row: Attachment) {
    try {
      await openAttachmentInNewTab(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open attachment");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-foreground/40 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      role="presentation"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="opportunity-attachments-title"
        className="flex h-full w-full max-w-md flex-col border-l border-border/80 bg-background shadow-xl motion-safe:animate-in motion-safe:slide-in-from-right-4 motion-safe:duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Opportunity
            </p>
            <h2
              id="opportunity-attachments-title"
              className="truncate text-sm font-medium tracking-tight text-foreground"
            >
              Attachments
            </h2>
            {opportunity ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {[opportunity.opportunity_name, opportunity.opportunity_code]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 cursor-pointer p-0"
            aria-label="Close attachments"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "upload", label: "Upload", icon: Upload },
                { id: "link", label: "Link", icon: Link2 },
                { id: "cloud", label: "Cloud", icon: Cloud },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150",
                  mode === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
                onClick={() => {
                  setMode(tab.id);
                  setError(null);
                }}
              >
                <tab.icon className="size-3.5" aria-hidden />
                {tab.label}
              </button>
            ))}
          </div>

          {mode === "upload" ? (
            <div className="space-y-2 rounded-lg border border-border/70 p-3">
              <p className="text-[11px] text-muted-foreground">
                Upload any file type for this opportunity.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 cursor-pointer"
                  disabled={saving}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="size-3.5" />
                  Choose file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  disabled={saving}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <span className="max-w-[180px] truncate text-xs text-muted-foreground">
                  {file?.name ?? "No file selected"}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                className="h-8 cursor-pointer"
                disabled={saving || !file}
                onClick={() => void onUploadFile()}
              >
                <Upload className="size-3.5" />
                {saving ? "Uploading…" : "Upload"}
              </Button>
            </div>
          ) : null}

          {mode === "link" ? (
            <div className="space-y-2 rounded-lg border border-border/70 p-3">
              <p className="text-[11px] text-muted-foreground">
                Add a link to a folder or document.
              </p>
              <FinanceField label="Name">
                <Input
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  className="h-8"
                  placeholder="Folder or document name"
                />
              </FinanceField>
              <FinanceField label="URL">
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="h-8"
                  placeholder="https://…"
                />
              </FinanceField>
              <Button
                type="button"
                size="sm"
                className="h-8 cursor-pointer"
                disabled={saving}
                onClick={() => void onSaveLink()}
              >
                <Link2 className="size-3.5" />
                {saving ? "Saving…" : "Add link"}
              </Button>
            </div>
          ) : null}

          {mode === "cloud" ? (
            <div className="space-y-2 rounded-lg border border-border/70 p-3">
              <p className="text-[11px] text-muted-foreground">
                Attach a shared file from Google Drive, OneDrive, Dropbox, or Box.
              </p>
              <FinanceField label="Cloud drive">
                <FinanceSelect
                  value={cloudProvider}
                  onChange={(e) => setCloudProvider(e.target.value as CloudProvider)}
                >
                  {CLOUD_OPTIONS.map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.label}
                    </option>
                  ))}
                </FinanceSelect>
              </FinanceField>
              <FinanceField label="Name">
                <Input
                  value={cloudName}
                  onChange={(e) => setCloudName(e.target.value)}
                  className="h-8"
                  placeholder="File or folder name"
                />
              </FinanceField>
              <FinanceField label="Share URL">
                <Input
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  className="h-8"
                  placeholder="https://…"
                />
              </FinanceField>
              <Button
                type="button"
                size="sm"
                className="h-8 cursor-pointer"
                disabled={saving}
                onClick={() => void onSaveCloud()}
              >
                <Cloud className="size-3.5" />
                {saving ? "Saving…" : "Add from cloud"}
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Files ({rows.length})
            </p>
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading attachments…</p>
            ) : rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No attachments for this opportunity yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-start justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-left transition-colors duration-150 hover:bg-muted/50"
                      onClick={() => void onOpen(row)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-medium text-foreground">
                          {row.file_name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="capitalize">{row.entity_type}</span>
                          {formatSize(row.size) ? <span>· {formatSize(row.size)}</span> : null}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {sourceLabel(row.source)}
                        </Badge>
                        <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
