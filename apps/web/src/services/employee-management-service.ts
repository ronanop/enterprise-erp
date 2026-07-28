import { apiClient } from "@/services/api-client";
import { resourceService } from "@/services/api-client";
import { employeeDisplayName, type HrRow } from "@/services/hr-service";
import {
  consumeEmployeeSequence,
  formatEmployeeCode,
  peekNextEmployeeSequence,
  syncSequenceFromCodes,
} from "@/config/employee-id";
import type {
  ActivityEvent,
  AuditEntry,
  EmployeeExtension,
  EmployeeListFilters,
  EmployeeRecord,
  EmployeeWizardDraft,
  PersonalInfo,
} from "@/types/employee-management";
import {
  emptyBank,
  emptyEmployment,
  emptyGovernmentIds,
  emptyPersonal,
  emptySalary,
} from "@/types/employee-management";

const EXT_KEY = "erp_employee_extensions_v1";
const ACTIVITY_KEY = "erp_employee_activity_v1";
const AUDIT_KEY = "erp_employee_audit_v1";

function nowIso(): string {
  return new Date().toISOString();
}

function actorLabel(): string {
  if (typeof window === "undefined") return "System";
  try {
    const raw = localStorage.getItem("erp_user_profile");
    if (raw) {
      const p = JSON.parse(raw) as { email?: string; full_name?: string };
      return p.full_name || p.email || "HR User";
    }
  } catch {
    /* ignore */
  }
  return "HR User";
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultExtension(partial?: Partial<EmployeeExtension>): EmployeeExtension {
  return {
    personal: partial?.personal ?? emptyPersonal(),
    employment: partial?.employment ?? emptyEmployment(),
    governmentIds: partial?.governmentIds ?? emptyGovernmentIds(),
    bank: partial?.bank ?? emptyBank(),
    salary: partial?.salary ?? emptySalary(),
    documents: partial?.documents ?? [],
    createdBy: partial?.createdBy ?? actorLabel(),
    updatedBy: partial?.updatedBy ?? actorLabel(),
    updatedAt: partial?.updatedAt ?? nowIso(),
  };
}

function loadExtensions(): Record<string, EmployeeExtension> {
  return readJson<Record<string, EmployeeExtension>>(EXT_KEY, {});
}

function saveExtension(employeeId: string, ext: EmployeeExtension): void {
  const all = loadExtensions();
  all[employeeId] = ext;
  writeJson(EXT_KEY, all);
}

function appendActivity(event: Omit<ActivityEvent, "id" | "at">): void {
  const all = readJson<ActivityEvent[]>(ACTIVITY_KEY, []);
  all.unshift({
    ...event,
    id: crypto.randomUUID(),
    at: nowIso(),
  });
  writeJson(ACTIVITY_KEY, all.slice(0, 5000));
}

function appendAudit(entry: Omit<AuditEntry, "id" | "changedAt">): void {
  const all = readJson<AuditEntry[]>(AUDIT_KEY, []);
  all.unshift({
    ...entry,
    id: crypto.randomUUID(),
    changedAt: nowIso(),
  });
  writeJson(AUDIT_KEY, all.slice(0, 10000));
}

function addressToJson(addr: PersonalInfo["currentAddress"]) {
  return {
    line1: addr.line1,
    city: addr.city,
    state: addr.state,
    country_code: addr.country.slice(0, 3).toUpperCase() || "IN",
    postal_code: addr.pincode,
  };
}

function mapLifecycle(
  masterStatus: string,
  profileStatus: string,
  extStatus: string | undefined,
): EmployeeRecord["lifecycleStatus"] {
  const s = (extStatus || profileStatus || masterStatus || "active").toLowerCase();
  if (["probation", "notice", "resigned", "archived", "inactive"].includes(s)) {
    return s as EmployeeRecord["lifecycleStatus"];
  }
  return s === "active" ? "active" : "inactive";
}

function mergeRow(
  master: HrRow,
  profile: HrRow | undefined,
  employment: HrRow | undefined,
  deptMap: Map<string, string>,
  branchMap: Map<string, string>,
  managerMap: Map<string, string>,
  ext: EmployeeExtension,
): EmployeeRecord {
  const id = String(master.id);
  const first = String(ext.personal.firstName || master.first_name || profile?.first_name || "");
  const last = String(ext.personal.lastName || master.last_name || profile?.last_name || "");
  const middle = ext.personal.middleName?.trim();
  const displayName =
    [first, middle, last].filter(Boolean).join(" ").trim() ||
    employeeDisplayName(profile ?? master);

  const departmentId = String(master.department_id ?? ext.employment.departmentId ?? "");
  const branchId = String(master.branch_id ?? ext.employment.branchId ?? profile?.branch_id ?? "");

  return {
    id,
    masterVersion: Number(master.version ?? 1),
    profileId: profile?.id ? String(profile.id) : undefined,
    profileVersion: profile?.version ? Number(profile.version) : undefined,
    employmentId: employment?.id ? String(employment.id) : undefined,
    employmentVersion: employment?.version ? Number(employment.version) : undefined,
    employeeCode: String(master.employee_code ?? ext.employment.employeeCode ?? ""),
    displayName,
    officialEmail: String(ext.personal.officialEmail || master.email || profile?.email || ""),
    mobile: String(ext.personal.mobile || master.mobile || ""),
    departmentId,
    departmentName:
      ext.employment.departmentName ||
      deptMap.get(departmentId) ||
      String(master.designation ?? "").split("·")[0] ||
      "—",
    designationName:
      ext.employment.designationName ||
      String(master.designation ?? profile?.designation ?? "—"),
    branchId,
    branchName: ext.employment.branchName || branchMap.get(branchId) || "—",
    reportingManagerId: String(master.reporting_manager_id ?? ext.employment.reportingManagerId ?? ""),
    reportingManagerName:
      ext.employment.reportingManagerName ||
      managerMap.get(String(master.reporting_manager_id ?? "")) ||
      "—",
    employmentType: String(
      employment?.employment_type ?? ext.employment.employmentType ?? "—",
    ),
    joiningDate: String(
      employment?.date_of_joining ?? master.date_of_joining ?? ext.employment.joiningDate ?? "",
    ),
    lifecycleStatus: mapLifecycle(
      String(master.status ?? ""),
      String(profile?.status ?? ""),
      ext.employment.lifecycleStatus,
    ),
    profilePhotoDataUrl: ext.personal.profilePhotoDataUrl,
    gender: String(ext.personal.gender || profile?.gender || ""),
    isDeleted: Boolean(master.is_deleted),
    extension: ext,
  };
}

export type EmployeeDirectoryOptions = {
  branches: { id: string; label: string }[];
  departments: { id: string; label: string }[];
  designations: { id: string; label: string }[];
  managers: { id: string; label: string }[];
  shifts: { id: string; label: string }[];
};

async function loadOptions(): Promise<EmployeeDirectoryOptions> {
  const [branches, departments, designations, employees, shifts] = await Promise.all([
    resourceService.list("/branches", { page_size: 200 }).catch(() => ({ data: [] })),
    resourceService.list("/departments", { page_size: 200 }).catch(() => ({ data: [] })),
    resourceService.list("/hr/designations", { page_size: 200 }).catch(() => ({ data: [] })),
    resourceService.list("/employees", { page_size: 200 }).catch(() => ({ data: [] })),
    resourceService.list("/hr/shifts", { page_size: 200 }).catch(() => ({ data: [] })),
  ]);

  const asRows = (d: unknown) =>
    (Array.isArray(d) ? d : []).filter((r): r is HrRow => !!r && typeof r === "object");

  return {
    branches: asRows(branches.data).map((r) => ({
      id: String(r.id),
      label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
    })),
    departments: asRows(departments.data).map((r) => ({
      id: String(r.id),
      label: String(r.department_name ?? r.name ?? r.department_code ?? r.id),
    })),
    designations: asRows(designations.data).map((r) => ({
      id: String(r.id),
      label: String(r.designation_name ?? r.designation_code ?? r.id),
    })),
    managers: asRows(employees.data).map((r) => ({
      id: String(r.id),
      label: `${[r.first_name, r.last_name].filter(Boolean).join(" ")} (${r.employee_code})`,
    })),
    shifts: asRows(shifts.data).map((r) => ({
      id: String(r.id),
      label: String(r.shift_name ?? r.shift_code ?? r.id),
    })),
  };
}

export async function loadEmployeeDirectory(): Promise<{
  records: EmployeeRecord[];
  options: EmployeeDirectoryOptions;
  errors: string[];
}> {
  const [masters, profiles, employment, options] = await Promise.all([
    resourceService.list("/employees", { page_size: 200, page: 1 }).catch((e) => ({ data: [], error: e })),
    resourceService.list("/hr/employee-profiles", { page_size: 200, page: 1 }).catch((e) => ({ data: [], error: e })),
    resourceService.list("/hr/employment", { page_size: 200, page: 1 }).catch((e) => ({ data: [], error: e })),
    loadOptions(),
  ]);

  const errors: string[] = [];
  if ("error" in masters && masters.error) errors.push("Could not load employees");
  if ("error" in profiles && profiles.error) errors.push("Could not load HR profiles");

  const masterRows = (Array.isArray(masters.data) ? masters.data : []) as HrRow[];
  const profileRows = (Array.isArray(profiles.data) ? profiles.data : []) as HrRow[];
  const employmentRows = (Array.isArray(employment.data) ? employment.data : []) as HrRow[];

  syncSequenceFromCodes(masterRows.map((m) => String(m.employee_code ?? "")));

  const profileByEmployee = new Map<string, HrRow>();
  for (const p of profileRows) profileByEmployee.set(String(p.employee_id), p);

  const employmentByEmployee = new Map<string, HrRow>();
  for (const e of employmentRows) {
    const key = String(e.employee_id);
    if (!employmentByEmployee.has(key)) employmentByEmployee.set(key, e);
  }

  const deptMap = new Map(options.departments.map((d) => [d.id, d.label]));
  const branchMap = new Map(options.branches.map((b) => [b.id, b.label]));
  const managerMap = new Map(options.managers.map((m) => [m.id, m.label.split(" (")[0]]));

  const extensions = loadExtensions();

  const records = masterRows
    .filter((m) => !m.is_deleted)
    .map((m) => {
      const id = String(m.id);
      const ext = extensions[id] ?? defaultExtension();
      return mergeRow(
        m,
        profileByEmployee.get(id),
        employmentByEmployee.get(id),
        deptMap,
        branchMap,
        managerMap,
        ext,
      );
    });

  // Merge onboarding-activated / locally registered employees (shared HR connector)
  const localEmployees = readJson<EmployeeRecord[]>("erp_hr_local_employees_v1", []);
  const seenIds = new Set(records.map((r) => r.id));
  const seenCodes = new Set(records.map((r) => r.employeeCode));
  for (const loc of localEmployees) {
    if (seenIds.has(loc.id) || seenCodes.has(loc.employeeCode)) continue;
    records.push(loc);
    seenIds.add(loc.id);
    seenCodes.add(loc.employeeCode);
  }

  return { records, options, errors };
}

export function filterEmployees(
  records: EmployeeRecord[],
  query: string,
  filters: EmployeeListFilters,
): EmployeeRecord[] {
  const q = query.trim().toLowerCase();
  return records.filter((r) => {
    if (filters.branchId && r.branchId !== filters.branchId) return false;
    if (filters.departmentId && r.departmentId !== filters.departmentId) return false;
    if (filters.designation && r.designationName !== filters.designation) return false;
    if (filters.employmentType && r.employmentType !== filters.employmentType) return false;
    if (filters.status && r.lifecycleStatus !== filters.status) return false;
    if (filters.reportingManagerId && r.reportingManagerId !== filters.reportingManagerId) {
      return false;
    }
    if (filters.location && !r.extension.employment.location.includes(filters.location)) {
      return false;
    }
    if (filters.gender && r.gender !== filters.gender) return false;
    if (filters.joiningFrom && r.joiningDate && r.joiningDate < filters.joiningFrom) return false;
    if (filters.joiningTo && r.joiningDate && r.joiningDate > filters.joiningTo) return false;

    if (!q) return true;
    const hay = [
      r.displayName,
      r.employeeCode,
      r.officialEmail,
      r.mobile,
      r.departmentName,
      r.designationName,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function computeEmployeeStats(records: EmployeeRecord[]) {
  const total = records.length;
  const active = records.filter((r) => r.lifecycleStatus === "active").length;
  const inactive = records.filter((r) => r.lifecycleStatus === "inactive").length;
  const probation = records.filter((r) => r.lifecycleStatus === "probation").length;
  const notice = records.filter((r) => r.lifecycleStatus === "notice").length;
  return { total, active, inactive, probation, notice };
}

export function getEmployeeById(records: EmployeeRecord[], id: string): EmployeeRecord | undefined {
  return records.find((r) => r.id === id);
}

export function listActivity(employeeId: string): ActivityEvent[] {
  return readJson<ActivityEvent[]>(ACTIVITY_KEY, []).filter((a) => a.employeeId === employeeId);
}

export function listAudit(employeeId: string): AuditEntry[] {
  return readJson<AuditEntry[]>(AUDIT_KEY, []).filter((a) => a.employeeId === employeeId);
}

export function previewNextEmployeeCode(): string {
  return formatEmployeeCode(peekNextEmployeeSequence());
}

export async function createEmployeeFromWizard(
  draft: EmployeeWizardDraft,
  options: EmployeeDirectoryOptions,
): Promise<EmployeeRecord> {
  const seq = consumeEmployeeSequence();
  const code = draft.employment.employeeCode || formatEmployeeCode(seq);

  const branchId = draft.employment.branchId || options.branches[0]?.id;
  const departmentId = draft.employment.departmentId || options.departments[0]?.id;
  if (!branchId || !departmentId) {
    throw new Error("Branch and department are required. Configure organization masters first.");
  }

  const masterRes = await apiClient<HrRow>("/employees", {
    method: "POST",
    body: {
      branch_id: branchId,
      department_id: departmentId,
      first_name: draft.personal.firstName,
      last_name: draft.personal.lastName,
      email: draft.personal.officialEmail,
      mobile: draft.personal.mobile,
      designation: draft.employment.designationName || "Employee",
      date_of_joining: draft.employment.joiningDate || new Date().toISOString().slice(0, 10),
      employee_code: code,
      reporting_manager_id: draft.employment.reportingManagerId || null,
    },
  });

  const master = masterRes.data!;
  const employeeId = String(master.id);

  await resourceService.create("/hr/employee-profiles", {
    branch_id: branchId,
    employee_id: employeeId,
    date_of_birth: draft.personal.dateOfBirth || null,
    gender: draft.personal.gender || null,
    marital_status: draft.personal.maritalStatus || null,
    nationality: draft.personal.nationality || null,
    blood_group: draft.personal.bloodGroup || null,
    emergency_contact_name: draft.personal.emergency.name || null,
    emergency_contact_mobile: draft.personal.emergency.phone || null,
    permanent_address_json: addressToJson(draft.personal.permanentAddress),
    current_address_json: addressToJson(draft.personal.currentAddress),
    status: draft.employment.lifecycleStatus === "probation" ? "probation" : "active",
  });

  await resourceService.create("/hr/employment", {
    branch_id: branchId,
    employee_id: employeeId,
    employment_type: draft.employment.employmentType,
    date_of_joining: draft.employment.joiningDate,
    probation_end_date: draft.employment.probationPeriodDays
      ? addDays(draft.employment.joiningDate, Number(draft.employment.probationPeriodDays))
      : null,
    confirmation_date: draft.employment.confirmationDate || null,
    ctc_amount: draft.salary.ctc ? Number(draft.salary.ctc) : null,
    work_location_text: draft.employment.location || null,
    status: "active",
  });

  for (const doc of draft.documents) {
    await resourceService.create("/hr/employee-documents", {
      branch_id: branchId,
      employee_id: employeeId,
      document_type: doc.documentType,
      document_number: doc.documentNumber,
      issue_date: doc.issueDate || null,
      expiry_date: doc.expiryDate || null,
      storage_uri: doc.fileName ? `local://${doc.fileName}` : null,
      status: "active",
    }).catch(() => undefined);
  }

  const ext: EmployeeExtension = {
    personal: { ...draft.personal, officialEmail: draft.personal.officialEmail },
    employment: {
      ...draft.employment,
      employeeCode: code,
      branchName: options.branches.find((b) => b.id === branchId)?.label ?? "",
      departmentName: options.departments.find((d) => d.id === departmentId)?.label ?? "",
    },
    governmentIds: draft.governmentIds,
    bank: draft.bank,
    salary: draft.salary,
    documents: draft.documents,
    createdBy: actorLabel(),
    updatedBy: actorLabel(),
    updatedAt: nowIso(),
  };
  saveExtension(employeeId, ext);

  appendActivity({
    employeeId,
    type: "created",
    title: "Employee created",
    detail: `${ext.personal.firstName} ${ext.personal.lastName} (${code})`,
    actor: actorLabel(),
  });

  const { records } = await loadEmployeeDirectory();
  const created = getEmployeeById(records, employeeId);
  if (!created) throw new Error("Employee created but could not reload directory");
  return created;
}

function addDays(isoDate: string, days: number): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function updateEmployeeRecord(
  record: EmployeeRecord,
  patch: Partial<EmployeeWizardDraft>,
): Promise<void> {
  const nextExt: EmployeeExtension = {
    ...record.extension,
    personal: patch.personal ? { ...record.extension.personal, ...patch.personal } : record.extension.personal,
    employment: patch.employment
      ? { ...record.extension.employment, ...patch.employment }
      : record.extension.employment,
    governmentIds: patch.governmentIds
      ? { ...record.extension.governmentIds, ...patch.governmentIds }
      : record.extension.governmentIds,
    bank: patch.bank ? { ...record.extension.bank, ...patch.bank } : record.extension.bank,
    salary: patch.salary ? { ...record.extension.salary, ...patch.salary } : record.extension.salary,
    documents: patch.documents ?? record.extension.documents,
    updatedBy: actorLabel(),
    updatedAt: nowIso(),
  };

  const auditFields: (keyof EmployeeWizardDraft)[] = [
    "personal",
    "employment",
    "governmentIds",
    "bank",
    "salary",
  ];
  for (const field of auditFields) {
    if (patch[field]) {
      appendAudit({
        employeeId: record.id,
        field,
        oldValue: JSON.stringify(record.extension[field]),
        newValue: JSON.stringify(nextExt[field]),
        changedBy: actorLabel(),
      });
    }
  }

  saveExtension(record.id, nextExt);

  await apiClient<HrRow>(`/employees/${record.id}`, {
    method: "PUT",
    body: {
      version: record.masterVersion,
      first_name: nextExt.personal.firstName,
      last_name: nextExt.personal.lastName,
      email: nextExt.personal.officialEmail,
      mobile: nextExt.personal.mobile,
      designation: nextExt.employment.designationName,
      date_of_joining: nextExt.employment.joiningDate || undefined,
      branch_id: nextExt.employment.branchId || record.branchId,
      department_id: nextExt.employment.departmentId || record.departmentId,
      reporting_manager_id: nextExt.employment.reportingManagerId || null,
      status:
        nextExt.employment.lifecycleStatus === "archived"
          ? "archived"
          : nextExt.employment.lifecycleStatus,
    },
  });

  if (record.profileId) {
    await resourceService.update("/hr/employee-profiles", record.profileId, {
      version: record.profileVersion,
      date_of_birth: nextExt.personal.dateOfBirth || null,
      gender: nextExt.personal.gender || null,
      marital_status: nextExt.personal.maritalStatus || null,
      nationality: nextExt.personal.nationality || null,
      blood_group: nextExt.personal.bloodGroup || null,
      emergency_contact_name: nextExt.personal.emergency.name || null,
      emergency_contact_mobile: nextExt.personal.emergency.phone || null,
      permanent_address_json: addressToJson(nextExt.personal.permanentAddress),
      current_address_json: addressToJson(nextExt.personal.currentAddress),
      status: nextExt.employment.lifecycleStatus,
    }).catch(() => undefined);
  }

  appendActivity({
    employeeId: record.id,
    type: "updated",
    title: "Employee profile updated",
    actor: actorLabel(),
  });
}

export async function setEmployeeLifecycleStatus(
  record: EmployeeRecord,
  status: EmployeeRecord["lifecycleStatus"],
  activityTitle: string,
): Promise<void> {
  const ext = {
    ...record.extension,
    employment: { ...record.extension.employment, lifecycleStatus: status },
    updatedBy: actorLabel(),
    updatedAt: nowIso(),
  };
  saveExtension(record.id, ext);

  await apiClient<HrRow>(`/employees/${record.id}`, {
    method: "PUT",
    body: {
      version: record.masterVersion,
      status: status === "archived" ? "archived" : status,
    },
  });

  appendActivity({
    employeeId: record.id,
    type: "status",
    title: activityTitle,
    detail: status,
    actor: actorLabel(),
  });
}

export async function bulkUpdateEmployees(
  records: EmployeeRecord[],
  patch: Partial<EmployeeExtension["employment"]>,
): Promise<void> {
  for (const record of records) {
    await updateEmployeeRecord(record, {
      employment: { ...record.extension.employment, ...patch },
    });
  }
}

export function exportEmployeesCsv(records: EmployeeRecord[]): string {
  const headers = [
    "Employee ID",
    "Name",
    "Email",
    "Mobile",
    "Department",
    "Designation",
    "Branch",
    "Manager",
    "Employment Type",
    "Joining Date",
    "Status",
  ];
  const lines = records.map((r) =>
    [
      r.employeeCode,
      r.displayName,
      r.officialEmail,
      r.mobile,
      r.departmentName,
      r.designationName,
      r.branchName,
      r.reportingManagerName,
      r.employmentType,
      r.joiningDate,
      r.lifecycleStatus,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOC_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export function uniquenessSnapshot(records: EmployeeRecord[]) {
  return records.map((r) => ({
    id: r.id,
    employeeCode: r.employeeCode,
    officialEmail: r.officialEmail,
    mobile: r.mobile,
    pan: r.extension.governmentIds.pan,
    aadhaar: r.extension.governmentIds.aadhaar,
  }));
}
