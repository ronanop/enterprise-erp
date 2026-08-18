import { GState, jsPDF } from "jspdf";

import { loadCacheLogo } from "@/utils/load-cache-logo";
import {
  amountInIndianWords,
  amountInUsdWords,
  dash,
  formatInrPdf,
  formatPoDateSlash,
  formatUsdPdf,
} from "@/utils/purchase-order-amount-words";

export type PurchaseOrderPdfInput = {
  company: {
    name: string;
    addressLines: string[];
    phone: string;
    logoUrl?: string;
    gstin?: string;
    pan?: string;
    serviceTaxNo?: string;
  };
  supplier: { name: string; address: string };
  customerGstin?: string;
  orderRef?: string;
  poNumber: string;
  date: string;
  billingAddress: string;
  shippingAddress: string;
  currency: "INR" | "USD";
  paymentTerms: string;
  authorizedSignatoryName?: string;
  lines: Array<{
    partNo: string;
    description: string;
    hsnCode?: string;
    qty: number;
    unitPriceInr: number;
    rateCurrency?: "INR" | "USD";
  }>;
  distributionChargesInr?: number;
  taxes: Array<{ label: string; amountInr: number }>;
  termsAndConditions: string[];
};

/** Exact CACHE PO terms (page 2). */
export const CACHE_PO_TERMS = [
  "Purchaser, its group Companies and associates are committed to operating its businesses conforming to the highest moral and ethical standards. The Seller/Service Provider is required to be committed to acting professionally, fairly and with integrity in all its business dealings and relationships wherever it operates, and to implementing and enforcing effective systems to counter bribery and unethical practices. The Seller/Service Provider shall comply with all applicable anti-bribery and anti-corruption laws of India and international transactions under this Purchase Order.",
  "Both Purchaser and Seller/Service Provider shall comply with all applicable export control laws, trade sanctions, related regulations, and ensure that the goods and services procured under this Purchase Order are not in violation of such laws.",
  "Compliance with the Company's Anti-Corruption and Anti-Bribery Policy and Export Control and Trade Compliance Policy, as amended from time to time available at https://www.cachedigitech.com/policies is mandatory.",
];

const DEFAULT_CACHE_COMPANY = {
  name: "CACHE DIGITECH PVT LTD",
  addressLines: [
    "L-31, Kailash Colony,",
    "New Delhi, Delhi-110048, India",
  ],
  phone: "011-47105700-25",
  gstin: "07AAACC4248H1ZU",
  pan: "AAACC4248H",
  serviceTaxNo: "AAACC4248HSD001",
} as const;

const KAILASH_BILLING = [
  "CACHE DIGITECH PVT LTD",
  "L-31, Kailash Colony,",
  "New Delhi, Delhi-110048, India",
].join("\n");

const PEACH: [number, number, number] = [248, 224, 200];
const HEADER_GRAY: [number, number, number] = [232, 236, 241];

function computeTotals(input: PurchaseOrderPdfInput) {
  const lineRows = input.lines.map((line, index) => {
    const isUsd = (line.rateCurrency || "INR") === "USD";
    return {
      ...line,
      sNo: index + 1,
      isUsd,
      lineTotal: line.qty * line.unitPriceInr,
    };
  });
  const allUsd = lineRows.length > 0 && lineRows.every((row) => row.isUsd);
  const subtotal = lineRows.reduce((sum, row) => {
    if (allUsd) return sum + row.lineTotal;
    return row.isUsd ? sum : sum + row.lineTotal;
  }, 0);
  const distribution = allUsd ? 0 : (input.distributionChargesInr ?? 0);
  const taxTotal = allUsd ? 0 : input.taxes.reduce((sum, tax) => sum + tax.amountInr, 0);
  return {
    lineRows,
    subtotal,
    distribution,
    taxTotal,
    allUsd,
    grandTotal: subtotal + distribution + taxTotal,
  };
}

function wrap(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(dash(text), maxWidth) as string[];
}

function strokeRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.rect(x, y, w, h);
}

/** Diagonal DRAFT PO mark — only for unfinalized PDF previews. */
function applyPreviewWatermark(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const soft = new GState({ opacity: 0.14 });
  const solid = new GState({ opacity: 1 });

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setGState(soft);
    doc.setTextColor(185, 28, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(54);
    doc.text("DRAFT PO", pageW / 2, pageH / 2, {
      align: "center",
      angle: 32,
    });
    doc.setGState(solid);
    doc.setTextColor(0, 0, 0);
  }
}

function fillStrokeRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: [number, number, number],
) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.rect(x, y, w, h, "FD");
}

function vLine(doc: jsPDF, x: number, y1: number, y2: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.line(x, y1, x, y2);
}

function hLine(doc: jsPDF, x1: number, x2: number, y: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.line(x1, y, x2, y);
}

export function buildDefaultPoTaxes(params: {
  taxableAmount: number;
  taxPct: number;
  sourceOfSupply?: string;
  destinationOfSupply?: string;
}): Array<{ label: string; amountInr: number }> {
  const pct = Number.isFinite(params.taxPct) ? params.taxPct : 0;
  const taxable = Math.max(0, params.taxableAmount);
  if (pct <= 0 || taxable <= 0) return [];

  const source = (params.sourceOfSupply || "").trim().toLowerCase();
  const destination = (params.destinationOfSupply || "").trim().toLowerCase();
  const bothSet = Boolean(source && destination);
  const sameState = bothSet && source === destination;

  // Intra-state (or incomplete place-of-supply): CGST + SGST. Inter-state: IGST.
  if (!bothSet || sameState) {
    const half = pct / 2;
    const halfAmt = (taxable * half) / 100;
    return [
      { label: `CGST (${half}%)`, amountInr: halfAmt },
      { label: `SGST (${half}%)`, amountInr: halfAmt },
    ];
  }

  return [{ label: `IGST (${pct}%)`, amountInr: (taxable * pct) / 100 }];
}

/** Group taxable buckets by GST % and merge CGST/SGST/IGST labels. */
export function buildPoTaxesFromBuckets(params: {
  buckets: Array<{ taxableAmount: number; taxPct: number }>;
  sourceOfSupply?: string;
  destinationOfSupply?: string;
}): Array<{ label: string; amountInr: number }> {
  const byPct = new Map<number, number>();
  for (const bucket of params.buckets) {
    const pct = Number.isFinite(bucket.taxPct) ? bucket.taxPct : 0;
    const taxable = Math.max(0, bucket.taxableAmount);
    if (pct <= 0 || taxable <= 0) continue;
    byPct.set(pct, (byPct.get(pct) || 0) + taxable);
  }
  const merged = new Map<string, number>();
  for (const [taxPct, taxableAmount] of [...byPct.entries()].sort((a, b) => a[0] - b[0])) {
    for (const row of buildDefaultPoTaxes({
      taxableAmount,
      taxPct,
      sourceOfSupply: params.sourceOfSupply,
      destinationOfSupply: params.destinationOfSupply,
    })) {
      merged.set(row.label, (merged.get(row.label) || 0) + row.amountInr);
    }
  }
  return [...merged.entries()].map(([label, amountInr]) => ({ label, amountInr }));
}

/** Master-data stub used when SCM OVF lines are not catalog products. */
const SCM_PLACEHOLDER_PRODUCT_CODES = new Set(["SCM-PURCHASED"]);

/**
 * Prefer product name on the PDF when there is no real catalog part code.
 * Never print the SCM catalog placeholder code as the Product value.
 */
export function resolvePoPdfLineLabels(
  productCode?: string | null,
  productName?: string | null,
): { partNo: string; description: string } {
  const code = (productCode || "").trim();
  const name = (productName || "").trim();
  const codeIsPlaceholder =
    !code || SCM_PLACEHOLDER_PRODUCT_CODES.has(code.toUpperCase());

  if (codeIsPlaceholder) {
    return {
      partNo: name || "—",
      description: name || "—",
    };
  }

  return {
    partNo: code,
    description: name || code || "—",
  };
}

export function purchaseOrderPdfInputFromOrder(
  order: {
    document_number: string;
    document_date: string;
    company_po_number?: string | null;
    payment_terms?: string | null;
    approved_by_name?: string | null;
    order_ref_cache?: string | null;
    lines?: Array<{
      product_code?: string | null;
      product_name?: string | null;
      quantity: number;
      unit_cost: number;
      rate_currency?: string | null;
    }>;
  },
  vendor: { name: string; address?: string },
  options?: { taxPct?: number },
): PurchaseOrderPdfInput {
  const lines = (order.lines || []).map((ln) => {
    const { partNo, description } = resolvePoPdfLineLabels(
      ln.product_code,
      ln.product_name,
    );
    const isUsd = (ln.rate_currency || "INR").toUpperCase() === "USD";
    return {
      partNo,
      description,
      qty: Number(ln.quantity) || 0,
      unitPriceInr: Number(ln.unit_cost) || 0,
      rateCurrency: isUsd ? ("USD" as const) : ("INR" as const),
    };
  });
  const allUsd = lines.length > 0 && lines.every((row) => row.rateCurrency === "USD");
  const taxableAmount = allUsd
    ? 0
    : lines.reduce(
        (sum, row) => (row.rateCurrency === "USD" ? sum : sum + row.qty * row.unitPriceInr),
        0,
      );
  const taxPct = options?.taxPct ?? 18;
  const companyPo = (order.company_po_number || "").trim();
  return {
    company: {
      name: DEFAULT_CACHE_COMPANY.name,
      addressLines: [...DEFAULT_CACHE_COMPANY.addressLines],
      phone: DEFAULT_CACHE_COMPANY.phone,
      gstin: DEFAULT_CACHE_COMPANY.gstin,
      pan: DEFAULT_CACHE_COMPANY.pan,
      serviceTaxNo: DEFAULT_CACHE_COMPANY.serviceTaxNo,
    },
    supplier: {
      name: (vendor.name || "").trim() || "—",
      address: (vendor.address || "").trim() || "—",
    },
    orderRef: (order.order_ref_cache || "").trim() || undefined,
    poNumber: companyPo || order.document_number || "PO",
    date: order.document_date || new Date().toISOString().slice(0, 10),
    billingAddress: KAILASH_BILLING,
    shippingAddress: KAILASH_BILLING,
    currency: allUsd ? "USD" : "INR",
    paymentTerms: order.payment_terms || "Net 30 Days",
    authorizedSignatoryName: (order.approved_by_name || "").trim() || undefined,
    lines,
    taxes: allUsd ? [] : buildDefaultPoTaxes({ taxableAmount, taxPct }),
    termsAndConditions: [...CACHE_PO_TERMS],
  };
}

export async function downloadOrderPdf(
  order: Parameters<typeof purchaseOrderPdfInputFromOrder>[0],
  vendor: { name: string; address?: string },
  fileName?: string,
  options?: { watermark?: boolean },
): Promise<void> {
  const input = purchaseOrderPdfInputFromOrder(order, vendor);
  const watermark = Boolean(options?.watermark);
  const safePo = (input.poNumber || "PO").replace(/[\\/:*?"<>|]+/g, "-");
  const baseName = fileName || `PO-${safePo}.pdf`;
  await downloadPurchaseOrderPdf(
    input,
    watermark ? baseName.replace(/\.pdf$/i, "-draft.pdf") : baseName,
    { watermark },
  );
}

export async function previewPurchaseOrderPdf(
  input: PurchaseOrderPdfInput,
): Promise<void> {
  await downloadPurchaseOrderPdf(input, undefined, { preview: true });
}

/**
 * CACHE Purchase Order — drawn to match the official bordered PO template.
 * Page 1 = PO form with logo; Page 2 = Terms & Conditions.
 */
export async function downloadPurchaseOrderPdf(
  input: PurchaseOrderPdfInput,
  fileName?: string,
  options?: { preview?: boolean; watermark?: boolean },
): Promise<void> {
  const payload: PurchaseOrderPdfInput = {
    ...input,
    company: {
      ...DEFAULT_CACHE_COMPANY,
      ...input.company,
      addressLines:
        input.company.addressLines?.length > 0
          ? [...input.company.addressLines]
          : [...DEFAULT_CACHE_COMPANY.addressLines],
      phone: input.company.phone || DEFAULT_CACHE_COMPANY.phone,
      gstin: input.company.gstin || DEFAULT_CACHE_COMPANY.gstin,
      pan: input.company.pan || DEFAULT_CACHE_COMPANY.pan,
      serviceTaxNo: input.company.serviceTaxNo || DEFAULT_CACHE_COMPANY.serviceTaxNo,
    },
    lines: [...(input.lines || [])],
    taxes: [...(input.taxes || [])],
    termsAndConditions:
      input.termsAndConditions.length > 0 ? input.termsAndConditions : [...CACHE_PO_TERMS],
  };

  const { lineRows, subtotal, distribution, grandTotal, allUsd } = computeTotals(payload);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Outer page margin / frame
  const L = 8;
  const R = pageW - 8;
  const T = 8;
  const B = pageH - 8;
  const W = R - L;
  let y = T;

  // ========== 1. Title ==========
  const titleH = 9;
  strokeRect(doc, L, y, W, titleH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PURCHASE ORDER", pageW / 2, y + 6.2, { align: "center" });
  y += titleH;

  // ========== 2. Logo | Company ==========
  const headH = 34;
  const logoW = W * 0.7;
  const companyW = W - logoW;
  strokeRect(doc, L, y, logoW, headH);
  strokeRect(doc, L + logoW, y, companyW, headH);

  const logo = await loadCacheLogo(payload.company.logoUrl || undefined);
  if (logo) {
    const padX = 4;
    const padY = 4;
    const maxW = logoW - padX * 2;
    const maxH = headH - padY * 2;
    const ratio = logo.width / logo.height;
    let drawW = maxW;
    let drawH = drawW / ratio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * ratio;
    }
    const lx = L + (logoW - drawW) / 2;
    const ly = y + (headH - drawH) / 2;
    try {
      doc.addImage(logo.dataUrl, "JPEG", lx, ly, drawW, drawH);
    } catch {
      doc.setTextColor(200, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("CACHE", L + logoW / 2, y + headH / 2 + 2, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }
  } else {
    doc.setTextColor(200, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("CACHE", L + logoW / 2, y + headH / 2 + 2, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  const companyRightX = R - 3;
  const companyMaxW = companyW - 6;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(payload.company.name, companyRightX, y + 7, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let ay = y + 12;
  for (const line of payload.company.addressLines) {
    for (const row of wrap(doc, line, companyMaxW)) {
      doc.text(row, companyRightX, ay, { align: "right" });
      ay += 3.8;
    }
  }
  ay += 2.2;
  doc.text(`Tel: ${dash(payload.company.phone)}`, companyRightX, Math.min(ay, y + headH - 6), {
    align: "right",
  });
  y += headH;

  // ========== 3. Supplier | Meta ==========
  const metaH = 46;
  const leftW = W * 0.7;
  const rightW = W - leftW;
  strokeRect(doc, L, y, leftW, metaH);
  strokeRect(doc, L + leftW, y, rightW, metaH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Supplier:", L + 2.5, y + 6);
  doc.text(dash(payload.supplier.name), L + 22, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let sy = y + 11;
  for (const row of wrap(doc, payload.supplier.address, leftW - 5).slice(0, 5)) {
    doc.text(row, L + 2.5, sy);
    sy += 3.8;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Customer GSTIN:", L + 2.5, y + metaH - 4);
  doc.setFont("helvetica", "normal");
  doc.text(dash(payload.customerGstin), L + 34, y + metaH - 4);

  // Right meta: stacked "Label: value" (no row/column grid)
  const meta: Array<[string, string]> = [
    ["GST NO:", dash(payload.company.gstin)],
    ["PAN NO:", dash(payload.company.pan)],
    ["Service Tax No.:", dash(payload.company.serviceTaxNo)],
    ["Order Ref. Cache:", dash(payload.orderRef)],
    ["CACHE Order No.:", dash(payload.poNumber)],
    ["Date:", formatPoDateSlash(payload.date)],
  ];
  const metaX = L + leftW + 2.5;
  const metaMaxW = rightW - 5;
  const metaLabelGap = 2.2;
  let my = y + 5;
  for (const [label, value] of meta) {
    const valueText = value === "—" && label.startsWith("Order Ref") ? "" : value;
    const line = valueText ? `${label} ${valueText}` : label;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const wrapped = wrap(doc, line, metaMaxW).slice(0, 2);
    for (const row of wrapped) {
      if (row.startsWith(label)) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(label, metaX, my);
        const rest = row.slice(label.length).trim();
        if (rest) {
          doc.setFont("helvetica", "normal");
          doc.text(rest, metaX + doc.getTextWidth(label) + metaLabelGap, my);
        }
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(row.trim(), metaX, my);
      }
      my += 5.5;
    }
  }
  y += metaH;

  // ========== 4. Billing | Shipping | Currency | Payment ==========
  // Billing+Shipping = 70%, Currency+Payment = 30%
  const quadH = 32;
  const quadWidths = [W * 0.35, W * 0.35, W * 0.15, W * 0.15];
  const quads: Array<[string, string]> = [
    ["Billing Address:", payload.billingAddress],
    ["Shipping Address:", payload.shippingAddress],
    ["Currency:", payload.currency],
    ["Payment Terms:", payload.paymentTerms],
  ];
  let qx = L;
  quads.forEach(([title, value], i) => {
    const qW = quadWidths[i];
    strokeRect(doc, qx, y, qW, quadH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(title, qx + 2, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let qy = y + 10;
    for (const row of wrap(doc, value, qW - 4).slice(0, 5)) {
      doc.text(row, qx + 2, qy);
      qy += 3.5;
    }
    qx += qW;
  });
  y += quadH;

  // ========== 5. Items header ==========
  // Left group (S.No / Part / Desc / Qty) = 58%, Unit Price + Total = 42%
  const itemsLeftW = W * 0.58;
  const itemsRightW = W * 0.42;
  const col = {
    sno: itemsLeftW * 0.08,
    part: itemsLeftW * 0.28,
    qty: itemsLeftW * 0.16,
    desc: itemsLeftW * 0.48,
    unit: itemsRightW * 0.5,
    total: itemsRightW * 0.5,
  };
  const widths = [col.sno, col.part, col.desc, col.qty, col.unit, col.total];
  const headerH = 7;
  fillStrokeRect(doc, L, y, W, headerH, HEADER_GRAY);
  {
    let x = L;
    for (let i = 0; i < widths.length - 1; i += 1) {
      x += widths[i];
      vLine(doc, x, y, y + headerH);
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const headers: Array<[string, number, "left" | "center" | "right"]> = [
    ["S. NO", col.sno, "center"],
    ["Product", col.part, "left"],
    ["Description", col.desc, "left"],
    ["Total Qty.", col.qty, "right"],
    ["Unit Price", col.unit, "right"],
    ["Amount", col.total, "right"],
  ];
  {
    let x = L;
    for (const [label, w, align] of headers) {
      const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - 1.5 : x + 1.5;
      doc.text(label, tx, y + 4.8, { align });
      x += w;
    }
  }
  y += headerH;

  // ========== 6. Line items ==========
  const footerNeed = 78; // totals + amount words + signatory
  const maxItemY = B - footerNeed;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (const row of lineRows) {
    const partLines = wrap(doc, row.partNo || "—", col.part - 3);
    const descLines = wrap(
      doc,
      row.hsnCode ? `${row.description}\nHSN: ${row.hsnCode}` : row.description || "—",
      col.desc - 3,
    );
    const h = Math.max(8, Math.max(partLines.length, descLines.length) * 3.5 + 3);
    if (y + h > maxItemY) break;

    strokeRect(doc, L, y, W, h);
    {
      let x = L;
      for (let i = 0; i < widths.length - 1; i += 1) {
        x += widths[i];
        vLine(doc, x, y, y + h);
      }
    }

    doc.text(String(row.sNo), L + col.sno / 2, y + 4.8, { align: "center" });
    let py = y + 4.5;
    for (const pl of partLines) {
      doc.text(pl, L + col.sno + 1.5, py);
      py += 3.5;
    }
    let dy = y + 4.5;
    for (const dl of descLines) {
      doc.text(dl, L + col.sno + col.part + 1.5, dy);
      dy += 3.5;
    }
    const numX = L + col.sno + col.part + col.desc;
    const money = row.isUsd ? formatUsdPdf : formatInrPdf;
    doc.text(formatInrPdf(row.qty), numX + col.qty - 1.5, y + 4.8, { align: "right" });
    doc.text(money(row.unitPriceInr), numX + col.qty + col.unit - 1.5, y + 4.8, {
      align: "right",
    });
    doc.text(money(row.lineTotal), numX + col.qty + col.unit + col.total - 1.5, y + 4.8, {
      align: "right",
    });
    y += h;
  }

  if (lineRows.length === 0) {
    strokeRect(doc, L, y, W, 8);
    doc.text("—", pageW / 2, y + 5.2, { align: "center" });
    y += 8;
  }

  // ========== 7. Amount in Words (left) | Totals (right) — matches CACHE sample ==========
  const money = allUsd ? formatUsdPdf : formatInrPdf;
  const totalRows: Array<[string, string, boolean]> = [
    [allUsd ? "Total USD" : "Total INR", money(subtotal), true],
  ];
  if (distribution > 0) {
    totalRows.push(["Distribution charges (INR)", formatInrPdf(distribution), true]);
  }
  if (!allUsd) {
    for (const tax of payload.taxes) {
      totalRows.push([tax.label, formatInrPdf(tax.amountInr), true]);
    }
  }
  totalRows.push([
    allUsd ? "Total Value of PO (USD)" : "Total Value of PO (INR)",
    money(grandTotal),
    true,
  ]);

  const tRowH = 6.5;
  const totalsH = Math.max(22, totalRows.length * tRowH);
  const totalsW = W * 0.42;
  const wordsW = W - totalsW;
  const totalsX = L + wordsW;

  strokeRect(doc, L, y, wordsW, totalsH);
  strokeRect(doc, totalsX, y, totalsW, totalsH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Amount in Words.", L + 2.5, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let wy = y + 11;
  for (const row of wrap(
    doc,
    allUsd ? amountInUsdWords(grandTotal) : amountInIndianWords(grandTotal),
    wordsW - 5,
  )) {
    if (wy > y + totalsH - 2) break;
    doc.text(row, L + 2.5, wy);
    wy += 3.6;
  }

  totalRows.forEach(([label, value, peach], i) => {
    const ry = y + i * tRowH;
    const rowH = i === totalRows.length - 1 ? totalsH - i * tRowH : tRowH;
    if (i > 0) hLine(doc, totalsX, R, ry);
    const labelW = totalsW * 0.5;
    vLine(doc, totalsX + labelW, ry, ry + rowH);

    // Sample: peach highlight on tax + grand-total rows (both label and amount).
    if (peach) {
      doc.setFillColor(PEACH[0], PEACH[1], PEACH[2]);
      doc.rect(totalsX + 0.25, ry + 0.2, totalsW - 0.5, rowH - 0.35, "F");
      hLine(doc, totalsX, R, ry);
      vLine(doc, totalsX + labelW, ry, ry + rowH);
      strokeRect(doc, totalsX, y, totalsW, totalsH);
    }

    doc.setFont("helvetica", i === totalRows.length - 1 || peach ? "bold" : "normal");
    doc.setFontSize(8);
    doc.text(label, totalsX + 2, ry + Math.min(4.5, rowH / 2 + 1.2));
    doc.text(value, R - 2.2, ry + Math.min(4.5, rowH / 2 + 1.2), { align: "right" });
  });
  y += totalsH;

  // ========== 8. Signatory ==========
  const signH = Math.max(B - y, 28);
  strokeRect(doc, L, y, W, signH);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`For ${payload.company.name}`, R - 4, y + 8, { align: "right" });
  const signatoryName = (payload.authorizedSignatoryName || "").trim();
  if (signatoryName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(signatoryName, R - 4, y + Math.min(signH - 10, 18), { align: "right" });
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Authorized Signatory", R - 4, y + Math.min(signH - 6, 26), { align: "right" });

  // ========== Page 2: Terms ==========
  doc.addPage();
  let ty = 28;
  const tm = 16;
  const tW = pageW - tm * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TERMS AND CONDITIONS", pageW / 2, ty, { align: "center" });
  ty += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  payload.termsAndConditions.forEach((term, i) => {
    const blocks = wrap(doc, `${i + 1}. ${term}`, tW);
    for (const row of blocks) {
      if (ty > pageH - 28) {
        doc.addPage();
        ty = 24;
      }
      doc.text(row, tm, ty);
      ty += 5.2;
    }
    ty += 7;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    "THIS IS AN ELECTRONICALLY GENERATED PURCHASE ORDER AND DOES NOT REQUIRE SIGNATURE",
    pageW / 2,
    Math.max(ty + 12, pageH - 24),
    { align: "center" },
  );

  if (options?.preview || options?.watermark) {
    applyPreviewWatermark(doc);
  }

  if (options?.preview) {
    const url = doc.output("bloburl");
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Popup blocked — fall back to download so the user still gets the PDF.
      doc.save(fileName || `PO-${payload.poNumber || "draft"}-preview.pdf`);
    }
    return;
  }

  doc.save(fileName || `PO-${payload.poNumber || "draft"}.pdf`);
}
