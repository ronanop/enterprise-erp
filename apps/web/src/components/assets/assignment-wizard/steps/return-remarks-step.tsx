"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ReturnWizardState } from "@/components/assets/assignment-wizard/wizard-types";

export type ReturnRemarksStepProps = {
  state: ReturnWizardState;
  onChange: (patch: Partial<ReturnWizardState>) => void;
};

export function ReturnRemarksStep({ state, onChange }: ReturnRemarksStepProps) {
  return (
    <div className="grid max-w-lg gap-4">
      <div className="space-y-2">
        <Label htmlFor="wiz-return-remarks">Return remarks</Label>
        <textarea
          id="wiz-return-remarks"
          className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={state.returnRemarks}
          onChange={(e) => onChange({ returnRemarks: e.target.value })}
          maxLength={4000}
          placeholder="Optional notes about condition or accessories returned"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wiz-return-reason">Reason (audit)</Label>
        <Input
          id="wiz-return-reason"
          value={state.reason}
          onChange={(e) => onChange({ reason: e.target.value })}
          maxLength={500}
          placeholder="Optional short reason"
        />
      </div>
    </div>
  );
}
