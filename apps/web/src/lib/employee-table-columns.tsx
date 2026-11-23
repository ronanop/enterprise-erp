import type { ReactNode } from "react";

import { HrStatusBadge } from "@/components/hr/hr-primitives";
import {
  formatEmploymentTypeLabel,
  formatRelationshipLabel,
} from "@/config/hr-master-options";
import type { EmployeeTableColumnKey } from "@/hooks/use-employee-table-prefs";
import type { EmployeeRecord } from "@/types/employee-management";

/** Prefer employee-code prefix when company_id is mis-tagged (common CT* → wrong entity). */
export function entityFromEmployeeCode(employeeCode?: string | null): string {
  const code = String(employeeCode ?? "").trim().toUpperCase();
  if (!code) return "";
  if (code.startsWith("CDPL") || code.startsWith("VPL")) return "Cache Digitech";
  if (/^CT\d/i.test(code)) return "Cache Technologies";
  return "";
}

export function excelEntityCell(row: EmployeeRecord): string {
  const fromCode = entityFromEmployeeCode(row.employeeCode);
  if (fromCode) return fromCode;
  const raw =
    row.extension.employment.entityName?.trim() ||
    row.companyName?.trim() ||
    "";
  const blob = raw.toLowerCase();
  if (blob.includes("digitech")) return "Cache Digitech";
  if (blob.includes("technolog")) return "Cache Technologies";
  return raw || "-";
}

/** Normalized compare for entity filter (Cache Digitech ≈ Digitech Private Limited). */
export function entityLabelsMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  const digitech = (s: string) => s.includes("digitech");
  const tech = (s: string) => s.includes("technolog");
  if (digitech(na) && digitech(nb)) return true;
  if (tech(na) && tech(nb)) return true;
  return na.includes(nb) || nb.includes(na);
}

/**
 * Excel Organisation = parent group under which entities sit.
 * Cache Digitech (CDPL) + Cache Technologies (CT) → Organisation "Cache".
 */
export function excelOrganisationCell(row: EmployeeRecord): string {
  const fromCode = entityFromEmployeeCode(row.employeeCode);
  if (fromCode === "Cache Digitech" || fromCode === "Cache Technologies") return "Cache";
  const entity = row.extension.employment.entityName?.trim() || "";
  const company = row.companyName?.trim() || "";
  const blob = `${entity} ${company}`.toLowerCase();
  if (blob.includes("digitech") || blob.includes("technolog") || /\bcache\b/.test(blob)) {
    return "Cache";
  }
  if (blob.includes("vyuha")) return company || entity || "-";
  return company || row.branchName?.trim() || "-";
}

function dash(value?: string | null): string {
  const v = (value ?? "").trim();
  return v || "-";
}

function genderLabel(row: EmployeeRecord): string {
  return dash(row.gender || row.extension.personal.gender);
}

function lifecycleLabel(status: EmployeeRecord["lifecycleStatus"]): string {
  if (status === "onboarding") return "Pending Join";
  if (status === "resigned") return "Resigned";
  if (status === "inactive") return "Ex Employee";
  if (status === "notice") return "Notice Period";
  return status;
}

export function renderEmployeeCell(key: EmployeeTableColumnKey, row: EmployeeRecord): ReactNode {
  switch (key) {
    case "employeeCode":
      return <span className="font-mono text-xs text-muted-foreground">{row.employeeCode}</span>;
    case "name":
      return dash(row.displayName);
    case "entity":
      return excelEntityCell(row);
    case "organisation":
      return excelOrganisationCell(row);
    case "branch":
      return dash(row.branchName || row.extension.employment.branchName);
    case "location":
      return row.locationName && row.locationName !== "-"
        ? row.locationName
        : dash(row.extension.employment.location);
    case "designation":
      return dash(row.designationName || row.extension.employment.designationName);
    case "department":
      return dash(row.departmentName || row.extension.employment.departmentName);
    case "reportingManager":
      return dash(
        row.reportingManagerName && row.reportingManagerName !== "-"
          ? row.reportingManagerName
          : row.extension.employment.reportingManagerName,
      );
    case "employmentType":
      return formatEmploymentTypeLabel(row.employmentType || row.extension.employment.employmentType);
    case "gender":
      return genderLabel(row);
    case "email":
      return dash(row.officialEmail || row.extension.personal.officialEmail);
    case "personalEmail":
      return dash(row.extension.personal.personalEmail);
    case "phone":
      return dash(row.mobile || row.extension.personal.mobile);
    case "fatherName":
      return dash(row.extension.personal.fatherName);
    case "emergencyName":
      return dash(row.extension.personal.emergency?.name);
    case "emergencyRelation":
      return dash(
        formatRelationshipLabel(row.extension.personal.emergency?.relationship),
      );
    case "emergencyPhone":
      return dash(row.extension.personal.emergency?.phone);
    case "esi": {
      const esic = row.extension.governmentIds?.esic?.trim();
      if (esic) return esic;
      return row.extension.salary?.esi ? "Yes" : "No";
    }
    case "grade":
      return dash(row.extension.employment.grade);
    case "jobLevel":
      return dash(row.extension.employment.jobLevel);
    case "shift":
      return dash(row.extension.employment.shiftName);
    case "legalEntity":
      return dash(row.extension.employment.entityName || row.companyName);
    case "managementGroup":
      return dash(row.extension.employment.managementGroupName);
    case "leavePolicy":
      return dash(row.extension.employment.leavePolicyName);
    case "dob":
      return dash(row.extension.personal.dateOfBirth);
    case "maritalStatus":
      return dash(row.extension.personal.maritalStatus);
    case "joiningDate":
      return dash(row.joiningDate || row.extension.employment.joiningDate);
    case "confirmationDate":
      return dash(row.extension.employment.confirmationDate);
    case "status":
      return <HrStatusBadge status={lifecycleLabel(row.lifecycleStatus)} />;
    default: {
      const _exhaustive: never = key;
      void _exhaustive;
      return "-";
    }
  }
}

/** Header labels that keep Excel-style casing. */
export const EXACT_CASE_HEADER_COLUMNS = new Set<EmployeeTableColumnKey>([
  "employeeCode",
  "name",
  "entity",
  "organisation",
  "branch",
  "location",
  "designation",
  "department",
  "reportingManager",
  "phone",
  "personalEmail",
  "email",
  "fatherName",
  "emergencyName",
  "emergencyRelation",
  "emergencyPhone",
  "esi",
  "gender",
  "dob",
  "joiningDate",
  "status",
]);
