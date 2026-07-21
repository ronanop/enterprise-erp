import { ApiClientError, resourceService } from "@/services/api-client";

export type EcommerceRow = Record<string, unknown>;

export type EcommerceOverview = {
  stores: EcommerceRow[];
  channels: EcommerceRow[];
  listings: EcommerceRow[];
  carts: EcommerceRow[];
  orders: EcommerceRow[];
  payments: EcommerceRow[];
  shipments: EcommerceRow[];
  returns: EcommerceRow[];
  coupons: EcommerceRow[];
  promotions: EcommerceRow[];
  marketplaceConnectors: EcommerceRow[];
  errors: string[];
  statusCodes: number[];
  partial: boolean;
};

function normalizeRows(data: unknown): EcommerceRow[] {
  if (Array.isArray(data)) {
    return data.filter(
      (row): row is EcommerceRow => !!row && typeof row === "object",
    );
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return normalizeRows(obj.rows);
    for (const key of ["items", "results", "records", "data", "lines"]) {
      if (Array.isArray(obj[key])) return normalizeRows(obj[key]);
    }
    return [obj];
  }
  return [];
}

async function safeList(
  apiPath: string,
): Promise<{ rows: EcommerceRow[]; error?: string; status?: number }> {
  try {
    const response = await resourceService.list(apiPath);
    return { rows: normalizeRows(response.data) };
  } catch (err) {
    if (err instanceof ApiClientError) {
      return { rows: [], error: err.message, status: err.status };
    }
    return { rows: [], error: `Failed to load ${apiPath}`, status: 500 };
  }
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function asStatus(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function countByStatus(
  rows: EcommerceRow[],
  statuses: string[],
): number {
  const set = new Set(statuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => set.has(asStatus(row.status))).length;
}

export function countOpenDocs(
  rows: EcommerceRow[],
  closedStatuses: string[],
): number {
  const closed = new Set(closedStatuses.map((s) => s.toLowerCase()));
  return rows.filter((row) => {
    const status = asStatus(row.status);
    if (!status) return true;
    return !closed.has(status);
  }).length;
}

export async function loadEcommerceOverview(): Promise<EcommerceOverview> {
  const [
    stores,
    channels,
    listings,
    carts,
    orders,
    payments,
    shipments,
    returns,
    coupons,
    promotions,
    marketplaceConnectors,
  ] = await Promise.all([
    safeList("/ecommerce/stores"),
    safeList("/ecommerce/sales-channels"),
    safeList("/ecommerce/product-listings"),
    safeList("/ecommerce/customer-carts"),
    safeList("/ecommerce/orders"),
    safeList("/ecommerce/payments"),
    safeList("/ecommerce/shipments"),
    safeList("/ecommerce/return-requests"),
    safeList("/ecommerce/coupons"),
    safeList("/ecommerce/promotions"),
    safeList("/ecommerce/marketplace-connectors"),
  ]);

  const results = [
    stores,
    channels,
    listings,
    carts,
    orders,
    payments,
    shipments,
    returns,
    coupons,
    promotions,
    marketplaceConnectors,
  ];
  const errors = results.map((r) => r.error).filter((e): e is string => Boolean(e));
  const statusCodes = results
    .map((r) => r.status)
    .filter((s): s is number => typeof s === "number");

  return {
    stores: stores.rows,
    channels: channels.rows,
    listings: listings.rows,
    carts: carts.rows,
    orders: orders.rows,
    payments: payments.rows,
    shipments: shipments.rows,
    returns: returns.rows,
    coupons: coupons.rows,
    promotions: promotions.rows,
    marketplaceConnectors: marketplaceConnectors.rows,
    errors,
    statusCodes,
    partial: errors.length > 0,
  };
}
