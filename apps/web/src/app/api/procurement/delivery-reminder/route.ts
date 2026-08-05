import { NextResponse } from "next/server";

import { sendDeliveryReminderMail } from "@/lib/brevo-mail";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const challanNumber =
    typeof payload.challanNumber === "string" ? payload.challanNumber.trim() : "";
  const purchaseOrderNumber =
    typeof payload.purchaseOrderNumber === "string" ? payload.purchaseOrderNumber.trim() : "";
  const expectedDeliveryDate =
    typeof payload.expectedDeliveryDate === "string" ? payload.expectedDeliveryDate.trim() : "";

  if (!to || !EMAIL_PATTERN.test(to)) {
    return NextResponse.json(
      { success: false, message: "Valid recipient email is required." },
      { status: 400 },
    );
  }
  if (!challanNumber || !expectedDeliveryDate) {
    return NextResponse.json(
      { success: false, message: "Challan number and expected delivery date are required." },
      { status: 400 },
    );
  }

  try {
    await sendDeliveryReminderMail({
      to,
      challanNumber,
      purchaseOrderNumber,
      expectedDeliveryDate,
    });
    return NextResponse.json({ success: true, message: "Reminder email sent." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email.";
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
