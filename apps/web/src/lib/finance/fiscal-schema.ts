import { z } from "zod";

export const FISCAL_STATUSES = ["open", "closed", "archived"] as const;

export const fiscalFormSchema = z
  .object({
    fiscal_year_code: z
      .string()
      .min(1, "Code is required")
      .max(20)
      .regex(/^[A-Za-z0-9._-]+$/, "Invalid code format"),
    fiscal_year_name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional().or(z.literal("")),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    is_default: z.boolean(),
    status: z.enum(FISCAL_STATUSES).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.start_date && v.end_date && v.end_date <= v.start_date) {
      ctx.addIssue({
        code: "custom",
        message: "End date must be after start date",
        path: ["end_date"],
      });
    }
  });

export type FiscalFormValues = z.infer<typeof fiscalFormSchema>;

export const fiscalFormDefaults: FiscalFormValues = {
  fiscal_year_code: "",
  fiscal_year_name: "",
  description: "",
  start_date: "",
  end_date: "",
  is_default: false,
};

export function toFiscalPayload(values: FiscalFormValues) {
  return {
    fiscal_year_code: values.fiscal_year_code.trim(),
    fiscal_year_name: values.fiscal_year_name.trim(),
    description: values.description?.trim() || null,
    start_date: values.start_date,
    end_date: values.end_date,
    is_default: values.is_default,
  };
}
