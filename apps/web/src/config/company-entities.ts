/** Entity branding for PO / delivery challan (aligned with SCM create PO). */

const KAILASH_LINES = [
  "L-31 Ground Floor, Kailash Colony,",
  "New Delhi,",
  "Delhi-110048,",
  "India",
  "Tel: 011-47105700-25",
] as const;

const MUMBAI_LINES = [
  "404 , C-Wing , Eastern Court Junction",
  "Mumbai",
  "Maharashtra - 400057",
  "India",
  "Tel: 011-47105700-25",
] as const;

export type CompanyEntityConfig = {
  entityCode: string;
  displayName: string;
  addressLines: readonly string[];
  gstBlock: string;
};

const ENTITIES: CompanyEntityConfig[] = [
  {
    entityCode: "CDT",
    displayName: "Cache DigiTech Pvt. Ltd.",
    addressLines: KAILASH_LINES,
    gstBlock: [
      "GSTIN/UIN: 07AAACC4248H1ZU",
      "GSTIN/UIN: 27AAACC4248H1Z2",
      "GSTIN/UIN: 09AAACC4248H1Z0",
      "GSTIN/UIN: 06AAACC4248H1Z2",
      "Tel: 011-47105700-25",
    ].join("\n"),
  },
  {
    entityCode: "CT",
    displayName: "Cache Technologies",
    addressLines: KAILASH_LINES,
    gstBlock: [
      "GSTIN/UIN: 07AAACC4248H1ZU",
      "GSTIN/UIN: 27AAACC4248H1Z2",
      "GSTIN/UIN: 09AAACC4248H1Z0",
      "GSTIN/UIN: 06AAACC4248H1Z2",
      "Tel: 011-47105700-25",
    ].join("\n"),
  },
  {
    entityCode: "CMT",
    displayName: "Cache DigiTech Pvt. Ltd.",
    addressLines: MUMBAI_LINES,
    gstBlock: [
      "GSTIN/UIN: 27AAACC4248H1Z2",
      "Tel: 011-47105700-25",
    ].join("\n"),
  },
];

export function entityCodeFromCompanyPo(companyPo: string | null | undefined): string | null {
  const value = (companyPo || "").trim();
  const match = value.match(/^PO\/([^/]+)\//i);
  return match?.[1]?.toUpperCase() ?? null;
}

export function resolveCompanyEntity(
  entityCode: string | null | undefined,
  companyPoNumber?: string | null,
): CompanyEntityConfig {
  const code =
    (entityCode || "").trim().toUpperCase() ||
    entityCodeFromCompanyPo(companyPoNumber) ||
    "CDT";
  return ENTITIES.find((row) => row.entityCode === code) ?? ENTITIES[0];
}

export function formatEntityAddressBlock(entity: CompanyEntityConfig): string {
  return [entity.displayName, ...entity.addressLines].join("\n");
}

/** First two digits of GSTIN → state (for picking one registration per PO entity). */
const GSTIN_STATE_PREFIX: Record<string, string> = {
  delhi: "07",
  maharashtra: "27",
  "uttar pradesh": "09",
  haryana: "06",
};

/** Single GSTIN line (+ tel) for the entity’s dispatch state on PO/challan. */
export function formatEntityGstBlock(
  entity: CompanyEntityConfig,
  gstState?: string | null,
): string {
  const lines = entity.gstBlock
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const gstLines = lines.filter((line) => /^GSTIN/i.test(line));
  const telLine = lines.find((line) => /^Tel:/i.test(line));

  const stateKey = (gstState || "").trim().toLowerCase();
  const prefix = GSTIN_STATE_PREFIX[stateKey];
  let gstLine = gstLines[0] ?? "";
  if (prefix) {
    const matched = gstLines.find((line) => {
      const digits = line.match(/GSTIN\/UIN:\s*(\d{2})/i)?.[1];
      return digits === prefix;
    });
    if (matched) gstLine = matched;
  }

  return [gstLine, telLine].filter(Boolean).join("\n");
}

/** GST state for the dispatching entity (aligned with SCM create PO locations). */
export function entityGstState(
  entityCode: string | null | undefined,
  companyPoNumber?: string | null,
): string {
  const code =
    (entityCode || "").trim().toUpperCase() ||
    entityCodeFromCompanyPo(companyPoNumber) ||
    "CDT";
  if (code === "CMT") return "Maharashtra";
  return "Delhi";
}
