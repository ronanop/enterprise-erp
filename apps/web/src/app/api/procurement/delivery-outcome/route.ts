import { NextResponse } from "next/server";

import { sendDeliveryOutcomeMail } from "@/lib/brevo-mail";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OUTCOMES = new Set(["Delivered", "Failed delivery", "Delayed"]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  if (!to || !EMAIL_PATTERN.test(to)) {
    return NextResponse.json(
      { success: false, message: "Valid recipient email is required." },
      { status: 400 },
    );
  }

  const outcomeRaw = typeof payload.outcome === "string" ? payload.outcome.trim() : "";
  if (!OUTCOMES.has(outcomeRaw)) {
    return NextResponse.json(
      { success: false, message: "Outcome must be Delivered, Delayed, or Failed delivery." },
      { status: 400 },
    );
  }
  const outcome = outcomeRaw as "Delivered" | "Failed delivery" | "Delayed";

  const linesRaw = payload.lines;
  const lines = Array.isArray(linesRaw)
    ? linesRaw
        .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
        .map((row) => ({
          itemName: typeof row.itemName === "string" ? row.itemName : "",
          quantitySent: typeof row.quantitySent === "string" ? row.quantitySent : "",
          hsnSac: typeof row.hsnSac === "string" ? row.hsnSac : "",
          assetNo: typeof row.assetNo === "string" ? row.assetNo : "",
        }))
    : [];

  try {
    await sendDeliveryOutcomeMail({
      to,
      challanNumber: String(payload.challanNumber ?? "").trim(),
      purchaseOrderNumber: String(payload.purchaseOrderNumber ?? "").trim(),
      grnSummary: String(payload.grnSummary ?? "").trim(),
      customerName: String(payload.customerName ?? "").trim(),
      vendorName: String(payload.vendorName ?? "").trim(),
      outcome,
      dispatchDate: String(payload.dispatchDate ?? "").trim(),
      actualDeliveryDate: String(payload.actualDeliveryDate ?? "").trim(),
      trackingNumber: String(payload.trackingNumber ?? "").trim(),
      remarks: String(payload.remarks ?? "").trim(),
      lines,
    });
    return NextResponse.json({ success: true, message: "Delivery outcome notification sent." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email.";
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
