"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { ApiClientError } from "@/services/api-client";
import {
  isJournalEditable,
  updateJournal,
  type Journal,
} from "@/services/journal-service";

const schema = z.object({
  journal_date: z.string().min(1),
  journal_type: z.enum(["manual", "system", "adjustment", "reversal"]),
  currency_code: z.string().length(3),
  exchange_rate: z.preprocess((v) => Number(v), z.number().positive()),
  period_id: z.string().optional(),
  description: z.string().min(1).max(500),
});

type FormValues = z.infer<typeof schema>;

type PeriodOption = { id: string; label: string };

type Props = {
  journal: Journal;
  periods: PeriodOption[];
  onSaved: (journal: Journal) => void;
  onMessage: (msg: string, tone: "success" | "error") => void;
};

export function JournalHeaderEditor({
  journal,
  periods,
  onSaved,
  onMessage,
}: Props) {
  const editable = isJournalEditable(journal.status);
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      journal_date: String(journal.journal_date).slice(0, 10),
      journal_type: (journal.journal_type as FormValues["journal_type"]) || "manual",
      currency_code: journal.currency_code || "INR",
      exchange_rate: Number(journal.exchange_rate || 1),
      period_id: journal.period_id || "",
      description: journal.description,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting, errors },
  } = form;

  useUnsavedChangesWarning(editable && isDirty && !isSubmitting);

  useEffect(() => {
    reset({
      journal_date: String(journal.journal_date).slice(0, 10),
      journal_type: (journal.journal_type as FormValues["journal_type"]) || "manual",
      currency_code: journal.currency_code || "INR",
      exchange_rate: Number(journal.exchange_rate || 1),
      period_id: journal.period_id || "",
      description: journal.description,
    });
  }, [journal, reset]);

  async function onSave(values: FormValues) {
    try {
      const updated = await updateJournal(journal.id, {
        journal_date: values.journal_date,
        journal_type: values.journal_type,
        currency_code: values.currency_code,
        exchange_rate: Number(values.exchange_rate),
        period_id: values.period_id || null,
        description: values.description,
        version: journal.version,
      });
      onSaved(updated);
      onMessage("Journal header saved.", "success");
      reset({
        journal_date: String(updated.journal_date).slice(0, 10),
        journal_type: (updated.journal_type as FormValues["journal_type"]) || "manual",
        currency_code: updated.currency_code || "INR",
        exchange_rate: Number(updated.exchange_rate || 1),
        period_id: updated.period_id || "",
        description: updated.description,
      });
    } catch (err) {
      onMessage(
        err instanceof ApiClientError ? err.message : "Failed to save header",
        "error",
      );
    }
  }

  return (
    <form
      className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
      onSubmit={handleSubmit(onSave)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight">Header</h2>
        {editable ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={!isDirty || isSubmitting}
              onClick={() => {
                if (isDirty && !window.confirm("Discard header changes?")) return;
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="cursor-pointer"
              disabled={!isDirty || isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">Read-only after draft</span>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <FinanceField label="Journal date" error={errors.journal_date?.message}>
          <Input type="date" disabled={!editable} {...register("journal_date")} />
        </FinanceField>
        <FinanceField label="Journal type" error={errors.journal_type?.message}>
          <FinanceSelect disabled={!editable} {...register("journal_type")}>
            {["manual", "system", "adjustment", "reversal"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Period">
          <FinanceSelect disabled={!editable} {...register("period_id")}>
            <option value="">—</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
        <FinanceField label="Currency" error={errors.currency_code?.message}>
          <Input maxLength={3} disabled={!editable} {...register("currency_code")} />
        </FinanceField>
        <FinanceField label="Exchange rate" error={errors.exchange_rate?.message}>
          <Input
            type="number"
            step="0.00000001"
            disabled={!editable}
            {...register("exchange_rate")}
          />
        </FinanceField>
        <FinanceField
          label="Description"
          className="sm:col-span-2 xl:col-span-3"
          error={errors.description?.message}
        >
          <FinanceTextarea disabled={!editable} {...register("description")} />
        </FinanceField>
      </div>
    </form>
  );
}
