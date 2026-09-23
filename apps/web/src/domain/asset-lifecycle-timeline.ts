import type { PortalTimelineEvent, PortalTimelineKind } from "@/components/assets/portal/portal-lifecycle-timeline";
import type { AssetsRow } from "@/services/assets-service";

export type AssetLifecycleTimelineApiEvent = {
  id: string;
  kind: string;
  stage: string;
  title: string;
  detail?: string | null;
  occurred_at?: string | null;
  actor_label?: string | null;
  reference_id?: string | null;
  reference_label?: string | null;
};

export type AssignmentHistoryLike = {
  id: string;
  documentNumber: string;
  status: string;
  assigneeLabel: string;
  allocatedAt: string;
  returnedAt: string;
  allocatedAtRaw?: string | null;
  returnedAtRaw?: string | null;
  deliveryChallanSummary?: string;
  assignmentRemarks?: string;
  returnRemarks?: string;
};

function dash(value?: string | null): string {
  return value && String(value).trim() && String(value).trim() !== "—"
    ? String(value).trim()
    : "—";
}

function asIso(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString();
}

export function mapApiLifecycleEvents(
  events: AssetLifecycleTimelineApiEvent[],
): PortalTimelineEvent[] {
  return events.map((ev) => ({
    id: ev.id,
    kind: (ev.kind as PortalTimelineKind) || "other",
    stage: ev.stage || "Activity",
    title: ev.title,
    detail: ev.detail,
    occurredAt: ev.occurred_at ?? null,
    actorLabel: ev.actor_label ?? null,
    referenceLabel: ev.reference_label ?? null,
  }));
}

/** Assignment History tab — one card per custody cycle with assign + return clarity. */
export function buildAssignmentTimeline(
  entries: AssignmentHistoryLike[],
): PortalTimelineEvent[] {
  return entries.map((row) => {
    const status = String(row.status || "").toLowerCase();
    const isReturned = status === "returned" || (row.returnedAt && row.returnedAt !== "—");
    const kind: PortalTimelineKind = isReturned ? "returned" : "assigned";
    const stage = isReturned ? "Returned" : "Assigned";
    const title = isReturned
      ? `Previously used by ${dash(row.assigneeLabel)}`
      : `Assigned to ${dash(row.assigneeLabel)}`;
    const occurredRaw = isReturned
      ? row.returnedAtRaw || row.allocatedAtRaw
      : row.allocatedAtRaw;
    return {
      id: `asn-cycle-${row.id}`,
      kind,
      stage,
      title,
      detail: undefined,
      occurredAt: asIso(occurredRaw) ?? null,
      actorLabel: row.assigneeLabel,
      referenceLabel: row.documentNumber !== "—" ? row.documentNumber : null,
      meta: [
        { label: "User", value: dash(row.assigneeLabel) },
        { label: "Assigned", value: dash(row.allocatedAt) },
        { label: "De-assigned", value: dash(row.returnedAt) },
        { label: "Status", value: dash(row.status) },
        ...(row.deliveryChallanSummary && row.deliveryChallanSummary !== "—"
          ? [{ label: "Delivery", value: row.deliveryChallanSummary }]
          : []),
        ...(row.assignmentRemarks && row.assignmentRemarks !== "—"
          ? [{ label: "Assignment remarks", value: row.assignmentRemarks }]
          : []),
        ...(row.returnRemarks && row.returnRemarks !== "—"
          ? [{ label: "Return remarks", value: row.returnRemarks }]
          : []),
      ],
    };
  });
}

/** Maintenance History tab — cycle cards with start/complete dates. */
export function buildMaintenanceTimeline(
  rows: AssetsRow[],
): Array<PortalTimelineEvent & { maintenanceId: string }> {
  return [...rows]
    .filter((row) => String(row.status ?? "").toLowerCase() !== "draft")
    .sort((a, b) => {
      const aAt = String(a.completed_date ?? a.scheduled_date ?? a.created_at ?? a.updated_at ?? "");
      const bAt = String(b.completed_date ?? b.scheduled_date ?? b.created_at ?? b.updated_at ?? "");
      return bAt.localeCompare(aAt);
    })
    .map((row) => {
      const id = String(row.id ?? "");
      const status = String(row.status ?? "").toLowerCase();
      const completed = status === "completed";
      const cancelled = status === "cancelled" || status === "canceled";
      const kind: PortalTimelineKind = cancelled
        ? "other"
        : completed
          ? "maintenance_completed"
          : "maintenance_started";
      const stage = cancelled
        ? "Cancelled"
        : completed
          ? "Completed"
          : status === "in_progress"
            ? "In progress"
            : "Maintenance";
      const title = cancelled
        ? "Maintenance cancelled"
        : completed
          ? "Maintenance cycle completed"
          : "Entered maintenance";
      const started =
        asIso(row.created_at) ?? asIso(row.scheduled_date) ?? asIso(row.updated_at);
      const finished = asIso(row.completed_date) ?? (completed ? asIso(row.updated_at) : null);
      return {
        id: `maint-cycle-${id}`,
        maintenanceId: id,
        kind,
        stage,
        title,
        detail: row.reason != null ? String(row.reason) : null,
        occurredAt: finished ?? started,
        referenceLabel:
          row.document_number != null ? String(row.document_number) : null,
        meta: [
          { label: "Entered maintenance", value: started ? formatLocal(started) : "—" },
          { label: "Completed", value: finished ? formatLocal(finished) : "—" },
          {
            label: "Type",
            value: row.maintenance_type != null ? String(row.maintenance_type) : "—",
          },
          { label: "Status", value: status ? status.replace(/_/g, " ") : "—" },
        ],
      };
    });
}

function formatLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** Client fallback when lifecycle API is unavailable. */
export function buildClientLifecycleTimeline(input: {
  assetId: string;
  assetCode?: string | null;
  assetName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  assignments: AssignmentHistoryLike[];
  maintenances: AssetsRow[];
}): PortalTimelineEvent[] {
  const events: PortalTimelineEvent[] = [];
  if (input.createdAt) {
    events.push({
      id: `asset-created-${input.assetId}`,
      kind: "created",
      stage: "Created",
      title: "Asset added to register",
      detail: [input.assetCode, input.assetName].filter(Boolean).join(" — ") || null,
      occurredAt: asIso(input.createdAt),
      referenceLabel: input.assetCode ?? null,
    });
  }
  for (const asn of buildAssignmentTimeline(input.assignments)) {
    events.push(asn);
    // Also emit explicit assign milestone when both dates exist.
    if (asn.meta) {
      const assigned = asn.meta.find((m) => m.label === "Assigned")?.value;
      const returned = asn.meta.find((m) => m.label === "De-assigned")?.value;
      if (assigned && assigned !== "—" && asn.kind === "returned") {
        events.push({
          id: `${asn.id}-assigned`,
          kind: "assigned",
          stage: "Assigned",
          title: `Assigned to ${asn.actorLabel ?? "user"}`,
          occurredAt: asIso(assigned),
          actorLabel: asn.actorLabel,
          referenceLabel: asn.referenceLabel,
        });
      }
      if (returned && returned !== "—") {
        // already represented by returned card
      }
    }
  }
  for (const m of buildMaintenanceTimeline(input.maintenances)) {
    const { maintenanceId: _id, ...rest } = m;
    void _id;
    events.push(rest);
    const entered = m.meta?.find((x) => x.label === "Entered maintenance")?.value;
    if (m.kind === "maintenance_completed" && entered && entered !== "—") {
      events.push({
        id: `${m.id}-start`,
        kind: "maintenance_started",
        stage: "Maintenance started",
        title: "Entered maintenance",
        detail: m.detail,
        occurredAt: asIso(entered),
        referenceLabel: m.referenceLabel,
      });
    }
  }
  if (input.updatedAt && input.updatedAt !== input.createdAt) {
    events.push({
      id: `asset-updated-${input.assetId}`,
      kind: "updated",
      stage: "Updated",
      title: "Asset record last updated",
      occurredAt: asIso(input.updatedAt),
      referenceLabel: input.assetCode ?? null,
    });
  }
  return events.sort((a, b) =>
    String(b.occurredAt ?? "").localeCompare(String(a.occurredAt ?? "")),
  );
}
