"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  composePostalAddress,
  emptyPostalAddress,
  type VendorAddressEntry,
  type VendorPostalAddress,
} from "@/services/procurement-service";

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type VendorFormAddressBlock = {
  billing: VendorPostalAddress;
  shipping: VendorPostalAddress;
  gstNumber: string;
  sourceOfSupply: string;
  destinationOfSupply: string;
};

export type VendorFormDraft = {
  contactFirstName: string;
  contactLastName: string;
  vendorName: string;
  email: string;
  mobile: string;
  vendorType: string;
  addresses: VendorFormAddressBlock[];
};

export function emptyVendorFormAddressBlock(
  partial?: Partial<VendorFormAddressBlock>,
): VendorFormAddressBlock {
  const billing = emptyPostalAddress(partial?.billing);
  const shipping = emptyPostalAddress(partial?.shipping ?? partial?.billing);
  return {
    billing,
    shipping,
    gstNumber: partial?.gstNumber || "",
    sourceOfSupply: partial?.sourceOfSupply || "",
    destinationOfSupply: partial?.destinationOfSupply || "",
  };
}

export function emptyVendorFormDraft(
  partial?: Partial<VendorFormDraft> & {
    billing?: VendorPostalAddress;
    shipping?: VendorPostalAddress;
    gstNumber?: string;
    sourceOfSupply?: string;
    destinationOfSupply?: string;
  },
): VendorFormDraft {
  const addresses =
    partial?.addresses?.map((block) => emptyVendorFormAddressBlock(block)) ||
    (partial?.billing ||
    partial?.shipping ||
    partial?.gstNumber ||
    partial?.sourceOfSupply ||
    partial?.destinationOfSupply
      ? [
          emptyVendorFormAddressBlock({
            billing: partial.billing,
            shipping: partial.shipping,
            gstNumber: partial.gstNumber,
            sourceOfSupply: partial.sourceOfSupply,
            destinationOfSupply: partial.destinationOfSupply,
          }),
        ]
      : [emptyVendorFormAddressBlock()]);

  return {
    contactFirstName: partial?.contactFirstName || "",
    contactLastName: partial?.contactLastName || "",
    vendorName: partial?.vendorName || "",
    email: partial?.email || "",
    mobile: partial?.mobile || "",
    vendorType: partial?.vendorType || "domestic",
    addresses,
  };
}

export function vendorFormFromOption(row: {
  label: string;
  email?: string;
  mobile?: string;
  contactFirstName?: string;
  contactLastName?: string;
  vendorType?: string;
  taxNumber?: string;
  addressEntries?: VendorAddressEntry[];
  addresses?: string[];
}): VendorFormDraft {
  const entries =
    row.addressEntries?.filter((e) => e.address || e.billing || e.gstNumber) || [];
  const addressBlocks =
    entries.length > 0
      ? entries.map((entry, index) => {
          const vendorAddress =
            entry.billing ||
            entry.shipping ||
            emptyPostalAddress({
              street: entry.address || row.addresses?.[index] || "",
            });
          return emptyVendorFormAddressBlock({
            billing: vendorAddress,
            shipping: emptyPostalAddress(vendorAddress),
            gstNumber: entry.gstNumber || (index === 0 ? row.taxNumber || "" : ""),
            sourceOfSupply: entry.sourceOfSupply || "",
            destinationOfSupply: entry.destinationOfSupply || "",
          });
        })
      : [
          emptyVendorFormAddressBlock({
            billing: emptyPostalAddress({
              street: row.addresses?.[0] || "",
            }),
            gstNumber: row.taxNumber || "",
          }),
        ];

  return emptyVendorFormDraft({
    contactFirstName: row.contactFirstName,
    contactLastName: row.contactLastName,
    vendorName: row.label,
    email: row.email,
    mobile: row.mobile,
    vendorType: row.vendorType || "domestic",
    addresses: addressBlocks,
  });
}

export function buildVendorAddressEntriesFromForm(
  draft: VendorFormDraft,
): VendorAddressEntry[] {
  return draft.addresses.map((block) => {
    const vendorAddress = emptyPostalAddress(block.billing);
    return {
      address: composePostalAddress(vendorAddress),
      gstNumber: block.gstNumber.trim(),
      sourceOfSupply: block.sourceOfSupply.trim(),
      destinationOfSupply: block.destinationOfSupply.trim(),
      billing: vendorAddress,
      // Vendors use one address for billing and shipping.
      shipping: emptyPostalAddress(vendorAddress),
    };
  });
}

/** @deprecated Use buildVendorAddressEntriesFromForm */
export function buildVendorAddressEntryFromForm(
  draft: VendorFormDraft,
): VendorAddressEntry {
  return buildVendorAddressEntriesFromForm(draft)[0] ?? {
    address: "",
    gstNumber: "",
    sourceOfSupply: "",
    destinationOfSupply: "",
  };
}

export function validateAddressBlock(
  block: VendorFormAddressBlock,
  index: number,
): string | null {
  const label = index === 0 ? "Primary address" : `Address ${index + 1}`;
  const vendorAddress = block.billing;
  if (
    !vendorAddress.country.trim() ||
    !vendorAddress.street.trim() ||
    !vendorAddress.city.trim() ||
    !vendorAddress.state.trim() ||
    !vendorAddress.pincode.trim()
  ) {
    return `${label}: vendor address requires country, street, city, state, and pincode.`;
  }
  if (!block.gstNumber.trim()) return `${label}: GST number is required.`;
  if (!block.sourceOfSupply.trim()) return `${label}: source of supply is required.`;
  if (!block.destinationOfSupply.trim()) {
    return `${label}: destination of supply is required.`;
  }
  return null;
}

export function validateVendorFormDraft(draft: VendorFormDraft): string | null {
  if (!draft.vendorName.trim()) return "Vendor name is required.";
  if (!draft.contactFirstName.trim() || !draft.contactLastName.trim()) {
    return "Primary contact first name and last name are required.";
  }
  if (!draft.email.trim()) return "Email is required.";
  if (!draft.mobile.trim()) return "Phone is required.";
  if (draft.addresses.length === 0) return "Add at least one address.";
  for (let i = 0; i < draft.addresses.length; i += 1) {
    const err = validateAddressBlock(draft.addresses[i], i);
    if (err) return err;
  }
  return null;
}

type Props = {
  value: VendorFormDraft;
  onChange: (next: VendorFormDraft) => void;
  disabled?: boolean;
  showVendorType?: boolean;
  vendorNamePlaceholder?: string;
};

function PostalAddressFields({
  title,
  value,
  onChange,
  disabled,
  headerAction,
}: {
  title: string;
  value: VendorPostalAddress;
  onChange: (next: VendorPostalAddress) => void;
  disabled?: boolean;
  headerAction?: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {headerAction}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FinanceField label="Country *">
          <Input
            value={value.country}
            onChange={(e) => onChange({ ...value, country: e.target.value })}
            className="h-9"
            disabled={disabled}
          />
        </FinanceField>
        <FinanceField label="Pincode *">
          <Input
            value={value.pincode}
            onChange={(e) => onChange({ ...value, pincode: e.target.value })}
            className="h-9"
            disabled={disabled}
          />
        </FinanceField>
      </div>
      <FinanceField label="Street *">
        <Input
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          className="h-9"
          disabled={disabled}
        />
      </FinanceField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FinanceField label="City *">
          <Input
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            className="h-9"
            disabled={disabled}
          />
        </FinanceField>
        <FinanceField label="State *">
          <FinanceSelect
            value={value.state}
            onChange={(e) => onChange({ ...value, state: e.target.value })}
            disabled={disabled}
          >
            <option value="">Select state…</option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </FinanceSelect>
        </FinanceField>
      </div>
    </div>
  );
}

export function VendorAddressBlockFields({
  index,
  block,
  onChange,
  onRemove,
  canRemove,
  disabled,
}: {
  index: number;
  block: VendorFormAddressBlock;
  onChange: (next: VendorFormAddressBlock) => void;
  onRemove: () => void;
  canRemove: boolean;
  disabled?: boolean;
}) {
  const title = index === 0 ? "Primary address" : `Address ${index + 1}`;

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-card p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {title}
        </p>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 cursor-pointer gap-1 px-2 text-xs text-destructive transition-colors duration-200 hover:bg-destructive/10 hover:text-destructive"
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        ) : null}
      </div>

      <PostalAddressFields
        title="Vendor address *"
        value={block.billing}
        onChange={(vendorAddress) =>
          onChange({
            ...block,
            billing: vendorAddress,
            shipping: emptyPostalAddress(vendorAddress),
          })
        }
        disabled={disabled}
      />

      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tax & supply
        </p>
        <FinanceField label="GST number *">
          <Input
            value={block.gstNumber}
            onChange={(e) => onChange({ ...block, gstNumber: e.target.value })}
            className="h-9"
            disabled={disabled}
          />
        </FinanceField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FinanceField label="Source of supply *">
            <FinanceSelect
              value={block.sourceOfSupply}
              onChange={(e) =>
                onChange({ ...block, sourceOfSupply: e.target.value })
              }
              disabled={disabled}
            >
              <option value="">Select state…</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
          <FinanceField label="Destination of supply *">
            <FinanceSelect
              value={block.destinationOfSupply}
              onChange={(e) =>
                onChange({ ...block, destinationOfSupply: e.target.value })
              }
              disabled={disabled}
            >
              <option value="">Select state…</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
        </div>
      </div>
    </div>
  );
}

export function VendorFormFields({
  value,
  onChange,
  disabled,
  showVendorType = true,
  vendorNamePlaceholder = "Vendor / OEM name",
}: Props) {
  function updateAddress(index: number, next: VendorFormAddressBlock) {
    const addresses = [...value.addresses];
    addresses[index] = next;
    onChange({ ...value, addresses });
  }

  function addAddress() {
    onChange({
      ...value,
      addresses: [...value.addresses, emptyVendorFormAddressBlock()],
    });
  }

  function removeAddress(index: number) {
    if (value.addresses.length <= 1) return;
    onChange({
      ...value,
      addresses: value.addresses.filter((_, i) => i !== index),
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Primary contact
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FinanceField label="First name *">
            <Input
              value={value.contactFirstName}
              onChange={(e) =>
                onChange({ ...value, contactFirstName: e.target.value })
              }
              className="h-9"
              disabled={disabled}
            />
          </FinanceField>
          <FinanceField label="Last name *">
            <Input
              value={value.contactLastName}
              onChange={(e) =>
                onChange({ ...value, contactLastName: e.target.value })
              }
              className="h-9"
              disabled={disabled}
            />
          </FinanceField>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FinanceField label="Vendor name *">
          <Input
            value={value.vendorName}
            onChange={(e) => onChange({ ...value, vendorName: e.target.value })}
            className="h-9"
            placeholder={vendorNamePlaceholder === "" ? undefined : vendorNamePlaceholder}
            disabled={disabled}
          />
        </FinanceField>
        {showVendorType ? (
          <FinanceField label="Vendor type">
            <FinanceSelect
              value={value.vendorType}
              onChange={(e) => onChange({ ...value, vendorType: e.target.value })}
              disabled={disabled}
            >
              <option value="domestic">Domestic</option>
              <option value="international">International</option>
              <option value="service">Service</option>
            </FinanceSelect>
          </FinanceField>
        ) : (
          <div />
        )}
        <FinanceField label="Email *">
          <Input
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            className="h-9"
            disabled={disabled}
          />
        </FinanceField>
        <FinanceField label="Phone *">
          <Input
            value={value.mobile}
            onChange={(e) => onChange({ ...value, mobile: e.target.value })}
            className="h-9"
            disabled={disabled}
          />
        </FinanceField>
      </div>

      <div className="space-y-3">
        {value.addresses.map((block, index) => (
          <VendorAddressBlockFields
            key={index}
            index={index}
            block={block}
            onChange={(next) => updateAddress(index, next)}
            onRemove={() => removeAddress(index)}
            canRemove={value.addresses.length > 1}
            disabled={disabled}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full cursor-pointer gap-1.5 border-dashed transition-colors duration-200 sm:w-auto"
          disabled={disabled}
          onClick={addAddress}
        >
          <Plus className="size-3.5" />
          Add another address
        </Button>
      </div>
    </div>
  );
}
