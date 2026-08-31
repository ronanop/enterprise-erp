"use client";

/**
 * CR-004 Phase 5B-2B Task 2 — Assignment Wizard Container
 *
 * Owns load/save/submit/activate orchestration. Wizard stays presentational.
 * No router, no query params, no fetch() — AssignmentFrontendService only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AssignmentWizard } from "@/components/assets/assignment-wizard/assignment-wizard";
import {
  assignmentRowToWizardState,
  orgOptionsToWizard,
  wizardStateToCreateBody,
  wizardStateToUpdateBody,
  type WizardAssetOption,
  type WizardIssuedItemOption,
  type WizardSelectOption,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { WizardLoadErrorBanner } from "@/components/assets/assignment-wizard/wizard-load-error-banner";
import {
  EMPTY_ASSIGNMENT_WIZARD_STATE,
  type AssignmentWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";
import { isAuthenticated } from "@/lib/auth";
import { listEmployeeOptions } from "@/lib/org-options";
import { dcChallanService } from "@/services/assets-service";
import {
  assignmentFrontendService,
  type AssignmentDraft,
  type AssignmentResponse,
} from "@/services/assignment-frontend-service";

/** Injectable AssignmentFrontendService surface for tests. */
export type AssignmentWizardContainerService = {
  createDraft: (body: AssignmentDraft) => Promise<AssignmentResponse>;
  loadDraft: (id: string) => Promise<AssignmentResponse>;
  updateDraft: (id: string, body: AssignmentDraft) => Promise<AssignmentResponse>;
  submitDraft: (id: string) => Promise<AssignmentResponse>;
  activateAssignment: (id: string, comments?: string) => Promise<AssignmentResponse>;
  listReadyAssets: (params?: {
    branch_id?: string;
    page_size?: number;
  }) => Promise<WizardAssetOption[]>;
  listComponents: (assetId: string) => Promise<WizardIssuedItemOption[]>;
  listAssignmentComponents?: (
    assignmentId: string,
  ) => Promise<Array<{ component_id: string; issue_status: string }>>;
  formatError: (err: unknown, fallback: string) => string;
};

export type AssignmentWizardContainerProps = {
  /** When set, loads an existing draft via loadDraft. */
  draftId?: string;
  /** Optional seed values (not from URL — parent-provided). */
  initialState?: Partial<AssignmentWizardState>;
  onCancel?: () => void;
  /** Called after successful submit (+ best-effort activate). */
  onSuccess?: (assignmentId: string) => void;
  /** Defaults to assignmentFrontendService. */
  service?: AssignmentWizardContainerService;
  /** Override employee lookup (tests). */
  listEmployees?: () => Promise<{ id: string; label: string }[]>;
};

function bindDefaultService(): AssignmentWizardContainerService {
  return {
    createDraft: assignmentFrontendService.createDraft.bind(assignmentFrontendService),
    loadDraft: assignmentFrontendService.loadDraft.bind(assignmentFrontendService),
    updateDraft: assignmentFrontendService.updateDraft.bind(assignmentFrontendService),
    submitDraft: assignmentFrontendService.submitDraft.bind(assignmentFrontendService),
    activateAssignment: assignmentFrontendService.activateAssignment.bind(assignmentFrontendService),
    listReadyAssets: assignmentFrontendService.listReadyAssets.bind(assignmentFrontendService),
    listComponents: assignmentFrontendService.listComponents.bind(assignmentFrontendService),
    listAssignmentComponents:
      assignmentFrontendService.listAssignmentComponents.bind(assignmentFrontendService),
    formatError: assignmentFrontendService.formatError.bind(assignmentFrontendService),
  };
}

export function AssignmentWizardContainer({
  draftId,
  initialState,
  onCancel,
  onSuccess,
  service: serviceProp,
  listEmployees = listEmployeeOptions,
}: AssignmentWizardContainerProps) {
  const service = useMemo(() => serviceProp ?? bindDefaultService(), [serviceProp]);
  const initialStateRef = useRef(initialState);
  initialStateRef.current = initialState;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hydrationKey, setHydrationKey] = useState("init");
  const [wizardState, setWizardState] = useState<AssignmentWizardState>({
    ...EMPTY_ASSIGNMENT_WIZARD_STATE,
    ...initialState,
  });
  const [employees, setEmployees] = useState<WizardSelectOption[]>([]);
  const [assets, setAssets] = useState<WizardAssetOption[]>([]);
  const [issuedItems, setIssuedItems] = useState<WizardIssuedItemOption[]>([]);
  const [branchLabel, setBranchLabel] = useState("—");
  const [unavailableAssetMessage, setUnavailableAssetMessage] = useState<string | null>(null);
  const [unlinkedDcChallans, setUnlinkedDcChallans] = useState<
    Array<{ id: string; dcNumber: string; employeeName?: string | null }>
  >([]);

  const loadAll = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoadError("Sign in to issue assets.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const seed = initialStateRef.current;
      const [emp, readyAssets] = await Promise.all([listEmployees(), service.listReadyAssets()]);
      setEmployees(orgOptionsToWizard(emp));
      setAssets(readyAssets);

      let components: WizardIssuedItemOption[] = [];
      let next: AssignmentWizardState = {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        ...seed,
      };

      if (draftId) {
        const row = await service.loadDraft(draftId);
        components = await service.listComponents(row.asset_id);
        let issuedIds: string[] = [];
        if (service.listAssignmentComponents) {
          const lines = await service.listAssignmentComponents(row.id);
          issuedIds = lines
            .filter((l) => l.issue_status === "ISSUED")
            .map((l) => l.component_id);
        }
        next = assignmentRowToWizardState(
          { ...row, component_ids: issuedIds },
          issuedIds,
          components,
        );
        const match = readyAssets.find((a) => a.id === row.asset_id);
        setBranchLabel(match?.branchLabel ?? (row.branch_id.slice(0, 8) || "—"));
      } else if (next.assetId) {
        const match = readyAssets.find((a) => a.id === next.assetId);
        if (match) {
          components = await service.listComponents(next.assetId);
          next.branchId = match.branchId || next.branchId;
          setBranchLabel(match.branchLabel);
          setUnavailableAssetMessage(null);
        } else {
          // Deep-link to an asset that is no longer READY_TO_MOVE.
          setUnavailableAssetMessage(
            "This asset is no longer available for assignment. Choose another Ready to Move asset.",
          );
          next.assetId = "";
          next.branchId = "";
          components = [];
        }
      } else {
        setUnavailableAssetMessage(null);
      }

      setIssuedItems(components);
      setWizardState(next);
      setHydrationKey(draftId ? `draft-${draftId}` : `new-${next.assetId || "blank"}`);
    } catch (err) {
      setLoadError(service.formatError(err, "Failed to load wizard data."));
    } finally {
      setLoading(false);
    }
  }, [draftId, listEmployees, service]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleAssetChange = useCallback(
    (assetId: string) => {
      void (async () => {
        if (!assetId) {
          setIssuedItems([]);
          return;
        }
        try {
          const list = await service.listComponents(assetId);
          setIssuedItems(list);
          const match = assets.find((a) => a.id === assetId);
          if (match) {
            setBranchLabel(match.branchLabel);
            setWizardState((prev) => ({
              ...prev,
              assetId,
              branchId: match.branchId || prev.branchId,
            }));
          }
        } catch {
          setIssuedItems([]);
        }
      })();
    },
    [assets, service],
  );

  const refreshIssuedItems = useCallback(async () => {
    const assetId = wizardState.assetId;
    if (!assetId) {
      setIssuedItems([]);
      return;
    }
    try {
      setIssuedItems(await service.listComponents(assetId));
    } catch {
      /* keep existing list */
    }
  }, [service, wizardState.assetId]);

  useEffect(() => {
    const assetId = wizardState.assetId;
    if (!assetId || wizardState.allocationType !== "employee") {
      setUnlinkedDcChallans([]);
      return;
    }
    let cancelled = false;
    void dcChallanService
      .search({ asset_id: assetId, unlinked: true, page_size: 50, status: "PENDING" })
      .then((result) => {
        if (cancelled) return;
        setUnlinkedDcChallans(
          result.items.map((row) => ({
            id: row.id,
            dcNumber: row.dc_number,
            employeeName: row.employee_name,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setUnlinkedDcChallans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [wizardState.assetId, wizardState.allocationType]);

  const persistDraft = useCallback(
    async (state: AssignmentWizardState): Promise<AssignmentResponse> => {
      const body = (
        state.draftId
          ? wizardStateToUpdateBody(state, issuedItems)
          : wizardStateToCreateBody(state, issuedItems)
      ) as AssignmentDraft;

      const row = state.draftId
        ? await service.updateDraft(state.draftId, body)
        : await service.createDraft(body);

      let dcChallanId = state.dcChallanId;
      if (state.allocationType === "employee") {
        try {
          if (state.dcChallanMode === "create_now" && !dcChallanId && state.assetId) {
            const created = await dcChallanService.create({
              asset_id: state.assetId,
              assignment_id: row.id,
              employee_id: state.employeeId || undefined,
            });
            dcChallanId = created.id;
          } else if (state.dcChallanMode === "link_existing" && dcChallanId) {
            await dcChallanService.linkAssignment(dcChallanId, row.id);
          }
        } catch (dcErr) {
          setActionError(
            service.formatError(dcErr, "Assignment saved, but DC challan could not be created or linked."),
          );
        }
      }

      setWizardState({
        ...state,
        draftId: row.id,
        version: row.version,
        branchId: state.branchId || row.branch_id,
        dcChallanId,
      });
      return row;
    },
    [issuedItems, service],
  );

  const handleSaveDraft = useCallback(
    async (state: AssignmentWizardState) => {
      setSaving(true);
      setActionError(null);
      try {
        await persistDraft(state);
      } catch (err) {
        setActionError(service.formatError(err, "Failed to save assignment draft."));
      } finally {
        setSaving(false);
      }
    },
    [persistDraft, service],
  );

  const handleSubmitAndActivate = useCallback(
    async (state: AssignmentWizardState) => {
      setSaving(true);
      setActionError(null);
      try {
        const row = await persistDraft(state);
        await service.submitDraft(row.id);
        try {
          await service.activateAssignment(row.id);
        } catch {
          /* Multi-step workflow may leave status=submitted — still success for caller. */
        }
        onSuccessRef.current?.(row.id);
      } catch (err) {
        setActionError(service.formatError(err, "Failed to submit assignment."));
      } finally {
        setSaving(false);
      }
    },
    [persistDraft, service],
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
      <AssignmentWizard
        key={hydrationKey}
        loading={loading}
        saving={saving}
        branchLabel={branchLabel}
        initialState={wizardState}
        employees={employees}
        assets={assets}
        issuedItems={issuedItems}
        onRefreshIssuedItems={refreshIssuedItems}
        finishLabel="Submit"
        unavailableAssetMessage={unavailableAssetMessage}
        onClearUnavailableAsset={() => {
          setUnavailableAssetMessage(null);
          setWizardState((prev) => ({ ...prev, assetId: "", branchId: prev.branchId }));
          setIssuedItems([]);
        }}
        onCancel={onCancel}
        onSaveDraft={(state) => void handleSaveDraft(state)}
        onFinish={(state) => void handleSubmitAndActivate(state)}
        onAssetChange={handleAssetChange}
        unlinkedDcChallans={unlinkedDcChallans}
      />
    </div>
  );
}
