/** Map Excel/CSV workforce headers → normalized import rows. */

export type NormalizedEmployeeImportRow = {
  employee_code: string;
  name: string;
  entity?: string;
  organisation?: string;
  base_location?: string;
  designation?: string;
  department?: string;
  reporting_manager?: string;
  email?: string;
  mobile?: string;
  joining_date?: string;
};

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
  email: "email",
  official_email: "email",
  mail: "email",
  mobile: "mobile",
  phone: "mobile",
  joining_date: "joining_date",
  date_of_joining: "joining_date",
  doj: "joining_date",
};

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s\-./]+/g, "_")
    .replace(/_+/g, "_");
}

/** Find header row that contains Emp Code or Name. */
export function findEmployeeHeaderRow(matrix: string[][]): number {
  const needles = ["emp_code", "employee_code", "name", "empcode"];
  return matrix.findIndex((row) =>
    row.some((cell) => needles.includes(normHeader(String(cell ?? "")))),
  );
}

export function parseEmployeeImportMatrix(matrix: string[][]): {
  rows: NormalizedEmployeeImportRow[];
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const headerIdx = findEmployeeHeaderRow(matrix);
  if (headerIdx < 0) {
    return {
      rows: [],
      warnings,
      errors: ["Could not find header row (need Emp Code / Name columns)."],
    };
  }

  const headers = matrix[headerIdx].map((h) => normHeader(String(h ?? "")));
  const mappedKeys = headers.map((h) => HEADER_ALIASES[h] ?? null);
  if (!mappedKeys.includes("employee_code") && !mappedKeys.includes("name")) {
    return {
      rows: [],
      warnings,
      errors: ["Header must include Emp Code and Name."],
    };
  }

  const rows: NormalizedEmployeeImportRow[] = [];
  matrix.slice(headerIdx + 1).forEach((cols, i) => {
    const rowNum = headerIdx + i + 2;
    if (!cols.some((c) => String(c ?? "").trim())) return;

    const out: NormalizedEmployeeImportRow = { employee_code: "", name: "" };
    mappedKeys.forEach((key, idx) => {
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
    if (!out.email) {
      warnings.push(`Row ${rowNum} (${out.employee_code}): no email — placeholder will be used`);
    }
    rows.push(out);
  });

  return { rows, warnings, errors };
}

export const EMPLOYEE_IMPORT_SAMPLE_CSV = `Emp Code,NAME,Entity,Organisation,Base Location,Designation,Department,Reporting Manager
EMP-1001,Jane Doe,digitech,Cache,Mumbai,HR Manager,Human Resources,Sana Qureshi
EMP-1002,Rahul Sharma,technology,Cache,Bengaluru,Developer,Engineering,Jane Doe
`;
