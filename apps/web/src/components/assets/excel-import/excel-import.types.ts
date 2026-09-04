/**
 * CR-004 Phase 8A — Excel import foundation types (preview & validation only).
 * No database writes.
 */

export const ACCEPTED_IMPORT_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

export type ExcelImportAcceptedExtension = (typeof ACCEPTED_IMPORT_EXTENSIONS)[number];

export type ExcelImportStep =
  | "select"
  | "parse"
  | "template"
  | "mapping"
  | "validate"
  | "preview";

export const EXCEL_IMPORT_STEPS: ExcelImportStep[] = [
  "select",
  "parse",
  "template",
  "mapping",
  "validate",
  "preview",
];

export const EXCEL_IMPORT_STEP_LABELS: Record<ExcelImportStep, string> = {
  select: "Select file",
  parse: "Parse workbook",
  template: "Validate template",
  mapping: "Map columns",
  validate: "Validate rows",
  preview: "Preview",
};

/** ERP register fields for import mapping (CR-004 ownership). */
export const EXCEL_IMPORT_TARGET_FIELDS = [
  {
    key: "assetTag",
    label: "Asset Tag",
    required: true,
    aliases: ["asset tag", "asset_tag", "tag", "asset code", "asset_code"],
  },
  {
    key: "laptopName",
    label: "Laptop Name",
    required: true,
    aliases: ["laptop name", "asset name", "asset_name", "name", "device name"],
  },
  {
    key: "branch",
    label: "Branch",
    required: true,
    aliases: ["branch", "branch name", "location branch"],
  },
  {
    key: "operationalStatus",
    label: "Operational Status",
    required: true,
    aliases: [
      "operational status",
      "ops status",
      "status",
      "excel tab",
      "bucket",
      "ready / assigned",
    ],
  },
  {
    key: "employeeId",
    label: "Employee ID",
    required: false,
    aliases: ["employee id", "employee_id", "emp id", "emp_id", "employee code"],
  },
  {
    key: "department",
    label: "Department",
    required: false,
    aliases: ["department", "dept", "department name"],
  },
  {
    key: "assetType",
    label: "Type",
    required: true,
    aliases: ["type", "asset type", "asset_type", "type name"],
  },
  {
    key: "issueDate",
    label: "Issue Date",
    required: false,
    aliases: ["issue date", "allocated_at", "allocated at", "issue_date"],
  },
  {
    key: "deliveryReference",
    label: "Delivery Reference",
    required: false,
    aliases: ["delivery reference", "delivery challan", "challan", "delivery_reference_number"],
  },
  {
    key: "deliveryStatus",
    label: "Delivery Status",
    required: false,
    aliases: ["delivery status", "delivery_reference_status", "challan status"],
  },
  {
    key: "deliverySignature",
    label: "DC Signature",
    required: false,
    aliases: [
      "dc signature",
      "delivery signature",
      "signature status",
      "delivery_challan_signature_status",
      "challan signature",
    ],
  },
  {
    key: "assignmentRemarks",
    label: "Assignment Remarks",
    required: false,
    aliases: ["assignment remarks", "remarks", "issue remarks"],
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    required: false,
    aliases: ["manufacturer", "brand"],
  },
  {
    key: "model",
    label: "Model",
    required: false,
    aliases: ["model"],
  },
  {
    key: "configuration",
    label: "Configuration",
    required: false,
    aliases: ["configuration", "config", "specs"],
  },
  {
    key: "serialNumber",
    label: "Serial Number",
    required: false,
    aliases: ["serial number", "serial", "serial_number", "s/n", "sn"],
  },
  {
    key: "lifecycleStatus",
    label: "Lifecycle Status",
    required: false,
    aliases: ["lifecycle status", "lifecycle", "asset status"],
  },
  {
    key: "location",
    label: "Location",
    required: false,
    aliases: ["location", "site"],
  },
] as const;

export type ExcelImportFieldKey = (typeof EXCEL_IMPORT_TARGET_FIELDS)[number]["key"];

export type ExcelImportFieldDef = {
  key: ExcelImportFieldKey;
  label: string;
  required: boolean;
  aliases: readonly string[];
};

export const VALID_OPERATIONAL_STATUSES = [
  "READY_TO_MOVE",
  "ASSIGNED",
  "RETIRED",
  "PENDING_DISPOSAL",
  "IN_USE_AS_COMPONENT",
] as const;

/** Human labels / Excel tab names → enum. */
export const OPERATIONAL_STATUS_ALIASES: Record<string, (typeof VALID_OPERATIONAL_STATUSES)[number]> = {
  ready_to_move: "READY_TO_MOVE",
  "ready to move": "READY_TO_MOVE",
  ready: "READY_TO_MOVE",
  assigned: "ASSIGNED",
  retired: "RETIRED",
  "not given to anyone": "RETIRED",
  pending_disposal: "PENDING_DISPOSAL",
  "pending disposal": "PENDING_DISPOSAL",
  "not working": "PENDING_DISPOSAL",
  in_use_as_component: "IN_USE_AS_COMPONENT",
  "in use as component": "IN_USE_AS_COMPONENT",
};

export const VALID_DELIVERY_STATUSES = [
  "not_applicable",
  "pending",
  "issued",
  "received",
] as const;

export const DELIVERY_STATUS_ALIASES: Record<string, (typeof VALID_DELIVERY_STATUSES)[number]> = {
  not_applicable: "not_applicable",
  "not applicable": "not_applicable",
  "n/a": "not_applicable",
  "n a": "not_applicable",
  na: "not_applicable",
  pending: "pending",
  issued: "issued",
  received: "received",
};

export const VALID_DC_SIGNATURE_STATUSES = ["not_signed", "signed"] as const;

export const DC_SIGNATURE_STATUS_ALIASES: Record<
  string,
  (typeof VALID_DC_SIGNATURE_STATUSES)[number]
> = {
  not_signed: "not_signed",
  "not signed": "not_signed",
  unsigned: "not_signed",
  signed: "signed",
};

export type ExcelImportIssueSeverity = "error" | "warning";

export type ExcelImportIssueCode =
  | "unsupported_format"
  | "empty_workbook"
  | "missing_required_column"
  | "duplicate_asset_tag"
  | "empty_mandatory"
  | "invalid_operational_status"
  | "invalid_branch"
  | "invalid_department"
  | "invalid_type"
  | "invalid_employee"
  | "invalid_date"
  | "invalid_delivery_status"
  | "invalid_dc_signature_status"
  | "parse_error"
  | "large_file";

export type ExcelImportIssue = {
  severity: ExcelImportIssueSeverity;
  code: ExcelImportIssueCode;
  message: string;
  rowNumber?: number;
  field?: ExcelImportFieldKey;
  value?: string;
};

export type ExcelImportColumnMapping = Partial<Record<ExcelImportFieldKey, string | null>>;

export type ExcelImportRawSheet = {
  sheetName: string;
  headers: string[];
  /** 1-based Excel row number (header is row 1). */
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
};

export type ExcelImportMappedRow = {
  rowNumber: number;
  values: Partial<Record<ExcelImportFieldKey, string>>;
};

export type ExcelImportRowStatus = "valid" | "invalid" | "warning";

export type ExcelImportPreviewRow = {
  rowNumber: number;
  status: ExcelImportRowStatus;
  values: Partial<Record<ExcelImportFieldKey, string>>;
  issues: ExcelImportIssue[];
};

export type ExcelImportMasterLookups = {
  /** Normalized label/code → id */
  branchesByLabel: Map<string, string>;
  departmentsByLabel: Map<string, string>;
  typesByLabel: Map<string, string>;
  /** employee id, code, or display fragment → id */
  employeesByKey: Map<string, string>;
};

export type ExcelImportParseResult = {
  fileName: string;
  extension: ExcelImportAcceptedExtension;
  sheet: ExcelImportRawSheet;
};

export type ExcelImportTemplateResult = {
  missingRequired: ExcelImportFieldKey[];
  suggestedMapping: ExcelImportColumnMapping;
  issues: ExcelImportIssue[];
  ok: boolean;
};

export type ExcelImportValidationSummary = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  warningCount: number;
  issues: ExcelImportIssue[];
  previewRows: ExcelImportPreviewRow[];
};

export type ExcelImportSession = {
  step: ExcelImportStep;
  fileName: string | null;
  parse: ExcelImportParseResult | null;
  mapping: ExcelImportColumnMapping;
  template: ExcelImportTemplateResult | null;
  validation: ExcelImportValidationSummary | null;
  fatalError: string | null;
};

export class ExcelImportError extends Error {
  readonly code: ExcelImportIssueCode;

  constructor(code: ExcelImportIssueCode, message: string) {
    super(message);
    this.name = "ExcelImportError";
    this.code = code;
  }
}

/** Soft limit for preview phase — warn above this. */
export const EXCEL_IMPORT_LARGE_FILE_ROW_THRESHOLD = 2000;

export const EXCEL_IMPORT_HARD_MAX_ROWS = 10000;
