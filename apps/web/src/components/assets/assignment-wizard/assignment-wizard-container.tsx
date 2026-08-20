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
  STANDARD_ISSUED_ACCESSORIES,
  wizardStateToCreateBody,
  wizardStateToUpdateBody,
  type WizardAssetOption,
  type WizardEmployeeOption,
  type WizardIssuedItemOption,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import { WizardLoadErrorBanner } from "@/components/assets/assignment-wizard/wizard-load-error-banner";
import {
  EMPTY_ASSIGNMENT_WIZARD_STATE,
  type AssignmentWizardState,
} from "@/components/assets/assignment-wizard/wizard-types";
import { isAuthenticated } from "@/lib/auth";
import { listEmployeeWizardOptions } from "@/lib/org-options";
import { listDemoReadyWizardAssets } from "@/components/assets/demo-registered-assets";
import {
  assignmentFrontendService,
  type AssignmentDraft,
  type AssignmentResponse,
} from "@/services/assignment-frontend-service";
import type { AssetsRow } from "@/services/assets-service";

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
  getAsset: (assetId: string) => Promise<AssetsRow>;
  listComponents: (assetId: string) => Promise<WizardIssuedItemOption[]>;
  formatError: (err: unknown, fallback: string) => string;
};

export type AssignmentWizardSuccessResult = {
  assignmentId: string;
  assetId: string;
  employeeId?: string;
  employeeLabel?: string;
};

export type AssignmentWizardContainerProps = {
  /** When set, loads an existing draft via loadDraft. */
  draftId?: string;
  /** Optional seed values (not from URL — parent-provided). */
  initialState?: Partial<AssignmentWizardState>;
  onCancel?: () => void;
  /** Called after successful submit (+ best-effort activate). */
  onSuccess?: (result: AssignmentWizardSuccessResult) => void;
  /** Defaults to assignmentFrontendService. */
  service?: AssignmentWizardContainerService;
  /** Override employee lookup (tests). */
  listEmployees?: () => Promise<WizardEmployeeOption[]>;
};

function bindDefaultService(): AssignmentWizardContainerService {
  return {
    createDraft: assignmentFrontendService.createDraft.bind(assignmentFrontendService),
    loadDraft: assignmentFrontendService.loadDraft.bind(assignmentFrontendService),
    updateDraft: assignmentFrontendService.updateDraft.bind(assignmentFrontendService),
    submitDraft: assignmentFrontendService.submitDraft.bind(assignmentFrontendService),
    activateAssignment: assignmentFrontendService.activateAssignment.bind(assignmentFrontendService),
    listReadyAssets: assignmentFrontendService.listReadyAssets.bind(assignmentFrontendService),
    getAsset: assignmentFrontendService.getAsset.bind(assignmentFrontendService),
    listComponents: assignmentFrontendService.listComponents.bind(assignmentFrontendService),
    formatError: assignmentFrontendService.formatError.bind(assignmentFrontendService),
  };
}

function assetRowToWizardOption(row: AssetsRow): WizardAssetOption {
  const configParts = [row.cpu, row.ram, row.storage, row.os]
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter(Boolean);
  return {
    id: String(row.id),
    label: String(row.asset_name ?? row.id),
    code: String(row.asset_code ?? "—"),
    operationalStatus: String(row.operational_status ?? "—"),
    branchLabel: String(row.branch_name ?? row.branch_id ?? "—"),
    branchId: String(row.branch_id ?? ""),
    serialNumber: String(row.serial_number ?? "—"),
    make: String(row.manufacturer ?? "—"),
    model: String(row.model ?? "—"),
    configuration: configParts.length
      ? configParts.join(" / ")
      : String(row.configuration ?? "—"),
    currentLocation: String(row.location ?? row.branch_name ?? row.branch_id ?? "—"),
    earlierUsedBy: String(row.earlier_used_by ?? row.previous_holder ?? "—"),
  };
}

export function AssignmentWizardContainer({
  draftId,
  initialState,
  onCancel,
  onSuccess,
  service: serviceProp,
  listEmployees = listEmployeeWizardOptions,
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
  const [employees, setEmployees] = useState<WizardEmployeeOption[]>([]);
  const [assets, setAssets] = useState<WizardAssetOption[]>([]);
  const [issuedItems, setIssuedItems] = useState<WizardIssuedItemOption[]>(STANDARD_ISSUED_ACCESSORIES);
  const [branchLabel, setBranchLabel] = useState("—");
  const prefilledAsset = Boolean(initialState?.assetId && !draftId);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const seed = initialStateRef.current;
      const demoReady = listDemoReadyWizardAssets();

      let emp: WizardEmployeeOption[] = [];
      let readyAssets: WizardAssetOption[] = [];

      if (isAuthenticated()) {
        const [employeeRows, apiReady] = await Promise.all([
          listEmployees(),
          service.listReadyAssets(),
        ]);
        emp = employeeRows;
        readyAssets = apiReady;
      } else {
        // Guest / demo: Issue Asset still works with Ready To Move demo stock.
        emp = [
          {
            id: "demo-emp-1",
            label: "Priya Sharma (EMP-1042) · IT",
            name: "Priya Sharma",
            employeeCode: "EMP-1042",
            department: "Information Technology",
            designation: "IT Admin",
            branch: "Head Office",
            employmentStatus: "active",
          },
        ];
      }

      // Issue wizard only lists Ready To Move — never Assigned.
      const byId = new Map<string, WizardAssetOption>();
      for (const asset of readyAssets) {
        if (String(asset.operationalStatus).toUpperCase() === "READY_TO_MOVE") {
          byId.set(asset.id, asset);
        }
      }
      for (const demo of demoReady) {
        if (!byId.has(demo.id)) byId.set(demo.id, demo);
      }
      let nextAssets = Array.from(byId.values());
      setEmployees(emp);
      setAssets(nextAssets);
      setIssuedItems(STANDARD_ISSUED_ACCESSORIES);
      if (nextAssets[0]?.branchLabel) {
        setBranchLabel(nextAssets[0].branchLabel);
      }

      let next: AssignmentWizardState = {
        ...EMPTY_ASSIGNMENT_WIZARD_STATE,
        ...seed,
      };

      if (draftId) {
        if (!isAuthenticated()) {
          throw new Error("Sign in to continue an existing draft.");
        }
        const row = await service.loadDraft(draftId);
        next = assignmentRowToWizardState(row, [], STANDARD_ISSUED_ACCESSORIES);
        const match = nextAssets.find((a) => a.id === row.asset_id);
        setBranchLabel(match?.branchLabel ?? (row.branch_id.slice(0, 8) || "—"));
        if (match) {
          nextAssets = nextAssets.some((a) => a.id === match.id) ? nextAssets : [...nextAssets, match];
          setAssets(nextAssets);
        }
        try {
          const components = await service.listComponents(row.asset_id);
          if (components.length > 0) setIssuedItems(components);
        } catch {
          /* keep STANDARD_ISSUED_ACCESSORIES */
        }
      } else if (next.assetId) {
        let match = nextAssets.find((a) => a.id === next.assetId);
        if (!match && isAuthenticated()) {
          const asset = await service.getAsset(next.assetId);
          match = assetRowToWizardOption(asset);
          nextAssets = [...nextAssets, match];
          setAssets(nextAssets);
        }
        if (!match) {
          throw new Error("Selected asset was not found in Ready To Move.");
        }
        if (match.operationalStatus !== "READY_TO_MOVE") {
          throw new Error("Selected asset is already assigned or not Ready To Move.");
        }
        next.branchId = match.branchId || next.branchId;
        setBranchLabel(match.branchLabel);
        if (isAuthenticated()) {
          try {
            const components = await service.listComponents(next.assetId);
            if (components.length > 0) setIssuedItems(components);
          } catch {
            /* keep STANDARD_ISSUED_ACCESSORIES */
          }
        }
      }

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
      const match = assets.find((a) => a.id === assetId);
      if (match) {
        setBranchLabel(match.branchLabel);
        setWizardState((prev) => ({
          ...prev,
          assetId,
          branchId: match.branchId || prev.branchId,
        }));
      }
      void (async () => {
        try {
          const components = await service.listComponents(assetId);
          setIssuedItems(components.length > 0 ? components : STANDARD_ISSUED_ACCESSORIES);
        } catch {
          setIssuedItems(STANDARD_ISSUED_ACCESSORIES);
        }
      })();
    },
    [assets, service],
  );

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

      setWizardState({
        ...state,
        draftId: row.id,
        version: row.version,
        branchId: state.branchId || row.branch_id,
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
        const employee = employees.find((item) => item.id === state.employeeId);
        onSuccessRef.current?.({
          assignmentId: row.id,
          assetId: state.assetId || row.asset_id,
          employeeId: state.employeeId || undefined,
          employeeLabel: employee?.name || employee?.label || undefined,
        });
      } catch (err) {
        setActionError(service.formatError(err, "Failed to submit assignment."));
      } finally {
        setSaving(false);
      }
    },
    [employees, persistDraft, service],
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
        finishLabel="Submit"
        onCancel={onCancel}
        prefilledAsset={prefilledAsset}
        onSaveDraft={(state) => void handleSaveDraft(state)}
        onFinish={(state) => void handleSubmitAndActivate(state)}
        onAssetChange={handleAssetChange}
      />
    </div>
  );
}
