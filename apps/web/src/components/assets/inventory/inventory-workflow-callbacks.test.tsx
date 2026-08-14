/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssignmentWizardContainer } from "@/components/assets/assignment-wizard/assignment-wizard-container";
import { ReturnWizardContainer } from "@/components/assets/assignment-wizard/return-wizard-container";
import {
  clearInventoryStale,
  consumeInventoryStale,
  markInventoryStale,
  peekInventoryStale,
} from "@/components/assets/inventory/inventory-refresh";
import {
  inventoryPathAfterWorkflow,
  wizardInitialStateFromAssetId,
} from "@/components/assets/inventory/inventory-workflow";
import type { AssignmentResponse } from "@/services/assignment-frontend-service";

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn(() => true),
}));

const createDraft = vi.fn();
const loadDraft = vi.fn();
const updateDraft = vi.fn();
const submitDraft = vi.fn();
const activateAssignment = vi.fn();
const listReadyAssets = vi.fn();
const listComponents = vi.fn();
const formatError = vi.fn((err: unknown, fb: string) => (err instanceof Error ? err.message : fb));

const loadAssignment = vi.fn();
const findActiveAssignmentForAsset = vi.fn();
const getAsset = vi.fn();
const returnAsset = vi.fn();

const issueService = {
  createDraft,
  loadDraft,
  updateDraft,
  submitDraft,
  activateAssignment,
  listReadyAssets,
  listComponents,
  formatError,
};

const returnService = {
  loadAssignment,
  findActiveAssignmentForAsset,
  getAsset,
  returnAsset,
  formatError,
};

const listEmployees = vi.fn(() => Promise.resolve([{ id: "e1", label: "Emp One" }]));

const draftRow: AssignmentResponse = {
  id: "d1",
  document_number: "ASN-1",
  asset_id: "a1",
  allocation_type: "employee",
  employee_id: "e1",
  status: "draft",
  delivery_reference_status: "pending",
  branch_id: "b1",
  version: 1,
};

const activeRow: AssignmentResponse = {
  ...draftRow,
  id: "asg-1",
  status: "active",
  allocated_at: "2026-01-01T00:00:00Z",
  delivery_reference_status: "received",
};

beforeEach(() => {
  vi.clearAllMocks();
  clearInventoryStale();
  listReadyAssets.mockResolvedValue([
    {
      id: "a1",
      label: "Laptop",
      code: "AST-1",
      operationalStatus: "READY_TO_MOVE",
      branchLabel: "HQ",
      branchId: "b1",
    },
  ]);
  listComponents.mockResolvedValue([]);
  createDraft.mockResolvedValue({ ...draftRow, id: "new-1" });
  submitDraft.mockResolvedValue({ ...draftRow, id: "new-1", status: "submitted" });
  activateAssignment.mockResolvedValue({ ...draftRow, id: "new-1", status: "active" });
  findActiveAssignmentForAsset.mockResolvedValue(activeRow);
  loadAssignment.mockResolvedValue(activeRow);
  getAsset.mockResolvedValue({
    asset_code: "AST-1",
    asset_name: "Laptop",
    serial_number: "SN",
    operational_status: "ASSIGNED",
  });
  returnAsset.mockResolvedValue({ ...activeRow, status: "returned" });
});

describe("Container callbacks — Issue success path", () => {
  it("prefills asset from inventory seed", async () => {
    render(
      <AssignmentWizardContainer
        initialState={wizardInitialStateFromAssetId("a1")}
        service={issueService}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(listComponents).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(screen.getByRole("heading", { name: /Issue asset/i })).toBeInTheDocument());
  });

  it("calls onSuccess after submit+activate", async () => {
    const onSuccess = vi.fn((id: string) => {
      markInventoryStale({ reason: "issue", assetId: "a1" });
      expect(id).toBe("new-1");
    });
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={issueService}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitFor(() => screen.getByRole("button", { name: /Save draft/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Submit$/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("new-1"));
    expect(peekInventoryStale()).toBe(true);
    expect(consumeInventoryStale()?.reason).toBe("issue");
  });

  it("does not mark inventory stale on create failure", async () => {
    createDraft.mockRejectedValue(new Error("fail"));
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={issueService}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitFor(() => screen.getByRole("button", { name: /Save draft/i }));
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onSuccess).not.toHaveBeenCalled();
    expect(peekInventoryStale()).toBe(false);
  });

  it("retries load after failure", async () => {
    listReadyAssets.mockRejectedValueOnce(new Error("net")).mockResolvedValue([
      {
        id: "a1",
        label: "Laptop",
        code: "AST-1",
        operationalStatus: "READY_TO_MOVE",
        branchLabel: "HQ",
        branchId: "b1",
      },
    ]);
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={wizardInitialStateFromAssetId("a1")}
        service={issueService}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /Issue asset/i })).toBeInTheDocument());
  });
});

describe("Container callbacks — Return success path", () => {
  it("loads return flow from inventory assetId", async () => {
    render(
      <ReturnWizardContainer assetId="a1" service={returnService} listEmployees={listEmployees} />,
    );
    await waitFor(() => expect(findActiveAssignmentForAsset).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(screen.getByText(/ASN-1/i)).toBeInTheDocument());
  });

  it("marks inventory stale on return success", async () => {
    const onSuccess = vi.fn(() => {
      markInventoryStale({ reason: "return", assetId: "a1" });
    });
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer
        assetId="a1"
        service={returnService}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitFor(() => screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(consumeInventoryStale()?.reason).toBe("return");
  });

  it("does not mark stale when return fails", async () => {
    returnAsset.mockRejectedValue(new Error("blocked"));
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer
        assetId="a1"
        service={returnService}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitFor(() => screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/blocked/i));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(peekInventoryStale()).toBe(false);
  });
});

describe("Page host helpers", () => {
  it("inventory path used after workflow", () => {
    expect(inventoryPathAfterWorkflow()).toBe("/assets/assets");
  });

  it("maps assetId into initial state for issue page", () => {
    expect(wizardInitialStateFromAssetId("asset-99")).toEqual({ assetId: "asset-99" });
  });
});
