import type { AuthSessionUser } from "@/lib/auth-user";
import type { Option } from "@/services/sales-crm-service";

/** Map signed-in user to a master_employee option (id + label). */
export function resolveSessionEmployee(
  employees: Option[],
  user: AuthSessionUser | null,
): Option | null {
  if (!user || employees.length === 0) return null;

  if (user.employeeId) {
    const linked = employees.find((row) => row.id === user.employeeId);
    if (linked) return linked;
  }

  const email = user.email.trim().toLowerCase();
  if (email) {
    const byEmail = employees.find((row) => row.email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  const display = user.displayName.trim().toLowerCase();
  if (display) {
    const byLabel = employees.find((row) => row.label.trim().toLowerCase() === display);
    if (byLabel) return byLabel;
  }

  return null;
}

export function resolveSessionEmployeeId(
  employees: Option[],
  user: AuthSessionUser | null,
): string {
  return resolveSessionEmployee(employees, user)?.id ?? "";
}

export function resolveSessionEmployeeLabel(
  employees: Option[],
  user: AuthSessionUser | null,
): string {
  const match = resolveSessionEmployee(employees, user);
  if (match) return match.label;
  return user?.displayName?.trim() || user?.email?.trim() || "";
}
