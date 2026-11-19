"use client";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";

export function WorkflowStepBlockedDialog({
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
      title="Step not available yet"
      description={message}
      confirmLabel="OK"
      cancelLabel="Close"
      onConfirm={onClose}
      onCancel={onClose}
    />
  );
}
