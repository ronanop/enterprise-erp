"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiClientError } from "@/services/api-client";
import {
  importNonItAssets,
  type NonItAssetType,
  type NonItImportRow,
  type NonItImportSummary,
} from "@/services/nonit-asset-service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: NonItAssetType[];
  onImported: () => void;
};

function downloadNonItImportTemplate(types: NonItAssetType[]): void {
  const active = types.filter((t) => t.active);
  const sampleRows =
    active.length > 0
      ? active.slice(0, 8).map((t) => ({ asset_type: t.name, quantity: 1 }))
      : [
          { asset_type: "Office Chair", quantity: 1 },
          { asset_type: "Conference Table", quantity: 2 },
        ];

  const importSheet = XLSX.utils.json_to_sheet(sampleRows, {
    header: ["asset_type", "quantity"],
  });
  importSheet["!cols"] = [{ wch: 28 }, { wch: 12 }];

  const typeRows =
    active.length > 0
      ? active.map((t) => ({
          asset_type: t.name,
          prefix: t.prefix,
          assignment_mode: t.assignment_mode,
        }))
      : [{ asset_type: "(no active types — create types first)", prefix: "", assignment_mode: "" }];

  const typesSheet = XLSX.utils.json_to_sheet(typeRows);
  typesSheet["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, importSheet, "Import");
  XLSX.utils.book_append_sheet(wb, typesSheet, "Available types");

  const written = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as
    | number[]
    | Uint8Array
    | ArrayBuffer;
  const buffer =
    written instanceof ArrayBuffer
      ? written
      : written instanceof Uint8Array
        ? written.buffer.slice(written.byteOffset, written.byteOffset + written.byteLength)
        : Uint8Array.from(written).buffer;

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "non-it-asset-import-template.xlsx";
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseRows(json: Record<string, unknown>[]): NonItImportRow[] {
  const out: NonItImportRow[] = [];
  for (const raw of json) {
    const mapped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      mapped[normalizeHeader(k)] = v;
    }
    const typeName = String(
      mapped.asset_type ?? mapped.type ?? mapped.assettype ?? "",
    ).trim();
    const qtyRaw = mapped.quantity ?? mapped.qty ?? mapped.count;
    const quantity = Number(qtyRaw);
    if (!typeName || !Number.isFinite(quantity) || quantity < 1) continue;
    out.push({ asset_type: typeName, quantity: Math.floor(quantity) });
  }
  return out;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NonItImportDialog({ open, onOpenChange, types, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<NonItImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<NonItImportSummary | null>(null);

  if (!open) return null;

  function reset() {
    setPreview([]);
    setFileName(null);
    setFileSize(null);
    setParsing(false);
    setDragOver(false);
    setError(null);
    setSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function clearFile() {
    if (busy) return;
    setPreview([]);
    setFileName(null);
    setFileSize(null);
    setError(null);
    setSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(file: File) {
    setError(null);
    setSummary(null);
    setFileName(file.name);
    setFileSize(file.size);
    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const rows = parseRows(json);
      if (rows.length === 0) {
        setPreview([]);
        setError("No valid rows found. Expected columns: asset_type, quantity.");
        return;
      }
      setPreview(rows);
    } catch {
      setPreview([]);
      setError("Could not parse Excel file.");
    } finally {
      setParsing(false);
    }
  }

  async function confirmImport() {
    if (preview.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importNonItAssets(preview);
      setSummary(result);
      onImported();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const knownTypeNames = new Set(types.filter((t) => t.active).map((t) => t.name.toLowerCase()));
  const totalQty = preview.reduce((sum, row) => sum + row.quantity, 0);
  const unknownCount = preview.filter(
    (row) => !knownTypeNames.has(row.asset_type.toLowerCase()),
  ).length;
  const hasFile = Boolean(fileName);
  const canImport = !busy && !parsing && preview.length > 0 && !summary;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Import Non-IT assets"
      onClick={() => {
        if (!busy) {
          onOpenChange(false);
          reset();
        }
      }}
    >
      <div
        className="flex max-h-[min(90dvh,40rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border/60 px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(3,105,161,0.1)] text-[#0369A1]">
              <FileSpreadsheet className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Import Non-IT assets
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Upload an Excel sheet to create stock in bulk. First sheet only.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 cursor-pointer text-muted-foreground transition-colors duration-200"
              disabled={busy}
              aria-label="Close"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              asset_type
            </span>
            <span className="rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
              quantity
            </span>
            <span className="rounded-md border border-transparent px-1.5 py-0.5 text-[11px] text-muted-foreground">
              .xlsx · .xls · .csv
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          {!summary ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-[rgba(3,105,161,0.04)] px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Need the format?</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Download a ready Excel with your active types as sample rows.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 cursor-pointer gap-1.5 border-[#0369A1]/35 bg-background text-[#0369A1] transition-colors duration-200 hover:bg-[rgba(3,105,161,0.08)] hover:text-[#0369A1]"
                disabled={busy}
                onClick={() => downloadNonItImportTemplate(types)}
              >
                <Download className="size-3.5" aria-hidden />
                Download Excel format
              </Button>
            </div>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            disabled={busy || parsing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />

          {summary ? (
            <div className="space-y-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-900">
                    Created {summary.total_created} asset
                    {summary.total_created === 1 ? "" : "s"}
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-800/80">
                    Import finished successfully. Codes were reserved for each new unit.
                  </p>
                </div>
              </div>
              <ul className="divide-y divide-emerald-200/70 overflow-hidden rounded-lg border border-emerald-200/70 bg-background/70 text-sm">
                {summary.lines.map((line) => (
                  <li
                    key={line.asset_type}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="truncate font-medium text-foreground">{line.asset_type}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {line.created}/{line.requested}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : !hasFile ? (
            <button
              type="button"
              disabled={busy || parsing}
              className={cn(
                "group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-all duration-200",
                dragOver
                  ? "border-[#0369A1] bg-[rgba(3,105,161,0.08)]"
                  : "border-border/80 bg-muted/15 hover:border-[#0369A1]/60 hover:bg-[rgba(3,105,161,0.04)]",
                (busy || parsing) && "pointer-events-none opacity-60",
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void onFile(f);
              }}
            >
              <div
                className={cn(
                  "mb-3 flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-sm transition-colors duration-200",
                  dragOver ? "border-[#0369A1]/40 text-[#0369A1]" : "text-muted-foreground group-hover:text-[#0369A1]",
                )}
              >
                <Upload className="size-5" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {dragOver ? "Drop file to upload" : "Drag & drop Excel here"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                or{" "}
                <span className="font-medium text-[#0369A1] underline-offset-2 group-hover:underline">
                  browse files
                </span>
              </p>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-sm">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(3,105,161,0.1)] text-[#0369A1]">
                  {parsing ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <FileSpreadsheet className="size-5" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground" title={fileName ?? undefined}>
                    {fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {parsing
                      ? "Reading workbook…"
                      : fileSize != null
                        ? `${formatBytes(fileSize)} · ready to preview`
                        : "Ready"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer px-2.5 text-xs transition-colors duration-200"
                    disabled={busy || parsing}
                    onClick={() => inputRef.current?.click()}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 cursor-pointer text-muted-foreground transition-colors duration-200"
                    disabled={busy || parsing}
                    aria-label="Remove file"
                    onClick={clearFile}
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              </div>

              {preview.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Rows
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                        {preview.length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Units
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                        {totalQty}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Warnings
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-sm font-semibold tabular-nums",
                          unknownCount > 0 ? "text-amber-700" : "text-foreground",
                        )}
                      >
                        {unknownCount}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border/80">
                    <div className="max-h-48 overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 z-[1] border-b border-border bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Asset type</th>
                            <th className="px-3 py-2 text-right font-semibold">Qty</th>
                            <th className="px-3 py-2 font-semibold">Check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.map((row, i) => {
                            const ok = knownTypeNames.has(row.asset_type.toLowerCase());
                            return (
                              <tr
                                key={`${row.asset_type}-${i}`}
                                className="border-b border-border/50 last:border-0"
                              >
                                <td className="px-3 py-2 font-medium text-foreground">
                                  {row.asset_type}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                  {row.quantity}
                                </td>
                                <td className="px-3 py-2">
                                  {ok ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                                      <CheckCircle2 className="size-3" aria-hidden />
                                      OK
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                                      <AlertCircle className="size-3" aria-hidden />
                                      Unknown
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {unknownCount > 0 ? (
                    <p className="text-xs text-amber-800">
                      Unknown types will be rejected on import. Fix the sheet or create the type
                      first.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          )}

          {error ? (
            <p
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-5 py-3.5 sm:px-6">
          {!summary ? (
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer transition-colors duration-200"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
          ) : null}
          {summary ? (
            <Button
              type="button"
              className="cursor-pointer bg-[#0369A1] text-white transition-colors duration-200 hover:bg-[#0369A1]/90"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Done
            </Button>
          ) : (
            <Button
              type="button"
              className="cursor-pointer gap-2 bg-[#0369A1] text-white transition-colors duration-200 hover:bg-[#0369A1]/90 disabled:opacity-50"
              disabled={!canImport}
              onClick={() => void confirmImport()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Importing…
                </>
              ) : (
                <>
                  Confirm import
                  {preview.length > 0 ? (
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] tabular-nums">
                      {totalQty}
                    </span>
                  ) : null}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
