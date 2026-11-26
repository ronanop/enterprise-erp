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
import {
  computeSplitFromAnnualCtc,
  salaryBreakdownLines,
} from "@/lib/salary-structure-excel";
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
  const split = useMemo(
    () => (amount > 0 ? computeSplitFromAnnualCtc(amount) : null),
    [amount],
  );
  const breakdown = useMemo(
    () => (split && split.valid ? salaryBreakdownLines(split) : []),
    [split],
  );
  const canSave = Boolean(application?.id) && amount > 0 && !saving && (split?.valid ?? false);

  async function handleSave() {
    if (!application?.id) return;
    if (amount <= 0) {
      setError("Enter the salary / CTC discussed with the candidate.");
      return;
    }
    if (split && !split.valid) {
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
              : "Used on the offer letter and auto-assigned to payroll on onboarding complete"
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

        {amount > 0 && split ? (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Monthly structure preview (Excel 60/50)
            </p>
            {!split.valid ? (
              <p className="text-xs text-destructive">
                Special allowance would be negative for this CTC.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {breakdown.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1 last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {row.label}
                      {row.hint ? (
                        <span className="ml-1 text-[10px] opacity-80">({row.hint})</span>
                      ) : null}
                    </span>
                    <span className="font-mono tabular-nums text-foreground">
                      ₹{formatInrGrouping(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Offer letter PDF will include this breakdown. On onboarding complete it becomes the
              employee salary structure in Payroll.
            </p>
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </SetupDrawer>
  );
}
