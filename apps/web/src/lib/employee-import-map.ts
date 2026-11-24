/** Map Excel/CSV workforce headers → normalized import rows (auto + manual mapping). */

export type NormalizedEmployeeImportRow = {
  employee_code: string;
  name: string;
  /** Sheet Status (Active / Inactive / etc.) — optional. */
  status?: string;
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
  uan?: string;
  aadhaar?: string;
  pan?: string;
  /** Education / certificates (sheet text — often Yes/No or file notes). */
  tenth_marksheet?: string;
  twelfth_marksheet?: string;
  basic_education?: string;
  higher_education?: string;
  degree?: string;
  /** Previous employer docs / notes. */
  previous_employer_offer?: string;
  previous_employer_experience?: string;
  /** Personal / employee-provided bank. */
  bank_account_number?: string;
  bank_name?: string;
  bank_ifsc?: string;
  /** Company salary account. */
  salary_bank_name?: string;
  salary_account_number?: string;
  salary_ifsc?: string;
  /** Joining / asset checklist (Yes/No or notes). */
  laptop?: string;
  dongle_sim?: string;
  joining_kits?: string;
  letter_of_intent?: string;
  appointment_letter?: string;
};

export type ImportFieldKey = keyof NormalizedEmployeeImportRow | "";

export const IMPORT_FIELD_OPTIONS: { value: ImportFieldKey; label: string }[] = [
  { value: "", label: "- Skip -" },
  { value: "status", label: "Status" },
  { value: "employee_code", label: "EMPLOYEE ID" },
  { value: "name", label: "NAME" },
  { value: "entity", label: "Entity" },
  { value: "organisation", label: "Organisation" },
  { value: "base_location", label: "Base Location" },
  { value: "designation", label: "Designation" },
  { value: "department", label: "Department" },
  { value: "reporting_manager", label: "Reporting Manager" },
  { value: "joining_date", label: "DOJ" },
  { value: "mobile", label: "Emp.Contact No." },
  { value: "personal_email", label: "Email id" },
  { value: "email", label: "cache email id" },
  { value: "gender", label: "Gender" },
  { value: "dob", label: "DOB" },
  { value: "emergency_name", label: "Family Member Name" },
  { value: "emergency_relationship", label: "Relation" },
  { value: "emergency_phone", label: "Contact No." },
  { value: "father_name", label: "Fathers name" },
  { value: "esi", label: "ESI" },
  { value: "uan", label: "UAN No" },
  { value: "tenth_marksheet", label: "10th Marksheet" },
  { value: "twelfth_marksheet", label: "12th Marksheet" },
  { value: "basic_education", label: "Basic Education" },
  { value: "higher_education", label: "Higher Education" },
  { value: "degree", label: "Degree" },
  { value: "aadhaar", label: "Aadhar" },
  { value: "pan", label: "PAN" },
  { value: "previous_employer_offer", label: "Previous-Employer Offer" },
  {
    value: "previous_employer_experience",
    label: "Previous-Employer Experience letter",
  },
  { value: "bank_account_number", label: "Personal Account Number" },
  { value: "bank_name", label: "Bank Name" },
  { value: "bank_ifsc", label: "IFSC Code" },
  { value: "salary_bank_name", label: "Salary Bank Name" },
  { value: "salary_account_number", label: "Salary Account Num" },
  { value: "salary_ifsc", label: "Salary IFSC Code" },
  { value: "laptop", label: "Laptop" },
  { value: "dongle_sim", label: "Dongel and Sim" },
  { value: "joining_kits", label: "Joinning kits" },
  { value: "letter_of_intent", label: "Letter of Intent" },
  { value: "appointment_letter", label: "Appointment Letter" },
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
  status: "status",
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
  cache_email_id: "email",
  cache_email: "email",
  cache_mail: "email",
  cache_mail_id: "email",
  official_email: "email",
  work_email: "email",
  office_email: "email",
  email_id: "personal_email",
  personal_email: "personal_email",
  personal_email_id: "personal_email",
  personal_mail: "personal_email",
  private_email: "personal_email",
  email: "personal_email",
  mail: "personal_email",
  mobile: "mobile",
  phone: "mobile",
  emp_contact_no: "mobile",
  emp_contact: "mobile",
  employee_contact: "mobile",
  employee_contact_no: "mobile",
  contact_number: "mobile",
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
  uan: "uan",
  uan_no: "uan",
  uan_number: "uan",
  aadhar: "aadhaar",
  aadhaar: "aadhaar",
  aadhaar_no: "aadhaar",
  aadhar_no: "aadhaar",
  pan: "pan",
  pan_no: "pan",
  pan_number: "pan",
  "10th_marksheet": "tenth_marksheet",
  tenth_marksheet: "tenth_marksheet",
  marksheet_10th: "tenth_marksheet",
  "12th_marksheet": "twelfth_marksheet",
  twelfth_marksheet: "twelfth_marksheet",
  marksheet_12th: "twelfth_marksheet",
  basic_education: "basic_education",
  higher_education: "higher_education",
  degree: "degree",
  previous_employer_offer: "previous_employer_offer",
  previous_employer_offer_letter: "previous_employer_offer",
  prev_employer_offer: "previous_employer_offer",
  previous_employer_experience_letter: "previous_employer_experience",
  previous_employer_experience: "previous_employer_experience",
  prev_experience_letter: "previous_employer_experience",
  personal_account_number: "bank_account_number",
  personal_account_num: "bank_account_number",
  bank_account_number: "bank_account_number",
  account_number: "bank_account_number",
  bank_name: "bank_name",
  ifsc: "bank_ifsc",
  ifsc_code: "bank_ifsc",
  bank_ifsc: "bank_ifsc",
  salary_bank_name: "salary_bank_name",
  salary_account_num: "salary_account_number",
  salary_account_number: "salary_account_number",
  salary_ifsc: "salary_ifsc",
  salary_ifsc_code: "salary_ifsc",
  laptop: "laptop",
  dongel_and_sim: "dongle_sim",
  dongle_and_sim: "dongle_sim",
  dongle_sim: "dongle_sim",
  dongel: "dongle_sim",
  joinning_kits: "joining_kits",
  joining_kits: "joining_kits",
  joining_kit: "joining_kits",
  letter_of_intent: "letter_of_intent",
  loi: "letter_of_intent",
  appointment_letter: "appointment_letter",
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

/**
 * Auto-guess mapping from header names.
 * Duplicate IFSC headers: first → bank_ifsc, second → salary_ifsc.
 */
export function guessColumnMapping(headers: string[]): ImportFieldKey[] {
  const used = new Set<string>();
  return headers.map((h) => {
    if (!h || h === "sno" || h === "s_no" || h === "sr_no" || h === "srno") return "";

    if ((h === "ifsc" || h === "ifsc_code") && used.has("bank_ifsc") && !used.has("salary_ifsc")) {
      used.add("salary_ifsc");
      return "salary_ifsc";
    }

    let hit = HEADER_ALIASES[h];
    if (!hit && h.startsWith("10th")) hit = "tenth_marksheet";
    if (!hit && h.startsWith("12th")) hit = "twelfth_marksheet";

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
        `Row ${rowNum} (${out.employee_code}): no cache/personal email - placeholder will be used`,
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

export const EMPLOYEE_IMPORT_SAMPLE_CSV = `SNo,Status,EMPLOYEE ID,NAME,Entity,Organisation,Base Location,Designation,Department,Reporting Manager,DOJ,Emp.Contact No.,Email id,cache email id,Gender,DOB,Family Member Name,Relation,Contact No.,Fathers name,ESI,UAN No,10th Marksheet,12th Marksheet,Basic Education,Higher Education,Degree,Aadhar,PAN,Previous-Employer Offer,Previous-Employer Experience letter,Personal Account Number,Bank Name,IFSC Code,Salary Bank Name,Salary Account Num,Salary IFSC Code,Laptop,Dongel and Sim,Joinning kits,Letter of Intent,Appointment Letter
1,Active,EMP-1001,Jane Doe,digitech,Cache Digitech,Mumbai,HR Manager,Human Resources,Sana Qureshi,2024-04-01,9876543210,jane@gmail.com,jane@cache.com,Female,1990-01-15,John Doe,Spouse,9876500001,Robert Doe,Yes,100123456789,Yes,Yes,B.Com,MBA,MBA,1234 5678 9012,ABCDE1234F,Yes,Yes,501001234567,HDFC Bank,HDFC0001234,ICICI Bank,001234567890,ICIC0001234,Yes,Yes,Yes,Yes,Yes
2,Active,EMP-1002,Rahul Sharma,technology,Cache Technologies,Bengaluru,Developer,Engineering,Jane Doe,2024-05-01,9876543211,rahul@gmail.com,rahul@cache.com,Male,1992-06-20,Priya Sharma,Spouse,9876500002,Suresh Sharma,No,100987654321,Yes,Yes,B.Tech,M.Tech,B.Tech,2345 6789 0123,FGHIJ5678K,Yes,Yes,501009876543,SBI,SBIN0005678,Axis Bank,009876543210,UTIB0005678,Yes,No,Yes,Yes,Yes
`;
