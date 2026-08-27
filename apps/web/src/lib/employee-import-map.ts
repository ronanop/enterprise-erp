/** Map Excel/CSV workforce headers → normalized import rows (auto + manual mapping). */

export type NormalizedEmployeeImportRow = {
  employee_code: string;
  name: string;
  entity?: string;
  organisation?: string;
  base_location?: string;
  designation?: string;
  department?: string;
  reporting_manager?: string;
  /** Cache / official work email (API `email`). */
  email?: string;
  /** Personal / private email. */
  personal_email?: string;
  /** Emp. Contact No. */
  mobile?: string;
  /** Family / emergency Contact No. */
  emergency_phone?: string;
  emergency_name?: string;
  emergency_relationship?: string;
  father_name?: string;
  joining_date?: string;
  gender?: string;
  dob?: string;
  /** ESI / ESIC number or Yes/No. */
  esi?: string;
};

export type ImportFieldKey = keyof NormalizedEmployeeImportRow | "";

export const IMPORT_FIELD_OPTIONS: { value: ImportFieldKey; label: string }[] = [
  { value: "", label: "— Skip —" },
  { value: "employee_code", label: "EMPLOYEE ID / Emp Code" },
  { value: "name", label: "NAME" },
  { value: "entity", label: "Entity" },
  { value: "organisation", label: "Organisation" },
  { value: "base_location", label: "Base Location" },
  { value: "designation", label: "Designation" },
  { value: "department", label: "Department" },
  { value: "reporting_manager", label: "Reporting Manager" },
  { value: "email", label: "cache email id" },
  { value: "personal_email", label: "Email id" },
  { value: "mobile", label: "Emp. Contact No." },
  { value: "emergency_phone", label: "Contact No." },
  { value: "emergency_name", label: "Family Member Name" },
  { value: "emergency_relationship", label: "Relation" },
  { value: "father_name", label: "Fathers name" },
  { value: "joining_date", label: "DOJ" },
  { value: "gender", label: "Gender" },
  { value: "dob", label: "DOB" },
  { value: "esi", label: "ESI / ESIC" },
];

const HEADER_ALIASES: Record<string, keyof NormalizedEmployeeImportRow> = {
  emp_code: "employee_code",
  empcode: "employee_code",
  employee_code: "employee_code",
  employee_id: "employee_code",
  code: "employee_code",
  name: "name",
  employee_name: "name",
  full_name: "name",
  entity: "entity",
  company: "entity",
  legal_entity: "entity",
  organisation: "organisation",
  organization: "organisation",
  org: "organisation",
  base_location: "base_location",
  baselocation: "base_location",
  location: "base_location",
  work_location: "base_location",
  designation: "designation",
  job_title: "designation",
  department: "department",
  dept: "department",
  reporting_manager: "reporting_manager",
  reportingmanager: "reporting_manager",
  manager: "reporting_manager",
  rm: "reporting_manager",
  // Cache / official
  cache_email_id: "email",
  cache_email: "email",
  cache_mail: "email",
  cache_mail_id: "email",
  official_email: "email",
  work_email: "email",
  office_email: "email",
  // Personal
  email_id: "personal_email",
  personal_email: "personal_email",
  personal_email_id: "personal_email",
  personal_mail: "personal_email",
  private_email: "personal_email",
  email: "personal_email",
  mail: "personal_email",
  // Emp phone
  mobile: "mobile",
  phone: "mobile",
  emp_contact_no: "mobile",
  emp_contact: "mobile",
  employee_contact: "mobile",
  employee_contact_no: "mobile",
  contact_number: "mobile",
  // Family / emergency phone (distinct from Emp. Contact)
  contact_no: "emergency_phone",
  family_contact: "emergency_phone",
  family_contact_no: "emergency_phone",
  emergency_contact: "emergency_phone",
  emergency_phone: "emergency_phone",
  emergency_mobile: "emergency_phone",
  family_member_name: "emergency_name",
  family_member: "emergency_name",
  emergency_name: "emergency_name",
  emergency_contact_name: "emergency_name",
  relation: "emergency_relationship",
  relationship: "emergency_relationship",
  emergency_relationship: "emergency_relationship",
  fathers_name: "father_name",
  father_name: "father_name",
  father_s_name: "father_name",
  joining_date: "joining_date",
  date_of_joining: "joining_date",
  doj: "joining_date",
  gender: "gender",
  dob: "dob",
  date_of_birth: "dob",
  esi: "esi",
  esic: "esi",
  esi_no: "esi",
  esic_no: "esi",
};

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[\s\-./]+/g, "_")
    .replace(/_+/g, "_");
}

/** Find header row that contains Emp Code or Name. */
export function findEmployeeHeaderRow(matrix: string[][]): number {
  const needles = [
    "emp_code",
    "employee_code",
    "employee_id",
    "name",
    "empcode",
    "designation",
    "department",
  ];
  return matrix.findIndex((row) =>
    row.some((cell) => needles.includes(normHeader(String(cell ?? "")))),
  );
}

export function extractImportHeaders(matrix: string[][]): {
  headerIdx: number;
  headers: string[];
  displayHeaders: string[];
} {
  const headerIdx = findEmployeeHeaderRow(matrix);
  if (headerIdx < 0) {
    return { headerIdx: -1, headers: [], displayHeaders: [] };
  }
  const displayHeaders = matrix[headerIdx].map((h) => String(h ?? "").trim());
  const headers = displayHeaders.map((h) => normHeader(h));
  return { headerIdx, headers, displayHeaders };
}

/** Auto-guess mapping from header names. */
export function guessColumnMapping(headers: string[]): ImportFieldKey[] {
  const used = new Set<string>();
  return headers.map((h) => {
    if (!h || h === "sno" || h === "s_no" || h === "status") return "";
    const hit = HEADER_ALIASES[h];
    if (!hit || used.has(hit)) return "";
    used.add(hit);
    return hit;
  });
}

export function parseEmployeeImportWithMapping(
  matrix: string[][],
  headerIdx: number,
  columnMapping: ImportFieldKey[],
): {
  rows: NormalizedEmployeeImportRow[];
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (headerIdx < 0) {
    return {
      rows: [],
      warnings,
      errors: ["Could not find header row."],
    };
  }

  if (!columnMapping.includes("employee_code") || !columnMapping.includes("name")) {
    return {
      rows: [],
      warnings,
      errors: ["Map at least EMPLOYEE ID and NAME columns."],
    };
  }

  const rows: NormalizedEmployeeImportRow[] = [];
  matrix.slice(headerIdx + 1).forEach((cols, i) => {
    const rowNum = headerIdx + i + 2;
    if (!cols.some((c) => String(c ?? "").trim())) return;

    const out: NormalizedEmployeeImportRow = { employee_code: "", name: "" };
    columnMapping.forEach((key, idx) => {
      if (!key) return;
      const val = String(cols[idx] ?? "").trim();
      if (!val) return;
      (out as Record<string, string>)[key] = val;
    });

    if (!out.employee_code) {
      errors.push(`Row ${rowNum}: missing Emp Code`);
      return;
    }
    if (!out.name) {
      errors.push(`Row ${rowNum}: missing Name`);
      return;
    }
    if (!out.email && !out.personal_email) {
      warnings.push(
        `Row ${rowNum} (${out.employee_code}): no cache/personal email — placeholder will be used`,
      );
    }
    rows.push(out);
  });

  return { rows, warnings, errors };
}

/** Legacy auto-parse (aliases only). */
export function parseEmployeeImportMatrix(matrix: string[][]): {
  rows: NormalizedEmployeeImportRow[];
  warnings: string[];
  errors: string[];
} {
  const { headerIdx, headers } = extractImportHeaders(matrix);
  if (headerIdx < 0) {
    return {
      rows: [],
      warnings: [],
      errors: ["Could not find header row (need Emp Code / Name columns)."],
    };
  }
  return parseEmployeeImportWithMapping(matrix, headerIdx, guessColumnMapping(headers));
}

export const EMPLOYEE_IMPORT_SAMPLE_CSV = `Emp Code,NAME,Entity,Organisation,Base Location,Designation,Department,Reporting Manager,Emp. Contact No.,Email id,cache email id,Gender,DOB,DOJ,Family Member Name,Relation,Contact No.,Fathers name,ESI
EMP-1001,Jane Doe,digitech,Cache,Mumbai,HR Manager,Human Resources,Sana Qureshi,9876543210,jane@gmail.com,jane@cache.com,Female,1990-01-15,2024-04-01,John Doe,Spouse,9876500001,Robert Doe,Yes
EMP-1002,Rahul Sharma,technology,Cache,Bengaluru,Developer,Engineering,Jane Doe,9876543211,rahul@gmail.com,rahul@cache.com,Male,1992-06-20,2024-05-01,Priya Sharma,Spouse,9876500002,Suresh Sharma,No
`;
