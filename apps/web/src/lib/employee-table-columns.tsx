import type { ReactNode } from "react";

import { HrStatusBadge } from "@/components/hr/hr-primitives";
import {
  formatEmploymentTypeLabel,
  formatRelationshipLabel,
} from "@/config/hr-master-options";
import type { EmployeeTableColumnKey } from "@/hooks/use-employee-table-prefs";
import type { EmployeeRecord } from "@/types/employee-management";

export function excelEntityCell(row: EmployeeRecord): string {
  return (
    row.extension.employment.entityName?.trim() ||
    row.companyName?.trim() ||
    "-"
  );
}

export function excelOrganisationCell(row: EmployeeRecord): string {
  return row.companyName?.trim() || row.branchName?.trim() || "-";
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
  if (status === "inactive") return "Ex Employee";
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
