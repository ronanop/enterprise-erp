import { jsPDF } from "jspdf";

import { loadCacheLogo } from "@/utils/load-cache-logo";
import {
  amountInIndianWords,
  dash,
  formatInrPdf,
  formatPoDate,
} from "@/utils/purchase-order-amount-words";
import { computeDeliveryChallanTaxSummary } from "@/utils/delivery-challan-totals";
import { resolveChallanRecordCustomerPo } from "@/utils/delivery-challan-prefill";
import type {
  DeliveryChallanLine,
  DeliveryChallanMode,
  DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import { formatDeliveryModeLabel } from "@/utils/delivery-challan-storage";

export type DeliveryChallanPdfInput = {
  entityName: string;
  entityAddressBlock: string;
  entityGstBlock: string;
  documentType?: string;
  copyLabel?: string;
  challanNumber: string;
  challanDate: string;
  customerName: string;
  customerBillTo: string;
  customerShipTo: string;
  customerGstNo: string;
  kindAttn: string;
  poNumber: string;
  poDate: string;
  shipFromAddress: string;
  remarks: string;
  preparedBy: string;
  deliveredBy: string;
  taxPercentage: number;
  /** Dispatch entity GST state (source of supply). */
  billingState?: string;
  /** Customer place of supply from PO/OVF (typically shipping state). */
  shippingState?: string;
  taxRemarks: string;
  deliveryMode: DeliveryChallanMode;
  lines: DeliveryChallanLine[];
};

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(dash(text), maxWidth) as string[];
}

function strokeRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h);
}

const CHALLAN_TERMS_LINE =
  "I/We, the Renter herein, have read and understood the terms & conditions mentioned overleaf and accept and agree to abide by the same.";

function resolveChallanSignatoryName(preparedBy: string): string {
  const value = (preparedBy || "").trim();
  if (value && dash(value) !== "—") return value;
  return "—";
}

function challanAmountInWords(amount: number): string {
  const raw = amountInIndianWords(amount)
    .replace(/^Indian Rupee\s+/i, "")
    .replace(/\s+Only$/i, " only");
  return `${raw}/`;
}

function drawChallanTotalsSection(
  doc: jsPDF,
  tableX: number,
  y: number,
  tableW: number,
  valueColW: number,
  rows: Array<{ label: string; rateLabel: string; amount: string; emphasis?: boolean }>,
  options?: {
    attachBelowItems?: boolean;
    amountInWords?: string;
    igstRemarks?: string;
  },
): number {
  const baseRowH = 6.5;
  const splitX = tableX + tableW - valueColW;
  const noteMaxW = Math.max(40, splitX - tableX - 42);

  const rowMeta = rows.map((row) => {
    let leftNote = "";
    if (row.label === "IGST" && options?.igstRemarks) {
      leftNote = options.igstRemarks;
    } else if (row.label === "Grand Total" && options?.amountInWords) {
      leftNote = options.amountInWords;
    }
    const noteLines = leftNote ? wrap(doc, leftNote, noteMaxW) : [];
    const rowH = Math.max(baseRowH, noteLines.length > 0 ? 3.2 + noteLines.length * 3.2 : baseRowH);
    return { row, leftNote, noteLines, rowH };
  });
  const blockH = rowMeta.reduce((sum, r) => sum + r.rowH, 0);

  if (options?.attachBelowItems) {
    strokeRectNoTop(doc, tableX, y, tableW, blockH);
  } else {
    strokeRect(doc, tableX, y, tableW, blockH);
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.line(splitX, y, splitX, y + blockH);

  let rowTop = y;
  rowMeta.forEach((meta, index) => {
    const { row, noteLines, rowH } = meta;
    if (index > 0) {
      doc.setLineWidth(0.2);
      doc.line(tableX, rowTop, tableX + tableW, rowTop);
    }
    const textY = rowTop + Math.min(4.2, rowH * 0.55);
    const label = row.rateLabel ? `${row.label} (${row.rateLabel})` : row.label;

    if (noteLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      let ny = rowTop + 3.5;
      for (const line of noteLines) {
        doc.text(line, tableX + 2, ny);
        ny += 3.2;
      }
    }

    doc.setFont("helvetica", row.emphasis ? "bold" : "normal");
    doc.setFontSize(7);
    doc.text(label, splitX - 2, textY, { align: "right" });
    doc.text(row.amount, tableX + tableW - 2, textY, { align: "right" });
    rowTop += rowH;
  });

  return y + blockH;
}

const ITEM_COL_WEIGHTS = {
  sr: 10,
  desc: 62,
  hsn: 18,
  asset: 16,
  qty: 14,
  rate: 20,
  value: 22,
} as const;

type ItemColumnWidths = Record<keyof typeof ITEM_COL_WEIGHTS, number>;

function scaleItemColumns(contentW: number): ItemColumnWidths {
  const sum = Object.values(ITEM_COL_WEIGHTS).reduce((a, b) => a + b, 0);
  const scaled = {} as ItemColumnWidths;
  (Object.keys(ITEM_COL_WEIGHTS) as Array<keyof typeof ITEM_COL_WEIGHTS>).forEach((key) => {
    scaled[key] = (contentW * ITEM_COL_WEIGHTS[key]) / sum;
  });
  return scaled;
}

function columnBoundaries(tableX: number, itemCols: ItemColumnWidths): number[] {
  const keys = Object.keys(itemCols) as Array<keyof typeof itemCols>;
  const xs = [tableX];
  let x = tableX;
  for (const key of keys) {
    x += itemCols[key];
    xs.push(x);
  }
  return xs;
}

function drawItemRowColumnLines(
  doc: jsPDF,
  boundaries: number[],
  y: number,
  rowH: number,
) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  const y2 = y + rowH;
  for (let i = 1; i < boundaries.length - 1; i += 1) {
    doc.line(boundaries[i], y, boundaries[i], y2);
  }
}

function strokeRectNoTop(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.line(x, y, x, y + h);
  doc.line(x + w, y, x + w, y + h);
  doc.line(x, y + h, x + w, y + h);
}

function formatDigitalSignDate(value: string): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const d = new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const slash = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (slash) {
      const [, dd, mm, yyyy] = slash;
      return `${yyyy}.${mm.padStart(2, "0")}.${dd.padStart(2, "0")}`;
    }
    return raw.slice(0, 10);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function drawDigitalSignatoryBlock(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  entityLabel: string,
  signerName: string,
  signDate: string,
) {
  const name = signerName.trim() || "—";
  const entityShort = entityLabel.trim() || "Cache Technologies";
  const dateLine = formatDigitalSignDate(signDate);
  const centerX = x + w / 2;
  const textW = w - 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`For ${entityShort}`, centerX, y + 5, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(13);
  doc.text(name, centerX, y + 16, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  let metaY = y + 22;
  const signedLine = `Digitally signed by ${name.toUpperCase()}`;
  for (const part of wrap(doc, signedLine, textW)) {
    doc.text(part, centerX, metaY, { align: "center" });
    metaY += 3.2;
  }
  if (dateLine) {
    doc.text(`Date: ${dateLine}`, centerX, metaY + 0.5, { align: "center" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Authorised Signatory", centerX, y + h - 4, { align: "center" });
}

function drawFooterSection(doc: jsPDF, input: DeliveryChallanPdfInput, startY: number) {
  const margin = 10;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = startY;

  if (y > pageH - 75) {
    doc.addPage();
    y = margin;
  }

  const termsLines = wrap(doc, CHALLAN_TERMS_LINE, contentW - 4);
  const termsH = Math.max(10, 4 + termsLines.length * 3.2);
  strokeRect(doc, margin, y, contentW, termsH);
  let tY = y + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  termsLines.forEach((line) => {
    doc.text(line, margin + 2, tY);
    tY += 3.2;
  });
  y += termsH + 3;

  const footH = 38;
  const halfW = contentW / 2;
  strokeRect(doc, margin, y, halfW, footH);
  strokeRect(doc, margin + halfW, y, halfW, footH);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Received the above mentioned goods in good condition", margin + 2, y + 5);
  doc.setFontSize(6.5);
  doc.text("Receiver's Name, Signature & Rubber Stamp", margin + 2, y + footH - 4);

  const entityShort = input.entityName || "Cache Technologies";
  const sigName = resolveChallanSignatoryName(input.preparedBy);
  drawDigitalSignatoryBlock(
    doc,
    margin + halfW,
    y,
    halfW,
    footH,
    entityShort,
    sigName,
    input.challanDate,
  );
}

const GRID_LABEL_W_FRAC = 0.2;
const GRID_HALF_VALUE_FRAC = 0.3;

function gridColumnWidths(contentW: number): [number, number, number, number] {
  const lw = contentW * GRID_LABEL_W_FRAC;
  const vw = contentW * GRID_HALF_VALUE_FRAC;
  return [lw, vw, lw, vw];
}

function textBlockHeight(doc: jsPDF, text: string, maxWidth: number, fontSize: number): number {
  doc.setFontSize(fontSize);
  const lines = wrap(doc, text, maxWidth - 3);
  return Math.max(1, lines.length) * 3.2;
}

function formatCustomerDetailsBlock(input: DeliveryChallanPdfInput): string {
  const lines: string[] = [];
  const name = dash(input.customerName);
  if (name !== "—") lines.push(name);

  const billTo = (input.customerBillTo || "").trim();
  if (billTo) lines.push(`Bill To: ${billTo}`);

  const shipTo = (input.customerShipTo || "").trim();
  if (shipTo && shipTo !== billTo) lines.push(`Ship To: ${shipTo}`);
  else if (shipTo && shipTo === billTo) lines.push(`Ship To: Same as Bill To`);

  const gst = (input.customerGstNo || "").trim();
  if (gst) lines.push(`GST No: ${gst}`);

  const attn = (input.kindAttn || "").trim();
  if (attn) lines.push(`Kind Attn: ${attn}`);

  return lines.length > 0 ? lines.join("\n") : "—";
}

type HeaderGridRow =
  | { kind: "dual"; left: { label: string; value: string }; right: { label: string; value: string } }
  | { kind: "span"; label: string; value: string };

function measureDualRowHeight(
  doc: jsPDF,
  left: { label: string; value: string },
  right: { label: string; value: string },
  gridCols: [number, number, number, number],
): number {
  const padTop = 3.2;
  const padBottom = 2;
  const leftH = Math.max(
    textBlockHeight(doc, left.label, gridCols[0], 7),
    textBlockHeight(doc, left.value, gridCols[1], 7.5),
  );
  const rightH = Math.max(
    textBlockHeight(doc, right.label, gridCols[2], 7),
    textBlockHeight(doc, right.value, gridCols[3], 7.5),
  );
  return Math.max(9, padTop + Math.max(leftH, rightH) + padBottom);
}

function measureSpanRowHeight(
  doc: jsPDF,
  label: string,
  value: string,
  labelW: number,
  valueW: number,
): number {
  const padTop = 3.2;
  const padBottom = 2.5;
  const labelH = textBlockHeight(doc, label, labelW, 7);
  const valueH = textBlockHeight(doc, value, valueW, 7.5);
  return Math.max(12, padTop + Math.max(labelH, valueH) + padBottom);
}

function drawLabeledValue(
  doc: jsPDF,
  x: number,
  y: number,
  labelW: number,
  valueW: number,
  label: string,
  value: string,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const labelLines = wrap(doc, label, labelW - 3);
  let ly = y + 3.2;
  for (const line of labelLines.slice(0, 3)) {
    doc.text(line, x + 1.5, ly);
    ly += 3.2;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const valueLines = wrap(doc, value, valueW - 3);
  let vy = y + 3.2;
  for (const line of valueLines) {
    doc.text(line, x + labelW + 1.5, vy);
    vy += 3.2;
  }
}

function drawHeaderGrid(
  doc: jsPDF,
  margin: number,
  startY: number,
  contentW: number,
  rows: HeaderGridRow[],
): number {
  const gridCols = gridColumnWidths(contentW);
  const spanLabelW = gridCols[0];
  const spanValueW = contentW - spanLabelW;
  const midX = margin + gridCols[0] + gridCols[1];

  const rowHeights = rows.map((row) => {
    if (row.kind === "dual") {
      return measureDualRowHeight(doc, row.left, row.right, gridCols);
    }
    return measureSpanRowHeight(doc, row.label, row.value, spanLabelW, spanValueW);
  });
  const gridH = rowHeights.reduce((sum, h) => sum + h, 0);

  strokeRect(doc, margin, startY, contentW, gridH);

  let y = startY;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowH = rowHeights[i];

    doc.setDrawColor(0);
    doc.setLineWidth(0.25);

    if (row.kind === "dual") {
      drawLabeledValue(doc, margin, y, gridCols[0], gridCols[1], row.left.label, row.left.value);
      drawLabeledValue(doc, midX, y, gridCols[2], gridCols[3], row.right.label, row.right.value);
      doc.line(margin + gridCols[0], y, margin + gridCols[0], y + rowH);
      doc.line(midX, y, midX, y + rowH);
      doc.line(midX + gridCols[2], y, midX + gridCols[2], y + rowH);
    } else {
      drawLabeledValue(doc, margin, y, spanLabelW, spanValueW, row.label, row.value);
      doc.line(margin + spanLabelW, y, margin + spanLabelW, y + rowH);
    }

    if (i < rows.length - 1) {
      doc.line(margin, y + rowH, margin + contentW, y + rowH);
    }
    y += rowH;
  }

  return startY + gridH;
}

export async function downloadDeliveryChallanPdf(
  input: DeliveryChallanPdfInput,
  fileName?: string,
): Promise<void> {
  const doc = await renderDeliveryChallanPdf(input);
  const safeName = (input.challanNumber || "delivery-challan").replace(/[/\\?%*:|"<>]/g, "-");
  doc.save(fileName || `Delivery-Challan-${safeName}.pdf`);
}

export async function openDeliveryChallanPdfPreview(input: DeliveryChallanPdfInput): Promise<void> {
  const doc = await renderDeliveryChallanPdf(input);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function renderDeliveryChallanPdf(input: DeliveryChallanPdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 10;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;
  let y = margin;

  const logo = await loadCacheLogo();
  const logoW = 28;
  let logoH = 12;
  if (logo) {
    logoH = (logo.height / logo.width) * logoW;
    doc.addImage(logo.dataUrl, "JPEG", margin, y, logoW, logoH);
  }

  const centerX = pageW / 2;
  const entityTitle = (input.entityName || "Cache Technologies").trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(entityTitle, centerX, y + 4, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const addressOnly = (input.entityAddressBlock || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => {
      if (index !== 0) return true;
      return line.toLowerCase() !== entityTitle.toLowerCase();
    })
    .join("\n");
  const headerLines = wrap(doc, addressOnly, contentW * 0.55);
  let hy = y + 8;
  headerLines.slice(0, 4).forEach((line) => {
    doc.text(line, centerX, hy, { align: "center" });
    hy += 3;
  });

  const gstLines = wrap(doc, input.entityGstBlock, contentW * 0.7);
  gstLines.slice(0, 5).forEach((line) => {
    doc.text(line, centerX, hy, { align: "center" });
    hy += 2.8;
  });

  y = Math.max(y + logoH + 2, hy + 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DELIVERY CHALLAN", centerX, y, { align: "center" });
  doc.setFontSize(7);
  doc.text(input.copyLabel || "ORIGINAL FOR CONSIGNEE", pageW - margin, y, { align: "right" });
  y += 5;

  const headerRows: HeaderGridRow[] = [
    {
      kind: "dual",
      left: { label: "Challan No", value: input.challanNumber },
      right: { label: "Challan Date", value: formatPoDate(input.challanDate) },
    },
    {
      kind: "span",
      label: "Customer Details",
      value: formatCustomerDetailsBlock(input),
    },
    {
      kind: "dual",
      left: { label: "Customer PO No.", value: input.poNumber },
      right: { label: "Customer PO Date", value: formatPoDate(input.poDate) },
    },
    {
      kind: "span",
      label: "Remarks",
      value: dash(input.remarks),
    },
    {
      kind: "dual",
      left: { label: "Mode of Delivery", value: formatDeliveryModeLabel(input.deliveryMode) },
      right: { label: "Delivered By", value: input.deliveredBy },
    },
  ];

  y = drawHeaderGrid(doc, margin, y, contentW, headerRows) + 3;

  const itemCols = scaleItemColumns(contentW);
  const tableW = contentW;
  const tableX = margin;
  const colBounds = columnBoundaries(tableX, itemCols);

  const headerRowH = 7;
  doc.setFillColor(232, 236, 241);
  doc.rect(tableX, y, tableW, headerRowH, "FD");
  drawItemRowColumnLines(doc, colBounds, y, headerRowH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  let cx = tableX;
  const headers = [
    ["Sr. No.", itemCols.sr],
    ["Description", itemCols.desc],
    ["HSN/SAC Code", itemCols.hsn],
    ["Asset No", itemCols.asset],
    ["Quantity", itemCols.qty],
    ["Rate", itemCols.rate],
    ["Value", itemCols.value],
  ] as const;
  for (const [label, w] of headers) {
    doc.text(label, cx + w / 2, y + 4.5, { align: "center" });
    cx += w;
  }
  y += headerRowH;

  const itemRows = input.lines.filter((ln) => ln.itemName.trim());

  for (let i = 0; i < itemRows.length; i += 1) {
    const ln = itemRows[i];
    const qty = Number(ln.quantitySent) || 0;
    const rate = Number(ln.rate) || 0;
    const value = qty * rate;

    const descParts = [ln.itemName.trim()];
    if (ln.shipTo.trim()) {
      descParts.push(`Ship To: ${ln.shipTo.trim()}`);
    }
    const descLines = wrap(doc, descParts.join("\n"), itemCols.desc - 2);
    const rowH = Math.max(12, 4 + descLines.length * 3.2);

    if (y + rowH > 250) {
      doc.addPage();
      y = margin;
    }

    strokeRect(doc, tableX, y, tableW, rowH);
    drawItemRowColumnLines(doc, colBounds, y, rowH);
    cx = tableX;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const textY = y + Math.min(5, rowH * 0.4);
    doc.text(String(i + 1), cx + itemCols.sr / 2, textY, { align: "center" });
    cx += itemCols.sr;
    let dy = y + 4;
    descLines.forEach((line) => {
      doc.text(line, cx + 1, dy);
      dy += 3.2;
    });
    cx += itemCols.desc;
    doc.text(ln.hsnSac || "—", cx + itemCols.hsn / 2, textY, { align: "center" });
    cx += itemCols.hsn;
    doc.text(ln.assetNo || "—", cx + itemCols.asset / 2, textY, { align: "center" });
    cx += itemCols.asset;
    doc.text(String(qty), cx + itemCols.qty / 2, textY, { align: "center" });
    cx += itemCols.qty;
    doc.text(formatInrPdf(rate), cx + itemCols.rate - 1, textY, { align: "right" });
    cx += itemCols.rate;
    doc.text(formatInrPdf(value), cx + itemCols.value - 1, textY, { align: "right" });
    y += rowH;
  }

  const taxSummary = computeDeliveryChallanTaxSummary({
    lines: itemRows,
    taxPct: input.taxPercentage,
    sourceOfSupply: input.billingState || "",
    destinationOfSupply: input.shippingState || "",
    formatAmount: formatInrPdf,
  });
  const grandTotal = taxSummary.grandTotal;
  const igstAmount = taxSummary.igstAmount;

  y = drawChallanTotalsSection(
    doc,
    tableX,
    y,
    tableW,
    itemCols.value,
    taxSummary.rows,
    {
      attachBelowItems: itemRows.length > 0,
      amountInWords: `Amount in Words: ${challanAmountInWords(grandTotal)}`,
      igstRemarks:
        igstAmount > 0 ? `Remarks: IGST value for ${Math.round(igstAmount)}` : undefined,
    },
  );
  y += 4;

  drawFooterSection(doc, input, y);

  return doc;
}

export function buildDeliveryChallanPdfInput(params: {
  entityName: string;
  entityAddressBlock: string;
  entityGstBlock: string;
  challanNumber: string;
  challanDate: string;
  customerName: string;
  customerBillTo: string;
  customerShipTo: string;
  customerGstNo: string;
  kindAttn: string;
  poNumber: string;
  poDate: string;
  shipFromAddress: string;
  remarks: string;
  preparedBy: string;
  deliveredBy: string;
  taxPercentage: string;
  billingState: string;
  shippingState: string;
  taxRemarks: string;
  documentType: string;
  copyLabel: string;
  deliveryMode: DeliveryChallanMode;
  lines: DeliveryChallanLine[];
}): DeliveryChallanPdfInput {
  return {
    entityName: params.entityName,
    entityAddressBlock: params.entityAddressBlock,
    entityGstBlock: params.entityGstBlock,
    documentType: params.documentType,
    copyLabel: params.copyLabel,
    challanNumber: params.challanNumber,
    challanDate: params.challanDate,
    customerName: params.customerName,
    customerBillTo: params.customerBillTo,
    customerShipTo: params.customerShipTo,
    customerGstNo: params.customerGstNo,
    kindAttn: params.kindAttn,
    poNumber: params.poNumber,
    poDate: params.poDate,
    shipFromAddress: params.shipFromAddress,
    remarks: params.remarks,
    preparedBy: params.preparedBy,
    deliveredBy: params.deliveredBy,
    taxPercentage: Number(params.taxPercentage) || 0,
    billingState: params.billingState,
    shippingState: params.shippingState,
    taxRemarks: params.taxRemarks,
    deliveryMode: params.deliveryMode,
    lines: params.lines,
  };
}

export function buildDeliveryChallanPdfInputFromRecord(
  record: DeliveryChallanRecord,
): DeliveryChallanPdfInput {
  return buildDeliveryChallanPdfInput({
    entityName: record.entityName,
    entityAddressBlock: record.entityAddressBlock,
    entityGstBlock: record.entityGstBlock,
    documentType: record.documentType || "DELIVERY CHALLAN",
    copyLabel: record.copyLabel || "ORIGINAL FOR CONSIGNEE",
    challanNumber: record.challanNumber,
    challanDate: record.challanDate,
    customerName: record.customerName,
    customerBillTo: record.customerBillTo,
    customerShipTo: record.customerShipTo,
    customerGstNo: record.customerGstNo,
    kindAttn: record.kindAttn,
    poNumber: record.purchaseOrderNumber,
    poDate: record.poDate,
    shipFromAddress: record.shipFromAddress,
    remarks: record.remarks,
    preparedBy: record.preparedBy,
    deliveredBy: record.deliveredBy,
    taxPercentage: record.taxPercentage || "18",
    billingState: record.billingState,
    shippingState: record.shippingState,
    taxRemarks: record.taxRemarks,
    deliveryMode: record.deliveryMode,
    lines: record.lines,
  });
}

/** PDF input with customer PO resolved from order/OVF when the record still has company PO. */
export async function buildDeliveryChallanPdfInputFromRecordResolved(
  record: DeliveryChallanRecord,
): Promise<DeliveryChallanPdfInput> {
  const resolved = await resolveChallanRecordCustomerPo(record);
  return buildDeliveryChallanPdfInputFromRecord(resolved);
}
