import path from "node:path";

import { config } from "dotenv";
import nodemailer, { type Transporter } from "nodemailer";

let envLoaded = false;

function loadMailEnv(): void {
  if (envLoaded) return;
  const root = process.cwd();
  config({ path: path.join(root, ".env.local") });
  config({ path: path.join(root, ".env") });
  config({ path: path.join(root, "../../.env") });
  envLoaded = true;
}

type SmtpRuntimeConfig = {
  from: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

/** Prefer Hostinger/generic SMTP_*; fall back to Brevo relay credentials. */
export function getSmtpRuntimeConfig(): SmtpRuntimeConfig | null {
  loadMailEnv();

  const smtpHost = process.env.SMTP_HOST?.trim() || "";
  const smtpUser = process.env.SMTP_USER?.trim() || "";
  const smtpPass = process.env.SMTP_PASSWORD?.trim() || "";
  const smtpFrom =
    process.env.SMTP_FROM_ADDRESS?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    smtpUser;
  if (smtpHost && smtpUser && smtpPass && smtpFrom) {
    const port = Number(process.env.SMTP_PORT || "465") || 465;
    const useTls = (process.env.SMTP_USE_TLS || "true").toLowerCase() !== "false";
    return {
      from: smtpFrom,
      host: smtpHost,
      port,
      secure: port === 465 || useTls,
      user: smtpUser,
      pass: smtpPass,
    };
  }

  const brevoFrom =
    process.env.BREVO_EMAIL?.trim() ||
    process.env.brevo_email?.trim() ||
    "";
  const brevoKey =
    process.env.BREVO_SMTP_KEY?.trim() ||
    process.env.BREVO_SMTP_PASS?.trim() ||
    process.env.brevo_smtp_key?.trim() ||
    "";
  if (brevoFrom && brevoKey) {
    return {
      from: brevoFrom,
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      user: brevoFrom,
      pass: brevoKey,
    };
  }

  return null;
}

/** @deprecated Use getSmtpRuntimeConfig — kept for older call sites. */
export function getBrevoConfig(): { from: string; smtpKey: string } | null {
  const cfg = getSmtpRuntimeConfig();
  if (!cfg) return null;
  return { from: cfg.from, smtpKey: cfg.pass };
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const cfg = getSmtpRuntimeConfig();
  if (!cfg) {
    throw new Error(
      "SMTP is not configured (set SMTP_HOST/SMTP_USER/SMTP_PASSWORD/SMTP_FROM_ADDRESS, or BREVO_EMAIL/BREVO_SMTP_KEY).",
    );
  }
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
  return transporter;
}

function requireSmtpFrom(): string {
  const cfg = getSmtpRuntimeConfig();
  if (!cfg) {
    throw new Error("SMTP is not configured.");
  }
  return cfg.from;
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
  const fromAddress = requireSmtpFrom();

  const po = input.purchaseOrderNumber.trim() || "-";
  const subject = `Delivery tomorrow - ${input.challanNumber} (${po})`;
  const text = [
    "Hello,",
    "",
    "This is a reminder that your shipment is scheduled for delivery tomorrow.",
    "",
    `Challan: ${input.challanNumber}`,
    `PO: ${po}`,
    `Expected delivery date: ${input.expectedDeliveryDate}`,
    "",
    "- iConnect Plus Procurement",
  ].join("\n");

  const html = `
    <p>Hello,</p>
    <p>This is a reminder that your shipment is scheduled for <strong>delivery tomorrow</strong>.</p>
    <ul>
      <li><strong>Challan:</strong> ${escapeHtml(input.challanNumber)}</li>
      <li><strong>PO:</strong> ${escapeHtml(po)}</li>
      <li><strong>Expected delivery:</strong> ${escapeHtml(input.expectedDeliveryDate)}</li>
    </ul>
    <p style="color:#64748b;font-size:12px">iConnect Plus Procurement</p>
  `;

  await getTransporter().sendMail({
    from: `"iConnect Plus" <${fromAddress}>`,
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
      <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${escapeHtml(line.quantitySent.trim() || "-")}</td>
      <td style="padding:8px;border:1px solid #e2e8f0">${escapeHtml((line.hsnSac ?? "").trim() || "-")}</td>
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
        `  ${index + 1}. ${line.itemName} - Qty ${line.quantitySent.trim() || "-"}${line.hsnSac?.trim() ? ` (HSN ${line.hsnSac.trim()})` : ""}`,
    )
    .join("\n");
  return `Items:\n${linesText}\n`;
}

export type DeliveryDeliveredMailInput = {
  to: string;
  challanNumber: string;
  purchaseOrderNumber: string;
  grnSummary: string;
  customerName: string;
  vendorName: string;
  actualDeliveryDate: string;
  trackingNumber?: string;
  lines: DeliveryDispatchLineItem[];
};

export async function sendDeliveryDeliveredMail(
  input: DeliveryDeliveredMailInput,
): Promise<void> {
  const fromAddress = requireSmtpFrom();

  const po = input.purchaseOrderNumber.trim() || "-";
  const grn = input.grnSummary.trim() || "-";
  const subject = `Your order has been delivered - ${input.challanNumber} (${po})`;

  const metaLines = [
    `Challan: ${input.challanNumber}`,
    `PO: ${po}`,
    `GRN: ${grn}`,
    `Customer: ${input.customerName.trim() || "-"}`,
    `Vendor: ${input.vendorName.trim() || "-"}`,
    `Delivered on: ${input.actualDeliveryDate.trim() || "-"}`,
  ];
  if (input.trackingNumber?.trim()) {
    metaLines.push(`Tracking: ${input.trackingNumber.trim()}`);
  }

  const text = [
    "Hello,",
    "",
    "Your items have been delivered. Details are below.",
    "",
    ...metaLines,
    "",
    buildItemsTableText(input.lines),
    "- iConnect Plus Procurement",
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.5;max-width:640px">
      <p>Hello${input.customerName.trim() ? ` ${escapeHtml(input.customerName.trim())}` : ""},</p>
      <p>Your items have been <strong>delivered</strong>. Summary:</p>
      <table style="font-size:14px;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Challan</td><td><strong>${escapeHtml(input.challanNumber)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">PO</td><td>${escapeHtml(po)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">GRN</td><td>${escapeHtml(grn)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Customer</td><td>${escapeHtml(input.customerName.trim() || "-")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Vendor</td><td>${escapeHtml(input.vendorName.trim() || "-")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Delivered on</td><td>${escapeHtml(input.actualDeliveryDate.trim() || "-")}</td></tr>
        ${input.trackingNumber?.trim() ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Tracking</td><td>${escapeHtml(input.trackingNumber.trim())}</td></tr>` : ""}
      </table>
      <p style="margin:16px 0 8px;font-weight:600">Items</p>
      ${buildItemsTableHtml(input.lines)}
      <p style="color:#64748b;font-size:12px;margin-top:24px">iConnect Plus Procurement</p>
    </div>
  `;

  await getTransporter().sendMail({
    from: `"iConnect Plus" <${fromAddress}>`,
    to: input.to.trim(),
    subject,
    text,
    html,
  });
}

export type DeliveryOutcomeMailInput = {
  to: string;
  challanNumber: string;
  purchaseOrderNumber: string;
  grnSummary: string;
  customerName: string;
  vendorName: string;
  outcome: "Delivered" | "Failed delivery" | "Delayed";
  dispatchDate?: string;
  actualDeliveryDate?: string;
  trackingNumber?: string;
  remarks?: string;
  lines: DeliveryDispatchLineItem[];
};

export async function sendDeliveryOutcomeMail(input: DeliveryOutcomeMailInput): Promise<void> {
  const fromAddress = requireSmtpFrom();

  const po = input.purchaseOrderNumber.trim() || "-";
  const grn = input.grnSummary.trim() || "-";
  const outcome = input.outcome;
  const remarks = (input.remarks || "").trim();
  const subject =
    outcome === "Delivered"
      ? `Your order has been delivered - ${input.challanNumber} (${po})`
      : outcome === "Delayed"
        ? `Your delivery is delayed - ${input.challanNumber} (${po})`
        : `Delivery update: failed - ${input.challanNumber} (${po})`;

  const headline =
    outcome === "Delivered"
      ? "Your order has been delivered."
      : outcome === "Delayed"
        ? "Your delivery has been delayed."
        : "Delivery of your order could not be completed.";

  const metaLines = [
    `Challan: ${input.challanNumber}`,
    `PO: ${po}`,
    `GRN: ${grn}`,
    `Customer: ${input.customerName.trim() || "-"}`,
    `Vendor: ${input.vendorName.trim() || "-"}`,
    `Outcome: ${outcome === "Failed delivery" ? "Failed" : outcome}`,
  ];
  if (input.dispatchDate?.trim()) {
    metaLines.push(`Dispatch date: ${input.dispatchDate.trim()}`);
  }
  if (outcome === "Delivered" && input.actualDeliveryDate?.trim()) {
    metaLines.push(`Delivered on: ${input.actualDeliveryDate.trim()}`);
  }
  if (input.trackingNumber?.trim()) {
    metaLines.push(`AWB / Tracking: ${input.trackingNumber.trim()}`);
  }
  if ((outcome === "Delayed" || outcome === "Failed delivery") && remarks) {
    metaLines.push(`Remarks: ${remarks}`);
  }

  const text = [
    "Hello,",
    "",
    headline,
    "",
    ...metaLines,
    "",
    buildItemsTableText(input.lines),
    "- iConnect Plus Procurement",
  ].join("\n");

  const customerGreeting = input.customerName.trim()
    ? ` ${escapeHtml(input.customerName.trim())}`
    : "";
  const outcomeLabel =
    outcome === "Failed delivery" ? "Failed" : escapeHtml(outcome);

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.5;max-width:640px">
      <p>Hello${customerGreeting},</p>
      <p>${escapeHtml(headline)}</p>
      <table style="font-size:14px;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Challan</td><td><strong>${escapeHtml(input.challanNumber)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">PO</td><td>${escapeHtml(po)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">GRN</td><td>${escapeHtml(grn)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Customer</td><td>${escapeHtml(input.customerName.trim() || "-")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Vendor</td><td>${escapeHtml(input.vendorName.trim() || "-")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Outcome</td><td><strong>${outcomeLabel}</strong></td></tr>
        ${input.dispatchDate?.trim() ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Dispatch date</td><td>${escapeHtml(input.dispatchDate.trim())}</td></tr>` : ""}
        ${outcome === "Delivered" && input.actualDeliveryDate?.trim() ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Delivered on</td><td>${escapeHtml(input.actualDeliveryDate.trim())}</td></tr>` : ""}
        ${input.trackingNumber?.trim() ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">AWB / Tracking</td><td>${escapeHtml(input.trackingNumber.trim())}</td></tr>` : ""}
        ${(outcome === "Delayed" || outcome === "Failed delivery") && remarks ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;vertical-align:top">Remarks</td><td>${escapeHtml(remarks).replace(/\n/g, "<br/>")}</td></tr>` : ""}
      </table>
      <p style="margin:16px 0 8px;font-weight:600">Items</p>
      ${buildItemsTableHtml(input.lines)}
      <p style="color:#64748b;font-size:12px;margin-top:24px">iConnect Plus Procurement</p>
    </div>
  `;

  await getTransporter().sendMail({
    from: `"iConnect Plus" <${fromAddress}>`,
    to: input.to.trim(),
    subject,
    text,
    html,
  });
}

export async function sendDeliveryDispatchMail(input: DeliveryDispatchMailInput): Promise<void> {
  const fromAddress = requireSmtpFrom();

  const po = input.purchaseOrderNumber.trim() || "-";
  const grn = input.grnSummary.trim() || "-";
  const awb = (input.trackingNumber || "").trim();
  const courier = (input.courierTransportDetails || "").trim();
  const subject = `Your order is out for delivery - ${input.challanNumber} (${po})`;

  const metaLines = [
    `Challan: ${input.challanNumber}`,
    `PO: ${po}`,
    `GRN: ${grn}`,
    `Customer: ${input.customerName.trim() || "-"}`,
    `Vendor: ${input.vendorName.trim() || "-"}`,
    `Status: Out for delivery`,
    `Dispatch date: ${input.dispatchDate || "-"}`,
  ];
  if (input.expectedDeliveryDate?.trim()) {
    metaLines.push(`Expected delivery: ${input.expectedDeliveryDate.trim()}`);
  }
  if (courier) {
    metaLines.push(`Courier: ${courier}`);
  }
  if (awb) {
    metaLines.push(`AWB / Docket number: ${awb}`);
  }

  const text = [
    "Hello,",
    "",
    "Your order is out for delivery. Details are below.",
    "",
    ...metaLines,
    "",
    buildItemsTableText(input.lines),
    "- iConnect Plus Procurement",
  ].join("\n");

  const customerGreeting = input.customerName.trim()
    ? ` ${escapeHtml(input.customerName.trim())}`
    : "";

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.5;max-width:640px">
      <p>Hello${customerGreeting},</p>
      <p>Your order is <strong>out for delivery</strong>. Summary:</p>
      <table style="font-size:14px;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Challan</td><td><strong>${escapeHtml(input.challanNumber)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">PO</td><td>${escapeHtml(po)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">GRN</td><td>${escapeHtml(grn)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Customer</td><td>${escapeHtml(input.customerName.trim() || "-")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Vendor</td><td>${escapeHtml(input.vendorName.trim() || "-")}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Status</td><td>Out for delivery</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Dispatch date</td><td>${escapeHtml(input.dispatchDate || "-")}</td></tr>
        ${input.expectedDeliveryDate?.trim() ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Expected delivery</td><td>${escapeHtml(input.expectedDeliveryDate.trim())}</td></tr>` : ""}
        ${courier ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Courier</td><td>${escapeHtml(courier)}</td></tr>` : ""}
        ${awb ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">AWB / Docket number</td><td><strong>${escapeHtml(awb)}</strong></td></tr>` : ""}
      </table>
      <p style="margin:16px 0 8px;font-weight:600">Items</p>
      ${buildItemsTableHtml(input.lines)}
      <p style="color:#64748b;font-size:12px;margin-top:24px">iConnect Plus Procurement</p>
    </div>
  `;

  await getTransporter().sendMail({
    from: `"iConnect Plus" <${fromAddress}>`,
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
