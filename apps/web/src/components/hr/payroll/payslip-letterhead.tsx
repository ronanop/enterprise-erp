"use client";

import { formatInr } from "@/services/payroll-management-service";
import { amountInIndianWords } from "@/utils/purchase-order-amount-words";
import {
  buildPayslipView,
  capitalizeWords,
  type PayslipMoneyRow,
  type PayslipPdfContext,
} from "@/utils/payslip-pdf";
import type { PayslipRecord } from "@/types/payroll-management";

function show(value: string): string {
  return value.trim() ? value : "—";
}

function showName(value: string): string {
  const text = value.trim();
  return text ? capitalizeWords(text) : "—";
}

function moneyOrBlank(value: number | null): string {
  return value == null ? "—" : formatInr(value);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label} </span>
      {show(value)}
    </p>
  );
}

function MoneyTable({
  title,
  rows,
  totalLabel,
  totalMonthly,
  totalYearly,
}: {
  title: string;
  rows: PayslipMoneyRow[];
  totalLabel: string;
  totalMonthly: number;
  totalYearly: number;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="bg-foreground px-2 py-1.5 text-[11px] font-semibold text-background">{title}</div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-2 py-1 text-left font-medium">Component</th>
            <th className="px-2 py-1 text-right font-medium">Monthly</th>
            <th className="px-2 py-1 text-right font-medium">Yearly</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-2 py-2 text-muted-foreground" colSpan={3}>
                —
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.label} className="border-b border-border/70">
                <td className="px-2 py-1">{row.label}</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatInr(row.monthly)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatInr(row.yearly)}</td>
              </tr>
            ))
          )}
          <tr className="font-semibold">
            <td className="px-2 py-1.5">{totalLabel}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(totalMonthly)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(totalYearly)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const NOTES = [
  "This is a system generated payslip and does not require a signature.",
  "Salary is processed based on attendance and company policies.",
  "Tax calculations are based on current declarations and may change subject to actual investments.",
  "For any discrepancies, contact HR within 7 days.",
];

export function PayslipLetterhead({
  slip,
  ctx,
}: {
  slip: PayslipRecord;
  ctx: PayslipPdfContext;
}) {
  const { figures, projection } = buildPayslipView(slip, ctx);
  const tax = projection.tax;
  const nextMonthTds =
    ctx.nextMonths.length > 0
      ? Math.round(projection.nextTds / Math.min(3, ctx.nextMonths.length))
      : 0;

  return (
    <div className="space-y-3 text-xs text-foreground">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
        {ctx.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ctx.logoUrl} alt="" className="h-12 w-auto max-w-[140px] object-contain" />
        ) : (
          <p className="text-[10px] text-muted-foreground">No company logo</p>
        )}
        <div className="max-w-[60%] text-right">
          <p className="text-sm font-semibold">{show(ctx.entityName)}</p>
          {ctx.entityAddress.length === 0 ? (
            <p className="text-muted-foreground">—</p>
          ) : (
            ctx.entityAddress.map((line) => (
              <p key={line} className="text-muted-foreground">
                {line}
              </p>
            ))
          )}
          <p className="text-muted-foreground">PAN {show(ctx.entityPan)}</p>
          <p className="text-muted-foreground">TAN {show(ctx.entityTan)}</p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold tracking-wide">SALARY SLIP</p>
        <p className="text-muted-foreground">For the month of {slip.monthLabel}</p>
        <p className="text-muted-foreground">{show(slip.payslipCode)}</p>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border border-border p-2 sm:grid-cols-2">
        <Field label="Employee Name" value={showName(slip.employeeName)} />
        <Field label="Employment Type" value={show(ctx.employmentType)} />
        <Field label="Employee ID" value={ctx.employeeCode} />
        <Field label="Designation" value={show(ctx.designation)} />
        <Field label="Department" value={show(ctx.department)} />
        <Field label="Location" value={show(ctx.location)} />
        <Field label="Date Of Joining" value={ctx.joiningDate} />
        <Field label="PAN" value={ctx.pan} />
        <Field label="UAN" value={ctx.uan} />
        <Field label="Bank Account Number" value={ctx.bankAccountNumber} />
        <Field label="Bank Name" value={show(ctx.bankName)} />
        <Field label="IFSC" value={ctx.ifsc} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Working Days", String(figures.salaryDays)],
            ["Present Days", String(figures.presentDays)],
            ["Paid Leave", String(figures.leaveDays)],
            ["Unpaid Leave", figures.unpaidLeaveDays == null ? "—" : String(figures.unpaidLeaveDays)],
            ["LOP Days", String(figures.lopDays)],
            ["Late Count", show(ctx.lateCount)],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-md border border-border px-2 py-1.5 text-center">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyTable
          title="Earnings (A)"
          rows={figures.earnings}
          totalLabel="Total Earnings (A)"
          totalMonthly={figures.monthlyGross}
          totalYearly={figures.yearlyGross}
        />
        <MoneyTable
          title="Deductions (B)"
          rows={figures.deductions}
          totalLabel="Total Deductions (B)"
          totalMonthly={figures.monthlyDeductions}
          totalYearly={figures.yearlyDeductions}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">Net Payable Salary</p>
          <p className="text-base font-semibold tabular-nums">{formatInr(figures.net)}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{amountInIndianWords(figures.net)}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-[10px] text-muted-foreground">Cost To Company (Monthly)</p>
          <p className="font-semibold tabular-nums">{formatInr(figures.costToCompany)}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-[10px] text-muted-foreground">Employer Contribution (Monthly)</p>
          <p>PF (Employer) {formatInr(figures.employerPf)}</p>
          <p>ESI (Employer) {formatInr(figures.employerEsi)}</p>
          <p className="font-semibold">Total {formatInr(figures.employerContribution)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border p-2">
          <p className="text-[11px] font-semibold">Year To Date {ctx.yearLabel ? `(${ctx.yearLabel})` : ""}</p>
          <FieldLine label="Total Earnings" value={moneyOrBlank(ctx.ytdEarnings)} />
          <FieldLine label="Total Deductions" value={moneyOrBlank(ctx.ytdDeductions)} />
          <FieldLine label="Net Salary Paid" value={moneyOrBlank(ctx.ytdNet)} />
          <FieldLine label="TDS Deducted" value={formatInr(tax.ytdTds)} />
          <FieldLine label="PF (Employee)" value={moneyOrBlank(ctx.ytdPf)} />
          <FieldLine label="Professional Tax" value={moneyOrBlank(ctx.ytdProfessionalTax)} />
          <FieldLine label="LOP Deduction" value={moneyOrBlank(ctx.ytdLop)} />
        </div>
        <div className="rounded-md border border-border p-2">
          <p className="text-[11px] font-semibold">Annual Projection {ctx.yearLabel ? `(${ctx.yearLabel})` : ""}</p>
          <FieldLine label="Projected Earnings" value={formatInr(projection.earnings)} />
          <FieldLine label="Projected Deductions" value={formatInr(projection.deductions)} />
          <FieldLine label="Projected Net Salary" value={formatInr(projection.net)} />
          <FieldLine label="Projected TDS" value={formatInr(projection.tdsYear)} />
          <FieldLine label="Balance Months" value={String(ctx.monthsLeft)} />
          <FieldLine
            label="Estimated TDS (Next 3 Months)"
            value={formatInr(projection.nextTds)}
          />
          <FieldLine
            label="Estimated Net (Next 3 Months)"
            value={projection.nextNet == null ? "—" : formatInr(projection.nextNet)}
          />
        </div>
        <div className="rounded-md border border-border p-2">
          <p className="text-[11px] font-semibold">Tax Summary</p>
          <FieldLine label="Annual Gross Salary" value={formatInr(tax.annualGross)} />
          <FieldLine label="Standard Deduction" value={formatInr(tax.standardDeduction)} />
          <FieldLine label="HRA Exemption" value={formatInr(tax.hraExemption)} />
          <FieldLine label="Section 80C" value={formatInr(tax.section80C)} />
          <FieldLine label="Section 80D" value={formatInr(tax.section80D)} />
          <FieldLine label="Taxable Income" value={formatInr(tax.taxableIncome)} />
          <FieldLine label="Estimated Annual Tax" value={formatInr(tax.estimatedAnnualTax)} />
          <FieldLine label="TDS Deducted (YTD)" value={formatInr(tax.ytdTds)} />
          <FieldLine label="Balance TDS" value={formatInr(tax.balanceTds)} />
        </div>
      </div>

      <div className="rounded-md border border-border p-2">
        <p className="text-[11px] font-semibold">Next Months TDS</p>
        {ctx.nextMonths.length === 0 ? (
          <p className="mt-1 text-muted-foreground">—</p>
        ) : (
          <table className="mt-1 w-full text-[11px]">
            <tbody>
              {ctx.nextMonths.map((key) => (
                <tr key={key}>
                  <td className="py-0.5">{monthLabelFromKey(key)}</td>
                  <td className="py-0.5 text-right tabular-nums">{formatInr(nextMonthTds)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-0.5">Total</td>
                <td className="py-0.5 text-right tabular-nums">{formatInr(projection.nextTds)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <ol className="list-decimal space-y-0.5 pl-4 text-[10px] text-muted-foreground">
        {NOTES.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ol>
    </div>
  );
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-1 flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </p>
  );
}

function monthLabelFromKey(key: string): string {
  const date = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
