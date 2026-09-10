/**
 * Maps module resource keys to detail page routes (when a row has `id`).
 * Used by ResourceListView for clickable rows.
 */

export type DetailRoutePattern =
  | { kind: "resource"; resourceKey: string }
  | { kind: "path"; path: string };

const DETAIL_ROUTES: Record<string, Record<string, DetailRoutePattern>> = {
  quality: {
    plans: { kind: "resource", resourceKey: "plans" },
    "sampling-plans": { kind: "resource", resourceKey: "sampling-plans" },
    characteristics: { kind: "resource", resourceKey: "characteristics" },
    "defect-types": { kind: "resource", resourceKey: "defect-types" },
    pfmeas: { kind: "resource", resourceKey: "pfmeas" },
    scores: { kind: "resource", resourceKey: "scores" },
    "incoming-inspections": { kind: "resource", resourceKey: "incoming-inspections" },
    "inprocess-inspections": { kind: "resource", resourceKey: "inprocess-inspections" },
    "final-inspections": { kind: "resource", resourceKey: "final-inspections" },
    "vin-traces": { kind: "resource", resourceKey: "vin-traces" },
    defects: { kind: "resource", resourceKey: "defects" },
    ncrs: { kind: "resource", resourceKey: "ncrs" },
    scars: { kind: "resource", resourceKey: "scars" },
    capas: { kind: "resource", resourceKey: "capas" },
    ppaps: { kind: "resource", resourceKey: "ppaps" },
    complaints: { kind: "resource", resourceKey: "complaints" },
    "warranty-claims": { kind: "resource", resourceKey: "warranty-claims" },
    recalls: { kind: "resource", resourceKey: "recalls" },
    audits: { kind: "resource", resourceKey: "audits" },
    "supplier-quality": { kind: "resource", resourceKey: "supplier-quality" },
  },
  analytics: {
    dashboards: { kind: "resource", resourceKey: "dashboards" },
    reports: { kind: "resource", resourceKey: "reports" },
    kpis: { kind: "resource", resourceKey: "kpis" },
  },
};

export function resolveDetailHref(
  moduleKey: string,
  resourceKey: string,
  rowId: string,
): string | null {
  const mod = DETAIL_ROUTES[moduleKey];
  if (!mod) return null;
  const pattern = mod[resourceKey];
  if (!pattern) return null;
  if (pattern.kind === "path") return `${pattern.path}/${rowId}`;
  return `/${moduleKey}/${pattern.resourceKey}/${rowId}`;
}

export function resourceKeyFromApiPath(moduleKey: string, apiPath: string): string | null {
  const suffix = apiPath.replace(/^\//, "");
  const parts = suffix.split("/");
  if (parts[0] !== moduleKey) return null;
  return parts.slice(1).join("/") || null;
}
