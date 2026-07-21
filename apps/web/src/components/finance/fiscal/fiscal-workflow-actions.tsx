"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { ApiClientError } from "@/services/api-client";
import {
  activateFiscalYear,
  archiveFiscalYear,
  closeFiscalYear,
  deactivateFiscalYear,
  runFiscalWorkflow,
  type FiscalYear,
} from "@/services/fiscal-service";

type Props = {
  fiscalYear: FiscalYear;
  onDone: () => void;
};

export function FiscalWorkflowActions({ fiscalYear, onDone }: Props) {
  const { can } = useUserPermissions();
  const [pending, setPending] = useState<{ action: string; title: string; description: string; tone?: "default" | "destructive" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = fiscalYear.status?.toLowerCase();

  const actions = [
    { action: "submit", label: "Submit", show: status === "open" && can("finance.fiscal_year:create"), title: "Submit fiscal year?", description: "Records submit for approval audit." },
    { action: "approve", label: "Approve", show: status === "open" && can("finance.fiscal_year:close"), title: "Approve fiscal year?", description: "Records approval audit event." },
    { action: "reject", label: "Reject", show: status === "open" && can("finance.fiscal_year:close"), tone: "destructive" as const, title: "Reject fiscal year?", description: "Records rejection audit event." },
    { action: "activate", label: "Activate", show: status === "archived" && can("finance.fiscal_year:create"), title: "Activate fiscal year?", description: "Sets status to open (single open year enforced)." },
    { action: "deactivate", label: "Deactivate", show: status === "open" && can("finance.fiscal_year:create"), tone: "destructive" as const, title: "Deactivate fiscal year?", description: "Archives this fiscal year." },
    { action: "archive", label: "Archive", show: status === "closed" && can("finance.fiscal_year:close"), title: "Archive fiscal year?", description: "Moves year to archived status." },
    { action: "close", label: "Close Year", show: status === "open" && can("finance.fiscal_year:close"), tone: "destructive" as const, title: "Close fiscal year?", description: "All periods must be hard closed first." },
  ];

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      switch (pending.action) {
        case "submit":
          await runFiscalWorkflow(fiscalYear.id, "submit");
          break;
        case "approve":
          await runFiscalWorkflow(fiscalYear.id, "approve");
          break;
        case "reject":
          await runFiscalWorkflow(fiscalYear.id, "reject");
          break;
        case "activate":
          await activateFiscalYear(fiscalYear.id);
          break;
        case "deactivate":
          await deactivateFiscalYear(fiscalYear.id);
          break;
        case "archive":
          await archiveFiscalYear(fiscalYear.id);
          break;
        case "close":
          await closeFiscalYear(fiscalYear.id);
          break;
      }
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
        {actions.filter((a) => a.show).map((a) => (
          <Button key={a.action} type="button" size="sm" variant={a.tone === "destructive" ? "destructive" : "default"} className="h-8 cursor-pointer" onClick={() => setPending({ action: a.action, title: a.title, description: a.description, tone: a.tone })}>
            {a.label}
          </Button>
        ))}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <ConfirmDialog open={!!pending} title={pending?.title ?? ""} description={pending?.description} tone={pending?.tone} busy={busy} onConfirm={() => void run()} onCancel={() => setPending(null)} />
    </div>
  );
}
