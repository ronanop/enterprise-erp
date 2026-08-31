/** Shared rules for “reporting manager” picklists (not all employees). */

export type EmployeeMasterRow = {
  id?: string | number;
  employee_code?: string;
  first_name?: string;
  last_name?: string;
  designation?: string;
  job_title?: string;
  display_name?: string;
  reporting_manager_id?: string | number | null;
  is_deleted?: boolean;
  status?: string;
};

function employeeLabel(r: EmployeeMasterRow): string {
  const name =
    [r.first_name, r.last_name].filter(Boolean).join(" ").trim() ||
    String(r.display_name ?? "").trim();
  const code = String(r.employee_code ?? "").trim();
  return name ? `${name}${code ? ` (${code})` : ""}` : code || String(r.id ?? "");
}

function looksLikeManagerRole(row: EmployeeMasterRow): boolean {
  const code = String(row.employee_code ?? "");
  const title = String(row.designation ?? row.job_title ?? row.display_name ?? "").toLowerCase();
  if (/^mgr[-_]/i.test(code) || /\bMGR[-_]/i.test(code)) return true;
  return (
    title.includes("manager") ||
    title.includes("lead") ||
    title.includes("head") ||
    title.includes("director")
  );
}

export function buildReportingManagerOptions(
  rows: EmployeeMasterRow[],
  opts?: { includeIds?: string[] },
): { id: string; label: string }[] {
  const include = new Set((opts?.includeIds ?? []).filter(Boolean).map(String));
  const referencedManagerIds = new Set(
    rows.map((r) => String(r.reporting_manager_id ?? "")).filter(Boolean),
  );

  const options = rows
    .filter((r) => {
      const id = String(r.id ?? "");
      if (!id) return false;
      if (r.is_deleted) return false;
      const status = String(r.status ?? "active").toLowerCase();
      if (status === "deleted" || status === "archived") return false;
      if (include.has(id)) return true;
      if (referencedManagerIds.has(id)) return true;
      return looksLikeManagerRole(r);
    })
    .map((r) => ({
      id: String(r.id),
      label: employeeLabel(r),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const seen = new Set<string>();
  return options.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

export function buildEmployeeLookupOptions(
  rows: EmployeeMasterRow[],
): { id: string; label: string }[] {
  return rows
    .filter((r) => {
      const id = String(r.id ?? "");
      if (!id || r.is_deleted) return false;
      const status = String(r.status ?? "active").toLowerCase();
      return status !== "deleted" && status !== "archived";
    })
    .map((r) => ({ id: String(r.id), label: employeeLabel(r) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
