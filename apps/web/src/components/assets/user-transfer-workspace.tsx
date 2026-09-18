"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, UserRound } from "lucide-react";

import {
  EmptyState,
  StatusBadge,
} from "@/components/assets/shared";
import {
  ASSETS_ACCENT_BTN,
  ASSETS_SURFACE_CARD,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import { isOperationalStatus } from "@/components/assets/shared/asset-status";
import {
  EMPTY_USER_TRANSFER_VERIFICATION,
  USER_TRANSFER_PHYSICAL_CONDITIONS,
  isUserTransferVerificationComplete,
  toggleVerifiedComponent,
  type UserTransferVerificationFormState,
} from "@/components/assets/user-transfer-verification";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { UserTransferDestinationPanel } from "@/components/assets/user-transfer-destination-panel";
import type {
  UserTransferAssignFormState,
  UserTransferDestinationMode,
  UserTransferReturnFormState,
} from "@/components/assets/user-transfer-destination";
import type { OrgOption } from "@/lib/org-options";
import type {
  UserTransferContext,
  UserTransferVerificationResult,
} from "@/services/assets-service";

export type UserTransferStage = "verification" | "destination";

export type UserTransferWorkspaceProps = {
  assetId: string | null;
  context: UserTransferContext | null;
  loading: boolean;
  errorMessage: string | null;
  verification: UserTransferVerificationFormState;
  onVerificationChange: (patch: Partial<UserTransferVerificationFormState>) => void;
  stage: UserTransferStage;
  submitBusy?: boolean;
  submitError?: string | null;
  verificationResult?: UserTransferVerificationResult | null;
  onContinue: () => void;
  onRetry: () => void;
  onBackToInventory: () => void;
  onBackToVerification?: () => void;
  destinationMode?: UserTransferDestinationMode;
  onDestinationModeChange?: (mode: UserTransferDestinationMode) => void;
  assignForm?: UserTransferAssignFormState;
  onAssignFormChange?: (patch: Partial<UserTransferAssignFormState>) => void;
  returnForm?: UserTransferReturnFormState;
  onReturnFormChange?: (patch: Partial<UserTransferReturnFormState>) => void;
  employees?: OrgOption[];
  departments?: OrgOption[];
  finalizeBusy?: boolean;
  finalizeError?: string | null;
  onSubmitAssign?: () => void;
  onSubmitReturn?: () => void;
};

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border/40 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

function formatAllocatedAt(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function componentLabel(row: NonNullable<UserTransferContext["components"]>[number]): string {
  return (
    row.component_name ||
    row.linked_asset_name ||
    row.component_code ||
    row.component_type ||
    row.component_id
  );
}

/**
 * Step 1 + Step 2 — Assigned asset context and pre-transfer verification.
 * Step 3 — assign to new user or return to stock.
 */
export function UserTransferWorkspace({
  assetId,
  context,
  loading,
  errorMessage,
  verification,
  onVerificationChange,
  stage,
  submitBusy,
  submitError,
  verificationResult,
  onContinue,
  onRetry,
  onBackToInventory,
  onBackToVerification,
  destinationMode,
  onDestinationModeChange,
  assignForm,
  onAssignFormChange,
  returnForm,
  onReturnFormChange,
  employees = [],
  departments = [],
  finalizeBusy,
  finalizeError,
  onSubmitAssign,
  onSubmitReturn,
}: UserTransferWorkspaceProps) {
  const components = context?.components ?? [];
  const issuedIds = components.map((c) => c.component_id);
  const canContinue = isUserTransferVerificationComplete(verification, issuedIds);

  return (
    <AssetsPremiumPage testId="user-transfer-workspace">
      <PageHeader
        title="Transfer Asset"
        description="Verify the asset before choosing the next custody step."
        actions={
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer gap-2 transition-colors duration-200"
            onClick={onBackToInventory}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to inventory
          </Button>
        }
      />

      {!assetId ? (
        <Card className={ASSETS_SURFACE_CARD}>
          <CardContent className="space-y-4 py-8">
            <EmptyState
              title="Asset required"
              description="Open Transfer from an Assigned asset on All Assets."
            />
            <div className="flex justify-center">
              <Button type="button" className="cursor-pointer" onClick={onBackToInventory}>
                Go to All Assets
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {assetId && loading ? (
        <Card className={ASSETS_SURFACE_CARD}>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Loading asset transfer context…
          </CardContent>
        </Card>
      ) : null}

      {assetId && !loading && errorMessage ? (
        <Card className={ASSETS_SURFACE_CARD}>
          <CardContent className="space-y-4 py-8">
            <EmptyState title="Transfer not available" description={errorMessage} />
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={onRetry}
              >
                Retry
              </Button>
              <Button type="button" className="cursor-pointer" onClick={onBackToInventory}>
                Back to inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {assetId && !loading && !errorMessage && context ? (
        <div className="space-y-5">
          <Card className={ASSETS_SURFACE_CARD} data-testid="user-transfer-asset-summary">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-base font-semibold">Asset details</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <dl>
                <DetailRow
                  label="Asset Code"
                  value={<span className="font-mono text-xs">{context.asset_code}</span>}
                />
                <DetailRow label="Asset Name" value={context.asset_name} />
                <DetailRow
                  label="Operational Status"
                  value={
                    isOperationalStatus(context.operational_status) ? (
                      <StatusBadge kind="operational" status={context.operational_status} />
                    ) : (
                      context.operational_status
                    )
                  }
                />
                <DetailRow label="Current User" value={context.current_user ?? "—"} />
                <DetailRow label="Department" value={context.department_name ?? "—"} />
                <DetailRow label="Location" value={context.location_label ?? "—"} />
              </dl>
            </CardContent>
          </Card>

          <Card className={ASSETS_SURFACE_CARD} data-testid="user-transfer-assignment">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <UserRound className="size-4 text-[#0369A1]" aria-hidden />
                Current assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <dl>
                <DetailRow
                  label="Document"
                  value={
                    <span className="font-mono text-xs">
                      {context.assignment_document_number ?? context.assignment_id}
                    </span>
                  }
                />
                <DetailRow label="Status" value={context.assignment_status ?? "active"} />
                <DetailRow
                  label="Allocated at"
                  value={formatAllocatedAt(context.assignment_allocated_at)}
                />
                <DetailRow label="Holder" value={context.current_user ?? "—"} />
              </dl>
            </CardContent>
          </Card>

          {stage === "verification" ? (
            <Card className={ASSETS_SURFACE_CARD} data-testid="user-transfer-verification">
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ClipboardCheck className="size-4 text-[#0369A1]" aria-hidden />
                  Pre-transfer verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-5">
                <section className="space-y-3" data-testid="verification-data-backup">
                  <h3 className="text-sm font-medium text-foreground">
                    Previous user data backup
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Previous user:{" "}
                    <span className="font-medium text-foreground">
                      {context.current_user ?? "—"}
                    </span>
                  </p>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 transition-colors duration-200 hover:bg-muted/30">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 cursor-pointer"
                      checked={verification.dataBackupVerified}
                      onChange={(e) =>
                        onVerificationChange({ dataBackupVerified: e.target.checked })
                      }
                      data-testid="check-data-backup"
                    />
                    <span className="text-sm">
                      <span className="font-medium">Data backup verified</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Confirm important data for the previous user has been backed up.
                      </span>
                    </span>
                  </label>
                </section>

                <section className="space-y-3" data-testid="verification-qc">
                  <h3 className="text-sm font-medium text-foreground">QC testing</h3>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-3 transition-colors duration-200 hover:bg-muted/30">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 cursor-pointer"
                      checked={verification.qcCompleted}
                      onChange={(e) =>
                        onVerificationChange({ qcCompleted: e.target.checked })
                      }
                      data-testid="check-qc"
                    />
                    <span className="text-sm">
                      <span className="font-medium">QC testing completed</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Asset has been checked and is suitable for the next step.
                      </span>
                    </span>
                  </label>
                  <div className="space-y-1.5">
                    <Label htmlFor="qc-remarks">QC remarks (optional)</Label>
                    <Input
                      id="qc-remarks"
                      value={verification.qcRemarks}
                      onChange={(e) => onVerificationChange({ qcRemarks: e.target.value })}
                      placeholder="Notes from QC check"
                      className="transition-colors duration-200"
                      data-testid="qc-remarks"
                    />
                  </div>
                </section>

                <section className="space-y-3" data-testid="verification-condition">
                  <h3 className="text-sm font-medium text-foreground">Physical condition</h3>
                  <div
                    className="grid gap-2"
                    role="radiogroup"
                    aria-label="Physical condition"
                  >
                    {USER_TRANSFER_PHYSICAL_CONDITIONS.map((opt) => {
                      const checked = verification.physicalCondition === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border px-3 py-3 transition-colors duration-200",
                            checked
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/30",
                          )}
                        >
                          <input
                            type="radio"
                            name="physical-condition"
                            className="mt-1 size-4 cursor-pointer"
                            checked={checked}
                            onChange={() =>
                              onVerificationChange({ physicalCondition: opt.value })
                            }
                            data-testid={`condition-${opt.value}`}
                          />
                          <span className="text-sm">
                            <span className="font-medium text-foreground">{opt.label}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {opt.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-3" data-testid="verification-components">
                  <h3 className="text-sm font-medium text-foreground">
                    Components / accessories
                  </h3>
                  {components.length === 0 ? (
                    <p
                      className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground"
                      data-testid="no-components"
                    >
                      No components currently assigned.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Verified</th>
                            <th className="px-3 py-2 font-medium">Component</th>
                            <th className="px-3 py-2 font-medium">Serial</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {components.map((row) => {
                            const checked = verification.verifiedComponentIds.includes(
                              row.component_id,
                            );
                            return (
                              <tr
                                key={row.component_id}
                                className="border-t border-border/60"
                                data-testid={`component-row-${row.component_id}`}
                              >
                                <td className="px-3 py-2.5">
                                  <input
                                    type="checkbox"
                                    className="size-4 cursor-pointer"
                                    checked={checked}
                                    aria-label={`Verify ${componentLabel(row)}`}
                                    onChange={(e) =>
                                      onVerificationChange({
                                        verifiedComponentIds: toggleVerifiedComponent(
                                          verification.verifiedComponentIds,
                                          row.component_id,
                                          e.target.checked,
                                        ),
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2.5 font-medium">
                                  {componentLabel(row)}
                                  {row.component_type ? (
                                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                      {row.component_type}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs">
                                  {row.serial_number || "—"}
                                </td>
                                <td className="px-3 py-2.5">{row.issue_status}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {submitError ? (
                  <p className="text-sm text-destructive" data-testid="verification-submit-error">
                    {submitError}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <p className="text-xs text-muted-foreground">
                    Continue stays disabled until all required checks are complete.
                  </p>
                  <Button
                    type="button"
                    className={cn(
                      ASSETS_ACCENT_BTN,
                      (!canContinue || submitBusy) && "cursor-not-allowed opacity-60",
                    )}
                    disabled={!canContinue || Boolean(submitBusy)}
                    onClick={onContinue}
                    data-testid="continue-transfer"
                  >
                    {submitBusy ? "Saving…" : "Continue"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : context && verificationResult && assignForm && returnForm ? (
            <UserTransferDestinationPanel
              context={context}
              verificationResult={verificationResult}
              mode={destinationMode ?? null}
              onModeChange={onDestinationModeChange ?? (() => undefined)}
              assignForm={assignForm}
              onAssignFormChange={onAssignFormChange ?? (() => undefined)}
              returnForm={returnForm}
              onReturnFormChange={onReturnFormChange ?? (() => undefined)}
              employees={employees}
              departments={departments}
              finalizeBusy={finalizeBusy}
              finalizeError={finalizeError}
              onSubmitAssign={onSubmitAssign ?? (() => undefined)}
              onSubmitReturn={onSubmitReturn ?? (() => undefined)}
              onBackToVerification={onBackToVerification}
            />
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            <Link
              href="/assets/assets"
              className="text-primary underline-offset-4 hover:underline"
            >
              Back to inventory
            </Link>
          </p>
        </div>
      ) : null}
    </AssetsPremiumPage>
  );
}

export { EMPTY_USER_TRANSFER_VERIFICATION };
