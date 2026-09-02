import { jsPDF } from "jspdf";

import { formatInr, type Opportunity } from "@/services/sales-crm-service";

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

export function exportOpportunityPdf(opportunity: Opportunity): void {
  const doc = new jsPDF();
  let y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(pdfSafe(`Opportunity ${opportunity.opportunity_code}`), 14, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const rows: [string, string][] = [
    ["Name", dash(opportunity.opportunity_name)],
    ["Stage", dash(opportunity.current_stage)],
    ["Status", dash(opportunity.status)],
    ["Expected revenue", pdfSafe(formatInr(opportunity.expected_revenue))],
    ["Probability", `${opportunity.probability_percent ?? 0}%`],
    ["Product type", dash(opportunity.product_type)],
    ["Cloud sub-product", dash(opportunity.cloud_sub_product)],
    ["Project title", dash(opportunity.project_title)],
    ["Notes", dash(opportunity.notes)],
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

  doc.save(`${opportunity.opportunity_code || "opportunity"}.pdf`);
}
