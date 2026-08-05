import type { ScmReceiptBatch } from "@/services/procurement-service";
import { downloadGoodsReceiptPdf } from "@/utils/goods-receipt-pdf";

export type GrnReceiptPdfContext = {
  poNumber: string;
  documentDate: string;
  vendorName?: string;
  vendorAddressLines: string[];
  vendorGstNumber?: string;
};

export async function downloadBatchGrnPdf(
  batch: ScmReceiptBatch,
  pdfContext: GrnReceiptPdfContext,
): Promise<void> {
  const lines = (batch.lines || [])
    .filter((ln) => Number(ln.quantity) > 0)
    .map((ln) => ({
      lineNo: ln.line_number,
      description: ln.product_name || `Line ${ln.line_number}`,
      qtyReceived: Number(ln.quantity) || 0,
    }));
  if (lines.length === 0) {
    throw new Error("No received lines in this GRN to print.");
  }
  const grnNumber = batch.grn_number.trim();
  const grnDate = batch.receipt_at?.trim() || pdfContext.documentDate;
  await downloadGoodsReceiptPdf(
    {
      grnNumber,
      grnDate,
      poNumber: pdfContext.poNumber,
      vendorName: pdfContext.vendorName,
      vendorAddressLines: pdfContext.vendorAddressLines,
      vendorGstNumber: pdfContext.vendorGstNumber,
      lines,
    },
    `GRN-${grnNumber.replace(/\//g, "-")}.pdf`,
  );
}
