"use client";

import { useCallback, useState } from "react";

import { WizardFooter } from "@/components/assets/assignment-wizard/wizard-footer";
import { WizardShell } from "@/components/assets/assignment-wizard/wizard-shell";
import { WizardProgressBar, WizardStepper } from "@/components/assets/assignment-wizard/wizard-stepper";
import { ReturnConditionStep } from "@/components/assets/assignment-wizard/steps/return-condition-step";
import { ReturnComponentsStep } from "@/components/assets/assignment-wizard/steps/return-components-step";
import { ReturnRemarksStep } from "@/components/assets/assignment-wizard/steps/return-remarks-step";
import { ReturnReviewStep } from "@/components/assets/assignment-wizard/steps/return-review-step";
import { ReturnSummaryStep } from "@/components/assets/assignment-wizard/steps/return-summary-step";
import type { ReturnSummaryView } from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import {
  EMPTY_RETURN_WIZARD_STATE,
  RETURN_WIZARD_STEPS,
  type ReturnWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";

export type ReturnWizardProps = {
  loading?: boolean;
  saving?: boolean;
  initialState?: Partial<ReturnWizardState>;
  summary?: ReturnSummaryView;
  onCancel?: () => void;
  onFinish?: (state: ReturnWizardState) => void;
};

export function ReturnWizard({
  loading,
  saving,
  initialState,
  summary,
  onCancel,
  onFinish,
}: ReturnWizardProps) {
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [state, setState] = useState<ReturnWizardState>({
    ...EMPTY_RETURN_WIZARD_STATE,
    ...initialState,
  });

  const patch = useCallback((p: Partial<ReturnWizardState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= RETURN_WIZARD_STEPS.length) return;
    setStep(index);
    setMaxVisited((m) => Math.max(m, index));
  }, []);

  const busy = Boolean(loading || saving);
  const stepMeta = RETURN_WIZARD_STEPS[step];

  return (
    <WizardShell
      title="Return asset"
      stepTitle={stepMeta?.label ?? ""}
      loading={loading}
      progress={<WizardProgressBar currentIndex={step} totalSteps={RETURN_WIZARD_STEPS.length} />}
      sidebar={
        <WizardStepper
          steps={RETURN_WIZARD_STEPS}
          currentIndex={step}
          maxVisitedIndex={maxVisited}
          onStepClick={goTo}
          orientation="vertical"
          className="hidden sm:block"
        />
      }
      footer={
        <WizardFooter
          isFirst={step === 0}
          isLast={step === RETURN_WIZARD_STEPS.length - 1}
          loading={busy}
          finishLabel="Confirm return"
          showSaveDraft={false}
          onBack={() => goTo(step - 1)}
          onNext={() => goTo(step + 1)}
          onCancel={() => onCancel?.()}
          onFinish={() => onFinish?.(state)}
        />
      }
    >
      {step === 0 ? <ReturnSummaryStep summary={summary} /> : null}
      {step === 1 ? <ReturnConditionStep state={state} onChange={patch} /> : null}
      {step === 2 ? <ReturnComponentsStep state={state} onChange={patch} /> : null}
      {step === 3 ? <ReturnRemarksStep state={state} onChange={patch} /> : null}
      {step === 4 ? <ReturnReviewStep state={state} summary={summary} /> : null}
    </WizardShell>
  );
}
