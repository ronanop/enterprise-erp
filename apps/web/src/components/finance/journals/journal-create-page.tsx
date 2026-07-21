"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";

import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import {
  journalCreateFormSchema,
  lineTotals,
  type JournalCreateFormValues,
} from "@/lib/finance/journal-schema";
import { cn } from "@/lib/utils";
import { ApiClientError, resourceService } from "@/services/api-client";
import { formatInrPrecise } from "@/services/finance-service";
import { addJournalLine, createJournal } from "@/services/journal-service";

type Option = { id: string; label: string };

const emptyLine = {
  account_id: "",
  description: "",
  debit_amount: 0,
  credit_amount: 0,
  cost_center_id: "",
  tax_id: "",
  project_ref: "",
};

export function JournalCreatePage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [fiscalYears, setFiscalYears] = useState<Option[]>([]);
  const [periods, setPeriods] = useState<Array<Option & { fiscal_year_id?: string }>>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [costCenters, setCostCenters] = useState<Option[]>([]);
  const [taxes, setTaxes] = useState<Option[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<JournalCreateFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(journalCreateFormSchema) as any,
    defaultValues: {
      company_id: "",
      branch_id: "",
      fiscal_year_id: "",
      period_id: "",
      journal_date: new Date().toISOString().slice(0, 10),
      journal_type: "manual",
      currency_code: "INR",
      exchange_rate: 1,
      reference: "",
      description: "",
      lines: [
        { ...emptyLine },
        { ...emptyLine },
      ],
    },
    mode: "onChange",
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = form;

  useUnsavedChangesWarning(isDirty && !saving);

  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = watch("lines");
  const watchedFy = watch("fiscal_year_id");
  const totals = useMemo(() => lineTotals(watchedLines ?? []), [watchedLines]);

  const filteredPeriods = useMemo(() => {
    if (!watchedFy) return periods;
    return periods.filter((p) => !p.fiscal_year_id || p.fiscal_year_id === watchedFy);
  }, [periods, watchedFy]);

  const loadLookups = useCallback(async () => {
    const results = await Promise.allSettled([
      resourceService.list("/companies"),
      resourceService.list("/branches"),
      resourceService.list("/finance/fiscal-years"),
      resourceService.list("/finance/periods"),
      resourceService.list("/finance/chart-of-accounts"),
      resourceService.list("/cost-centers"),
      resourceService.list("/taxes"),
    ]);

    const asOptions = (
      settled: PromiseSettledResult<{ data: unknown }>,
      labelKeys: string[],
    ): Option[] => {
      if (settled.status !== "fulfilled") return [];
      const data = settled.value.data;
      const list = Array.isArray(data) ? data : [];
      return list.map((row) => {
        const r = row as Record<string, unknown>;
        const label =
          labelKeys.map((k) => r[k]).find((v) => typeof v === "string" && v) ?? String(r.id);
        return { id: String(r.id), label: String(label) };
      });
    };

    const companyOpts = asOptions(results[0], ["company_name", "legal_name", "name"]);
    const branchOpts = asOptions(results[1], ["branch_name", "name"]);
    const fyOpts = asOptions(results[2], ["fiscal_year_name", "fiscal_year_code"]);
    setCompanies(companyOpts);
    setBranches(branchOpts);
    setFiscalYears(fyOpts);

    if (results[3].status === "fulfilled") {
      const list = Array.isArray(results[3].value.data) ? results[3].value.data : [];
      setPeriods(
        list.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id),
            label: String(r.period_name ?? r.period_number ?? r.id),
            fiscal_year_id: r.fiscal_year_id ? String(r.fiscal_year_id) : undefined,
          };
        }),
      );
    }

    if (results[4].status === "fulfilled") {
      const list = Array.isArray(results[4].value.data) ? results[4].value.data : [];
      setAccounts(
        list
          .filter((row) => (row as Record<string, unknown>).is_posting_account !== false)
          .map((row) => {
            const r = row as Record<string, unknown>;
            return {
              id: String(r.id),
              label: `${r.account_code} · ${r.account_name}`,
            };
          }),
      );
    }

    setCostCenters(asOptions(results[5], ["cost_center_name", "name", "code"]));
    setTaxes(asOptions(results[6], ["tax_name", "tax_code", "name"]));

    if (companyOpts[0] && !form.getValues("company_id")) {
      setValue("company_id", companyOpts[0].id);
    }
    if (branchOpts[0] && !form.getValues("branch_id")) {
      setValue("branch_id", branchOpts[0].id);
    }
    if (fyOpts[0] && !form.getValues("fiscal_year_id")) {
      setValue("fiscal_year_id", fyOpts[0].id);
    }
  }, [form, setValue]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  async function onSave(values: JournalCreateFormValues) {
    if (!totals.balanced) {
      setServerError("Cannot save: Debit total must equal Credit total.");
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const description = values.reference
        ? `${values.description} [Ref: ${values.reference}]`
        : values.description;
      const journal = await createJournal({
        company_id: values.company_id,
        branch_id: values.branch_id,
        journal_date: values.journal_date,
        description,
        journal_type: values.journal_type,
        currency_code: values.currency_code,
        exchange_rate: values.exchange_rate,
        period_id: values.period_id || null,
      });

      for (let i = 0; i < values.lines.length; i += 1) {
        const line = values.lines[i];
        const descParts = [line.description, line.project_ref ? `Project: ${line.project_ref}` : ""]
          .filter(Boolean)
          .join(" · ");
        await addJournalLine(journal.id, {
          line_number: i + 1,
          account_id: line.account_id,
          debit_amount: Number(line.debit_amount) || 0,
          credit_amount: Number(line.credit_amount) || 0,
          description: descParts || null,
          cost_center_id: line.cost_center_id || null,
          tax_id: line.tax_id || null,
        });
      }

      router.push(`/finance/journals/${journal.id}`);
    } catch (err) {
      setServerError(
        err instanceof ApiClientError
          ? `${err.message}${err.errors.length ? `: ${err.errors.join(", ")}` : ""}`
          : "Failed to save journal",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href="/finance/journals"
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary"
      >
        <ArrowLeft className="size-3.5" /> Journals
      </Link>

      <PageHeader
        title="Create Journal"
        description="Draft voucher with balanced lines. Saved as draft via Finance journal APIs."
      />

      {serverError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit(onSave)} noValidate>
        <section className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
          <FinanceField label="Company" error={errors.company_id?.message}>
            <FinanceSelect {...register("company_id")}>
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Branch" error={errors.branch_id?.message}>
            <FinanceSelect {...register("branch_id")}>
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Fiscal Year" error={errors.fiscal_year_id?.message}>
            <FinanceSelect {...register("fiscal_year_id")}>
              <option value="">Select year</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Period" error={errors.period_id?.message}>
            <FinanceSelect {...register("period_id")}>
              <option value="">Auto from journal date</option>
              {filteredPeriods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Journal Date" error={errors.journal_date?.message}>
            <Input type="date" {...register("journal_date")} />
          </FinanceField>
          <FinanceField label="Journal Type" error={errors.journal_type?.message}>
            <FinanceSelect {...register("journal_type")}>
              {["manual", "system", "adjustment", "reversal"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Currency" error={errors.currency_code?.message}>
            <Input maxLength={3} {...register("currency_code")} />
          </FinanceField>
          <FinanceField label="Exchange Rate" error={errors.exchange_rate?.message}>
            <Input type="number" step="0.00000001" {...register("exchange_rate")} />
          </FinanceField>
          <FinanceField label="Reference" error={errors.reference?.message}>
            <Input placeholder="Optional reference" {...register("reference")} />
          </FinanceField>
          <FinanceField
            label="Description"
            className="sm:col-span-2 xl:col-span-3"
            error={errors.description?.message}
          >
            <FinanceTextarea {...register("description")} />
          </FinanceField>
        </section>

        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium tracking-tight">Journal lines</h2>
              <p className="text-[11px] text-muted-foreground">
                Debit must equal credit before save.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => append({ ...emptyLine })}
            >
              <Plus className="size-3.5" />
              Add line
            </Button>
          </div>

          <div className="erp-scroll overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Debit</th>
                  <th className="px-3 py-2">Credit</th>
                  <th className="px-3 py-2">Cost Center</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Tax</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-b border-border/50 align-top">
                    <td className="px-3 py-2 font-mono text-xs">{index + 1}</td>
                    <td className="px-3 py-2">
                      <FinanceSelect
                        className="min-w-[180px]"
                        {...register(`lines.${index}.account_id`)}
                      >
                        <option value="">Select account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </FinanceSelect>
                      {errors.lines?.[index]?.account_id ? (
                        <p className="mt-1 text-[10px] text-destructive">
                          {errors.lines[index]?.account_id?.message}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Input {...register(`lines.${index}.description`)} />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`lines.${index}.debit_amount`)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register(`lines.${index}.credit_amount`)}
                      />
                      {errors.lines?.[index]?.credit_amount ||
                      errors.lines?.[index]?.debit_amount ? (
                        <p className="mt-1 text-[10px] text-destructive">
                          {errors.lines[index]?.credit_amount?.message ||
                            errors.lines[index]?.debit_amount?.message}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <FinanceSelect {...register(`lines.${index}.cost_center_id`)}>
                        <option value="">—</option>
                        {costCenters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </FinanceSelect>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        placeholder="Ref"
                        {...register(`lines.${index}.project_ref`)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <FinanceSelect {...register(`lines.${index}.tax_id`)}>
                        <option value="">—</option>
                        {taxes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </FinanceSelect>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="cursor-pointer"
                        disabled={fields.length <= 2}
                        onClick={() => remove(index)}
                        aria-label="Remove line"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 text-xs font-medium">
                  <td className="px-3 py-2.5" colSpan={3}>
                    Running totals
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">
                    {formatInrPrecise(totals.debit)}
                  </td>
                  <td className="px-3 py-2.5 font-mono tabular-nums">
                    {formatInrPrecise(totals.credit)}
                  </td>
                  <td className="px-3 py-2.5" colSpan={4}>
                    <span
                      className={cn(
                        "font-mono tabular-nums",
                        totals.balanced ? "text-emerald-700" : "text-destructive",
                      )}
                    >
                      Diff {formatInrPrecise(totals.difference)}{" "}
                      {totals.balanced ? "· balanced" : "· unbalanced"}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {errors.lines?.root?.message || typeof errors.lines?.message === "string" ? (
            <p className="border-t border-border/70 px-4 py-2 text-xs text-destructive">
              {errors.lines.root?.message || String(errors.lines.message)}
            </p>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/finance/journals"
            className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium transition-colors duration-200 hover:bg-muted"
            onClick={(e) => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) {
                e.preventDefault();
              }
            }}
          >
            Cancel
          </Link>
          <Button
            type="submit"
            className="cursor-pointer"
            disabled={saving || !totals.balanced}
          >
            {saving ? "Saving…" : "Save Draft"}
          </Button>
        </div>
      </form>
    </div>
  );
}
