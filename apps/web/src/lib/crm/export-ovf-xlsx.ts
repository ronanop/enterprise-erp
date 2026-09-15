/**
 * OVF Excel export matching the on-screen table view
 * (header fields + Customer Charges + Vendor Charges).
 */
import {
  computeOvfMargins,
  formatChargeRowFileNames,
  normalizeDistributorName,
  sumLineTotals,
  type CustomerChargeRow,
  type VendorChargeRow,
} from "@/components/crm/sales/ovf-order-lines-section";
import { downloadXlsxMatrix, type SpreadsheetCellValue } from "@/lib/spreadsheet";
import type { Opportunity, Ovf, Quote } from "@/services/sales-crm-service";

export type OvfXlsxExportInput = {
  ovf: Ovf;
  quote: Quote | null;
  opportunity: Opportunity | null;
  customerName: string;
  accountName: string;
  quoteName: string;
  ownerName: string;
  billingAddress: string;
  billingState: string;
  billingCountry: string;
  billingContact: string;
  shippingAddress: string;
  shippingState: string;
  shippingCountry: string;
  shippingContact: string;
  customerRows: CustomerChargeRow[];
  vendorRows: VendorChargeRow[];
};

function cell(value: string | number | null | undefined): SpreadsheetCellValue {
  if (value == null || value === "") return "";
  return value;
}

function headerCell(label: string): SpreadsheetCellValue {
  return {
    value: label,
    fontWeight: "bold",
    backgroundColor: "#EEF2F6",
  };
}

function sectionCell(label: string): SpreadsheetCellValue {
  return {
    value: label,
    fontWeight: "bold",
    backgroundColor: "#E2E8F0",
  };
}

function money(value: string | number | null | undefined): SpreadsheetCellValue {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return cell(value == null ? "" : String(value));
  return { value: Number(n.toFixed(2)), type: Number, align: "right" };
}

export function buildOvfXlsxFilename(ovf: Ovf, quoteName?: string | null): string {
  const base = (quoteName || ovf.quote_name || ovf.ovf_no || "OVF")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return `OVF_${base || ovf.ovf_no}.xlsx`;
}

export async function exportOvfXlsx(input: OvfXlsxExportInput): Promise<void> {
  const { ovf, quote, opportunity, customerRows, vendorRows } = input;
  const { totalMarginAmount, totalMarginPct } = computeOvfMargins({
    customerRows,
    vendorRows,
    freight: ovf.freight,
    financeCostPct: ovf.finance_cost_pct,
  });
  const totalSaleValue = sumLineTotals(customerRows);
  const totalPurchaseValue = sumLineTotals(vendorRows);

  const overview: SpreadsheetCellValue[][] = [
    [sectionCell("OVF Module Information"), ""],
    ["OVF Number", cell(ovf.ovf_no)],
    ["Quote Name", cell(input.quoteName)],
    ["Quote No", cell(quote?.quote_no)],
    ["Customer Name", cell(input.customerName)],
    ["Account", cell(input.accountName)],
    ["OVF Module Owner", cell(input.ownerName)],
    ["Opportunity", cell(opportunity?.opportunity_name)],
    ["Approval Status", cell(ovf.approval_status?.replaceAll("_", " "))],
    ["PO Number", cell(ovf.po_number)],
    ["Delivery Period", cell(ovf.delivery_period)],
    ["Installation/Service Details", cell(ovf.installation_details)],
    ["Technology Segment", cell(ovf.technology_segment)],
    ["Sub Technology Segment", cell(ovf.sub_technology_segment)],
    ["Billing Address", cell(input.billingAddress)],
    ["Billing State", cell(input.billingState)],
    ["Billing Country", cell(input.billingCountry)],
    ["Billing Contact", cell(input.billingContact)],
    ["Shipping Address", cell(input.shippingAddress)],
    ["Shipping State", cell(input.shippingState)],
    ["Shipping Country", cell(input.shippingCountry)],
    ["Shipping Contact", cell(input.shippingContact)],
    ["Vendor Payment Days", cell(ovf.vendor_payment_days)],
    ["Customer Payment Days", cell(ovf.customer_payment_days)],
    ["Freight", money(ovf.freight)],
    ["Finance Cost %", money(ovf.finance_cost_pct)],
    ["Additional Charges", money(ovf.additional_charges)],
    ["Total Margin Amount", money(totalMarginAmount)],
    ["Total Margin %", money(totalMarginPct)],
    ["Total Sale Value", money(totalSaleValue)],
    ["Total Purchase Value", money(totalPurchaseValue)],
  ];

  const customerTable: SpreadsheetCellValue[][] = [
    [sectionCell("Customer Charges."), "", "", "", "", "", "", "", ""],
    [
      headerCell("Product Name"),
      headerCell("Description"),
      headerCell("Quantity"),
      headerCell("Unit Amount (₹)"),
      headerCell("Total"),
      headerCell("GST %"),
      headerCell("Total Amount in GST"),
      headerCell("Total Amount with GST"),
      headerCell("PO Files"),
    ],
    ...customerRows.map((row) => [
      cell(row.product_name),
      cell(row.description),
      money(row.qty),
      money(row.unit_price),
      money(row.total),
      money(row.gst_pct),
      money(row.total_gst),
      money(row.total_with_gst),
      cell(formatChargeRowFileNames(row.poFiles)),
    ]),
  ];

  const vendorTable: SpreadsheetCellValue[][] = [
    [sectionCell("Vendor Charges."), "", "", "", "", "", "", "", "", "", "", ""],
    [
      headerCell("Product Name"),
      headerCell("Description"),
      headerCell("Quantity"),
      headerCell("Unit Purchase (₹)"),
      headerCell("Total"),
      headerCell("GST %"),
      headerCell("Total Amount in GST"),
      headerCell("Total Amount with GST"),
      headerCell("Distributor Name"),
      headerCell("Contact Person"),
      headerCell("Contact Number"),
      headerCell("Quote Files"),
    ],
    ...vendorRows.map((row) => [
      cell(row.product_name),
      cell(row.description),
      money(row.qty),
      money(row.unit_price),
      money(row.total),
      money(row.gst_pct),
      money(row.total_gst),
      money(row.total_with_gst),
      cell(normalizeDistributorName(row.vendor_name)),
      cell(row.contact_person),
      cell(row.contact_number),
      cell(formatChargeRowFileNames(row.quoteFiles)),
    ]),
  ];

  await downloadXlsxMatrix(buildOvfXlsxFilename(ovf, input.quoteName), [
    { name: "OVF Overview", data: overview },
    { name: "Customer Charges", data: customerTable },
    { name: "Vendor Charges", data: vendorTable },
  ]);
}
