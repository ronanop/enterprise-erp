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
import { PendingTransferErrorBanner } from "@/components/assets/pending-transfer-error-banner";
import { parsePendingTransferError } from "@/components/assets/pending-transfer-error";
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
  /** Load assignment in any status (used after submit/activate). */
  loadAssignment?: (id: string) => Promise<AssignmentResponse>;
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
  onSuccess?: (
    assignmentId: string,
    context?: {
      assetId?: string;
      dcChallanMode?: AssignmentWizardState["dcChallanMode"];
      dcChallanId?: string;
    },
  ) => void;
  /** Create DC now from Delivery step — open DC Challan workspace. */
  onCreateDcNow?: (state: AssignmentWizardState) => void;
  /** Defaults to assignmentFrontendService. */
  service?: AssignmentWizardContainerService;
  /** Override employee lookup (tests). */
  listEmployees?: () => Promise<{ id: string; label: string }[]>;
};

function bindDefaultService(): AssignmentWizardContainerService {
  return {
    createDraft: assignmentFrontendService.createDraft.bind(assignmentFrontendService),
    loadDraft: assignmentFrontendService.loadDraft.bind(assignmentFrontendService),
    loadAssignment: assignmentFrontendService.loadAssignment.bind(assignmentFrontendService),
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
  onCreateDcNow,
  service: serviceProp,
  listEmployees = listEmployeeOptions,
}: AssignmentWizardContainerProps) {
  const service = useMemo(() => serviceProp ?? bindDefaultService(), [serviceProp]);
  const initialStateRef = useRef(initialState);
  initialStateRef.current = initialState;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onCreateDcNowRef = useRef(onCreateDcNow);
  onCreateDcNowRef.current = onCreateDcNow;

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
      } else if (next.assetId) {
        const match = readyAssets.find((a) => a.id === next.assetId);
        if (match) {
          components = await service.listComponents(next.assetId);
          next.branchId = match.branchId || next.branchId;
          if (next.issuedItemIds.length === 0) {
            next.issuedItemIds = components.filter((i) => !i.disabled).map((i) => i.id);
          }
          setUnavailableAssetMessage(null);
        } else {
          // Deep-link to an asset that is no longer READY_TO_MOVE.
          setUnavailableAssetMessage(
            "This asset is no longer available for assignment. Choose another In Stock asset.",
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
          setWizardState((prev) => ({ ...prev, assetId: "", issuedItemIds: [] }));
          return;
        }
        try {
          const list = await service.listComponents(assetId);
          setIssuedItems(list);
          const match = assets.find((a) => a.id === assetId);
          // Pre-select available accessories (including CHARGER) so they follow the asset.
          const availableIds = list.filter((i) => !i.disabled).map((i) => i.id);
          if (match) {
            setWizardState((prev) => ({
              ...prev,
              assetId,
              branchId: match.branchId || prev.branchId,
              issuedItemIds: availableIds,
            }));
          } else {
            setWizardState((prev) => ({
              ...prev,
              assetId,
              issuedItemIds: availableIds,
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
    async (
      state: AssignmentWizardState,
    ): Promise<{ row: AssignmentResponse; dcChallanId: string }> => {
      const createBody = wizardStateToCreateBody(state, issuedItems) as AssignmentDraft;
      let row: AssignmentResponse;

      if (state.draftId) {
        try {
          row = await service.updateDraft(
            state.draftId,
            wizardStateToUpdateBody(state, issuedItems) as AssignmentDraft,
          );
        } catch (err) {
          const message = service.formatError(err, "");
          // Stale/cancelled draft id left in wizard state — start a fresh draft.
          if (/not found/i.test(message)) {
            row = await service.createDraft(createBody);
          } else {
            throw err;
          }
        }
      } else {
        row = await service.createDraft(createBody);
      }

      if (!row?.id) {
        throw new Error("Assignment draft was saved without an id. Reload and try again.");
      }

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
      return { row, dcChallanId };
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
        const { row, dcChallanId } = await persistDraft(state);
        const successContext = {
          assetId: state.assetId || row.asset_id,
          dcChallanMode: state.dcChallanMode,
          dcChallanId: dcChallanId || undefined,
        };
        let latest = await service.submitDraft(row.id);
        // Governance-off submit activates in one step. Governance-on may stay submitted
        // until another user approves — only then treat activate failure as soft success.
        if (latest.status !== "active") {
          try {
            latest = await service.activateAssignment(row.id);
          } catch (activateErr) {
            // Prefer current assignment status over loadDraft (post-submit is not a draft).
            try {
              latest = service.loadAssignment
                ? await service.loadAssignment(row.id)
                : await service.loadDraft(row.id);
            } catch {
              latest = row;
            }
            if (
              latest.status === "active" ||
              latest.status === "submitted" ||
              latest.status === "approved"
            ) {
              onSuccessRef.current?.(row.id, successContext);
              return;
            }
            setActionError(
              service.formatError(
                activateErr,
                "Assignment was submitted but not activated. Cancel or complete it before issuing again.",
              ),
            );
            return;
          }
        }
        onSuccessRef.current?.(row.id, successContext);
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
        parsePendingTransferError(actionError) ? (
          <PendingTransferErrorBanner
            message={actionError}
            onDismiss={() => setActionError(null)}
          />
        ) : (
          <WizardLoadErrorBanner message={actionError} onRetry={() => setActionError(null)} />
        )
      ) : null}
      <AssignmentWizard
        key={hydrationKey}
        loading={loading}
        saving={saving}
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
        onCreateDcNow={(state) => onCreateDcNowRef.current?.(state)}
        unlinkedDcChallans={unlinkedDcChallans}
      />
    </div>
  );
}
