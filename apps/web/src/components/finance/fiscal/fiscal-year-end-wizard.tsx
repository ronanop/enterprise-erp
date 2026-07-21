"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/services/api-client";
import {
  closeFiscalYear,
  createFiscalYear,
  getFiscalClosePreview,
  type FiscalClosePreview,
  type FiscalYear,
} from "@/services/fiscal-service";

type Props = {
  fiscalYear: FiscalYear;
  onDone: () => void;
};

type Step = "validation" | "preview" | "confirm" | "progress" | "complete";

export function FiscalYearEndWizard({ fiscalYear, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("validation");
  const [preview, setPreview] = useState<FiscalClosePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createNext, setCreateNext] = useState(true);
  const [carryForward, setCarryForward] = useState(false);

  const start = async () => {
    setOpen(true);
    setStep("validation");
    setError(null);
    setBusy(true);
    try {
      const p = await getFiscalClosePreview(fiscalYear.id);
      setPreview(p);
      setStep("preview");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    setStep("progress");
    setBusy(true);
    setError(null);
    try {
      await closeFiscalYear(fiscalYear.id);
      if (createNext) {
        const start = new Date(fiscalYear.end_date);
        start.setDate(start.getDate() + 1);
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);
        end.setDate(end.getDate() - 1);
        await createFiscalYear({
          fiscal_year_code: `${fiscalYear.fiscal_year_code}-NEXT`,
          fiscal_year_name: `${fiscalYear.fiscal_year_name} (Next)`,
          start_date: start.toISOString().slice(0, 10),
          end_date: end.toISOString().slice(0, 10),
          is_default: true,
        });
      }
      if (carryForward) {
        // API-ready: balance carry-forward not enabled on backend yet
      }
      setStep("complete");
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Year-end close failed");
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer" onClick={() => void start()}>
        Year-End Closing Wizard
      </Button>
      <ConfirmDialog
        open={open}
        title="Year-End Closing"
        description={
          step === "preview"
            ? "Review validation results before closing the fiscal year."
            : step === "complete"
              ? "Fiscal year closed successfully."
              : "Confirm year-end close."
        }
        confirmLabel={step === "complete" ? "Done" : step === "confirm" ? "Close Fiscal Year" : "Continue"}
        cancelLabel={step === "complete" ? undefined : "Cancel"}
        busy={busy}
        tone={step === "confirm" ? "destructive" : "default"}
        onConfirm={() => {
          if (step === "preview") setStep("confirm");
          else if (step === "confirm") void execute();
          else if (step === "complete") setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      >
        {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        {preview && step !== "complete" ? (
          <div className="mt-3 space-y-2 text-xs">
            <p>Open journals: <strong>{preview.open_journals}</strong></p>
            <p>Unclosed periods: <strong>{preview.unclosed_periods}</strong></p>
            {preview.warnings.length > 0 ? (
              <ul className="list-disc pl-4 text-amber-800">
                {preview.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            ) : null}
            {step === "confirm" ? (
              <div className="space-y-1 pt-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={createNext} onChange={(e) => setCreateNext(e.target.checked)} />
                  Create next fiscal year
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                  <input type="checkbox" checked={carryForward} onChange={(e) => setCarryForward(e.target.checked)} disabled />
                  Carry forward balances (API-ready)
                </label>
              </div>
            ) : null}
            {step === "progress" ? <p className="text-muted-foreground">Closing in progress…</p> : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
