/**
 * Projects PO Queue handoffs from Procurement → Installation → Share to PO Queue.
 * SCM / customer POs appear in Projects PO Queue only after that share —
 * not after vendor PO create, and not when Delivery Status is marked Delivered.
 */

import {
  deriveDeliveryStatusLabel,
  isDeliveredShipmentStatus,
  listDeliveryStatuses,
} from "@/utils/delivery-status-storage";
import { getDeliveryChallan } from "@/utils/delivery-challan-storage";

export type ProjectPoQueueHandoff = {
  orderId: string;
  challanId: string;
  sharedAt: string;
  projectName: string;
  circleName: string;
  siteName: string;
  contactPerson: string;
  contactNumber: string;
  rackQuantity: string;
  serverType: string;
  remarks: string;
  /** Snapshot for queue display when API list excludes SCM POs. */
  companyPoNumber: string | null;
  documentNumber: string;
  documentDate: string;
  customerName: string | null;
  customerPoNumber: string | null;
  vendorId: string;
  totalAmount: number;
  customerTotal: number;
  status: string;
  ovfId: string | null;
  branchId: string;
  companyId: string;
};

export type DeliveredPoQueueCandidate = {
  orderId: string;
  challanId: string;
  deliveredAt: string;
  customerPoNumber: string | null;
  customerName: string | null;
  companyPoNumber: string | null;
};

const STORAGE_KEY = "erp.projects.po-queue-handoffs";

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function normalize(raw: Partial<ProjectPoQueueHandoff> & { orderId: string }): ProjectPoQueueHandoff {
  return {
    orderId: asText(raw.orderId).trim(),
    challanId: asText(raw.challanId).trim(),
    sharedAt: asText(raw.sharedAt).trim() || new Date().toISOString(),
    projectName: asText(raw.projectName).trim(),
    circleName: asText(raw.circleName).trim(),
    siteName: asText(raw.siteName).trim(),
    contactPerson: asText(raw.contactPerson).trim(),
    contactNumber: asText(raw.contactNumber).trim(),
    rackQuantity: asText(raw.rackQuantity).trim(),
    serverType: asText(raw.serverType).trim(),
    remarks: asText(raw.remarks).trim(),
    companyPoNumber: asText(raw.companyPoNumber).trim() || null,
    documentNumber: asText(raw.documentNumber).trim() || "PO",
    documentDate: asText(raw.documentDate).trim() || new Date().toISOString().slice(0, 10),
    customerName: asText(raw.customerName).trim() || null,
    customerPoNumber: asText(raw.customerPoNumber).trim() || null,
    vendorId: asText(raw.vendorId).trim(),
    totalAmount: Number(raw.totalAmount) || 0,
    customerTotal: Number(raw.customerTotal) || 0,
    status: asText(raw.status).trim() || "sent",
    ovfId: asText(raw.ovfId).trim() || null,
    branchId: asText(raw.branchId).trim(),
    companyId: asText(raw.companyId).trim(),
  };
}

function readAll(): ProjectPoQueueHandoff[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        try {
          const item = row as Partial<ProjectPoQueueHandoff>;
          if (!item?.orderId) return null;
          return normalize(item as ProjectPoQueueHandoff);
        } catch {
          return null;
        }
      })
      .filter((row): row is ProjectPoQueueHandoff => row != null);
  } catch {
    return [];
  }
}

function writeAll(rows: ProjectPoQueueHandoff[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function listProjectPoQueueHandoffs(): ProjectPoQueueHandoff[] {
  return readAll().sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
}

export function getProjectPoQueueHandoff(orderId: string): ProjectPoQueueHandoff | null {
  const id = orderId.trim();
  if (!id) return null;
  return readAll().find((row) => row.orderId === id) ?? null;
}

export function hasProjectPoQueueHandoff(orderId: string): boolean {
  return getProjectPoQueueHandoff(orderId) != null;
}

export function enqueueProjectPoQueueHandoff(
  input: Omit<ProjectPoQueueHandoff, "sharedAt"> & { sharedAt?: string },
): ProjectPoQueueHandoff {
  const next = normalize({
    ...input,
    sharedAt: input.sharedAt || new Date().toISOString(),
  });
  const rows = readAll().filter((row) => row.orderId !== next.orderId);
  rows.unshift(next);
  writeAll(rows);
  return next;
}

export function removeProjectPoQueueHandoff(orderId: string): void {
  const id = orderId.trim();
  if (!id) return;
  writeAll(readAll().filter((row) => row.orderId !== id));
}

/**
 * Purchase orders whose SCM delivery status is Delivered (local delivery-status store).
 * These are the only SCM POs eligible for the Projects PO Queue.
 */
export function listDeliveredPoQueueCandidates(): DeliveredPoQueueCandidate[] {
  if (typeof window === "undefined") return [];

  const byOrder = new Map<string, DeliveredPoQueueCandidate>();

  for (const status of listDeliveryStatuses()) {
    const label = deriveDeliveryStatusLabel(status);
    if (!isDeliveredShipmentStatus(label) && !isDeliveredShipmentStatus(status.shipmentStatus)) {
      continue;
    }
    const challan = getDeliveryChallan(status.challanId);
    const orderId = (status.orderId || challan?.orderId || "").trim();
    if (!orderId) continue;

    const deliveredAt =
      (status.actualDeliveryDate || "").trim() ||
      status.updatedAt ||
      new Date().toISOString();
    const existing = byOrder.get(orderId);
    if (existing && existing.deliveredAt.localeCompare(deliveredAt) >= 0) {
      continue;
    }
    byOrder.set(orderId, {
      orderId,
      challanId: status.challanId,
      deliveredAt,
      customerPoNumber:
        (status.customerPoNumber || "").trim() ||
        (challan?.purchaseOrderNumber || "").trim() ||
        null,
      customerName:
        (status.customerName || "").trim() ||
        (challan?.customerName || "").trim() ||
        null,
      companyPoNumber:
        (status.cachePoNumber || "").trim() ||
        (challan?.companyPoNumber || "").trim() ||
        null,
    });
  }

  return [...byOrder.values()].sort((a, b) => b.deliveredAt.localeCompare(a.deliveredAt));
}
