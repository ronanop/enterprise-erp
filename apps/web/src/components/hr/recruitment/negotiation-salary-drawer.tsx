"use client";

import { useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/services/api-client";
import { IndianRupee } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
import { buildCompensationSheet } from "@/lib/salary-structure-excel";
import {
  formatInrGrouping,
  parseInrInput,
} from "@/services/recruitment-ats-lookups";
import type { AtsCandidate, JobOpening, PipelineApplication } from "@/types/recruitment-ats";

type Props = {
  open: boolean;
  application: PipelineApplication | null;
  candidate: AtsCandidate | null;
  job: JobOpening | null;
  onClose: () => void;
  onSave: (applicationId: string, ctc: number) => void | Promise<void>;
};

export function NegotiationSalaryDrawer({
  open,
  application,
  candidate,
  job,
  onClose,
  onSave,
}: Props) {
  const [display, setDisplay] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !application) return;
    const seed =
      application.negotiatedCtc ||
      job?.salaryMax ||
      job?.salaryMin ||
      0;
    setDisplay(seed > 0 ? formatInrGrouping(seed) : "");
    setError(null);
    setSaving(false);
  }, [open, application, job]);

  const amount = parseInrInput(display);
  const sheet = useMemo(
    () => (amount > 0 ? buildCompensationSheet(amount, candidate?.fullName) : null),
    [amount, candidate?.fullName],
  );
  const canSave = Boolean(application?.id) && amount > 0 && !saving && Boolean(sheet);

  async function handleSave() {
    if (!application?.id) return;
    if (amount <= 0) {
      setError("Enter the salary / CTC discussed with the candidate.");
      return;
    }
    if (!sheet) {
      setError("Special allowance would be negative — check the annual CTC.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(application.id, amount);
      onClose();
    } catch (e) {
      setError(formatApiError(e, "Could not save salary."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SetupDrawer
      open={open}
      onClose={onClose}
      title="Salary discussed"
      description={
        candidate
          ? `Negotiation Round · ${candidate.fullName}${job?.title ? ` · ${job.title}` : ""}`
          : "Capture CTC agreed in Negotiation Round — it prefills the offer letter and salary structure."
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer transition-colors duration-200"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer transition-colors duration-200"
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            <IndianRupee className="size-3.5" />
            {saving ? "Saving…" : "Save salary"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <SetupField
          label="Salary / CTC discussed (₹ / year)"
          required
          hint={
            job?.salaryMax
              ? `Job band max ₹${formatInrGrouping(job.salaryMax)}${
                  job.salaryMin ? ` · min ₹${formatInrGrouping(job.salaryMin)}` : ""
                }`
              : "Used on the offer letter Compensation Sheet and auto-assigned to payroll on onboarding complete"
          }
        >
          <SetupInput
            inputMode="numeric"
            className="font-mono"
            placeholder="e.g. 12,00,000"
            value={display}
            onChange={(e) => {
              setDisplay(e.target.value);
              setError(null);
            }}
          />
        </SetupField>

        {amount > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border">
            {!sheet ? (
              <p className="px-3 py-3 text-xs text-destructive">
                Special allowance would be negative for this CTC.
              </p>
            ) : (
              <>
                <div className="bg-[#0f3d6e] px-3 py-2 text-sm font-semibold text-white">
                  {sheet.title}
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#548dd4] text-[10px] uppercase tracking-wide text-slate-900">
                      <th className="px-2 py-1.5 font-semibold" />
                      <th className="px-2 py-1.5 text-right font-semibold">Monthly</th>
                      <th className="px-2 py-1.5 text-right font-semibold">Yearly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.map((row, idx) => {
                      if (row.kind === "section") {
                        return (
                          <tr key={`s-${row.label}-${idx}`} className="bg-[#548dd4]">
                            <td
                              colSpan={3}
                              className="px-2 py-1.5 text-[11px] font-semibold text-slate-900"
                            >
                              {row.label}
                            </td>
                          </tr>
                        );
                      }
                      const strong = row.kind === "subtotal" || row.kind === "total";
                      return (
                        <tr
                          key={`r-${row.label}-${idx}`}
                          className={
                            strong
                              ? "bg-[#548dd4] font-semibold"
                              : idx % 2 === 0
                                ? "bg-white"
                                : "bg-[#dce6f2]"
                          }
                        >
                          <td className="px-2 py-1.5 text-foreground">{row.label}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                            {formatInrGrouping(row.monthly ?? 0)}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                            {formatInrGrouping(row.yearly ?? 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                  Same table is stamped on the offer letter PDF. On onboarding complete it becomes
                  the employee salary structure in Payroll.
                </p>
              </>
            )}
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </SetupDrawer>
  );
}
