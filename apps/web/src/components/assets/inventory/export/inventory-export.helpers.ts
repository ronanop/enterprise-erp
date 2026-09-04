/**
 * CSV / XLSX helpers for inventory export (no UI).
 */

import * as XLSX from "xlsx";

import {
  exportRowsToLabeledRecords,
  getInventoryExportColumnLabels,
} from "@/components/assets/inventory/export/inventory-export.mapper";
import {
  InventoryExportError,
  type InventoryExportFormat,
  type InventoryExportRow,
} from "@/components/assets/inventory/export/inventory-export.types";

export function buildInventoryExportFilename(
  format: InventoryExportFormat,
  stamp: Date = new Date(),
): string {
  const date = stamp.toISOString().slice(0, 10);
  const ext = format === "xlsx" ? "xlsx" : "csv";
  return `asset-inventory-register-${date}.${ext}`;
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Deterministic CSV (UTF-8 BOM) from export rows — header order locked. */
export function buildInventoryCsvString(rows: InventoryExportRow[]): string {
  const headers = getInventoryExportColumnLabels();
  const lines = [headers.map(escapeCsvCell).join(",")];
  const labeled = exportRowsToLabeledRecords(rows);
  for (const record of labeled) {
    lines.push(headers.map((h) => escapeCsvCell(record[h] ?? "")).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

export function buildInventoryXlsxArrayBuffer(rows: InventoryExportRow[]): ArrayBuffer {
  const data = exportRowsToLabeledRecords(rows);
  const ws =
    data.length > 0
      ? XLSX.utils.json_to_sheet(data)
      : XLSX.utils.aoa_to_sheet([getInventoryExportColumnLabels()]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Asset Register");
  const written = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as
    | number[]
    | Uint8Array
    | ArrayBuffer;
  if (written instanceof ArrayBuffer) return written;
  if (written instanceof Uint8Array) {
    return written.buffer.slice(
      written.byteOffset,
      written.byteOffset + written.byteLength,
    ) as ArrayBuffer;
  }
  return Uint8Array.from(written).buffer;
}

export type DownloadBlobFn = (filename: string, blob: Blob) => void;

export function downloadBlob(filename: string, blob: Blob): void {
  if (typeof document === "undefined") {
    throw new InventoryExportError("download_failed", "Download requires a browser environment");
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}

export function createInventoryExportBlob(
  format: InventoryExportFormat,
  rows: InventoryExportRow[],
): Blob {
  try {
    if (format === "csv") {
      return new Blob([buildInventoryCsvString(rows)], {
        type: "text/csv;charset=utf-8",
      });
    }
    const buffer = buildInventoryXlsxArrayBuffer(rows);
    return new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  } catch (err) {
    throw new InventoryExportError(
      "generate_failed",
      err instanceof Error ? err.message : "Failed to generate export file",
    );
  }
}

export function triggerInventoryDownload(
  format: InventoryExportFormat,
  rows: InventoryExportRow[],
  filename: string,
  download: DownloadBlobFn = downloadBlob,
): void {
  const blob = createInventoryExportBlob(format, rows);
  try {
    download(filename, blob);
  } catch (err) {
    if (err instanceof InventoryExportError) throw err;
    throw new InventoryExportError(
      "download_failed",
      err instanceof Error ? err.message : "Download failed",
    );
  }
}

/** Parse CSV text (for tests) — simple split respecting quotes. */
export function parseCsvLines(csv: string): string[][] {
  const text = csv.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  });
}
