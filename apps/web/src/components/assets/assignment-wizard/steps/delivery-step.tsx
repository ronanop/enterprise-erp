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
  { value: "pending", label: "Not Applicable" },
  { value: "issued", label: "Issued" },
  { value: "received", label: "Received" },
] as const;

export type DeliveryStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  readOnly?: boolean;
};

export function DeliveryStep({ state, onChange, readOnly }: DeliveryStepProps) {
  const numberRequired =
    state.deliveryReferenceStatus === "issued" || state.deliveryReferenceStatus === "received";

  return (
    <div className="grid max-w-lg gap-4" data-testid="assignment-details-section">
      <h3 className="text-sm font-medium tracking-tight">Assignment Details</h3>

      <div className="space-y-2">
        <Label htmlFor="wiz-issued-date">Issued Date</Label>
        <Input
          id="wiz-issued-date"
          type="date"
          value={state.issuedAt}
          onChange={(e) => onChange({ issuedAt: e.target.value })}
          disabled={readOnly}
          aria-describedby="wiz-issued-date-hint"
        />
        <p id="wiz-issued-date-hint" className="text-xs text-muted-foreground">
          Recorded on activation by the server when left blank on draft.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wiz-delivery-status">Delivery Status *</Label>
        <Select
          value={state.deliveryReferenceStatus}
          onValueChange={(value) =>
            onChange({
              deliveryReferenceStatus: value as AssignmentWizardState["deliveryReferenceStatus"],
            })
          }
          disabled={readOnly}
        >
          <SelectTrigger id="wiz-delivery-status" className="cursor-pointer" data-testid="delivery-status">
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
        <p className="text-xs text-muted-foreground">
          Not Applicable: challan optional. Issued / Received: challan required.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wiz-delivery-number">
          Delivery Challan Number{numberRequired ? " *" : ""}
        </Label>
        <Input
          id="wiz-delivery-number"
          value={state.deliveryReferenceNumber}
          onChange={(e) => onChange({ deliveryReferenceNumber: e.target.value })}
          placeholder="e.g. DC-2026-0042"
          maxLength={100}
          disabled={readOnly}
          data-testid="delivery-challan-number"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wiz-assignment-remarks">Remarks</Label>
        <textarea
          id="wiz-assignment-remarks"
          className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          value={state.assignmentRemarks}
          onChange={(e) => onChange({ assignmentRemarks: e.target.value })}
          maxLength={4000}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="wiz-expected-return">Expected Return Date (optional)</Label>
        <Input
          id="wiz-expected-return"
          type="date"
          value={state.expectedReturnAt}
          onChange={(e) => onChange({ expectedReturnAt: e.target.value })}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
