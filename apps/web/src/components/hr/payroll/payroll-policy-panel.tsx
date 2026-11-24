"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SetupField, SetupInput, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast } from "@/components/hr/setup/setup-toast";
import { formatApiError, resourceService } from "@/services/api-client";
import { payrollTargetCompanyIds } from "@/lib/payroll-company";
import { getStoredOrgContext } from "@/lib/org-context-storage";
import { loadResolvedPayrollPfPolicy } from "@/lib/payroll-pf-policy";

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
  sandwich_enabled: true,
  sandwich_triggers: "both",
  sandwich_off_becomes: "lop",
  pf_mode: "fixed_split",
  pf_employee_amount: "1800",
  pf_employer_amount: "1900",
  pf_employee_percent: "12",
  pf_employer_percent: "12",
  pf_wage_ceiling: "25000",
  pf_on_lop: "fixed",
  net_pay_formula: "gross_minus_employee_pf_only",
};

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
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

function formFromRow(row: Record<string, unknown>, activeRow?: Record<string, unknown> | null): PolicyForm {
  return {
    id: String(activeRow?.id ?? row.id ?? ""),
    version: Number(activeRow?.version ?? row.version ?? 1),
    period_day_denominator: String(row.period_day_denominator ?? "fixed_30"),
    salary_proration_mode: String(row.salary_proration_mode ?? "fixed_30_day_factor"),
    sandwich_enabled: asBool(row.sandwich_enabled ?? true),
    sandwich_triggers: String(row.sandwich_triggers ?? "both"),
    sandwich_off_becomes: String(row.sandwich_off_becomes ?? "lop"),
    pf_mode: String(row.pf_mode ?? "fixed_split"),
    pf_employee_amount: String(row.pf_employee_amount ?? 1800),
    pf_employer_amount: String(row.pf_employer_amount ?? 1900),
    pf_employee_percent: pctFromApi(row.pf_employee_percent ?? 0.12),
    pf_employer_percent: pctFromApi(row.pf_employer_percent ?? 0.12),
    pf_wage_ceiling: String(row.pf_wage_ceiling ?? 15000),
    pf_on_lop: String(row.pf_on_lop ?? "fixed"),
    net_pay_formula: String(row.net_pay_formula ?? "gross_minus_employee_pf_only"),
  };
}

async function ensurePolicyId(companyId: string): Promise<string> {
  const ensured = await resourceService.create<Record<string, unknown>>(
    "/payroll/policies/ensure-default",
    { company_id: companyId },
  );
  const id = String((ensured.data as Record<string, unknown> | null)?.id ?? "");
  if (id) return id;
  const active = await resourceService.list<Record<string, unknown>>("/payroll/policies/active", {
    company_id: companyId,
  });
  const activeId = String((active.data as Record<string, unknown> | null)?.id ?? "");
  if (activeId) return activeId;
  throw new Error("Salary configuration could not be created for this company.");
}

export function PayrollPolicyPanel() {
  const [form, setForm] = useState<PolicyForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appliesToEveryCompany, setAppliesToEveryCompany] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const companies = await payrollTargetCompanyIds();
      if (!companies.length) {
        setForm(EMPTY);
        toast("Select a company in the header to load salary configuration", "error");
        return;
      }
      // Ensure at least the active company has a DEFAULT row so Save / Generate can read it.
      for (const companyId of companies.slice(0, appliesToEveryCompany ? companies.length : 1)) {
        await ensurePolicyId(companyId).catch(() => null);
      }
      const companyId = companies[0]!;
      const query = { company_id: companyId };
      const [resolved, active] = await Promise.all([
        resourceService.list<Record<string, unknown>>("/payroll/policies/resolved", query),
        resourceService.list<Record<string, unknown>>("/payroll/policies/active", query),
      ]);
      const row = (resolved.data ?? {}) as Record<string, unknown>;
      const activeRow = (active.data ?? null) as Record<string, unknown> | null;
      setForm(formFromRow(row, activeRow));
    } catch (err) {
      toast(formatApiError(err, "Could not load payroll policy"), "error");
      setForm(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [appliesToEveryCompany]);

  useEffect(() => {
    setAppliesToEveryCompany(Boolean(getStoredOrgContext()?.allCompanies));
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
      };
      const companies = await payrollTargetCompanyIds();
      if (!companies.length) {
        throw new Error("Select a company in the header before saving salary configuration.");
      }
      for (const companyId of companies) {
        const id = await ensurePolicyId(companyId);
        await resourceService.update("/payroll/policies", id, body);
      }
      toast(
        companies.length > 1
          ? "Salary configuration saved for every company"
          : "Salary configuration saved",
      );
      await loadResolvedPayrollPfPolicy().catch(() => null);
      await load();
    } catch (err) {
      toast(formatApiError(err, "Save failed"), "error");
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
          Attendance cycle stays 21st–20th. Salary is always Monthly × Payable / 30. Payable = 30 − LOP.
          Weekly offs and holidays are payable unless sandwich converts them.
        </p>
        <p className="mt-2 text-sm tabular-nums">Denominator: 30 days (locked)</p>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <h3 className="text-sm font-semibold">Sandwich policy</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Leave Friday and leave Monday converts Sat/Sun to LOP. Unauthorized absence on both sides
          does the same. Continuous absence applies sandwich across the whole month so weekly offs
          become LOP and payable / net drop to zero.
        </p>
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
              <option value="both">Both (leave or absence)</option>
              <option value="approved_leave">Approved leave</option>
              <option value="unauthorized_absence">Unauthorized absence</option>
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
        <p className="mt-1 text-xs text-muted-foreground">
          Company PF for every payroll run. Salary structures do not set employee PF.
        </p>
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

      {appliesToEveryCompany ? (
        <p className="text-xs text-muted-foreground">
          The header is set to All companies, so this save updates salary configuration for every company.
        </p>
      ) : null}
      <Button
        type="button"
        className="cursor-pointer transition-colors duration-200"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save salary configuration"}
      </Button>
    </div>
  );
}
