/** @vitest-environment jsdom */

import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: () => true,
  getAccessTokenUserId: () => "user-1",
}));

vi.mock("@/lib/org-options", () => ({
  listEmployeeOptions: vi.fn(async () => [
    { id: "emp-1", label: "Rohan Mehta (EMP-002)" },
  ]),
  listEmployeeDirectory: vi.fn(async () => [
    {
      id: "emp-1",
      label: "Rohan Mehta (EMP-002)",
      displayName: "Rohan Mehta",
      employeeCode: "EMP-002",
      mobile: null,
      departmentId: "dept-1",
    },
  ]),
  listDepartmentOptions: vi.fn(async () => [{ id: "dept-1", label: "Accountant" }]),
}));

vi.mock("@/services/projects-portal-service", () => ({
  listProjectOptions: vi.fn(async () => []),
}));

vi.mock("@/services/asset-site-location-service", () => ({
  listSiteLocations: vi.fn(async () => [{ id: "loc-1", name: "Noida", is_head_office: false, org_location_id: null, company_id: "c1", version: 1 }]),
}));

const listMock = vi.fn();
const getMock = vi.fn();
const actionMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/services/api-client", () => ({
  ApiClientError: class ApiClientError extends Error {},
  resourceService: {
    list: (...args: unknown[]) => listMock(...args),
    get: (...args: unknown[]) => getMock(...args),
    create: vi.fn(),
    update: vi.fn(),
    action: (...args: unknown[]) => actionMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

vi.mock("@/services/assets-service", () => ({
  assetLocationService: {
    search: vi.fn(async () => ({
      items: [
        {
          id: "loc-row-1",
          asset_id: "asset-1",
          location_label: "Noida Campus",
          location_id: "loc-1",
          building_id: "bld-1",
          is_current: true,
          status: "active",
          company_id: "c1",
          version: 1,
        },
      ],
      total: 1,
      page: 1,
      page_size: 200,
    })),
  },
  dcChallanService: {
    search: vi.fn(async (params: { assignment_id?: string }) => {
      if (params.assignment_id === "asg-2") {
        return {
          items: [
            {
              id: "dc-existing",
              dc_number: "DC-9",
              asset_id: "asset-2",
              assignment_id: "asg-2",
              status: "PENDING",
              company_id: "c1",
              branch_id: "br-1",
              version: 1,
            },
          ],
          total: 1,
          page: 1,
          page_size: 10,
        };
      }
      return { items: [], total: 0, page: 1, page_size: 10 };
    }),
  },
}));

import { AssetAssignmentWorkspace } from "@/components/assets/asset-assignment-workspace";

const directoryAssignment = {
  id: "asg-1",
  document_number: "ASN-2026-000001",
  asset_id: "asset-1",
  allocation_type: "employee",
  employee_id: "emp-1",
  employee_source: "directory",
  manual_employee_name: null,
  department_id: null,
  project_id: null,
  allocated_at: "2026-03-10T08:00:00Z",
  returned_at: null,
  workflow_status: "approved",
  status: "active",
  version: 1,
  branch_id: "br-1",
  delivery_reference_number: null,
  delivery_reference_status: "pending",
  delivery_challan_signature_status: "not_signed",
};

const manualAssignment = {
  id: "asg-2",
  document_number: "ASN-2026-000002",
  asset_id: "asset-2",
  allocation_type: "employee",
  employee_id: null,
  employee_source: "manual",
  manual_employee_name: "Shreya Saxena",
  department_id: null,
  project_id: null,
  allocated_at: "2026-03-11T08:00:00Z",
  returned_at: null,
  workflow_status: null,
  status: "active",
  version: 1,
  branch_id: "br-1",
  delivery_reference_number: "DC-9",
  delivery_reference_status: "issued",
  delivery_challan_signature_status: "not_signed",
};

const returnedAssignment = {
  id: "asg-3",
  document_number: "ASN-2026-000003",
  asset_id: "asset-3",
  allocation_type: "employee",
  employee_id: "emp-1",
  employee_source: "directory",
  manual_employee_name: null,
  department_id: null,
  project_id: null,
  allocated_at: "2026-01-01T08:00:00Z",
  returned_at: "2026-02-01T08:00:00Z",
  workflow_status: "approved",
  status: "returned",
  version: 2,
  branch_id: "br-1",
  delivery_reference_number: null,
  delivery_reference_status: "not_applicable",
  delivery_challan_signature_status: "not_signed",
};

const draftAssignment = {
  id: "asg-draft",
  document_number: "ASN-2026-000099",
  asset_id: "asset-1",
  allocation_type: "employee",
  employee_id: "emp-1",
  employee_source: "directory",
  manual_employee_name: null,
  department_id: null,
  project_id: null,
  allocated_at: null,
  returned_at: null,
  workflow_status: null,
  status: "draft",
  version: 1,
  branch_id: "br-1",
  delivery_reference_number: null,
  delivery_reference_status: "pending",
  delivery_challan_signature_status: "not_signed",
};

const assets = [
  {
    id: "asset-1",
    asset_code: "AST-2026-000002",
    asset_name: "Macbook",
    branch_id: "br-1",
    department_id: "dept-1",
    status: "active",
  },
  {
    id: "asset-2",
    asset_code: "AST-2026-000007",
    asset_name: "Dell",
    branch_id: "br-1",
    department_id: "dept-1",
    status: "active",
  },
  {
    id: "asset-3",
    asset_code: "AST-2026-000010",
    asset_name: "ThinkPad",
    branch_id: "br-1",
    department_id: "dept-1",
    status: "active",
  },
];

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  actionMock.mockReset();
  deleteMock.mockReset();
  actionMock.mockResolvedValue({ data: { ...draftAssignment, status: "cancelled" } });
  listMock.mockImplementation(async (path: string) => {
    if (String(path).startsWith("/assets/asset-assignments")) {
      const url = String(path);
      const all = [directoryAssignment, manualAssignment, returnedAssignment, draftAssignment];
      const status = new URLSearchParams(url.split("?")[1] ?? "").get("status");
      const items = status ? all.filter((row) => row.status === status) : all;
      return {
        data: {
          items,
          total: items.length,
          page: 1,
          page_size: 25,
        },
      };
    }
    if (String(path).startsWith("/assets/assets")) {
      return { data: { items: assets, total: assets.length, page: 1, page_size: 100 } };
    }
    return { data: { items: [], total: 0, page: 1, page_size: 25 } };
  });
  getMock.mockImplementation(async (_path: string, id: string) => {
    const asset = assets.find((a) => a.id === id);
    return { data: asset ?? null };
  });
});

afterEach(() => {
  cleanup();
});

describe("AssetAssignmentWorkspace register", () => {
  it("loads assigned assets into the register table", async () => {
    render(<AssetAssignmentWorkspace />);
    await waitFor(() => {
      expect(screen.getByTestId("assignment-register-table")).toBeInTheDocument();
    });
    expect(await screen.findByTestId("assignment-row-asg-1")).toBeInTheDocument();
    expect(screen.getByTestId("assignment-row-asg-2")).toBeInTheDocument();
    expect(screen.queryByTestId("assignment-row-asg-3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("assignment-row-asg-draft")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("assignment-row-asg-1")).getByTestId("assignment-asset-cell"),
    ).toHaveTextContent("Macbook");
    expect(
      within(screen.getByTestId("assignment-row-asg-2")).getByTestId("assignment-asset-cell"),
    ).toHaveTextContent("Dell");
    expect(listMock).toHaveBeenCalledWith(expect.stringContaining("status=active"));
  });

  it("STATUS column uses lifecycle only — never workflow composites", async () => {
    render(<AssetAssignmentWorkspace />);
    const table = await screen.findByTestId("assignment-register-table");
    expect(table).toHaveAttribute("data-render-source", "AssetAssignmentWorkspace");

    const activeRow = await screen.findByTestId("assignment-row-asg-1");
    const activeStatus = within(activeRow).getByTestId("assignment-status-cell");
    expect(activeStatus).toHaveTextContent(/^Active$/);
    expect(within(activeStatus).getByTestId("assignment-status-badge")).toHaveAttribute(
      "data-render-source",
      "AssetAssignmentWorkspace",
    );
    expect(within(activeStatus).getByTestId("assignment-status-badge")).toHaveAttribute(
      "data-status-display",
      "Active",
    );
    expect(activeStatus).not.toHaveTextContent("approved");
    expect(activeStatus).not.toHaveTextContent("submitted");
    expect(activeStatus).not.toHaveTextContent("draft");
    expect(activeStatus).not.toHaveTextContent("/");
    expect(activeStatus).not.toHaveTextContent("active / approved");

    expect(screen.queryByTestId("assignment-row-asg-3")).not.toBeInTheDocument();

    const tableText = table.textContent ?? "";
    expect(tableText).not.toMatch(/active\s*\/\s*approved/i);
    expect(tableText).not.toMatch(/returned\s*\/\s*approved/i);
    // workflow label must not appear as a status cell value
    expect(within(table).queryAllByText(/^approved$/i)).toHaveLength(0);
    expect(within(table).queryAllByText(/^submitted$/i)).toHaveLength(0);
    expect(within(table).queryAllByText(/^draft$/i)).toHaveLength(0);
  });

  it("does not render Document or Asset Code columns", async () => {
    render(<AssetAssignmentWorkspace />);
    const table = await screen.findByTestId("assignment-register-table");
    expect(within(table).queryByRole("columnheader", { name: /Document/i })).not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: /Asset Code/i })).not.toBeInTheDocument();
    expect(screen.queryByText("ASN-2026-000001")).not.toBeInTheDocument();
    expect(screen.queryByText("ASN-2026-000002")).not.toBeInTheDocument();
    expect(screen.queryByText("ASN-2026-000003")).not.toBeInTheDocument();
    expect(screen.queryByText(/AASN-/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("assignment-asset-code-cell")).not.toBeInTheDocument();
  });

  it("shows real employee name in Assigned column and employee id separately", async () => {
    render(<AssetAssignmentWorkspace />);
    const table = await screen.findByTestId("assignment-register-table");
    expect(within(table).getByRole("columnheader", { name: /^Assigned$/i })).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: /^Assignee$/i })).not.toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: /^Office$/i })).not.toBeInTheDocument();

    const dirRow = await screen.findByTestId("assignment-row-asg-1");
    expect(within(dirRow).getByTestId("assignment-assignee-cell")).toHaveTextContent(
      "Rohan Mehta",
    );
    expect(within(dirRow).getByTestId("assignment-employee-id-cell")).toHaveTextContent(
      "EMP-002",
    );

    const manualRow = screen.getByTestId("assignment-row-asg-2");
    expect(within(manualRow).getByTestId("assignment-assignee-cell")).toHaveTextContent(
      "Shreya Saxena",
    );
  });

  it("shows employee id, asset name/code under Asset, date, status, DC", async () => {
    render(<AssetAssignmentWorkspace />);
    const row = await screen.findByTestId("assignment-row-asg-1");

    expect(within(row).getByTestId("assignment-employee-id-cell")).toHaveTextContent(
      "EMP-002",
    );
    expect(within(row).getByTestId("assignment-asset-cell")).toHaveTextContent("Macbook");
    expect(within(row).getByTestId("assignment-asset-cell")).toHaveTextContent(
      "AST-2026-000002",
    );
    expect(within(row).queryByTestId("assignment-department-cell")).not.toBeInTheDocument();
    expect(within(row).queryByTestId("assignment-location-cell")).not.toBeInTheDocument();
    expect(within(row).queryByTestId("assignment-building-cell")).not.toBeInTheDocument();
    expect(within(row).getByTestId("assignment-date-cell")).toHaveTextContent("2026-03-10");
    expect(within(row).getByTestId("assignment-status-cell")).toHaveTextContent("Active");
    expect(within(row).getByTestId("assignment-status-cell")).not.toHaveTextContent("/");
    expect(within(row).getByTestId("assignment-status-cell")).not.toHaveTextContent(
      "approved",
    );
    expect(within(row).queryByTestId("assignment-dc-status")).not.toBeInTheDocument();
    expect(within(row).getByTestId("assignment-dc-create")).toBeInTheDocument();

    const manualRow = screen.getByTestId("assignment-row-asg-2");
    expect(within(manualRow).queryByTestId("assignment-dc-status")).not.toBeInTheDocument();
    expect(within(manualRow).getByTestId("assignment-dc-created")).toHaveTextContent("Created");
  });

  it("shows Create DC action when no DC record exists", async () => {
    const user = userEvent.setup();
    render(<AssetAssignmentWorkspace />);
    const row = await screen.findByTestId("assignment-row-asg-1");
    expect(within(row).queryByTestId("assignment-dc-status")).not.toBeInTheDocument();
    const createBtn = within(row).getByTestId("assignment-dc-create");
    expect(createBtn).toBeEnabled();
    expect(createBtn).toHaveTextContent("Create");
    await user.click(createBtn);
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("/assets/asset-dc-challans?"),
    );
    expect(push).toHaveBeenCalledWith(expect.stringContaining("assignmentId=asg-1"));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("assetId=asset-1"));
    expect(push.mock.calls.some((c) => String(c[0]).includes("challanId="))).toBe(false);
  });

  it("shows Created button for existing DC challan", async () => {
    const user = userEvent.setup();
    render(<AssetAssignmentWorkspace />);
    const row = await screen.findByTestId("assignment-row-asg-2");
    expect(within(row).queryByTestId("assignment-dc-status")).not.toBeInTheDocument();
    expect(within(row).queryByTestId("assignment-dc-create")).not.toBeInTheDocument();
    const createdBtn = within(row).getByTestId("assignment-dc-created");
    expect(createdBtn).toHaveTextContent("Created");
    await user.click(createdBtn);
    expect(push).toHaveBeenCalledWith(expect.stringContaining("challanId=dc-existing"));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("assignmentId=asg-2"));
  });

  it("does not render an Actions column or row Edit/Delete buttons", async () => {
    render(<AssetAssignmentWorkspace />);
    const table = await screen.findByTestId("assignment-register-table");
    expect(within(table).queryByRole("columnheader", { name: /^Actions$/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("assignment-actions-cell")).not.toBeInTheDocument();

    const row = await screen.findByTestId("assignment-row-asg-1");
    expect(within(row).queryByRole("button", { name: /^Edit$/i })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /^Delete$/i })).not.toBeInTheDocument();
    // DC Create remains in the DC Challan column only
    expect(within(row).getByTestId("assignment-dc-create")).toBeInTheDocument();
  });

  it("opens assignment details for an active row", async () => {
    const user = userEvent.setup();
    render(<AssetAssignmentWorkspace />);
    const row = await screen.findByTestId("assignment-row-asg-1");
    await user.click(row);

    const panel = await screen.findByTestId("assignment-detail-panel");
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByTestId("assignment-detail-asset")).toHaveTextContent("Macbook");
    expect(within(panel).getByTestId("assignment-detail-assignee")).toHaveTextContent(
      "Rohan Mehta",
    );
    expect(within(panel).getByTestId("assignment-detail-employee-id")).toHaveTextContent(
      "EMP-002",
    );
    expect(within(panel).queryByTestId("assignment-detail-building")).not.toBeInTheDocument();
  });

  it("excludes returned and draft assignments from the register", async () => {
    render(<AssetAssignmentWorkspace />);
    await screen.findByTestId("assignment-row-asg-1");
    expect(screen.queryByTestId("assignment-row-asg-3")).not.toBeInTheDocument();
    expect(screen.queryByTestId("assignment-row-asg-draft")).not.toBeInTheDocument();
    expect(listMock).toHaveBeenCalledWith(expect.stringContaining("status=active"));
  });
});
