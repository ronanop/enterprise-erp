"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Package } from "lucide-react";

import {
  EMPTY_USER_TRANSFER_RETURN,
  EMPTY_USER_TRANSFER_ASSIGN,
  isUserTransferAssignComplete,
  isUserTransferReturnComplete,
  type UserTransferAssignFormState,
  type UserTransferDestinationMode,
  type UserTransferEmployeeSource,
  type UserTransferReturnFormState,
} from "@/components/assets/user-transfer-destination";
import {
  ASSETS_ACCENT_BTN,
  ASSETS_SURFACE_CARD,
} from "@/components/assets/shared/premium-surface";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { OrgOption } from "@/lib/org-options";
import {
  listSiteBuildings,
  listSiteLocations,
  type SiteBuilding,
  type SiteLocation,
} from "@/services/asset-site-location-service";
import type { UserTransferContext, UserTransferVerificationResult } from "@/services/assets-service";

export type UserTransferDestinationPanelProps = {
  context: UserTransferContext;
  verificationResult: UserTransferVerificationResult;
  mode: UserTransferDestinationMode;
  onModeChange: (mode: UserTransferDestinationMode) => void;
  assignForm: UserTransferAssignFormState;
  onAssignFormChange: (patch: Partial<UserTransferAssignFormState>) => void;
  returnForm: UserTransferReturnFormState;
  onReturnFormChange: (patch: Partial<UserTransferReturnFormState>) => void;
  employees: OrgOption[];
  departments: OrgOption[];
  finalizeBusy?: boolean;
  finalizeError?: string | null;
  onSubmitAssign: () => void;
  onSubmitReturn: () => void;
  onBackToVerification?: () => void;
};

const EMPLOYEE_MODES: Array<{
  value: UserTransferEmployeeSource;
  label: string;
  hint: string;
}> = [
  {
    value: "MASTER_DATA",
    label: "Existing Employee",
    hint: "Select from the employee directory.",
  },
  {
    value: "MANUAL_ENTRY",
    label: "Manual Entry",
    hint: "Enter details when the person is not in the directory.",
  },
];

function componentLabel(
  row: NonNullable<UserTransferContext["components"]>[number],
): string {
  return (
    row.component_name ||
    row.linked_asset_name ||
    row.component_code ||
    row.component_type ||
    row.component_id
  );
}

export function UserTransferDestinationPanel({
  context,
  verificationResult,
  mode,
  onModeChange,
  assignForm,
  onAssignFormChange,
  returnForm,
  onReturnFormChange,
  employees,
  departments,
  finalizeBusy,
  finalizeError,
  onSubmitAssign,
  onSubmitReturn,
  onBackToVerification,
}: UserTransferDestinationPanelProps) {
  const [siteLocations, setSiteLocations] = useState<SiteLocation[]>([]);
  const [buildings, setBuildings] = useState<SiteBuilding[]>([]);
  const components = context.components ?? [];
  const assignReady = isUserTransferAssignComplete(assignForm);
  const returnReady = isUserTransferReturnComplete(returnForm);
  const assignBlockedByCondition = verificationResult.physical_condition !== "good";

  useEffect(() => {
    void listSiteLocations()
      .then(setSiteLocations)
      .catch(() => setSiteLocations([]));
  }, []);

  useEffect(() => {
    if (!assignForm.toLocationId) {
      setBuildings([]);
      return;
    }
    let cancelled = false;
    void listSiteBuildings(assignForm.toLocationId)
      .then((rows) => {
        if (!cancelled) setBuildings(rows);
      })
      .catch(() => {
        if (!cancelled) setBuildings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [assignForm.toLocationId]);

  const departmentLabel = useMemo(() => {
    if (!assignForm.departmentId) return "";
    return departments.find((d) => d.id === assignForm.departmentId)?.label ?? assignForm.departmentId;
  }, [assignForm.departmentId, departments]);

  const switchEmployeeSource = (next: UserTransferEmployeeSource) => {
    if (next === assignForm.employeeSource) return;
    if (next === "MANUAL_ENTRY") {
      onAssignFormChange({
        employeeSource: "MANUAL_ENTRY",
        employeeId: "",
      });
      return;
    }
    onAssignFormChange({
      employeeSource: "MASTER_DATA",
      manualEmployeeName: "",
      manualEmployeePhone: "",
      manualEmployeeEmail: "",
      manualEmployeeDeployedTo: "",
    });
  };

  return (
    <div className="space-y-4" data-testid="user-transfer-destination">
      <p className="text-sm text-muted-foreground">
        Verification reference{" "}
        <span className="font-mono text-xs text-foreground">
          {verificationResult.verification_id}
        </span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          className={cn(
            ASSETS_SURFACE_CARD,
            "cursor-pointer transition-colors duration-200",
            mode === "assign" && "ring-2 ring-primary/40",
          )}
          onClick={() => onModeChange("assign")}
          data-testid="destination-assign-card"
        >
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ArrowLeftRight className="size-4 text-primary" aria-hidden />
              Assign to new user
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Transfer custody to another employee. Asset stays assigned.
          </CardContent>
        </Card>

        <Card
          className={cn(
            ASSETS_SURFACE_CARD,
            "cursor-pointer transition-colors duration-200",
            mode === "return" && "ring-2 ring-primary/40",
          )}
          onClick={() => onModeChange("return")}
          data-testid="destination-return-card"
        >
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Package className="size-4 text-primary" aria-hidden />
              Return to stock
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Close the assignment and set the asset to Ready to Move.
          </CardContent>
        </Card>
      </div>

      {mode === "assign" ? (
        <Card className={ASSETS_SURFACE_CARD} data-testid="assign-form">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-semibold">New assignment</CardTitle>
          </CardHeader>
          <CardContent className="grid max-w-xl gap-4 pt-5">
            {assignBlockedByCondition ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Assign to a new user requires physical condition Good from verification.
              </p>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">How is the new user identified?</p>
              <div
                className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
                role="group"
                aria-label="New user source"
                data-testid="ut-employee-source"
              >
                {EMPLOYEE_MODES.map((m) => {
                  const active = assignForm.employeeSource === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      data-testid={`ut-source-${m.value}`}
                      onClick={() => switchEmployeeSource(m.value)}
                      className={cn(
                        "cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors duration-200",
                        active
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/80 hover:bg-muted/40",
                      )}
                    >
                      <span className="block text-sm font-medium text-foreground">{m.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                        {m.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {assignForm.employeeSource === "MASTER_DATA" ? (
              <div className="space-y-1.5">
                <Label htmlFor="ut-new-user">New user *</Label>
                <Select
                  value={assignForm.employeeId || undefined}
                  onValueChange={(v) => onAssignFormChange({ employeeId: v })}
                >
                  <SelectTrigger id="ut-new-user" className="cursor-pointer" data-testid="ut-employee-select">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((e) => e.id !== context.current_employee_id)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id} className="cursor-pointer">
                          {e.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-4" data-testid="ut-manual-fields">
                <div className="space-y-1.5">
                  <Label htmlFor="ut-manual-name">Employee Name *</Label>
                  <Input
                    id="ut-manual-name"
                    data-testid="ut-manual-name"
                    value={assignForm.manualEmployeeName}
                    onChange={(e) => onAssignFormChange({ manualEmployeeName: e.target.value })}
                    placeholder="Enter employee name"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ut-manual-phone">Phone *</Label>
                  <Input
                    id="ut-manual-phone"
                    data-testid="ut-manual-phone"
                    value={assignForm.manualEmployeePhone}
                    onChange={(e) => onAssignFormChange({ manualEmployeePhone: e.target.value })}
                    placeholder="Enter phone"
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ut-manual-email">Email</Label>
                  <Input
                    id="ut-manual-email"
                    data-testid="ut-manual-email"
                    type="email"
                    value={assignForm.manualEmployeeEmail}
                    onChange={(e) => onAssignFormChange({ manualEmployeeEmail: e.target.value })}
                    placeholder="Optional"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ut-manual-deployed">Deployed to *</Label>
                  <Input
                    id="ut-manual-deployed"
                    data-testid="ut-manual-deployed"
                    value={assignForm.manualEmployeeDeployedTo}
                    onChange={(e) =>
                      onAssignFormChange({ manualEmployeeDeployedTo: e.target.value })
                    }
                    placeholder="e.g. Client site — Gurugram"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ut-dept">
                Department{assignForm.employeeSource === "MANUAL_ENTRY" ? " *" : ""}
              </Label>
              {assignForm.employeeSource === "MASTER_DATA" ? (
                <Input
                  id="ut-dept"
                  readOnly
                  value={departmentLabel}
                  placeholder="Auto-filled when employee is selected"
                  className="bg-muted/30"
                  data-testid="ut-department-readonly"
                />
              ) : (
                <Select
                  value={assignForm.departmentId || undefined}
                  onValueChange={(v) => onAssignFormChange({ departmentId: v })}
                >
                  <SelectTrigger id="ut-dept" className="cursor-pointer" data-testid="ut-department-select">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="cursor-pointer">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ut-loc">Location *</Label>
                <Select
                  value={assignForm.toLocationId || undefined}
                  onValueChange={(v) =>
                    onAssignFormChange({ toLocationId: v, toBuildingId: "" })
                  }
                >
                  <SelectTrigger id="ut-loc" className="cursor-pointer" data-testid="ut-location-select">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {siteLocations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id} className="cursor-pointer">
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ut-bldg">Building *</Label>
                <Select
                  value={assignForm.toBuildingId || undefined}
                  onValueChange={(v) => onAssignFormChange({ toBuildingId: v })}
                  disabled={!assignForm.toLocationId}
                >
                  <SelectTrigger id="ut-bldg" className="cursor-pointer" data-testid="ut-building-select">
                    <SelectValue
                      placeholder={
                        assignForm.toLocationId ? "Select building" : "Select location first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="cursor-pointer">
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ut-date">Assignment date *</Label>
              <Input
                id="ut-date"
                type="date"
                value={assignForm.allocatedAt}
                onChange={(e) => onAssignFormChange({ allocatedAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ut-remarks">Remarks</Label>
              <Input
                id="ut-remarks"
                value={assignForm.assignmentRemarks}
                onChange={(e) => onAssignFormChange({ assignmentRemarks: e.target.value })}
                placeholder="Optional"
              />
            </div>
            {components.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Assigned components</p>
                <ul className="rounded-lg border border-border px-3 py-2 text-sm">
                  {components.map((row) => (
                    <li key={row.component_id} className="py-1">
                      {componentLabel(row)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={onBackToVerification}
              >
                Back
              </Button>
              <Button
                type="button"
                className={cn(
                  ASSETS_ACCENT_BTN,
                  (!assignReady || assignBlockedByCondition || finalizeBusy) &&
                    "cursor-not-allowed opacity-60",
                )}
                disabled={!assignReady || assignBlockedByCondition || Boolean(finalizeBusy)}
                onClick={onSubmitAssign}
                data-testid="submit-assign"
              >
                {finalizeBusy ? "Transferring…" : "Transfer & assign"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "return" ? (
        <Card className={ASSETS_SURFACE_CARD} data-testid="return-form">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-base font-semibold">Return to stock</CardTitle>
          </CardHeader>
          <CardContent className="grid max-w-lg gap-4 pt-5">
            <p className="text-sm text-muted-foreground">
              Asset <span className="font-medium text-foreground">{context.asset_code}</span>
              {context.current_user ? (
                <>
                  {" "}
                  — previous user{" "}
                  <span className="font-medium text-foreground">{context.current_user}</span>
                </>
              ) : null}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="ut-return-reason">Reason *</Label>
              <Input
                id="ut-return-reason"
                value={returnForm.reason}
                onChange={(e) => onReturnFormChange({ reason: e.target.value })}
                maxLength={500}
                placeholder="Short audit reason"
                data-testid="return-reason"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ut-return-remarks">Remarks</Label>
              <textarea
                id="ut-return-remarks"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={returnForm.remarks}
                onChange={(e) => onReturnFormChange({ remarks: e.target.value })}
                maxLength={4000}
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={onBackToVerification}
              >
                Back
              </Button>
              <Button
                type="button"
                className={cn(
                  ASSETS_ACCENT_BTN,
                  (!returnReady || finalizeBusy) && "cursor-not-allowed opacity-60",
                )}
                disabled={!returnReady || Boolean(finalizeBusy)}
                onClick={onSubmitReturn}
                data-testid="submit-return"
              >
                {finalizeBusy ? "Returning…" : "Return to stock"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {finalizeError ? (
        <p className="text-sm text-destructive" data-testid="finalize-error">
          {finalizeError}
        </p>
      ) : null}
    </div>
  );
}

export { EMPTY_USER_TRANSFER_ASSIGN, EMPTY_USER_TRANSFER_RETURN };
