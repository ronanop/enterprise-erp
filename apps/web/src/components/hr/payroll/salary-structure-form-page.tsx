"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Pencil } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SetupField, SetupInput } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { cn } from "@/lib/utils";
import {
  EXCEL_DEFAULTS,
  computeCtcSplit,
  computePayablePreview,
  amountsFromSplit,
} from "@/lib/salary-structure-excel";
import { formatInr } from "@/services/payroll-service";
import {
  getCachedPayrollPfPolicy,
  loadResolvedPayrollPfPolicy,
  employeePfAmount,
  type PayrollPfPolicy,
} from "@/lib/payroll-pf-policy";
import {
  createStructure,
  getSalaryStructure,
  updateStructure,
} from "@/services/payroll-management-service";
import type { SalaryStructure } from "@/types/payroll-management";

const LIST_HREF = "/hr/payroll?section=salary-structure";

function pctToFraction(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

function fractionToPct(value: number | undefined, fallback: number): string {
  const n = value ?? fallback;
  const pct = n * 100;
  return Number.isInteger(pct) ? String(pct) : String(Number(pct.toFixed(4)));
}

export function SalaryStructureFormPage({
  structureId,
  readOnly = false,
}: {
  structureId?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const isNew = !structureId;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState<"draft" | "active" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<SalaryStructure | null>(null);

  const [name, setName] = useState("India Standard");
  const [code, setCode] = useState("");
  const [grossCtc, setGrossCtc] = useState("18000");
  const [basicPct, setBasicPct] = useState("60");
  const [hraPct, setHraPct] = useState("50");
  const [telephone, setTelephone] = useState("0");
  const [employer, setEmployer] = useState("1800");
  const [edli, setEdli] = useState("100");
  const [esiPct, setEsiPct] = useState("0.75");
  const [esiCeiling, setEsiCeiling] = useState("21000");
  const [totalDays, setTotalDays] = useState("30");
  const [payableDays, setPayableDays] = useState("30");
  const [pfPolicy, setPfPolicy] = useState<PayrollPfPolicy>(() => getCachedPayrollPfPolicy());

  const applyRow = useCallback((row: SalaryStructure) => {
    setExisting(row);
    setName(row.name);
    setCode(row.code ?? "");
    const gross = row.grossCtc && row.grossCtc > 0 ? row.grossCtc : row.ctcAmount || 0;
    setGrossCtc(String(gross));
    setBasicPct(fractionToPct(row.basicPercent, EXCEL_DEFAULTS.basicPercent));
    setHraPct(fractionToPct(row.hraPercentOfBasic, EXCEL_DEFAULTS.hraPercentOfBasic));
    setTelephone(String(row.telephoneAllowance ?? 0));
    setEmployer(String(row.employerContribution ?? row.pf ?? EXCEL_DEFAULTS.employerContribution));
    setEdli(String(row.edliAdminAmount ?? EXCEL_DEFAULTS.edliAdminAmount));
    setEsiPct(fractionToPct(row.esiPercent, EXCEL_DEFAULTS.esiPercent));
    setEsiCeiling(String(row.esiMonthlyCeiling ?? EXCEL_DEFAULTS.esiMonthlyCeiling));
  }, []);

  useEffect(() => {
    if (!structureId) return;
    let cancelled = false;
    setLoading(true);
    void getSalaryStructure(structureId)
      .then((row) => {
        if (cancelled) return;
        if (!row) {
          setError("Salary structure not found.");
          return;
        }
        applyRow(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load structure");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [structureId, applyRow]);

  useEffect(() => {
    void loadResolvedPayrollPfPolicy().then(setPfPolicy);
  }, []);

  const split = useMemo(
    () =>
      computeCtcSplit({
        grossCtc: Number(grossCtc) || 0,
        basicPercent: pctToFraction(basicPct),
        hraPercentOfBasic: pctToFraction(hraPct),
        telephoneAllowance: Number(telephone) || 0,
        employerContribution: Number(employer) || 0,
      }),
    [grossCtc, basicPct, hraPct, telephone, employer],
  );

  const preview = useMemo(() => {
    const days = Number(totalDays) || 30;
    const payable = Number(payableDays) || 0;
    const raw = computePayablePreview(split, {
      pfPercent: pfPolicy.pf_employee_percent,
      pfWageCeiling: pfPolicy.pf_wage_ceiling,
      pfFixedCeiling: pfPolicy.pf_employee_amount,
      edliAdminAmount: Number(edli) || 0,
      esiPercent: pctToFraction(esiPct),
      esiMonthlyCeiling: Number(esiCeiling) || 0,
      totalDays: days,
      payableDays: payable,
      advanceArrear: 0,
    });
    const factor = days > 0 ? Math.min(1, Math.max(0, payable / days)) : 1;
    const pf = employeePfAmount(pfPolicy, {
      monthlyBasic: split.basic,
      cycleBasic: raw.payableBasic,
      factor,
    });
    const totalDed = Math.round(raw.totalDed - raw.pf + pf);
    return { ...raw, pf, totalDed, net: Math.round(raw.gross - totalDed) };
  }, [split, pfPolicy, edli, esiPct, esiCeiling, totalDays, payableDays]);

  function toInput(status: "draft" | "active"): Omit<SalaryStructure, "id" | "createdAt"> {
    return {
      ...amountsFromSplit(split),
      name: name.trim(),
      code: code.trim() || existing?.code,
      status,
      effectiveFrom: existing?.effectiveFrom,
      basicPercent: pctToFraction(basicPct),
      hraPercentOfBasic: pctToFraction(hraPct),
      pfPercent: pfPolicy.pf_employee_percent,
      pfWageCeiling: pfPolicy.pf_wage_ceiling,
      pfFixedCeiling: pfPolicy.pf_employee_amount,
      edliAdminAmount: Number(edli) || EXCEL_DEFAULTS.edliAdminAmount,
      esiPercent: pctToFraction(esiPct),
      esiMonthlyCeiling: Number(esiCeiling) || EXCEL_DEFAULTS.esiMonthlyCeiling,
    };
  }

  async function save(status: "draft" | "active") {
    if (!name.trim() || split.monthlyCtc <= 0) {
      toast("Enter a name and Gross CTC greater than 0", "error");
      return;
    }
    setSaving(status);
    setError(null);
    try {
      const input = toInput(status);
      if (structureId) {
        await updateStructure(structureId, input);
        toast(status === "active" ? "Structure saved and activated" : "Draft saved");
      } else {
        await createStructure(input);
        toast(status === "active" ? "Structure created" : "Draft created");
      }
      router.push(LIST_HREF);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(null);
    }
  }

  const specialNegative = split.specialAllowance < 0;
  const busy = saving !== null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading salary structure…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SetupToastHost />
      <PageHeader
        title={isNew ? "Create salary structure" : readOnly ? "View salary structure" : "Edit salary structure"}
        description={
          readOnly
            ? "Read-only CTC template. Use Edit to change Gross CTC and formulas."
            : "Gross is the monthly salary used in payroll (× payable/30). CTC = Gross + employer contributions. Initial amounts auto-calculate from Gross CTC and remain editable."
        }
        backHref={LIST_HREF}
        backLabel="Salary structure"
      />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (readOnly) return;
          void save("active");
        }}
      >
        <fieldset disabled={readOnly} className="space-y-4 border-0 p-0">
        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Template</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SetupField label="Structure name" required>
              <SetupInput
                id="structure-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </SetupField>
            <SetupField label="Code" hint="Optional. Auto-generated if blank.">
              <SetupInput
                id="structure-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SS-STD"
              />
            </SetupField>
            <SetupField label="Gross CTC (monthly)" required hint="Excel G — Monthly CTC = Gross CTC">
              <SetupInput
                id="gross-ctc"
                type="number"
                min={0}
                step={100}
                value={grossCtc}
                onChange={(e) => setGrossCtc(e.target.value)}
                className="font-semibold tabular-nums"
                required
              />
            </SetupField>
          </div>
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-foreground">CTC formulas</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Edit the rates below. Computed amounts update immediately and are saved with the
            template.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SetupField label="Basic % of Monthly CTC" hint="Excel I = H × this %">
              <SetupInput
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={basicPct}
                onChange={(e) => setBasicPct(e.target.value)}
                className="tabular-nums"
              />
            </SetupField>
            <SetupField label="HRA % of Basic" hint="Excel J = I × this %">
              <SetupInput
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={hraPct}
                onChange={(e) => setHraPct(e.target.value)}
                className="tabular-nums"
              />
            </SetupField>
            <SetupField label="Telephone allowance" hint="Excel L — input">
              <SetupInput
                type="number"
                min={0}
                step={1}
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className="tabular-nums"
              />
            </SetupField>
            <SetupField label="Employer contribution" hint="CTC split only — not employee PF">
              <SetupInput
                type="number"
                min={0}
                step={1}
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                className="tabular-nums"
              />
            </SetupField>
            <SetupField label="EDLI and admin" hint="Excel Z">
              <SetupInput
                type="number"
                min={0}
                step={1}
                value={edli}
                onChange={(e) => setEdli(e.target.value)}
                className="tabular-nums"
              />
            </SetupField>
            <SetupField label="ESI %" hint="Excel AA — 0.75% when annualised < ceiling">
              <SetupInput
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={esiPct}
                onChange={(e) => setEsiPct(e.target.value)}
                className="tabular-nums"
              />
            </SetupField>
            <SetupField label="ESI monthly ceiling" hint="Excel AA — ₹21,000">
              <SetupInput
                type="number"
                min={0}
                step={1}
                value={esiCeiling}
                onChange={(e) => setEsiCeiling(e.target.value)}
                className="tabular-nums"
              />
            </SetupField>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Computed CTC split</h2>
            <div
              className={cn(
                "mb-3 rounded-lg border px-3 py-2 text-xs transition-colors duration-200",
                specialNegative
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900",
              )}
            >
              {specialNegative
                ? "Special allowance is negative. Reduce telephone or employer contribution, or increase Gross CTC."
                : `CTC ${formatInr(split.ctc)} matches Monthly CTC. Special allowance is the residual.`}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <ComputedRow label="Monthly CTC" hint="H = G" value={split.monthlyCtc} />
              <ComputedRow label="Basic" hint={`I = H × ${basicPct}%`} value={split.basic} />
              <ComputedRow label="HRA" hint={`J = I × ${hraPct}%`} value={split.hra} />
              <ComputedRow
                label="Special allowance"
                hint="K = H − I − J − M − L"
                value={split.specialAllowance}
                warn={specialNegative}
              />
              <ComputedRow label="Telephone" hint="L" value={split.telephoneAllowance} />
              <ComputedRow label="Employer contribution" hint="M" value={split.employerContribution} />
              <ComputedRow label="CTC" hint="N = SUM(I:M)" value={split.ctc} emphasize />
            </dl>
          </section>

          <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Sample month preview</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Employee PF comes from{" "}
              <Link
                href="/hr/payroll?section=salary-configuration"
                className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
              >
                Payroll → Salary configuration
              </Link>
              . Live payroll uses Gross × (payable days / 30).
            </p>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="total-days">Salary basis (days)</Label>
                <SetupInput
                  id="total-days"
                  type="number"
                  value="30"
                  readOnly
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="payable-days">Payable days (30 − LOP)</Label>
                <SetupInput
                  id="payable-days"
                  type="number"
                  min={0}
                  max={30}
                  value={payableDays}
                  onChange={(e) => setPayableDays(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <ComputedRow label="Payable basic" hint="R" value={preview.payableBasic} />
              <ComputedRow label="Payable HRA" hint="S" value={preview.payableHra} />
              <ComputedRow label="Payable special" hint="T" value={preview.payableSpecial} />
              <ComputedRow label="Gross" hint="W" value={preview.gross} />
              <ComputedRow label="PF wage" hint="X = R+T" value={preview.pfWage} />
              <ComputedRow label="Employee PF" hint="From Salary configuration" value={preview.pf} />
              <ComputedRow label="EDLI / admin" hint="Z" value={preview.edli} />
              <ComputedRow label="ESI" hint="AA" value={preview.esi} />
              <ComputedRow label="TDS for the year" hint="AG" value={preview.tdsYear} />
              <ComputedRow label="TDS for the month" hint="AH" value={preview.tdsMonth} />
              <ComputedRow label="Total deduction" hint="AC" value={preview.totalDed} />
              <ComputedRow label="Net payable" hint="AD = W−AC" value={preview.net} emphasize />
            </dl>
          </section>
        </div>
        </fieldset>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap justify-end gap-2">
          {readOnly ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => router.push(LIST_HREF)}
              >
                Back
              </Button>
              {structureId ? (
                <Button
                  type="button"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() => router.push(`/hr/payroll/salary-structures/${structureId}`)}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              ) : null}
            </>
          ) : (
            <>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy}
            onClick={() => router.push(LIST_HREF)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy || !name.trim()}
            onClick={() => void save("draft")}
          >
            {saving === "draft" ? "Saving…" : "Save as draft"}
          </Button>
          <Button
            type="submit"
            className="cursor-pointer transition-colors duration-200"
            disabled={busy || !name.trim() || split.monthlyCtc <= 0}
          >
            {saving === "active" ? "Saving…" : isNew ? "Create & activate" : "Save & activate"}
          </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function ComputedRow({
  label,
  hint,
  value,
  emphasize,
  warn,
}: {
  label: string;
  hint: string;
  value: number;
  emphasize?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/40 py-1">
      <dt className="text-xs text-muted-foreground">
        {label}
        <span className="ml-1 font-normal opacity-70">{hint}</span>
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          emphasize && "font-semibold text-foreground",
          warn && "font-medium text-destructive",
        )}
      >
        {formatInr(value)}
      </dd>
    </div>
  );
}
