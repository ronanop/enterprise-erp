import { apiClient } from "@/services/api-client";
import type { NormalizedEmployeeImportRow } from "@/lib/employee-import-map";
import {
  getEmployeeExtensionsSync,
  setEmployeeExtension,
} from "@/lib/employee-extensions-store";
import {
  emptyEmployment,
  emptyPersonal,
  emptyGovernmentIds,
  emptyBank,
  emptySalary,
  type EmployeeExtension,
} from "@/types/employee-management";

export type EmployeeImportResponse = {
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
  errors: string[];
  results: Array<{
    row: number;
    employee_code: string;
    action: string;
    employee_id: string;
    company: string;
    entity?: string;
    base_location?: string;
    designation?: string;
  }>;
};

function entityDisplayName(entityRaw: string | undefined, companyName: string | undefined): string {
  const e = (entityRaw || "").trim();
  if (/technolog/i.test(e)) return "Cache Technologies";
  if (/digitech/i.test(e)) return "Cache Digitech";
  if (companyName && /technolog/i.test(companyName)) return "Cache Technologies";
  if (companyName && /digitech/i.test(companyName)) return "Cache Digitech";
  return e || companyName || "";
}

function isBlankManager(name: string | undefined): boolean {
  const n = (name || "").trim().toLowerCase();
  return !n || ["na", "n/a", "n.a", "-", "none", "nil", "null"].includes(n);
}

function baseExtension(): EmployeeExtension {
  return {
    personal: emptyPersonal(),
    employment: emptyEmployment(),
    governmentIds: emptyGovernmentIds(),
    bank: emptyBank(),
    companyBank: emptyBank(),
    salary: emptySalary(),
    documents: [],
    education: [],
    previousEmployment: [],
    createdBy: "Import",
    updatedBy: "Import",
    updatedAt: new Date().toISOString(),
  };
}

function truthyEsi(raw: string | undefined): boolean {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return false;
  if (["no", "n", "false", "0", "-", "na", "n/a"].includes(v)) return false;
  return true;
}

/**
 * Persist Excel Entity / contact / email / family fields onto local extensions
 * so the employee list shows sheet values even before every FK resolves.
 */
export function syncImportedExcelFieldsToExtensions(
  rows: NormalizedEmployeeImportRow[],
  results: EmployeeImportResponse["results"],
): void {
  if (typeof window === "undefined") return;
  const byCode = new Map(
    rows.map((r) => [String(r.employee_code || "").trim().toUpperCase(), r]),
  );
  const existing = getEmployeeExtensionsSync();

  for (const res of results) {
    const code = String(res.employee_code || "").trim().toUpperCase();
    const excel = byCode.get(code);
    if (!excel || !res.employee_id) continue;

    const prev = existing[res.employee_id] ?? baseExtension();
    const location = String(excel.base_location || res.base_location || "").trim();
    const managerRaw = String(excel.reporting_manager || "").trim();
    const managerName = isBlankManager(managerRaw) ? "" : managerRaw;
    const entityName = entityDisplayName(excel.entity, res.company);
    const cacheEmail = String(excel.email || "").trim();
    const personalEmail = String(excel.personal_email || "").trim();
    const mobile = String(excel.mobile || "").trim();
    const gender = String(excel.gender || "").trim();
    const dob = String(excel.dob || "").trim();
    const joining = String(excel.joining_date || "").trim();
    const fatherName = String(excel.father_name || "").trim();
    const esiRaw = String(excel.esi || "").trim();

    setEmployeeExtension(res.employee_id, {
      ...prev,
      personal: {
        ...emptyPersonal(),
        ...prev.personal,
        mobile: mobile || prev.personal.mobile,
        officialEmail: cacheEmail || prev.personal.officialEmail,
        personalEmail: personalEmail || prev.personal.personalEmail,
        gender: gender || prev.personal.gender,
        dateOfBirth: dob || prev.personal.dateOfBirth,
        fatherName: fatherName || prev.personal.fatherName || "",
        emergency: {
          name: String(excel.emergency_name || prev.personal.emergency.name || "").trim(),
          phone: String(excel.emergency_phone || prev.personal.emergency.phone || "").trim(),
          relationship: String(
            excel.emergency_relationship || prev.personal.emergency.relationship || "",
          ).trim(),
        },
      },
      employment: {
        ...emptyEmployment(code),
        ...prev.employment,
        employeeCode: code,
        joiningDate: joining || prev.employment.joiningDate,
        entityName: entityName || prev.employment.entityName,
        entityId: /technolog/i.test(entityName)
          ? "technology"
          : /digitech/i.test(entityName)
            ? "digitech"
            : prev.employment.entityId,
        location: location || prev.employment.location,
        designationName: String(
          excel.designation || res.designation || prev.employment.designationName || "",
        ).trim(),
        departmentName: String(excel.department || prev.employment.departmentName || "").trim(),
        reportingManagerName: managerName || prev.employment.reportingManagerName || "",
      },
      governmentIds: {
        ...emptyGovernmentIds(),
        ...prev.governmentIds,
        esic:
          esiRaw && !["yes", "y", "true", "1", "no", "n", "false", "0"].includes(esiRaw.toLowerCase())
            ? esiRaw
            : prev.governmentIds.esic,
      },
      salary: {
        ...emptySalary(),
        ...prev.salary,
        esi: esiRaw ? truthyEsi(esiRaw) : prev.salary.esi,
      },
      updatedBy: "Import",
      updatedAt: new Date().toISOString(),
    });
  }
}

/** API only accepts master fields; cache email → email, Emp contact → mobile. */
function toApiImportRows(rows: NormalizedEmployeeImportRow[]) {
  return rows.map((r) => ({
    employee_code: r.employee_code,
    name: r.name,
    entity: r.entity,
    organisation: r.organisation,
    base_location: r.base_location,
    designation: r.designation,
    department: r.department,
    reporting_manager: r.reporting_manager,
    email: (r.email || r.personal_email || "").trim() || undefined,
    mobile: r.mobile,
    joining_date: r.joining_date,
  }));
}

export async function bulkImportEmployees(
  rows: NormalizedEmployeeImportRow[],
): Promise<EmployeeImportResponse> {
  const res = await apiClient<EmployeeImportResponse>("/hr/employees/bulk-import", {
    method: "POST",
    body: { rows: toApiImportRows(rows) },
  });
  if (!res.data) throw new Error("Import returned no data");
  syncImportedExcelFieldsToExtensions(rows, res.data.results || []);
  return res.data;
}

export async function clearAllEmployees(): Promise<{ deleted: number; message: string }> {
  const res = await apiClient<{ deleted: number; message: string }>("/hr/employees/clear-all", {
    method: "POST",
    body: {},
  });
  if (!res.data) throw new Error("Clear returned no data");
  return res.data;
}
