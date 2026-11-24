/** Merge fields for offer letter templates — tokens auto-fill when generating an offer. */

export type OfferMergeField = {
  id: string;
  label: string;
  /** Inserted into the template body */
  token: string;
  /** Shown in template editor live preview */
  sample: string;
};

export const OFFER_MERGE_FIELDS: OfferMergeField[] = [
  {
    id: "candidate_full_name",
    label: "Candidate name",
    token: "[Candidate Full Name]",
    sample: "Raj Singh",
  },
  {
    id: "candidate_email",
    label: "Candidate email",
    token: "[Candidate Email]",
    sample: "raj.singh@email.com",
  },
  {
    id: "candidate_phone",
    label: "Candidate phone",
    token: "[Candidate Phone]",
    sample: "9876543210",
  },
  {
    id: "candidate_address",
    label: "Candidate address",
    token: "[Candidate Address]",
    sample: "12 MG Road, Bengaluru",
  },
  {
    id: "company_name",
    label: "Company name",
    token: "[Company Name]",
    sample: "Cache Digitech",
  },
  {
    id: "company_address",
    label: "Company address",
    token: "[Company Address]",
    sample: "Plot 21, Sector 62",
  },
  {
    id: "company_location",
    label: "Company location",
    token: "[Company Location]",
    sample: "Noida, Uttar Pradesh",
  },
  {
    id: "company_email",
    label: "Company email",
    token: "[Company Email]",
    sample: "hr@cachedigitech.com",
  },
  {
    id: "company_website",
    label: "Company website",
    token: "[Company Website]",
    sample: "www.cachedigitech.com",
  },
  {
    id: "role",
    label: "Job title / Role",
    token: "[Role]",
    sample: "Software Development Engineer",
  },
  {
    id: "department",
    label: "Department",
    token: "[Department]",
    sample: "Engineering",
  },
  {
    id: "ctc",
    label: "CTC / Salary",
    token: "[CTC]",
    sample: "₹12,00,000",
  },
  {
    id: "joining_date",
    label: "Joining date",
    token: "[Joining Date]",
    sample: "01/04/2026",
  },
  {
    id: "reporting_manager",
    label: "Reporting manager",
    token: "[Reporting Manager]",
    sample: "Amit Verma",
  },
  {
    id: "employment_type",
    label: "Employment type",
    token: "[Employment Type]",
    sample: "Full Time",
  },
  {
    id: "offer_date",
    label: "Offer date",
    token: "[DD/MM/YYYY]",
    sample: "30/10/2026",
  },
  {
    id: "offer_code",
    label: "Offer code",
    token: "[Offer Code]",
    sample: "OFF-000012",
  },
];

export type OfferMergeValues = Partial<Record<(typeof OFFER_MERGE_FIELDS)[number]["id"], string>>;

/** Sample values for template editor preview. */
export function sampleOfferMergeValues(): OfferMergeValues {
  const out: OfferMergeValues = {};
  for (const f of OFFER_MERGE_FIELDS) out[f.id] = f.sample;
  return out;
}

/** Replace all known tokens in body with values (missing → leave token or blank). */
export function applyOfferMergeFields(
  body: string,
  values: OfferMergeValues,
  opts?: { blankMissing?: boolean },
): string {
  let text = body || "";
  for (const field of OFFER_MERGE_FIELDS) {
    const raw = values[field.id];
    const value =
      raw != null && String(raw).trim()
        ? String(raw).trim()
        : opts?.blankMissing
          ? ""
          : field.token;
    // Escape regex special chars in token
    const re = new RegExp(field.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    text = text.replace(re, value);
  }
  return text;
}

export const DEFAULT_OFFER_TEMPLATE_BODY = `[Company Name]
[Company Address]
[Company Location]
Email: [Company Email] | Website: [Company Website]

Date: [DD/MM/YYYY]

To,
[Candidate Full Name]
[Candidate Address]
Email: [Candidate Email] | Phone: [Candidate Phone]

Dear [Candidate Full Name],

We are pleased to offer you the position of [Role] in the [Department] department at [Company Name].

1. Compensation
Your annual CTC will be [CTC].

2. Joining Date
Your proposed date of joining is [Joining Date].

3. Reporting
You will report to [Reporting Manager].

4. Employment Type
This offer is for [Employment Type] employment.

5. Leave and Holidays
You will be eligible for leaves, holidays, and other time-off benefits as per the company's leave policy and applicable statutory regulations.

6. Roles and Responsibilities
You will perform duties commensurate with the role of [Role] and as assigned by the company from time to time.

Please sign and return a copy of this letter to confirm your acceptance.

Offer reference: [Offer Code]

Regards,
HR Team
[Company Name]
`;
