import path from "node:path";

import { config } from "dotenv";
import nodemailer, { type Transporter } from "nodemailer";

let envLoaded = false;

function loadBrevoEnv(): void {
  if (envLoaded) return;
  const root = process.cwd();
  config({ path: path.join(root, ".env.local") });
  config({ path: path.join(root, ".env") });
  config({ path: path.join(root, "../../.env") });
  envLoaded = true;
}

export function getBrevoConfig(): { from: string; smtpKey: string } | null {
  loadBrevoEnv();
  const from =
    process.env.BREVO_EMAIL?.trim() ||
    process.env.brevo_email?.trim() ||
    "";
  const smtpKey =
    process.env.BREVO_SMTP_KEY?.trim() ||
    process.env.BREVO_SMTP_PASS?.trim() ||
    process.env.brevo_smtp_key?.trim() ||
    "";
  if (!from || !smtpKey) return null;
  return { from, smtpKey };
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const brevo = getBrevoConfig();
  if (!brevo) {
    throw new Error("Brevo SMTP is not configured (BREVO_EMAIL and BREVO_SMTP_KEY).");
  }
  transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    auth: {
      user: brevo.from,
      pass: brevo.smtpKey,
    },
  });
  return transporter;
}

export type DeliveryReminderMailInput = {
  to: string;
  challanNumber: string;
  purchaseOrderNumber: string;
  expectedDeliveryDate: string;
};

export async function sendDeliveryReminderMail(
  input: DeliveryReminderMailInput,
): Promise<void> {
  const brevo = getBrevoConfig();
  if (!brevo) {
    throw new Error("Brevo SMTP is not configured.");
  }

  const po = input.purchaseOrderNumber.trim() || "—";
  const subject = `Delivery tomorrow — ${input.challanNumber} (${po})`;
  const text = [
    "Hello,",
    "",
    "This is a reminder that your shipment is scheduled for delivery tomorrow.",
    "",
    `Challan: ${input.challanNumber}`,
    `PO: ${po}`,
    `Expected delivery date: ${input.expectedDeliveryDate}`,
    "",
    "— Enterprise ERP Procurement",
  ].join("\n");

  const html = `
    <p>Hello,</p>
    <p>This is a reminder that your shipment is scheduled for <strong>delivery tomorrow</strong>.</p>
    <ul>
      <li><strong>Challan:</strong> ${escapeHtml(input.challanNumber)}</li>
      <li><strong>PO:</strong> ${escapeHtml(po)}</li>
      <li><strong>Expected delivery:</strong> ${escapeHtml(input.expectedDeliveryDate)}</li>
    </ul>
    <p style="color:#64748b;font-size:12px">Enterprise ERP Procurement</p>
  `;

  await getTransporter().sendMail({
    from: `"Enterprise ERP" <${brevo.from}>`,
    to: input.to.trim(),
    subject,
    text,
    html,
  });
}

export type DeliveryDispatchLineItem = {
  itemName: string;
  quantitySent: string;
  hsnSac?: string;
  assetNo?: string;
};

export type DeliveryDispatchMailInput = {
  to: string;
  challanNumber: string;
  purchaseOrderNumber: string;
  grnSummary: string;
  customerName: string;
  vendorName: string;
  shipmentStatus: string;
  dispatchDate: string;
  expectedDeliveryDate: string;
  trackingNumber?: string;
  courierTransportDetails?: string;
  lines: DeliveryDispatchLineItem[];
};

function buildItemsTableHtml(lines: DeliveryDispatchLineItem[]): string {
  const rows = lines.filter((line) => line.itemName.trim());
  if (rows.length === 0) {
    return "<p><em>No line items listed on this challan.</em></p>";
  }
  const body = rows
    .map(
      (line, index) => `
    <tr>
      <td style="padding:8px;border:1px solid #e2e8f0;text-align:center">${index + 1}</td>
      <td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml(line.itemName)}</td>
      <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${escapeHtml(line.quantitySent.trim() || "—")}</td>
      <td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml((line.hsnSac ?? "").trim() || "—")}</td>
    </tr>`,
    )
    .join("");
  return `
    <table style="border-collapse:collapse;width:100%;max-width:640px;font-size:14px;margin-top:12px">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;width:40px">#</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left">Item</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;width:80px">Qty</th>
          <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;width:100px">HSN/SAC</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function buildItemsTableText(lines: DeliveryDispatchLineItem[]): string {
  const rows = lines.filter((line) => line.itemName.trim());
  if (rows.length === 0) return "Items: (none listed)\n";
  const linesText = rows
    .map(
      (line, index) =>
        `  ${index + 1}. ${line.itemName} — Qty ${line.quantitySent.trim() || "—"}${line.hsnSac?.trim() ? ` (HSN ${line.hsnSac.trim()})` : ""}`,
    )
    .join("\n");
  return `Items:\n${linesText}\n`;
}

export async function sendDeliveryDispatchMail(input: DeliveryDispatchMailInput): Promise<void> {
  const brevo = getBrevoConfig();
  if (!brevo) {
    throw new Error("Brevo SMTP is not configured.");
  }

  const po = input.purchaseOrderNumber.trim() || "—";
  const grn = input.grnSummary.trim() || "—";
  const subject = `Your order has been dispatched — ${input.challanNumber} (${po})`;

  const metaLines = [
    `Challan: ${input.challanNumber}`,
    `PO: ${po}`,
    `GRN: ${grn}`,
    `Customer: ${input.customerName.trim() || "—"}`,
    `Vendor: ${input.vendorName.trim() || "—"}`,
    `Shipment status: ${input.shipmentStatus}`,
    `Dispatch date: ${input.dispatchDate || "—"}`,
    `Expected delivery: ${input.expectedDeliveryDate || "—"}`,
  ];
  if (input.trackingNumber?.trim()) {
    metaLines.push(`Tracking: ${input.trackingNumber.trim()}`);
  }
  if (input.courierTransportDetails?.trim()) {
    metaLines.push(`Courier / transport: ${input.courierTransportDetails.trim()}`);
  }

  const text = [
    "Hello,",
    "",
    "Your items have been dispatched. Details are below.",
    "",
    ...metaLines,
    "",
    buildItemsTableText(input.lines),
    "— Enterprise ERP Procurement",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.5;max-width:640px">
      <p>Hello,</p>
      <p>Your items have been <strong>dispatched</strong>. Summary:</p>
      <table style="font-size:14px;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Challan</td><td><strong>${escapeHtml(input.challanNumber)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">PO</td><td>${escapeHtml(po)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">GRN</td><td>${escapeHtml(grn)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Customer</td><td>${escapeHtml(input.customerName.trim() || "—")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Vendor</td><td>${escapeHtml(input.vendorName.trim() || "—")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Status</td><td>${escapeHtml(input.shipmentStatus)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Dispatch date</td><td>${escapeHtml(input.dispatchDate || "—")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Expected delivery</td><td>${escapeHtml(input.expectedDeliveryDate || "—")}</td></tr>
        ${input.trackingNumber?.trim() ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Tracking</td><td>${escapeHtml(input.trackingNumber.trim())}</td></tr>` : ""}
      </table>
      <p style="margin:16px 0 8px;font-weight:600">Items</p>
      ${buildItemsTableHtml(input.lines)}
      <p style="color:#64748b;font-size:12px;margin-top:24px">Enterprise ERP Procurement</p>
    </div>
  `;

  await getTransporter().sendMail({
    from: `"Enterprise ERP" <${brevo.from}>`,
    to: input.to.trim(),
    subject,
    text,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
