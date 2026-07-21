import * as XLSX from "xlsx";

import { formatInrPrecise } from "@/services/finance-service";

export type ExportColumn<T> = {
  key: keyof T | string;
  label: string;
  align?: "left" | "right";
  format?: (value: unknown, row: T) => string;
};

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cellValue<T extends Record<string, unknown>>(
  row: T,
  col: ExportColumn<T>,
): string {
  const raw = row[col.key as keyof T];
  if (col.format) return col.format(raw, row);
  if (raw == null || raw === "") return "";
  if (typeof raw === "number") return String(raw);
  return String(raw);
}

function rowsForExport<T extends Record<string, unknown>>(
  rows: T[],
  columns: ExportColumn<T>[],
) {
  return rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const col of columns) {
      const val = cellValue(row, col);
      out[col.label] = val;
    }
    return out;
  });
}

export function exportTabularCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[],
) {
  const data = rowsForExport(rows, columns);
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(
    filename,
    new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
  );
}

export function exportTabularXlsx<T extends Record<string, unknown>>(
  filename: string,
  sheetName: string,
  rows: T[],
  columns: ExportColumn<T>[],
) {
  const data = rowsForExport(rows, columns);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    filename,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
}

export function printTabularTable<T extends Record<string, unknown>>(
  title: string,
  rows: T[],
  columns: ExportColumn<T>[],
  subtitle?: string,
) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!win) return;

  const head = columns
    .map(
      (c) =>
        `<th style="text-align:${c.align === "right" ? "right" : "left"}">${c.label}</th>`,
    )
    .join("");

  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const val = cellValue(row, col);
          const align = col.align === "right" ? "text-align:right" : "";
          return `<td style="${align}">${val}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  win.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;font-size:12px;color:#0f172a;padding:24px}
      h1{font-size:16px;margin:0 0 4px}
      p.sub{font-size:11px;color:#64748b;margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f8fafc;font-size:11px;text-transform:uppercase}
    </style></head><body>
    <h1>${title}</h1>
    ${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
}

export function exportAmount(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatInrPrecise(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return formatInrPrecise(n);
  }
  return "—";
}

export function exportRawAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function printHtmlReport(title: string, htmlBody: string, subtitle?: string) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;font-size:12px;color:#0f172a;padding:24px}
      h1{font-size:16px;margin:0 0 4px}
      p.sub{font-size:11px;color:#64748b;margin:0 0 12px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f8fafc;font-size:11px;text-transform:uppercase}
      .section{font-size:13px;font-weight:600;margin:12px 0 6px}
      .total{font-weight:600}
      .right{text-align:right}
    </style></head><body>
    <h1>${title}</h1>
    ${subtitle ? `<p class="sub">${subtitle}</p>` : ""}
    ${htmlBody}
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
}
