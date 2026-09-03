"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SetupField, SetupInput, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { resourceService } from "@/services/api-client";

type PolicyForm = {
  id?: string;
  version?: number;
  period_day_denominator: string;
  salary_proration_mode: string;
  sandwich_enabled: boolean;
  sandwich_triggers: string;
  sandwich_off_becomes: string;
  pf_mode: string;
  pf_employee_amount: string;
  pf_employer_amount: string;
  pf_employee_percent: string;
  pf_employer_percent: string;
  pf_wage_ceiling: string;
  pf_on_lop: string;
  net_pay_formula: string;
};

const EMPTY: PolicyForm = {
  period_day_denominator: "fixed_30",
  salary_proration_mode: "fixed_30_day_factor",
  sandwich_enabled: false,
  sandwich_triggers: "unauthorized_absence",
  sandwich_off_becomes: "lop",
  pf_mode: "fixed_split",
  pf_employee_amount: "1800",
  pf_employer_amount: "1900",
  pf_employee_percent: "12",
  pf_employer_percent: "12",
  pf_wage_ceiling: "15000",
  pf_on_lop: "fixed",
  net_pay_formula: "gross_minus_employee_pf_only",
};

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function pctToApi(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.12;
  return n > 1 ? n / 100 : n;
}

function pctFromApi(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "12";
  return String(n > 1 ? n : n * 100);
}

export function PayrollPolicyPanel() {
  const [form, setForm] = useState<PolicyForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await resourceService.create("/payroll/policies/ensure-default", {}).catch(() => null);
      const res = await resourceService.list<Record<string, unknown>>("/payroll/policies/resolved");
      const row = (res.data ?? {}) as Record<string, unknown>;
      const active = await resourceService.list<Record<string, unknown>>("/payroll/policies/active");
      const activeRow = (active.data ?? null) as Record<string, unknown> | null;
      setForm({
        id: String(activeRow?.id ?? row.id ?? ""),
        version: Number(activeRow?.version ?? row.version ?? 1),
        period_day_denominator: String(row.period_day_denominator ?? "fixed_30"),
        salary_proration_mode: String(row.salary_proration_mode ?? "fixed_30_day_factor"),
        sandwich_enabled: asBool(row.sandwich_enabled),
        sandwich_triggers: String(row.sandwich_triggers ?? "unauthorized_absence"),
        sandwich_off_becomes: String(row.sandwich_off_becomes ?? "lop"),
        pf_mode: String(row.pf_mode ?? "fixed_split"),
        pf_employee_amount: String(row.pf_employee_amount ?? 1800),
        pf_employer_amount: String(row.pf_employer_amount ?? 1900),
        pf_employee_percent: pctFromApi(row.pf_employee_percent ?? 0.12),
        pf_employer_percent: pctFromApi(row.pf_employer_percent ?? 0.12),
        pf_wage_ceiling: String(row.pf_wage_ceiling ?? 15000),
        pf_on_lop: String(row.pf_on_lop ?? "fixed"),
        net_pay_formula: String(row.net_pay_formula ?? "gross_minus_employee_pf_only"),
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not load payroll policy", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const body = {
        period_day_denominator: "fixed_30",
        salary_proration_mode: "fixed_30_day_factor",
        sandwich_enabled: form.sandwich_enabled,
        sandwich_triggers: form.sandwich_triggers,
        sandwich_off_becomes: form.sandwich_off_becomes,
        pf_mode: form.pf_mode,
        pf_employee_amount: Number(form.pf_employee_amount || 0),
        pf_employer_amount: Number(form.pf_employer_amount || 0),
        pf_employee_percent: pctToApi(form.pf_employee_percent),
        pf_employer_percent: pctToApi(form.pf_employer_percent),
        pf_wage_ceiling: Number(form.pf_wage_ceiling || 15000),
        pf_on_lop: form.pf_on_lop,
        net_pay_formula: form.net_pay_formula,
        version: form.version,
      };
      if (form.id) {
        await resourceService.update("/payroll/policies", form.id, body);
      } else {
        await resourceService.create("/payroll/policies/ensure-default", {});
        const active = await resourceService.list<Record<string, unknown>>("/payroll/policies/active");
        const id = String((active.data as Record<string, unknown> | null)?.id ?? "");
        if (id) await resourceService.update("/payroll/policies", id, body);
      }
      toast("Payroll policy saved");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading payroll policy…</p>;
  }

  const pfIsPercent = form.pf_mode === "percentage" || form.pf_mode === "statutory_percent";

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h3 className="text-sm font-semibold">Salary basis</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Attendance cycle stays 20th–19th. Salary is always Monthly × Payable / 30. Payable = 30 − LOP.
          Weekly offs and holidays are payable unless sandwich converts them.
        </p>
        <p className="mt-2 text-sm tabular-nums">Denominator: 30 days (locked)</p>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h3 className="text-sm font-semibold">Sandwich policy</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <SetupField label="Sandwich">
            <SetupSelect
              value={form.sandwich_enabled ? "on" : "off"}
              onChange={(e) => setForm((f) => ({ ...f, sandwich_enabled: e.target.value === "on" }))}
            >
              <option value="off">Off</option>
              <option value="on">On</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Trigger">
            <SetupSelect
              value={form.sandwich_triggers}
              onChange={(e) => setForm((f) => ({ ...f, sandwich_triggers: e.target.value }))}
              disabled={!form.sandwich_enabled}
            >
              <option value="unauthorized_absence">Unauthorized absence</option>
              <option value="approved_leave">Approved leave</option>
              <option value="both">Both</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Off becomes">
            <SetupSelect
              value={form.sandwich_off_becomes}
              onChange={(e) => setForm((f) => ({ ...f, sandwich_off_becomes: e.target.value }))}
              disabled={!form.sandwich_enabled}
            >
              <option value="lop">LOP</option>
              <option value="leave">Leave</option>
            </SetupSelect>
          </SetupField>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h3 className="text-sm font-semibold">Provident fund</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SetupField label="PF type">
            <SetupSelect
              value={form.pf_mode}
              onChange={(e) => setForm((f) => ({ ...f, pf_mode: e.target.value }))}
            >
              <option value="fixed_split">Fixed amounts</option>
              <option value="percentage">Percentage of PF wage</option>
              <option value="statutory_percent">Statutory % (ESI/PT included)</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="PF on LOP">
            <SetupSelect
              value={form.pf_on_lop}
              onChange={(e) => setForm((f) => ({ ...f, pf_on_lop: e.target.value }))}
            >
              <option value="fixed">Fixed (not prorated)</option>
              <option value="prorated">Prorated with salary</option>
              <option value="percentage_of_pf_wage">% of payable PF wage</option>
            </SetupSelect>
          </SetupField>
          <SetupField label="Net pay formula">
            <SetupSelect
              value={form.net_pay_formula}
              onChange={(e) => setForm((f) => ({ ...f, net_pay_formula: e.target.value }))}
            >
              <option value="gross_minus_employee_pf_only">Gross − employee PF</option>
              <option value="gross_minus_fixed_pf_total">Gross − employee + employer PF</option>
            </SetupSelect>
          </SetupField>
          {pfIsPercent ? (
            <>
              <SetupField label="Employee PF %">
                <SetupInput
                  type="number"
                  value={form.pf_employee_percent}
                  onChange={(e) => setForm((f) => ({ ...f, pf_employee_percent: e.target.value }))}
                />
              </SetupField>
              <SetupField label="Employer PF %">
                <SetupInput
                  type="number"
                  value={form.pf_employer_percent}
                  onChange={(e) => setForm((f) => ({ ...f, pf_employer_percent: e.target.value }))}
                />
              </SetupField>
              <SetupField label="PF wage ceiling">
                <SetupInput
                  type="number"
                  value={form.pf_wage_ceiling}
                  onChange={(e) => setForm((f) => ({ ...f, pf_wage_ceiling: e.target.value }))}
                />
              </SetupField>
            </>
          ) : (
            <>
              <SetupField label="Employee PF (₹)">
                <SetupInput
                  type="number"
                  value={form.pf_employee_amount}
                  onChange={(e) => setForm((f) => ({ ...f, pf_employee_amount: e.target.value }))}
                />
              </SetupField>
              <SetupField label="Employer PF (₹)">
                <SetupInput
                  type="number"
                  value={form.pf_employer_amount}
                  onChange={(e) => setForm((f) => ({ ...f, pf_employer_amount: e.target.value }))}
                />
              </SetupField>
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Employer PF is shown on the payslip separately and is not deducted from net unless you choose
          “Gross − employee + employer PF”.
        </p>
      </section>

      <Button
        type="button"
        className="cursor-pointer transition-colors duration-200"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save payroll policy"}
      </Button>
    </div>
  );
}
