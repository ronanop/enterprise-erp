/** Static demo options for 5B-2A UI only (no API). */

export type WizardSelectOption = { id: string; label: string };

export const MOCK_EMPLOYEES: WizardSelectOption[] = [
  { id: "emp-1", label: "Priya Sharma" },
  { id: "emp-2", label: "Rahul Kumar" },
  { id: "emp-3", label: "Anita Desai" },
];

export const MOCK_ASSETS: (WizardSelectOption & {
  code: string;
  operationalStatus: string;
  branchLabel: string;
  branchId: string;
})[] = [
  {
    id: "asset-1",
    label: "Dell Latitude 7440",
    code: "LT-2024-014",
    operationalStatus: "Ready To Move",
    branchLabel: "HQ",
    branchId: "branch-hq",
  },
  {
    id: "asset-2",
    label: "Dell Latitude 5540",
    code: "LT-2024-001",
    operationalStatus: "Ready To Move",
    branchLabel: "HQ",
    branchId: "branch-hq",
  },
];

export const MOCK_ISSUED_ITEMS: (WizardSelectOption & { status: string })[] = [
  { id: "comp-1", label: "USB-C Charger 65W", status: "installed" },
  { id: "comp-2", label: "Laptop bag", status: "installed" },
  { id: "comp-3", label: "USB-C dock", status: "installed" },
];

export const MOCK_RETURN_SUMMARY = {
  assetCode: "LT-2024-014",
  assetName: "Dell Latitude 7440",
  serialNumber: "SN-DEMO-014",
  operationalStatus: "Assigned",
  documentNumber: "AASN-2026-000088",
  assigneeLabel: "Priya Sharma",
  allocatedAt: "2026-07-12",
  deliveryReferenceNumber: "DC-2026-0042",
};
