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
  WizardIssuedItemOption,
  WizardSelectOption,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import {
  ASSIGNMENT_WIZARD_STEPS,
  EMPTY_ASSIGNMENT_WIZARD_STATE,
  type AssignmentWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";
import { validateAssignmentStep } from "@/components/assets/assignment-wizard/wizard-validation";

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
  /** Last-step primary action label (container may pass Submit). */
  finishLabel?: string;
  unavailableAssetMessage?: string | null;
  onClearUnavailableAsset?: () => void;
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
  unavailableAssetMessage,
  onClearUnavailableAsset,
}: AssignmentWizardProps) {
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
        if (p.assetId && p.assetId !== s.assetId) {
          onAssetChange?.(p.assetId);
        }
        return next;
      });
      setStepError(null);
    },
    [onAssetChange],
  );

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= ASSIGNMENT_WIZARD_STEPS.length) return;
    setStep(index);
    setMaxVisited((m) => Math.max(m, index));
    setStepError(null);
  }, []);

  const tryNext = useCallback(() => {
    const err = validateAssignmentStep(step, state);
    if (err) {
      setStepError(err);
      return;
    }
    goTo(step + 1);
  }, [goTo, state, step]);

  const tryFinish = useCallback(() => {
    for (let i = 0; i < ASSIGNMENT_WIZARD_STEPS.length - 1; i += 1) {
      const err = validateAssignmentStep(i, state);
      if (err) {
        setStepError(err);
        goTo(i);
        return;
      }
    }
    onFinish?.(state);
  }, [goTo, onFinish, state]);

  const busy = Boolean(loading || saving);
  const stepMeta = ASSIGNMENT_WIZARD_STEPS[step];
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
          <WizardProgressBar currentIndex={step} totalSteps={ASSIGNMENT_WIZARD_STEPS.length} />
        </div>
      }
      sidebar={
        <WizardStepper
          steps={ASSIGNMENT_WIZARD_STEPS}
          currentIndex={step}
          maxVisitedIndex={maxVisited}
          onStepClick={goTo}
          orientation="vertical"
        />
      }
      footer={
        <WizardFooter
          isFirst={step === 0}
          isLast={step === ASSIGNMENT_WIZARD_STEPS.length - 1}
          loading={busy}
          finishLabel={finishLabel}
          onBack={() => goTo(step - 1)}
          onNext={tryNext}
          onCancel={() => onCancel?.()}
          onSaveDraft={() => onSaveDraft?.(state)}
          onFinish={tryFinish}
        />
      }
    >
      {stepError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {stepError}
        </p>
      ) : null}
      {step === 0 ? (
        <EmployeeStep state={state} onChange={patch} showAdvancedAllocation employees={employees} />
      ) : null}
      {step === 1 ? (
        <AssetStep
          state={state}
          onChange={patch}
          assets={assets}
          unavailableAssetMessage={unavailableAssetMessage}
          onClearUnavailableAsset={onClearUnavailableAsset}
        />
      ) : null}
      {step === 2 ? <IssuedItemsStep state={state} onChange={patch} items={issuedItems} /> : null}
      {step === 3 ? <DeliveryStep state={state} onChange={patch} /> : null}
      {step === 4 ? (
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
