import { z } from "zod";

const uuid = z.string().uuid("Invalid id");

const optionalUuid = z.union([z.string().uuid(), z.literal("")]);

const money = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
  z.number().min(0),
);

const positiveRate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 1 : Number(v)),
  z.number().positive(),
);

export const journalLineFormSchema = z
  .object({
    account_id: uuid,
    description: z.string().max(500).optional().or(z.literal("")),
    debit_amount: money,
    credit_amount: money,
    cost_center_id: optionalUuid.optional(),
    tax_id: optionalUuid.optional(),
    project_ref: z.string().max(100).optional().or(z.literal("")),
  })
  .superRefine((row, ctx) => {
    const debit = Number(row.debit_amount) || 0;
    const credit = Number(row.credit_amount) || 0;
    if (debit > 0 && credit > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Line cannot have both debit and credit",
        path: ["credit_amount"],
      });
    }
    if (debit === 0 && credit === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter debit or credit amount",
        path: ["debit_amount"],
      });
    }
  });

export const journalCreateFormSchema = z.object({
  company_id: uuid,
  branch_id: uuid,
  fiscal_year_id: optionalUuid.optional(),
  period_id: optionalUuid.optional(),
  journal_date: z.string().min(1, "Journal date is required"),
  journal_type: z.enum(["manual", "system", "adjustment", "reversal"]),
  currency_code: z.string().length(3),
  exchange_rate: positiveRate,
  reference: z.string().max(100).optional().or(z.literal("")),
  description: z.string().min(1, "Description is required").max(500),
  lines: z.array(journalLineFormSchema).min(2, "At least two lines are required"),
});

export type JournalCreateFormValues = z.infer<typeof journalCreateFormSchema>;
export type JournalLineFormValues = z.infer<typeof journalLineFormSchema>;

export function lineTotals(lines: JournalLineFormValues[]): {
  debit: number;
  credit: number;
  difference: number;
  balanced: boolean;
} {
  const debit = lines.reduce((s, l) => s + (Number(l.debit_amount) || 0), 0);
  const credit = lines.reduce((s, l) => s + (Number(l.credit_amount) || 0), 0);
  const difference = Number((debit - credit).toFixed(4));
  return {
    debit,
    credit,
    difference,
    balanced: Math.abs(difference) < 0.0001,
  };
}
