/**
 * Column mapping + cell normalization for Excel import (no writes).
 */

import {
  DELIVERY_STATUS_ALIASES,
  EXCEL_IMPORT_TARGET_FIELDS,
  OPERATIONAL_STATUS_ALIASES,
  VALID_DELIVERY_STATUSES,
  VALID_OPERATIONAL_STATUSES,
  type ExcelImportColumnMapping,
  type ExcelImportFieldKey,
  type ExcelImportMappedRow,
  type ExcelImportRawSheet,
} from "@/components/assets/excel-import/excel-import.types";

export function normalizeHeaderKey(header: string): string {
  return header.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel date serials are handled separately; plain numbers as string
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export function suggestColumnMapping(headers: string[]): ExcelImportColumnMapping {
  const mapping: ExcelImportColumnMapping = {};
  const usedHeaders = new Set<string>();
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeaderKey(h) }));

  for (const field of EXCEL_IMPORT_TARGET_FIELDS) {
    const candidates = [normalizeHeaderKey(field.label), ...field.aliases.map(normalizeHeaderKey)];
    const match = normalizedHeaders.find(
      (h) => !usedHeaders.has(h.raw) && candidates.includes(h.norm),
    );
    if (match) {
      mapping[field.key] = match.raw;
      usedHeaders.add(match.raw);
    } else {
      mapping[field.key] = null;
    }
  }
  return mapping;
}

export function requiredFieldsUnmapped(mapping: ExcelImportColumnMapping): ExcelImportFieldKey[] {
  return EXCEL_IMPORT_TARGET_FIELDS.filter((f) => f.required)
    .map((f) => f.key)
    .filter((key) => !mapping[key]);
}

export function applyColumnMapping(
  sheet: ExcelImportRawSheet,
  mapping: ExcelImportColumnMapping,
): ExcelImportMappedRow[] {
  return sheet.rows.map((row) => {
    const values: Partial<Record<ExcelImportFieldKey, string>> = {};
    for (const field of EXCEL_IMPORT_TARGET_FIELDS) {
      const header = mapping[field.key];
      if (!header) continue;
      values[field.key] = cellToString(row.cells[header] ?? "");
    }
    return { rowNumber: row.rowNumber, values };
  });
}

export function normalizeOperationalStatus(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase().replace(/\s+/g, "_");
  if ((VALID_OPERATIONAL_STATUSES as readonly string[]).includes(upper)) return upper;
  const alias = OPERATIONAL_STATUS_ALIASES[normalizeHeaderKey(trimmed)];
  return alias ?? null;
}

export function normalizeDeliveryStatus(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase().replace(/\s+/g, "_");
  if ((VALID_DELIVERY_STATUSES as readonly string[]).includes(lower)) return lower;
  const alias = DELIVERY_STATUS_ALIASES[normalizeHeaderKey(trimmed)];
  return alias ?? null;
}

/**
 * Accepts ISO dates, DD/MM/YYYY, MM/DD/YYYY, Excel serial numbers (as string digits).
 */
export function parseImportDate(raw: string): { ok: true; iso: string } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false };

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return { ok: true, iso: d.toISOString().slice(0, 10) };
  }

  const slash = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (slash) {
    let day = Number(slash[1]);
    let month = Number(slash[2]);
    let y = Number(slash[3]);
    if (y < 100) y += 2000;
    // If first part > 12, treat as DD/MM; if second > 12, treat as MM/DD; else assume DD/MM.
    if (day <= 12 && month > 12) {
      const tmp = day;
      day = month;
      month = tmp;
    }
    const d = new Date(Date.UTC(y, month - 1, day));
    if (
      d.getUTCFullYear() === y &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return { ok: true, iso: d.toISOString().slice(0, 10) };
    }
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    // Excel epoch 1899-12-30
    if (serial > 20000 && serial < 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + Math.round(serial) * 86400000);
      if (!Number.isNaN(d.getTime())) return { ok: true, iso: d.toISOString().slice(0, 10) };
    }
  }

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return { ok: true, iso: fallback.toISOString().slice(0, 10) };
  }
  return { ok: false };
}

export function getTargetFieldDefs() {
  return EXCEL_IMPORT_TARGET_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    required: f.required,
    aliases: [...f.aliases],
  }));
}

export function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function extractEmployeeCode(label: string): string | null {
  const match = label.match(/\(([^)]+)\)/);
  return match ? match[1].trim() : null;
}
