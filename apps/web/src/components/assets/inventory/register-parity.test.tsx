/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdditionalInfoSection } from "@/components/assets/inventory/interaction/drawer-sections/additional-info-section";
import { AssignmentHistorySection } from "@/components/assets/inventory/interaction/drawer-sections/assignment-history-section";
import { AssignmentSection } from "@/components/assets/inventory/interaction/drawer-sections/assignment-section";
import { AssetDetailDrawer } from "@/components/assets/inventory/interaction/asset-detail-drawer";
import { mapInventoryRowToDrawerData } from "@/components/assets/inventory/interaction/inventory-drawer.mapper";
import {
  mapAssetToInventoryRow,
  type InventoryRowViewModel,
} from "@/components/assets/inventory.mapper";
import {
  REGISTER_PARITY_FIELDS,
  assertRegisterParityCoverage,
  buildRegisterParityExpandable,
  deriveEarlierUsedBy,
  formatDeliveryChallanDisplay,
  formatDeliveryChallanSignatureStatus,
  formatDeliveryChallanSummary,
  formatDeliveryReferenceStatus,
  formatAssignmentRemarksDisplay,
  formatIssuedDate,
  groupAssignmentsByAssetId,
  mapAssignmentHistoryEntries,
  pickLatestReturnedAssignment,
  pickRegisterAssignment,
  resolveAssigneeLabel,
  resolveEmployeeCode,
  resolveEmployeeMobile,
} from "@/components/assets/inventory/register-parity";

afterEach(() => cleanup());

const employeeLabels = {
  "emp-old": "Priya Sharma (EMP-004)",
  "emp-new": "Asha Nair (EMP-001)",
};

const employeeLookup = {
  "emp-old": {
    label: "Priya Sharma (EMP-004)",
    displayName: "Priya Sharma",
    employeeCode: "EMP-004",
    mobile: "9876543210",
  },
  "emp-new": {
    label: "Asha Nair (EMP-001)",
    displayName: "Asha Nair",
    employeeCode: "EMP-001",
    mobile: "9123456789",
  },
  "emp-blank-phone": {
    label: "No Phone (EMP-009)",
    displayName: "No Phone",
    employeeCode: "EMP-009",
    mobile: "   ",
  },
};

const historyWithReturnAndActive = [
  {
    id: "asn-old",
    asset_id: "asset-1",
    document_number: "AASN-1",
    status: "returned",
    employee_id: "emp-old",
    allocated_at: "2025-01-01T00:00:00Z",
    returned_at: "2025-06-01T00:00:00Z",
    delivery_reference_number: "DR-OLD",
    delivery_reference_status: "received",
    assignment_remarks: "first issue",
    return_remarks: "screen scratch",
  },
  {
    id: "asn-new",
    asset_id: "asset-1",
    document_number: "AASN-2",
    status: "active",
    employee_id: "emp-new",
    allocated_at: "2026-01-01T00:00:00Z",
    delivery_reference_number: "DR-42",
    delivery_reference_status: "issued",
    delivery_challan_signature_status: "signed",
    assignment_remarks: "[Issued: Keyboard] Handle carefully",
    return_remarks: null,
  },
];

describe("REGISTER_PARITY_FIELDS mapping", () => {
  it("lists every Excel register column", () => {
    expect(REGISTER_PARITY_FIELDS.length).toBeGreaterThanOrEqual(14);
    const excel = REGISTER_PARITY_FIELDS.map((f) => f.excel);
    expect(excel).toContain("Earlier Used By");
    expect(excel).toContain("Delivery Challan / Reference");
    expect(excel).toContain("Remarks (issue)");
    expect(excel).toContain("Return Remarks");
  });

  it("assertRegisterParityCoverage reports missing keys", () => {
    const { missing, covered } = assertRegisterParityCoverage(
      new Set(["assetTag", "laptopName", "expandable.earlierUsedBy"]),
    );
    expect(covered).toContain("Asset Tag");
    expect(missing).toContain("Brand");
  });

  it("assertRegisterParityCoverage passes when all keys present", () => {
    const keys = new Set(REGISTER_PARITY_FIELDS.map((f) => f.inventoryKey));
    const { missing } = assertRegisterParityCoverage(keys);
    expect(missing).toEqual([]);
  });
});

describe("delivery reference formatting", () => {
  it("formats known statuses", () => {
    expect(formatDeliveryReferenceStatus("pending")).toBe("Pending");
    expect(formatDeliveryReferenceStatus("issued")).toBe("Issued");
    expect(formatDeliveryReferenceStatus("received")).toBe("Received");
    expect(formatDeliveryReferenceStatus("not_applicable")).toBe("Not applicable");
  });

  it("returns dash for empty status", () => {
    expect(formatDeliveryReferenceStatus(null)).toBe("—");
    expect(formatDeliveryReferenceStatus("")).toBe("—");
  });

  it("prefers number in challan display", () => {
    expect(formatDeliveryChallanDisplay("DR-9", "issued")).toBe("DR-9");
  });

  it("shows N/A when not applicable and no number", () => {
    expect(formatDeliveryChallanDisplay(null, "not_applicable")).toBe("N/A");
  });

  it("falls back to status label when number missing", () => {
    expect(formatDeliveryChallanDisplay("", "pending")).toBe("Pending");
  });

  it("formats signature statuses and defaults missing to Not Signed", () => {
    expect(formatDeliveryChallanSignatureStatus("signed")).toBe("Signed");
    expect(formatDeliveryChallanSignatureStatus("not_signed")).toBe("Not Signed");
    expect(formatDeliveryChallanSignatureStatus(null)).toBe("Not Signed");
  });

  it("builds compact DC summary", () => {
    expect(formatDeliveryChallanSummary("DC-1", "issued", "signed")).toBe(
      "DC-1 · Issued · Signed",
    );
    expect(formatDeliveryChallanSummary("DC-2", "pending", null)).toBe(
      "DC-2 · Pending · Not Signed",
    );
  });
});

describe("assignment remarks display", () => {
  it("strips issued-items prefix", () => {
    expect(formatAssignmentRemarksDisplay("[Issued: Keyboard] Note")).toBe("Note");
  });

  it("returns dash for blank", () => {
    expect(formatAssignmentRemarksDisplay("  ")).toBe("—");
    expect(formatAssignmentRemarksDisplay(null)).toBe("—");
  });

  it("keeps plain remarks", () => {
    expect(formatAssignmentRemarksDisplay("Handle carefully")).toBe("Handle carefully");
  });
});

describe("resolveAssigneeLabel", () => {
  it("prefers assignee_label", () => {
    expect(
      resolveAssigneeLabel({ assignee_label: "Bob", employee_id: "emp-old" }, employeeLabels),
    ).toBe("Bob");
  });

  it("uses employeeLabels map", () => {
    expect(resolveAssigneeLabel({ employee_id: "emp-old" }, employeeLabels)).toBe(
      "Priya Sharma (EMP-004)",
    );
  });

  it("falls back to employee id", () => {
    expect(resolveAssigneeLabel({ employee_id: "emp-x" }, {})).toBe("emp-x");
  });

  it("returns dash when empty", () => {
    expect(resolveAssigneeLabel(null, {})).toBe("—");
    expect(resolveAssigneeLabel({}, {})).toBe("—");
  });
});

describe("deriveEarlierUsedBy", () => {
  it("returns prior returned assignee when active exists", () => {
    expect(deriveEarlierUsedBy(historyWithReturnAndActive, employeeLabels)).toBe(
      "Priya Sharma (EMP-004)",
    );
  });

  it("returns dash when no returned history", () => {
    expect(
      deriveEarlierUsedBy(
        [{ id: "1", status: "active", employee_id: "emp-new" }],
        employeeLabels,
      ),
    ).toBe("—");
  });

  it("uses most recent returned when multiple", () => {
    const label = deriveEarlierUsedBy(
      [
        {
          id: "a",
          status: "returned",
          employee_id: "emp-old",
          returned_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "b",
          status: "returned",
          employee_id: "emp-new",
          returned_at: "2025-01-01T00:00:00Z",
        },
      ],
      employeeLabels,
    );
    expect(label).toBe("Asha Nair (EMP-001)");
  });

  it("ignores cancelled rows", () => {
    expect(
      deriveEarlierUsedBy(
        [{ id: "c", status: "cancelled", employee_id: "emp-old" }],
        employeeLabels,
      ),
    ).toBe("—");
  });
});

describe("pickRegisterAssignment / pickLatestReturned", () => {
  it("prefers active", () => {
    expect(pickRegisterAssignment(historyWithReturnAndActive)?.id).toBe("asn-new");
  });

  it("falls back to latest completed", () => {
    expect(
      pickRegisterAssignment([
        {
          id: "r1",
          status: "returned",
          returned_at: "2026-02-01T00:00:00Z",
        },
        {
          id: "r0",
          status: "returned",
          returned_at: "2025-02-01T00:00:00Z",
        },
      ])?.id,
    ).toBe("r1");
  });

  it("skips draft and cancelled", () => {
    expect(
      pickRegisterAssignment([
        { id: "d", status: "draft" },
        { id: "c", status: "cancelled" },
      ]),
    ).toBeUndefined();
  });

  it("picks latest returned", () => {
    expect(pickLatestReturnedAssignment(historyWithReturnAndActive)?.id).toBe("asn-old");
  });
});

describe("groupAssignmentsByAssetId", () => {
  it("groups by asset_id", () => {
    const map = groupAssignmentsByAssetId(historyWithReturnAndActive);
    expect(map.get("asset-1")).toHaveLength(2);
  });

  it("skips rows without asset_id", () => {
    const map = groupAssignmentsByAssetId([{ id: "x", status: "active" }]);
    expect(map.size).toBe(0);
  });
});

describe("buildRegisterParityExpandable", () => {
  it("maps earlier used by, delivery, remarks", () => {
    const exp = buildRegisterParityExpandable(historyWithReturnAndActive, employeeLabels);
    expect(exp.earlierUsedBy).toBe("Priya Sharma (EMP-004)");
    expect(exp.deliveryChallan).toBe("DR-42");
    expect(exp.deliveryReferenceStatus).toBe("Issued");
    expect(exp.deliverySignature).toBe("Signed");
    expect(exp.deliveryChallanSummary).toBe("DR-42 · Issued · Signed");
    expect(exp.assignmentRemarks).toBe("Handle carefully");
    expect(exp.returnRemarks).toBe("screen scratch");
    expect(exp.remarks).toBe("Handle carefully");
  });

  it("resolves phone from active employee mobile", () => {
    const exp = buildRegisterParityExpandable(historyWithReturnAndActive, employeeLookup);
    expect(exp.phoneNumber).toBe("9123456789");
    expect(exp.earlierUsedBy).toBe("Priya Sharma (EMP-004)");
  });

  it("phone is dash when no active assignment", () => {
    const returnedOnly = [historyWithReturnAndActive[0]];
    const exp = buildRegisterParityExpandable(returnedOnly, employeeLookup);
    expect(exp.phoneNumber).toBe("—");
    expect(exp.earlierUsedBy).toBe("Priya Sharma (EMP-004)");
  });

  it("phone is dash when mobile missing or blank", () => {
    const history = [
      {
        ...historyWithReturnAndActive[1],
        employee_id: "emp-blank-phone",
      },
    ];
    expect(buildRegisterParityExpandable(history, employeeLookup).phoneNumber).toBe("—");
    expect(buildRegisterParityExpandable(history, {}).phoneNumber).toBe("—");
  });

  it("empty history yields dashes", () => {
    const exp = buildRegisterParityExpandable([]);
    expect(exp.earlierUsedBy).toBe("—");
    expect(exp.deliveryChallan).toBe("—");
    expect(exp.assignmentRemarks).toBe("—");
    expect(exp.returnRemarks).toBe("—");
    expect(exp.phoneNumber).toBe("—");
  });
});

describe("resolveEmployeeCode / mobile / issued date", () => {
  it("resolves employee_code and mobile", () => {
    expect(resolveEmployeeCode("emp-new", employeeLookup)).toBe("EMP-001");
    expect(resolveEmployeeMobile("emp-new", employeeLookup)).toBe("9123456789");
    expect(resolveEmployeeCode("missing", employeeLookup)).toBe("—");
    expect(resolveEmployeeMobile("missing", employeeLookup)).toBe("—");
    expect(resolveEmployeeMobile(null, employeeLookup)).toBe("—");
  });

  it("formats issued date from allocated_at", () => {
    expect(formatIssuedDate("2026-01-01T00:00:00Z")).toContain("2026");
    expect(formatIssuedDate(null)).toBe("—");
    expect(formatIssuedDate("  ")).toBe("—");
  });
});

describe("mapAssignmentHistoryEntries", () => {
  it("includes return remarks in history", () => {
    const entries = mapAssignmentHistoryEntries(historyWithReturnAndActive, employeeLabels);
    expect(entries[0].id).toBe("asn-new");
    const returned = entries.find((e) => e.id === "asn-old");
    expect(returned?.returnRemarks).toBe("screen scratch");
    expect(returned?.deliveryReferenceNumber).toBe("DR-OLD");
  });

  it("empty history", () => {
    expect(mapAssignmentHistoryEntries([])).toEqual([]);
  });
});

describe("mapAssetToInventoryRow register parity", () => {
  it("fills expandable from assignment history", () => {
    const row = mapAssetToInventoryRow(
      {
        id: "asset-1",
        asset_code: "AST-1",
        asset_name: "Laptop",
        branch_id: "b1",
        operational_status: "ASSIGNED",
        status: "active",
      },
      {
        branchLabels: { b1: "Noida" },
        departmentLabels: {},
        categoryLabels: {},
        locationLabels: {},
        assignmentsByAssetId: new Map([
          ["asset-1", historyWithReturnAndActive[1] as never],
        ]),
        assignmentHistoryByAssetId: new Map([["asset-1", historyWithReturnAndActive]]),
        employeeLookup,
      },
    );
    expect(row.expandable.earlierUsedBy).toBe("Priya Sharma (EMP-004)");
    expect(row.expandable.deliveryChallan).toBe("DR-42");
    expect(row.expandable.assignmentRemarks).toBe("Handle carefully");
    expect(row.expandable.returnRemarks).toBe("screen scratch");
    expect(row.expandable.phoneNumber).toBe("9123456789");
    expect(row.employeeId).toBe("EMP-001");
    expect(row.issueDate).toContain("2026");
    expect(row.assignmentHistory.length).toBe(2);
    expect(row.currentHolder).toContain("Asha");
  });

  it("no active assignment clears assignee phone and issued date", () => {
    const row = mapAssetToInventoryRow(
      {
        id: "asset-1",
        asset_code: "AST-1",
        asset_name: "Laptop",
        operational_status: "READY_TO_MOVE",
      },
      {
        branchLabels: {},
        departmentLabels: {},
        categoryLabels: {},
        locationLabels: {},
        assignmentsByAssetId: new Map(),
        assignmentHistoryByAssetId: new Map([
          ["asset-1", [historyWithReturnAndActive[0]]],
        ]),
        employeeLookup,
      },
    );
    expect(row.currentHolder).toBe("—");
    expect(row.employeeId).toBe("—");
    expect(row.issueDate).toBe("—");
    expect(row.expandable.phoneNumber).toBe("—");
    expect(row.expandable.earlierUsedBy).toBe("Priya Sharma (EMP-004)");
  });

  it("inventory row keys cover register parity map", () => {
    const row = mapAssetToInventoryRow(
      { id: "a", asset_code: "X", asset_name: "Y", operational_status: "READY_TO_MOVE" },
      {
        branchLabels: {},
        departmentLabels: {},
        categoryLabels: {},
        locationLabels: {},
        assignmentsByAssetId: new Map(),
      },
    );
    const keys = new Set([
      "employeeId",
      "currentHolder",
      "laptopName",
      "assetTag",
      "manufacturer",
      "model",
      "configuration",
      "issueDate",
      "location",
      "expandable.earlierUsedBy",
      "expandable.deliveryChallan",
      "expandable.assignmentRemarks",
      "expandable.returnRemarks",
      "operationalStatus",
      "department",
      "expandable.phoneNumber",
    ]);
    expect(assertRegisterParityCoverage(keys).missing).toEqual([]);
    expect(row.expandable.phoneNumber).toBe("—");
  });
});

function sampleRow(overrides: Partial<InventoryRowViewModel> = {}): InventoryRowViewModel {
  return {
    id: "1",
    assetTag: "AST-9",
    laptopName: "Mac",
    serialNumber: "SN-1",
    manufacturer: "Apple",
    model: "M3",
    configuration: "16GB",
    currentHolder: "Asha Nair (EMP-001)",
    employeeId: "emp-new",
    department: "IT",
    branch: "Noida",
    operationalStatus: "ASSIGNED",
    lifecycleStatus: "active",
    issueDate: "Jan 1, 2026",
    location: "HQ",
    expandable: {
      earlierUsedBy: "Priya Sharma (EMP-004)",
      deliveryChallan: "DR-42",
      deliveryReferenceStatus: "Issued",
      phoneNumber: "—",
      remarks: "Handle carefully",
      assignmentRemarks: "Handle carefully",
      returnRemarks: "screen scratch",
    },
    assignmentHistory: [
      {
        id: "asn-old",
        documentNumber: "AASN-1",
        status: "returned",
        assigneeLabel: "Priya Sharma (EMP-004)",
        allocatedAt: "Jan 1, 2025",
        returnedAt: "Jun 1, 2025",
        deliveryReferenceNumber: "DR-OLD",
        deliveryReferenceStatus: "Received",
        assignmentRemarks: "first issue",
        returnRemarks: "screen scratch",
      },
    ],
    ...overrides,
  };
}

describe("mapInventoryRowToDrawerData register parity", () => {
  it("maps delivery and remarks into assignment + additional", () => {
    const data = mapInventoryRowToDrawerData(sampleRow());
    expect(data.assignment?.deliveryReferenceNumber).toBe("DR-42");
    expect(data.assignment?.deliveryReferenceStatus).toBe("Issued");
    expect(data.assignment?.assignmentRemarks).toBe("Handle carefully");
    expect(data.assignment?.returnRemarks).toBe("screen scratch");
    expect(data.additional?.earlierUsedBy).toBe("Priya Sharma (EMP-004)");
    expect(data.history?.[0].returnRemarks).toBe("screen scratch");
  });
});

describe("AssignmentSection register fields", () => {
  it("renders delivery reference and remarks", () => {
    render(
      <AssignmentSection
        assignment={{
          employee: "Asha",
          issueDate: "Today",
          department: "IT",
          deliveryReferenceNumber: "DR-42",
          deliveryReferenceStatus: "Issued",
          assignmentRemarks: "careful",
          returnRemarks: "ok",
        }}
      />,
    );
    expect(screen.getByTestId("drawer-delivery-reference")).toHaveTextContent("DR-42");
    expect(screen.getByTestId("drawer-delivery-status")).toHaveTextContent("Issued");
    expect(screen.getByTestId("drawer-assignment-remarks")).toHaveTextContent("careful");
    expect(screen.getByTestId("drawer-return-remarks")).toHaveTextContent("ok");
  });

  it("shows empty state when no enrichment", () => {
    render(
      <AssignmentSection assignment={{ employee: "—", issueDate: "—", department: "—" }} />,
    );
    expect(screen.getByText("No active assignment")).toBeInTheDocument();
  });

  it("shows section when only remarks present", () => {
    render(
      <AssignmentSection
        assignment={{
          employee: "—",
          issueDate: "—",
          department: "—",
          assignmentRemarks: "note",
        }}
      />,
    );
    expect(screen.queryByText("No active assignment")).not.toBeInTheDocument();
    expect(screen.getByTestId("drawer-assignment-remarks")).toHaveTextContent("note");
  });
});

describe("AdditionalInfoSection earlier used by", () => {
  it("renders earlier used by", () => {
    render(
      <AdditionalInfoSection
        additional={{
          earlierUsedBy: "Priya",
          deliveryChallan: "DR-1",
          deliveryReferenceStatus: "Received",
          remarks: "a",
          assignmentRemarks: "a",
          returnRemarks: "b",
        }}
      />,
    );
    expect(screen.getByTestId("drawer-earlier-used-by")).toHaveTextContent("Priya");
    expect(screen.getByText("Register fields")).toBeInTheDocument();
  });

  it("defaults to dashes", () => {
    render(<AdditionalInfoSection />);
    expect(screen.getByTestId("drawer-earlier-used-by")).toHaveTextContent("—");
  });
});

describe("AssignmentHistorySection", () => {
  it("empty state", () => {
    render(<AssignmentHistorySection history={[]} />);
    expect(screen.getByText("No assignment history")).toBeInTheDocument();
  });

  it("renders history with return remarks", () => {
    render(
      <AssignmentHistorySection
        history={[
          {
            id: "1",
            documentNumber: "AASN-1",
            status: "returned",
            assigneeLabel: "Priya",
            allocatedAt: "Jan 1",
            returnedAt: "Jun 1",
            deliveryReferenceNumber: "DR-OLD",
            deliveryReferenceStatus: "Received",
            assignmentRemarks: "first",
            returnRemarks: "scratch",
          },
        ]}
      />,
    );
    const section = screen.getByTestId("drawer-assignment-history");
    expect(within(section).getByText("Priya")).toBeInTheDocument();
    expect(screen.getByTestId("history-return-remarks")).toHaveTextContent("scratch");
  });
});

describe("AssetDetailDrawer register parity rendering", () => {
  const data = mapInventoryRowToDrawerData(sampleRow());

  it("renders earlier used by, delivery, remarks, history", () => {
    render(<AssetDetailDrawer open onOpenChange={() => undefined} data={data} />);
    expect(screen.getByTestId("inventory-expandable-earlier-used")).toHaveTextContent("Priya");
    expect(screen.getByTestId("inventory-expandable-dc-number")).toHaveTextContent("DR-42");
    expect(screen.getByTestId("inventory-expandable-dc-status")).toHaveTextContent("Issued");
    expect(screen.getByTestId("inventory-expandable-assignment-remarks")).toHaveTextContent(
      "Handle carefully",
    );
    expect(screen.getByTestId("inventory-expandable-return-remarks")).toHaveTextContent(
      "screen scratch",
    );
    expect(screen.getByTestId("drawer-assignment-history")).toBeInTheDocument();
    expect(screen.getByText("Assignment history")).toBeInTheDocument();
  });

  it("renders empty history section when none", () => {
    const empty = mapInventoryRowToDrawerData(sampleRow({ assignmentHistory: [] }));
    render(<AssetDetailDrawer open onOpenChange={() => undefined} data={empty} />);
    expect(screen.getByText("No assignment history")).toBeInTheDocument();
  });

  it("responsive grid classes present on assignment section", () => {
    const { container } = render(
      <AssignmentSection
        assignment={{
          employee: "Asha",
          issueDate: "Today",
          department: "IT",
          deliveryReferenceNumber: "DR",
        }}
      />,
    );
    expect(container.querySelector(".sm\\:grid-cols-2")).toBeTruthy();
  });
});
