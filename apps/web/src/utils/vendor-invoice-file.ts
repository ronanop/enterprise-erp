/** File picker hint — PDF, photos, Excel, and common document types. */
export const VENDOR_INVOICE_FILE_ACCEPT =
  "image/*,.pdf,.xlsx,.xls,.xlsm,.csv,.txt,.doc,.docx,.heic,.heif,.gif,.bmp,.tif,.tiff,.webp,.jpeg,.jpg,.png,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const MAX_VENDOR_INVOICE_BYTES = 12 * 1024 * 1024;

export function validateVendorInvoiceFile(file: File): string | null {
  if (!file.size) {
    return "Invoice file is empty.";
  }
  if (file.size > MAX_VENDOR_INVOICE_BYTES) {
    return "Invoice file is too large (max 12 MB).";
  }
  return null;
}
