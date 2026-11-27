import type { HrActivityLogRecord } from "@/services/hr-superadmin-service";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ACTION_TITLES: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.password_reset": "Password reset requested",
  "hr.module_user.assigned": "Assigned HR access",
  "hr.module_user.revoked": "Removed HR access",
  "hr.hr_admin.nav_updated": "Updated HR menu access",
  "hr.hr_admin.access_role_updated": "Changed access role",
  "hr.hr_admin.password_reset": "Reset HR admin password",
  "hr.access_role.created": "Created access role",
  "hr.access_role.updated": "Updated access role",
  "hr.access_role.deleted": "Deleted access role",
  "hr.employee_activated": "Activated employee",
  "hr.confirmation": "Confirmed employee",
  "hr.compoff_submitted": "Submitted compensatory off",
  "hr.compoff_approved": "Approved compensatory off",
  "hr.compoff_credit": "Credited compensatory off",
  device_sync: "Synced biometric attendance",
  create: "Created record",
  update: "Updated record",
  delete: "Deleted record",
  soft_delete: "Archived record",
};

const ENTITY_TITLES: Record<string, string> = {
  sec_user: "user account",
  sec_user_org_scope: "company access",
  hr_attendance: "attendance",
  hr_biometric_device: "biometric device",
  hr_compoff_request: "compensatory off request",
  hr_employment: "employment",
  hr_leave_balance: "leave balance",
  hr_leave_type: "leave type",
  hr_designation: "designation",
  hr_training: "training",
  hr_training_request: "training request",
  master_employee: "employee",
  hr_admin_nav_access: "HR menu access",
};

const DETAIL_LABELS: Record<string, string> = {
  email: "Email",
  display_name: "Name",
  role_code: "Role code",
  role_name: "Role",
  role_id: "Role",
  device_code: "Device",
  created: "Created",
  updated: "Updated",
  skipped: "Skipped",
  logs_read: "Punches read",
  punch_count: "Punches",
  company_ids: "Companies",
  company_id: "Company",
  employee_code: "Employee ID",
  employee_name: "Employee",
  reason: "Reason",
  status: "Status",
  path: "Path",
  endpoint: "Endpoint",
  name: "Name",
  code: "Code",
};

const HIDDEN_DETAIL_KEYS = new Set([
  "by",
  "user_id",
  "actor_id",
  "tenant_id",
  "performed_by",
  "employee_id",
  "entity_id",
  "record_id",
  "id",
  "password",
  "token",
  "secret",
  "api_key",
]);

export type FormattedHrActivityLog = {
  title: string;
  typeLabel: string;
  typeClassName: string;
  actorLabel: string;
  actorHint: string | null;
  details: string[];
  technicalAction: string;
  searchText: string;
};

function humanizeToken(value: string): string {
  return value
    .replace(/[._]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function shortId(value: string): string {
  const t = value.trim();
  if (!isUuid(t)) return t;
  return `…${t.slice(-6)}`;
}

function parseSummaryPairs(summary: string): Array<{ key: string; value: string }> {
  if (!summary.trim()) return [];
  return summary
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq <= 0) return { key: "", value: part };
      return { key: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
    });
}

function formatDetailPair(key: string, value: string): string | null {
  const normalized = key.toLowerCase();
  if (!key) {
    if (!value || isUuid(value)) return null;
    return value;
  }
  if (HIDDEN_DETAIL_KEYS.has(normalized)) return null;
  if (!value) return null;
  if (isUuid(value) && !["device_code", "email", "role_code"].includes(normalized)) {
    return null;
  }

  const label = DETAIL_LABELS[normalized] ?? humanizeToken(key);
  if (["created", "updated", "skipped", "logs_read", "punch_count"].includes(normalized)) {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      if (n === 0 && ["created", "updated", "skipped"].includes(normalized)) return null;
      return `${label}: ${n}`;
    }
  }
  if (normalized === "company_ids") {
    const count = value.split(/[|\s]+/).filter(Boolean).length || value.length;
    if (value.includes("-") && isUuid(value.split(/[|\s,]/)[0] || "")) {
      return "Company access updated";
    }
    return `${label}: ${count}`;
  }
  return `${label}: ${value.length > 48 ? `${value.slice(0, 45)}…` : value}`;
}

function fallbackDetail(action: string, entityName: string | null): string | null {
  const key = action.trim().toLowerCase();
  if (key === "auth.login") return "User signed into iConnect Plus";
  if (key === "hr.module_user.assigned") return "Employee linked as an HR module user";
  if (key === "hr.module_user.revoked") return "Employee removed from HR module access";
  if (key === "hr.access_role.created") return "New custom HR access role added";
  if (key === "hr.access_role.updated") return "Access role permissions or menu updated";
  if (key === "hr.access_role.deleted") return "Custom HR access role removed";
  if (key === "hr.hr_admin.password_reset") return "Temporary password issued";
  if (key === "update" && entityName === "sec_user_org_scope") {
    return "Company access scope changed";
  }
  if (key === "device_sync") return "Attendance pulled from biometric device";
  return null;
}

function actionTitle(action: string, entityName: string | null): string {
  const key = action.trim().toLowerCase();
  if (ACTION_TITLES[key]) {
    if (key === "device_sync" && entityName) {
      const entity = ENTITY_TITLES[entityName] ?? humanizeToken(entityName);
      return `Synced ${entity}`;
    }
    if ((key === "create" || key === "update" || key === "delete" || key === "soft_delete") && entityName) {
      const entity = ENTITY_TITLES[entityName] ?? humanizeToken(entityName);
      const verb =
        key === "create"
          ? "Created"
          : key === "update"
            ? "Updated"
            : key === "soft_delete"
              ? "Archived"
              : "Deleted";
      return `${verb} ${entity}`;
    }
    return ACTION_TITLES[key]!;
  }

  if (key.startsWith("hr.")) {
    return humanizeToken(key.replace(/^hr\./, ""));
  }
  if (entityName) {
    const entity = ENTITY_TITLES[entityName] ?? humanizeToken(entityName);
    return `${humanizeToken(action)} · ${entity}`;
  }
  return humanizeToken(action) || "Activity";
}

export function formatHrActivityLog(row: HrActivityLogRecord): FormattedHrActivityLog {
  const title = actionTitle(row.action, row.entity_name);
  const typeLabel = row.kind === "event" ? "Activity" : row.kind === "change" ? "Change" : humanizeToken(row.kind);
  const typeClassName =
    row.kind === "event"
      ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80"
      : "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";

  const details = parseSummaryPairs(row.summary)
    .map(({ key, value }) => formatDetailPair(key, value))
    .filter((line): line is string => Boolean(line))
    .slice(0, 4);

  if (!details.length && row.summary.trim() && !isUuid(row.summary.trim())) {
    const cleaned = row.summary
      .split(",")
      .map((p) => p.trim())
      .filter((p) => {
        const eq = p.indexOf("=");
        if (eq < 0) return !isUuid(p) && !HIDDEN_DETAIL_KEYS.has(p.toLowerCase());
        const k = p.slice(0, eq).trim().toLowerCase();
        const v = p.slice(eq + 1).trim();
        return !HIDDEN_DETAIL_KEYS.has(k) && !isUuid(v);
      })
      .map((p) => {
        const eq = p.indexOf("=");
        if (eq <= 0) {
          const key = p.toLowerCase();
          return DETAIL_LABELS[key] ?? humanizeToken(p);
        }
        return formatDetailPair(p.slice(0, eq).trim(), p.slice(eq + 1).trim()) ?? p;
      })
      .filter(Boolean)
      .join(" · ");
    if (cleaned) details.push(cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned);
  }

  if (!details.length) {
    const fallback = fallbackDetail(row.action, row.entity_name);
    if (fallback) details.push(fallback);
  }

  const actorLabel = row.actor_name?.trim() || (row.actor_email?.trim() ? row.actor_email : "System");
  const actorHint = row.actor_name?.trim()
    ? row.actor_email?.trim() || null
    : row.actor_name || row.actor_email
      ? null
      : "Automatic / background job";

  const technicalAction = row.entity_name ? `${row.action} · ${row.entity_name}` : row.action;

  const searchText = [
    title,
    typeLabel,
    actorLabel,
    row.actor_email ?? "",
    technicalAction,
    ...details,
    row.summary,
  ]
    .join(" ")
    .toLowerCase();

  return {
    title,
    typeLabel,
    typeClassName,
    actorLabel: row.actor_name || row.actor_email ? actorLabel : "System",
    actorHint,
    details,
    technicalAction,
    searchText,
  };
}

export function shortTechnicalId(value: string): string {
  return shortId(value);
}
