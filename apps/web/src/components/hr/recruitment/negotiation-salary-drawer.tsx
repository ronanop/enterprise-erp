"use client";

import { useEffect, useState } from "react";
import { IndianRupee } from "lucide-react";

import {
  SetupDrawer,
  SetupField,
  SetupInput,
} from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";
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
  const canSave = Boolean(application?.id) && amount > 0 && !saving;

  async function handleSave() {
    if (!application?.id) return;
    if (amount <= 0) {
      setError("Enter the salary / CTC discussed with the candidate.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(application.id, amount);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save salary.");
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
          : "Capture CTC agreed in Negotiation Round — it prefills the offer letter."
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
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
              : "This amount is used on the offer letter when you send offer + docs"
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
          <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Will prefill offer letter CTC as{" "}
            <span className="font-medium text-foreground">₹{formatInrGrouping(amount)}</span>
          </p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </SetupDrawer>
  );
}
