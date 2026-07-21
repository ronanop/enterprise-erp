"use client";

import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import {
  FinanceField,
  FinanceSelect,
} from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import { mergeAccounts, type ChartOfAccount } from "@/services/coa-service";

type Props = {
  accounts: ChartOfAccount[];
  currentId?: string;
};

export function CoaMergeWizard({ accounts, currentId }: Props) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(currentId ?? "");
  const [targetId, setTargetId] = useState("");
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const options = useMemo(
    () =>
      accounts.map((a) => ({
        id: a.id,
        label: `${a.account_code} · ${a.account_name}`,
      })),
    [accounts],
  );

  const run = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await mergeAccounts(sourceId, targetId, comments || undefined);
      setInfo("Merge completed.");
      setOpen(false);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Merge failed";
      setError(msg);
      setInfo(
        "Merge UI is API-integrated. Ledger remapping may still be disabled on the server.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium tracking-tight">Account Merge</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Merge a source account into a target. Requires backend ledger remapping support.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-8 cursor-pointer" onClick={() => setOpen(true)}>
          Open wizard
        </Button>
      </div>
      {info ? <p className="mt-2 text-[11px] text-muted-foreground">{info}</p> : null}
      {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}

      <ConfirmDialog
        open={open}
        title="Merge accounts"
        description="This will attempt POST /finance/chart-of-accounts/merge."
        confirmLabel="Merge"
        tone="destructive"
        busy={busy}
        onConfirm={() => void run()}
        onCancel={() => setOpen(false)}
      >
        <div className="mt-3 space-y-2">
          <FinanceField label="Source account">
            <FinanceSelect value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Select…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Target account">
            <FinanceSelect value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Select…</option>
              {options
                .filter((o) => o.id !== sourceId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Comments">
            <textarea
              className="min-h-[56px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </FinanceField>
        </div>
      </ConfirmDialog>
    </div>
  );
}
