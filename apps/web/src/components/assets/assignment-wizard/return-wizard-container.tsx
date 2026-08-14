"use client";

/**
 * CR-004 Phase 5B-2B Task 3 — Return Wizard Container
 *
 * Loads an active assignment, populates the presentational ReturnWizard,
 * and submits returns via AssignmentFrontendService.
 * No router, no query params, no fetch(), no inventory logic.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildReturnSummary,
  returnWizardStateToBody,
  type ReturnSummaryView,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { ReturnWizard } from "@/components/assets/assignment-wizard/return-wizard";
import { WizardLoadErrorBanner } from "@/components/assets/assignment-wizard/wizard-load-error-banner";
import {
  EMPTY_RETURN_WIZARD_STATE,
  type ReturnWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";
import { isAuthenticated } from "@/lib/auth";
import { listEmployeeOptions } from "@/lib/org-options";
import {
  assignmentFrontendService,
  type AssignmentResponse,
  type AssignmentReturnRequest,
} from "@/services/assignment-frontend-service";
import type { AssetsRow } from "@/services/assets-service";

/** Injectable AssignmentFrontendService surface for tests. */
export type ReturnWizardContainerService = {
  loadAssignment: (id: string) => Promise<AssignmentResponse>;
  findActiveAssignmentForAsset: (assetId: string) => Promise<AssignmentResponse | null>;
  getAsset: (assetId: string) => Promise<AssetsRow>;
  returnAsset: (id: string, body: AssignmentReturnRequest) => Promise<AssignmentResponse>;
  listAssignmentComponents?: (assignmentId: string) => Promise<
    Array<{
      component_id: string;
      issue_status: string;
      component_code?: string | null;
      component_name?: string | null;
      component_type?: string | null;
      serial_number?: string | null;
    }>
  >;
  formatError: (err: unknown, fallback: string) => string;
};

export type ReturnWizardContainerProps = {
  /** Preferred: load this assignment directly. */
  assignmentId?: string;
  /** Alternate: resolve the active assignment for this asset. */
  assetId?: string;
  /** Optional seed for return condition / remarks. */
  initialState?: Partial<ReturnWizardState>;
  onCancel?: () => void;
  onSuccess?: () => void;
  service?: ReturnWizardContainerService;
  listEmployees?: () => Promise<{ id: string; label: string }[]>;
};

function bindDefaultService(): ReturnWizardContainerService {
  return {
    loadAssignment: assignmentFrontendService.loadAssignment.bind(assignmentFrontendService),
    findActiveAssignmentForAsset:
      assignmentFrontendService.findActiveAssignmentForAsset.bind(assignmentFrontendService),
    getAsset: assignmentFrontendService.getAsset.bind(assignmentFrontendService),
    returnAsset: assignmentFrontendService.returnAsset.bind(assignmentFrontendService),
    listAssignmentComponents:
      assignmentFrontendService.listAssignmentComponents.bind(assignmentFrontendService),
    formatError: assignmentFrontendService.formatError.bind(assignmentFrontendService),
  };
}

export function ReturnWizardContainer({
  assignmentId: assignmentIdProp,
  assetId,
  initialState,
  onCancel,
  onSuccess,
  service: serviceProp,
  listEmployees = listEmployeeOptions,
}: ReturnWizardContainerProps) {
  const service = useMemo(() => serviceProp ?? bindDefaultService(), [serviceProp]);
  const initialStateRef = useRef(initialState);
  initialStateRef.current = initialState;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReturnSummaryView | null>(null);
  const [hydrationKey, setHydrationKey] = useState("init");
  const [wizardState, setWizardState] = useState<ReturnWizardState>({
    ...EMPTY_RETURN_WIZARD_STATE,
    ...initialState,
  });

  const loadAll = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoadError("Sign in to return assets.");
      setLoading(false);
      return;
    }
    if (!assignmentIdProp && !assetId) {
      setLoadError("assignmentId or assetId is required to return an assignment.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      let assignment: AssignmentResponse | null = null;
      if (assignmentIdProp) {
        assignment = await service.loadAssignment(assignmentIdProp);
      } else if (assetId) {
        assignment = await service.findActiveAssignmentForAsset(assetId);
      }

      if (!assignment) {
        throw new Error("No active assignment found for this asset.");
      }
      if (assignment.status !== "active") {
        throw new Error("Only active assignments can be returned.");
      }

      const asset = await service.getAsset(assignment.asset_id);
      const employees = await listEmployees();
      const empLabel =
        employees.find((e) => e.id === assignment.employee_id)?.label ??
        (assignment.employee_id ? assignment.employee_id.slice(0, 8) : "Assigned");

      const issuedLines = service.listAssignmentComponents
        ? await service.listAssignmentComponents(assignment.id)
        : [];
      const componentReturns = issuedLines
        .filter((line) => line.issue_status === "ISSUED")
        .map((line) => ({
          componentId: line.component_id,
          label:
            [line.component_type, line.component_name || line.component_code]
              .filter(Boolean)
              .join(" · ") || line.component_id.slice(0, 8),
          serialNumber: line.serial_number?.trim() || "—",
          issueStatus: "RETURNED" as const,
          returnRemarks: "",
        }));

      setAssignmentId(assignment.id);
      setSummary(buildReturnSummary(assignment, asset, empLabel));
      setWizardState({
        ...EMPTY_RETURN_WIZARD_STATE,
        ...initialStateRef.current,
        componentReturns,
      });
      setHydrationKey(`return-${assignment.id}`);
    } catch (err) {
      setLoadError(service.formatError(err, "Failed to load return data."));
      setAssignmentId(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [assignmentIdProp, assetId, listEmployees, service]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleFinish = useCallback(
    async (state: ReturnWizardState) => {
      if (!assignmentId) return;
      setSubmitting(true);
      setActionError(null);
      try {
        const body = returnWizardStateToBody(state) as AssignmentReturnRequest;
        await service.returnAsset(assignmentId, body);
        onSuccessRef.current?.();
      } catch (err) {
        setActionError(service.formatError(err, "Return failed."));
      } finally {
        setSubmitting(false);
      }
    },
    [assignmentId, service],
  );

  if (loadError && !loading) {
    return (
      <WizardLoadErrorBanner
        message={loadError}
        onRetry={() => void loadAll()}
        retrying={loading}
      />
    );
  }

  return (
    <div className="space-y-3">
      {actionError ? (
        <WizardLoadErrorBanner message={actionError} onRetry={() => setActionError(null)} />
      ) : null}
      <ReturnWizard
        key={hydrationKey}
        loading={loading}
        saving={submitting}
        initialState={wizardState}
        summary={summary ?? undefined}
        onCancel={onCancel}
        onFinish={(state) => void handleFinish(state)}
      />
    </div>
  );
}
