"use client";

import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { Input } from "@/components/ui/input";
import {
  FISCAL_STATUSES,
  fiscalFormDefaults,
  fiscalFormSchema,
  type FiscalFormValues,
} from "@/lib/finance/fiscal-schema";
import type { FiscalYear } from "@/services/fiscal-service";

export function useFiscalForm(defaults?: Partial<FiscalFormValues>) {
  return useForm<FiscalFormValues>({
    resolver: zodResolver(fiscalFormSchema),
    mode: "onChange",
    defaultValues: { ...fiscalFormDefaults, ...defaults },
  });
}

export function fiscalToFormValues(fy: FiscalYear): FiscalFormValues {
  return {
    fiscal_year_code: fy.fiscal_year_code,
    fiscal_year_name: fy.fiscal_year_name,
    description: fy.description ?? "",
    start_date: fy.start_date.slice(0, 10),
    end_date: fy.end_date.slice(0, 10),
    is_default: Boolean(fy.is_default),
    status: (FISCAL_STATUSES.includes(fy.status as (typeof FISCAL_STATUSES)[number])
      ? fy.status
      : "open") as FiscalFormValues["status"],
  };
}

type Props = {
  form: UseFormReturn<FiscalFormValues>;
  readOnly?: boolean;
};

export function FiscalFormFields({ form, readOnly }: Props) {
  const { register, formState: { errors } } = form;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FinanceField label="Fiscal Year Code" error={errors.fiscal_year_code?.message}>
        <Input className="h-8 font-mono" disabled={readOnly} {...register("fiscal_year_code")} />
      </FinanceField>
      <FinanceField label="Name" error={errors.fiscal_year_name?.message}>
        <Input className="h-8" disabled={readOnly} {...register("fiscal_year_name")} />
      </FinanceField>
      <FinanceField label="Start Date" error={errors.start_date?.message}>
        <Input type="date" className="h-8 font-mono" disabled={readOnly} {...register("start_date")} />
      </FinanceField>
      <FinanceField label="End Date" error={errors.end_date?.message}>
        <Input type="date" className="h-8 font-mono" disabled={readOnly} {...register("end_date")} />
      </FinanceField>
      <FinanceField label="Status" error={errors.status?.message}>
        <FinanceSelect disabled={readOnly} {...register("status")}>
          {FISCAL_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </FinanceSelect>
      </FinanceField>
      <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" disabled={readOnly} {...register("is_default")} className="cursor-pointer" />
        Default fiscal year
      </label>
      <FinanceField label="Description" error={errors.description?.message} className="sm:col-span-2">
        <FinanceTextarea disabled={readOnly} {...register("description")} />
      </FinanceField>
    </div>
  );
}
