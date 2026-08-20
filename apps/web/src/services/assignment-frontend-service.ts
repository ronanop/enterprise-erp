/**
 * CR-004 Phase 5B-2B Task 1 — Assignment Frontend Service
 *
 * Single source of truth for Assignment REST communication.
 * Pure API wrapper: no UI, hooks, routing, or state.
 */

import { ApiClientError, resourceService } from "@/services/api-client";
import { assetOperationsService, type AssetsRow } from "@/services/assets-service";
import type {
  AssignmentApiRow,
  WizardAssetOption,
  WizardIssuedItemOption,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";
import type { AssignmentWizardState } from "@/components/assets/assignment-wizard/wizard-types";
import {
  wizardStateToCreateBody,
  wizardStateToUpdateBody,
} from "@/components/assets/assignment-wizard/assignment-wizard-mapper";

const API_ASSIGNMENTS = "/assets/asset-assignments";
const API_ASSETS = "/assets/assets";
const API_COMPONENTS = "/assets/asset-components";

// ---------------------------------------------------------------------------
// Types (aligned with backend AssetAssignment* DTOs)
// ---------------------------------------------------------------------------

/** Create / update draft payload (maps to AssetAssignmentCreate / Update). */
export type AssignmentDraft = {
  asset_id?: string;
  branch_id?: string;
  allocation_type?: string;
  employee_id?: string | null;
  department_id?: string | null;
  project_id?: string | null;
  expected_return_at?: string | null;
  delivery_reference_number?: string | null;
  delivery_reference_status?: string | null;
  assignment_remarks?: string | null;
  /** Required on update (optimistic concurrency). */
  version?: number;
};

/** Assignment row from API (maps to AssetAssignmentResponse). */
export type AssignmentResponse = {
  id: string;
  document_number: string;
  asset_id: string;
  allocation_type: string;
  employee_id?: string | null;
  department_id?: string | null;
  project_id?: string | null;
  allocated_at?: string | null;
  expected_return_at?: string | null;
  returned_at?: string | null;
  status: string;
  delivery_reference_number?: string | null;
  delivery_reference_status: string;
  assignment_remarks?: string | null;
  return_remarks?: string | null;
  workflow_status?: string | null;
  workflow_instance_id?: string | null;
  company_id?: string;
  branch_id: string;
  version: number;
  created_by?: string | null;
};

/** Return action body (maps to AssetAssignmentReturnRequest). */
export type AssignmentReturnRequest = {
  return_condition: string;
  reason?: string | null;
  return_remarks?: string | null;
};

/** Normalized assignment API failure. */
export class AssignmentError extends Error {
  readonly status: number;
  readonly errors: string[];

  constructor(message: string, status = 0, errors: string[] = []) {
    super(message);
    this.name = "AssignmentError";
    this.status = status;
    this.errors = errors;
  }
}

export type Paginated<T> = { items: T[]; total: number; page: number; page_size: number };

function parsePaginated<T>(data: unknown): Paginated<T> {
  if (data && typeof data === "object" && "items" in data) {
    const p = data as Paginated<T>;
    return {
      items: Array.isArray(p.items) ? p.items : [],
      total: p.total ?? 0,
      page: p.page ?? 1,
      page_size: p.page_size ?? 10,
    };
  }
  if (Array.isArray(data)) {
    return { items: data as T[], total: data.length, page: 1, page_size: data.length };
  }
  return { items: [], total: 0, page: 1, page_size: 10 };
}

function unwrapAssignment(data: unknown): AssignmentResponse {
  return data as AssignmentResponse;
}

/** Map any thrown value into AssignmentError (consistent surface for callers). */
export function toAssignmentError(err: unknown, fallback = "Assignment request failed."): AssignmentError {
  if (err instanceof AssignmentError) return err;
  if (err instanceof ApiClientError) {
    return new AssignmentError(err.message, err.status, err.errors);
  }
  if (err instanceof Error && err.message) {
    return new AssignmentError(err.message, 0);
  }
  return new AssignmentError(fallback, 0);
}

async function withAssignmentErrors<T>(fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toAssignmentError(err, fallback);
  }
}

// ---------------------------------------------------------------------------
// Core API methods (Task 1 SSOT)
// ---------------------------------------------------------------------------

export const assignmentFrontendService = {
  /**
   * POST /assets/asset-assignments — create draft assignment.
   */
  async createDraft(body: AssignmentDraft): Promise<AssignmentResponse> {
    return withAssignmentErrors(async () => {
      const res = await resourceService.create<AssignmentResponse>(API_ASSIGNMENTS, body);
      return unwrapAssignment(res.data);
    }, "Failed to create assignment draft.");
  },

  /**
   * GET /assets/asset-assignments/{id} — load any assignment.
   */
  async loadAssignment(id: string): Promise<AssignmentResponse> {
    return withAssignmentErrors(async () => {
      const res = await resourceService.get<AssignmentResponse>(API_ASSIGNMENTS, id);
      return unwrapAssignment(res.data);
    }, "Failed to load assignment.");
  },

  /**
   * GET assignment and ensure status is draft.
   */
  async loadDraft(id: string): Promise<AssignmentResponse> {
    return withAssignmentErrors(async () => {
      const row = await assignmentFrontendService.loadAssignment(id);
      if (row.status !== "draft") {
        throw new AssignmentError(
          `Assignment ${id} is not a draft (status=${row.status}).`,
          409,
        );
      }
      return row;
    }, "Failed to load assignment draft.");
  },

  /**
   * PATCH /assets/asset-assignments/{id} — update draft fields.
   */
  async updateDraft(id: string, body: AssignmentDraft): Promise<AssignmentResponse> {
    return withAssignmentErrors(async () => {
      const res = await resourceService.update<AssignmentResponse>(API_ASSIGNMENTS, id, body);
      return unwrapAssignment(res.data);
    }, "Failed to update assignment draft.");
  },

  /**
   * POST /assets/asset-assignments/{id}/submit
   */
  async submitDraft(id: string): Promise<AssignmentResponse> {
    return withAssignmentErrors(async () => {
      const res = await resourceService.action<AssignmentResponse>(API_ASSIGNMENTS, id, "submit");
      return unwrapAssignment(res.data);
    }, "Failed to submit assignment draft.");
  },

  /**
   * POST /assets/asset-assignments/{id}/approve — activate / advance workflow.
   */
  async activateAssignment(id: string, comments?: string): Promise<AssignmentResponse> {
    return withAssignmentErrors(async () => {
      const res = await resourceService.action<AssignmentResponse>(API_ASSIGNMENTS, id, "approve", {
        comments: comments ?? undefined,
      });
      return unwrapAssignment(res.data);
    }, "Failed to activate assignment.");
  },

  /**
   * POST /assets/asset-assignments/{id}/return
   */
  async returnAsset(id: string, body: AssignmentReturnRequest): Promise<AssignmentResponse> {
    return withAssignmentErrors(async () => {
      const res = await resourceService.action<AssignmentResponse>(API_ASSIGNMENTS, id, "return", body);
      return unwrapAssignment(res.data);
    }, "Failed to return assignment.");
  },

  /**
   * GET /assets/asset-assignments — paginated list (existing search API).
   */
  async list(params: {
    page?: number;
    page_size?: number;
    status?: string;
    q?: string;
    branch_id?: string;
    asset_id?: string;
    allocation_type?: string;
  } = {}): Promise<Paginated<AssignmentResponse>> {
    return withAssignmentErrors(async () => {
      const res = await resourceService.list<Paginated<AssignmentResponse>>(API_ASSIGNMENTS, params);
      return parsePaginated<AssignmentResponse>(res.data);
    }, "Failed to list assignments.");
  },

  /**
   * Soft-delete draft via POST …/cancel. Active assignments cannot be cancelled this way for CRUD delete.
   */
  async cancelDraft(id: string): Promise<AssignmentResponse> {
    return withAssignmentErrors(async () => {
      const row = await assignmentFrontendService.loadAssignment(id);
      if (row.status !== "draft") {
        throw new AssignmentError(
          "Only draft assignments can be deleted. Active assignments cannot be deleted.",
          409,
        );
      }
      const res = await resourceService.action<AssignmentResponse>(API_ASSIGNMENTS, id, "cancel");
      return unwrapAssignment(res.data);
    }, "Failed to delete assignment draft.");
  },

  // --- Compatibility aliases (same endpoints; used by later integration layers) ---

  getAssignment(id: string): Promise<AssignmentResponse> {
    return this.loadAssignment(id);
  },

  submit(id: string): Promise<AssignmentResponse> {
    return this.submitDraft(id);
  },

  approve(id: string, comments?: string): Promise<AssignmentResponse> {
    return this.activateAssignment(id, comments);
  },

  returnAssignment(id: string, body: AssignmentReturnRequest | Record<string, unknown>): Promise<AssignmentResponse> {
    return this.returnAsset(id, body as AssignmentReturnRequest);
  },

  async listReadyAssets(params: { branch_id?: string; page_size?: number } = {}): Promise<WizardAssetOption[]> {
    return withAssignmentErrors(async () => {
      const list = await assetOperationsService.listAssets({
        operational_status: "READY_TO_MOVE",
        status: "active",
        page: 1,
        page_size: params.page_size ?? 100,
        branch_id: params.branch_id,
      });
      return (list.items ?? []).map(assetRowToWizardAsset);
    }, "Failed to list ready assets.");
  },

  async getAsset(assetId: string): Promise<AssetsRow> {
    return withAssignmentErrors(async () => {
      const res = await resourceService.get<AssetsRow>(API_ASSETS, assetId);
      return res.data as AssetsRow;
    }, "Failed to load asset.");
  },

  async listComponents(assetId: string): Promise<WizardIssuedItemOption[]> {
    return withAssignmentErrors(async () => {
      type ComponentRow = {
        id: string;
        component_code?: string;
        description?: string;
        current_status?: string;
      };
      const res = await resourceService.list<Paginated<ComponentRow>>(API_COMPONENTS, {
        asset_id: assetId,
        page: 1,
        page_size: 100,
      });
      const page = parsePaginated<ComponentRow>(res.data);
      return page.items.map((row) => ({
        id: row.id,
        label: row.description?.trim() || row.component_code || row.id.slice(0, 8),
        status: row.current_status ?? "unknown",
      }));
    }, "Failed to list asset components.");
  },

  async findActiveAssignmentForAsset(assetId: string): Promise<AssignmentResponse | null> {
    return withAssignmentErrors(async () => {
      const res = await resourceService.list<Paginated<AssignmentResponse>>(API_ASSIGNMENTS, {
        asset_id: assetId,
        status: "active",
        page: 1,
        page_size: 1,
      });
      const page = parsePaginated<AssignmentResponse>(res.data);
      return page.items[0] ?? null;
    }, "Failed to find active assignment.");
  },

  formatError(err: unknown, fallback: string): string {
    return toAssignmentError(err, fallback).message;
  },
};

function assetRowToWizardAsset(row: AssetsRow): WizardAssetOption {
  const code = String(row.asset_code ?? "");
  const name = String(row.asset_name ?? row.id);
  const configParts = [row.cpu, row.ram, row.storage, row.os]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter(Boolean);
  return {
    id: String(row.id),
    label: name,
    code,
    operationalStatus: String(row.operational_status ?? "READY_TO_MOVE"),
    branchLabel: String(row.branch_name ?? row.branch_id ?? "").slice(0, 48) || "—",
    branchId: String(row.branch_id ?? ""),
    serialNumber: String(row.serial_number ?? "—"),
    make: String(row.manufacturer ?? "—"),
    model: String(row.model ?? "—"),
    configuration: configParts.length ? configParts.join(" / ") : String(row.configuration ?? "—"),
    currentLocation: String(row.location ?? row.branch_name ?? row.branch_id ?? "—"),
    earlierUsedBy: String(row.earlier_used_by ?? row.previous_holder ?? "—"),
  };
}

// ---------------------------------------------------------------------------
// Optional composition helpers (not Task 1 core; used by containers)
// ---------------------------------------------------------------------------

export type AssignmentFrontendDeps = {
  getAssignment?: (id: string) => Promise<AssignmentResponse | AssignmentApiRow>;
  createDraft?: (body: AssignmentDraft | Record<string, unknown>) => Promise<AssignmentResponse | AssignmentApiRow>;
  updateDraft?: (
    id: string,
    body: AssignmentDraft | Record<string, unknown>,
  ) => Promise<AssignmentResponse | AssignmentApiRow>;
  submit?: (id: string) => Promise<AssignmentResponse | AssignmentApiRow>;
  approve?: (id: string, comments?: string) => Promise<AssignmentResponse | AssignmentApiRow>;
  returnAssignment?: (
    id: string,
    body: AssignmentReturnRequest | Record<string, unknown>,
  ) => Promise<AssignmentResponse | AssignmentApiRow>;
  listReadyAssets?: (params?: { branch_id?: string; page_size?: number }) => Promise<WizardAssetOption[]>;
  getAsset?: (assetId: string) => Promise<AssetsRow>;
  listComponents?: (assetId: string) => Promise<WizardIssuedItemOption[]>;
  findActiveAssignmentForAsset?: (assetId: string) => Promise<AssignmentResponse | AssignmentApiRow | null>;
};

export async function saveAssignmentDraft(
  state: AssignmentWizardState,
  issuedItems: WizardIssuedItemOption[],
  deps: AssignmentFrontendDeps = {},
): Promise<AssignmentResponse | AssignmentApiRow> {
  const create = deps.createDraft ?? assignmentFrontendService.createDraft.bind(assignmentFrontendService);
  const update = deps.updateDraft ?? assignmentFrontendService.updateDraft.bind(assignmentFrontendService);
  if (state.draftId) {
    return update(state.draftId, wizardStateToUpdateBody(state, issuedItems));
  }
  return create(wizardStateToCreateBody(state, issuedItems));
}

export async function submitAndTryActivate(
  assignmentId: string,
  deps: AssignmentFrontendDeps = {},
): Promise<AssignmentResponse | AssignmentApiRow> {
  const submit = deps.submit ?? assignmentFrontendService.submitDraft.bind(assignmentFrontendService);
  const approve =
    deps.approve ?? assignmentFrontendService.activateAssignment.bind(assignmentFrontendService);
  let row = await submit(assignmentId);
  if (row.status === "submitted" || row.status === "approved") {
    try {
      row = await approve(assignmentId);
    } catch {
      /* multi-step workflow may require additional approvals */
    }
  }
  return row;
}
