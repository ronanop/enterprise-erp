/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ReturnWizardContainer,
  type ReturnWizardContainerService,
} from "@/components/assets/assignment-wizard/return-wizard-container";
import type { AssignmentResponse } from "@/services/assignment-frontend-service";

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn(() => true),
}));

const loadAssignment = vi.fn();
const findActiveAssignmentForAsset = vi.fn();
const getAsset = vi.fn();
const returnAsset = vi.fn();
const formatError = vi.fn((err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback,
);

const service: ReturnWizardContainerService = {
  loadAssignment,
  findActiveAssignmentForAsset,
  getAsset,
  returnAsset,
  formatError,
};

const listEmployees = vi.fn(() => Promise.resolve([{ id: "e1", label: "Emp One" }]));

const activeAssignment: AssignmentResponse = {
  id: "asg-1",
  document_number: "ASN-1",
  asset_id: "a1",
  allocation_type: "employee",
  employee_id: "e1",
  allocated_at: "2026-01-01T00:00:00Z",
  status: "active",
  delivery_reference_status: "received",
  delivery_reference_number: "DR-42",
  branch_id: "b1",
  version: 1,
};

async function waitForWizard() {
  await waitFor(() => {
    expect(screen.getByRole("heading", { name: /Return asset/i })).toBeInTheDocument();
  });
}

async function advanceToReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Confirm return/i })).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  loadAssignment.mockResolvedValue(activeAssignment);
  findActiveAssignmentForAsset.mockResolvedValue(activeAssignment);
  getAsset.mockResolvedValue({
    asset_code: "AST-1",
    asset_name: "Laptop",
    serial_number: "SN-9",
    operational_status: "ASSIGNED",
  });
  returnAsset.mockResolvedValue({ ...activeAssignment, status: "returned" });
  listEmployees.mockResolvedValue([{ id: "e1", label: "Emp One" }]);
  formatError.mockImplementation((err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
  );
});

describe("ReturnWizardContainer — load", () => {
  it("requires assignmentId or assetId", async () => {
    render(<ReturnWizardContainer service={service} listEmployees={listEmployees} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/assignmentId or assetId is required/i);
    });
  });

  it("loads assignment by assignmentId", async () => {
    render(
      <ReturnWizardContainer
        assignmentId="asg-1"
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(loadAssignment).toHaveBeenCalledWith("asg-1"));
    await waitFor(() => expect(getAsset).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(screen.getByText(/ASN-1/i)).toBeInTheDocument());
    expect(findActiveAssignmentForAsset).not.toHaveBeenCalled();
  });

  it("resolves active assignment by assetId", async () => {
    render(
      <ReturnWizardContainer assetId="a1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => expect(findActiveAssignmentForAsset).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(screen.getByText(/ASN-1/i)).toBeInTheDocument());
  });

  it("prefers assignmentId over assetId", async () => {
    render(
      <ReturnWizardContainer
        assignmentId="asg-1"
        assetId="a1"
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitFor(() => expect(loadAssignment).toHaveBeenCalledWith("asg-1"));
    expect(findActiveAssignmentForAsset).not.toHaveBeenCalled();
  });

  it("populates summary fields", async () => {
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => expect(screen.getByText(/AST-1/i)).toBeInTheDocument());
    expect(screen.getByText(/Laptop/i)).toBeInTheDocument();
    expect(screen.getByText(/Emp One/i)).toBeInTheDocument();
    expect(screen.getByText(/DR-42/i)).toBeInTheDocument();
  });

  it("shows error when no active assignment for asset", async () => {
    findActiveAssignmentForAsset.mockResolvedValue(null);
    render(
      <ReturnWizardContainer assetId="missing" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/No active assignment/i);
    });
  });

  it("rejects non-active assignment status", async () => {
    loadAssignment.mockResolvedValue({ ...activeAssignment, status: "draft" });
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Only active assignments/i);
    });
  });

  it("shows auth error when not signed in", async () => {
    const { isAuthenticated } = await import("@/lib/auth");
    vi.mocked(isAuthenticated).mockReturnValueOnce(false);
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Sign in/i);
    });
  });

  it("shows load error when getAsset fails", async () => {
    getAsset.mockRejectedValue(new Error("asset missing"));
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/asset missing/i);
    });
  });

  it("formats unknown load failures", async () => {
    loadAssignment.mockRejectedValue("raw");
    formatError.mockReturnValue("Failed to load return data.");
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Failed to load return data/i);
    });
  });
});

describe("ReturnWizardContainer — loading & retry", () => {
  it("shows wizard after successful load", async () => {
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
  });

  it("retries load after failure", async () => {
    findActiveAssignmentForAsset
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(activeAssignment);
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer assetId="a1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => expect(findActiveAssignmentForAsset).toHaveBeenCalledTimes(2));
    await waitForWizard();
  });

  it("retries after loadAssignment failure", async () => {
    loadAssignment
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(activeAssignment);
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/timeout/i));
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    await waitForWizard();
    expect(loadAssignment).toHaveBeenCalledTimes(2);
  });
});

describe("ReturnWizardContainer — submit", () => {
  it("submits return and calls onSuccess", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer
        assignmentId="asg-1"
        service={service}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitForWizard();
    await advanceToReview(user);
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() => expect(returnAsset).toHaveBeenCalled());
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentId: "asg-1",
          assetId: "a1",
          assetName: "Laptop",
          assetCode: "AST-1",
          returnCondition: "good",
        }),
      ),
    );
  });

  it("sends default good condition payload", async () => {
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    await advanceToReview(user);
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() =>
      expect(returnAsset).toHaveBeenCalledWith("asg-1", {
        return_condition: "good",
        return_remarks: undefined,
        reason: undefined,
      }),
    );
  });

  it("shows action error when returnAsset fails", async () => {
    returnAsset.mockRejectedValue(new Error("not returnable"));
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer
        assignmentId="asg-1"
        service={service}
        listEmployees={listEmployees}
        onSuccess={onSuccess}
      />,
    );
    await waitForWizard();
    await advanceToReview(user);
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/not returnable/i);
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("dismisses action error via Retry", async () => {
    returnAsset.mockRejectedValue(new Error("return fail"));
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    await advanceToReview(user);
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Retry/i }));
    await waitFor(() => {
      expect(screen.queryByText(/return fail/i)).not.toBeInTheDocument();
    });
  });

  it("invokes onCancel", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer
        assignmentId="asg-1"
        service={service}
        listEmployees={listEmployees}
        onCancel={onCancel}
      />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("ReturnWizardContainer — return condition", () => {
  it("submits outdated condition", async () => {
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("radio", { name: /Outdated/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() =>
      expect(returnAsset).toHaveBeenCalledWith(
        "asg-1",
        expect.objectContaining({ return_condition: "outdated" }),
      ),
    );
  });

  it("submits dead condition", async () => {
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("radio", { name: /Not working/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() =>
      expect(returnAsset).toHaveBeenCalledWith(
        "asg-1",
        expect.objectContaining({ return_condition: "dead" }),
      ),
    );
  });

  it("honors initialState.returnCondition", async () => {
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer
        assignmentId="asg-1"
        initialState={{ returnCondition: "outdated" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await advanceToReview(user);
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() =>
      expect(returnAsset).toHaveBeenCalledWith(
        "asg-1",
        expect.objectContaining({ return_condition: "outdated" }),
      ),
    );
  });
});

describe("ReturnWizardContainer — return remarks", () => {
  it("includes remarks and reason in payload", async () => {
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.type(screen.getByLabelText(/Return remarks/i), "  screen scratch  ");
    await user.type(screen.getByLabelText(/Reason/i), "  offboarding  ");
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() =>
      expect(returnAsset).toHaveBeenCalledWith("asg-1", {
        return_condition: "good",
        return_remarks: "screen scratch",
        reason: "offboarding",
      }),
    );
  });

  it("omits blank remarks from payload", async () => {
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer
        assignmentId="asg-1"
        initialState={{ returnRemarks: "   ", reason: "" }}
        service={service}
        listEmployees={listEmployees}
      />,
    );
    await waitForWizard();
    await advanceToReview(user);
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() =>
      expect(returnAsset).toHaveBeenCalledWith("asg-1", {
        return_condition: "good",
        return_remarks: undefined,
        reason: undefined,
      }),
    );
  });
});

describe("ReturnWizardContainer — assignee fallback", () => {
  it("falls back when employee not in roster", async () => {
    listEmployees.mockResolvedValue([]);
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitFor(() => expect(screen.getByText(/e1/i)).toBeInTheDocument());
  });

  it("uses Assigned when employee_id is null", async () => {
    loadAssignment.mockResolvedValue({ ...activeAssignment, employee_id: null });
    listEmployees.mockResolvedValue([]);
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    expect(screen.getAllByText("Assigned").length).toBeGreaterThanOrEqual(1);
  });
});

describe("ReturnWizardContainer — service contract", () => {
  it("does not call returnAsset until confirm", async () => {
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer assignmentId="asg-1" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    await user.click(screen.getByRole("button", { name: /^Next$/i }));
    expect(returnAsset).not.toHaveBeenCalled();
  });

  it("passes assignment id from loaded row to returnAsset", async () => {
    loadAssignment.mockResolvedValue({ ...activeAssignment, id: "asg-99" });
    const user = userEvent.setup();
    render(
      <ReturnWizardContainer assignmentId="asg-99" service={service} listEmployees={listEmployees} />,
    );
    await waitForWizard();
    await advanceToReview(user);
    await user.click(screen.getByRole("button", { name: /Confirm return/i }));
    await waitFor(() => expect(returnAsset).toHaveBeenCalledWith("asg-99", expect.any(Object)));
  });
});
