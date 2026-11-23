/** Map Excel/CSV workforce headers → normalized import rows (auto + manual mapping). */

export type NormalizedEmployeeImportRow = {
  /** Target Emp Code (prefer \"New E codes\" when present). */
  employee_code: string;
  name: string;
  /** Old EMPLOYEE ID when Excel also has New E codes (rename on import). */
  previous_employee_code?: string;
  entity?: string;
  /** HRMS parent org label (e.g. Cache) — office imports only. */
  organisation?: string;
  /**
   * Client deployment org / site (where the employee is deployed).
   * Do not map this to Organisation — that is Cache / HRMS org.
   */
  deployed_at?: string;
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
  alternate_mobile?: string;
  /** Family / emergency Contact No. */
  emergency_phone?: string;
  emergency_name?: string;
  emergency_relationship?: string;
  father_name?: string;
  joining_date?: string;
  gender?: string;
  dob?: string;
  marital_status?: string;
  blood_group?: string;
  nationality?: string;
  aadhaar?: string;
  pan?: string;
  uan?: string;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  bank_holder?: string;
  /** Company / salary payroll bank (second bank block in Excel). */
  salary_bank_name?: string;
  salary_bank_account?: string;
  salary_bank_ifsc?: string;
  current_address?: string;
  permanent_address?: string;
  /** ESI / ESIC number or Yes/No. */
  esi?: string;
  /** Optional import status column. */
  status?: string;
  /**
   * Workforce tag: `office_staff` (office template) or `client_side` (client template).
   */
  tag?: string;
  /** Education / marksheets (Yes/No or file name). */
  marksheet_10th?: string;
  marksheet_12th?: string;
  basic_education?: string;
  higher_education?: string;
  degree?: string;
  /** Previous employer docs. */
  prev_employer_offer?: string;
  prev_employer_exp_letter?: string;
  /** Joining kit / assets / letters. */
  laptop?: string;
  dongle_sim?: string;
  joining_kit?: string;
  letter_of_intent?: string;
  appointment_letter?: string;
};

export type ImportFieldKey = keyof NormalizedEmployeeImportRow | "";

export const IMPORT_FIELD_OPTIONS: { value: ImportFieldKey; label: string; group: string }[] = [
  { value: "", label: "- Skip -", group: "General" },
  { value: "status", label: "Status", group: "General" },
  { value: "tag", label: "Tag (office_staff / client_side)", group: "General" },
  { value: "employee_code", label: "New E codes / Emp Code", group: "Identity" },
  {
    value: "previous_employee_code",
    label: "EMPLOYEE ID (old)",
    group: "Identity",
  },
  { value: "name", label: "NAME", group: "Identity" },
  { value: "entity", label: "Entity", group: "Organisation" },
  { value: "organisation", label: "Organisation (HRMS / Cache)", group: "Organisation" },
  {
    value: "deployed_at",
    label: "Deployed At (client site)",
    group: "Organisation",
  },
  { value: "base_location", label: "Base Location", group: "Organisation" },
  { value: "designation", label: "Designation", group: "Organisation" },
  { value: "department", label: "Department", group: "Organisation" },
  { value: "reporting_manager", label: "Reporting Manager", group: "Organisation" },
  { value: "email", label: "cache email id", group: "Contact" },
  { value: "personal_email", label: "Email id (personal)", group: "Contact" },
  { value: "mobile", label: "Emp. Contact No.", group: "Contact" },
  { value: "alternate_mobile", label: "Alternate mobile", group: "Contact" },
  { value: "emergency_phone", label: "Contact No. (Family / Emergency)", group: "Family" },
  { value: "emergency_name", label: "Family Member Name", group: "Family" },
  { value: "emergency_relationship", label: "Relation", group: "Family" },
  { value: "father_name", label: "Fathers name", group: "Family" },
  { value: "joining_date", label: "DOJ", group: "Personal" },
  { value: "gender", label: "Gender", group: "Personal" },
  { value: "dob", label: "DOB", group: "Personal" },
  { value: "marital_status", label: "Marital status", group: "Personal" },
  { value: "blood_group", label: "Blood group", group: "Personal" },
  { value: "nationality", label: "Nationality", group: "Personal" },
  { value: "current_address", label: "Current address", group: "Address" },
  { value: "permanent_address", label: "Permanent address", group: "Address" },
  { value: "aadhaar", label: "Aadhaar", group: "IDs" },
  { value: "pan", label: "PAN", group: "IDs" },
  { value: "uan", label: "UAN No", group: "IDs" },
  { value: "esi", label: "ESI / ESIC", group: "IDs" },
  { value: "bank_name", label: "Bank Name (personal)", group: "Personal bank" },
  { value: "bank_account", label: "Personal Account Number", group: "Personal bank" },
  { value: "bank_ifsc", label: "IFSC Code (personal)", group: "Personal bank" },
  { value: "bank_holder", label: "Bank account holder", group: "Personal bank" },
  { value: "salary_bank_name", label: "Salary Bank Name", group: "Salary bank" },
  { value: "salary_bank_account", label: "Salary Account Num", group: "Salary bank" },
  { value: "salary_bank_ifsc", label: "IFSC Code (salary)", group: "Salary bank" },
  { value: "marksheet_10th", label: "10th Marksheet", group: "Education" },
  { value: "marksheet_12th", label: "12th Marksheet", group: "Education" },
  { value: "basic_education", label: "Basic Education", group: "Education" },
  { value: "higher_education", label: "Higher Education", group: "Education" },
  { value: "degree", label: "Degree", group: "Education" },
  { value: "prev_employer_offer", label: "Previous-Employer Offer", group: "Previous employer" },
  {
    value: "prev_employer_exp_letter",
    label: "Previous-Employer Experience letter",
    group: "Previous employer",
  },
  { value: "laptop", label: "Laptop", group: "Joining kit / assets" },
  { value: "dongle_sim", label: "Dongle and Sim", group: "Joining kit / assets" },
  { value: "joining_kit", label: "Joining kits", group: "Joining kit / assets" },
  { value: "letter_of_intent", label: "Letter of Intent", group: "Letters" },
  { value: "appointment_letter", label: "Appointment Letter", group: "Letters" },
];

const HEADER_ALIASES: Record<string, keyof NormalizedEmployeeImportRow> = {
  emp_code: "employee_code",
  empcode: "employee_code",
  employee_code: "employee_code",
  employee_id: "employee_code",
  code: "employee_code",
  new_e_codes: "employee_code",
  new_e_code: "employee_code",
  new_emp_code: "employee_code",
  new_employee_code: "employee_code",
  new_employee_id: "employee_code",
  previous_employee_code: "previous_employee_code",
  previous_emp_code: "previous_employee_code",
  old_employee_code: "previous_employee_code",
  old_emp_code: "previous_employee_code",
  old_employee_id: "previous_employee_code",
  name: "name",
  employee_name: "name",
  full_name: "name",
  entity: "entity",
  company: "entity",
  legal_entity: "entity",
  organisation: "organisation",
  organization: "organisation",
  org: "organisation",
  deployed_at: "deployed_at",
  deployedat: "deployed_at",
  deployment: "deployed_at",
  deployment_organisation: "deployed_at",
  deployment_organization: "deployed_at",
  client: "deployed_at",
  client_name: "deployed_at",
  client_organisation: "deployed_at",
  client_organization: "deployed_at",
  client_site: "deployed_at",
  deploy_location: "deployed_at",
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
  status: "status",
  tag: "tag",
  tags: "tag",
  employee_tag: "tag",
  workforce_tag: "tag",
  staff_tag: "tag",
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
  empcontact_no: "mobile",
  empcontactno: "mobile",
  employee_contact: "mobile",
  employee_contact_no: "mobile",
  contact_number: "mobile",
  alternate_mobile: "alternate_mobile",
  alt_mobile: "alternate_mobile",
  alternate_phone: "alternate_mobile",
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
  sex: "gender",
  gender_mf: "gender",
  gender_m_f: "gender",
  emp_gender: "gender",
  employee_gender: "gender",
  gendar: "gender",
  dob: "dob",
  date_of_birth: "dob",
  marital_status: "marital_status",
  marital: "marital_status",
  marriage_status: "marital_status",
  blood_group: "blood_group",
  bloodgroup: "blood_group",
  blood: "blood_group",
  nationality: "nationality",
  aadhaar: "aadhaar",
  aadhar: "aadhaar",
  aadhaar_no: "aadhaar",
  aadhaar_number: "aadhaar",
  pan: "pan",
  pan_no: "pan",
  pan_number: "pan",
  uan: "uan",
  uan_no: "uan",
  uan_number: "uan",
  bank_name: "bank_name",
  bank: "bank_name",
  bank_account: "bank_account",
  bank_account_no: "bank_account",
  bank_account_number: "bank_account",
  account_number: "bank_account",
  account_no: "bank_account",
  personal_account_number: "bank_account",
  personal_account_no: "bank_account",
  personal_account: "bank_account",
  bank_ifsc: "bank_ifsc",
  ifsc: "bank_ifsc",
  ifsc_code: "bank_ifsc",
  bank_holder: "bank_holder",
  account_holder: "bank_holder",
  account_holder_name: "bank_holder",
  bank_account_holder: "bank_holder",
  salary_bank_name: "salary_bank_name",
  salary_bank: "salary_bank_name",
  salary_account_num: "salary_bank_account",
  salary_account_number: "salary_bank_account",
  salary_account_no: "salary_bank_account",
  salary_account: "salary_bank_account",
  salary_bank_account: "salary_bank_account",
  salary_bank_ifsc: "salary_bank_ifsc",
  salary_ifsc: "salary_bank_ifsc",
  salary_ifsc_code: "salary_bank_ifsc",
  current_address: "current_address",
  address: "current_address",
  present_address: "current_address",
  residential_address: "current_address",
  permanent_address: "permanent_address",
  permanant_address: "permanent_address",
  esi: "esi",
  esic: "esi",
  esi_no: "esi",
  esic_no: "esi",
  // Education / docs / kit
  "10th_marksheet": "marksheet_10th",
  tenth_marksheet: "marksheet_10th",
  marksheet_10th: "marksheet_10th",
  "12th_marksheet": "marksheet_12th",
  twelfth_marksheet: "marksheet_12th",
  marksheet_12th: "marksheet_12th",
  basic_education: "basic_education",
  higher_education: "higher_education",
  degree: "degree",
  previous_employer_offer: "prev_employer_offer",
  previousemployer_offer: "prev_employer_offer",
  prev_employer_offer: "prev_employer_offer",
  previous_employer_experience_letter: "prev_employer_exp_letter",
  previousemployer_experience_letter: "prev_employer_exp_letter",
  prev_employer_exp_letter: "prev_employer_exp_letter",
  experience_letter: "prev_employer_exp_letter",
  laptop: "laptop",
  dongel_and_sim: "dongle_sim",
  dongle_and_sim: "dongle_sim",
  dongle_sim: "dongle_sim",
  dongel: "dongle_sim",
  joinning_kits: "joining_kit",
  joining_kits: "joining_kit",
  joining_kit: "joining_kit",
  letter_of_intent: "letter_of_intent",
  loi: "letter_of_intent",
  appointment_letter: "appointment_letter",
};

function normHeader(h: string): string {
  return h
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[\s\-./]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Fuzzy fallback when exact alias misses (Excel header variants). */
function fuzzyAlias(h: string): keyof NormalizedEmployeeImportRow | "" {
  if (!h) return "";
  if (h.includes("emp") && h.includes("contact")) return "mobile";
  if (h.includes("family") && h.includes("contact")) return "emergency_phone";
  if (h === "contact_no" || (h.includes("contact") && !h.includes("email") && !h.includes("emp"))) {
    return "emergency_phone";
  }
  if (h.includes("personal") && h.includes("account")) return "bank_account";
  if (h.includes("salary") && h.includes("bank") && h.includes("name")) return "salary_bank_name";
  if (h.includes("salary") && (h.includes("account") || h.includes("num"))) {
    return "salary_bank_account";
  }
  if (h.includes("salary") && h.includes("ifsc")) return "salary_bank_ifsc";
  if (h.includes("10th") || h.includes("tenth")) return "marksheet_10th";
  if (h.includes("12th") || h.includes("twelfth")) return "marksheet_12th";
  if (h.includes("basic") && h.includes("education")) return "basic_education";
  if (h.includes("higher") && h.includes("education")) return "higher_education";
  if (h === "degree" || h.endsWith("_degree")) return "degree";
  if (h.includes("previous") && h.includes("offer")) return "prev_employer_offer";
  if (h.includes("experience") && h.includes("letter")) return "prev_employer_exp_letter";
  if (h.includes("laptop")) return "laptop";
  if (h.includes("dongel") || h.includes("dongle") || h.includes("sim")) return "dongle_sim";
  if (h.includes("joinning") || h.includes("joining")) return "joining_kit";
  if (h.includes("letter") && h.includes("intent")) return "letter_of_intent";
  if (h.includes("appointment")) return "appointment_letter";
  if (h.includes("aadhar")) return "aadhaar";
  if (h.includes("uan")) return "uan";
  if (h.includes("cache") && h.includes("email")) return "email";
  if (h === "tag" || h.endsWith("_tag") || h.includes("workforce_tag")) return "tag";
  if (
    h.includes("deployed") ||
    h.includes("deployment") ||
    (h.includes("client") && (h.includes("org") || h.includes("site") || h.includes("name")))
  ) {
    return "deployed_at";
  }
  return "";
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
  // Pad to the widest data row so trailing Excel columns are never dropped.
  const maxCols = matrix.reduce((m, row) => Math.max(m, row?.length ?? 0), 0);
  const headerRow = matrix[headerIdx] ?? [];
  const displayHeaders = Array.from({ length: maxCols }, (_, i) =>
    String(headerRow[i] ?? "").trim(),
  );
  const headers = displayHeaders.map((h) => normHeader(h));
  return { headerIdx, headers, displayHeaders };
}

/** Auto-guess mapping from header names. */
export function guessColumnMapping(headers: string[]): ImportFieldKey[] {
  const used = new Set<string>();
  const hasNewECode = headers.some((h) =>
    ["new_e_codes", "new_e_code", "new_emp_code", "new_employee_code", "new_employee_id"].includes(
      h,
    ),
  );
  return headers.map((h) => {
    if (!h || h === "sno" || h === "s_no" || h === "sr_no" || h === "serial_no") return "";
    // When \"New E codes\" exists, EMPLOYEE ID is the old code used for lookup/rename.
    if (
      hasNewECode &&
      (h === "employee_id" || h === "emp_code" || h === "empcode" || h === "employee_code")
    ) {
      if (!used.has("previous_employee_code")) {
        used.add("previous_employee_code");
        return "previous_employee_code";
      }
      return "";
    }
    let hit: ImportFieldKey = HEADER_ALIASES[h] ?? fuzzyAlias(h) ?? "";
    // Second IFSC / bank block → salary bank fields
    if (hit === "bank_ifsc" && used.has("bank_ifsc")) hit = "salary_bank_ifsc";
    if (hit === "bank_name" && used.has("bank_name") && h.includes("salary")) {
      hit = "salary_bank_name";
    }
    if (hit === "bank_account" && used.has("bank_account") && h.includes("salary")) {
      hit = "salary_bank_account";
    }
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

  const genderMapped = columnMapping.includes("gender");
  const genderLikeHeader = matrix[headerIdx]?.some((h) => {
    const n = normHeader(String(h ?? ""));
    return n.includes("gender") || n === "sex" || n.includes("gendar");
  });
  if (genderLikeHeader && !genderMapped) {
    warnings.push(
      "A Gender/Sex column was found but is not mapped — map it to Gender or gender will stay empty after import.",
    );
  }

  const rows: NormalizedEmployeeImportRow[] = [];
  let missingGender = 0;
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
        `Row ${rowNum} (${out.employee_code}): no cache/personal email - placeholder will be used`,
      );
    }
    if (genderMapped && !String(out.gender || "").trim()) {
      missingGender += 1;
    }
    rows.push(out);
  });

  if (genderMapped && missingGender > 0) {
    warnings.push(
      `${missingGender} row(s) have an empty Gender cell — those employees will not get gender on this import.`,
    );
  }

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

/** Office workforce template — Tag = office_staff; Organisation = HRMS org (Cache). */
export const EMPLOYEE_IMPORT_OFFICE_SAMPLE_CSV = `SNo,Status,Tag,EMPLOYEE ID,NAME,Entity,Organisation,Base Location,Designation,Department,Reporting Manager,DOJ,Emp.Contact No.,Email id,cache email id,Gender,DOB,Family Member Name,Relation,Contact No.,Fathers name,ESI,UAN No,10th Marksheet,12th Marksheet,Basic Education,Higher Education,Degree,Aadhar,PAN,Previous-Employer Offer,Previous-Employer Experience letter,Personal Account Number,Bank Name,IFSC Code,Salary Bank Name,Salary Account Num,IFSC Code,Laptop,Dongel and Sim,Joinning kits,Letter of Intent,Appointment Letter
1,Active,office_staff,CDPL0001,Jane Doe,Cache Digitech,Cache,Mumbai,HR Manager,Human Resources,Sana Qureshi,2024-04-01,9876543210,jane@gmail.com,jane@cache.com,Female,1990-01-15,John Doe,Spouse,9876500001,Robert Doe,Yes,100200300,Yes,Yes,Yes,Yes,MBA,123456789012,ABCDE1234F,Yes,Yes,50100123456789,HDFC,HDFC0001234,HDFC,50100999999999,HDFC0001234,Yes,Yes,Yes,Yes,Yes
`;

/**
 * Client-side workforce template — Tag = client_side.
 * \"Deployed At\" = client site (not HRMS Organisation / Cache).
 * Headers align with typical client deployment sheets.
 */
export const EMPLOYEE_IMPORT_CLIENT_SAMPLE_CSV = `Sr. No.,Status,Tag,EMPLOYEE ID,New E codes,NAME,Entity,Deployed At,Base Location,Designation,Department,Reporting Manager,DOJ,Emp. Contact No.,Email id,Gender,DOB
1,Active,client_side,CT5301,E0001,Ravi Kumar,Cache Technologies,Airtel - Pune,Pune,Engineer,Operations,Sana Qureshi,2024-06-01,9876543210,ravi@gmail.com,Male,1992-03-10
`;

/** @deprecated Use EMPLOYEE_IMPORT_OFFICE_SAMPLE_CSV */
export const EMPLOYEE_IMPORT_SAMPLE_CSV = EMPLOYEE_IMPORT_OFFICE_SAMPLE_CSV;

export type EmployeeImportTemplateKind = "office" | "client";

export function defaultTagForImportTemplate(kind: EmployeeImportTemplateKind): string {
  return kind === "client" ? "client_side" : "office_staff";
}
