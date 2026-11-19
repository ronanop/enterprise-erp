"use client";

import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { Input } from "@/components/ui/input";

type CrmSessionEmployeeFieldProps = {
  label: string;
  value: string;
  required?: boolean;
};

/** Read-only field showing the logged-in user's CRM employee identity. */
export function CrmSessionEmployeeField({
  label,
  value,
  required = false,
}: CrmSessionEmployeeFieldProps) {
  const title = "Set from your logged-in user account";
  return (
    <FinanceField label={required ? `${label} *` : label}>
      <Input
        value={value || "—"}
        disabled
        aria-readonly="true"
        title={title}
        className={!value ? "text-muted-foreground" : undefined}
      />
    </FinanceField>
  );
}
