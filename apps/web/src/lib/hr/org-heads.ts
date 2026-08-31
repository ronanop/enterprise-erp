import type { EmployeeDirectoryOptions } from "@/services/employee-management-service";

export function managerDisplayName(
  employeeId: string | undefined | null,
  managers: { id: string; label: string }[],
): string {
  if (!employeeId) return "—";
  const m = managers.find((x) => x.id === employeeId);
  if (!m) return "—";
  return m.label.split(" (")[0]?.trim() || "—";
}

export function resolveBranchHeadName(
  branchId: string,
  options: Pick<EmployeeDirectoryOptions, "branches" | "managers" | "employees">,
): string {
  const branch = options.branches.find((b) => b.id === branchId);
  const lookup = options.employees?.length ? options.employees : options.managers;
  return managerDisplayName(branch?.headEmployeeId, lookup);
}

export function resolveDepartmentHeadName(
  departmentId: string,
  options: Pick<EmployeeDirectoryOptions, "departments" | "managers" | "employees">,
): string {
  const dept = options.departments.find((d) => d.id === departmentId);
  const lookup = options.employees?.length ? options.employees : options.managers;
  return managerDisplayName(dept?.headEmployeeId, lookup);
}

export function resolveOrgHeadsForEmployment(
  branchId: string,
  departmentId: string,
  options: EmployeeDirectoryOptions,
): { branchHeadName: string; departmentHeadName: string } {
  return {
    branchHeadName: resolveBranchHeadName(branchId, options),
    departmentHeadName: resolveDepartmentHeadName(departmentId, options),
  };
}
