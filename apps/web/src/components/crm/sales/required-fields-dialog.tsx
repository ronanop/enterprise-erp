"use client";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";

export function missingRequiredMessage(fields: string[]): string {
  if (fields.length === 0) return "";
  if (fields.length === 1) return `Please fill the required field: ${fields[0]}.`;
  return `Please fill the required fields: ${fields.join(", ")}.`;
}

export function isCustomFieldValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function RequiredFieldsDialog({
  open,
  message,
  fields,
  onClose,
}: {
  open: boolean;
  message?: string;
  /** When provided, listed as a highlighted checklist in the dialog body. */
  fields?: string[];
  onClose: () => void;
}) {
  const list = (fields ?? []).filter((f) => f.trim().length > 0);
  const description =
    list.length > 0
      ? "Complete the highlighted fields below before saving."
      : message || "Please fill all required fields before saving.";

  return (
    <ConfirmDialog
      open={open}
      title="Required fields missing"
      description={description}
      confirmLabel="OK"
      cancelLabel="Close"
      onConfirm={onClose}
      onCancel={onClose}
    >
      {list.length > 0 ? (
        <ul className="mt-1 max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          {list.map((field) => (
            <li key={field} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden />
              <span className="font-medium">{field}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </ConfirmDialog>
  );
}
