/**
 * Company account PDF export — OVF-style two-column field layout.
 */
import { jsPDF } from "jspdf";

import type { Company } from "@/services/sales-crm-service";

export type CompanyExportInput = {
  company: Company;
  accountManagerName: string;
  assignedOwnershipName: string;
  createdByName: string;
  modifiedByName: string;
};

const PORTRAIT_W = 210;
const PORTRAIT_H = 297;
const MARGIN = 14;
const COL_GAP = 10;
const FIELD_GAP = 5.5;
const LINE_H = 5;

const TEXT: [number, number, number] = [0x22, 0x22, 0x22];
const LABEL: [number, number, number] = [0x4a, 0x4a, 0x4a];
const SECTION: [number, number, number] = [0x1a, 0x56, 0xdb];

type PageRef = { n: number };

function pageSize(doc: jsPDF): { w: number; h: number } {
  const [w, h] = doc.internal.pageSize.getWidth
    ? [doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight()]
    : [PORTRAIT_W, PORTRAIT_H];
  return { w, h };
}

function contentWidth(doc: jsPDF): number {
  return pageSize(doc).w - MARGIN * 2;
}

function pdfSafe(text: string): string {
  return text
    .replace(/\u20B9/g, "Rs.")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text ? pdfSafe(text) : "-";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return pdfSafe(value);
  return d.toLocaleString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function personWithWhen(name: string | null | undefined, when: string | null | undefined): string {
  const who = dash(name);
  if (!when) return who;
  const stamped = formatDateTime(when);
  if (stamped === "-") return who;
  return who === "-" ? stamped : `${who}\n${stamped}`;
}

function formatAddress(parts: Array<string | null | undefined>): string {
  const line = parts.map((p) => p?.trim()).filter(Boolean).join(", ");
  return line ? pdfSafe(line) : "-";
}

function contactPerson(company: Company): string {
  const phone = company.phone?.trim();
  if (phone && phone !== "—") return pdfSafe(phone);
  const name = [company.first_name, company.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  return name ? pdfSafe(name) : "-";
}

function drawFooter(doc: jsPDF, pageRef: PageRef) {
  const { w, h } = pageSize(doc);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Company Account", MARGIN, h - 8);
  doc.text(`Page ${pageRef.n}`, w - MARGIN, h - 8, { align: "right" });
}

function ensureSpace(doc: jsPDF, y: number, need: number, pageRef: PageRef): number {
  const { h } = pageSize(doc);
  if (y + need < h - 16) return y;
  drawFooter(doc, pageRef);
  doc.addPage("a4", "p");
  pageRef.n += 1;
  return 16;
}

function drawStackedField(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...LABEL);
  const labelLines = doc.splitTextToSize(`${pdfSafe(label)} :`, width) as string[];
  let yy = y;
  for (const line of labelLines) {
    doc.text(line, x, yy);
    yy += LINE_H;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const valueLines = doc.splitTextToSize(dash(value), width) as string[];
  for (const line of valueLines) {
    doc.text(line, x, yy);
    yy += LINE_H;
  }
  return yy + FIELD_GAP;
}

function measureStackedField(doc: jsPDF, width: number, label: string, value: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const labelLines = doc.splitTextToSize(`${pdfSafe(label)} :`, width) as string[];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const valueLines = doc.splitTextToSize(dash(value), width) as string[];
  return labelLines.length * LINE_H + valueLines.length * LINE_H + FIELD_GAP;
}

function drawTwoColumnFields(
  doc: jsPDF,
  y: number,
  left: Array<[string, string]>,
  right: Array<[string, string]>,
  pageRef: PageRef,
): number {
  const colW = (contentWidth(doc) - COL_GAP) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + COL_GAP;
  let ly = y;
  let ry = y;
  const rows = Math.max(left.length, right.length);

  for (let i = 0; i < rows; i++) {
    const leftH = left[i] ? measureStackedField(doc, colW, left[i][0], left[i][1]) : 0;
    const rightH = right[i] ? measureStackedField(doc, colW, right[i][0], right[i][1]) : 0;
    const need = Math.max(leftH, rightH, 14);
    const top = Math.max(ly, ry);
    const startY = ensureSpace(doc, top, need + 2, pageRef);
    if (startY !== top) {
      ly = startY;
      ry = startY;
    }
    if (left[i]) ly = drawStackedField(doc, leftX, ly, colW, left[i][0], left[i][1]);
    if (right[i]) ry = drawStackedField(doc, rightX, ry, colW, right[i][0], right[i][1]);
    const synced = Math.max(ly, ry);
    ly = synced;
    ry = synced;
  }
  return Math.max(ly, ry) + 4;
}

export function buildCompanyExportFilename(company: Company): string {
  const base = (company.customer_name || company.account_number || "Company")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return `Company_${base || company.account_number}.pdf`;
}

export function exportCompanyPdf(input: CompanyExportInput): void {
  const { company } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageRef: PageRef = { n: 1 };

  const billingAddress = formatAddress([
    company.billing_street,
    company.billing_city,
    company.billing_state,
    company.billing_code,
    company.billing_country,
  ]);
  const shippingAddress = formatAddress([
    company.shipping_street,
    company.shipping_city,
    company.shipping_state,
    company.shipping_code,
    company.shipping_country,
  ]);

  let y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...TEXT);
  doc.text("Company Account Information", MARGIN, y);
  y += 7;
  doc.setDrawColor(...SECTION);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, y, PORTRAIT_W - MARGIN, y);
  y += 8;

  drawTwoColumnFields(
    doc,
    y,
    [
      ["Company Name", company.customer_name],
      ["Billing Address", billingAddress],
      ["Billing State", company.billing_state],
      ["Contact Person", contactPerson(company)],
      ["Country", company.billing_country],
      ["Industry", company.industry],
      ["Source", company.source],
      ["Customer Email", company.customer_email ?? "-"],
      ["Created By", personWithWhen(input.createdByName, company.created_at)],
      ["Company Rec id", company.id],
      ["Status", company.status],
    ],
    [
      ["Company ID", company.account_number],
      ["Account Manager Owner", input.accountManagerName],
      ["Shipping Address", shippingAddress],
      ["Shipping State", company.shipping_state ?? "-"],
      ["Contact Person.", company.phone ?? "-"],
      ["Country.", company.shipping_country ?? company.billing_country],
      ["Account Type", company.account_type ?? "-"],
      ["Website", company.website ?? "-"],
      ["Modified By", personWithWhen(input.modifiedByName, company.updated_at ?? company.created_at)],
      ["Assigned Ownership", input.assignedOwnershipName],
      ["Stages", company.status],
      ["Version", String(company.version)],
      ["Tag", "-"],
    ],
    pageRef,
  );

  drawFooter(doc, pageRef);
  doc.save(buildCompanyExportFilename(company));
}
