"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { WizardFooter } from "@/components/assets/assignment-wizard/wizard-footer";
import { WizardShell } from "@/components/assets/assignment-wizard/wizard-shell";
import {
  WizardProgressBar,
  WizardStepper,
} from "@/components/assets/assignment-wizard/wizard-stepper";
import { AssignmentReviewStep } from "@/components/assets/assignment-wizard/steps/assignment-review-step";
import { AssetStep } from "@/components/assets/assignment-wizard/steps/asset-step";
import {
  DeliveryStep,
  type UnlinkedDcChallanOption,
} from "@/components/assets/assignment-wizard/steps/delivery-step";
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
import {
  listMissingAssignmentFields,
  validateAssignmentStep,
} from "@/components/assets/assignment-wizard/wizard-validation";
import {
  ASSETS_ACCENT_BTN,
  AssetsPremiumPage,
} from "@/components/assets/shared/premium-surface";
import { cn } from "@/lib/utils";

export type AssignmentWizardProps = {
  loading?: boolean;
  saving?: boolean;
  branchLabel?: string;
  initialState?: Partial<AssignmentWizardState>;
  employees?: WizardSelectOption[];
  assets?: WizardAssetOption[];
  issuedItems?: WizardIssuedItemOption[];
  onRefreshIssuedItems?: () => Promise<void> | void;
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

const STEPS = ASSIGNMENT_FORM_SECTIONS;
const STEP_HINTS: Record<string, string> = {
  allocation: "Who receives this asset — directory employee or manual entry.",
  asset: "Pick one Ready to Move asset for this issue.",
  "issued-items": "Optional accessories or attach an eligible asset as a component.",
  delivery: "Most issues skip DC at handover — choose only if needed.",
  review: "Confirm details, then submit or save a draft.",
};

export function AssignmentWizard({
  loading,
  saving,
  branchLabel = "HQ",
  initialState,
  employees,
  assets,
  issuedItems,
  onRefreshIssuedItems,
  onCancel,
  onSaveDraft,
  onFinish,
  onAssetChange,
  finishLabel = "Submit",
  unavailableAssetMessage,
  onClearUnavailableAsset,
  unlinkedDcChallans,
}: AssignmentWizardProps) {
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
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
      setStepError(null);
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

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= STEPS.length) return;
    setStepError(null);
    setStep(index);
    setMaxVisited((m) => Math.max(m, index));
  }, []);

  const tryNext = useCallback(() => {
    const err = validateAssignmentStep(step, state);
    if (err) {
      setStepError(err);
      return;
    }
    goTo(step + 1);
  }, [goTo, state, step]);

  const missing = useMemo(() => listMissingAssignmentFields(state), [state]);
  const fieldErrors = useMemo(
    () => Object.fromEntries(missing.map((item) => [item.id, `${item.label} is required.`])),
    [missing],
  );
  const busy = Boolean(loading || saving);
  const stepMeta = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const assetOptionsForReview: WizardSelectOption[] =
    assets?.map((a) => ({ id: a.id, label: `${a.code} — ${a.label}` })) ?? [];

  return (
    <AssetsPremiumPage testId="assignment-issue-wizard">
      <WizardShell
        title="Issue asset"
        stepTitle={stepMeta?.label ?? ""}
        stepDescription={stepMeta ? STEP_HINTS[stepMeta.id] : undefined}
        branchLabel={branchLabel}
        loading={loading}
        progress={
          <div className="space-y-3">
            <WizardProgressBar currentIndex={step} totalSteps={STEPS.length} />
            <WizardStepper
              steps={STEPS}
              currentIndex={step}
              maxVisitedIndex={maxVisited}
              onStepClick={goTo}
              orientation="horizontal"
              className="lg:hidden"
            />
          </div>
        }
        sidebar={
          <WizardStepper
            steps={STEPS}
            currentIndex={step}
            maxVisitedIndex={maxVisited}
            onStepClick={goTo}
            orientation="vertical"
          />
        }
        footer={
          <div className="space-y-2">
            {stepError ? (
              <p className="text-xs text-destructive" role="alert" data-testid="issue-step-error">
                {stepError}
              </p>
            ) : null}
            {isLast && missing.length > 0 ? (
              <p
                className="text-xs text-muted-foreground"
                data-testid="issue-missing-summary"
                role="status"
              >
                Complete these fields to submit: {missing.map((m) => m.label).join(", ")}
              </p>
            ) : null}
            <WizardFooter
              isFirst={step === 0}
              isLast={isLast}
              loading={busy}
              nextDisabled={false}
              finishLabel={finishLabel}
              showSaveDraft
              finishClassName={ASSETS_ACCENT_BTN}
              onBack={() => goTo(step - 1)}
              onNext={tryNext}
              onCancel={() => onCancel?.()}
              onSaveDraft={() => onSaveDraft?.(state)}
              onFinish={() => onFinish?.(state)}
              finishDisabled={missing.length > 0}
            />
          </div>
        }
      >
        <div
          key={stepMeta?.id}
          className={cn(
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200",
            "motion-reduce:animate-none",
          )}
        >
          {step === 0 ? (
            <EmployeeStep
              state={state}
              onChange={patch}
              showAdvancedAllocation
              employees={employees}
              fieldErrors={fieldErrors}
            />
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
          {step === 2 ? (
            <IssuedItemsStep
              state={state}
              onChange={patch}
              items={issuedItems}
              onRefreshItems={onRefreshIssuedItems}
            />
          ) : null}
          {step === 3 ? (
            <DeliveryStep state={state} onChange={patch} unlinkedChallans={unlinkedDcChallans} />
          ) : null}
          {step === 4 ? (
            <AssignmentReviewStep
              state={state}
              employees={employees}
              assets={assetOptionsForReview}
              issuedItems={issuedItems}
            />
          ) : null}
        </div>
      </WizardShell>
    </AssetsPremiumPage>
  );
}
