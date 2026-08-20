import type { InventoryRowViewModel } from "@/components/assets/inventory.mapper";

/**
 * Client-side demo assets + display enrichers so every Asset Register column
 * and drawer section has walkthrough data (no empty dashes).
 */

export type DemoRegisteredAsset = {
  id: string;
  asset_code: string;
  asset_name: string;
  asset_type: string;
  asset_category_id: string;
  category_name: string;
  branch_id: string;
  branch_label: string;
  serial_number?: string;
  location_label?: string;
  manufacturer: string;
  model: string;
  configuration: string;
  current_holder: string;
  employee_id: string;
  department: string;
  issue_date: string;
  operational_status: string;
  lifecycle_status: string;
  earlier_used_by: string;
  delivery_challan: string;
  delivery_status: string;
  phone_number: string;
  remarks: string;
  created_at: string;
};

const STORAGE_KEY = "erp.assets.demoRegistered";
const STATUS_OVERRIDE_KEY = "erp.assets.opsStatusOverrides";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function getOperationalStatusOverrides(): Record<string, string> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.sessionStorage.getItem(STATUS_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** IT Admin demo override — drives register badge + Issue ready list. */
export function setOperationalStatusOverride(assetId: string, status: string): void {
  if (!canUseStorage() || !assetId) return;
  const next = { ...getOperationalStatusOverrides(), [assetId]: status };
  window.sessionStorage.setItem(STATUS_OVERRIDE_KEY, JSON.stringify(next));
  // Keep demo-registered rows in sync when present.
  const demos = listDemoRegisteredAssetsRaw();
  const idx = demos.findIndex((a) => a.id === assetId);
  if (idx >= 0) {
    demos[idx] = { ...demos[idx]!, operational_status: status };
    if (status === "READY_TO_MOVE") {
      demos[idx] = {
        ...demos[idx]!,
        current_holder: "—",
        employee_id: "—",
        issue_date: "—",
      };
    } else if (status === "ASSIGNED" && demos[idx]!.current_holder === "—") {
      demos[idx] = {
        ...demos[idx]!,
        current_holder: "Priya Sharma",
        employee_id: "EMP-1042",
        issue_date: "15 Jan 2026",
        department: demos[idx]!.department || "Information Technology",
      };
    }
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(demos.filter((a) => !SEED_DEMO_REGISTER_ASSETS.some((s) => s.id === a.id))),
    );
  }
}

function listDemoRegisteredAssetsRaw(): DemoRegisteredAsset[] {
  if (!canUseStorage()) return [...SEED_DEMO_REGISTER_ASSETS];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const created = raw ? (JSON.parse(raw) as DemoRegisteredAsset[]) : [];
    const userOnly = Array.isArray(created) ? created : [];
    const seedIds = new Set(SEED_DEMO_REGISTER_ASSETS.map((a) => a.id));
    return [
      ...userOnly.filter((a) => !seedIds.has(a.id)),
      ...SEED_DEMO_REGISTER_ASSETS,
    ];
  } catch {
    return [...SEED_DEMO_REGISTER_ASSETS];
  }
}

function isBlank(value: string | undefined | null): boolean {
  const v = (value ?? "").trim();
  return !v || v === "—";
}

function guessBrand(name: string): { manufacturer: string; model: string; configuration: string } {
  const n = name.toLowerCase();
  if (n.includes("dell") || n.includes("latitude")) {
    return {
      manufacturer: "Dell",
      model: "Latitude 5540",
      configuration: "Intel i7 · 16GB RAM · 512GB SSD · Windows 11",
    };
  }
  if (n.includes("lenovo") || n.includes("thinkpad")) {
    return {
      manufacturer: "Lenovo",
      model: "ThinkPad T14",
      configuration: "Intel i5 · 16GB RAM · 256GB SSD · Windows 11",
    };
  }
  if (n.includes("hp") || n.includes("elitebook")) {
    return {
      manufacturer: "HP",
      model: "EliteBook 840",
      configuration: "Intel i7 · 32GB RAM · 1TB SSD · Windows 11",
    };
  }
  if (n.includes("mac") || n.includes("apple")) {
    return {
      manufacturer: "Apple",
      model: "MacBook Pro 14",
      configuration: "M3 Pro · 18GB RAM · 512GB SSD · macOS",
    };
  }
  if (n.includes("proj") || n.includes("projector")) {
    return {
      manufacturer: "Epson",
      model: "EB-2250U",
      configuration: "WUXGA · 5000 lumens · HDMI",
    };
  }
  if (n.includes("veh") || n.includes("car") || n.includes("van")) {
    return {
      manufacturer: "Maruti Suzuki",
      model: "Ertiga ZXI",
      configuration: "Petrol · Automatic · 7-seater",
    };
  }
  return {
    manufacturer: "Demo OEM",
    model: "Enterprise Standard",
    configuration: "Standard config · 16GB · 512GB",
  };
}

/** Built-in showcase rows so the register always has complete demo data. */
export const SEED_DEMO_REGISTER_ASSETS: DemoRegisteredAsset[] = [
  {
    id: "d1111111-1111-4111-8111-111111111111",
    asset_code: "AST-LAP-DEMO-01",
    asset_name: "Dell Latitude — Demo",
    asset_type: "fixed",
    asset_category_id: "a1111111-1111-4111-8111-111111111111",
    category_name: "IT Equipment",
    branch_id: "b1111111-1111-4111-8111-111111111111",
    branch_label: "Head Office",
    serial_number: "SN-DEMO-LAP-01",
    location_label: "Noida · Floor 3 · Bay A",
    manufacturer: "Dell",
    model: "Latitude 5540",
    configuration: "Intel i7 · 16GB RAM · 512GB SSD · Windows 11",
    current_holder: "Priya Sharma",
    employee_id: "EMP-1042",
    department: "Information Technology",
    issue_date: "15 Jan 2026",
    operational_status: "ASSIGNED",
    lifecycle_status: "active",
    earlier_used_by: "Rahul Mehta",
    delivery_challan: "DC-2026-0042",
    delivery_status: "Delivered",
    phone_number: "+91 98765 43210",
    remarks: "Primary engineering laptop",
    created_at: "2026-01-10T10:00:00.000Z",
  },
  {
    id: "d2222222-2222-4222-8222-222222222222",
    asset_code: "AST-LAP-DEMO-02",
    asset_name: "Lenovo ThinkPad — Demo",
    asset_type: "fixed",
    asset_category_id: "a1111111-1111-4111-8111-111111111111",
    category_name: "IT Equipment",
    branch_id: "b1111111-1111-4111-8111-111111111111",
    branch_label: "Head Office",
    serial_number: "SN-DEMO-LAP-02",
    location_label: "Mumbai · Floor 2 · IT Store",
    manufacturer: "Lenovo",
    model: "ThinkPad T14 Gen 4",
    configuration: "Intel i5 · 16GB RAM · 256GB SSD · Windows 11",
    current_holder: "—",
    employee_id: "—",
    department: "Information Technology",
    issue_date: "—",
    operational_status: "READY_TO_MOVE",
    lifecycle_status: "active",
    earlier_used_by: "—",
    delivery_challan: "DC-2026-0088",
    delivery_status: "In store",
    phone_number: "—",
    remarks: "Ready for next allocation",
    created_at: "2026-02-01T10:00:00.000Z",
  },
  {
    id: "d4444444-4444-4444-8444-444444444444",
    asset_code: "AST-LAP-DEMO-03",
    asset_name: "HP EliteBook — Demo",
    asset_type: "fixed",
    asset_category_id: "a1111111-1111-4111-8111-111111111111",
    category_name: "IT Equipment",
    branch_id: "b1111111-1111-4111-8111-111111111111",
    branch_label: "Head Office",
    serial_number: "SN-DEMO-LAP-03",
    location_label: "Noida · IT Cage",
    manufacturer: "HP",
    model: "EliteBook 840 G10",
    configuration: "Intel i7 · 32GB RAM · 1TB SSD · Windows 11",
    current_holder: "—",
    employee_id: "—",
    department: "Information Technology",
    issue_date: "—",
    operational_status: "READY_TO_MOVE",
    lifecycle_status: "active",
    earlier_used_by: "—",
    delivery_challan: "DC-2026-0099",
    delivery_status: "In store",
    phone_number: "—",
    remarks: "Spare pool — ready to issue",
    created_at: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "d3333333-3333-4333-8333-333333333333",
    asset_code: "AST-PROJ-DEMO-01",
    asset_name: "Epson Projector — Demo",
    asset_type: "fixed",
    asset_category_id: "a1111111-1111-4111-8111-111111111111",
    category_name: "IT Equipment",
    branch_id: "b2222222-2222-4222-8222-222222222222",
    branch_label: "Mumbai Branch",
    serial_number: "SN-DEMO-PROJ-01",
    location_label: "Mumbai · Conference Room 2",
    manufacturer: "Epson",
    model: "EB-2250U",
    configuration: "WUXGA · 5000 lumens · HDMI · Wireless",
    current_holder: "Facilities Desk",
    employee_id: "EMP-2201",
    department: "Facilities",
    issue_date: "02 Mar 2026",
    operational_status: "ASSIGNED",
    lifecycle_status: "active",
    earlier_used_by: "Events Team",
    delivery_challan: "DC-2026-0110",
    delivery_status: "Delivered",
    phone_number: "+91 91234 56789",
    remarks: "AV pool asset",
    created_at: "2026-02-20T10:00:00.000Z",
  },
];

export function listDemoRegisteredAssets(): DemoRegisteredAsset[] {
  const includeSeed = process.env.NODE_ENV !== "test";
  const overrides = getOperationalStatusOverrides();
  const applyOverride = (asset: DemoRegisteredAsset): DemoRegisteredAsset => {
    const nextStatus = overrides[asset.id];
    if (!nextStatus) return asset;
    return { ...asset, operational_status: nextStatus };
  };

  if (!canUseStorage()) {
    return includeSeed ? SEED_DEMO_REGISTER_ASSETS.map(applyOverride) : [];
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const userCreated = raw ? (JSON.parse(raw) as DemoRegisteredAsset[]) : [];
    const created = Array.isArray(userCreated) ? userCreated : [];
    const seedIds = new Set(SEED_DEMO_REGISTER_ASSETS.map((a) => a.id));
    const userOnly = created.filter((a) => !seedIds.has(a.id)).map(applyOverride);
    return includeSeed
      ? [...userOnly, ...SEED_DEMO_REGISTER_ASSETS.map(applyOverride)]
      : userOnly;
  } catch {
    return includeSeed ? SEED_DEMO_REGISTER_ASSETS.map(applyOverride) : [];
  }
}

/** Ready-To-Move demo assets for Issue Asset picklist (never includes ASSIGNED). */
export function listDemoReadyWizardAssets(): Array<{
  id: string;
  label: string;
  code: string;
  operationalStatus: string;
  branchLabel: string;
  branchId: string;
  serialNumber: string;
  make: string;
  model: string;
  configuration: string;
  currentLocation: string;
  earlierUsedBy: string;
}> {
  return listDemoRegisteredAssets()
    .filter((a) => String(a.operational_status).toUpperCase() === "READY_TO_MOVE")
    .map((a) => ({
      id: a.id,
      label: a.asset_name,
      code: a.asset_code,
      operationalStatus: "READY_TO_MOVE",
      branchLabel: a.branch_label || "Head Office",
      branchId: a.branch_id,
      serialNumber: a.serial_number || "—",
      make: a.manufacturer,
      model: a.model,
      configuration: a.configuration,
      currentLocation: a.location_label || a.branch_label || "Head Office",
      earlierUsedBy: a.earlier_used_by,
    }));
}


export function stashDemoRegisteredAsset(
  partial: Omit<
    DemoRegisteredAsset,
    | "manufacturer"
    | "model"
    | "configuration"
    | "current_holder"
    | "employee_id"
    | "department"
    | "issue_date"
    | "lifecycle_status"
    | "earlier_used_by"
    | "delivery_challan"
    | "delivery_status"
    | "phone_number"
    | "remarks"
  > &
    Partial<DemoRegisteredAsset>,
): void {
  if (!canUseStorage()) return;
  const guessed = guessBrand(partial.asset_name);
  const asset: DemoRegisteredAsset = {
    id: partial.id,
    asset_code: partial.asset_code,
    asset_name: partial.asset_name,
    asset_type: partial.asset_type,
    asset_category_id: partial.asset_category_id,
    category_name: partial.category_name,
    branch_id: partial.branch_id,
    branch_label: partial.branch_label,
    serial_number: partial.serial_number,
    location_label: partial.location_label,
    operational_status: partial.operational_status,
    created_at: partial.created_at,
    manufacturer: partial.manufacturer ?? guessed.manufacturer,
    model: partial.model ?? guessed.model,
    configuration: partial.configuration ?? guessed.configuration,
    current_holder: partial.current_holder ?? "—",
    employee_id: partial.employee_id ?? "—",
    department: partial.department ?? partial.category_name ?? "Information Technology",
    issue_date: partial.issue_date ?? "—",
    lifecycle_status: partial.lifecycle_status ?? "active",
    earlier_used_by: partial.earlier_used_by ?? "Rahul Mehta",
    delivery_challan: partial.delivery_challan ?? `DC-${partial.asset_code}`,
    delivery_status: partial.delivery_status ?? "Registered",
    phone_number: partial.phone_number ?? "—",
    remarks: partial.remarks ?? "Demo registration",
  };
  const existing = listDemoRegisteredAssets()
    .filter((a) => !SEED_DEMO_REGISTER_ASSETS.some((s) => s.id === a.id))
    .filter((a) => a.id !== asset.id);
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([asset, ...existing]));
}

export function mapDemoRegisteredToInventoryRows(
  demos: DemoRegisteredAsset[],
): InventoryRowViewModel[] {
  return demos.map((asset) =>
    enrichInventoryRowForDemo({
      id: asset.id,
      assetTag: asset.asset_code,
      laptopName: asset.asset_name,
      manufacturer: asset.manufacturer,
      model: asset.model,
      configuration: asset.configuration,
      currentHolder: asset.current_holder,
      employeeId: asset.employee_id,
      department: asset.department,
      branch: asset.branch_label || "Head Office",
      operationalStatus: asset.operational_status,
      lifecycleStatus: asset.lifecycle_status,
      issueDate: asset.issue_date,
      location: asset.location_label || asset.branch_label || "Head Office",
      expandable: {
        earlierUsedBy: asset.earlier_used_by,
        deliveryChallan: asset.delivery_challan,
        deliveryReferenceStatus: asset.delivery_status,
        phoneNumber: asset.phone_number,
        remarks: asset.remarks,
        assignmentRemarks: asset.remarks,
        returnRemarks: "—",
      },
      assignmentHistory:
        asset.current_holder && asset.current_holder !== "—"
          ? [
              {
                id: `${asset.id}-asg`,
                documentNumber: `ASG-${asset.asset_code}`,
                status: "active",
                assigneeLabel: asset.current_holder,
                allocatedAt: asset.issue_date,
                returnedAt: "—",
                deliveryReferenceNumber: asset.delivery_challan,
                deliveryReferenceStatus: asset.delivery_status,
                assignmentRemarks: asset.remarks,
                returnRemarks: "—",
                returnCondition: "—",
              },
            ]
          : [],
    }),
  );
}

/**
 * Fill blank register / drawer fields with demo values so walkthroughs
 * never show empty dashes for core columns.
 */
export function enrichInventoryRowForDemo(row: InventoryRowViewModel): InventoryRowViewModel {
  const overrides = getOperationalStatusOverrides();
  const overrideStatus = overrides[row.id];
  const base: InventoryRowViewModel = overrideStatus
    ? { ...row, operationalStatus: overrideStatus }
    : row;

  const guessed = guessBrand(base.laptopName || base.assetTag);
  const manufacturer = isBlank(base.manufacturer) ? guessed.manufacturer : base.manufacturer;
  const model = isBlank(base.model) ? guessed.model : base.model;
  const configuration = isBlank(base.configuration) ? guessed.configuration : base.configuration;
  const branch = isBlank(base.branch) ? "Head Office" : base.branch;
  const location = isBlank(base.location) ? branch : base.location;
  const department = isBlank(base.department) ? "Information Technology" : base.department;
  const operationalStatus = isBlank(base.operationalStatus)
    ? "READY_TO_MOVE"
    : base.operationalStatus;
  const lifecycleStatus = isBlank(base.lifecycleStatus) ? "active" : base.lifecycleStatus;

  const assigned =
    String(operationalStatus).toUpperCase().includes("ASSIGN") ||
    (!isBlank(base.currentHolder) && base.currentHolder !== "—");

  const currentHolder = isBlank(base.currentHolder)
    ? assigned
      ? "Priya Sharma"
      : "—"
    : base.currentHolder;
  const employeeId = isBlank(base.employeeId)
    ? currentHolder !== "—"
      ? "EMP-1042"
      : "—"
    : base.employeeId;
  const issueDate = isBlank(base.issueDate)
    ? currentHolder !== "—"
      ? "15 Jan 2026"
      : "—"
    : base.issueDate;

  return {
    ...base,
    manufacturer,
    model,
    configuration,
    currentHolder: String(operationalStatus).toUpperCase() === "READY_TO_MOVE" ? "—" : currentHolder,
    employeeId: String(operationalStatus).toUpperCase() === "READY_TO_MOVE" ? "—" : employeeId,
    department,
    branch,
    location,
    operationalStatus,
    lifecycleStatus,
    issueDate: String(operationalStatus).toUpperCase() === "READY_TO_MOVE" ? "—" : issueDate,
    expandable: {
      earlierUsedBy: isBlank(base.expandable.earlierUsedBy)
        ? "Rahul Mehta"
        : base.expandable.earlierUsedBy,
      deliveryChallan: isBlank(base.expandable.deliveryChallan)
        ? `DC-${base.assetTag || "DEMO"}`
        : base.expandable.deliveryChallan,
      deliveryReferenceStatus: isBlank(base.expandable.deliveryReferenceStatus)
        ? String(operationalStatus).toUpperCase() === "READY_TO_MOVE"
          ? "In store"
          : "Delivered"
        : base.expandable.deliveryReferenceStatus,
      phoneNumber: isBlank(base.expandable.phoneNumber)
        ? String(operationalStatus).toUpperCase() === "READY_TO_MOVE"
          ? "—"
          : "+91 98765 43210"
        : base.expandable.phoneNumber,
      remarks: isBlank(base.expandable.remarks) ? "Demo register data" : base.expandable.remarks,
      assignmentRemarks: isBlank(base.expandable.assignmentRemarks)
        ? "Demo allocation notes"
        : base.expandable.assignmentRemarks,
      returnRemarks: base.expandable.returnRemarks || "—",
    },
    assignmentHistory:
      base.assignmentHistory.length > 0
        ? base.assignmentHistory
        : String(operationalStatus).toUpperCase() === "READY_TO_MOVE"
          ? []
          : currentHolder !== "—"
            ? [
                {
                  id: `${base.id}-demo-asg`,
                  documentNumber: `ASG-${base.assetTag}`,
                  status: "active",
                  assigneeLabel: currentHolder,
                  allocatedAt: issueDate,
                  returnedAt: "—",
                  deliveryReferenceNumber: isBlank(base.expandable.deliveryChallan)
                    ? `DC-${base.assetTag || "DEMO"}`
                    : base.expandable.deliveryChallan,
                  deliveryReferenceStatus: "Delivered",
                  assignmentRemarks: "Demo assignment",
                  returnRemarks: "—",
                  returnCondition: "—",
                },
              ]
            : [],
  };
}
