import { z } from "zod";

const uuid = z.string().uuid("Invalid id");
const optionalUuid = z.union([z.string().uuid(), z.literal("")]);

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
export const NORMAL_BALANCES = ["debit", "credit"] as const;
export const ACCOUNT_STATUSES = ["draft", "active", "inactive"] as const;

export const coaFormSchema = z.object({
  account_code: z
    .string()
    .min(1, "Account code is required")
    .max(50)
    .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, dashes, underscores"),
  account_name: z.string().min(1, "Account name is required").max(255),
  parent_account_id: optionalUuid.optional(),
  account_type: z.enum(ACCOUNT_TYPES),
  account_group_id: uuid,
  currency_code: z.string().max(3),
  normal_balance: z.enum(NORMAL_BALANCES),
  is_posting_account: z.boolean(),
  is_tax_applicable: z.boolean(),
  is_cost_center_enabled: z.boolean(),
  description: z.string().max(2000).optional().or(z.literal("")),
  status: z.enum(ACCOUNT_STATUSES),
});

export type CoaFormValues = z.infer<typeof coaFormSchema>;

export const coaFormDefaults: CoaFormValues = {
  account_code: "",
  account_name: "",
  parent_account_id: "",
  account_type: "asset",
  account_group_id: "",
  currency_code: "INR",
  normal_balance: "debit",
  is_posting_account: true,
  is_tax_applicable: false,
  is_cost_center_enabled: false,
  description: "",
  status: "draft",
};

export function toCoaPayload(values: CoaFormValues) {
  return {
    account_code: values.account_code.trim(),
    account_name: values.account_name.trim(),
    parent_account_id: values.parent_account_id || null,
    account_type: values.account_type,
    account_group_id: values.account_group_id,
    currency_code: values.currency_code ? values.currency_code.trim().toUpperCase() : null,
    normal_balance: values.normal_balance,
    is_posting_account: values.is_posting_account,
    is_tax_applicable: values.is_tax_applicable,
    is_cost_center_enabled: values.is_cost_center_enabled,
    description: values.description?.trim() || null,
    status: values.status,
  };
}
