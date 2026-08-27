/** Shared HR master dropdown options — single source of truth for labels and values. */

export type MasterOption = { value: string; label: string };

export const GENDER_OPTIONS: MasterOption[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export const MARITAL_STATUS_OPTIONS: MasterOption[] = [
  { value: "unmarried", label: "Unmarried" },
  { value: "married", label: "Married" },
];

export const RELATIONSHIP_OPTIONS: MasterOption[] = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "siblings", label: "Siblings" },
  { value: "spouse", label: "Spouse" },
];

export const EMPLOYMENT_TYPE_OPTIONS: MasterOption[] = [
  { value: "permanent", label: "Permanent" },
  { value: "intern", label: "Intern" },
  { value: "trainee", label: "Trainee" },
  { value: "contract", label: "Contractual" },
];

/** Includes legacy values so filters still match existing records. */
export const EMPLOYMENT_TYPE_FILTER_OPTIONS: MasterOption[] = [
  ...EMPLOYMENT_TYPE_OPTIONS,
  { value: "trainee_intern", label: "Trainee (Intern)" },
  { value: "consultant", label: "Consultant (legacy)" },
];

export const LIFECYCLE_STATUS_OPTIONS: MasterOption[] = [
  { value: "active", label: "Active" },
  { value: "onboarding", label: "Pending Join" },
  { value: "inactive", label: "Ex Employee" },
  { value: "probation", label: "Probation" },
  { value: "notice", label: "Notice" },
  { value: "archived", label: "Archived" },
];

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  permanent: "Permanent",
  contract: "Contractual",
  contractual: "Contractual",
  intern: "Intern",
  trainee: "Trainee",
  trainee_intern: "Trainee (Intern)",
  consultant: "Consultant",
  full_time: "Full Time",
  part_time: "Part Time",
};

const MARITAL_STATUS_LABELS: Record<string, string> = {
  unmarried: "Unmarried",
  single: "Unmarried",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  ...Object.fromEntries(RELATIONSHIP_OPTIONS.map((o) => [o.value, o.label])),
  brother: "Siblings",
  sister: "Siblings",
};

export function formatEmploymentTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return EMPLOYMENT_TYPE_LABELS[value.toLowerCase()] ?? value.replace(/_/g, " ");
}

export function formatMaritalStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return MARITAL_STATUS_LABELS[value.toLowerCase()] ?? value;
}

export function formatRelationshipLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const key = value.toLowerCase();
  return RELATIONSHIP_LABELS[key] ?? value;
}

export function normalizeEmploymentType(value: string | null | undefined): string {
  if (!value) return "permanent";
  const v = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (v === "trainee_intern") return "intern";
  if (v === "contractual") return "contract";
  return v;
}

/** Which duration field to collect for an employment type. */
export function employmentDurationKind(
  type: string | null | undefined,
): "probation" | "training" | "none" {
  const v = normalizeEmploymentType(type);
  if (v.includes("contract") || v === "consultant") return "none";
  if (v.includes("intern") || v.includes("trainee")) return "training";
  if (v === "permanent" || v === "full_time" || v === "fulltime") return "probation";
  return "none";
}
