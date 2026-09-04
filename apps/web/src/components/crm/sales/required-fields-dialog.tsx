"use client";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";

export function missingRequiredMessage(fields: string[]): string {
  if (fields.length === 0) return "";
  if (fields.length === 1) return `Please fill the required field: ${fields[0]}.`;
  return `Please fill the required fields: ${fields.join(", ")}.`;
}

export function RequiredFieldsDialog({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Required fields missing"
      description={message}
      confirmLabel="OK"
      cancelLabel="Close"
      onConfirm={onClose}
      onCancel={onClose}
    />
  );
}
