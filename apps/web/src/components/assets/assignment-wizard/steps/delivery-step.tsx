"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";

const DELIVERY_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "issued", label: "Issued" },
  { value: "received", label: "Received" },
] as const;

export type DeliveryStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
};

export function DeliveryStep({ state, onChange }: DeliveryStepProps) {
  const numberRequired =
    state.deliveryReferenceStatus === "issued" || state.deliveryReferenceStatus === "received";

  return (
    <div className="grid max-w-lg gap-4">
      <div className="space-y-2">
        <Label htmlFor="wiz-delivery-status">Delivery reference status *</Label>
        <Select
          value={state.deliveryReferenceStatus}
          onValueChange={(value) =>
            onChange({
              deliveryReferenceStatus: value as AssignmentWizardState["deliveryReferenceStatus"],
            })
          }
        >
          <SelectTrigger id="wiz-delivery-status" className="cursor-pointer">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DELIVERY_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="cursor-pointer">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="wiz-delivery-number">
          Delivery reference number{numberRequired ? " *" : ""}
        </Label>
        <Input
          id="wiz-delivery-number"
          value={state.deliveryReferenceNumber}
          onChange={(e) => onChange({ deliveryReferenceNumber: e.target.value })}
          placeholder="e.g. DC-2026-0042"
          maxLength={100}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wiz-assignment-remarks">Assignment remarks</Label>
        <textarea
          id="wiz-assignment-remarks"
          className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={state.assignmentRemarks}
          onChange={(e) => onChange({ assignmentRemarks: e.target.value })}
          maxLength={4000}
        />
        <p className="text-xs text-muted-foreground">Required for employee issues before submit (backend rule).</p>
      </div>
    </div>
  );
}
