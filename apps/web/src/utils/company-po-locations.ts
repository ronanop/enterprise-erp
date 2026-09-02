/** Issuing entity addresses for vendor PO PDFs and create-PO forms. */

const KAILASH_ADDRESS_LINES = [
  "L-31, Kailash Colony,",
  "New Delhi,",
  "Delhi-110048,",
  "India",
] as const;

const SULTANPUR_ADDRESS_LINES = [
  "CRC-2 , Ground Floor , Khasra No 337 ,",
  "M.G Road , Sultanpur",
  "New Delhi - 110030",
] as const;

const MUMBAI_ADDRESS_LINES = [
  "404 , C-Wing , Eastern Court Junction",
  "Mumbai",
  "Maharashtra - 400057",
  "India",
  "Tel: 011-47105700-25",
] as const;

export type CompanyPoLocation = {
  id: string;
  label: string;
  addressHeader: string;
  entityCode: string;
  gstState: string;
  addressLines: readonly string[];
  lockShippingToEntity: boolean;
};

export type CompanyPoShippingOption = {
  id: string;
  label: string;
  addressLines: readonly string[];
};

export const COMPANY_PO_LOCATIONS: CompanyPoLocation[] = [
  {
    id: "kailash-colony",
    label: "Cache DigiTech Pvt. Ltd. (CDT)",
    addressHeader: "Cache DigiTech Pvt. Ltd.",
    entityCode: "CDT",
    gstState: "Delhi",
    addressLines: KAILASH_ADDRESS_LINES,
    lockShippingToEntity: false,
  },
  {
    id: "cache-technology",
    label: "Cache Technologies (CT)",
    addressHeader: "Cache Technologies",
    entityCode: "CT",
    gstState: "Delhi",
    addressLines: KAILASH_ADDRESS_LINES,
    lockShippingToEntity: false,
  },
  {
    id: "cache-digitech-mumbai",
    label: "Cache DigiTech Pvt. Ltd. Mumbai (CMT)",
    addressHeader: "Cache DigiTech Pvt. Ltd.",
    entityCode: "CMT",
    gstState: "Maharashtra",
    addressLines: MUMBAI_ADDRESS_LINES,
    lockShippingToEntity: true,
  },
];

export const COMPANY_PO_SHIPPING_OPTIONS: CompanyPoShippingOption[] = [
  {
    id: "kailash-colony",
    label: "Kailash Colony, New Delhi",
    addressLines: KAILASH_ADDRESS_LINES,
  },
  {
    id: "sultanpur",
    label: "CRC-2, Sultanpur, New Delhi",
    addressLines: SULTANPUR_ADDRESS_LINES,
  },
  {
    id: "mumbai-eastern-court",
    label: "Eastern Court, Mumbai",
    addressLines: MUMBAI_ADDRESS_LINES,
  },
];

export const DEFAULT_COMPANY_PO_LOCATION = COMPANY_PO_LOCATIONS[0];
export const DEFAULT_COMPANY_PO_SHIPPING_OPTION = COMPANY_PO_SHIPPING_OPTIONS[0];

export function formatCompanyBillingAddress(location: CompanyPoLocation | undefined): string {
  if (!location) return "";
  return [location.addressHeader, ...location.addressLines].join("\n");
}

export function formatCompanyShippingAddress(
  entityHeader: string,
  shippingOptionId: string,
): string {
  const option =
    COMPANY_PO_SHIPPING_OPTIONS.find((row) => row.id === shippingOptionId) ||
    COMPANY_PO_SHIPPING_OPTIONS[0];
  return [entityHeader, ...option.addressLines].join("\n");
}

export function companyPoLocationById(locationId: string): CompanyPoLocation {
  return COMPANY_PO_LOCATIONS.find((row) => row.id === locationId) ?? DEFAULT_COMPANY_PO_LOCATION;
}

export function companyPoLocationByEntityCode(entityCode: string): CompanyPoLocation {
  const code = entityCode.trim().toUpperCase();
  return (
    COMPANY_PO_LOCATIONS.find((row) => row.entityCode === code) ?? DEFAULT_COMPANY_PO_LOCATION
  );
}

export function defaultShippingIdForLocation(location: CompanyPoLocation): string {
  return location.lockShippingToEntity ? "mumbai-eastern-court" : DEFAULT_COMPANY_PO_SHIPPING_OPTION.id;
}

export function shippingOptionsForLocation(location: CompanyPoLocation): Array<{
  id: string;
  address: string;
}> {
  return COMPANY_PO_SHIPPING_OPTIONS.map((option) => ({
    id: option.id,
    address: formatCompanyShippingAddress(location.addressHeader, option.id),
  }));
}
