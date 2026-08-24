import { apiClient } from "@/services/api-client";
import { resourceService } from "@/services/api-client";
import { employeeDisplayName, type HrRow } from "@/services/hr-service";
import {
  formatEmployeeCode,
  peekNextEmployeeSequence,
  syncSequenceFromCodes,
} from "@/config/employee-id";
import {
  buildEmployeeLookupOptions,
  buildReportingManagerOptions,
  type EmployeeMasterRow,
} from "@/lib/hr/reporting-managers";
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
  ensureEmployeeExtensionsLoaded,
  getEmployeeExtensionsSync,
  setEmployeeExtension,
} from "@/lib/employee-extensions-store";
import {
  emptyBank,
  emptyEmployment,
  emptyGovernmentIds,
  emptyPersonal,
  emptySalary,
} from "@/types/employee-management";
import { profilePhotoFromExtension } from "@/lib/onboarding-to-employee";

const LOCAL_EMP_KEY = "erp_hr_local_employees_v1";

const ACTIVITY_KEY = "erp_employee_activity_v1";
const AUDIT_KEY = "erp_employee_audit_v1";

/** Classic seed / fake local-only demo employee codes. */
const DEMO_EMP_CODE_RE =
  /^(EMP-\d{3}|EMP-T\d{2}|EMP-ESS-\d+|EMP-E\d{2}|EMP-O\d{2}|MGR-ENG|MGR-SAL)$/i;

function isDemoEmployeeCode(code: string | undefined | null): boolean {
  return DEMO_EMP_CODE_RE.test(String(code || "").trim());
}

/** Drop leftover demo rows from browser local store (EMP-001…, EMP-T0x, etc.). */
function purgeLocalDemoEmployees(): void {
  if (typeof window === "undefined") return;
  const locals = readJson<EmployeeRecord[]>(LOCAL_EMP_KEY, []);
  const kept = locals.filter((r) => !isDemoEmployeeCode(r.employeeCode));
  if (kept.length !== locals.length) writeJson(LOCAL_EMP_KEY, kept);
}

function nowIso(): string {
  return new Date().toISOString();
}

function uuidOrNull(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
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
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    const quota =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.code === 22);
    if (!quota) throw err;
    if (key === AUDIT_KEY && Array.isArray(value)) {
      localStorage.setItem(key, JSON.stringify((value as unknown[]).slice(0, 500)));
      return;
    }
    if (key === ACTIVITY_KEY && Array.isArray(value)) {
      localStorage.setItem(key, JSON.stringify((value as unknown[]).slice(0, 200)));
      return;
    }
    throw err;
  }
}

function defaultExtension(partial?: Partial<EmployeeExtension>): EmployeeExtension {
  return {
    personal: partial?.personal ?? emptyPersonal(),
    employment: partial?.employment ?? emptyEmployment(),
    governmentIds: partial?.governmentIds ?? emptyGovernmentIds(),
    bank: partial?.bank ?? emptyBank(),
    companyBank: partial?.companyBank ?? emptyBank(),
    salary: partial?.salary ?? emptySalary(),
    documents: partial?.documents ?? [],
    education: partial?.education ?? [],
    previousEmployment: partial?.previousEmployment ?? [],
    createdBy: partial?.createdBy ?? actorLabel(),
    updatedBy: partial?.updatedBy ?? actorLabel(),
    updatedAt: partial?.updatedAt ?? nowIso(),
  };
}

function loadExtensions(): Record<string, EmployeeExtension> {
  return getEmployeeExtensionsSync();
}

function saveExtension(employeeId: string, ext: EmployeeExtension): void {
  setEmployeeExtension(employeeId, ext);
}

/** Map org companies to Digitech / Technologies style entity labels. */
function entityLabelForCompany(companyName: string, companyCode: string): string {
  const blob = `${companyName} ${companyCode}`.toLowerCase();
  if (blob.includes("digitech")) return "Cache Digitech";
  if (blob.includes("technolog")) return "Cache Technologies";
  return companyName || companyCode || "—";
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

function addressFromJson(raw: unknown): PersonalInfo["currentAddress"] | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const line1 = String(o.line1 ?? o.address_line1 ?? "").trim();
  if (!line1 && !String(o.city ?? "").trim()) return null;
  return {
    line1,
    line2: String(o.line2 ?? o.address_line2 ?? "").trim() || undefined,
    city: String(o.city ?? "").trim(),
    state: String(o.state ?? "").trim(),
    country: String(o.country_code ?? o.country ?? "IN").trim() || "IN",
    pincode: String(o.postal_code ?? o.pincode ?? "").trim(),
  };
}

function pickStr(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

/** Fill empty extension.personal fields from employee master + HR profile so edit forms are prefilled. */
function hydratePersonalFromMasterProfile(
  ext: EmployeeExtension,
  master: HrRow,
  profile: HrRow | undefined,
): EmployeeExtension {
  const p = ext.personal;
  const currentFromProfile = addressFromJson(profile?.current_address_json);
  const permanentFromProfile = addressFromJson(profile?.permanent_address_json);
  return {
    ...ext,
    personal: {
      ...p,
      firstName: pickStr(p.firstName, master.first_name, profile?.first_name),
      middleName: pickStr(p.middleName, master.middle_name, profile?.middle_name),
      lastName: pickStr(p.lastName, master.last_name, profile?.last_name),
      gender: pickStr(p.gender, profile?.gender, master.gender).toLowerCase(),
      dateOfBirth: toDateInput(pickStr(p.dateOfBirth, profile?.date_of_birth)),
      maritalStatus: pickStr(p.maritalStatus, profile?.marital_status).toLowerCase(),
      bloodGroup: pickStr(p.bloodGroup, profile?.blood_group),
      nationality: pickStr(p.nationality, profile?.nationality, "Indian"),
      mobile: pickStr(p.mobile, master.mobile, profile?.mobile),
      officialEmail: pickStr(p.officialEmail, master.email, profile?.email),
      personalEmail: pickStr(p.personalEmail, profile?.personal_email, profile?.alternate_email),
      currentAddress: p.currentAddress.line1.trim()
        ? p.currentAddress
        : currentFromProfile ?? p.currentAddress,
      permanentAddress: p.permanentAddress.line1.trim()
        ? p.permanentAddress
        : permanentFromProfile ?? p.permanentAddress,
      emergency: {
        name: pickStr(p.emergency.name, profile?.emergency_contact_name),
        phone: pickStr(p.emergency.phone, profile?.emergency_contact_mobile),
        relationship: pickStr(p.emergency.relationship, profile?.emergency_contact_relationship).toLowerCase(),
      },
      profilePhotoDataUrl: p.profilePhotoDataUrl,
    },
  };
}

function toDateInput(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return s.slice(0, 10);
}

function namesFromDisplay(displayName: string): { first: string; last: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

function hydratePersonalFromLocalRecord(
  ext: EmployeeExtension,
  loc: EmployeeRecord,
): EmployeeExtension {
  const p = ext.personal;
  const names = namesFromDisplay(loc.displayName);
  return {
    ...ext,
    personal: {
      ...p,
      firstName: pickStr(p.firstName, names.first),
      lastName: pickStr(p.lastName, names.last),
      gender: pickStr(p.gender, loc.gender).toLowerCase(),
      dateOfBirth: toDateInput(p.dateOfBirth),
      maritalStatus: p.maritalStatus.toLowerCase(),
      mobile: pickStr(p.mobile, loc.mobile),
      officialEmail: pickStr(p.officialEmail, loc.officialEmail),
      nationality: pickStr(p.nationality, "Indian"),
      profilePhotoDataUrl: p.profilePhotoDataUrl || loc.profilePhotoDataUrl,
    },
  };
}

function mapLifecycle(
  masterStatus: string,
  profileStatus: string,
  employmentStatus: string | undefined,
  extStatus: string | undefined,
): EmployeeRecord["lifecycleStatus"] {
  // Prefer employment row (HR source of truth), then local extension, then master/profile.
  const raw = (
    employmentStatus ||
    extStatus ||
    masterStatus ||
    profileStatus ||
    "active"
  ).toLowerCase();

  if (raw === "active" || raw === "confirmed") return "active";
  if (raw === "probation") return "probation";
  if (raw === "onboarding" || raw === "draft") return "onboarding";
  if (raw === "notice" || raw === "notice_period") return "notice";
  if (raw === "resigned") return "resigned";
  if (raw === "archived") return "archived";
  if (
    raw === "inactive" ||
    raw === "separated" ||
    raw === "ex_employee" ||
    raw === "ended" ||
    raw === "cancelled"
  ) {
    return "inactive";
  }
  return "inactive";
}

function mergeRow(
  master: HrRow,
  profile: HrRow | undefined,
  employment: HrRow | undefined,
  deptMap: Map<string, string>,
  branchMap: Map<string, string>,
  managerMap: Map<string, string>,
  companyMap: Map<string, { name: string; code: string }>,
  locationByName: Map<string, string>,
  ext: EmployeeExtension,
): EmployeeRecord {
  const hydrated = hydratePersonalFromMasterProfile(ext, master, profile);
  const id = String(master.id);
  const first = hydrated.personal.firstName;
  const last = hydrated.personal.lastName;
  const middle = hydrated.personal.middleName?.trim();
  const displayName =
    [first, middle, last].filter(Boolean).join(" ").trim() ||
    employeeDisplayName(profile ?? master);

  const departmentId = String(master.department_id ?? hydrated.employment.departmentId ?? "");
  const branchId = String(
    master.branch_id ?? hydrated.employment.branchId ?? profile?.branch_id ?? "",
  );
  const locationName = String(
    employment?.work_location_text ??
      employment?.work_location ??
      hydrated.employment.location ??
      "",
  ).trim();
  const locationId =
    String(hydrated.employment.locationId ?? "") ||
    (locationName ? locationByName.get(locationName.toLowerCase()) || "" : "");

  const companyId = String(master.company_id ?? "");
  const companyInfo = companyMap.get(companyId);
  const extEntity = (hydrated.employment.entityName || "").trim();
  // Prefer Excel-synced entity label when present (Digitech / Technologies)
  const entityName = /technolog/i.test(extEntity)
    ? "Cache Technologies"
    : /digitech/i.test(extEntity)
      ? "Cache Digitech"
      : companyInfo
        ? entityLabelForCompany(companyInfo.name, companyInfo.code)
        : extEntity || "—";
  const companyName = /technolog/i.test(extEntity)
    ? "Cache Technologies & Infotech"
    : companyInfo?.name || "—";

  const managerId = String(
    master.reporting_manager_id ?? hydrated.employment.reportingManagerId ?? "",
  );
  const managerFromMap = managerId ? managerMap.get(managerId) : undefined;
  const managerFromExt = (hydrated.employment.reportingManagerName || "").trim();
  const reportingManagerName =
    managerFromMap ||
    (managerFromExt && managerFromExt !== "—" ? managerFromExt : "") ||
    "—";

  const nextExt: EmployeeExtension = {
    ...hydrated,
    employment: {
      ...hydrated.employment,
      entityId: companyId || hydrated.employment.entityId,
      entityName,
      location: locationName || hydrated.employment.location,
      locationId: locationId || hydrated.employment.locationId,
      reportingManagerId: managerId || hydrated.employment.reportingManagerId,
      reportingManagerName:
        reportingManagerName !== "—"
          ? reportingManagerName
          : hydrated.employment.reportingManagerName,
      designationName:
        hydrated.employment.designationName ||
        String(master.designation ?? profile?.designation ?? ""),
    },
  };

  return {
    id,
    masterVersion: Number(master.version ?? 1),
    profileId: profile?.id ? String(profile.id) : undefined,
    profileVersion: profile?.version ? Number(profile.version) : undefined,
    employmentId: employment?.id ? String(employment.id) : undefined,
    employmentVersion: employment?.version ? Number(employment.version) : undefined,
    employeeCode: String(master.employee_code ?? hydrated.employment.employeeCode ?? ""),
    displayName,
    officialEmail: hydrated.personal.officialEmail,
    mobile: hydrated.personal.mobile,
    departmentId,
    departmentName:
      hydrated.employment.departmentName ||
      deptMap.get(departmentId) ||
      String(master.designation ?? "").split("·")[0] ||
      "—",
    designationName:
      nextExt.employment.designationName ||
      String(master.designation ?? profile?.designation ?? "—"),
    branchId,
    branchName: hydrated.employment.branchName || branchMap.get(branchId) || "—",
    companyId,
    companyName,
    locationId,
    locationName: locationName || "—",
    reportingManagerId: managerId,
    reportingManagerName,
    employmentType: String(
      employment?.employment_type ?? hydrated.employment.employmentType ?? "—",
    ),
    joiningDate: String(
      employment?.date_of_joining ??
        master.date_of_joining ??
        hydrated.employment.joiningDate ??
        "",
    ),
    lifecycleStatus: mapLifecycle(
      String(master.status ?? ""),
      String(profile?.status ?? ""),
      employment?.status ? String(employment.status) : undefined,
      hydrated.employment.lifecycleStatus,
    ),
    profilePhotoDataUrl: profilePhotoFromExtension(hydrated),
    gender: hydrated.personal.gender,
    isDeleted: Boolean(master.is_deleted),
    extension: nextExt,
  };
}

export type EmployeeDirectoryOptions = {
  branches: { id: string; label: string; headEmployeeId: string }[];
  departments: { id: string; label: string; branchId: string; headEmployeeId: string }[];
  locations: { id: string; label: string; branchId: string; code: string }[];
  designations: { id: string; label: string }[];
  /** Reporting managers only — for assignment picklists */
  managers: { id: string; label: string }[];
  /** All active employees — for name lookup (branch/dept heads, etc.) */
  employees: { id: string; label: string }[];
  managementGroups: { id: string; label: string; employmentType: string; shiftId: string }[];
  shifts: { id: string; label: string }[];
  companies: { id: string; label: string; code: string }[];
};

export type EmployeeDirectoryResult = {
  records: EmployeeRecord[];
  options: EmployeeDirectoryOptions;
  errors: string[];
};

const DIRECTORY_CACHE_TTL_MS = 20_000;
let directoryCache: { at: number; value: EmployeeDirectoryResult } | null = null;
let directoryInflight: Promise<EmployeeDirectoryResult> | null = null;

/** API pagination max is `le=200` — larger page_size returns 422. */
const API_PAGE_SIZE = 200;
const API_MAX_PAGES = 25;

/** Clear cached HR directory after creates/updates (or wait for TTL in dev). */
export function invalidateEmployeeDirectoryCache(): void {
  directoryCache = null;
}

async function listAllPages(apiPath: string): Promise<{ data: HrRow[]; error?: unknown }> {
  const all: HrRow[] = [];
  try {
    for (let page = 1; page <= API_MAX_PAGES; page += 1) {
      const res = await resourceService.list(apiPath, {
        page_size: API_PAGE_SIZE,
        page,
      });
      const chunk = (Array.isArray(res.data) ? res.data : []) as HrRow[];
      all.push(...chunk);
      if (chunk.length < API_PAGE_SIZE) break;
    }
    return { data: all };
  } catch (error) {
    return { data: all, error };
  }
}

async function loadOptions(): Promise<EmployeeDirectoryOptions> {
  const [branches, departments, locations, designations, employees, shifts, mgmtGroups, companies] =
    await Promise.all([
    listAllPages("/branches"),
    listAllPages("/departments"),
    listAllPages("/locations"),
    listAllPages("/hr/designations"),
    listAllPages("/employees"),
    listAllPages("/hr/shifts"),
    listAllPages("/hr/management-groups"),
    listAllPages("/companies"),
  ]);

  const asRows = (d: unknown) =>
    (Array.isArray(d) ? d : []).filter((r): r is HrRow => !!r && typeof r === "object");

  const empRows = asRows(employees.data) as EmployeeMasterRow[];
  const companyRows = asRows(companies.data);

  return {
    branches: asRows(branches.data).map((r) => ({
      id: String(r.id),
      label: String(r.branch_name ?? r.name ?? r.branch_code ?? r.id),
      headEmployeeId: String(r.head_employee_id ?? ""),
    })),
    departments: asRows(departments.data).map((r) => ({
      id: String(r.id),
      label: String(r.department_name ?? r.name ?? r.department_code ?? r.id),
      branchId: String(r.branch_id ?? ""),
      headEmployeeId: String(r.head_employee_id ?? ""),
    })),
    locations: asRows(locations.data).map((r) => ({
      id: String(r.id),
      label: String(r.location_name ?? r.name ?? r.location_code ?? r.id),
      branchId: String(r.branch_id ?? ""),
      code: String(r.location_code ?? ""),
    })),
    designations: asRows(designations.data).map((r) => ({
      id: String(r.id),
      label: String(r.designation_name ?? r.designation_code ?? r.id),
    })),
    managers: buildReportingManagerOptions(empRows),
    employees: buildEmployeeLookupOptions(empRows),
    shifts: asRows(shifts.data).map((r) => ({
      id: String(r.id),
      label: String(r.shift_name ?? r.shift_code ?? r.id),
    })),
    managementGroups: asRows(mgmtGroups.data).map((r) => ({
      id: String(r.id),
      label: String(r.group_name ?? r.group_code ?? r.id),
      employmentType: String(r.employment_type ?? "permanent"),
      shiftId: String(r.default_shift_id ?? ""),
    })),
    companies: companyRows.map((r) => {
      const name = String(r.company_name ?? r.name ?? r.company_code ?? r.id);
      const code = String(r.company_code ?? "");
      return {
        id: String(r.id),
        label: name,
        code,
      };
    }),
  };
}

async function fetchEmployeeDirectoryUncached(): Promise<EmployeeDirectoryResult> {
  await ensureEmployeeExtensionsLoaded();
  purgeLocalDemoEmployees();

  const [masters, profiles, employment, options] = await Promise.all([
    listAllPages("/employees"),
    listAllPages("/hr/employee-profiles"),
    listAllPages("/hr/employment"),
    loadOptions(),
  ]);

  const errors: string[] = [];
  if (masters.error) errors.push("Could not load employees");
  if (profiles.error) errors.push("Could not load HR profiles");

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
  const employeeNameMap = new Map(options.employees.map((m) => [m.id, m.label.split(" (")[0]]));
  const companyMapFull = new Map<string, { name: string; code: string }>();
  for (const c of options.companies) {
    companyMapFull.set(c.id, { name: c.label, code: c.code });
  }

  const locationByName = new Map<string, string>();
  for (const loc of options.locations) {
    locationByName.set(loc.label.toLowerCase(), loc.id);
  }

  const extensions = loadExtensions();

  const records = masterRows
    .filter((m) => !m.is_deleted)
    .map((m) => {
      const id = String(m.id);
      const profile = profileByEmployee.get(id);
      const stored = extensions[id];
      const ext = defaultExtension(stored);
      // Hydrate onboarding bank from HR profile when local store is empty
      if (profile && !ext.bank.accountNumber && !ext.bank.ifsc) {
        ext.bank = {
          ...ext.bank,
          bankName: String(profile.bank_name ?? ""),
          accountNumber: String(profile.bank_account_number ?? ""),
          confirmAccountNumber: String(profile.bank_account_number ?? ""),
          ifsc: String(profile.bank_ifsc ?? ""),
          accountHolderName: String(profile.bank_account_holder ?? ""),
        };
      }
      // Hydrate company bank from profile when set and distinct from onboarding store
      if (
        profile &&
        !ext.companyBank.accountNumber &&
        profile.bank_account_number &&
        String(profile.bank_account_number) !== ext.bank.accountNumber
      ) {
        ext.companyBank = {
          ...ext.companyBank,
          bankName: String(profile.bank_name ?? ""),
          accountNumber: String(profile.bank_account_number ?? ""),
          confirmAccountNumber: String(profile.bank_account_number ?? ""),
          ifsc: String(profile.bank_ifsc ?? ""),
          accountHolderName: String(profile.bank_account_holder ?? ""),
        };
      }
      return mergeRow(
        m,
        profile,
        employmentByEmployee.get(id),
        deptMap,
        branchMap,
        employeeNameMap,
        companyMapFull,
        locationByName,
        ext,
      );
    });

  // Merge onboarding-activated / locally registered employees (shared HR connector)
  const localEmployees = readJson<EmployeeRecord[]>(LOCAL_EMP_KEY, []).filter(
    (r) => !isDemoEmployeeCode(r.employeeCode),
  );
  const seenIds = new Set(records.map((r) => r.id));
  const seenCodes = new Set(records.map((r) => r.employeeCode));
  for (const loc of localEmployees) {
    if (seenIds.has(loc.id) || seenCodes.has(loc.employeeCode)) continue;
    const stored = extensions[loc.id];
    const ext = hydratePersonalFromLocalRecord(
      defaultExtension(stored ?? loc.extension),
      loc,
    );
    const mgrName =
      (ext.employment.reportingManagerName || "").trim() ||
      (loc.reportingManagerName || "").trim() ||
      "—";
    records.push({
      ...loc,
      companyId: loc.companyId || loc.extension?.employment?.entityId || "",
      companyName: loc.companyName || loc.extension?.employment?.entityName || "—",
      reportingManagerId: ext.employment.reportingManagerId || loc.reportingManagerId || "",
      reportingManagerName: mgrName,
      departmentName: ext.employment.departmentName || loc.departmentName,
      designationName: ext.employment.designationName || loc.designationName,
      branchName: ext.employment.branchName || loc.branchName,
      employmentType: ext.employment.employmentType || loc.employmentType,
      joiningDate: ext.employment.joiningDate || loc.joiningDate,
      lifecycleStatus: ext.employment.lifecycleStatus || loc.lifecycleStatus,
      profilePhotoDataUrl: profilePhotoFromExtension(ext) || loc.profilePhotoDataUrl,
      extension: ext,
    });
    seenIds.add(loc.id);
    seenCodes.add(loc.employeeCode);
  }

  // If an API employee matches an onboarding local record by code, overlay portal
  // extension fields that were saved under the local UUID (manager, photo, docs).
  const localByCode = new Map(localEmployees.map((l) => [l.employeeCode, l]));
  for (let i = 0; i < records.length; i++) {
    const row = records[i]!;
    const local = localByCode.get(row.employeeCode);
    if (!local || local.id === row.id) continue;
    const localExt = extensions[local.id] ?? local.extension;
    if (!localExt) continue;
    const mergedExt = defaultExtension({
      ...row.extension,
      personal: {
        ...row.extension.personal,
        ...localExt.personal,
        profilePhotoDataUrl:
          row.extension.personal.profilePhotoDataUrl ||
          localExt.personal.profilePhotoDataUrl ||
          profilePhotoFromExtension(localExt),
      },
      employment: {
        ...row.extension.employment,
        ...localExt.employment,
        reportingManagerName:
          (row.extension.employment.reportingManagerName || "").trim() ||
          (localExt.employment.reportingManagerName || "").trim() ||
          "",
      },
      governmentIds: {
        ...row.extension.governmentIds,
        ...localExt.governmentIds,
      },
      bank: row.extension.bank.accountNumber ? row.extension.bank : localExt.bank,
      documents:
        row.extension.documents.length > 0 ? row.extension.documents : localExt.documents,
    });
    // Also store under API id so future loads find it
    if (!extensions[row.id]) {
      saveExtension(row.id, mergedExt);
    }
    records[i] = {
      ...row,
      reportingManagerName:
        (mergedExt.employment.reportingManagerName || "").trim() ||
        (row.reportingManagerName || "").trim() ||
        "—",
      profilePhotoDataUrl: profilePhotoFromExtension(mergedExt) || row.profilePhotoDataUrl,
      extension: mergedExt,
    };
  }

  // Backfill manager + photo from onboarding cases for employees created before mapping fixes
  const onboardingCases = readJson<
    {
      employeeId?: string;
      reportingManager?: string;
      portal?: {
        documents?: { kind?: string; typeCode?: string; fileDataUrl?: string }[];
      };
    }[]
  >("erp_onboarding_cases_v1", []);
  const caseByEmpCode = new Map(
    onboardingCases
      .filter((c) => c.employeeId)
      .map((c) => [String(c.employeeId).toUpperCase(), c]),
  );
  for (let i = 0; i < records.length; i++) {
    const row = records[i]!;
    const caseRow = caseByEmpCode.get(row.employeeCode.toUpperCase());
    if (!caseRow) continue;

    const needsManager =
      !(row.reportingManagerName || "").trim() || row.reportingManagerName === "—";
    const needsPhoto = !row.profilePhotoDataUrl;

    if (!needsManager && !needsPhoto) continue;

    const photoDoc = (caseRow.portal?.documents || []).find(
      (d) => d.kind === "photo" || d.typeCode === "DOC-PHOTO",
    );
    const photoUrl = photoDoc?.fileDataUrl;
    const mgr = (caseRow.reportingManager || "").trim();

    const nextExt = defaultExtension({
      ...row.extension,
      personal: {
        ...row.extension.personal,
        profilePhotoDataUrl:
          row.extension.personal.profilePhotoDataUrl || photoUrl || undefined,
      },
      employment: {
        ...row.extension.employment,
        reportingManagerName:
          (row.extension.employment.reportingManagerName || "").trim() || mgr || "",
      },
      documents:
        row.extension.documents.length > 0
          ? row.extension.documents
          : (caseRow.portal?.documents || [])
              .filter((d) => d.fileDataUrl)
              .map((d, idx) => ({
                id: `onb-doc-${idx}`,
                documentType: d.kind || "other",
                documentNumber: "",
                issueDate: "",
                expiryDate: "",
                fileName: d.kind || "document",
                fileDataUrl: d.fileDataUrl,
                uploadedBy: "Onboarding portal",
                uploadedAt: nowIso(),
                source: "onboarding" as const,
              })),
    });

    if (needsManager || needsPhoto) {
      saveExtension(row.id, nextExt);
    }

    records[i] = {
      ...row,
      reportingManagerName: needsManager && mgr ? mgr : row.reportingManagerName || "—",
      profilePhotoDataUrl:
        row.profilePhotoDataUrl || profilePhotoFromExtension(nextExt) || photoUrl,
      extension: nextExt,
    };
  }

  return { records, options, errors };
}

export async function loadEmployeeDirectory(): Promise<EmployeeDirectoryResult> {
  const now = Date.now();
  if (directoryCache && now - directoryCache.at < DIRECTORY_CACHE_TTL_MS) {
    return directoryCache.value;
  }
  if (directoryInflight) return directoryInflight;

  directoryInflight = fetchEmployeeDirectoryUncached()
    .then((value) => {
      directoryCache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      directoryInflight = null;
    });

  return directoryInflight;
}

export function filterEmployees(
  records: EmployeeRecord[],
  query: string,
  filters: EmployeeListFilters,
): EmployeeRecord[] {
  const q = query.trim().toLowerCase();
  return records.filter((r) => {
    if (filters.branchId && r.branchId !== filters.branchId) return false;
    if (filters.entityId) {
      const eid = filters.entityId.toLowerCase();
      const entityLabel = (
        r.extension.employment.entityName ||
        r.companyName ||
        ""
      ).toLowerCase();
      if (eid === "technology" || eid === "technologies") {
        if (!entityLabel.includes("technolog")) return false;
      } else if (eid === "digitech") {
        if (entityLabel.includes("technolog") || !entityLabel.includes("digitech")) return false;
      } else if (r.companyId !== filters.entityId && r.extension.employment.entityId !== filters.entityId) {
        return false;
      }
    }
    if (filters.departmentId && r.departmentId !== filters.departmentId) return false;
    if (filters.designation && r.designationName !== filters.designation) return false;
    if (filters.employmentType && r.employmentType !== filters.employmentType) return false;
    if (filters.status && r.lifecycleStatus !== filters.status) return false;
    if (filters.reportingManagerId && r.reportingManagerId !== filters.reportingManagerId) {
      return false;
    }
    if (filters.location) {
      const locName = (r.locationName || "").trim();
      if (!locName || locName === "—") return false;
      if (locName.toLowerCase() !== filters.location.toLowerCase()) return false;
    }
    if (filters.gender && r.gender !== filters.gender) return false;
    if (filters.joiningFrom && r.joiningDate && r.joiningDate < filters.joiningFrom) return false;

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
  const onboarding = records.filter((r) => r.lifecycleStatus === "onboarding").length;
  const probation = records.filter((r) => r.lifecycleStatus === "probation").length;
  const notice = records.filter((r) => r.lifecycleStatus === "notice").length;
  return { total, active, inactive, onboarding, probation, notice };
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

export async function createExistingEmployee(input: {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  joiningDate: string;
  branchId: string;
  departmentId: string;
  designationName: string;
  employmentType?: string;
  employeeCode?: string;
  reportingManagerId?: string;
}): Promise<EmployeeRecord> {
  const masterRes = await apiClient<HrRow>("/employees", {
    method: "POST",
    body: {
      branch_id: input.branchId,
      department_id: input.departmentId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      mobile: input.mobile,
      designation: input.designationName,
      date_of_joining: input.joiningDate,
      employee_code: input.employeeCode || undefined,
      reporting_manager_id: input.reportingManagerId || null,
      bypass_onboarding: true,
    },
  });
  const master = masterRes.data;
  if (!master?.id) throw new Error("Employee create returned no data");

  await apiClient<HrRow>("/hr/employment", {
    method: "POST",
    body: {
      branch_id: input.branchId,
      employee_id: master.id,
      employment_type: input.employmentType || "permanent",
      date_of_joining: input.joiningDate,
      status: "active",
      payroll_eligible: true,
      lifecycle_source: "direct_add",
    },
  }).catch(() => undefined);

  const ext = defaultExtension({
    personal: {
      ...emptyPersonal(),
      firstName: input.firstName,
      lastName: input.lastName,
      officialEmail: input.email,
      mobile: input.mobile,
    },
    employment: {
      ...emptyEmployment(String(master.employee_code ?? input.employeeCode ?? "")),
      joiningDate: input.joiningDate,
      branchId: input.branchId,
      departmentId: input.departmentId,
      designationName: input.designationName,
      employmentType: input.employmentType || "permanent",
      reportingManagerId: input.reportingManagerId || "",
      lifecycleStatus: "active",
    },
  });
  saveExtension(String(master.id), ext);
  appendActivity({
    employeeId: String(master.id),
    type: "created",
    title: "Employee added (light hire)",
    actor: actorLabel(),
  });

  invalidateEmployeeDirectoryCache();

  return {
    id: String(master.id),
    masterVersion: Number(master.version ?? 1),
    employeeCode: String(master.employee_code ?? ""),
    displayName: `${input.firstName} ${input.lastName}`.trim(),
    officialEmail: input.email,
    mobile: input.mobile,
    departmentId: input.departmentId,
    departmentName: "—",
    designationName: input.designationName,
    branchId: input.branchId,
    branchName: "—",
    companyId: "",
    companyName: "—",
    locationId: "",
    locationName: "—",
    reportingManagerId: input.reportingManagerId || "",
    reportingManagerName: "—",
    employmentType: input.employmentType || "permanent",
    joiningDate: input.joiningDate,
    lifecycleStatus: "active",
    gender: "",
    isDeleted: false,
    extension: ext,
  };
}

export async function applyOnboardingPortalToEmployee(
  employeeId: string,
  draft: EmployeeWizardDraft,
): Promise<void> {
  await ensureEmployeeExtensionsLoaded();
  const existing = loadExtensions()[employeeId];
  const ext = defaultExtension({
    ...existing,
    personal: draft.personal,
    employment: draft.employment,
    governmentIds: draft.governmentIds,
    bank: draft.bank,
    companyBank: existing?.companyBank ?? draft.companyBank ?? emptyBank(),
    salary: draft.salary,
    documents: (draft.documents ?? []).map((d) => ({
      ...d,
      source: d.source ?? "onboarding",
    })),
    education: draft.education,
    previousEmployment: draft.previousEmployment,
    createdBy: existing?.createdBy ?? "Onboarding",
    updatedBy: "Onboarding",
    updatedAt: nowIso(),
  });
  // Ensure avatar uses photo document when profilePhoto was not set separately
  if (!ext.personal.profilePhotoDataUrl) {
    const fromDoc = profilePhotoFromExtension(ext);
    if (fromDoc) ext.personal.profilePhotoDataUrl = fromDoc;
  }
  saveExtension(employeeId, ext);
  invalidateEmployeeDirectoryCache();

  // Keep local employee mirror in sync (directory may serve this row as-is)
  try {
    const locals = readJson<EmployeeRecord[]>(LOCAL_EMP_KEY, []);
    const idx = locals.findIndex((e) => e.id === employeeId || e.employeeCode === draft.employment.employeeCode);
    if (idx >= 0) {
      const prev = locals[idx]!;
      locals[idx] = {
        ...prev,
        displayName:
          [draft.personal.firstName, draft.personal.middleName, draft.personal.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || prev.displayName,
        officialEmail: draft.personal.officialEmail || prev.officialEmail,
        mobile: draft.personal.mobile || prev.mobile,
        departmentName: draft.employment.departmentName || prev.departmentName,
        designationName: draft.employment.designationName || prev.designationName,
        branchName: draft.employment.branchName || prev.branchName,
        reportingManagerId: draft.employment.reportingManagerId || prev.reportingManagerId,
        reportingManagerName:
          (draft.employment.reportingManagerName || "").trim() ||
          prev.reportingManagerName ||
          "—",
        employmentType: draft.employment.employmentType || prev.employmentType,
        joiningDate: draft.employment.joiningDate || prev.joiningDate,
        lifecycleStatus: draft.employment.lifecycleStatus || prev.lifecycleStatus,
        profilePhotoDataUrl: profilePhotoFromExtension(ext) || prev.profilePhotoDataUrl,
        extension: ext,
      };
      writeJson(LOCAL_EMP_KEY, locals);
    }
  } catch {
    /* ignore */
  }

  appendActivity({
    employeeId,
    type: "onboarding_imported",
    title: "Onboarding portal details imported",
    actor: actorLabel(),
  });
}

export function findOnboardingLinkedCaseId(employeeCode: string): string | null {
  try {
    const list = readJson<{ employeeCode: string; caseId: string }[]>(
      "erp_onboarding_activated_employees_v1",
      [],
    );
    return list.find((x) => x.employeeCode === employeeCode)?.caseId ?? null;
  } catch {
    return null;
  }
}

export async function createEmployeeFromWizard(
  draft: EmployeeWizardDraft,
  options: EmployeeDirectoryOptions,
): Promise<EmployeeRecord> {
  void options;
  const firstName = draft.personal.firstName.trim();
  const lastName = draft.personal.lastName.trim();
  const email = draft.personal.officialEmail.trim();
  const mobile = draft.personal.mobile.trim();
  const joiningDate = draft.employment.joiningDate;
  const branchId = draft.employment.branchId;
  const departmentId = draft.employment.departmentId;
  const designationName = draft.employment.designationName || "Staff";
  const employmentType = draft.employment.employmentType || "permanent";
  const managementGroupId = draft.employment.managementGroupId || undefined;
  const employeeCode = draft.employment.employeeCode || undefined;
  const reportingManagerId = draft.employment.reportingManagerId || undefined;

  const masterRes = await apiClient<HrRow>("/employees", {
    method: "POST",
    body: {
      branch_id: branchId,
      department_id: departmentId,
      first_name: firstName,
      last_name: lastName,
      email,
      mobile,
      designation: designationName,
      date_of_joining: joiningDate,
      employee_code: employeeCode,
      reporting_manager_id: reportingManagerId || null,
      bypass_onboarding: true,
    },
  });
  const master = masterRes.data;
  if (!master?.id) throw new Error("Employee create returned no data");
  const employeeId = String(master.id);

  await apiClient<HrRow>("/hr/employment", {
    method: "POST",
    body: {
      branch_id: branchId,
      employee_id: employeeId,
      employment_type: employmentType,
      date_of_joining: joiningDate,
      status: draft.employment.lifecycleStatus || "active",
      payroll_eligible: true,
      lifecycle_source: "direct_add",
      management_group_id: managementGroupId || null,
      work_location_text: draft.employment.location || null,
      probation_period_days: draft.employment.probationPeriodDays
        ? Number(draft.employment.probationPeriodDays)
        : null,
    },
  }).catch(() => undefined);

  const educationPayload = draft.education
    .filter((e) => e.degree.trim() || e.institution.trim())
    .map(({ id: _id, ...rest }) => rest);
  const previousPayload = draft.previousEmployment
    .filter((e) => e.company.trim() || e.designation.trim())
    .map(({ id: _id, ...rest }) => rest);

  const profileRes = await apiClient<HrRow>("/hr/employee-profiles", {
    method: "POST",
    body: {
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
      aadhaar_number: draft.governmentIds.aadhaar || null,
      pan_number: draft.governmentIds.pan || null,
      uan_number: draft.governmentIds.uan || null,
      bank_account_number: draft.bank.accountNumber || null,
      bank_ifsc: draft.bank.ifsc || null,
      bank_name: draft.bank.bankName || null,
      bank_account_holder: draft.bank.accountHolderName || null,
      status: draft.employment.lifecycleStatus || "active",
    },
  }).catch(() => null);

  if (profileRes?.data?.id && (educationPayload.length || previousPayload.length)) {
    await resourceService
      .update("/hr/employee-profiles", String(profileRes.data.id), {
        version: Number(profileRes.data.version ?? 1),
        education_json: educationPayload,
        skills_json: previousPayload.length
          ? { previous_employment: previousPayload }
          : null,
      })
      .catch(() => undefined);
  }

  const ext = defaultExtension({
    personal: draft.personal,
    employment: {
      ...draft.employment,
      employeeCode: String(master.employee_code ?? employeeCode ?? ""),
      designationName,
      employmentType,
      lifecycleStatus: draft.employment.lifecycleStatus || "active",
    },
    governmentIds: draft.governmentIds,
    bank: draft.bank,
    companyBank: draft.companyBank ?? emptyBank(),
    salary: draft.salary,
    documents: draft.documents,
    education: draft.education,
    previousEmployment: draft.previousEmployment,
  });
  saveExtension(employeeId, ext);
  appendActivity({
    employeeId,
    type: "created",
    title: "Employee added (HR direct hire — no invitation)",
    actor: actorLabel(),
  });

  invalidateEmployeeDirectoryCache();

  return {
    id: employeeId,
    masterVersion: Number(master.version ?? 1),
    profileId: profileRes?.data?.id ? String(profileRes.data.id) : undefined,
    profileVersion: profileRes?.data?.version
      ? Number(profileRes.data.version)
      : undefined,
    employeeCode: String(master.employee_code ?? ""),
    displayName: `${firstName} ${lastName}`.trim(),
    officialEmail: email,
    mobile,
    departmentId,
    departmentName: draft.employment.departmentName || "—",
    designationName,
    branchId,
    branchName: draft.employment.branchName || "—",
    companyId: "",
    companyName: "—",
    locationId: draft.employment.locationId || "",
    locationName: draft.employment.location || "—",
    reportingManagerId: reportingManagerId || "",
    reportingManagerName: draft.employment.reportingManagerName || "—",
    employmentType,
    joiningDate,
    lifecycleStatus: draft.employment.lifecycleStatus || "active",
    gender: draft.personal.gender,
    isDeleted: false,
    extension: ext,
  };
}

export async function updateEmployeeRecord(  record: EmployeeRecord,
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
    companyBank: patch.companyBank
      ? { ...record.extension.companyBank, ...patch.companyBank }
      : (record.extension.companyBank ?? emptyBank()),
    salary: patch.salary ? { ...record.extension.salary, ...patch.salary } : record.extension.salary,
    documents: patch.documents ?? record.extension.documents,
    education: patch.education ?? record.extension.education ?? [],
    previousEmployment: patch.previousEmployment ?? record.extension.previousEmployment ?? [],
    updatedBy: actorLabel(),
    updatedAt: nowIso(),
  };

  const auditFields: (keyof EmployeeWizardDraft)[] = [
    "personal",
    "employment",
    "governmentIds",
    "bank",
    "companyBank",
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
      aadhaar_number: nextExt.governmentIds.aadhaar || null,
      pan_number: nextExt.governmentIds.pan || null,
      uan_number: nextExt.governmentIds.uan || null,
      bank_account_number: nextExt.bank.accountNumber || null,
      bank_ifsc: nextExt.bank.ifsc || null,
      bank_name: nextExt.bank.bankName || null,
      bank_account_holder: nextExt.bank.accountHolderName || null,
      education_json: nextExt.education.map((entry) => {
        const education = { ...entry };
        delete education.id;
        return education;
      }),
      skills_json: nextExt.previousEmployment.length
        ? {
            previous_employment: nextExt.previousEmployment.map((entry) => {
              const previousEmployment = { ...entry };
              delete previousEmployment.id;
              return previousEmployment;
            }),
          }
        : null,
      status: nextExt.employment.lifecycleStatus,
    }).catch(() => undefined);
  }

  if (record.employmentId && patch.employment) {
    const ctc = Number(nextExt.salary.ctc);
    const employmentStatus = {
      active: "active",
      onboarding: "onboarding",
      probation: "probation",
      notice: "notice_period",
      resigned: "separated",
      archived: "ex_employee",
      inactive: "ended",
    }[nextExt.employment.lifecycleStatus];
    await resourceService
      .update("/hr/employment", record.employmentId, {
        version: record.employmentVersion,
        employment_type: nextExt.employment.employmentType,
        confirmation_date: nextExt.employment.confirmationDate || null,
        work_location_text: nextExt.employment.location || null,
        management_group_id: uuidOrNull(nextExt.employment.managementGroupId),
        ctc_amount: Number.isFinite(ctc) && ctc > 0 ? ctc : null,
        status: employmentStatus,
      })
      .catch(() => undefined);
  }

  appendActivity({
    employeeId: record.id,
    type: "updated",
    title: "Employee profile updated",
    actor: actorLabel(),
  });
  invalidateEmployeeDirectoryCache();
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
  invalidateEmployeeDirectoryCache();
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
    "Emp Code",
    "NAME",
    "Entity",
    "Organisation",
    "Base Location",
    "Designation",
    "Department",
    "Reporting Manager",
    "Email",
    "Mobile",
    "Employment Type",
    "Joining Date",
    "Status",
  ];
  const lines = records.map((r) =>
    [
      r.employeeCode,
      r.displayName,
      r.extension.employment.entityName || "",
      r.companyName || r.branchName,
      r.locationName,
      r.designationName,
      r.departmentName,
      r.reportingManagerName,
      r.officialEmail,
      r.mobile,
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

export const MAX_PHOTO_BYTES = 300 * 1024;
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
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
