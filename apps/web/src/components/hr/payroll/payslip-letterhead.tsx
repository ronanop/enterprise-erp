"use client";

import { formatInr } from "@/services/payroll-management-service";
import { amountInIndianWords } from "@/utils/purchase-order-amount-words";
import {
  payslipFigures,
  payslipProjection,
  type PayslipMoneyRow,
  type PayslipPdfContext,
} from "@/utils/payslip-pdf";
import type { PayslipRecord } from "@/types/payroll-management";

function show(value: string): string {
  return value.trim() ? value : "—";
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
  "Tax calculations are shown only when a tax amount is stored. Declarations such as Section 80C are not estimated.",
  "For any discrepancies, contact HR within 7 days.",
];

export function PayslipLetterhead({
  slip,
  ctx,
}: {
  slip: PayslipRecord;
  ctx: PayslipPdfContext;
}) {
  const figures = payslipFigures(slip);
  const projection = payslipProjection(figures, ctx);

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
        <p className="text-muted-foreground">
          {show(slip.payslipCode)} · {show(ctx.paymentStatus)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg border border-border p-2 sm:grid-cols-2">
        <Field label="Name" value={slip.employeeName} />
        <Field label="Employee ID" value={ctx.employeeCode} />
        <Field label="Designation" value={ctx.designation} />
        <Field label="Department" value={ctx.department} />
        <Field label="Location" value={ctx.location} />
        <Field label="Date of joining" value={ctx.joiningDate} />
        <Field label="Employment type" value={ctx.employmentType} />
        <Field label="PAN" value={ctx.pan} />
        <Field label="UAN" value={ctx.uan} />
        <Field label="Bank account" value={ctx.bank} />
        <Field label="IFSC" value={ctx.ifsc} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Working days", String(figures.salaryDays)],
            ["Present days", String(figures.presentDays)],
            ["Paid leave", String(figures.leaveDays)],
            ["Unpaid leave", figures.unpaidLeaveDays == null ? "—" : String(figures.unpaidLeaveDays)],
            ["LOP days", String(figures.lopDays)],
            ["Late count", show(ctx.lateCount)],
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
          totalLabel="Total earnings (A)"
          totalMonthly={figures.monthlyGross}
          totalYearly={figures.yearlyGross}
        />
        <MoneyTable
          title="Deductions (B)"
          rows={figures.deductions}
          totalLabel="Total deductions (B)"
          totalMonthly={figures.monthlyDeductions}
          totalYearly={figures.yearlyDeductions}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">Net payable salary</p>
          <p className="text-base font-semibold tabular-nums">{formatInr(figures.net)}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{amountInIndianWords(figures.net)}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-[10px] text-muted-foreground">Cost to company (monthly)</p>
          <p className="font-semibold tabular-nums">{formatInr(figures.costToCompany)}</p>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <p className="text-[10px] text-muted-foreground">Employer contribution (monthly)</p>
          <p>PF (employer) {formatInr(figures.employerPf)}</p>
          <p>ESI (employer) {formatInr(figures.employerEsi)}</p>
          <p className="font-semibold">Total {formatInr(figures.employerContribution)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border p-2">
          <p className="text-[11px] font-semibold">Year to date {ctx.yearLabel ? `(${ctx.yearLabel})` : ""}</p>
          <FieldLine label="Total earnings" value={moneyOrBlank(ctx.ytdEarnings)} />
          <FieldLine label="Total deductions" value={moneyOrBlank(ctx.ytdDeductions)} />
          <FieldLine label="Net salary paid" value={moneyOrBlank(ctx.ytdNet)} />
          <FieldLine label="TDS deducted" value={moneyOrBlank(ctx.ytdTds)} />
          <FieldLine label="PF (employee)" value={moneyOrBlank(ctx.ytdPf)} />
          <FieldLine label="Professional tax" value={moneyOrBlank(ctx.ytdProfessionalTax)} />
          <FieldLine label="LOP deduction" value={moneyOrBlank(ctx.ytdLop)} />
        </div>
        <div className="rounded-md border border-border p-2">
          <p className="text-[11px] font-semibold">Annual projection {ctx.yearLabel ? `(${ctx.yearLabel})` : ""}</p>
          <FieldLine label="Projected earnings" value={formatInr(projection.earnings)} />
          <FieldLine label="Projected deductions" value={formatInr(projection.deductions)} />
          <FieldLine label="Projected net salary" value={formatInr(projection.net)} />
          <FieldLine label="Projected TDS" value={formatInr(projection.tdsYear)} />
          <FieldLine label="Balance months" value={String(ctx.monthsLeft)} />
          <FieldLine
            label="Estimated TDS (next 3 months)"
            value={formatInr(projection.nextTds)}
          />
          <FieldLine
            label="Estimated net (next 3 months)"
            value={projection.nextNet == null ? "—" : formatInr(projection.nextNet)}
          />
        </div>
        <div className="rounded-md border border-border p-2">
          <p className="text-[11px] font-semibold">Tax summary</p>
          <FieldLine label="Annual gross salary" value={formatInr(projection.earnings)} />
          <FieldLine label="Standard deduction" value="—" />
          <FieldLine label="HRA exemption" value="—" />
          <FieldLine label="Section 80C" value="—" />
          <FieldLine label="Section 80D" value="—" />
          <FieldLine label="Taxable income" value="—" />
          <FieldLine label="Estimated annual tax" value={formatInr(projection.tdsYear)} />
          <FieldLine label="TDS deducted (YTD)" value={moneyOrBlank(ctx.ytdTds)} />
          <FieldLine
            label="Balance TDS"
            value={formatInr(Math.max(0, projection.tdsYear - (ctx.ytdTds ?? 0)))}
          />
        </div>
      </div>

      <div className="rounded-md border border-border p-2">
        <p className="text-[11px] font-semibold">Next months TDS</p>
        {ctx.nextMonths.length === 0 ? (
          <p className="mt-1 text-muted-foreground">—</p>
        ) : (
          <table className="mt-1 w-full text-[11px]">
            <tbody>
              {ctx.nextMonths.map((key) => (
                <tr key={key}>
                  <td className="py-0.5">{monthLabelFromKey(key)}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {formatInr(projection.monthTds)}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-0.5">Total</td>
                <td className="py-0.5 text-right tabular-nums">
                  {formatInr(projection.monthTds * ctx.nextMonths.length)}
                </td>
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
