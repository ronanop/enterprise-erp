import type { QualityRow } from "@/services/quality-service";

export type InspectionKind = "incoming" | "inprocess" | "final";

export function inspectionListHref(kind: InspectionKind): string {
  if (kind === "incoming") return "/quality/incoming-inspections";
  if (kind === "inprocess") return "/quality/inprocess-inspections";
  return "/quality/final-inspections";
}

export function inspectionDetailHref(kind: InspectionKind, id: string): string {
  return `${inspectionListHref(kind)}/${id}`;
}

export type TaggedInspection = QualityRow & { _inspectionKind: InspectionKind };

export function tagInspections(
  rows: QualityRow[],
  kind: InspectionKind,
): TaggedInspection[] {
  return rows.map((row) => ({ ...row, _inspectionKind: kind }));
}

export function inspectionHrefFromRow(row: QualityRow): string | null {
  const id = row.id != null ? String(row.id) : null;
  if (!id) return null;
  const kind = (row as TaggedInspection)._inspectionKind;
  if (kind) return inspectionDetailHref(kind, id);
  return null;
}

export function qualityDetailHref(resourceKey: string, id: string): string {
  return `/quality/${resourceKey}/${id}`;
}

/** Resolve a detail page from quality report row data. */
export function reportRowHref(reportName: string, row: Record<string, unknown>): string | null {
  if (reportName === "inspection-summary") {
    const id = row.id != null ? String(row.id) : null;
    const type = String(row.type ?? "");
    if (!id) return null;
    if (type === "incoming") return `/quality/incoming-inspections/${id}`;
    if (type === "inprocess") return `/quality/inprocess-inspections/${id}`;
    if (type === "final") return `/quality/final-inspections/${id}`;
    return null;
  }
  if (reportName === "defect-summary") {
    const id = row.defect_id != null ? String(row.defect_id) : row.id != null ? String(row.id) : null;
    return id ? `/quality/defects/${id}` : null;
  }
  if (reportName === "ncr-summary") {
    const id = row.ncr_id != null ? String(row.ncr_id) : row.id != null ? String(row.id) : null;
    return id ? `/quality/ncrs/${id}` : null;
  }
  if (reportName === "capa-summary") {
    const id = row.capa_id != null ? String(row.capa_id) : row.id != null ? String(row.id) : null;
    return id ? `/quality/capas/${id}` : null;
  }
  if (reportName === "scar-summary") {
    const id = row.scar_id != null ? String(row.scar_id) : row.id != null ? String(row.id) : null;
    return id ? `/quality/scars/${id}` : null;
  }
  if (reportName === "spc-capability-summary") {
    const id = row.characteristic_id != null ? String(row.characteristic_id) : null;
    return id ? `/quality/characteristics/${id}` : null;
  }
  return null;
}
