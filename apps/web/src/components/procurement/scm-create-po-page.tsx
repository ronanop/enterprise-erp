"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Eye,
  Landmark,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import {
  buildVendorAddressEntriesFromForm,
  emptyVendorFormDraft,
  INDIAN_STATES,
  validateVendorFormDraft,
  VendorFormFields,
  type VendorFormDraft,
} from "@/components/procurement/vendor-form-fields";
import {
  ScmCommercialDocumentsPanel,
  type PendingScmCommercialDocument,
} from "@/components/procurement/scm-commercial-documents-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { submitPoFinalizeApproval } from "@/lib/procurement-approvals";
import { scmHoldCreatePoNotice } from "@/utils/scm-ovf-hold";
import { ApiClientError } from "@/services/api-client";
import {
  collectPoApprovalDocuments,
  createPoFromOvf,
  createVendorOption,
  emptyPostalAddress,
  formatInr,
  formatUsd,
  getPurchaseOrder,
  getScmOvfPreview,
  listVendorOptions,
  peekNextCompanyPoNumber,
  uploadScmPoAttachment,
  updateVendorAddresses,
  type ScmOvfPreview,
  type VendorAddressEntry,
  type VendorOption,
  type VendorPostalAddress,
} from "@/services/procurement-service";
import { fileToBase64 } from "@/services/sales-crm-service";
import {
  buildPoTaxesFromBuckets,
  previewPurchaseOrderPdf,
  type PurchaseOrderPdfInput,
} from "@/utils/purchase-order-pdf";
import { matchVendorByOem } from "@/utils/vendor-oem-match";

function applyVendorAddressFields(
  entry: VendorAddressEntry | null | undefined,
  fallbackGst = "",
): {
  vendorAddress: string;
  vendorGstNumber: string;
  sourceOfSupply: string;
  destinationOfSupply: string;
} {
  return {
    vendorAddress: entry?.address || "",
    vendorGstNumber: entry?.gstNumber || fallbackGst || "",
    sourceOfSupply: entry?.sourceOfSupply || "",
    destinationOfSupply: entry?.destinationOfSupply || "",
  };
}

function resolveVendorBillingAddress(
  entry: VendorAddressEntry | null | undefined,
  fallbackStreet = "",
  fallbackState = "",
): VendorPostalAddress {
  return (
    entry?.billing ||
    emptyPostalAddress({
      street: fallbackStreet || entry?.address,
      state: fallbackState || entry?.sourceOfSupply,
    })
  );
}

function resolveVendorShippingAddress(
  entry: VendorAddressEntry | null | undefined,
  fallbackStreet = "",
  fallbackState = "",
): VendorPostalAddress {
  return (
    entry?.shipping ||
    entry?.billing ||
    emptyPostalAddress({
      street: fallbackStreet || entry?.address,
      state: fallbackState || entry?.destinationOfSupply,
    })
  );
}

function formatPostalAddressLines(address: VendorPostalAddress): string[] {
  return [address.street, address.city, address.state, address.pincode, address.country]
    .map((part) => (part || "").trim())
    .filter(Boolean);
}

function sortVendorsForOem(vendors: VendorOption[], oemName: string): VendorOption[] {
  const oem = oemName.trim().toLowerCase();
  if (!oem) return vendors;
  return [...vendors].sort((a, b) => {
    const aMatch = a.label.trim().toLowerCase() === oem ? 0 : 1;
    const bMatch = b.label.trim().toLowerCase() === oem ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}
/** Selectable issuing entities for our company on vendor POs. */
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

const COMPANY_LOCATIONS = [
  {
    id: "kailash-colony",
    label: "Cache DigiTech Pvt. Ltd.",
    addressHeader: "Cache DigiTech Pvt. Ltd.",
    entityCode: "CDT",
    gstState: "Delhi",
    addressLines: KAILASH_ADDRESS_LINES,
    lockShippingToEntity: false,
  },
  {
    id: "cache-technology",
    label: "Cache Technologies",
    addressHeader: "Cache Technologies",
    entityCode: "CT",
    gstState: "Delhi",
    addressLines: KAILASH_ADDRESS_LINES,
    lockShippingToEntity: false,
  },
  {
    id: "cache-digitech-mumbai",
    label: "Cache DigiTech Pvt. Ltd. - Mumbai",
    addressHeader: "Cache DigiTech Pvt. Ltd.",
    entityCode: "CMT",
    gstState: "Maharashtra",
    addressLines: MUMBAI_ADDRESS_LINES,
    lockShippingToEntity: true,
  },
] as const;

/** Shipping address presets — body only; entity name is prepended from Entity dropdown. */
const SHIPPING_ADDRESS_OPTIONS = [
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
] as const;

function formatEntityAddress(
  location: (typeof COMPANY_LOCATIONS)[number] | undefined,
): string {
  if (!location) return "";
  return [location.addressHeader, ...location.addressLines].join("\n");
}

function formatShippingAddress(
  entityHeader: string,
  shippingOptionId: string,
): string {
  const option =
    SHIPPING_ADDRESS_OPTIONS.find((row) => row.id === shippingOptionId) ||
    SHIPPING_ADDRESS_OPTIONS[0];
  return [entityHeader, ...option.addressLines].join("\n");
}

function companyLocationById(locationId: string) {
  return COMPANY_LOCATIONS.find((row) => row.id === locationId) ?? COMPANY_LOCATIONS[0];
}

/** Resolve entity from an assigned company PO (PO/{entityCode}/nnn). */
function companyLocationFromPoNumber(poNumber: string | null | undefined) {
  const match = /^PO\/([A-Za-z]+)\/\d+/i.exec((poNumber || "").trim());
  if (!match) return null;
  const code = match[1].toUpperCase();
  return COMPANY_LOCATIONS.find((row) => row.entityCode === code) ?? null;
}

function entityAddressHeaderForLocationId(locationId: string): string {
  return companyLocationById(locationId).addressHeader;
}

const DEFAULT_COMPANY_LOCATION = COMPANY_LOCATIONS[0];
const DEFAULT_SHIPPING_OPTION = SHIPPING_ADDRESS_OPTIONS[0];
const DEFAULT_ENTITY_ADDRESS = formatEntityAddress(DEFAULT_COMPANY_LOCATION);
const DEFAULT_SHIPPING_ADDRESS = formatShippingAddress(
  DEFAULT_COMPANY_LOCATION.addressHeader,
  DEFAULT_SHIPPING_OPTION.id,
);
const CUSTOM_SHIPPING_ID_PREFIX = "custom-po-";

type CustomShippingDraft = {
  companyName: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
};

type PoShippingOption = {
  id: string;
  address: string;
};

function emptyCustomShippingDraft(
  partial?: Partial<CustomShippingDraft>,
): CustomShippingDraft {
  return {
    companyName: partial?.companyName || "",
    street: partial?.street || "",
    city: partial?.city || "",
    state: partial?.state || "",
    pincode: partial?.pincode || "",
  };
}

function formatCustomShippingAddress(draft: CustomShippingDraft): string {
  return [
    draft.companyName.trim(),
    draft.street.trim(),
    [draft.city.trim(), draft.state.trim()].filter(Boolean).join(", "),
    draft.pincode.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function newCustomShippingId(): string {
  return `${CUSTOM_SHIPPING_ID_PREFIX}${Date.now().toString(36)}`;
}

function PoField({
  labelClassName,
  ...props
}: React.ComponentProps<typeof FinanceField>) {
  return (
    <FinanceField
      {...props}
      labelClassName={cn("text-xs text-foreground", labelClassName)}
    />
  );
}

type PoSectionTone = "white" | "teal";

const PO_SECTION_TONE: Record<PoSectionTone, { card: string; icon: string; title: string }> = {
  white: {
    card: "border-border bg-card shadow-sm",
    icon: "bg-muted text-foreground",
    title: "text-foreground",
  },
  teal: {
    card: "border-teal-200/80 bg-teal-50/70 shadow-sm",
    icon: "bg-teal-100 text-teal-800",
    title: "text-teal-950",
  },
};

function PoSection({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: ReactNode;
  icon: LucideIcon;
  tone: PoSectionTone;
  children: ReactNode;
}) {
  const styles = PO_SECTION_TONE[tone];
  return (
    <section className={cn("space-y-3 rounded-xl border p-4", styles.card)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
            styles.icon,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
        <h2 className={cn("text-xs font-semibold uppercase tracking-wide", styles.title)}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

type PoFormState = {
  vendorId: string;
  vendorName: string;
  vendorAddress: string;
  vendorGstNumber: string;
  sourceOfSupply: string;
  destinationOfSupply: string;
  companyLocationId: string;
  shippingAddressId: string;
  companyAddress: string;
  billingAddress: string;
  shippingAddress: string;
  purchaseDate: string;
  deliveryDate: string;
  paymentTerms: string;
  ovfNumber: string;
  quoteNumber: string;
  companyPoNumber: string;
  customerPoNumber: string;
  customerPoDate: string;
  orderRefCache: string;
  ovfApprover: string;
  customerName: string;
  customerGstNumber: string;
  taxPercentage: string;
  financeAmount: string;
  distiAmount: string;
  /** Apply Disti % as +/− on each line unit rate (Rate column). */
  distiSign: "plus" | "minus";
  foreignAmount: string;
  freightTaxable: boolean;
  /** INR per 1 USD — used when switching line rates between INR and USD. */
  usdInrRate: string;
};

type PoLineRow = {
  id: string;
  itemDetails: string;
  partNumber: string;
  hsnCode: string;
  poType: "Goods" | "Services";
  qty: string;
  rate: string;
  rateCurrency: "INR" | "USD";
  taxPct: string;
};

const PAYMENT_TERM_PRESETS = [
  "Net 30 days",
  "Net 45 days",
  "Net 60 days",
  "Net 90 days",
] as const;

const TAX_OPTIONS = ["0", "5", "12", "18", "28"] as const;

const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  const normalized = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function formatOvfAmountField(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "0";
  const n = Number(value);
  return n === 0 ? "0" : String(n);
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function distiFactor(distiPct: number, distiSign: "plus" | "minus"): number {
  if (!Number.isFinite(distiPct) || distiPct === 0) return 1;
  return distiSign === "plus" ? 1 + distiPct / 100 : Math.max(0, 1 - distiPct / 100);
}

function adjustedUnitRate(
  baseRate: number,
  distiPct: number,
  distiSign: "plus" | "minus",
): number {
  if (!Number.isFinite(baseRate) || baseRate === 0) return 0;
  return Math.max(0, baseRate * distiFactor(distiPct, distiSign));
}

function formatRateValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(rounded);
}

function inrRateToUsd(inrRate: number, usdInrRate: number): number {
  if (!Number.isFinite(inrRate) || inrRate <= 0 || !Number.isFinite(usdInrRate) || usdInrRate <= 0) {
    return 0;
  }
  return inrRate / usdInrRate;
}

function usdRateToInr(usdRate: number, usdInrRate: number): number {
  if (!Number.isFinite(usdRate) || usdRate <= 0 || !Number.isFinite(usdInrRate) || usdInrRate <= 0) {
    return 0;
  }
  return usdRate * usdInrRate;
}

function isUsdLine(row: PoLineRow): boolean {
  return row.rateCurrency === "USD";
}

function allUsdLines(rows: PoLineRow[]): boolean {
  return rows.length > 0 && rows.every(isUsdLine);
}

function lineSubtotal(
  row: PoLineRow,
  distiPct = 0,
  distiSign: "plus" | "minus" = "plus",
): number {
  const rate = isUsdLine(row)
    ? toNumber(row.rate)
    : adjustedUnitRate(toNumber(row.rate), distiPct, distiSign);
  return toNumber(row.qty) * rate;
}

function lineGstAmount(
  row: PoLineRow,
  distiPct = 0,
  distiSign: "plus" | "minus" = "plus",
): number {
  if (isUsdLine(row)) return 0;
  return (lineSubtotal(row, distiPct, distiSign) * toNumber(row.taxPct)) / 100;
}

/** When every INR line shares one GST %, return it; otherwise null (mixed). */
function uniformLineTaxPct(rows: PoLineRow[]): string | null {
  const inrRows = rows.filter((row) => !isUsdLine(row));
  if (inrRows.length === 0) return null;
  const first = inrRows[0]?.taxPct ?? "18";
  return inrRows.every((row) => row.taxPct === first) ? first : null;
}

function normalizeTaxOption(value: number | string | null | undefined, fallback = "18"): string {
  const raw = String(value ?? fallback).trim();
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const asInt = String(Math.round(n));
  return (TAX_OPTIONS as readonly string[]).includes(asInt) ? asInt : fallback;
}

function emptyForm(): PoFormState {
  return {
    vendorId: "",
    vendorName: "",
    vendorAddress: "",
    vendorGstNumber: "",
    sourceOfSupply: "",
    destinationOfSupply: "",
    companyLocationId: DEFAULT_COMPANY_LOCATION.id,
    shippingAddressId: DEFAULT_SHIPPING_OPTION.id,
    companyAddress: DEFAULT_ENTITY_ADDRESS,
    billingAddress: DEFAULT_ENTITY_ADDRESS,
    shippingAddress: DEFAULT_SHIPPING_ADDRESS,
    purchaseDate: todayIso(),
    deliveryDate: "",
    paymentTerms: "",
    ovfNumber: "",
    quoteNumber: "",
    companyPoNumber: "",
    customerPoNumber: "",
    customerPoDate: "",
    orderRefCache: "",
    ovfApprover: "",
    customerName: "",
    customerGstNumber: "",
    taxPercentage: "18",
    financeAmount: "0",
    distiAmount: "0",
    distiSign: "plus",
    foreignAmount: "0",
    freightTaxable: false,
    usdInrRate: "",
  };
}

function emptyLine(taxPct = "18"): PoLineRow {
  return {
    id: crypto.randomUUID(),
    itemDetails: "",
    partNumber: "",
    hsnCode: "",
    poType: "Goods",
    qty: "1",
    rate: "0",
    rateCurrency: "INR",
    taxPct,
  };
}

function autoResizeTextarea(el: HTMLTextAreaElement | null, minHeight = 32) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
}

function ItemDetailsTextarea({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    autoResizeTextarea(ref.current, 40);
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      disabled={disabled}
      rows={1}
      onChange={(e) => {
        onChange(e.target.value);
        autoResizeTextarea(e.target, 40);
      }}
      className="min-h-10 w-full resize-none overflow-hidden rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none transition-colors duration-200 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
      placeholder="Item description"
    />
  );
}

export function ScmCreatePoPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const shippingMenuRef = useRef<HTMLDivElement>(null);
  const paymentTermsMenuRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [form, setForm] = useState<PoFormState>(emptyForm);
  const [lines, setLines] = useState<PoLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shippingMenuOpen, setShippingMenuOpen] = useState(false);
  const [paymentTermsMenuOpen, setPaymentTermsMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorDialogBusy, setVendorDialogBusy] = useState(false);
  const [vendorDialogError, setVendorDialogError] = useState<string | null>(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [vendorDraft, setVendorDraft] = useState<VendorFormDraft>(emptyVendorFormDraft());
  const [customShippingOpen, setCustomShippingOpen] = useState(false);
  const [customShippingError, setCustomShippingError] = useState<string | null>(null);
  const [customShippingDraft, setCustomShippingDraft] = useState<CustomShippingDraft>(
    emptyCustomShippingDraft(),
  );
  const [poShippingExtras, setPoShippingExtras] = useState<PoShippingOption[]>([]);
  const [pdfPreviewBusy, setPdfPreviewBusy] = useState(false);
  const [scmDocuments, setScmDocuments] = useState<PendingScmCommercialDocument[]>([]);
  const [usdConvertLineId, setUsdConvertLineId] = useState<string | null>(null);
  const [usdConvertRateDraft, setUsdConvertRateDraft] = useState("");
  const [usdConvertError, setUsdConvertError] = useState<string | null>(null);
  const actionErrorRef = useRef<HTMLDivElement>(null);

  const oemName = (preview?.oem_name || "").trim();
  const scmHoldBanner = useMemo(() => {
    if (!preview?.scm_on_hold || !preview.can_create_po) return null;
    return scmHoldCreatePoNotice(preview.scm_on_hold_at);
  }, [preview]);
  const selectedVendor = useMemo(
    () => vendors.find((row) => row.id === form.vendorId) ?? null,
    [vendors, form.vendorId],
  );
  const vendorAddressEntries = useMemo(() => {
    if (selectedVendor?.addressEntries?.length) return selectedVendor.addressEntries;
    if (form.vendorAddress) {
      return [
        {
          address: form.vendorAddress,
          gstNumber: form.vendorGstNumber || selectedVendor?.taxNumber || "",
          sourceOfSupply: form.sourceOfSupply || "",
          destinationOfSupply: form.destinationOfSupply || "",
        },
      ];
    }
    return [] as VendorAddressEntry[];
  }, [
    selectedVendor,
    form.vendorAddress,
    form.vendorGstNumber,
    form.sourceOfSupply,
    form.destinationOfSupply,
  ]);
  const selectedVendorAddressEntry = useMemo(() => {
    if (!selectedVendor) return null;
    return (
      selectedVendor.addressEntries.find((entry) => entry.address === form.vendorAddress) ||
      selectedVendor.addressEntries[0] ||
      null
    );
  }, [selectedVendor, form.vendorAddress]);
  const vendorsForSelect = useMemo(
    () => sortVendorsForOem(vendors, oemName),
    [vendors, oemName],
  );

  const setField = useCallback(<K extends keyof PoFormState>(key: K, value: PoFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const setLineField = useCallback(
    <K extends keyof PoLineRow>(lineId: string, key: K, value: PoLineRow[K]) => {
      setLines((current) => {
        const next = current.map((row) =>
          row.id === lineId ? { ...row, [key]: value } : row,
        );
        if (key === "taxPct") {
          const uniform = uniformLineTaxPct(next);
          if (uniform != null) {
            setForm((form) =>
              form.taxPercentage === uniform ? form : { ...form, taxPercentage: uniform },
            );
          }
        }
        return next;
      });
    },
    [],
  );

  const setLineRateCurrency = useCallback(
    (lineId: string, currency: "INR" | "USD") => {
      setLines((current) =>
        current.map((row) => {
          if (row.id !== lineId) return row;
          if (currency === "USD") {
            return { ...row, rateCurrency: "USD", taxPct: "0" };
          }
          const exchange = toNumber(form.usdInrRate);
          const inrRate =
            row.rateCurrency === "USD" && exchange > 0
              ? usdRateToInr(toNumber(row.rate), exchange)
              : toNumber(row.rate);
          return {
            ...row,
            rateCurrency: "INR",
            taxPct: normalizeTaxOption(form.taxPercentage || "18"),
            rate: inrRate > 0 ? formatRateValue(inrRate) : row.rate,
          };
        }),
      );
    },
    [form.taxPercentage, form.usdInrRate],
  );

  const usdConvertLine = useMemo(
    () => (usdConvertLineId ? lines.find((row) => row.id === usdConvertLineId) : null),
    [lines, usdConvertLineId],
  );

  const usdConvertPreview = useMemo(() => {
    if (!usdConvertLine) return null;
    const inrRate = toNumber(usdConvertLine.rate);
    const exchange = toNumber(usdConvertRateDraft);
    if (inrRate <= 0 || exchange <= 0) return null;
    return inrRateToUsd(inrRate, exchange);
  }, [usdConvertLine, usdConvertRateDraft]);

  function openUsdConvertDialog(lineId: string) {
    setUsdConvertLineId(lineId);
    setUsdConvertRateDraft(form.usdInrRate || "");
    setUsdConvertError(null);
  }

  function closeUsdConvertDialog() {
    setUsdConvertLineId(null);
    setUsdConvertRateDraft("");
    setUsdConvertError(null);
  }

  function confirmUsdConvert() {
    if (!usdConvertLineId || !usdConvertLine) return;
    const exchange = toNumber(usdConvertRateDraft);
    if (!Number.isFinite(exchange) || exchange <= 0) {
      setUsdConvertError("Enter how many INR equal 1 USD (e.g. 83.5).");
      return;
    }
    const inrRate = toNumber(usdConvertLine.rate);
    const usdRate = inrRateToUsd(inrRate, exchange);
    setField("usdInrRate", formatRateValue(exchange));
    setLines((current) =>
      current.map((row) => {
        if (row.id !== usdConvertLineId) return row;
        return {
          ...row,
          rateCurrency: "USD",
          taxPct: "0",
          rate: inrRate > 0 ? formatRateValue(usdRate) : row.rate,
        };
      }),
    );
    closeUsdConvertDialog();
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovf, vendorRows] = await Promise.all([
        getScmOvfPreview(ovfId),
        listVendorOptions().catch(() => [] as VendorOption[]),
      ]);
      setPreview(ovf);
      setVendors(vendorRows);

      const defaultTax = normalizeTaxOption(ovf.tax_percentage, "18");
      const location =
        COMPANY_LOCATIONS.find((loc) => loc.id === "kailash-colony") ?? COMPANY_LOCATIONS[0];
      setForm((current) => {
        const keepVendor =
          Boolean(current.vendorId) && vendorRows.some((row) => row.id === current.vendorId);
        const oem = (ovf.oem_name || "").trim();
        const matched = keepVendor ? null : matchVendorByOem(vendorRows, ovf.oem_name);
        const matchedEntry = matched?.addressEntries?.[0];
        const addressFields = keepVendor
          ? {
              vendorAddress: current.vendorAddress || "",
              vendorGstNumber: current.vendorGstNumber || "",
              sourceOfSupply: current.sourceOfSupply || "",
            }
          : matched
            ? {
                ...applyVendorAddressFields(matchedEntry, matched.taxNumber || ""),
                sourceOfSupply: matchedEntry?.sourceOfSupply || "",
              }
            : {
                vendorAddress: "",
                vendorGstNumber: "",
                sourceOfSupply: "",
              };
        const lockedFromPo = companyLocationFromPoNumber(ovf.company_po_number);
        const selectedLocation = companyLocationById(
          lockedFromPo?.id || current.companyLocationId || location.id,
        );
        const seededLines =
          ovf.vendor_lines.length > 0
            ? ovf.vendor_lines.map((ln) =>
                normalizeTaxOption(
                  ln.gst_pct != null && Number.isFinite(Number(ln.gst_pct))
                    ? ln.gst_pct
                    : defaultTax,
                  defaultTax,
                ),
              )
            : [defaultTax];
        const uniformSeed = seededLines.every((pct) => pct === seededLines[0])
          ? seededLines[0]
          : defaultTax;
        return {
          // Auto-select when OEM matches a vendor; otherwise leave blank for SCM.
          vendorId: keepVendor ? current.vendorId : matched?.id || "",
          vendorName: keepVendor ? current.vendorName : matched?.label || oem,
          ...addressFields,
          destinationOfSupply: selectedLocation.gstState,
          companyLocationId: selectedLocation.id,
          shippingAddressId: current.shippingAddressId || DEFAULT_SHIPPING_OPTION.id,
          companyAddress: current.companyAddress || formatEntityAddress(selectedLocation),
          billingAddress: formatEntityAddress(selectedLocation),
          shippingAddress: formatShippingAddress(
            selectedLocation.addressHeader,
            current.shippingAddressId || DEFAULT_SHIPPING_OPTION.id,
          ),
          purchaseDate: current.purchaseDate || todayIso(),
          deliveryDate:
            current.deliveryDate ||
            toDateInputValue(ovf.delivery_period),
          paymentTerms:
            current.paymentTerms ||
            (ovf.vendor_payment_days > 0 ? `Net ${ovf.vendor_payment_days} days` : "Net 30 days"),
          ovfNumber: ovf.ovf_no || "",
          quoteNumber: current.quoteNumber || ovf.quote_name || "",
          companyPoNumber:
            current.companyPoNumber || ovf.company_po_number || "",
          customerPoNumber: current.customerPoNumber || ovf.po_number || "",
          customerPoDate:
            current.customerPoDate || toDateInputValue(ovf.po_date),
          orderRefCache: current.orderRefCache || "",
          ovfApprover: current.ovfApprover || ovf.ovf_approver || ovf.owner_name || "",
          customerName: current.customerName || ovf.customer_name || ovf.account_name || "",
          customerGstNumber: current.customerGstNumber || ovf.customer_gst || "",
          taxPercentage: current.taxPercentage || uniformSeed,
          financeAmount: current.financeAmount || "0",
          distiAmount: current.distiAmount || "0",
          distiSign: current.distiSign || "plus",
          foreignAmount:
            current.foreignAmount !== "0"
              ? current.foreignAmount
              : formatOvfAmountField(ovf.freight),
          freightTaxable: current.freightTaxable ?? false,
        };
      });
      setLines((current) => {
        if (current.length > 0) return current;
        return ovf.vendor_lines.length > 0
          ? ovf.vendor_lines.map((ln) => ({
              id: ln.line_id,
              itemDetails: ln.product_name,
              partNumber: "",
              hsnCode: "",
              poType: "Goods" as const,
              qty: String(ln.qty ?? 1),
              rate: String(ln.unit_price ?? 0),
              rateCurrency: "INR" as const,
              taxPct: normalizeTaxOption(
                ln.gst_pct != null && Number.isFinite(Number(ln.gst_pct))
                  ? ln.gst_pct
                  : defaultTax,
                defaultTax,
              ),
            }))
          : [emptyLine(defaultTax)];
      });

      if (ovf.purchase_order_id && ovf.can_create_po && ovf.purchase_order_status === "draft") {
        setBanner(
          `Editing draft ${ovf.company_po_number || ovf.purchase_order_number}. Same company PO number is kept on save.`,
        );
      } else if (!ovf.can_create_po && ovf.purchase_order_id) {
        setBanner(`PO ${ovf.purchase_order_number} already exists for this OVF.`);
      } else if (ovf.scm_on_hold && ovf.can_create_po) {
        setBanner(null);
      } else {
        setBanner(null);
      }

      if (ovf.company_po_number?.trim()) {
        setForm((current) => ({
          ...current,
          companyPoNumber: ovf.company_po_number || current.companyPoNumber,
        }));
      } else {
        void peekNextCompanyPoNumber(location.entityCode, ovf.company_id)
          .then((next) => {
            setForm((current) =>
              current.companyPoNumber.trim()
                ? current
                : { ...current, companyPoNumber: next.company_po_number },
            );
          })
          .catch(() => undefined);
      }

      if (ovf.purchase_order_id && ovf.purchase_order_status === "draft") {
        void getPurchaseOrder(ovf.purchase_order_id, { includeCommercial: false })
          .then((order) => {
            const ref = (order.order_ref_cache || "").trim();
            if (!ref) return;
            setForm((current) =>
              current.orderRefCache.trim() ? current : { ...current, orderRefCache: ref },
            );
          })
          .catch(() => undefined);
      }
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load OVF");
    } finally {
      setLoading(false);
    }
  }, [ovfId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!shippingMenuOpen && !paymentTermsMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (shippingMenuOpen && !shippingMenuRef.current?.contains(target)) {
        setShippingMenuOpen(false);
      }
      if (paymentTermsMenuOpen && !paymentTermsMenuRef.current?.contains(target)) {
        setPaymentTermsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [shippingMenuOpen, paymentTermsMenuOpen]);

  const distiPct = toNumber(form.distiAmount);
  const allLinesUsd = useMemo(() => allUsdLines(lines), [lines]);

  const itemsSubtotal = useMemo(
    () =>
      lines.reduce((sum, row) => {
        if (allLinesUsd) return sum + lineSubtotal(row);
        if (isUsdLine(row)) return sum;
        return sum + lineSubtotal(row, distiPct, form.distiSign);
      }, 0),
    [lines, distiPct, form.distiSign, allLinesUsd],
  );

  const usdItemsSubtotal = useMemo(
    () =>
      lines.reduce(
        (sum, row) => (isUsdLine(row) ? sum + lineSubtotal(row) : sum),
        0,
      ),
    [lines],
  );

  const freightAmount = useMemo(
    () => toNumber(form.foreignAmount),
    [form.foreignAmount],
  );

  const gstAmount = useMemo(() => {
    if (allLinesUsd) return 0;
    const linesGst = lines.reduce(
      (sum, row) => sum + lineGstAmount(row, distiPct, form.distiSign),
      0,
    );
    const freightGst = form.freightTaxable
      ? (freightAmount * toNumber(form.taxPercentage)) / 100
      : 0;
    return linesGst + freightGst;
  }, [
    allLinesUsd,
    lines,
    distiPct,
    form.distiSign,
    form.freightTaxable,
    freightAmount,
    form.taxPercentage,
  ]);

  const entityGstState = companyLocationById(form.companyLocationId).gstState;

  const taxBreakdown = useMemo(() => {
    if (allLinesUsd) return [];
    const buckets = lines
      .filter((row) => !isUsdLine(row))
      .map((row) => ({
        taxableAmount: lineSubtotal(row, distiPct, form.distiSign),
        taxPct: toNumber(row.taxPct),
      }));
    if (form.freightTaxable && freightAmount > 0) {
      buckets.push({
        taxableAmount: freightAmount,
        taxPct: toNumber(form.taxPercentage),
      });
    }
    return buildPoTaxesFromBuckets({
      buckets,
      sourceOfSupply: form.sourceOfSupply,
      destinationOfSupply: entityGstState,
    });
  }, [
    allLinesUsd,
    lines,
    distiPct,
    form.distiSign,
    form.freightTaxable,
    freightAmount,
    form.taxPercentage,
    form.sourceOfSupply,
    entityGstState,
  ]);

  const uniformTaxPct = useMemo(() => uniformLineTaxPct(lines), [lines]);

  const finalTotal = allLinesUsd
    ? itemsSubtotal
    : itemsSubtotal + freightAmount + gstAmount;

  function applyGlobalTax(taxPct: string) {
    const next = normalizeTaxOption(taxPct, form.taxPercentage || "18");
    setField("taxPercentage", next);
    setLines((current) =>
      current.map((row) => (isUsdLine(row) ? row : { ...row, taxPct: next })),
    );
  }

  function onVendorChange(vendorId: string) {
    const vendor = vendors.find((row) => row.id === vendorId);
    const entry = vendor?.addressEntries?.[0];
    const entityState = companyLocationById(form.companyLocationId).gstState;
    setError(null);
    setForm((current) => ({
      ...current,
      vendorId,
      vendorName: vendor?.label || oemName || "",
      ...applyVendorAddressFields(entry, vendor?.taxNumber || ""),
      destinationOfSupply: entityState,
    }));
  }

  function onVendorAddressChange(address: string) {
    const entry =
      selectedVendor?.addressEntries?.find((row) => row.address === address) ||
      vendorAddressEntries.find((row) => row.address === address);
    const entityState = companyLocationById(form.companyLocationId).gstState;
    setForm((current) => ({
      ...current,
      ...applyVendorAddressFields(
        entry || {
          address,
          gstNumber: "",
          sourceOfSupply: "",
          destinationOfSupply: "",
        },
      ),
      destinationOfSupply: entityState,
    }));
  }

  function openVendorDialog() {
    setVendorDialogError(null);
    setVendorDraft(
      emptyVendorFormDraft({
        vendorName: oemName || form.vendorName || "",
        gstNumber: form.vendorGstNumber || "",
        sourceOfSupply: form.sourceOfSupply || "",
        destinationOfSupply: form.destinationOfSupply || "",
        billing: {
          country: "India",
          street: form.vendorAddress || "",
          city: "",
          state: "",
          pincode: "",
        },
      }),
    );
    setVendorDialogOpen(true);
  }

  function closeVendorDialog() {
    setVendorDialogOpen(false);
    setVendorDialogBusy(false);
    setVendorDialogError(null);
  }

  async function saveVendorDialog() {
    const validationError = validateVendorFormDraft(vendorDraft);
    if (validationError) {
      setVendorDialogError(validationError);
      return;
    }
    if (!preview?.company_id || !preview?.branch_id) {
      setVendorDialogError("Missing company/branch context from OVF.");
      return;
    }
    const name = vendorDraft.vendorName.trim();
    const addressEntries = buildVendorAddressEntriesFromForm(vendorDraft);
    setVendorDialogBusy(true);
    setVendorDialogError(null);
    try {
      const created = await createVendorOption({
        vendor_name: name,
        company_id: preview.company_id,
        branch_id: preview.branch_id,
        addressEntries,
        email: vendorDraft.email,
        mobile: vendorDraft.mobile,
        contactFirstName: vendorDraft.contactFirstName,
        contactLastName: vendorDraft.contactLastName,
      });
      setVendors((current) => {
        const without = current.filter((row) => row.id !== created.id);
        return [...without, created].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
        );
      });
      const first = created.addressEntries[0];
      setForm((current) => ({
        ...current,
        vendorId: created.id,
        vendorName: created.label,
        ...applyVendorAddressFields(first, created.taxNumber || ""),
      }));
      closeVendorDialog();
    } catch (err) {
      setVendorDialogError(
        err instanceof ApiClientError ? err.message : "Failed to create vendor",
      );
    } finally {
      setVendorDialogBusy(false);
    }
  }

  function resolveVendorId(): string {
    if (form.vendorId && vendors.some((row) => row.id === form.vendorId)) {
      return form.vendorId;
    }
    const byName = vendors.find(
      (row) => row.label.trim().toLowerCase() === form.vendorName.trim().toLowerCase(),
    );
    return byName?.id || form.vendorId || "";
  }

  function resolveVendorAddress(): string {
    if (form.vendorAddress.trim()) return form.vendorAddress.trim();
    return selectedVendor?.addressEntries?.[0]?.address?.trim() || "";
  }

  function validateVendorFields(): string | null {
    if (!resolveVendorId()) {
      return "Select a vendor before creating the purchase order";
    }
    if (!resolveVendorAddress()) {
      return "Vendor address is required";
    }
    if (!form.sourceOfSupply.trim()) {
      return "Source of supply is required";
    }
    if (!form.destinationOfSupply.trim()) {
      return "Destination of supply is required";
    }
    if (!form.vendorGstNumber.trim()) {
      return "Vendor GST number is required";
    }
    return null;
  }

  async function persistVendorDetails(vendorId: string): Promise<VendorOption> {
    const vendor = vendors.find((row) => row.id === vendorId);
    if (!vendor) {
      throw new Error("Selected vendor was not found. Refresh and try again.");
    }
    if (typeof vendor.version !== "number") {
      throw new Error("Vendor record is missing version. Refresh vendors and try again.");
    }
    const currentEntry: VendorAddressEntry = {
      address: resolveVendorAddress(),
      gstNumber: form.vendorGstNumber.trim(),
      sourceOfSupply: form.sourceOfSupply.trim(),
      destinationOfSupply: form.destinationOfSupply.trim(),
    };
    const addressKey = currentEntry.address.toLowerCase();
    const others = vendor.addressEntries.filter(
      (entry) => entry.address.trim().toLowerCase() !== addressKey,
    );
    const updated = await updateVendorAddresses({
      vendor_id: vendorId,
      version: vendor.version,
      addresses: [currentEntry, ...others],
    });
    setVendors((current) =>
      current
        .map((row) => (row.id === updated.id ? updated : row))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    );
    setForm((current) => ({
      ...current,
      vendorId: updated.id,
      vendorName: updated.label,
      ...applyVendorAddressFields(currentEntry, currentEntry.gstNumber),
    }));
    return updated;
  }

  async function refreshCompanyPoNumber(locationId: string, companyId?: string) {
    const location = COMPANY_LOCATIONS.find((row) => row.id === locationId);
    if (!location) return;
    try {
      const next = await peekNextCompanyPoNumber(location.entityCode, companyId);
      setForm((current) => ({
        ...current,
        companyPoNumber: next.company_po_number,
      }));
    } catch {
      setForm((current) => ({
        ...current,
        companyPoNumber: `PO/${location.entityCode}/001`,
      }));
    }
  }

  function onCompanyLocationChange(locationId: string) {
    if (entityLocked) return;
    const location = companyLocationById(locationId);
    const billingAddress = formatEntityAddress(location);
    const shippingOptionId = location.lockShippingToEntity
      ? "mumbai-eastern-court"
      : DEFAULT_SHIPPING_OPTION.id;
    const shippingAddress = formatShippingAddress(
      location.addressHeader,
      shippingOptionId,
    );
    setForm((current) => ({
      ...current,
      companyLocationId: locationId,
      shippingAddressId: shippingOptionId,
      companyAddress: billingAddress || current.companyAddress,
      billingAddress: billingAddress || current.billingAddress,
      shippingAddress,
      destinationOfSupply: location.gstState,
    }));
    setShippingMenuOpen(false);
    void refreshCompanyPoNumber(locationId, preview?.company_id);
  }

  function onShippingAddressChange(shippingAddressId: string) {
    const custom = poShippingExtras.find((row) => row.id === shippingAddressId);
    if (custom) {
      setForm((current) => ({
        ...current,
        shippingAddressId: custom.id,
        shippingAddress: custom.address,
      }));
      return;
    }
    setForm((current) => {
      const location = companyLocationById(current.companyLocationId);
      return {
        ...current,
        shippingAddressId,
        shippingAddress: formatShippingAddress(location.addressHeader, shippingAddressId),
      };
    });
  }

  function openCustomShippingDialog() {
    const header = entityAddressHeaderForLocationId(form.companyLocationId);
    setCustomShippingError(null);
    setCustomShippingDraft(
      emptyCustomShippingDraft({
        companyName: header,
      }),
    );
    setShippingMenuOpen(false);
    setCustomShippingOpen(true);
  }

  function applyCustomShipping() {
    const companyName = customShippingDraft.companyName.trim();
    const street = customShippingDraft.street.trim();
    const city = customShippingDraft.city.trim();
    const state = customShippingDraft.state.trim();
    const pincode = customShippingDraft.pincode.trim();
    if (!companyName || !street || !city || !state || !pincode) {
      setCustomShippingError("Company name, street, city, state, and pincode are required.");
      return;
    }
    const address = formatCustomShippingAddress({
      companyName,
      street,
      city,
      state,
      pincode,
    });
    const existing = poShippingExtras.find((row) => row.address === address);
    const option = existing || { id: newCustomShippingId(), address };
    if (!existing) {
      setPoShippingExtras((current) => [...current, option]);
    }
    setForm((current) => ({
      ...current,
      shippingAddressId: option.id,
      shippingAddress: option.address,
    }));
    setCustomShippingOpen(false);
    setCustomShippingError(null);
  }

  const shippingSelectOptions = useMemo(() => {
    const location = companyLocationById(form.companyLocationId);
    const presets = location.lockShippingToEntity
      ? [
          {
            id: "mumbai-eastern-court",
            address: formatEntityAddress(location),
          },
        ]
      : SHIPPING_ADDRESS_OPTIONS.map((option) => ({
          id: option.id,
          address: formatShippingAddress(location.addressHeader, option.id),
        }));
    const extras = poShippingExtras.filter(
      (extra) => !presets.some((preset) => preset.address === extra.address),
    );
    return [...presets, ...extras];
  }, [form.companyLocationId, poShippingExtras]);

  const showShippingDropdown =
    !companyLocationById(form.companyLocationId).lockShippingToEntity ||
    poShippingExtras.length > 0;

  function removeLine(lineId: string) {
    setLines((current) => {
      const next = current.filter((row) => row.id !== lineId);
      return next.length > 0 ? next : [emptyLine(form.taxPercentage || "18")];
    });
  }

  function addLine() {
    setLines((current) => [...current, emptyLine(form.taxPercentage || "18")]);
  }

  async function submit(mode: "draft" | "finalize") {
    if (!preview?.can_create_po) {
      setError(
        preview?.purchase_order_id
          ? "A purchase order already exists for this OVF."
          : "This OVF is not ready for PO creation.",
      );
      return;
    }
    const vendorError = validateVendorFields();
    if (vendorError) {
      setError(vendorError);
      requestAnimationFrame(() => {
        actionErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    const vendorId = resolveVendorId();
    if (!form.companyLocationId) {
      setError("Select entity name");
      requestAnimationFrame(() => {
        actionErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    const location = COMPANY_LOCATIONS.find((row) => row.id === form.companyLocationId);
    if (!location) {
      setError("Select a valid entity name");
      requestAnimationFrame(() => {
        actionErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    if (vendorId !== form.vendorId) {
      setForm((current) => ({ ...current, vendorId }));
    }

    const poLines: Array<{
      product_name: string;
      qty: number;
      unit_price: number;
      rate_currency: "INR" | "USD";
      tax_rate: number;
    }> = [];
    for (const row of lines) {
      const productName = row.itemDetails.trim();
      if (!productName) continue;
      const qty = Number(row.qty);
      const unitPrice = Number(row.rate);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        setError(`Vendor line '${productName}' needs qty and unit cost > 0`);
        requestAnimationFrame(() => {
          actionErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        return;
      }
      const usd = isUsdLine(row);
      poLines.push({
        product_name: productName,
        qty,
        unit_price: unitPrice,
        rate_currency: usd ? "USD" : "INR",
        tax_rate: usd ? 0 : toNumber(row.taxPct),
      });
    }
    if (poLines.length === 0) {
      setError("Add at least one vendor line with qty and unit cost > 0");
      requestAnimationFrame(() => {
        actionErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await persistVendorDetails(vendorId);
      const needsApproval = mode === "finalize";
      const order = await createPoFromOvf(ovfId, {
        vendor_id: vendorId,
        document_date: form.purchaseDate || undefined,
        payment_terms: form.paymentTerms || null,
        expected_delivery_date: form.deliveryDate || null,
        entity_code: location.entityCode,
        order_ref_cache: form.orderRefCache?.trim() || null,
        currency_code: poLines.length > 0 && poLines.every((ln) => ln.rate_currency === "USD")
          ? "USD"
          : "INR",
        // A PO is always created as a draft. Only an administrator's
        // acceptance from the Approval workspace may issue it.
        finalize: false,
        lines: poLines,
      });
      for (const document of scmDocuments) {
        await uploadScmPoAttachment(order.id, {
          file_name: document.file.name,
          content_base64: await fileToBase64(document.file),
          content_type: document.file.type || "application/octet-stream",
          branch_id: preview.branch_id,
          company_id: preview.company_id,
          category: document.category,
          remarks: document.remarks.trim() || null,
        });
      }
      setScmDocuments([]);
      if (needsApproval) {
        const documents = await collectPoApprovalDocuments({
          orderId: order.id,
          ovfId,
        });
        submitPoFinalizeApproval({
          orderId: order.id,
          documentNumber: order.document_number,
          companyPoNumber: order.company_po_number,
          customerName:
            order.customer_name ||
            form.customerName ||
            preview?.customer_name ||
            preview?.account_name ||
            null,
          vendorId: order.vendor_id || vendorId,
          vendorName:
            form.vendorName ||
            selectedVendor?.label ||
            preview?.oem_name ||
            null,
          ovfId,
          documents,
        });
        router.replace(`/procurement/orders/${order.id}?approval=pending`);
        return;
      }
      if (mode === "finalize") {
        router.replace(`/procurement/orders/${order.id}`);
      } else {
        window.location.assign("/procurement/scm");
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create purchase order",
      );
      setBusy(false);
      requestAnimationFrame(() => {
        actionErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  async function onPreviewPoPdf() {
    setPdfPreviewBusy(true);
    setError(null);
    try {
      const pdfLines = lines
        .map((row) => {
          const usd = isUsdLine(row);
          return {
            partNo: (row.partNumber || row.itemDetails || "").trim() || "—",
            description: (row.itemDetails || row.partNumber || "").trim() || "—",
            hsnCode: row.hsnCode?.trim() || undefined,
            qty: toNumber(row.qty),
            unitPriceInr: usd
              ? toNumber(row.rate)
              : adjustedUnitRate(toNumber(row.rate), distiPct, form.distiSign),
            rateCurrency: usd ? ("USD" as const) : ("INR" as const),
          };
        })
        .filter((row) => row.qty > 0 || row.unitPriceInr > 0);
      if (pdfLines.length === 0) {
        setError("Add at least one line item to preview the PO PDF.");
        return;
      }
      const location =
        COMPANY_LOCATIONS.find((row) => row.id === form.companyLocationId) ||
        COMPANY_LOCATIONS[0];
      const billing =
        (form.billingAddress || "").trim() ||
        formatEntityAddress(location) ||
        DEFAULT_ENTITY_ADDRESS;
      const shipping =
        (form.shippingAddress || "").trim() || DEFAULT_SHIPPING_ADDRESS;
      const buckets: Array<{ taxableAmount: number; taxPct: number }> = allUsdLines(lines)
        ? []
        : lines
            .filter((row) => !isUsdLine(row))
            .map((row) => ({
              taxableAmount: lineSubtotal(row, distiPct, form.distiSign),
              taxPct: toNumber(row.taxPct),
            }));
      if (!allUsdLines(lines) && form.freightTaxable && freightAmount > 0) {
        buckets.push({
          taxableAmount: freightAmount,
          taxPct: toNumber(form.taxPercentage),
        });
      }
      const taxes = buildPoTaxesFromBuckets({
        buckets,
        sourceOfSupply: form.sourceOfSupply,
        destinationOfSupply: location.gstState,
      });
      const input: PurchaseOrderPdfInput = {
        company: {
          name: location.label,
          addressLines: [...location.addressLines],
          phone: "011-47105700-25",
        },
        supplier: {
          name:
            (form.vendorName || selectedVendor?.label || oemName || "").trim() ||
            "—",
          address: (form.vendorAddress || "").trim() || "—",
        },
        customerGstin: form.vendorGstNumber?.trim() || undefined,
        orderRef: form.orderRefCache?.trim() || undefined,
        poNumber:
          form.companyPoNumber?.trim() ||
          `PO/${location.entityCode}/PREVIEW`,
        date: form.purchaseDate || todayIso(),
        billingAddress: billing,
        shippingAddress: shipping,
        currency:
          pdfLines.length > 0 && pdfLines.every((row) => row.rateCurrency === "USD")
            ? "USD"
            : "INR",
        paymentTerms: form.paymentTerms?.trim() || "Net 30 days",
        lines: pdfLines,
        taxes,
        termsAndConditions: [],
      };
      await previewPurchaseOrderPdf(input);
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message
          : "Failed to preview PO PDF",
      );
    } finally {
      setPdfPreviewBusy(false);
    }
  }

  const disabled = !preview?.can_create_po || busy;
  /** Company PO number is tied to entity — lock after number is assigned on the draft. */
  const entityLocked = Boolean(preview?.company_po_number?.trim());
  const editingDraft =
    Boolean(preview?.purchase_order_id) &&
    preview?.can_create_po &&
    (preview?.purchase_order_status || "").toLowerCase() === "draft";

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={`/procurement/scm/ovf/${ovfId}`}
        backLabel="OVF"
        title={editingDraft ? "Edit purchase order" : "Create purchase order"}
        titleClassName="text-3xl font-semibold tracking-tight sm:text-4xl"
        centerTitle
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {scmHoldBanner ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {scmHoldBanner}
        </div>
      ) : null}

      {banner ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {banner}{" "}
          {preview?.purchase_order_id ? (
            <Link
              href={`/procurement/orders/${preview.purchase_order_id}`}
              className="cursor-pointer font-medium underline-offset-2 hover:underline"
            >
              Open PO
            </Link>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !preview ? (
        <p className="text-sm text-muted-foreground">Loading OVF preview…</p>
      ) : null}

      {preview ? (
        <>
          <PoSection title="Vendor &amp; supply" icon={Building2} tone="white">
            <div className="space-y-3">
              <PoField label="Vendor name *">
                <div className="flex gap-2">
                  <FinanceSelect
                    value={form.vendorId}
                    onChange={(e) => onVendorChange(e.target.value)}
                    disabled={disabled}
                    className="min-w-0 flex-1"
                  >
                    <option value="">Select vendor…</option>
                    {vendorsForSelect.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.label}
                      </option>
                    ))}
                  </FinanceSelect>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 shrink-0 cursor-pointer transition-colors duration-200"
                    disabled={disabled}
                    onClick={openVendorDialog}
                    aria-label="Add vendor"
                    title="Add vendor and address"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </PoField>
              {form.vendorId && selectedVendor ? (
                <>
                  {vendorAddressEntries.length > 1 ? (
                    <PoField label="Saved address">
                      <FinanceSelect
                        value={
                          vendorAddressEntries.some(
                            (entry) => entry.address === form.vendorAddress,
                          )
                            ? form.vendorAddress
                            : vendorAddressEntries[0]?.address || ""
                        }
                        onChange={(e) => onVendorAddressChange(e.target.value)}
                        disabled={disabled}
                        className="h-8"
                        aria-label="Load saved vendor address"
                      >
                        {vendorAddressEntries.map((entry) => (
                          <option key={entry.address} value={entry.address}>
                            {entry.gstNumber
                              ? `${entry.address} · GST ${entry.gstNumber}`
                              : entry.address}
                          </option>
                        ))}
                      </FinanceSelect>
                    </PoField>
                  ) : null}
                  <PoField label="Vendor address">
                    <div className="grid gap-3 rounded-lg border border-border bg-card px-2.5 py-2 text-sm md:grid-cols-2">
                      {(
                        [
                          [
                            "Billing",
                            resolveVendorBillingAddress(
                              selectedVendorAddressEntry,
                              form.vendorAddress,
                              form.sourceOfSupply,
                            ),
                          ],
                          [
                            "Shipping",
                            resolveVendorShippingAddress(
                              selectedVendorAddressEntry,
                              form.vendorAddress,
                              form.destinationOfSupply,
                            ),
                          ],
                        ] as const
                      ).map(([label, address]) => {
                        const lines = formatPostalAddressLines(address);
                        return (
                          <div key={label} className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {label}
                            </p>
                            {lines.length > 0 ? (
                              <div className="space-y-0.5 font-medium text-foreground">
                                {lines.map((line, index) => (
                                  <p key={`${label}-${index}`} className="min-w-0 break-words">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="font-medium text-foreground">—</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </PoField>
                  <PoField label="GST number *">
                    <Input
                      value={form.vendorGstNumber ?? ""}
                      onChange={(e) => setField("vendorGstNumber", e.target.value)}
                      disabled={disabled}
                      className="h-8"
                      placeholder="Vendor GSTIN"
                    />
                  </PoField>
                  <PoField label="Source of supply *">
                    <FinanceSelect
                      value={form.sourceOfSupply}
                      onChange={(e) => setField("sourceOfSupply", e.target.value)}
                      disabled={disabled}
                    >
                      <option value="">Select state…</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </FinanceSelect>
                  </PoField>
                  <PoField label="Destination of supply *">
                    <FinanceSelect
                      value={form.destinationOfSupply}
                      onChange={(e) => setField("destinationOfSupply", e.target.value)}
                      disabled={disabled}
                    >
                      <option value="">Select state…</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </FinanceSelect>
                  </PoField>
                </>
              ) : null}
            </div>
          </PoSection>

          <PoSection title="Our company &amp; addresses" icon={Landmark} tone="white">
            <div className="space-y-3">
              <PoField label="Entity name *" className="max-w-lg">
                <FinanceSelect
                  value={form.companyLocationId}
                  onChange={(e) => onCompanyLocationChange(e.target.value)}
                  disabled={disabled || entityLocked}
                  title={
                    entityLocked
                      ? "Entity is locked because this company PO number is already assigned"
                      : undefined
                  }
                >
                  {COMPANY_LOCATIONS.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.label}
                    </option>
                  ))}
                </FinanceSelect>
                {entityLocked ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Entity cannot change after the company PO number is assigned (kept on
                    reject / resubmit).
                  </p>
                ) : null}
              </PoField>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-6">
                <PoField label="Billing address">
                  <FinanceTextarea
                    value={form.billingAddress || DEFAULT_ENTITY_ADDRESS}
                    readOnly
                    rows={8}
                    className="min-h-[11rem] cursor-default resize-none overflow-y-auto bg-muted/30 font-medium text-foreground"
                  />
                </PoField>
                <div className="block space-y-1">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Shipping address
                  </span>
                  <div className="flex items-start gap-2">
                    {showShippingDropdown ? (
                      <div ref={shippingMenuRef} className="relative min-w-0 flex-1">
                        <button
                          type="button"
                          disabled={disabled}
                          aria-haspopup="listbox"
                          aria-expanded={shippingMenuOpen}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShippingMenuOpen((open) => !open);
                          }}
                          className={cn(
                            "flex min-h-[11rem] w-full cursor-pointer items-start gap-2 rounded-lg border border-input bg-muted/30 px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors duration-200",
                            "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                            disabled && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <span className="min-w-0 flex-1 whitespace-pre-wrap">
                            {form.shippingAddress || DEFAULT_SHIPPING_ADDRESS}
                          </span>
                          <ChevronDown
                            className={cn(
                              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                              shippingMenuOpen && "rotate-180",
                            )}
                          />
                        </button>
                        {shippingMenuOpen && !disabled ? (
                          <ul
                            role="listbox"
                            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md"
                          >
                            {shippingSelectOptions.map((option) => {
                              const selected = form.shippingAddressId === option.id;
                              return (
                                <li key={option.id} role="option" aria-selected={selected}>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => {
                                      // Prevent label/toggle re-open: close on mousedown before click retargets.
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onShippingAddressChange(option.id);
                                      setShippingMenuOpen(false);
                                    }}
                                    className={cn(
                                      "w-full cursor-pointer rounded-md px-2.5 py-2 text-left text-sm font-medium whitespace-pre-wrap transition-colors duration-150",
                                      selected
                                        ? "bg-primary/10 text-foreground"
                                        : "text-foreground hover:bg-muted/60",
                                    )}
                                  >
                                    {option.address}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>
                    ) : (
                      <FinanceTextarea
                        value={form.shippingAddress || form.billingAddress || DEFAULT_ENTITY_ADDRESS}
                        readOnly
                        rows={8}
                        className="min-h-[11rem] min-w-0 flex-1 cursor-default resize-none overflow-y-auto bg-muted/30 font-medium text-foreground"
                      />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-8 shrink-0 cursor-pointer transition-colors duration-200"
                      disabled={disabled}
                      onClick={openCustomShippingDialog}
                      aria-label="Add one-time shipping address for this PO"
                      title="Add one-time shipping address for this PO"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </PoSection>

          <PoSection title="References &amp; dates" icon={CalendarDays} tone="white">
            <div className="grid gap-3 md:grid-cols-2">
              <PoField label="Company PO number">
                <Input
                  value={form.companyPoNumber ?? ""}
                  readOnly
                  className="h-8 cursor-default bg-muted/30 font-medium text-foreground"
                />
              </PoField>
              <PoField label="Purchase date">
                <Input
                  type="date"
                  value={form.purchaseDate ?? ""}
                  onChange={(e) => setField("purchaseDate", e.target.value)}
                  disabled={disabled}
                  className="h-8"
                />
              </PoField>
              <PoField label="Payment terms">
                <div ref={paymentTermsMenuRef} className="relative">
                  <div className="flex h-8 overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                    <Input
                      value={form.paymentTerms ?? ""}
                      onChange={(e) => setField("paymentTerms", e.target.value)}
                      disabled={disabled}
                      className="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                      placeholder="Type days or pick from list"
                      aria-label="Payment terms"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      disabled={disabled}
                      aria-haspopup="listbox"
                      aria-expanded={paymentTermsMenuOpen}
                      aria-label="Payment terms presets"
                      onClick={() => setPaymentTermsMenuOpen((open) => !open)}
                      className={cn(
                        "flex h-8 w-9 shrink-0 cursor-pointer items-center justify-center border-l border-input bg-transparent text-muted-foreground transition-colors duration-200",
                        "hover:bg-muted/40 hover:text-foreground",
                        disabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform duration-200",
                          paymentTermsMenuOpen && "rotate-180",
                        )}
                      />
                    </button>
                  </div>
                  {paymentTermsMenuOpen && !disabled ? (
                    <ul
                      role="listbox"
                      className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-md"
                    >
                      {PAYMENT_TERM_PRESETS.map((preset) => {
                        const selected = form.paymentTerms === preset;
                        return (
                          <li key={preset} role="option" aria-selected={selected}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setField("paymentTerms", preset);
                                setPaymentTermsMenuOpen(false);
                              }}
                              className={cn(
                                "flex w-full cursor-pointer rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-200",
                                selected
                                  ? "bg-sky-50 font-medium text-sky-900"
                                  : "text-foreground hover:bg-muted/60",
                              )}
                            >
                              {preset}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </PoField>
              <PoField label="OVF number">
                <Input
                  value={form.ovfNumber ?? ""}
                  readOnly
                  className="h-8 cursor-default bg-muted/30 font-medium text-foreground"
                />
              </PoField>
              <PoField label="Order Ref. Cache">
                <Input
                  value={form.orderRefCache ?? ""}
                  onChange={(e) => setField("orderRefCache", e.target.value)}
                  disabled={disabled}
                  className="h-8"
                  autoComplete="off"
                  aria-label="Order Ref. Cache"
                />
              </PoField>
              <PoField label="Customer PO number">
                <Input
                  value={form.customerPoNumber ?? ""}
                  onChange={(e) => setField("customerPoNumber", e.target.value)}
                  disabled={disabled}
                  className="h-8"
                />
              </PoField>
              <PoField label="Customer PO date">
                <Input
                  type="date"
                  value={form.customerPoDate ?? ""}
                  onChange={(e) => setField("customerPoDate", e.target.value)}
                  disabled={disabled}
                  className="h-8"
                />
              </PoField>
              <PoField label="Customer name">
                <Input
                  value={form.customerName ?? ""}
                  onChange={(e) => setField("customerName", e.target.value)}
                  disabled={disabled}
                  className="h-8"
                />
              </PoField>
              <PoField label="Customer delivery date">
                <Input
                  type="date"
                  value={form.deliveryDate ?? ""}
                  onChange={(e) => setField("deliveryDate", e.target.value)}
                  disabled={disabled}
                  className="h-8"
                />
              </PoField>
            </div>
          </PoSection>

          <ScmCommercialDocumentsPanel
            ovfId={ovfId}
            branchId={preview.branch_id}
            companyId={preview.company_id}
            title="OVF document"
            allowUpload={false}
            className="border-border bg-card"
          />

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <ClipboardList className="size-3.5" aria-hidden />
                </span>
                <h2 className="text-sm font-extrabold tracking-tight text-foreground">Line items</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Apply GST to all
                  <FinanceSelect
                    value={uniformTaxPct ?? ""}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      applyGlobalTax(e.target.value);
                    }}
                    disabled={disabled || lines.length === 0 || allLinesUsd}
                    className="h-8 w-[104px] cursor-pointer transition-colors duration-200"
                    aria-label="Apply GST percent to all line items"
                    title={
                      allLinesUsd
                        ? "GST is not applied when every line is USD"
                        : "Sets the same GST % on every INR line"
                    }
                  >
                    {uniformTaxPct == null ? (
                      <option value="" disabled>
                        Mixed
                      </option>
                    ) : null}
                    {TAX_OPTIONS.map((pct) => (
                      <option key={pct} value={pct}>
                        {pct}%
                      </option>
                    ))}
                  </FinanceSelect>
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-[11px] font-bold tracking-wide text-slate-600 uppercase">
                  <tr>
                    <th className="px-2 py-2.5 font-bold">S.No</th>
                    <th className="min-w-[220px] px-2 py-2.5 font-bold">Item details</th>
                    <th className="min-w-[120px] px-2 py-2.5 font-bold">Part number</th>
                    <th className="min-w-[100px] px-2 py-2.5 font-bold">HSN code</th>
                    <th className="min-w-[100px] px-2 py-2.5 font-bold">PO type</th>
                    <th className="min-w-[72px] px-2 py-2.5 font-bold">Qty</th>
                    <th className="min-w-[168px] px-2 py-2.5 font-bold">Rate</th>
                    <th className="min-w-[88px] px-2 py-2.5 font-bold">Tax %</th>
                    <th className="min-w-[120px] px-2 py-2.5 font-bold">Amount</th>
                    <th className="px-2 py-2.5 font-bold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                        No line items yet.
                      </td>
                    </tr>
                  ) : null}
                  {lines.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border/70 align-top",
                        index % 2 === 1 ? "bg-muted/30" : "bg-card",
                      )}
                    >
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                      <td className="px-2 py-2">
                        <ItemDetailsTextarea
                          value={row.itemDetails ?? ""}
                          disabled={disabled}
                          onChange={(value) => setLineField(row.id, "itemDetails", value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={row.partNumber ?? ""}
                          onChange={(e) => setLineField(row.id, "partNumber", e.target.value)}
                          disabled={disabled}
                          className="h-8"
                          placeholder="Part no."
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={row.hsnCode ?? ""}
                          onChange={(e) => setLineField(row.id, "hsnCode", e.target.value)}
                          disabled={disabled}
                          className="h-8"
                          placeholder="HSN / SAC"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <FinanceSelect
                          value={row.poType}
                          onChange={(e) =>
                            setLineField(
                              row.id,
                              "poType",
                              e.target.value === "Services" ? "Services" : "Goods",
                            )
                          }
                          disabled={disabled}
                          className="h-8 cursor-pointer transition-colors duration-200"
                        >
                          <option value="Goods">Goods</option>
                          <option value="Services">Services</option>
                        </FinanceSelect>
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={row.qty ?? ""}
                          onChange={(e) => setLineField(row.id, "qty", e.target.value)}
                          disabled={disabled}
                          className={cn("h-8", NO_SPINNER)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex h-8 overflow-hidden rounded-md border border-input transition-colors duration-200 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                          <select
                            value={row.rateCurrency}
                            onChange={(e) => {
                              const next = e.target.value === "USD" ? "USD" : "INR";
                              if (next === "USD" && !isUsdLine(row)) {
                                openUsdConvertDialog(row.id);
                                return;
                              }
                              if (next === "INR" && isUsdLine(row)) {
                                setLineRateCurrency(row.id, "INR");
                              }
                            }}
                            disabled={disabled}
                            className="h-8 w-[58px] shrink-0 cursor-pointer border-0 border-r border-input bg-muted px-1 text-[11px] font-medium text-foreground outline-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Rate currency for line ${index + 1}`}
                            title="INR rolls into GST and total. USD asks for INR per $1, converts the unit rate, and has no GST."
                          >
                            <option value="INR">INR</option>
                            <option value="USD">USD</option>
                          </select>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={
                              isUsdLine(row) || distiPct === 0
                                ? (row.rate ?? "")
                                : formatRateValue(
                                    adjustedUnitRate(
                                      toNumber(row.rate),
                                      distiPct,
                                      form.distiSign,
                                    ),
                                  )
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                setLineField(row.id, "rate", "");
                                return;
                              }
                              if (isUsdLine(row) || distiPct === 0) {
                                setLineField(row.id, "rate", raw);
                                return;
                              }
                              const entered = toNumber(raw);
                              const factor = distiFactor(distiPct, form.distiSign);
                              const base =
                                distiPct === 0 || factor === 0
                                  ? entered
                                  : entered / factor;
                              setLineField(row.id, "rate", formatRateValue(base));
                            }}
                            disabled={disabled}
                            className={cn(
                              "h-8 rounded-none border-0 shadow-none focus-visible:ring-0",
                              NO_SPINNER,
                            )}
                            aria-label={`Rate for line ${index + 1}`}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <FinanceSelect
                          value={isUsdLine(row) ? "0" : normalizeTaxOption(row.taxPct)}
                          onChange={(e) => setLineField(row.id, "taxPct", e.target.value)}
                          disabled={disabled || isUsdLine(row)}
                          className="h-8 w-[88px] cursor-pointer transition-colors duration-200"
                          aria-label={`Tax percent for line ${index + 1}`}
                          title={
                            isUsdLine(row)
                              ? "USD lines have no GST"
                              : "GST percent for this INR line"
                          }
                        >
                          {TAX_OPTIONS.map((pct) => (
                            <option key={pct} value={pct}>
                              {pct}%
                            </option>
                          ))}
                        </FinanceSelect>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex h-8 items-center rounded-md border border-border bg-muted/40 px-2 text-sm font-medium tabular-nums">
                          {isUsdLine(row)
                            ? formatUsd(lineSubtotal(row))
                            : formatInr(lineSubtotal(row, distiPct, form.distiSign))}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted/60 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={disabled}
                          aria-label={`Remove line ${index + 1}`}
                          title="Remove line"
                          onClick={() => removeLine(row.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4 border-t border-border bg-card px-3 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-0.5 h-7 cursor-pointer px-2 text-xs transition-colors duration-200"
                disabled={disabled}
                onClick={addLine}
              >
                Add line
              </Button>
              <div className="flex flex-wrap items-end justify-end gap-4">
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center justify-end gap-2">
                    <div
                      role="group"
                      aria-label="Disti sign"
                      className={cn(
                        "relative flex h-8 w-[4.25rem] shrink-0 rounded-full border border-border bg-muted/40 p-0.5",
                        disabled && "opacity-50",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full shadow-sm transition-all duration-200 ease-out",
                          form.distiSign === "plus"
                            ? "left-0.5 bg-emerald-500"
                            : "left-[calc(50%+1px)] bg-rose-500",
                        )}
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setField("distiSign", "plus")}
                        className={cn(
                          "relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-full transition-colors duration-200",
                          form.distiSign === "plus"
                            ? "text-white"
                            : "text-muted-foreground hover:text-foreground",
                          disabled && "cursor-not-allowed",
                        )}
                        aria-pressed={form.distiSign === "plus"}
                        aria-label="Increase unit rate by Disti %"
                        title="Increase unit rate by Disti %"
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setField("distiSign", "minus")}
                        className={cn(
                          "relative z-10 flex h-full flex-1 cursor-pointer items-center justify-center rounded-full transition-colors duration-200",
                          form.distiSign === "minus"
                            ? "text-white"
                            : "text-muted-foreground hover:text-foreground",
                          disabled && "cursor-not-allowed",
                        )}
                        aria-pressed={form.distiSign === "minus"}
                        aria-label="Decrease unit rate by Disti %"
                        title="Decrease unit rate by Disti %"
                      >
                        <Minus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <label className="w-[5.5rem] shrink-0 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Disti margin
                    </label>
                    <div className="relative w-36">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={form.distiAmount}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          if (raw === "") {
                            setField("distiAmount", "");
                            return;
                          }
                          if (!/^\d*\.?\d*$/.test(raw)) return;
                          const cleaned = raw.replace(/^0+(?=\d)/, "");
                          setField("distiAmount", cleaned === "" ? "0" : cleaned);
                        }}
                        onBlur={() => {
                          if (form.distiAmount.trim() === "" || form.distiAmount === ".") {
                            setField("distiAmount", "0");
                          }
                        }}
                        disabled={disabled}
                        className={cn("h-8 pr-7 tabular-nums", NO_SPINNER)}
                        aria-label="Disti margin percent"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className="whitespace-nowrap">Tax GST applicable</span>
                      <input
                        type="checkbox"
                        checked={form.freightTaxable}
                        onChange={(e) => setField("freightTaxable", e.target.checked)}
                        disabled={disabled}
                        className="size-3.5 cursor-pointer accent-sky-700 disabled:cursor-not-allowed"
                        aria-label="Tax GST applicable on freight"
                        title="When checked, GST is applied on total + freight"
                      />
                    </label>
                    <span className="w-20 shrink-0 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Freight
                    </span>
                    <div className="relative w-36">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={form.foreignAmount}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          if (raw === "") {
                            setField("foreignAmount", "");
                            return;
                          }
                          if (!/^\d*\.?\d*$/.test(raw)) return;
                          const cleaned = raw.replace(/^0+(?=\d)/, "");
                          setField("foreignAmount", cleaned === "" ? "0" : cleaned);
                        }}
                        onBlur={() => {
                          if (form.foreignAmount.trim() === "" || form.foreignAmount === ".") {
                            setField("foreignAmount", "0");
                          }
                        }}
                        disabled={disabled}
                        className={cn("h-8 pr-7 tabular-nums", NO_SPINNER)}
                        aria-label="Freight amount in INR"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                        ₹
                      </span>
                    </div>
                  </div>
                </div>
                <div className="min-w-[180px] rounded-lg border border-teal-200/80 bg-teal-50/80 px-3 py-2 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-4 text-muted-foreground">
                    <span>Total</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {allLinesUsd ? formatUsd(itemsSubtotal) : formatInr(itemsSubtotal)}
                    </span>
                  </div>
                  {!allLinesUsd && usdItemsSubtotal > 0 ? (
                    <div className="mt-1 flex items-center justify-between gap-4 text-muted-foreground">
                      <span>USD (not in total)</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {formatUsd(usdItemsSubtotal)}
                      </span>
                    </div>
                  ) : null}
                  {allLinesUsd ? (
                    <div className="mt-1 flex items-center justify-between gap-4 text-muted-foreground">
                      <span>GST</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {formatUsd(0)}
                      </span>
                    </div>
                  ) : taxBreakdown.length > 0 ? (
                    taxBreakdown.map((tax) => (
                      <div
                        key={tax.label}
                        className="mt-1 flex items-center justify-between gap-4 text-muted-foreground"
                      >
                        <span>{tax.label}</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatInr(tax.amountInr)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="mt-1 flex items-center justify-between gap-4 text-muted-foreground">
                      <span>GST</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {formatInr(gstAmount)}
                      </span>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-border pt-1.5 text-base font-semibold tabular-nums text-foreground">
                    <span>Final total</span>
                    <span>
                      {allLinesUsd ? formatUsd(finalTotal) : formatInr(finalTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ScmCommercialDocumentsPanel
            branchId={preview.branch_id}
            companyId={preview.company_id}
            title="SCM documents"
            allowUpload={!disabled}
            className="border-border bg-card"
            draftOnly
            onDraftDocumentsChange={setScmDocuments}
          />

          {preview.can_create_po ? (
            <div className="space-y-2">
              <div ref={actionErrorRef}>
                {error ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 rounded-xl border border-sky-200/80 bg-sky-50/75 p-3 shadow-sm">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer border-slate-300 bg-white text-slate-800 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900"
                  disabled={busy || pdfPreviewBusy}
                  onClick={() => {
                    setError(null);
                    setDraftDialogOpen(true);
                  }}
                >
                  Draft
                </Button>
                <Button
                  type="button"
                  className="cursor-pointer bg-sky-700 text-white transition-colors duration-200 hover:bg-sky-800"
                  disabled={busy || pdfPreviewBusy}
                  onClick={() => void submit("finalize")}
                >
                  Send for admin approval
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer border-sky-300 bg-white text-sky-900 transition-colors duration-200 hover:bg-sky-100"
                  disabled={busy || pdfPreviewBusy}
                  onClick={() => void onPreviewPoPdf()}
                >
                  <Eye className="mr-1.5 size-3.5" />
                  {pdfPreviewBusy ? "Preparing…" : "PDF preview"}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={draftDialogOpen}
        title="Save PO as draft?"
        confirmLabel="Save draft"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => {
          setDraftDialogOpen(false);
          void submit("draft");
        }}
        onCancel={() => {
          if (!busy) setDraftDialogOpen(false);
        }}
      />

      <ConfirmDialog
        open={vendorDialogOpen}
        title="Add vendor"
        description="Enter contact and vendor details. Add one or more addresses (billing, shipping, GST, and supply per location)."
        confirmLabel="Save vendor"
        busy={vendorDialogBusy}
        contentClassName="max-w-2xl max-h-[85vh] overflow-y-auto p-6"
        onConfirm={() => void saveVendorDialog()}
        onCancel={closeVendorDialog}
      >
        <div className="mt-4 space-y-4">
          {vendorDialogError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
              {vendorDialogError}
            </p>
          ) : null}
          <VendorFormFields
            value={vendorDraft}
            onChange={setVendorDraft}
            disabled={vendorDialogBusy}
            showVendorType={false}
            vendorNamePlaceholder={oemName || "Vendor name"}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={customShippingOpen}
        title="One-time shipping address"
        description="Added to this PO shipping list only. Not saved to Vendors or company address lists."
        confirmLabel="Add to shipping list"
        cancelLabel="Cancel"
        contentClassName="max-w-lg max-h-[85vh] overflow-y-auto p-6"
        onConfirm={applyCustomShipping}
        onCancel={() => {
          setCustomShippingOpen(false);
          setCustomShippingError(null);
        }}
      >
        <div className="mt-4 space-y-3">
          {customShippingError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
              {customShippingError}
            </p>
          ) : null}
          <PoField label="Company name *">
            <Input
              value={customShippingDraft.companyName}
              onChange={(e) =>
                setCustomShippingDraft((current) => ({
                  ...current,
                  companyName: e.target.value,
                }))
              }
              className="h-9"
            />
          </PoField>
          <PoField label="Street *">
            <Input
              value={customShippingDraft.street}
              onChange={(e) =>
                setCustomShippingDraft((current) => ({
                  ...current,
                  street: e.target.value,
                }))
              }
              className="h-9"
            />
          </PoField>
          <div className="grid gap-3 sm:grid-cols-2">
            <PoField label="City *">
              <Input
                value={customShippingDraft.city}
                onChange={(e) =>
                  setCustomShippingDraft((current) => ({
                    ...current,
                    city: e.target.value,
                  }))
                }
                className="h-9"
              />
            </PoField>
            <PoField label="Pincode *">
              <Input
                value={customShippingDraft.pincode}
                onChange={(e) =>
                  setCustomShippingDraft((current) => ({
                    ...current,
                    pincode: e.target.value,
                  }))
                }
                className="h-9"
              />
            </PoField>
          </div>
          <PoField label="State *">
            <FinanceSelect
              value={customShippingDraft.state}
              onChange={(e) =>
                setCustomShippingDraft((current) => ({
                  ...current,
                  state: e.target.value,
                }))
              }
            >
              <option value="">Select state…</option>
              {INDIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </FinanceSelect>
          </PoField>
        </div>
      </ConfirmDialog>

      {usdConvertLineId != null
        ? createPortal(
            <ConfirmDialog
              open
              title="Convert rate to USD"
              description="Enter how many rupees equal 1 US dollar. The line unit rate will convert from INR to USD using this rate."
              confirmLabel="Use USD rate"
              cancelLabel="Cancel"
              contentClassName="max-w-md p-6"
              overlayClassName="z-[90]"
              onConfirm={confirmUsdConvert}
              onCancel={closeUsdConvertDialog}
            >
              <div className="mt-4 space-y-3">
                {usdConvertError ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                    {usdConvertError}
                  </p>
                ) : null}
                {usdConvertLine && toNumber(usdConvertLine.rate) > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Current INR unit rate:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatInr(toNumber(usdConvertLine.rate))}
                    </span>
                  </p>
                ) : null}
                <PoField label="1 USD equals (INR) *">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={usdConvertRateDraft}
                    onChange={(e) => {
                      setUsdConvertRateDraft(e.target.value);
                      setUsdConvertError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmUsdConvert();
                      }
                    }}
                    placeholder="e.g. 83.5"
                    className={cn("h-9 tabular-nums", NO_SPINNER)}
                    autoFocus
                  />
                </PoField>
                {usdConvertPreview != null && usdConvertPreview > 0 ? (
                  <p className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                    USD unit rate:{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatUsd(usdConvertPreview)}
                    </span>
                  </p>
                ) : null}
              </div>
            </ConfirmDialog>,
            document.body,
          )
        : null}
    </div>
  );
}
