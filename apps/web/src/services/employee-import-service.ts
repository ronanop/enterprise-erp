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
  type EmployeeDocumentItem,
  type EducationEntry,
  type EmployeeExtension,
  type PreviousEmploymentEntry,
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

function truthyEsi(raw: string | undefined): boolean {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return false;
  if (["no", "n", "false", "0", "-", "na", "n/a"].includes(v)) return false;
  return true;
}

function nonEmpty(raw: string | undefined): string {
  return String(raw || "").trim();
}

function docId(prefix: string, code: string): string {
  return `import-${prefix}-${code}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

function checklistDoc(
  employeeCode: string,
  documentType: string,
  value: string,
): EmployeeDocumentItem | null {
  const v = nonEmpty(value);
  if (!v) return null;
  return {
    id: docId(documentType, employeeCode),
    documentType,
    documentNumber: v,
    issueDate: "",
    expiryDate: "",
    fileName: v.match(/\.(pdf|png|jpe?g|docx?)$/i) ? v : `${documentType}: ${v}`,
    uploadedBy: "Import",
    uploadedAt: new Date().toISOString(),
    source: "hr",
  };
}

function educationFromImport(
  excel: NormalizedEmployeeImportRow,
  prev: EducationEntry[],
): EducationEntry[] {
  const next = [...prev];
  const upsert = (degree: string, note: string, field = "") => {
    const value = nonEmpty(note);
    if (!value) return;
    const idx = next.findIndex((e) => e.degree.toLowerCase() === degree.toLowerCase());
    const row: EducationEntry = {
      id: idx >= 0 ? next[idx].id : `import-edu-${degree}-${Date.now()}`,
      degree,
      institution: idx >= 0 ? next[idx].institution : "",
      field: field || (idx >= 0 ? next[idx].field : ""),
      year: idx >= 0 ? next[idx].year : "",
      grade: idx >= 0 ? next[idx].grade : "",
      certificateFileName: value,
    };
    if (idx >= 0) next[idx] = { ...next[idx], ...row };
    else next.push(row);
  };

  upsert("10th", excel.tenth_marksheet || "", "Secondary");
  upsert("12th", excel.twelfth_marksheet || "", "Higher Secondary");
  if (nonEmpty(excel.basic_education)) {
    upsert(nonEmpty(excel.basic_education) || "Basic Education", excel.basic_education || "");
  }
  if (nonEmpty(excel.higher_education)) {
    upsert(nonEmpty(excel.higher_education) || "Higher Education", excel.higher_education || "");
  }
  if (nonEmpty(excel.degree)) {
    upsert(nonEmpty(excel.degree), excel.degree || "");
  }
  return next;
}

function previousEmploymentFromImport(
  excel: NormalizedEmployeeImportRow,
  prev: PreviousEmploymentEntry[],
): PreviousEmploymentEntry[] {
  const offer = nonEmpty(excel.previous_employer_offer);
  const experience = nonEmpty(excel.previous_employer_experience);
  if (!offer && !experience) return prev;
  if (prev.length) {
    return prev.map((row, i) =>
      i === 0
        ? {
          ...row,
          reasonForLeaving: [offer && `Offer: ${offer}`, experience && `Experience letter: ${experience}`]
            .filter(Boolean)
            .join(" · ") || row.reasonForLeaving,
        }
        : row,
    );
  }
  return [
    {
      id: `import-prev-${Date.now()}`,
      company: "Previous employer (from import)",
      designation: "",
      fromDate: "",
      toDate: "",
      lastCtc: "",
      reasonForLeaving: [offer && `Offer: ${offer}`, experience && `Experience letter: ${experience}`]
        .filter(Boolean)
        .join(" · "),
    },
  ];
}

function mergeImportDocuments(
  employeeCode: string,
  excel: NormalizedEmployeeImportRow,
  prevDocs: EmployeeDocumentItem[],
): EmployeeDocumentItem[] {
  const byType = new Map(prevDocs.map((d) => [d.documentType.toLowerCase(), d]));
  const candidates: Array<[string, string | undefined]> = [
    ["10th Marksheet", excel.tenth_marksheet],
    ["12th Marksheet", excel.twelfth_marksheet],
    ["Previous-Employer Offer", excel.previous_employer_offer],
    ["Previous-Employer Experience letter", excel.previous_employer_experience],
    ["Laptop", excel.laptop],
    ["Dongel and Sim", excel.dongle_sim],
    ["Joinning kits", excel.joining_kits],
    ["Letter of Intent", excel.letter_of_intent],
    ["Appointment Letter", excel.appointment_letter],
  ];
  for (const [type, value] of candidates) {
    const doc = checklistDoc(employeeCode, type, value || "");
    if (!doc) continue;
    byType.set(type.toLowerCase(), doc);
  }
  return Array.from(byType.values());
}

function normalizeLifecycleStatus(
  raw: string | undefined,
): EmployeeExtension["employment"]["lifecycleStatus"] | null {
  const v = nonEmpty(raw).toLowerCase();
  if (!v) return null;
  if (["active", "a"].includes(v)) return "active";
  if (["inactive", "i"].includes(v)) return "inactive";
  if (["probation", "prob"].includes(v)) return "probation";
  if (["onboarding", "onboard"].includes(v)) return "onboarding";
  if (["notice"].includes(v)) return "notice";
  if (["resigned", "exit", "separated"].includes(v)) return "resigned";
  if (["archived"].includes(v)) return "archived";
  return null;
}

/**
 * Persist Excel Entity / contact / email / family / bank / education fields onto
 * local extensions so the employee profile shows sheet values after import.
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
    const location = nonEmpty(excel.base_location || res.base_location);
    const managerRaw = nonEmpty(excel.reporting_manager);
    const managerName = isBlankManager(managerRaw) ? "" : managerRaw;
    const entityName = entityDisplayName(excel.entity, res.company);
    const cacheEmail = nonEmpty(excel.email);
    const personalEmail = nonEmpty(excel.personal_email);
    const mobile = nonEmpty(excel.mobile);
    const gender = nonEmpty(excel.gender);
    const dob = nonEmpty(excel.dob);
    const joining = nonEmpty(excel.joining_date);
    const fatherName = nonEmpty(excel.father_name);
    const esiRaw = nonEmpty(excel.esi);
    const uan = nonEmpty(excel.uan);
    const aadhaar = nonEmpty(excel.aadhaar);
    const pan = nonEmpty(excel.pan);
    const bankAccount = nonEmpty(excel.bank_account_number);
    const bankName = nonEmpty(excel.bank_name);
    const bankIfsc = nonEmpty(excel.bank_ifsc);
    const salaryBank = nonEmpty(excel.salary_bank_name);
    const salaryAccount = nonEmpty(excel.salary_account_number);
    const salaryIfsc = nonEmpty(excel.salary_ifsc);
    const lifecycle = normalizeLifecycleStatus(excel.status);
    const organisation = nonEmpty(excel.organisation);

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
        emergency: {
          name: nonEmpty(excel.emergency_name) || prev.personal.emergency.name || "",
          phone: nonEmpty(excel.emergency_phone) || prev.personal.emergency.phone || "",
          relationship:
            nonEmpty(excel.emergency_relationship) ||
            prev.personal.emergency.relationship ||
            "",
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
        // Organisation from sheet — keep visible via branchName when master branch is empty.
        branchName: organisation || prev.employment.branchName,
        designationName: nonEmpty(
          excel.designation || res.designation || prev.employment.designationName,
        ),
        departmentName: nonEmpty(excel.department || prev.employment.departmentName),
        reportingManagerName: managerName || prev.employment.reportingManagerName || "",
        lifecycleStatus: lifecycle || prev.employment.lifecycleStatus,
      },
      governmentIds: {
        ...emptyGovernmentIds(),
        ...prev.governmentIds,
        aadhaar: aadhaar || prev.governmentIds.aadhaar,
        pan: pan || prev.governmentIds.pan,
        uan: uan || prev.governmentIds.uan,
        esic:
          esiRaw &&
            !["yes", "y", "true", "1", "no", "n", "false", "0"].includes(esiRaw.toLowerCase())
            ? esiRaw
            : prev.governmentIds.esic,
      },
      bank: {
        ...emptyBank(),
        ...prev.bank,
        accountHolderName: prev.bank.accountHolderName || excel.name || "",
        bankName: bankName || prev.bank.bankName,
        accountNumber: bankAccount || prev.bank.accountNumber,
        confirmAccountNumber: bankAccount || prev.bank.confirmAccountNumber,
        ifsc: bankIfsc || prev.bank.ifsc,
      },
      companyBank: {
        ...emptyBank(),
        ...prev.companyBank,
        accountHolderName: prev.companyBank.accountHolderName || excel.name || "",
        bankName: salaryBank || prev.companyBank.bankName,
        accountNumber: salaryAccount || prev.companyBank.accountNumber,
        confirmAccountNumber: salaryAccount || prev.companyBank.confirmAccountNumber,
        ifsc: salaryIfsc || prev.companyBank.ifsc,
      },
      salary: {
        ...emptySalary(),
        ...prev.salary,
        esi: esiRaw ? truthyEsi(esiRaw) : prev.salary.esi,
      },
      education: educationFromImport(excel, prev.education ?? []),
      previousEmployment: previousEmploymentFromImport(
        excel,
        prev.previousEmployment ?? [],
      ),
      documents: mergeImportDocuments(code, excel, prev.documents ?? []),
      updatedBy: "Import",
      updatedAt: new Date().toISOString(),
    });
  }
}

/** API only accepts master fields; cache email → email, Emp contact → mobile. */
function toApiImportRows(rows: NormalizedEmployeeImportRow[]) {
  return rows.map((r) => ({
    employee_code: r.employee_code,
    name: r.name,
    entity: r.entity,
    organisation: r.organisation,
    base_location: r.base_location,
    designation: r.designation,
    department: r.department,
    reporting_manager: r.reporting_manager,
    email: (r.email || r.personal_email || "").trim() || undefined,
    mobile: r.mobile,
    joining_date: r.joining_date,
  }));
}

export async function bulkImportEmployees(
  rows: NormalizedEmployeeImportRow[],
): Promise<EmployeeImportResponse> {
  const res = await apiClient<EmployeeImportResponse>("/hr/employees/bulk-import", {
    method: "POST",
    body: { rows: toApiImportRows(rows) },
  });
  if (!res.data) throw new Error("Import returned no data");
  syncImportedExcelFieldsToExtensions(rows, res.data.results || []);
  return res.data;
}

export async function clearAllEmployees(): Promise<{ deleted: number; message: string }> {
  const res = await apiClient<{ deleted: number; message: string }>("/hr/employees/clear-all", {
    method: "POST",
    body: {},
  });
  if (!res.data) throw new Error("Clear returned no data");
  return res.data;
}
