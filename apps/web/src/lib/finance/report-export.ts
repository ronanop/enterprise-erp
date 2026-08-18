import { escapeHtml, openPrintDocument } from "@/lib/html";
import { downloadCsv, downloadXlsx } from "@/lib/spreadsheet";
import { formatInrPrecise } from "@/services/finance-service";

export type ExportColumn<T> = {
  key: keyof T | string;
  label: string;
  align?: "left" | "right";
  format?: (value: unknown, row: T) => string;
};

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
      out[col.label] = cellValue(row, col);
    }
    return out;
  });
}

export function exportTabularCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: ExportColumn<T>[],
) {
  downloadCsv(filename, rowsForExport(rows, columns));
}

export async function exportTabularXlsx<T extends Record<string, unknown>>(
  filename: string,
  sheetName: string,
  rows: T[],
  columns: ExportColumn<T>[],
) {
  await downloadXlsx(filename, [
    { name: sheetName, rows: rowsForExport(rows, columns) },
  ]);
}

export function printTabularTable<T extends Record<string, unknown>>(
  title: string,
  rows: T[],
  columns: ExportColumn<T>[],
  subtitle?: string,
) {
  const head = columns
    .map(
      (c) =>
        `<th style="text-align:${c.align === "right" ? "right" : "left"}">${escapeHtml(c.label)}</th>`,
    )
    .join("");

  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const val = cellValue(row, col);
          const align = col.align === "right" ? "text-align:right" : "";
          return `<td style="${align}">${escapeHtml(val)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const safeTitle = escapeHtml(title);
  const subtitleHtml = subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : "";
  openPrintDocument(`<!doctype html><html><head><title>${safeTitle}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;font-size:12px;color:#0f172a;padding:24px}
      h1{font-size:16px;margin:0 0 4px}
      p.sub{font-size:11px;color:#64748b;margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f8fafc;font-size:11px;text-transform:uppercase}
    </style></head><body>
    <h1>${safeTitle}</h1>
    ${subtitleHtml}
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
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
  const safeTitle = escapeHtml(title);
  const subtitleHtml = subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : "";
  openPrintDocument(`<!doctype html><html><head><title>${safeTitle}</title>
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
    <h1>${safeTitle}</h1>
    ${subtitleHtml}
    ${htmlBody}
    </body></html>`);
}
