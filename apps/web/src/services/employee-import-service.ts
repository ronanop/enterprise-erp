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
    tags: [],
    createdBy: "Import",
    updatedBy: "Import",
    updatedAt: new Date().toISOString(),
  };
}

function normalizeImportTag(raw: string | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
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
    const genderRaw = String(excel.gender || "")
      .replace(/^\ufeff/, "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, " ");
    const gender =
      genderRaw === "m" ||
      genderRaw === "male" ||
      genderRaw === "man" ||
      genderRaw === "1" ||
      (genderRaw.length <= 6 && genderRaw.startsWith("m") && !genderRaw.startsWith("miss"))
        ? "male"
        : genderRaw === "f" ||
            genderRaw === "female" ||
            genderRaw === "woman" ||
            genderRaw === "2" ||
            genderRaw === "0" ||
            (genderRaw.length <= 6 && genderRaw.startsWith("f"))
          ? "female"
          : genderRaw === "o" ||
              genderRaw === "other" ||
              genderRaw === "nonbinary" ||
              genderRaw === "non-binary" ||
              genderRaw === "nb"
            ? "other"
            : genderRaw;
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
        maritalStatus: String(excel.marital_status || prev.personal.maritalStatus || "")
          .trim()
          .toLowerCase(),
        bloodGroup: String(excel.blood_group || prev.personal.bloodGroup || "").trim(),
        nationality: String(excel.nationality || prev.personal.nationality || "Indian").trim(),
        alternateMobile: String(excel.alternate_mobile || prev.personal.alternateMobile || "").trim(),
        currentAddress: excel.current_address
          ? {
              ...prev.personal.currentAddress,
              line1: String(excel.current_address).trim(),
            }
          : prev.personal.currentAddress,
        permanentAddress: excel.permanent_address
          ? {
              ...prev.personal.permanentAddress,
              line1: String(excel.permanent_address).trim(),
            }
          : prev.personal.permanentAddress,
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
        deployedAt: String(excel.deployed_at || prev.employment.deployedAt || "").trim(),
        designationName: String(
          excel.designation || res.designation || prev.employment.designationName || "",
        ).trim(),
        departmentName: String(excel.department || prev.employment.departmentName || "").trim(),
        reportingManagerName: managerName || prev.employment.reportingManagerName || "",
      },
      governmentIds: {
        ...emptyGovernmentIds(),
        ...prev.governmentIds,
        aadhaar: String(excel.aadhaar || prev.governmentIds.aadhaar || "").trim(),
        pan: String(excel.pan || prev.governmentIds.pan || "").trim(),
        uan: String(excel.uan || prev.governmentIds.uan || "").trim(),
        esic:
          esiRaw && !["yes", "y", "true", "1", "no", "n", "false", "0"].includes(esiRaw.toLowerCase())
            ? esiRaw
            : prev.governmentIds.esic,
      },
      bank: {
        ...emptyBank(),
        ...prev.bank,
        bankName: String(excel.bank_name || prev.bank.bankName || "").trim(),
        accountNumber: String(excel.bank_account || prev.bank.accountNumber || "").trim(),
        confirmAccountNumber: String(
          excel.bank_account || prev.bank.confirmAccountNumber || "",
        ).trim(),
        ifsc: String(excel.bank_ifsc || prev.bank.ifsc || "").trim(),
        accountHolderName: String(excel.bank_holder || prev.bank.accountHolderName || "").trim(),
      },
      companyBank: {
        ...emptyBank(),
        ...prev.companyBank,
        bankName: String(excel.salary_bank_name || prev.companyBank.bankName || "").trim(),
        accountNumber: String(
          excel.salary_bank_account || prev.companyBank.accountNumber || "",
        ).trim(),
        confirmAccountNumber: String(
          excel.salary_bank_account || prev.companyBank.confirmAccountNumber || "",
        ).trim(),
        ifsc: String(excel.salary_bank_ifsc || prev.companyBank.ifsc || "").trim(),
      },
      salary: {
        ...emptySalary(),
        ...prev.salary,
        esi: esiRaw ? truthyEsi(esiRaw) : prev.salary.esi,
      },
      education: mergeEducationFromImport(prev.education, excel),
      documents: mergeDocumentsFromImport(prev.documents, excel),
      tags: (() => {
        const tag = normalizeImportTag(excel.tag);
        const prevTags = Array.isArray(prev.tags) ? prev.tags : [];
        if (!tag) return prevTags;
        return prevTags.includes(tag) ? prevTags : [...prevTags, tag];
      })(),
      updatedBy: "Import",
      updatedAt: new Date().toISOString(),
    });
  }
}

function truthyDoc(raw: string | undefined): boolean {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return false;
  if (["no", "n", "false", "0", "-", "na", "n/a", "nil", "null"].includes(v)) return false;
  return true;
}

function mergeEducationFromImport(
  prev: EmployeeExtension["education"],
  excel: NormalizedEmployeeImportRow,
): EmployeeExtension["education"] {
  const next = [...prev];
  const upsert = (degree: string, fileHint: string | undefined) => {
    const hint = String(fileHint || "").trim();
    if (!hint || !truthyDoc(hint)) return;
    const existing = next.find((e) => e.degree.toLowerCase() === degree.toLowerCase());
    if (existing) {
      existing.certificateFileName = hint === "yes" || hint === "y" ? degree : hint;
      return;
    }
    next.push({
      id: `edu-import-${degree.toLowerCase().replace(/\s+/g, "-")}`,
      degree,
      institution: "",
      field: "",
      year: "",
      grade: "",
      certificateFileName: hint === "yes" || hint === "y" ? degree : hint,
    });
  };
  upsert("10th", excel.marksheet_10th);
  upsert("12th", excel.marksheet_12th);
  upsert("Basic Education", excel.basic_education);
  upsert("Higher Education", excel.higher_education);
  upsert(String(excel.degree || "Degree").trim() || "Degree", excel.degree);
  return next;
}

function mergeDocumentsFromImport(
  prev: EmployeeExtension["documents"],
  excel: NormalizedEmployeeImportRow,
): EmployeeExtension["documents"] {
  const next = [...prev];
  const upsert = (documentType: string, raw: string | undefined) => {
    const hint = String(raw || "").trim();
    if (!hint || !truthyDoc(hint)) return;
    const existing = next.find(
      (d) => d.documentType.toLowerCase() === documentType.toLowerCase(),
    );
    const fileName = hint === "yes" || hint === "y" ? documentType : hint;
    if (existing) {
      existing.fileName = fileName;
      existing.uploadedAt = new Date().toISOString();
      existing.uploadedBy = "Import";
      return;
    }
    next.push({
      id: `doc-import-${documentType.toLowerCase().replace(/\s+/g, "-")}`,
      documentType,
      documentNumber: "",
      issueDate: "",
      expiryDate: "",
      fileName,
      uploadedBy: "Import",
      uploadedAt: new Date().toISOString(),
      source: "hr",
    });
  };
  upsert("Previous-Employer Offer", excel.prev_employer_offer);
  upsert("Previous-Employer Experience letter", excel.prev_employer_exp_letter);
  upsert("Laptop", excel.laptop);
  upsert("Dongle and Sim", excel.dongle_sim);
  upsert("Joining kits", excel.joining_kit);
  upsert("Letter of Intent", excel.letter_of_intent);
  upsert("Appointment Letter", excel.appointment_letter);
  return next;
}

/** API master + profile fields; cache email → email, Emp contact → mobile. */
function toApiImportRows(rows: NormalizedEmployeeImportRow[]) {
  return rows.map((r) => ({
    employee_code: r.employee_code,
    previous_employee_code: (r.previous_employee_code || "").trim() || undefined,
    name: r.name,
    entity: r.entity,
    organisation: r.organisation,
    deployed_at: (r.deployed_at || "").trim() || undefined,
    base_location: r.base_location,
    designation: r.designation,
    // Backend always attaches shared General per entity — Excel dept is informational only.
    department: undefined,
    reporting_manager: r.reporting_manager,
    email: (r.email || r.personal_email || "").trim() || undefined,
    mobile: r.mobile,
    alternate_mobile: (r.alternate_mobile || "").trim() || undefined,
    joining_date: r.joining_date,
    gender: (r.gender || "").trim() || undefined,
    dob: (r.dob || "").trim() || undefined,
    marital_status: (r.marital_status || "").trim() || undefined,
    blood_group: (r.blood_group || "").trim() || undefined,
    nationality: (r.nationality || "").trim() || undefined,
    aadhaar: (r.aadhaar || "").trim() || undefined,
    pan: (r.pan || "").trim() || undefined,
    uan: (r.uan || "").trim() || undefined,
    bank_name: (r.bank_name || "").trim() || undefined,
    bank_account: (r.bank_account || "").trim() || undefined,
    bank_ifsc: (r.bank_ifsc || "").trim() || undefined,
    bank_holder: (r.bank_holder || "").trim() || undefined,
    current_address: (r.current_address || "").trim() || undefined,
    permanent_address: (r.permanent_address || "").trim() || undefined,
    emergency_name: (r.emergency_name || "").trim() || undefined,
    emergency_phone: (r.emergency_phone || "").trim() || undefined,
    emergency_relationship: (r.emergency_relationship || "").trim() || undefined,
    father_name: (r.father_name || "").trim() || undefined,
    esi: (r.esi || "").trim() || undefined,
    tag: (r.tag || "").trim() || undefined,
  }));
}

const IMPORT_CHUNK_SIZE = 40;

export async function bulkImportEmployees(
  rows: NormalizedEmployeeImportRow[],
  options?: { companyId?: string; defaultTag?: string },
): Promise<EmployeeImportResponse> {
  // Chunk to avoid proxy/API timeouts on large Excel sheets (e.g. 166 rows).
  const defaultTag = normalizeImportTag(options?.defaultTag);
  const isClientImport = defaultTag === "client_side";
  const prepared = rows.map((r) => {
    // Client sheets often put deployment site under "Organisation" — move to deployed_at.
    const org = String(r.organisation || "").trim();
    const deployed = String(r.deployed_at || "").trim();
    const movedDeployed =
      isClientImport && !deployed && org && !/^cache$/i.test(org) ? org : deployed;
    return {
      ...r,
      tag: normalizeImportTag(r.tag) || defaultTag || undefined,
      deployed_at: movedDeployed || undefined,
      organisation: isClientImport && movedDeployed && movedDeployed === org ? undefined : r.organisation,
    };
  });

  const merged: EmployeeImportResponse = {
    created: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
    results: [],
  };

  for (let i = 0; i < prepared.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = prepared.slice(i, i + IMPORT_CHUNK_SIZE);
    const res = await apiClient<EmployeeImportResponse>("/hr/employees/bulk-import", {
      method: "POST",
      body: {
        rows: toApiImportRows(chunk),
        company_id: options?.companyId || undefined,
      },
    });
    if (!res.data) throw new Error("Import returned no data");
    merged.created += Number(res.data.created || 0);
    merged.updated += Number(res.data.updated || 0);
    merged.skipped += Number(res.data.skipped || 0);
    if (res.data.warnings?.length) merged.warnings.push(...res.data.warnings);
    if (res.data.errors?.length) merged.errors.push(...res.data.errors);
    if (res.data.results?.length) merged.results.push(...res.data.results);
    syncImportedExcelFieldsToExtensions(chunk, res.data.results || []);
  }

  merged.warnings = merged.warnings.slice(0, 200);
  merged.errors = merged.errors.slice(0, 200);
  return merged;
}

/** Stamp existing employees missing a tag as office_staff (once per directory load). */
export async function backfillOfficeStaffTags(): Promise<{
  updated: number;
  skipped: number;
  default_tag: string;
  message: string;
}> {
  const res = await apiClient<{
    updated: number;
    skipped: number;
    default_tag: string;
    message: string;
  }>("/hr/employees/backfill-tags", {
    method: "POST",
    body: { default_tag: "office_staff", only_missing: true },
  });
  if (!res.data) throw new Error("Tag backfill returned no data");
  return res.data;
}

/** Ensure local extensions also carry office_staff when no tag is set. */
export function stampLocalOfficeStaffTags(): number {
  if (typeof window === "undefined") return 0;
  const existing = getEmployeeExtensionsSync();
  let updated = 0;
  for (const [id, ext] of Object.entries(existing)) {
    const tags = Array.isArray(ext.tags) ? ext.tags : [];
    if (tags.length) continue;
    setEmployeeExtension(id, {
      ...ext,
      tags: ["office_staff"],
      updatedAt: new Date().toISOString(),
    });
    updated += 1;
  }
  return updated;
}

export async function clearAllEmployees(): Promise<{ deleted: number; message: string }> {
  const res = await apiClient<{ deleted: number; message: string }>("/hr/employees/clear-all", {
    method: "POST",
    body: {},
  });
  if (!res.data) throw new Error("Clear returned no data");
  return res.data;
}
