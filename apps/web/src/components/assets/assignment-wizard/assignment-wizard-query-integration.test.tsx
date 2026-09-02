/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssignmentWizardContainer } from "@/components/assets/assignment-wizard/assignment-wizard-container";
import { ReturnWizardContainer } from "@/components/assets/assignment-wizard/return-wizard-container";
import {
  assignmentPropsFromSearchParams,
  returnPropsFromSearchParams,
} from "@/components/assets/assignment-wizard/assignment-wizard-page-props";
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
  assignment_remarks: "",
  branch_id: "b1",
  version: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
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
  loadDraft.mockResolvedValue(draftRow);
  findActiveAssignmentForAsset.mockResolvedValue({ ...draftRow, id: "asg-1", status: "active" });
  loadAssignment.mockResolvedValue({ ...draftRow, id: "asg-1", status: "active" });
  getAsset.mockResolvedValue({
    asset_code: "AST-1",
    asset_name: "Laptop",
    serial_number: "SN",
    operational_status: "ASSIGNED",
  });
});

describe("draft resume via query → props", () => {
  it("loads draft when draftId mapped from query", async () => {
    const mapped = assignmentPropsFromSearchParams(new URLSearchParams("draftId=d1"));
    render(
      <AssignmentWizardContainer
        draftId={mapped.draftId}
        initialState={mapped.initialState}
        service={issueService}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(loadDraft).toHaveBeenCalledWith("d1"));
    await waitFor(() => expect(screen.getByRole("heading", { name: /Issue asset/i })).toBeInTheDocument());
  });

  it("prefills assetId from query without draft", async () => {
    const mapped = assignmentPropsFromSearchParams(new URLSearchParams("assetId=a1"));
    render(
      <AssignmentWizardContainer
        draftId={mapped.draftId}
        initialState={mapped.initialState}
        service={issueService}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(listComponents).toHaveBeenCalledWith("a1"));
    expect(loadDraft).not.toHaveBeenCalled();
  });

  it("prefills employeeId from query", async () => {
    const mapped = assignmentPropsFromSearchParams(
      new URLSearchParams("assetId=a1&employeeId=e1"),
    );
    expect(mapped.initialState).toEqual({ assetId: "a1", employeeId: "e1" });
    render(
      <AssignmentWizardContainer
        initialState={mapped.initialState}
        service={issueService}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: /Issue asset/i })).toBeInTheDocument());
  });
});

describe("return deep link via query → props", () => {
  it("uses assetId for active assignment lookup", async () => {
    const mapped = returnPropsFromSearchParams(
      new URLSearchParams("assetId=a1&intent=return"),
    );
    render(
      <ReturnWizardContainer
        assetId={mapped.assetId}
        assignmentId={mapped.assignmentId}
        service={returnService}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(findActiveAssignmentForAsset).toHaveBeenCalledWith("a1"));
    expect(loadAssignment).not.toHaveBeenCalled();
  });

  it("uses assignmentId for direct load", async () => {
    const mapped = returnPropsFromSearchParams(
      new URLSearchParams("assignmentId=asg-1&intent=return"),
    );
    render(
      <ReturnWizardContainer
        assetId={mapped.assetId}
        assignmentId={mapped.assignmentId}
        service={returnService}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(loadAssignment).toHaveBeenCalledWith("asg-1"));
    expect(findActiveAssignmentForAsset).not.toHaveBeenCalled();
  });
});
