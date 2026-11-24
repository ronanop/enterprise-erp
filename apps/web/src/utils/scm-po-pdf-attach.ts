import {
  getPurchaseOrder,
  listVendorOptions,
  type VendorOption,
} from "@/services/procurement-service";
import { buildOrderPdfBase64 } from "@/utils/purchase-order-pdf";

function resolveVendor(
  vendors: VendorOption[],
  vendorId: string | null | undefined,
  fallbackName?: string | null,
): { name: string; address: string; gstin: string } {
  const option = vendorId
    ? vendors.find((v) => String(v.id) === String(vendorId))
    : undefined;
  return {
    name: option?.label || fallbackName?.trim() || "Vendor",
    address: option?.address || "",
    gstin:
      option?.addressEntries?.[0]?.gstNumber?.trim() ||
      option?.taxNumber?.trim() ||
      "",
  };
}

/** Build PO print PDF for approval / vendor emails. */
export async function buildScmPoPrintPdfAttachment(
  orderId: string,
  options?: { watermark?: boolean },
): Promise<{ filename: string; base64: string } | null> {
  try {
    const [order, vendors] = await Promise.all([
      getPurchaseOrder(orderId),
      listVendorOptions().catch(() => [] as VendorOption[]),
    ]);
    const vendor = resolveVendor(vendors, order.vendor_id);
    // Default: DRAFT watermark only while still a draft. Issued / vendor mail
    // callers must pass watermark: false so leftover draft prints are not reused.
    const watermark =
      options?.watermark ??
      (order.status || "").toLowerCase() === "draft";
    return await buildOrderPdfBase64(order, vendor, { watermark });
  } catch {
    return null;
  }
}
