"use client";

import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  FinanceField,
  FinanceSelect,
  FinanceTextarea,
} from "@/components/finance/journals/finance-form-field";
import { Input } from "@/components/ui/input";
import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  NORMAL_BALANCES,
  coaFormDefaults,
  coaFormSchema,
  type CoaFormValues,
} from "@/lib/finance/coa-schema";
import { accountTypeLabel, type AccountGroup, type ChartOfAccount } from "@/services/coa-service";

type Option = { id: string; label: string };

export function useCoaForm(defaults?: Partial<CoaFormValues>) {
  return useForm<CoaFormValues>({
    resolver: zodResolver(coaFormSchema),
    mode: "onChange",
    defaultValues: { ...coaFormDefaults, ...defaults },
  });
}

export function accountToFormValues(account: ChartOfAccount): CoaFormValues {
  return {
    account_code: account.account_code,
    account_name: account.account_name,
    parent_account_id: account.parent_account_id ?? "",
    account_type: (ACCOUNT_TYPES.includes(account.account_type as (typeof ACCOUNT_TYPES)[number])
      ? account.account_type
      : "asset") as CoaFormValues["account_type"],
    account_group_id: account.account_group_id,
    currency_code: account.currency_code ?? "",
    normal_balance: (NORMAL_BALANCES.includes(
      account.normal_balance as (typeof NORMAL_BALANCES)[number],
    )
      ? account.normal_balance
      : "debit") as CoaFormValues["normal_balance"],
    is_posting_account: account.is_posting_account,
    is_tax_applicable: Boolean(account.is_tax_applicable),
    is_cost_center_enabled: Boolean(account.is_cost_center_enabled),
    description: account.description ?? "",
    status: (ACCOUNT_STATUSES.includes(account.status as (typeof ACCOUNT_STATUSES)[number])
      ? account.status
      : "draft") as CoaFormValues["status"],
  };
}

type Props = {
  form: UseFormReturn<CoaFormValues>;
  groups: AccountGroup[];
  parentOptions: Option[];
  readOnly?: boolean;
};

export function CoaAccountFormFields({ form, groups, parentOptions, readOnly }: Props) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const accountType = watch("account_type");
  const filteredGroups = groups.filter((g) => !accountType || g.account_type === accountType);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FinanceField label="Account Code" htmlFor="account_code" error={errors.account_code?.message}>
        <Input id="account_code" className="h-8 font-mono" disabled={readOnly} {...register("account_code")} />
      </FinanceField>
      <FinanceField label="Account Name" htmlFor="account_name" error={errors.account_name?.message}>
        <Input id="account_name" className="h-8" disabled={readOnly} {...register("account_name")} />
      </FinanceField>
      <FinanceField label="Account Type" htmlFor="account_type" error={errors.account_type?.message}>
        <FinanceSelect
          id="account_type"
          disabled={readOnly}
          {...register("account_type", {
            onChange: () => setValue("account_group_id", "", { shouldDirty: true }),
          })}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {accountTypeLabel(t)}
            </option>
          ))}
        </FinanceSelect>
      </FinanceField>
      <FinanceField
        label="Category (Account Group)"
        htmlFor="account_group_id"
        error={errors.account_group_id?.message}
      >
        <FinanceSelect id="account_group_id" disabled={readOnly} {...register("account_group_id")}>
          <option value="">Select group…</option>
          {filteredGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.group_code} · {g.group_name}
            </option>
          ))}
        </FinanceSelect>
      </FinanceField>
      <FinanceField label="Parent Account" htmlFor="parent_account_id" error={errors.parent_account_id?.message}>
        <FinanceSelect id="parent_account_id" disabled={readOnly} {...register("parent_account_id")}>
          <option value="">None (root)</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </FinanceSelect>
      </FinanceField>
      <FinanceField label="Currency" htmlFor="currency_code" error={errors.currency_code?.message}>
        <Input id="currency_code" className="h-8 font-mono uppercase" maxLength={3} disabled={readOnly} {...register("currency_code")} />
      </FinanceField>
      <FinanceField label="Normal Balance" htmlFor="normal_balance" error={errors.normal_balance?.message}>
        <FinanceSelect id="normal_balance" disabled={readOnly} {...register("normal_balance")}>
          {NORMAL_BALANCES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </FinanceSelect>
      </FinanceField>
      <FinanceField label="Status" htmlFor="status" error={errors.status?.message}>
        <FinanceSelect id="status" disabled={readOnly} {...register("status")}>
          {ACCOUNT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FinanceSelect>
      </FinanceField>
      <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" disabled={readOnly} {...register("is_posting_account")} className="cursor-pointer" />
        Allow Posting
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" disabled={readOnly} {...register("is_tax_applicable")} className="cursor-pointer" />
        Tax Applicable
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" disabled={readOnly} {...register("is_cost_center_enabled")} className="cursor-pointer" />
        Cost Center Required
      </label>
      <FinanceField
        label="Description"
        htmlFor="description"
        error={errors.description?.message}
        className="sm:col-span-2"
      >
        <FinanceTextarea id="description" disabled={readOnly} {...register("description")} />
      </FinanceField>
    </div>
  );
}
