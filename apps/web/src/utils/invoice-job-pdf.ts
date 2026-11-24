import {
  getPurchaseOrder,
  listOrderReceiptBatches,
  listVendorOptions,
  type VendorOption,
} from "@/services/procurement-service";
import {
  downloadBatchGrnPdf,
  type GrnReceiptPdfContext,
} from "@/utils/grn-batch-pdf-download";
import { downloadOrderPdf } from "@/utils/purchase-order-pdf";

function vendorAddressLines(vendor?: VendorOption): string[] {
  const entry = vendor?.addressEntries?.[0];
  const raw = entry?.address || vendor?.address || "";
  if (raw.includes("\n")) {
    return raw
      .split(/\r?\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return raw.trim() ? [raw.trim()] : [];
}

function resolveVendor(
  vendors: VendorOption[],
  vendorId: string | null | undefined,
  fallbackName?: string | null,
): { name: string; address: string; option?: VendorOption } {
  const option = vendorId
    ? vendors.find((v) => String(v.id) === String(vendorId))
    : undefined;
  return {
    name: option?.label || fallbackName?.trim() || "Vendor",
    address: option?.address || "",
    option,
  };
}

/** Download the PO print PDF for an invoice-generation / approval job's order. */
export async function downloadInvoiceJobPoPdf(
  orderId: string,
  options?: { watermark?: boolean },
): Promise<void> {
  const [order, vendors] = await Promise.all([
    getPurchaseOrder(orderId),
    listVendorOptions().catch(() => [] as VendorOption[]),
  ]);
  const vendor = resolveVendor(vendors, order.vendor_id);
  const status = (order.status || "").toLowerCase();
  const approvalStage = (order.scm_approval_stage || "").toLowerCase();
  // Admin / management approval reviews must see Draft PO + watermark until issued.
  const inApproval =
    approvalStage === "accept_po" ||
    approvalStage === "management" ||
    status === "draft" ||
    status === "submitted";
  const watermark = options?.watermark ?? inApproval;
  await downloadOrderPdf(
    order,
    {
      name: vendor.name,
      address: vendor.address,
      gstin:
        vendor.option?.addressEntries?.[0]?.gstNumber?.trim() ||
        vendor.option?.taxNumber?.trim() ||
        "",
    },
    undefined,
    { watermark },
  );
}

/** Download the GRN copy PDF for an invoice-generation job's receipt batch. */
export async function downloadInvoiceJobGrnPdf(
  orderId: string,
  receiptBatchId: string,
): Promise<void> {
  const [order, batches, vendors] = await Promise.all([
    getPurchaseOrder(orderId),
    listOrderReceiptBatches(orderId),
    listVendorOptions().catch(() => [] as VendorOption[]),
  ]);
  const batch = batches.find((b) => String(b.id) === String(receiptBatchId));
  if (!batch) {
    throw new Error("GRN receipt batch not found for this job.");
  }
  const vendor = resolveVendor(vendors, order.vendor_id);
  const entry = vendor.option?.addressEntries?.[0];
  const pdfContext: GrnReceiptPdfContext = {
    poNumber: order.document_number,
    documentDate: order.document_date,
    vendorName: vendor.name,
    vendorAddressLines: vendorAddressLines(vendor.option),
    vendorGstNumber: entry?.gstNumber || vendor.option?.taxNumber,
  };
  await downloadBatchGrnPdf(batch, pdfContext);
}
