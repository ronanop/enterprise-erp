/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AssignmentWizardContainer,
  type AssignmentWizardContainerService,
} from "@/components/assets/assignment-wizard/assignment-wizard-container";
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
const getAsset = vi.fn();
const listComponents = vi.fn();
const formatError = vi.fn((err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback,
);

const service: AssignmentWizardContainerService = {
  createDraft,
  loadDraft,
  updateDraft,
  submitDraft,
  activateAssignment,
  listReadyAssets,
  getAsset,
  listComponents,
  formatError,
};

const listEmployees = vi.fn(() =>
  Promise.resolve([{ id: "e1", label: "Emp One", name: "Emp One", employeeCode: "E1" }]),
);

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
  version: 1,
};

function readyAssets() {
  return [
    {
      id: "a1",
      label: "Laptop",
      code: "AST-1",
      operationalStatus: "READY_TO_MOVE",
      branchLabel: "HQ",
      branchId: "b1",
    },
  ];
}

async function waitForWizard() {
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Issue asset/i })).toBeInTheDocument();
  });
}

/** Advance from employee → asset → issued → delivery → review with seeded state. */
async function goToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /^Submit$/i })).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  listReadyAssets.mockResolvedValue(readyAssets());
  listComponents.mockResolvedValue([]);
  getAsset.mockResolvedValue({
    id: "a1",
    asset_code: "AST-1",
    asset_name: "Laptop",
    operational_status: "READY_TO_MOVE",
    branch_id: "b1",
    branch_name: "HQ",
    serial_number: "SN-1",
    manufacturer: "Lenovo",
    model: "T14",
  });
  listEmployees.mockResolvedValue([{ id: "e1", label: "Emp One", name: "Emp One", employeeCode: "E1" }]);
  createDraft.mockResolvedValue({ ...draftRow, id: "new-1", version: 1 });
  updateDraft.mockResolvedValue({ ...draftRow, version: 2 });
  loadDraft.mockResolvedValue(draftRow);
  submitDraft.mockResolvedValue({ ...draftRow, status: "submitted" });
  activateAssignment.mockResolvedValue({ ...draftRow, status: "active" });
  formatError.mockImplementation((err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
  );
});

describe("AssignmentWizardContainer — loading", () => {
  it("shows wizard after lookups load", async () => {
    render(
      <AssignmentWizardContainer service={service} listEmployees={listEmployees} onCancel={vi.fn()} />,
    );
    await waitForWizard();
    expect(listReadyAssets).toHaveBeenCalled();
    expect(listEmployees).toHaveBeenCalled();
  });

  it("passes loading state while fetching", async () => {
    let resolveReady!: (v: unknown) => void;
    listReadyAssets.mockReturnValue(
      new Promise((resolve) => {
        resolveReady = resolve;
      }),
    );
    render(
      <AssignmentWizardContainer service={service} listEmployees={listEmployees} />,
    );
    expect(screen.getByRole("heading", { name: /Issue asset/i })).toBeInTheDocument();
    resolveReady(readyAssets());
    await waitForWizard();
  });

  it("loads draft via loadDraft when draftId set", async () => {
    render(
      <AssignmentWizardContainer
        draftId="d1"
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(loadDraft).toHaveBeenCalledWith("d1"));
    await waitForWizard();
  });

  it("shows standard issued accessories catalog", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ assetId: "a1", employeeId: "e1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    expect(screen.getByTestId("issued-items-section")).toBeInTheDocument();
    expect(screen.getByText("Charger")).toBeInTheDocument();
    expect(screen.getByText("Laptop Bag")).toBeInTheDocument();
  });

  it("shows read-only asset information first when assetId is prefilled", async () => {
    render(
      <AssignmentWizardContainer
        initialState={{ assetId: "a1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    expect(screen.getByTestId("asset-information-section")).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: /Select asset/i })).not.toBeInTheDocument();
    expect(screen.getByText(/prefilled from the register drawer/i)).toBeInTheDocument();
    expect(screen.getByText("AST-1")).toBeInTheDocument();
    expect(screen.getByText("READY_TO_MOVE")).toBeInTheDocument();
  });

  it("loads asset by id when prefilled asset is not in ready list", async () => {
    listReadyAssets.mockResolvedValueOnce([]);
    render(
      <AssignmentWizardContainer
        initialState={{ assetId: "a1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(getAsset).toHaveBeenCalledWith("a1"));
    await waitForWizard();
  });

  it("shows load error when prefilled asset id is invalid", async () => {
    listReadyAssets.mockResolvedValueOnce([]);
    getAsset.mockRejectedValueOnce(new Error("Asset not found"));
    render(
      <AssignmentWizardContainer
        initialState={{ assetId: "missing-asset" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Asset not found/i);
    });
  });

  it("shows business validation when prefilled asset is already assigned", async () => {
    listReadyAssets.mockResolvedValueOnce([]);
    getAsset.mockResolvedValueOnce({
      id: "a2",
      asset_code: "AST-2",
      asset_name: "Busy Laptop",
      operational_status: "ASSIGNED",
      branch_id: "b1",
      branch_name: "HQ",
    });
    render(
      <AssignmentWizardContainer
        initialState={{ assetId: "a2" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/already assigned|not Ready To Move/i);
    });
  });

  it("shows load error when listReadyAssets fails", async () => {
    listReadyAssets.mockRejectedValue(new Error("network down"));
    render(
      <AssignmentWizardContainer service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/network down/i);
    });
  });

  it("shows load error when loadDraft fails", async () => {
    loadDraft.mockRejectedValue(new Error("draft missing"));
    render(
      <AssignmentWizardContainer draftId="missing" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/draft missing/i);
    });
  });

  it("loads demo ready assets when not signed in", async () => {
    const { isAuthenticated } = await import("@/lib/auth");
    vi.mocked(isAuthenticated).mockReturnValueOnce(false);
    render(
      <AssignmentWizardContainer service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(listReadyAssets).not.toHaveBeenCalled();
  });

  it("retries load after failure", async () => {
    listReadyAssets.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(readyAssets());
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    await waitForWizard();
    expect(listReadyAssets).toHaveBeenCalledTimes(2);
  });

  it("formats unknown load errors via formatError fallback", async () => {
    listReadyAssets.mockRejectedValue("raw");
    formatError.mockReturnValue("Failed to load wizard data.");
    render(
      <AssignmentWizardContainer service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Failed to load wizard data/i);
    });
  });
});

describe("AssignmentWizardContainer — draft create", () => {
  it("calls createDraft on Save draft", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(createDraft).toHaveBeenCalled());
    expect(createDraft.mock.calls[0]?.[0]).toMatchObject({
      asset_id: "a1",
      employee_id: "e1",
    });
  });

  it("does not call onSuccess after save draft only", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(createDraft).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows action error when createDraft fails", async () => {
    createDraft.mockRejectedValue(new Error("create failed"));
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/create failed/i);
    });
  });
});

describe("AssignmentWizardContainer — draft update", () => {
  it("calls updateDraft when draft already loaded", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        draftId="d1"
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(updateDraft).toHaveBeenCalled());
    expect(updateDraft.mock.calls[0]?.[0]).toBe("d1");
    expect(updateDraft.mock.calls[0]?.[1]).toMatchObject({ version: 1 });
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("shows error when updateDraft fails", async () => {
    updateDraft.mockRejectedValue(new Error("version conflict"));
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer draftId="d1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/version conflict/i);
    });
  });

  it("second save after create uses updateDraft", async () => {
    const user = userEvent.setup();
    createDraft.mockResolvedValue({ ...draftRow, id: "created", version: 1 });
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(createDraft).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(updateDraft).toHaveBeenCalled());
    expect(updateDraft.mock.calls[0]?.[0]).toBe("created");
  });
});

describe("AssignmentWizardContainer — submit and activate", () => {
  it("create → submit → activate on Submit", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitForWizard();
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: /^Submit$/i }));
    await waitFor(() => expect(createDraft).toHaveBeenCalled());
    await waitFor(() => expect(submitDraft).toHaveBeenCalledWith("new-1"));
    await waitFor(() => expect(activateAssignment).toHaveBeenCalledWith("new-1"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: "new-1", assetId: "a1", employeeId: "e1" }),
    ));
  });

  it("update → submit → activate for existing draft", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        draftId="d1"
        service={service}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitForWizard();
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: /^Submit$/i }));
    await waitFor(() => expect(updateDraft).toHaveBeenCalled());
    await waitFor(() => expect(submitDraft).toHaveBeenCalledWith("d1"));
    await waitFor(() => expect(activateAssignment).toHaveBeenCalledWith("d1"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: "d1", assetId: "a1" }),
    ));
  });

  it("still succeeds when activateAssignment fails", async () => {
    activateAssignment.mockRejectedValue(new Error("needs more approvers"));
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitForWizard();
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: /^Submit$/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ assignmentId: "new-1", assetId: "a1", employeeId: "e1" }),
    ));
  });

  it("includes employee label in onSuccess payload", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitForWizard();
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: /^Submit$/i }));
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentId: "new-1",
          assetId: "a1",
          employeeId: "e1",
          employeeLabel: "Emp One",
        }),
      ),
    );
  });

  it("shows error and skips activate when submitDraft fails", async () => {
    submitDraft.mockRejectedValue(new Error("cannot submit"));
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitForWizard();
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: /^Submit$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/cannot submit/i);
    });
    expect(activateAssignment).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows error when persist fails during submit", async () => {
    createDraft.mockRejectedValue(new Error("persist failed"));
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitForWizard();
    await goToReview(user);
    await user.click(screen.getByRole("button", { name: /^Submit$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/persist failed/i);
    });
    expect(submitDraft).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("AssignmentWizardContainer — cancel and UX", () => {
  it("invokes onCancel", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        service={service}
        listEmployees={listEmployees}
        onCancel={onCancel}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("uses Submit finish label from container", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await goToReview(user);
    expect(screen.getByRole("button", { name: /^Submit$/i })).toBeInTheDocument();
  });

  it("dismisses action error via Retry", async () => {
    createDraft.mockRejectedValue(new Error("save fail"));
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => {
      expect(screen.queryByText(/save fail/i)).not.toBeInTheDocument();
    });
  });

  it("does not call loadDraft when draftId omitted", async () => {
    render(
      <AssignmentWizardContainer service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    expect(loadDraft).not.toHaveBeenCalled();
  });
});

describe("AssignmentWizardContainer — payload mapping", () => {
  it("maps delivery enrichment on create", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{
          employeeId: "e1",
          assetId: "a1",
          branchId: "b1",
          deliveryReferenceStatus: "received",
          deliveryReferenceNumber: "DR-9",
          assignmentRemarks: "handle carefully",
        }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(createDraft).toHaveBeenCalled());
    expect(createDraft.mock.calls[0]?.[0]).toMatchObject({
      delivery_reference_status: "received",
      delivery_reference_number: "DR-9",
      assignment_remarks: expect.stringContaining("handle carefully"),
    });
  });

  it("includes version on update payload", async () => {
    const user = userEvent.setup();
    loadDraft.mockResolvedValue({ ...draftRow, version: 4 });
    render(
      <AssignmentWizardContainer draftId="d1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(updateDraft).toHaveBeenCalled());
    expect(updateDraft.mock.calls[0]?.[1]).toMatchObject({ version: 4 });
  });
});

describe("AssignmentWizardContainer — asset change", () => {
  it("updates branch when asset selected", async () => {
    const user = userEvent.setup();
    listReadyAssets.mockResolvedValue([
      ...readyAssets(),
      {
        id: "a2",
        label: "Monitor",
        code: "AST-2",
        operationalStatus: "READY_TO_MOVE",
        branchLabel: "HQ",
        branchId: "b1",
      },
    ]);
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await waitFor(() => screen.getByRole("option", { name: /Monitor/i }));
    await user.click(screen.getByRole("option", { name: /Monitor/i }));
    expect(screen.getAllByText("AST-2").length).toBeGreaterThan(0);
  });
});

describe("AssignmentWizardContainer — service contract", () => {
  it("never calls submitDraft on Save draft alone", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{ employeeId: "e1", assetId: "a1", branchId: "b1" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(createDraft).toHaveBeenCalled());
    expect(submitDraft).not.toHaveBeenCalled();
    expect(activateAssignment).not.toHaveBeenCalled();
  });

  it("surfaces loadDraft non-draft message", async () => {
    loadDraft.mockRejectedValue(new Error("Assignment d1 is not a draft (status=active)."));
    render(
      <AssignmentWizardContainer draftId="d1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not a draft/i);
    });
  });

  it("maps department allocation on create", async () => {
    const user = userEvent.setup();
    render(
      <AssignmentWizardContainer
        initialState={{
          allocationType: "department",
          departmentId: "dept-1",
          assetId: "a1",
          branchId: "b1",
        }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Save draft/i }));
    await waitFor(() => expect(createDraft).toHaveBeenCalled());
    expect(createDraft.mock.calls[0]?.[0]).toMatchObject({
      allocation_type: "department",
      department_id: "dept-1",
    });
    expect(createDraft.mock.calls[0]?.[0].employee_id).toBeUndefined();
  });
});
