"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { ApiClientError } from "@/services/api-client";
import {
  runCoaAction,
  type ChartOfAccount,
  type CoaWorkflowAction,
} from "@/services/coa-service";

type Props = {
  account: ChartOfAccount;
  onDone: () => void;
};

const ACTION_PERMS: Record<CoaWorkflowAction, string> = {
  submit: "finance.coa:update",
  approve: "finance.coa:update",
  reject: "finance.coa:update",
  activate: "finance.coa:update",
  deactivate: "finance.coa:update",
};

export function CoaWorkflowActions({ account, onDone }: Props) {
  const { can } = useUserPermissions();
  const [pending, setPending] = useState<{
    action: CoaWorkflowAction;
    title: string;
    description: string;
    tone?: "default" | "destructive";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = account.status?.toLowerCase();

  const actions: Array<{
    action: CoaWorkflowAction;
    label: string;
    show: boolean;
    tone?: "default" | "destructive";
    title: string;
    description: string;
  }> = [
    {
      action: "submit",
      label: "Submit",
      show: status === "draft" && can(ACTION_PERMS.submit),
      title: "Submit account for review?",
      description: "Records a submit audit event. Approve or Activate to make the account usable.",
    },
    {
      action: "approve",
      label: "Approve",
      show: status === "draft" && can(ACTION_PERMS.approve),
      title: "Approve and activate this account?",
      description: "Sets status to active so the account can be used for posting.",
    },
    {
      action: "reject",
      label: "Reject",
      show: status === "draft" && can(ACTION_PERMS.reject),
      tone: "destructive",
      title: "Reject this account?",
      description: "Keeps the account in draft and records a reject audit event.",
    },
    {
      action: "activate",
      label: "Activate",
      show: (status === "draft" || status === "inactive") && can(ACTION_PERMS.activate),
      title: "Activate this account?",
      description: "Account becomes available for journal posting (if allow posting is enabled).",
    },
    {
      action: "deactivate",
      label: "Deactivate",
      show: status === "active" && can(ACTION_PERMS.deactivate),
      tone: "destructive",
      title: "Deactivate this account?",
      description: "Prevents new postings. Required before editing an active account.",
    },
  ];

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await runCoaAction(account.id, pending.action);
      setMessage(`${pending.action} completed`);
      setPending(null);
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions
          .filter((a) => a.show)
          .map((a) => (
            <Button
              key={a.action}
              type="button"
              size="sm"
              variant={a.tone === "destructive" ? "destructive" : "default"}
              className="h-8 cursor-pointer"
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
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <ConfirmDialog
        open={!!pending}
        title={pending?.title ?? ""}
        description={pending?.description}
        tone={pending?.tone}
        busy={busy}
        confirmLabel={pending?.action ?? "Confirm"}
        onConfirm={() => void run()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
