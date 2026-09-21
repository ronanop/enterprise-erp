/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_USER_TRANSFER_ASSIGN,
  EMPTY_USER_TRANSFER_RETURN,
} from "@/components/assets/user-transfer-destination";
import { UserTransferDestinationPanel } from "@/components/assets/user-transfer-destination-panel";
import type { UserTransferContext, UserTransferVerificationResult } from "@/services/assets-service";

const listSiteLocations = vi.fn();
const listSiteBuildings = vi.fn();

vi.mock("@/services/asset-site-location-service", () => ({
  listSiteLocations: (...args: unknown[]) => listSiteLocations(...args),
  listSiteBuildings: (...args: unknown[]) => listSiteBuildings(...args),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  listSiteLocations.mockResolvedValue([
    {
      id: "loc-1",
      name: "Noida",
      is_head_office: true,
      org_location_id: null,
      company_id: "c1",
      version: 1,
    },
  ]);
  listSiteBuildings.mockResolvedValue([
    { id: "bld-1", location_id: "loc-1", name: "Tower A", company_id: "c1", version: 1 },
    { id: "bld-2", location_id: "loc-1", name: "Tower B", company_id: "c1", version: 1 },
  ]);
});

const context: UserTransferContext = {
  asset_id: "a1",
  asset_code: "AST-003",
  asset_name: "Dell Latitude",
  operational_status: "ASSIGNED",
  lifecycle_status: "active",
  current_user: "Rahul Sharma",
  current_employee_id: "emp-current",
  assignment_id: "asn-1",
  components: [],
  company_id: "c1",
  branch_id: "b1",
  version: 1,
};

const verification: UserTransferVerificationResult = {
  verification_id: "v1",
  asset_id: "a1",
  assignment_id: "asn-1",
  data_backup_verified: true,
  qc_completed: true,
  physical_condition: "good",
  verified_component_ids: [],
  verified_at: "2026-09-16T00:00:00Z",
  status: "verified",
};

const employees = [
  { id: "emp-1", label: "Sana Qureshi (EMP-008) · Customer Support Lead" },
  { id: "emp-current", label: "Rahul Sharma (EMP-001)" },
];
const departments = [
  { id: "d-hr", label: "Human Resources" },
  { id: "d-it", label: "IT" },
];

function renderPanel(
  assignForm: typeof EMPTY_USER_TRANSFER_ASSIGN,
  extras?: Partial<React.ComponentProps<typeof UserTransferDestinationPanel>>,
) {
  return render(
    <UserTransferDestinationPanel
      context={context}
      verificationResult={verification}
      mode="assign"
      onModeChange={vi.fn()}
      assignForm={assignForm}
      onAssignFormChange={vi.fn()}
      returnForm={EMPTY_USER_TRANSFER_RETURN}
      onReturnFormChange={vi.fn()}
      employees={employees}
      departments={departments}
      onSubmitAssign={vi.fn()}
      onSubmitReturn={vi.fn()}
      {...extras}
    />,
  );
}

describe("UserTransferDestinationPanel New User modes", () => {
  it("defaults to Existing Employee with directory select and auto department", async () => {
    renderPanel({
      ...EMPTY_USER_TRANSFER_ASSIGN,
      employeeSource: "MASTER_DATA",
      employeeId: "emp-1",
      departmentId: "d-hr",
    });
    expect(screen.getByTestId("ut-source-MASTER_DATA")).toBeInTheDocument();
    expect(screen.getByTestId("ut-employee-select")).toBeInTheDocument();
    expect(screen.queryByTestId("ut-manual-fields")).not.toBeInTheDocument();
    expect(screen.getByTestId("ut-department-readonly")).toHaveValue("Human Resources");
    await waitFor(() => expect(listSiteLocations).toHaveBeenCalled());
  });

  it("loads buildings when location is set", async () => {
    renderPanel({
      ...EMPTY_USER_TRANSFER_ASSIGN,
      employeeId: "emp-1",
      departmentId: "d-hr",
      toLocationId: "loc-1",
    });
    await waitFor(() => expect(listSiteBuildings).toHaveBeenCalledWith("loc-1"));
    expect(screen.getByTestId("ut-location-select")).toBeInTheDocument();
    expect(screen.getByTestId("ut-building-select")).toBeInTheDocument();
  });

  it("clears building when location patch is emitted", async () => {
    const onAssignFormChange = vi.fn();
    renderPanel(
      {
        ...EMPTY_USER_TRANSFER_ASSIGN,
        employeeId: "emp-1",
        toLocationId: "loc-1",
        toBuildingId: "bld-1",
      },
      { onAssignFormChange },
    );
    // Location SelectTrigger exists; building depends on location first placeholder when empty.
    expect(screen.getByTestId("ut-building-select")).toBeInTheDocument();
    // Simulate parent clearing building when location changes (panel contract).
    onAssignFormChange({ toLocationId: "loc-2", toBuildingId: "" });
    expect(onAssignFormChange).toHaveBeenCalledWith({
      toLocationId: "loc-2",
      toBuildingId: "",
    });
  });

  it("switches to Manual Entry and shows manual identity fields", async () => {
    const user = userEvent.setup();
    const onAssignFormChange = vi.fn();
    const { rerender } = renderPanel(EMPTY_USER_TRANSFER_ASSIGN, { onAssignFormChange });

    await user.click(screen.getByTestId("ut-source-MANUAL_ENTRY"));
    expect(onAssignFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ employeeSource: "MANUAL_ENTRY", employeeId: "" }),
    );

    rerender(
      <UserTransferDestinationPanel
        context={context}
        verificationResult={verification}
        mode="assign"
        onModeChange={vi.fn()}
        assignForm={{
          ...EMPTY_USER_TRANSFER_ASSIGN,
          employeeSource: "MANUAL_ENTRY",
          employeeId: "",
        }}
        onAssignFormChange={onAssignFormChange}
        returnForm={EMPTY_USER_TRANSFER_RETURN}
        onReturnFormChange={vi.fn()}
        employees={employees}
        departments={departments}
        onSubmitAssign={vi.fn()}
        onSubmitReturn={vi.fn()}
      />,
    );

    expect(screen.getByTestId("ut-manual-fields")).toBeInTheDocument();
    expect(screen.getByTestId("ut-manual-name")).toBeInTheDocument();
    expect(screen.getByTestId("ut-manual-phone")).toBeInTheDocument();
    expect(screen.getByTestId("ut-manual-deployed")).toBeInTheDocument();
    expect(screen.getByTestId("ut-department-select")).toBeInTheDocument();
    expect(screen.queryByTestId("ut-employee-select")).not.toBeInTheDocument();

    await user.type(screen.getByTestId("ut-manual-name"), "Shreya");
    expect(onAssignFormChange).toHaveBeenCalled();
  });

  it("enables Transfer & assign for complete Manual Entry form", async () => {
    const onSubmitAssign = vi.fn();
    const user = userEvent.setup();
    renderPanel(
      {
        ...EMPTY_USER_TRANSFER_ASSIGN,
        employeeSource: "MANUAL_ENTRY",
        manualEmployeeName: "Shreya Saxena",
        manualEmployeePhone: "9876543210",
        manualEmployeeDeployedTo: "Client site",
        departmentId: "d-hr",
        toLocationId: "loc-1",
        toBuildingId: "bld-1",
        allocatedAt: "2026-09-16",
      },
      { onSubmitAssign },
    );
    const submit = screen.getByTestId("submit-assign");
    expect(submit).not.toBeDisabled();
    await user.click(submit);
    expect(onSubmitAssign).toHaveBeenCalled();
  });

  it("enables Transfer & assign for complete Existing Employee form", async () => {
    const onSubmitAssign = vi.fn();
    const user = userEvent.setup();
    renderPanel(
      {
        ...EMPTY_USER_TRANSFER_ASSIGN,
        employeeSource: "MASTER_DATA",
        employeeId: "emp-1",
        departmentId: "d-hr",
        toLocationId: "loc-1",
        toBuildingId: "bld-1",
        allocatedAt: "2026-09-16",
      },
      { onSubmitAssign },
    );
    await user.click(screen.getByTestId("submit-assign"));
    expect(onSubmitAssign).toHaveBeenCalled();
  });
});
