import { jsPDF } from "jspdf";

import { loadCacheLogo } from "@/utils/load-cache-logo";
import { dash, formatPoDate } from "@/utils/purchase-order-amount-words";

export type GoodsReceiptPdfInput = {
  grnNumber: string;
  grnDate: string;
  poNumber?: string;
  vendorName?: string;
  vendorAddressLines?: string[];
  vendorGstNumber?: string;
  status?: string;
  companyName?: string;
  companyAddressLines?: string[];
  companyPhone?: string;
  lines: Array<{
    lineNo: number;
    description: string;
    qtyReceived: number;
    qtyRejected?: number;
    status?: string;
    billing?: boolean;
    billingQuantity?: number;
  }>;
};

const DEFAULT_COMPANY = {
  name: "CACHE DIGITECH PVT LTD",
  addressLines: [
    "L-31, Kailash Colony,",
    "New Delhi,",
    "Delhi-110048,",
    "India",
  ],
  phone: "011-47105700-25",
} as const;

function wrapAddressLines(
  doc: jsPDF,
  lines: string[],
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = doc.splitTextToSize(trimmed, maxWidth) as string[];
    out.push(...parts);
  }
  return out;
}

/**
 * GRN copy PDF — logo + company address left; vendor address to the right.
 */
export async function downloadGoodsReceiptPdf(
  input: GoodsReceiptPdfInput,
  fileName?: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const rightEdge = pageW - margin;
  const leftColW = contentW * 0.42;
  const rightColW = contentW * 0.42;
  let y = margin;

  const companyName = (input.companyName || DEFAULT_COMPANY.name).trim();
  const companyAddressLines = input.companyAddressLines?.length
    ? input.companyAddressLines
    : [...DEFAULT_COMPANY.addressLines];
  const phone = (input.companyPhone || DEFAULT_COMPANY.phone).trim();
  const vendorName = (input.vendorName || "").trim();
  const vendorAddressLines = input.vendorAddressLines || [];
  const vendorGst = (input.vendorGstNumber || "").trim();

  // —— Logo (left) + title (right) ——
  const logo = await loadCacheLogo();
  const logoW = 42;
  let logoH = 16;
  if (logo) {
    logoH = (logo.height / logo.width) * logoW;
    doc.addImage(logo.dataUrl, "JPEG", margin, y, logoW, logoH);
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("GRN copy", rightEdge, y + logoH / 2 + 2, { align: "right" });
  y += logoH + 14;

  const grnHeader = dash(input.grnNumber);

  // —— Company (left under logo) | Vendor (right side) ——
  const leftX = margin;

  const companyBody = wrapAddressLines(
    doc,
    [companyName, ...companyAddressLines, phone ? `Tel: ${phone}` : ""],
    leftColW,
  );
  const vendorBody = wrapAddressLines(
    doc,
    [
      vendorName || "—",
      ...vendorAddressLines,
      vendorGst ? `GST: ${vendorGst}` : "",
    ],
    rightColW,
  );

  const bodyStart = y;
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  let ly = bodyStart;
  companyBody.forEach((line, i) => {
    if (i === 0) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.text(line, leftX, ly);
    ly += 3.8;
  });

  let ry = bodyStart;
  vendorBody.forEach((line, i) => {
    if (i === 0) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.text(line, rightEdge, ry, { align: "right" });
    ry += 3.8;
  });

  y = Math.max(ly, ry) + 4;

  // Divider under header
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, rightEdge, y);
  y += 8;

  // —— Items table: S No. | ITEM | RECEIVED QTY | BILLING ——
  const cols = [16, contentW - 16 - 32 - 28, 32, 28];
  const headers = ["S No.", "ITEM", "RECEIVED QTY", "BILLING"];
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(180, 180, 180);
  doc.rect(margin, y, contentW, 9, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  let x = margin;
  headers.forEach((h, i) => {
    const align = i === 0 || i === 3 ? "center" : i === 2 ? "right" : "left";
    const tx =
      align === "center"
        ? x + cols[i] / 2
        : align === "right"
          ? x + cols[i] - 3
          : x + 3;
    doc.text(h, tx, y + 6, { align: align as "left" | "center" | "right" });
    x += cols[i];
  });
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const rows = input.lines.length
    ? input.lines
    : [{ lineNo: 0, description: "No lines", qtyReceived: 0 }];

  for (const ln of rows) {
    const desc = doc.splitTextToSize(dash(ln.description), cols[1] - 6) as string[];
    const h = Math.max(10, desc.length * 4.2 + 5);
    if (y + h > 270) {
      doc.addPage();
      y = margin;
    }
    doc.setDrawColor(180, 180, 180);
    doc.rect(margin, y, contentW, h);
    doc.line(margin + cols[0], y, margin + cols[0], y + h);
    doc.line(margin + cols[0] + cols[1], y, margin + cols[0] + cols[1], y + h);
    doc.line(
      margin + cols[0] + cols[1] + cols[2],
      y,
      margin + cols[0] + cols[1] + cols[2],
      y + h,
    );

    x = margin;
    doc.text(String(ln.lineNo || "—"), x + cols[0] / 2, y + 6.5, { align: "center" });
    x += cols[0];
    let dy = y + 6.5;
    for (const line of desc) {
      doc.text(line, x + 3, dy);
      dy += 4.2;
    }
    x += cols[1];
    const received = Number(ln.qtyReceived) || 0;
    const qty =
      Number.isFinite(ln.qtyReceived) && !Number.isInteger(ln.qtyReceived)
        ? String(ln.qtyReceived)
        : String(Math.round(Number(ln.qtyReceived) || 0));
    doc.text(qty, x + cols[2] - 3, y + 6.5, { align: "right" });
    x += cols[2];
    const billQty = ln.billingQuantity;
    let billingLabel = "No";
    if (billQty != null && Number.isFinite(billQty)) {
      const b = Math.round(billQty * 1e6) / 1e6;
      if (b <= 0) billingLabel = "No";
      else if (b >= received && received > 0) billingLabel = "Yes";
      else billingLabel = String(b);
    } else if (ln.billing) {
      billingLabel = received > 0 ? "Yes" : "No";
    }
    doc.text(billingLabel, x + cols[3] / 2, y + 6.5, { align: "center" });
    y += h;
  }

  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, rightEdge, y);
  y += 8;

  // —— Footer meta ——
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${formatGrnFooterDate(input.grnDate)}`, margin, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text(grnHeader, margin, y);

  doc.save(fileName || `GRN-${input.grnNumber || "draft"}.pdf`);
}

function formatGrnFooterDate(isoDate: string): string {
  const raw = (isoDate || "").trim();
  if (!raw) return "—";
  const d = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return formatPoDate(raw);
  const day = d.getDate();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const mon = months[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year}, ${hh}:${mm}`;
}
