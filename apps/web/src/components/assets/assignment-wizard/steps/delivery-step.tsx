"use client";

import { FileText, Clock3 } from "lucide-react";

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
import { isEmployeeAllocation } from "@/components/assets/navigation/dc-challan-navigation";
import { cn } from "@/lib/utils";

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
  /** Unused — kept for call-site compatibility. */
  unlinkedChallans?: UnlinkedDcChallanOption[];
  /** Opens DC Challan workspace (Create DC now). */
  onCreateDcNow?: (state: AssignmentWizardState) => void;
};

export function DeliveryStep({ state, onChange, onCreateDcNow }: DeliveryStepProps) {
  const mode = state.dcChallanMode === "create_now" ? "create_now" : "later";
  const employeeOnly = isEmployeeAllocation(state.allocationType);
  // Legacy Number/Status/Signature stay for warehouse/department/project/branch only.
  const showLegacy = !employeeOnly;
  const numberRequired =
    state.deliveryReferenceStatus === "issued" || state.deliveryReferenceStatus === "received";

  function selectHandleLater() {
    onChange({
      dcChallanMode: "later",
      dcChallanId: "",
      deliveryReferenceNumber: "",
      deliveryReferenceStatus: "pending",
      deliveryChallanSignatureStatus: "not_signed",
    });
  }

  function selectCreateDcNow() {
    const next: AssignmentWizardState = {
      ...state,
      dcChallanMode: "create_now",
      dcChallanId: "",
    };
    onChange({
      dcChallanMode: "create_now",
      dcChallanId: "",
    });
    onCreateDcNow?.(next);
  }

  return (
    <div className="grid w-full max-w-2xl gap-4">
      {employeeOnly ? (
        <div className="grid gap-3" role="group" aria-label="Delivery challan options">
          <button
            type="button"
            onClick={selectCreateDcNow}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors duration-200",
              mode === "create_now"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border/80 hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                mode === "create_now"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <FileText className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Create DC now</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Open DC Challan to complete paperwork
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={selectHandleLater}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors duration-200",
              mode === "later"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border/80 hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                mode === "later"
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Clock3 className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Handle later</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Continue issue and add DC afterwards
              </span>
            </span>
          </button>
        </div>
      ) : null}

      {showLegacy ? (
        <div className="grid gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wiz-delivery-status">DC Status *</Label>
              <Select
                value={state.deliveryReferenceStatus}
                onValueChange={(value) =>
                  onChange({
                    deliveryReferenceStatus:
                      value as AssignmentWizardState["deliveryReferenceStatus"],
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
