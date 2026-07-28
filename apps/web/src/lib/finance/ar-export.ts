import type { ArAgingBucket, ArEntry } from "@/services/ar-service";
import { downloadCsv, downloadXlsx } from "@/lib/spreadsheet";

function invoiceRowsForExport(rows: ArEntry[]) {
  return rows.map((r) => ({
    "Invoice No": r.document_number,
    Customer: r.customer_name ?? r.customer_code ?? r.customer_id,
    "Invoice Date": r.document_date,
    "Due Date": r.due_date,
    Status: r.status,
    "Workflow Status": r.workflow_status ?? "",
    Currency: r.currency_code,
    Outstanding: r.outstanding_amount ?? r.balance_amount,
    Paid: r.paid_amount ?? 0,
    Balance: r.balance_amount,
    "Document Type": r.document_type,
    "Days Overdue": r.days_overdue ?? "",
    "Created At": r.created_at?.slice(0, 10) ?? "",
  }));
}

function agingRowsForExport(buckets: ArAgingBucket[]) {
  return buckets.map((b) => ({
    Bucket: b.bucket,
    Amount: b.amount,
    Count: b.count,
  }));
}

export function exportArInvoicesCsv(rows: ArEntry[]) {
  downloadCsv(
    `accounts-receivable-${new Date().toISOString().slice(0, 10)}.csv`,
    invoiceRowsForExport(rows),
  );
}

export async function exportArInvoicesXlsx(rows: ArEntry[]) {
  await downloadXlsx(
    `accounts-receivable-${new Date().toISOString().slice(0, 10)}.xlsx`,
    [{ name: "AR Invoices", rows: invoiceRowsForExport(rows) }],
  );
}

export function printArInvoicesTable(title: string, rows: ArEntry[]) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!win) return;
  const body = rows
    .map(
      (r) =>
        `<tr>
          <td>${r.document_number}</td>
          <td>${r.customer_name ?? r.customer_code ?? ""}</td>
          <td>${r.document_date}</td>
          <td>${r.due_date}</td>
          <td>${r.status}</td>
          <td>${r.currency_code}</td>
          <td style="text-align:right">${Number(r.outstanding_amount ?? r.balance_amount).toFixed(2)}</td>
          <td style="text-align:right">${Number(r.paid_amount ?? 0).toFixed(2)}</td>
          <td style="text-align:right">${Number(r.balance_amount).toFixed(2)}</td>
        </tr>`,
    )
    .join("");
  win.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;font-size:12px;color:#0f172a;padding:24px}
      h1{font-size:16px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f8fafc;font-size:11px;text-transform:uppercase}
    </style></head><body>
    <h1>${title}</h1>
    <table><thead><tr>
      <th>Invoice No</th><th>Customer</th><th>Invoice Date</th><th>Due Date</th><th>Status</th><th>Currency</th><th>Outstanding</th><th>Paid</th><th>Balance</th>
    </tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
}

export function exportArAgingCsv(buckets: ArAgingBucket[], asOf: string) {
  downloadCsv(`ar-aging-${asOf}.csv`, agingRowsForExport(buckets));
}

export async function exportArAgingXlsx(buckets: ArAgingBucket[], asOf: string) {
  await downloadXlsx(`ar-aging-${asOf}.xlsx`, [
    { name: "AR Aging", rows: agingRowsForExport(buckets) },
  ]);
}

export function printArAgingTable(title: string, buckets: ArAgingBucket[]) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=800,height=600");
  if (!win) return;
  const body = buckets
    .map(
      (b) =>
        `<tr>
          <td>${b.bucket}</td>
          <td style="text-align:right">${Number(b.amount).toFixed(2)}</td>
          <td style="text-align:right">${b.count}</td>
        </tr>`,
    )
    .join("");
  win.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;font-size:12px;color:#0f172a;padding:24px}
      h1{font-size:16px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#f8fafc;font-size:11px;text-transform:uppercase}
    </style></head><body>
    <h1>${title}</h1>
    <table><thead><tr>
      <th>Bucket</th><th>Amount</th><th>Count</th>
    </tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
}
