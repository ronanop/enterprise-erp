import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import type {
  AssetDetailDrawerConfigParts,
  AssetDetailDrawerData,
  AssetDetailDrawerTimelineEvent,
  InventoryAssetRef,
} from "@/components/assets/inventory/interaction/inventory-interaction.types";
import { assetNavigationPaths } from "@/components/assets/navigation/asset-navigation";

export function inventoryRowToAssetRef(row: InventoryRowViewModel): InventoryAssetRef {
  return {
    id: row.id,
    assetTag: row.assetTag,
    laptopName: row.laptopName,
    operationalStatus: row.operationalStatus,
  };
}

/** Best-effort parse of configuration summary strings (e.g. "i7 · 16GB · Windows"). */
export function parseConfigurationParts(configuration: string): AssetDetailDrawerConfigParts {
  const empty = { cpu: "—", ram: "—", storage: "—", os: "—", accessories: "—" };
  if (!configuration || configuration === "—") return empty;

  const parts = configuration
    .split(/[·|,]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const result = { ...empty };
  const unused: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (result.ram === "—" && /\b\d+\s*gb\b/i.test(part) && !/ssd|hdd|nvme|storage/i.test(lower)) {
      result.ram = part;
    } else if (
      result.storage === "—" &&
      ((/\b\d+\s*(gb|tb)\b/i.test(part) && /ssd|hdd|nvme|storage/i.test(lower)) ||
        /ssd|hdd|nvme/i.test(lower))
    ) {
      result.storage = part;
    } else if (
      result.os === "—" &&
      /windows|macos|mac os|linux|ubuntu|chrome ?os|ios|android/i.test(lower)
    ) {
      result.os = part;
    } else if (
      result.cpu === "—" &&
      (/i\d|ryzen|xeon|core|apple m\d|cpu|intel|amd/i.test(lower) || parts.indexOf(part) === 0)
    ) {
      result.cpu = part;
    } else {
      unused.push(part);
    }
  }

  if (unused.length) {
    result.accessories = unused.join(" · ");
  }

  return result;
}

export function buildDrawerTimeline(
  row: InventoryRowViewModel,
): AssetDetailDrawerTimelineEvent[] {
  const events: AssetDetailDrawerTimelineEvent[] = [];

  events.push({
    id: "registered",
    label: "Registered",
    at: "—",
    kind: "milestone",
  });

  const ops = row.operationalStatus.toUpperCase();
  if (ops === "READY_TO_MOVE" || ops === "ASSIGNED" || ops === "PENDING_DISPOSAL" || ops === "DISPOSED") {
    events.push({
      id: "ready",
      label: "Ready",
      at: "—",
      kind: "status",
    });
  }

  for (const entry of row.assignmentHistory) {
    if (entry.allocatedAt && entry.allocatedAt !== "—") {
      events.push({
        id: `assigned-${entry.id}`,
        label: "Assigned",
        at: entry.allocatedAt,
        kind: "assigned",
      });
    }
    if (entry.returnedAt && entry.returnedAt !== "—") {
      events.push({
        id: `returned-${entry.id}`,
        label: "Returned",
        at: entry.returnedAt,
        kind: "returned",
      });
    }
  }

  if (ops === "PENDING_DISPOSAL") {
    events.push({
      id: "pending-disposal",
      label: "Pending Disposal",
      at: "—",
      kind: "status",
    });
  }
  if (ops === "DISPOSED" || row.lifecycleStatus.toLowerCase() === "disposed") {
    events.push({
      id: "disposed",
      label: "Disposed",
      at: "—",
      kind: "status",
    });
  }
  if (ops === "RETIRED" || row.lifecycleStatus.toLowerCase() === "retired") {
    events.push({
      id: "retired",
      label: "Retired",
      at: "—",
      kind: "status",
    });
  }

  return events;
}

export function mapInventoryRowToDrawerData(row: InventoryRowViewModel): AssetDetailDrawerData {
  const qrPath = assetNavigationPaths.informationPortal(row.id);
  const qrValue =
    typeof window !== "undefined" ? `${window.location.origin}${qrPath}` : qrPath;

  return {
    assetTag: row.assetTag,
    laptopName: row.laptopName,
    manufacturer: row.manufacturer,
    model: row.model,
    currentHolder: row.currentHolder,
    department: row.department,
    employeeId: row.employeeId,
    location: row.location,
    configuration: row.configuration,
    configurationParts: parseConfigurationParts(row.configuration),
    branch: row.branch,
    operationalStatus: row.operationalStatus,
    lifecycleStatus: row.lifecycleStatus,
    qrValue,
    assignment: {
      employee: row.currentHolder,
      issueDate: row.issueDate,
      department: row.department,
      deliveryReferenceNumber: row.expandable.deliveryChallan,
      deliveryReferenceStatus: row.expandable.deliveryReferenceStatus,
      assignmentRemarks: row.expandable.assignmentRemarks,
      returnRemarks: row.expandable.returnRemarks,
    },
    additional: {
      earlierUsedBy: row.expandable.earlierUsedBy,
      deliveryChallan: row.expandable.deliveryChallan,
      deliveryReferenceStatus: row.expandable.deliveryReferenceStatus,
      remarks: row.expandable.assignmentRemarks,
      assignmentRemarks: row.expandable.assignmentRemarks,
      returnRemarks: row.expandable.returnRemarks,
    },
    history: row.assignmentHistory,
    timeline: buildDrawerTimeline(row),
  };
}
