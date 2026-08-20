"use client";

import { useCallback, useEffect, useState } from "react";

import { WizardFooter } from "@/components/assets/assignment-wizard/wizard-footer";
import { WizardShell } from "@/components/assets/assignment-wizard/wizard-shell";
import { WizardProgressBar, WizardStepper } from "@/components/assets/assignment-wizard/wizard-stepper";
import { AssignmentReviewStep } from "@/components/assets/assignment-wizard/steps/assignment-review-step";
import { AssetStep } from "@/components/assets/assignment-wizard/steps/asset-step";
import { DeliveryStep } from "@/components/assets/assignment-wizard/steps/delivery-step";
import { EmployeeStep } from "@/components/assets/assignment-wizard/steps/employee-step";
import { IssuedItemsStep } from "@/components/assets/assignment-wizard/steps/issued-items-step";
import type {
  WizardAssetOption,
  WizardEmployeeOption,
  WizardIssuedItemOption,
  WizardSelectOption,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import {
  ASSIGNMENT_WIZARD_STEPS,
  EMPTY_ASSIGNMENT_WIZARD_STATE,
  PREFILLED_ASSIGNMENT_WIZARD_STEPS,
  type AssignmentWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";
import { validateAssignmentStepId } from "@/components/assets/assignment-wizard/wizard-validation";

export type AssignmentWizardProps = {
  loading?: boolean;
  saving?: boolean;
  branchLabel?: string;
  initialState?: Partial<AssignmentWizardState>;
  employees?: WizardEmployeeOption[];
  assets?: WizardAssetOption[];
  issuedItems?: WizardIssuedItemOption[];
  onCancel?: () => void;
  onSaveDraft?: (state: AssignmentWizardState) => void;
  onFinish?: (state: AssignmentWizardState) => void;
  onAssetChange?: (assetId: string) => void;
  /** Last-step primary action label (container may pass Submit). */
  finishLabel?: string;
  /** View-only mode (no edits). */
  readOnly?: boolean;
  /** Lock asset picklist (e.g. post-activation). */
  lockAsset?: boolean;
  /** Query/drawer-provided asset id; show read-only asset step and skip duplicate pick. */
  prefilledAsset?: boolean;
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
  finishLabel = "Save draft",
  readOnly,
  lockAsset,
  prefilledAsset = false,
}: AssignmentWizardProps) {
  const steps = prefilledAsset ? PREFILLED_ASSIGNMENT_WIZARD_STEPS : ASSIGNMENT_WIZARD_STEPS;
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [state, setState] = useState<AssignmentWizardState>({
    ...EMPTY_ASSIGNMENT_WIZARD_STATE,
    ...initialState,
  });
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    if (initialState) {
      setState((s) => ({ ...s, ...initialState }));
    }
  }, [initialState]);

  const patch = useCallback(
    (p: Partial<AssignmentWizardState>) => {
      setState((s) => {
        const next = { ...s, ...p };
        return next;
      });
      if (p.assetId) {
        queueMicrotask(() => onAssetChange?.(p.assetId!));
      }
      setStepError(null);
    },
    [onAssetChange],
  );

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= steps.length) return;
    setStep(index);
    setMaxVisited((m) => Math.max(m, index));
    setStepError(null);
  }, [steps.length]);

  const tryNext = useCallback(() => {
    const err = validateAssignmentStepId(steps[step]?.id ?? "", state);
    if (err) {
      setStepError(err);
      return;
    }
    goTo(step + 1);
  }, [goTo, state, step, steps]);

  const tryFinish = useCallback(() => {
    for (let i = 0; i < steps.length - 1; i += 1) {
      const err = validateAssignmentStepId(steps[i]?.id ?? "", state);
      if (err) {
        setStepError(err);
        goTo(i);
        return;
      }
    }
    onFinish?.(state);
  }, [goTo, onFinish, state, steps]);

  const busy = Boolean(loading || saving);
  const stepMeta = steps[step];
  const assetOptionsForReview: WizardSelectOption[] =
    assets?.map((a) => ({ id: a.id, label: `${a.code} — ${a.label}` })) ?? [];

  return (
    <WizardShell
      title="Issue asset"
      stepTitle={stepMeta?.label ?? ""}
      branchLabel={branchLabel}
      loading={loading}
      progress={
        <div className="lg:hidden">
          <WizardProgressBar currentIndex={step} totalSteps={steps.length} />
        </div>
      }
      sidebar={
        <WizardStepper
          steps={steps}
          currentIndex={step}
          maxVisitedIndex={maxVisited}
          onStepClick={goTo}
          orientation="vertical"
        />
      }
      footer={
        readOnly ? (
          <WizardFooter
            isFirst={step === 0}
            isLast={step === steps.length - 1}
            loading={busy}
            finishLabel="Close"
            onBack={() => goTo(step - 1)}
            onNext={tryNext}
            onCancel={() => onCancel?.()}
            onFinish={() => onCancel?.()}
          />
        ) : (
          <WizardFooter
            isFirst={step === 0}
            isLast={step === steps.length - 1}
            loading={busy}
            finishLabel={finishLabel}
            onBack={() => goTo(step - 1)}
            onNext={tryNext}
            onCancel={() => onCancel?.()}
            onSaveDraft={() => onSaveDraft?.(state)}
            onFinish={tryFinish}
          />
        )
      }
    >
      {stepError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {stepError}
        </p>
      ) : null}
      {stepMeta?.id === "employee" ? (
        <EmployeeStep
          state={state}
          onChange={patch}
          showAdvancedAllocation
          employees={employees}
          readOnly={readOnly}
          loading={loading}
        />
      ) : null}
      {stepMeta?.id === "asset" ? (
        <AssetStep
          state={state}
          onChange={patch}
          assets={assets}
          prefilledAsset={prefilledAsset}
          lockAsset={prefilledAsset || lockAsset}
          readOnly={readOnly}
        />
      ) : null}
      {stepMeta?.id === "issued-items" ? (
        <IssuedItemsStep state={state} onChange={patch} items={issuedItems} readOnly={readOnly} />
      ) : null}
      {stepMeta?.id === "delivery" ? (
        <DeliveryStep state={state} onChange={patch} readOnly={readOnly} />
      ) : null}
      {stepMeta?.id === "review" ? (
        <AssignmentReviewStep
          state={state}
          employees={employees}
          assets={assetOptionsForReview}
          issuedItems={issuedItems}
        />
      ) : null}
    </WizardShell>
  );
}
