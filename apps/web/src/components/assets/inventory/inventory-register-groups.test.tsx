/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";
import {
  InventoryRegisterGroups,
  inventoryRowToRegisterGroups,
} from "@/components/assets/inventory/inventory-register-groups";
import { mapInventoryRowToDrawerData } from "@/components/assets/inventory/interaction/inventory-drawer.mapper";
import {
  mapAssetToInventoryRow,
  resolveItRegistrationFields,
} from "@/components/assets/inventory.mapper";

afterEach(() => cleanup());

const baseRow = (): InventoryRowViewModel => ({
  id: "a1",
  assetTag: "AST-1",
  laptopName: "Laptop One",
  serialNumber: "SN-9",
  manufacturer: "Dell",
  model: "Latitude 5420",
  configuration: "i5 / 16GB / 512GB",
  currentHolder: "Rahul Sharma",
  employeeId: "EMP-1024",
  department: "IT",
  branch: "Noida",
  operationalStatus: "ASSIGNED",
  lifecycleStatus: "active",
  issueDate: "12 Aug 2026",
  location: "Floor 3",
  expandable: {
    earlierUsedBy: "Amit Kumar",
    deliveryChallan: "DC-2026-0012",
    deliveryReferenceStatus: "Issued",
    deliverySignature: "Signed",
    deliveryChallanSummary: "DC-2026-0012 · Issued · Signed",
    phoneNumber: "9812345678",
    remarks: "Handle carefully",
    assignmentRemarks: "Handle carefully",
    returnRemarks: "—",
    accessories: [
      { typeLabel: "Charger", serialDisplay: "CHG-12345", componentName: "65W" },
      { typeLabel: "Mouse", serialDisplay: "—" },
    ],
  },
  assignmentHistory: [],
});

describe("inventory-register-groups", () => {
  it("renders all 4E groups from inventory row", () => {
    const model = inventoryRowToRegisterGroups(baseRow());
    render(<InventoryRegisterGroups model={model} />);
    expect(screen.getByText("Assignment")).toBeTruthy();
    expect(screen.getByTestId("inventory-expandable-assignee").textContent).toBe("Rahul Sharma");
    expect(screen.getByTestId("inventory-expandable-employee-id").textContent).toBe("EMP-1024");
    expect(screen.getByTestId("inventory-expandable-phone").textContent).toBe("9812345678");
    expect(screen.getByTestId("inventory-expandable-make").textContent).toBe("Dell");
    expect(screen.getByTestId("inventory-expandable-model").textContent).toBe("Latitude 5420");
    expect(screen.getByTestId("inventory-expandable-configuration").textContent).toContain("i5");
    expect(screen.getByTestId("inventory-expandable-branch").textContent).toBe("Noida");
    expect(screen.getByTestId("inventory-expandable-location").textContent).toBe("Floor 3");
    expect(screen.getByTestId("inventory-expandable-dc-number").textContent).toBe("DC-2026-0012");
    expect(screen.getByTestId("inventory-expandable-dc-status").textContent).toBe("Issued");
    expect(screen.getByTestId("inventory-expandable-dc-signature").textContent).toBe("Signed");
    expect(screen.getByTestId("inventory-expandable-accessories").textContent).toContain("CHG-12345");
    expect(screen.getByTestId("inventory-expandable-earlier-used").textContent).toBe("Amit Kumar");
    expect(screen.getByText("IT Information")).toBeTruthy();
    expect(screen.getByText("Location")).toBeTruthy();
    expect(screen.getByText("Delivery Challan")).toBeTruthy();
    expect(screen.queryByText("Operational Status")).toBeNull();
  });

  it("renders Create DC Challan only when a callback is provided", () => {
    const { rerender } = render(
      <InventoryRegisterGroups model={inventoryRowToRegisterGroups(baseRow())} />,
    );
    expect(screen.queryByRole("button", { name: "Create DC Challan" })).toBeNull();
    rerender(
      <InventoryRegisterGroups
        model={inventoryRowToRegisterGroups(baseRow())}
        onCreateDcChallan={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Create DC Challan" })).toBeTruthy();
  });

  it("shows empty accessories copy", () => {
    const row = baseRow();
    row.expandable.accessories = [];
    render(<InventoryRegisterGroups model={inventoryRowToRegisterGroups(row)} />);
    expect(screen.getByTestId("inventory-expandable-accessories").textContent).toContain(
      "No accessories assigned",
    );
  });

  it("shows empty DC state when no standalone challan is linked", () => {
    render(
      <InventoryRegisterGroups
        model={inventoryRowToRegisterGroups(baseRow())}
        dcChallan={null}
        onCreateDcChallan={() => undefined}
      />,
    );
    expect(screen.getByText("No delivery challan for this asset.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create DC Challan" })).toBeTruthy();
  });

  it("shows linked DC number, status badge, and View", () => {
    render(
      <InventoryRegisterGroups
        model={inventoryRowToRegisterGroups(baseRow())}
        dcChallan={{
          id: "dc-9",
          dc_number: "DC-2026-000099",
          asset_id: "a1",
          status: "SIGNED",
          company_id: "c1",
          branch_id: "b1",
          version: 1,
          signed_at: "2026-08-25T12:00:00Z",
          scm_issued_document: {
            doc_kind: "SCM_ISSUED",
            original_filename: "issued.pdf",
            has_stored_file: true,
          },
          signed_document: {
            doc_kind: "SIGNED",
            original_filename: "signed.pdf",
            has_stored_file: true,
          },
        }}
        onViewDcDocument={() => undefined}
      />,
    );
    expect(screen.getByTestId("inventory-linked-dc-challan")).toBeTruthy();
    expect(screen.getByText("DC-2026-000099")).toBeTruthy();
    expect(screen.getByText("issued.pdf")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "View" }).length).toBe(2);
  });
});

describe("inventory ↔ drawer consistency", () => {
  it("maps the same register groups into drawer payload", () => {
    const row = baseRow();
    const drawer = mapInventoryRowToDrawerData(row);
    expect(drawer.registerGroups?.assignee).toBe(row.currentHolder);
    expect(drawer.registerGroups?.employeeId).toBe(row.employeeId);
    expect(drawer.registerGroups?.phone).toBe(row.expandable.phoneNumber);
    expect(drawer.registerGroups?.make).toBe(row.manufacturer);
    expect(drawer.registerGroups?.dcNumber).toBe(row.expandable.deliveryChallan);
    expect(drawer.registerGroups?.dcSignature).toBe(row.expandable.deliverySignature);
    expect(drawer.assignment?.employee).toBe(row.currentHolder);
    expect(drawer.additional?.location).toBe(row.location);
  });
});

describe("resolveItRegistrationFields", () => {
  it("prefers persisted make/model/configuration over discovery", () => {
    const fields = resolveItRegistrationFields({
      id: "1",
      make: "Lenovo",
      model: "T14",
      configuration: "i7 / 32GB",
      discovery_profile_json: {
        manufacturer: "Dell",
        model: "Other",
        cpu: "i5",
        ram: "8GB",
      },
    });
    expect(fields).toEqual({
      make: "Lenovo",
      model: "T14",
      configuration: "i7 / 32GB",
    });
  });

  it("falls back to discovery when persisted blank", () => {
    const fields = resolveItRegistrationFields({
      id: "1",
      make: null,
      model: "  ",
      configuration: null,
      discovery_profile_json: {
        manufacturer: "HP",
        model: "EliteBook",
        cpu: "i5",
        ram: "16GB",
        os_name: "Windows 11",
      },
    });
    expect(fields.make).toBe("HP");
    expect(fields.model).toBe("EliteBook");
    expect(fields.configuration).toBe("i5 · 16GB · Windows 11");
  });
});

describe("mapAssetToInventoryRow — 4E sources", () => {
  it("maps assignment enrichment and location without faking branch as location", () => {
    const row = mapAssetToInventoryRow(
      {
        id: "asset-1",
        asset_code: "AST-1",
        asset_name: "Laptop",
        serial_number: "SN-1",
        make: "Dell",
        model: "5420",
        configuration: "i5 / 16GB",
        branch_id: "br-1",
        department_id: "d-1",
        operational_status: "ASSIGNED",
        status: "active",
      },
      {
        branchLabels: { "br-1": "Noida" },
        departmentLabels: { "d-1": "IT" },
        categoryLabels: {},
        locationLabels: { "asset-1": "Cubicle A1" },
        assignmentsByAssetId: new Map([
          [
            "asset-1",
            {
              id: "asn-1",
              asset_id: "asset-1",
              status: "active",
              employee_id: "emp-1",
              allocated_at: "2026-08-12T00:00:00Z",
              delivery_reference_number: "DC-1",
              delivery_reference_status: "issued",
              delivery_challan_signature_status: "signed",
              assignment_remarks: "ok",
            },
          ],
        ]),
        assignmentHistoryByAssetId: new Map([
          [
            "asset-1",
            [
              {
                id: "asn-old",
                asset_id: "asset-1",
                status: "returned",
                employee_id: "emp-old",
                returned_at: "2026-01-01T00:00:00Z",
              },
              {
                id: "asn-1",
                asset_id: "asset-1",
                status: "active",
                employee_id: "emp-1",
                allocated_at: "2026-08-12T00:00:00Z",
                delivery_reference_number: "DC-1",
                delivery_reference_status: "issued",
                delivery_challan_signature_status: "signed",
                assignment_remarks: "ok",
              },
            ],
          ],
        ]),
        accessoriesByAssetId: new Map([
          [
            "asset-1",
            [{ typeLabel: "Charger", serialDisplay: "CHG-1", componentName: "65W" }],
          ],
        ]),
        employeeLookup: {
          "emp-1": {
            label: "Rahul Sharma",
            displayName: "Rahul Sharma",
            employeeCode: "EMP-1024",
            mobile: "9811111111",
          },
          "emp-old": {
            label: "Amit Kumar",
            displayName: "Amit Kumar",
            employeeCode: "EMP-9",
            mobile: "9800000000",
          },
        },
      },
    );

    expect(row.manufacturer).toBe("Dell");
    expect(row.model).toBe("5420");
    expect(row.configuration).toBe("i5 / 16GB");
    expect(row.currentHolder).toBe("Rahul Sharma");
    expect(row.employeeId).toBe("EMP-1024");
    expect(row.location).toBe("Cubicle A1");
    expect(row.branch).toBe("Noida");
    expect(row.expandable.phoneNumber).toBe("9811111111");
    expect(row.expandable.earlierUsedBy).toBe("Amit Kumar");
    expect(row.expandable.deliveryChallan).toBe("DC-1");
    expect(row.expandable.deliveryReferenceStatus).toBe("Issued");
    expect(row.expandable.deliverySignature).toBe("Signed");
    expect(row.expandable.accessories?.[0].serialDisplay).toBe("CHG-1");

    const groups = inventoryRowToRegisterGroups(row);
    expect(groups.assignee).toBe(row.currentHolder);
    expect(groups.location).toBe(row.location);
    expect(groups.dcStatus).toBe("Issued");
    expect(groups.dcSignature).toBe("Signed");
  });

  it("leaves assignment fields empty when no active assignment", () => {
    const row = mapAssetToInventoryRow(
      {
        id: "asset-2",
        asset_code: "AST-2",
        asset_name: "Spare",
        operational_status: "READY_TO_MOVE",
        status: "active",
        branch_id: "br-1",
      },
      {
        branchLabels: { "br-1": "Noida" },
        departmentLabels: {},
        categoryLabels: {},
        locationLabels: {},
        assignmentsByAssetId: new Map(),
        employeeLookup: {},
      },
    );
    expect(row.currentHolder).toBe("—");
    expect(row.employeeId).toBe("—");
    expect(row.issueDate).toBe("—");
    expect(row.expandable.phoneNumber).toBe("—");
    expect(row.activeAssignmentId).toBeNull();
    expect(row.assignmentAllocationType).toBeNull();
  });
});
