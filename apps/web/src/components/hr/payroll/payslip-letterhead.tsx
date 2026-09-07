"use client";

import { CACHE_LOGO_PATH } from "@/utils/load-cache-logo";
import { formatInr } from "@/services/payroll-management-service";
import { amountInIndianWords } from "@/utils/purchase-order-amount-words";
import type { PayslipPdfContext } from "@/utils/payslip-pdf";
import type { PayslipRecord } from "@/types/payroll-management";

export function PayslipLetterhead({
  slip,
  ctx,
}: {
  slip: PayslipRecord;
  ctx: PayslipPdfContext;
}) {
  const earn = slip.earnings.filter((e) => e.amount !== 0 || e.label.toLowerCase() === "basic");
  const deduct = slip.deductions.filter((d) => (d.label || "").toLowerCase() !== "pf (total)");
  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CACHE_LOGO_PATH} alt="Cache" className="h-10 w-auto object-contain" />
        <div className="max-w-[60%] text-right">
          <p className="text-sm font-semibold">{ctx.entity.displayName}</p>
          {ctx.entity.addressLines.map((line) => (
            <p key={line} className="text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-wide">SALARY SLIP</p>
        <p className="text-muted-foreground">For the month of {slip.monthLabel}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border/70 p-2">
        <p>
          <span className="text-muted-foreground">Employee</span> {slip.employeeName}
        </p>
        <p>
          <span className="text-muted-foreground">Code</span> {ctx.employeeCode || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Designation</span> {ctx.designation}
        </p>
        <p>
          <span className="text-muted-foreground">Department</span> {ctx.department}
        </p>
        <p>
          <span className="text-muted-foreground">Payable</span>{" "}
          {slip.payableDays ?? slip.presentDays ?? "—"} / {slip.periodDays ?? 30}
        </p>
        <p>
          <span className="text-muted-foreground">LOP</span> {slip.lopDays ?? 0}
        </p>
        <p className="col-span-2">
          <span className="text-muted-foreground">Bank</span> {ctx.bank}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 font-semibold">Earnings</p>
          {earn.map((e) => (
            <div key={e.label} className="flex justify-between tabular-nums">
              <span>{e.label}</span>
              <span>{formatInr(e.amount)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1 font-medium tabular-nums">
            <span>Gross</span>
            <span>{formatInr(slip.gross)}</span>
          </div>
        </div>
        <div>
          <p className="mb-1 font-semibold">Deductions</p>
          {deduct.map((d) => (
            <div key={d.label} className="flex justify-between tabular-nums">
              <span>{d.label}</span>
              <span>{formatInr(d.amount)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1 font-medium tabular-nums">
            <span>Total</span>
            <span>{formatInr(slip.totalDeductions)}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-between rounded-lg bg-muted/50 px-3 py-2 font-semibold">
        <span>Net pay</span>
        <span className="tabular-nums">{formatInr(slip.net)}</span>
      </div>
      <p className="text-muted-foreground">{amountInIndianWords(slip.net)}</p>
    </div>
  );
}
