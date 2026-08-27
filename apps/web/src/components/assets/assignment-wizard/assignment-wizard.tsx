"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IssueFormFooter } from "@/components/assets/assignment-wizard/issue-form-footer";
import { IssueFormSection, IssueFormShell } from "@/components/assets/assignment-wizard/issue-form-shell";
import { AssignmentReviewStep } from "@/components/assets/assignment-wizard/steps/assignment-review-step";
import { AssetStep } from "@/components/assets/assignment-wizard/steps/asset-step";
import { DeliveryStep, type UnlinkedDcChallanOption } from "@/components/assets/assignment-wizard/steps/delivery-step";
import { EmployeeStep } from "@/components/assets/assignment-wizard/steps/employee-step";
import { IssuedItemsStep } from "@/components/assets/assignment-wizard/steps/issued-items-step";
import type {
  WizardAssetOption,
  WizardIssuedItemOption,
  WizardSelectOption,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import {
  ASSIGNMENT_FORM_SECTIONS,
  EMPTY_ASSIGNMENT_WIZARD_STATE,
  type AssignmentWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";
import { listMissingAssignmentFields } from "@/components/assets/assignment-wizard/wizard-validation";

export type AssignmentWizardProps = {
  loading?: boolean;
  saving?: boolean;
  branchLabel?: string;
  initialState?: Partial<AssignmentWizardState>;
  employees?: WizardSelectOption[];
  assets?: WizardAssetOption[];
  issuedItems?: WizardIssuedItemOption[];
  onCancel?: () => void;
  onSaveDraft?: (state: AssignmentWizardState) => void;
  onFinish?: (state: AssignmentWizardState) => void;
  onAssetChange?: (assetId: string) => void;
  /** Primary action label (container may pass Submit). */
  finishLabel?: string;
  unavailableAssetMessage?: string | null;
  onClearUnavailableAsset?: () => void;
  unlinkedDcChallans?: UnlinkedDcChallanOption[];
};

export function AssignmentWizard({
  loading,
  saving,
  branchLabel = "HQ",
  initialState,
  employees,
  assets,
  issuedItems,
  onCancel,
  onSaveDraft,
  onFinish,
  onAssetChange,
  finishLabel = "Submit",
  unavailableAssetMessage,
  onClearUnavailableAsset,
  unlinkedDcChallans,
}: AssignmentWizardProps) {
  const [state, setState] = useState<AssignmentWizardState>({
    ...EMPTY_ASSIGNMENT_WIZARD_STATE,
    ...initialState,
  });

  useEffect(() => {
    if (initialState) {
      setState((s) => ({ ...s, ...initialState }));
    }
  }, [initialState]);

  const patch = useCallback(
    (p: Partial<AssignmentWizardState>) => {
      setState((s) => {
        const next = { ...s, ...p };
        if (p.assetId && p.assetId !== s.assetId) {
          onAssetChange?.(p.assetId);
        }
        return next;
      });
    },
    [onAssetChange],
  );

  const missing = useMemo(() => listMissingAssignmentFields(state), [state]);
  const fieldErrors = useMemo(
    () => Object.fromEntries(missing.map((item) => [item.id, `${item.label} is required.`])),
    [missing],
  );
  const busy = Boolean(loading || saving);
  const assetOptionsForReview: WizardSelectOption[] =
    assets?.map((a) => ({ id: a.id, label: `${a.code} — ${a.label}` })) ?? [];

  return (
    <IssueFormShell
      title="Issue asset"
      branchLabel={branchLabel}
      loading={loading}
      sections={ASSIGNMENT_FORM_SECTIONS}
      footer={
        <IssueFormFooter
          loading={busy}
          submitDisabled={missing.length > 0}
          missingLabels={missing.map((item) => item.label)}
          finishLabel={finishLabel}
          onCancel={() => onCancel?.()}
          onSaveDraft={() => onSaveDraft?.(state)}
          onFinish={() => onFinish?.(state)}
        />
      }
    >
      <IssueFormSection
        id="allocation"
        title="Allocation & Employee"
        description="Who receives this asset. Directory employees or a manual entry for staff deployed elsewhere."
      >
        <EmployeeStep
          state={state}
          onChange={patch}
          showAdvancedAllocation
          employees={employees}
          fieldErrors={fieldErrors}
        />
      </IssueFormSection>
      <IssueFormSection id="asset" title="Asset" description="Choose a Ready to Move asset at this branch.">
        <AssetStep
          state={state}
          onChange={patch}
          assets={assets}
          unavailableAssetMessage={unavailableAssetMessage}
          onClearUnavailableAsset={onClearUnavailableAsset}
        />
      </IssueFormSection>
      <IssueFormSection
        id="issued-items"
        title="Issued Items"
        description="Optional accessories issued with the asset."
      >
        <IssuedItemsStep state={state} onChange={patch} items={issuedItems} />
      </IssueFormSection>
      <IssueFormSection
        id="delivery"
        title="Delivery (DC paperwork)"
        description="Most issues do not need a delivery challan at handover."
      >
        <DeliveryStep state={state} onChange={patch} unlinkedChallans={unlinkedDcChallans} />
      </IssueFormSection>
      <IssueFormSection id="review" title="Review & Submit" description="Confirm details, then submit or save a draft.">
        <AssignmentReviewStep
          state={state}
          employees={employees}
          assets={assetOptionsForReview}
          issuedItems={issuedItems}
        />
      </IssueFormSection>
    </IssueFormShell>
  );
}
