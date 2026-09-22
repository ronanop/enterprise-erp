import { NextResponse } from "next/server";

import { buildOrdersExcelBuffer } from "@/utils/orders-excel-buffer";
import type { OrderExportRow } from "@/utils/order-export-shared";

export const runtime = "nodejs";

type ExportBody = {
  filename?: string;
  rows?: OrderExportRow[];
};

export async function POST(request: Request) {
  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  const filename =
    (body.filename || "purchase-orders-export.xlsx").replace(/[^\w.\-]+/g, "_");

  try {
    const buffer = await buildOrdersExcelBuffer(rows);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message.trim()
        ? err.message
        : "Failed to build Excel export";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
