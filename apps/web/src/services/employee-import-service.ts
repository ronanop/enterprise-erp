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

/**
 * Persist Excel Entity / Base Location / Reporting Manager onto local extensions
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

    setEmployeeExtension(res.employee_id, {
      ...prev,
      employment: {
        ...emptyEmployment(code),
        ...prev.employment,
        employeeCode: code,
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
      updatedBy: "Import",
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function bulkImportEmployees(
  rows: NormalizedEmployeeImportRow[],
): Promise<EmployeeImportResponse> {
  const res = await apiClient<EmployeeImportResponse>("/hr/employees/bulk-import", {
    method: "POST",
    body: { rows },
  });
  if (!res.data) throw new Error("Import returned no data");
  syncImportedExcelFieldsToExtensions(rows, res.data.results || []);
  return res.data;
}
