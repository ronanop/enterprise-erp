"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { ApiClientError } from "@/services/api-client";
import {
  isJournalBalanced,
  runJournalAction,
  type Journal,
  type JournalWorkflowAction,
} from "@/services/journal-service";

type Props = {
  journal: Journal;
  onDone: () => void;
  resolveUser?: (id?: string | null) => string;
};

type Pending = {
  action: JournalWorkflowAction;
  title: string;
  description: string;
  tone?: "default" | "destructive";
};

const ACTION_PERMS: Record<JournalWorkflowAction, string> = {
  submit: "finance.journal:submit",
  approve: "finance.journal:approve",
  reject: "finance.journal:approve",
  post: "finance.journal:post",
  reverse: "finance.journal:reverse",
};

export function JournalWorkflowActions({ journal, onDone }: Props) {
  const { can } = useUserPermissions();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = journal.status?.toLowerCase();
  const balanced = isJournalBalanced(journal);

  const actions: Array<{
    action: JournalWorkflowAction;
    label: string;
    show: boolean;
    disabled?: boolean;
    disabledReason?: string;
    tone?: "default" | "destructive";
    title: string;
    description: string;
  }> = [
    {
      action: "submit",
      label: "Submit",
      show: status === "draft" && can(ACTION_PERMS.submit),
      disabled: !balanced,
      disabledReason: "Balance debit and credit before submit",
      title: "Submit journal for approval?",
      description: "Starts the finance approval workflow.",
    },
    {
      action: "approve",
      label: "Approve",
      show: status === "submitted" && can(ACTION_PERMS.approve),
      title: "Approve this journal?",
      description: "Creator cannot approve their own journal (segregation of duties).",
    },
    {
      action: "reject",
      label: "Reject",
      show: status === "submitted" && can(ACTION_PERMS.reject),
      tone: "destructive",
      title: "Reject this journal?",
      description: "Returns the journal to draft for correction.",
    },
    {
      action: "post",
      label: "Post",
      show: status === "approved" && can(ACTION_PERMS.post),
      title: "Post journal to General Ledger?",
      description: "Creates GL entries. Reverse later if needed.",
    },
    {
      action: "reverse",
      label: "Reverse",
      show: status === "posted" && can(ACTION_PERMS.reverse),
      tone: "destructive",
      title: "Create reversal journal?",
      description: "Creates a new reversal voucher from this posted journal.",
    },
  ];

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await runJournalAction(journal.id, pending.action);
      setMessage(`Journal ${pending.action} succeeded.`);
      setPending(null);
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Failed to ${pending.action}`);
    } finally {
      setBusy(false);
    }
  }

  const visible = actions.filter((a) => a.show);
  if (visible.length === 0 && !message && !error) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {visible.map((a) => (
          <Button
            key={a.action}
            type="button"
            variant={a.tone === "destructive" ? "destructive" : "default"}
            size="sm"
            className="cursor-pointer"
            disabled={Boolean(a.disabled) || busy}
            title={a.disabled ? a.disabledReason : undefined}
            onClick={() =>
              setPending({
                action: a.action,
                title: a.title,
                description: a.description,
                tone: a.tone,
              })
            }
          >
            {a.label}
          </Button>
        ))}
      </div>
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}{" "}
          <button
            type="button"
            className="cursor-pointer underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </p>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmLabel={
          pending?.action
            ? pending.action[0].toUpperCase() + pending.action.slice(1)
            : "Confirm"
        }
        tone={pending?.tone}
        busy={busy}
        onCancel={() => !busy && setPending(null)}
        onConfirm={() => void confirm()}
      />
    </div>
  );
}
