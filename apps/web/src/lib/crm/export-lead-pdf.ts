import { jsPDF } from "jspdf";

import { formatInr, fullName, type SalesLead } from "@/services/sales-crm-service";

function pdfSafe(text: string): string {
  return text
    .replace(/\u20B9/g, "Rs.")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text ? pdfSafe(text) : "-";
}

export function exportLeadPdf(lead: SalesLead, companyName?: string | null): void {
  const doc = new jsPDF();
  let y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(pdfSafe(`Lead ${lead.lead_code}`), 14, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const rows: [string, string][] = [
    ["Name", fullName(lead)],
    ["Company", dash(companyName)],
    ["Mobile", dash(lead.mobile)],
    ["Email", dash(lead.email)],
    ["Status", dash(lead.status)],
    ["Product type", dash(lead.product_type)],
    ["Sub product", dash(lead.sub_product_category || lead.sub_product)],
    ["Expected amount", lead.expected_amount != null ? pdfSafe(formatInr(lead.expected_amount)) : "-"],
    ["Project title", dash(lead.project_title)],
    ["Industry", dash(lead.industry)],
    ["Notes", dash(lead.notes)],
  ];

  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, 120);
    doc.text(lines, 52, y);
    y += Math.max(6, lines.length * 5) + 2;
    if (y > 280) {
      doc.addPage();
      y = 18;
    }
  }

  doc.save(`${lead.lead_code || "lead"}.pdf`);
}
