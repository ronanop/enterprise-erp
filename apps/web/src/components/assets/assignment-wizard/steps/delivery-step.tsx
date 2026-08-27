"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import { isEmployeeAllocation } from "@/components/assets/navigation/dc-challan-navigation";

/** Primary DC workflow options. Received kept for historical assignment reload. */
const DELIVERY_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "issued", label: "Issued" },
  { value: "received", label: "Received" },
] as const;

const SIGNATURE_STATUSES = [
  { value: "not_signed", label: "Not signed" },
  { value: "signed", label: "Signed" },
] as const;

export type UnlinkedDcChallanOption = {
  id: string;
  dcNumber: string;
  employeeName?: string | null;
};

export type DeliveryStepProps = {
  state: AssignmentWizardState;
  onChange: (patch: Partial<AssignmentWizardState>) => void;
  unlinkedChallans?: UnlinkedDcChallanOption[];
};

const MODES: Array<{ value: AssignmentWizardState["dcChallanMode"]; label: string; hint: string }> = [
  {
    value: "create_now",
    label: "Create DC now",
    hint: "Employee is going elsewhere (another branch, location, or company) and needs the DC before or right at handover.",
  },
  {
    value: "link_existing",
    label: "Link existing",
    hint: "A DC was already prepared in advance for this asset — attach it to this assignment now.",
  },
  {
    value: "later",
    label: "Handle later",
    hint: "Hand over the asset now; DC paperwork will be created separately from Operations → DC Challan afterwards.",
  },
];

export function DeliveryStep({ state, onChange, unlinkedChallans = [] }: DeliveryStepProps) {
  const mode = state.dcChallanMode ?? "later";
  const employeeOnly = isEmployeeAllocation(state.allocationType);
  const showLegacy =
    !employeeOnly || mode === "later" || Boolean(state.deliveryReferenceNumber.trim());
  const numberRequired =
    state.deliveryReferenceStatus === "issued" || state.deliveryReferenceStatus === "received";

  return (
    <div className="grid max-w-lg gap-4">
      <p className="text-sm font-medium text-foreground">Delivery Challan</p>
      {employeeOnly ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Most assets don&apos;t need a DC at handover — choose an option only if this one does.
          </p>
          <div className="grid gap-2">
            {MODES.map((modeOption) => (
              <Button
                key={modeOption.value}
                type="button"
                variant={mode === modeOption.value ? "default" : "outline"}
                className="h-auto cursor-pointer justify-start py-2 text-left transition-colors duration-200"
                onClick={() => onChange({ dcChallanMode: modeOption.value })}
              >
                <span>
                  <span className="block text-sm">{modeOption.label}</span>
                  <span className="block text-xs font-normal opacity-80">{modeOption.hint}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          DC challan tracking is employee-only in this phase. Warehouse, department, project, and branch
          allocations keep the existing delivery reference fields.
        </p>
      )}

      {employeeOnly && mode === "link_existing" ? (
        <div className="space-y-2">
          <Label htmlFor="wiz-dc-link">Open unlinked challan</Label>
          <Select
            value={state.dcChallanId || "none"}
            onValueChange={(value) => onChange({ dcChallanId: value === "none" ? "" : value })}
          >
            <SelectTrigger id="wiz-dc-link" className="cursor-pointer">
              <SelectValue placeholder="Select challan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="cursor-pointer">
                None
              </SelectItem>
              {unlinkedChallans.map((row) => (
                <SelectItem key={row.id} value={row.id} className="cursor-pointer">
                  {row.dcNumber}
                  {row.employeeName ? ` — ${row.employeeName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showLegacy ? (
        <>
          <p className="text-xs font-medium text-muted-foreground">Advanced / existing reference</p>
          <div className="space-y-2">
            <Label htmlFor="wiz-delivery-number">
              DC Number{numberRequired ? " *" : ""}
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
            <Label htmlFor="wiz-delivery-status">DC Status *</Label>
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
            <Label htmlFor="wiz-dc-signature">Signature *</Label>
            <Select
              value={state.deliveryChallanSignatureStatus}
              onValueChange={(value) =>
                onChange({
                  deliveryChallanSignatureStatus:
                    value as AssignmentWizardState["deliveryChallanSignatureStatus"],
                })
              }
            >
              <SelectTrigger id="wiz-dc-signature" className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIGNATURE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="cursor-pointer">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="wiz-assignment-remarks">Assignment remarks</Label>
        <textarea
          id="wiz-assignment-remarks"
          className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={state.assignmentRemarks}
          onChange={(e) => onChange({ assignmentRemarks: e.target.value })}
          maxLength={4000}
        />
        <p className="text-xs text-muted-foreground">
          Required for employee issues before submit (backend rule).
        </p>
      </div>
    </div>
  );
}
