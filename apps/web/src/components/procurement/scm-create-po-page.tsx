"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Eye,
  Landmark,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { ConfirmDialog } from "@/components/finance/journals/confirm-dialog";
import { DocumentPreviewContent } from "@/components/hr/shared/document-preview-content";
import { FinanceField, FinanceSelect, FinanceTextarea } from "@/components/finance/journals/finance-form-field";
import { PageHeader } from "@/components/layout/page-header";
import {
  buildVendorAddressEntriesFromForm,
  emptyVendorFormDraft,
  emptyVendorFormAddressBlock,
  INDIAN_STATES,
  validateAddressBlock,
  validateVendorFormDraft,
  VendorAddressBlockFields,
  VendorFormFields,
  type VendorFormDraft,
  type VendorFormAddressBlock,
} from "@/components/procurement/vendor-form-fields";
import { parseVendorQuoteNo } from "@/components/crm/sales/ovf-order-lines-section";
import {
  ScmCommercialDocumentsPanel,
  type PendingScmCommercialDocument,
} from "@/components/procurement/scm-commercial-documents-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hasAcceptedCreatePoInStockApproval } from "@/lib/procurement-approvals";
import { useProcurementRole } from "@/hooks/use-procurement-role";
import { scmHoldCreatePoNotice } from "@/utils/scm-ovf-hold";
import { ApiClientError } from "@/services/api-client";
import {
  createPoFromOvf,
  createVendorOption,
  emptyPostalAddress,
  formatInr,
  formatUsd,
  getPurchaseOrder,
  getScmOvfPreview,
  listVendorOptions,
  peekNextCompanyPoNumber,
  requestScmFinalizeApproval,
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
  downloadPurchaseOrderPdf,
  type PurchaseOrderPdfInput,
} from "@/utils/purchase-order-pdf";
import { ensureScmOvfPdfAttached } from "@/utils/scm-ovf-pdf-attach";
import { buildScmPoPrintPdfAttachment } from "@/utils/scm-po-pdf-attach";
import {
  findVendorAddressEntryByState,
  matchVendorByDistributor,
} from "@/utils/vendor-oem-match";
import {
  bindOvfItemPlanRowsToPo,
  clearOvfPoLineQtyOverrides,
  clearOvfPoRemainderProducts,
  ovfCreatePoSeedVendorLines,
  ovfPoSeedVendorLines,
  ovfProductKey,
  ovfRequiresInStockCreatePoApproval,
  ovfVendorDescriptionByProduct,
  peekOvfPendingItemPlanPoRows,
  peekOvfPoLineQtyOverrides,
  peekOvfPoRemainderProducts,
  resolvePoForDistributor,
  takeOvfPendingItemPlanPoRows,
} from "@/utils/ovf-stock";

/** Draft PO for this Create PO session (matched distributor), or null when creating a new series. */
function resolveCreatePoDraftTarget(
  ovf: ScmOvfPreview,
  distributorName: string | null | undefined,
): { id: string; companyPoNumber: string | null; status: string | null } | null {
  const distributor = (distributorName || "").trim();
  if (distributor) {
    const linked = resolvePoForDistributor(ovf, distributor);
    if (!linked?.id) return null;
    if ((linked.status || "").toLowerCase() !== "draft") return null;
    const fromList = (ovf.purchase_orders || []).find((row) => String(row.id) === String(linked.id));
    return {
      id: String(linked.id),
      companyPoNumber:
        (fromList?.company_po_number || "").trim() ||
        (linked.label || "").trim() ||
        null,
      status: linked.status || "draft",
    };
  }
  const draft = (ovf.purchase_orders || []).find(
    (row) => (row.status || "").toLowerCase() === "draft",
  );
  if (draft?.id) {
    return {
      id: String(draft.id),
      companyPoNumber: (draft.company_po_number || "").trim() || null,
      status: draft.status || "draft",
    };
  }
  if (
    ovf.purchase_order_id &&
    (ovf.purchase_order_status || "").toLowerCase() === "draft"
  ) {
    return {
      id: String(ovf.purchase_order_id),
      companyPoNumber: (ovf.company_po_number || "").trim() || null,
      status: "draft",
    };
  }
  return null;
}

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

function formatPostalAddressLines(address: VendorPostalAddress): string[] {
  return [address.street, address.city, address.state, address.pincode, address.country]
    .map((part) => (part || "").trim())
    .filter(Boolean);
}

function vendorAddressPreviewLines(entry: VendorAddressEntry | null | undefined): string[] {
  if (!entry) return [];
  const billing = entry.billing;
  if (billing && (billing.street || billing.city || billing.pincode)) {
    const lines = formatPostalAddressLines(billing);
    if (lines.length > 0) return lines;
  }
  const composed = entry.address.trim();
  if (!composed) return [];
  return composed.split(/,\s*/).map((part) => part.trim()).filter(Boolean);
}

function vendorAddressOptionLabel(entry: VendorAddressEntry): string {
  const firstLine = entry.address.split(/\r?\n/)[0]?.trim() || entry.address.trim();
  const short = firstLine.length > 72 ? `${firstLine.slice(0, 69)}…` : firstLine;
  return entry.gstNumber ? `${short} · GST ${entry.gstNumber}` : short || "Address";
}

function vendorAddressSearchHaystack(entry: VendorAddressEntry): string {
  const billing = entry.billing;
  return [
    entry.address,
    entry.gstNumber,
    entry.sourceOfSupply,
    entry.destinationOfSupply,
    billing?.street,
    billing?.city,
    billing?.state,
    billing?.pincode,
    billing?.country,
  ]
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function vendorAddressIdentity(entry: VendorAddressEntry): string {
  const billing = entry.billing;
  return [
    billing?.street?.trim() || entry.address.trim(),
    billing?.city?.trim() || "",
    billing?.pincode?.trim() || "",
    entry.gstNumber?.trim() || "",
  ]
    .join("|")
    .toLowerCase();
}

/** Distributor for the PO being created (URL param or seeded vendor lines). */
function textOrDash(value: string | null | undefined): string {
  const text = (value || "").trim();
  return text || "-";
}

function resolvePoDistributorName(
  preview: ScmOvfPreview | null,
  distributorParam: string | null,
  remainderFromStock: boolean,
  ovfId: string,
): string {
  const param = (distributorParam || "").trim();
  if (!preview) return param;
  const seedVendorLines = remainderFromStock
    ? (() => {
      const all = preview.vendor_lines || [];
      const limited = peekOvfPoRemainderProducts(ovfId);
      if (!limited || limited.length === 0) return all;
      const keys = new Set(limited.map((name) => ovfProductKey(name)));
      const matched = all.filter((ln) => keys.has(ovfProductKey(ln.product_name)));
      return matched.length > 0 ? matched : all;
    })()
    : ovfPoSeedVendorLines(preview.vendor_lines || [], distributorParam);
  return (param || seedVendorLines[0]?.distributor_name || preview.distributor_name || "").trim();
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

/** Shipping address presets - body only; entity name is prepended from Entity dropdown. */
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
  /** Apply Disti % as +/- on each line unit rate (Rate column). */
  distiSign: "plus" | "minus";
  foreignAmount: string;
  freightTaxable: boolean;
  /** INR per 1 USD - used when switching line rates between INR and USD. */
  usdInrRate: string;
};

type PoLineRow = {
  id: string;
  itemDetails: string;
  description: string;
  partNumber: string;
  hsnCode: string;
  poType: "Goods" | "Services";
  qty: string;
  rate: string;
  rateCurrency: "INR" | "USD";
  taxPct: string;
  /** INR per 1 USD for this line only. */
  usdInrRate: string;
  /** Original INR unit rate, restored when switching USD back to INR. */
  inrRateSnapshot: string;
};

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
  if (!Number.isFinite(value)) return "0.00";
  return (Math.round(value * 100) / 100).toFixed(2);
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
    freightTaxable: true,
    usdInrRate: "",
  };
}

function emptyLine(taxPct = "18"): PoLineRow {
  return {
    id: crypto.randomUUID(),
    itemDetails: "",
    description: "",
    partNumber: "",
    hsnCode: "",
    poType: "Goods",
    qty: "1",
    rate: "0",
    rateCurrency: "INR",
    taxPct,
    usdInrRate: "",
    inrRateSnapshot: "",
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
  placeholder = "Product name",
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
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
      placeholder={placeholder}
    />
  );
}

export function ScmCreatePoPage({ ovfId }: { ovfId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin } = useProcurementRole();
  const remainderFromStock = searchParams.get("from") === "stock-remainder";
  const distributorParam = searchParams.get("distributor");
  const distributorStateParam = (searchParams.get("state") || "").trim();
  const shippingMenuRef = useRef<HTMLDivElement>(null);
  const vendorAddressMenuRef = useRef<HTMLDivElement>(null);
  const ovfPdfAttachKeyRef = useRef<string | null>(null);
  const [preview, setPreview] = useState<ScmOvfPreview | null>(null);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [form, setForm] = useState<PoFormState>(emptyForm);
  const [lines, setLines] = useState<PoLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shippingMenuOpen, setShippingMenuOpen] = useState(false);
  const [vendorAddressMenuOpen, setVendorAddressMenuOpen] = useState(false);
  const [vendorAddressSearch, setVendorAddressSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);
  const [vendorDialogBusy, setVendorDialogBusy] = useState(false);
  const [vendorDialogError, setVendorDialogError] = useState<string | null>(null);
  const [vendorAddressDialogOpen, setVendorAddressDialogOpen] = useState(false);
  const [vendorAddressDialogBusy, setVendorAddressDialogBusy] = useState(false);
  const [vendorAddressDialogError, setVendorAddressDialogError] = useState<string | null>(null);
  const [vendorAddressDraft, setVendorAddressDraft] = useState<VendorFormAddressBlock>(
    emptyVendorFormAddressBlock(),
  );
  const [selectedVendorAddressIndex, setSelectedVendorAddressIndex] = useState(0);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [vendorDraft, setVendorDraft] = useState<VendorFormDraft>(emptyVendorFormDraft());
  const [customShippingOpen, setCustomShippingOpen] = useState(false);
  const [customShippingError, setCustomShippingError] = useState<string | null>(null);
  const [customShippingDraft, setCustomShippingDraft] = useState<CustomShippingDraft>(
    emptyCustomShippingDraft(),
  );
  const [poShippingExtras, setPoShippingExtras] = useState<PoShippingOption[]>([]);
  const [pdfPreviewBusy, setPdfPreviewBusy] = useState(false);
  const [pdfPreviewDataUrl, setPdfPreviewDataUrl] = useState<string | null>(null);
  const [scmDocuments, setScmDocuments] = useState<PendingScmCommercialDocument[]>([]);
  const [ovfDocsRefreshKey, setOvfDocsRefreshKey] = useState(0);
  const [usdConvertLineId, setUsdConvertLineId] = useState<string | null>(null);
  const [usdConvertRateDraft, setUsdConvertRateDraft] = useState("");
  const [usdConvertError, setUsdConvertError] = useState<string | null>(null);
  const actionErrorRef = useRef<HTMLDivElement>(null);

  const activeDistributorName = useMemo(
    () => resolvePoDistributorName(preview, distributorParam, remainderFromStock, ovfId),
    [preview, distributorParam, remainderFromStock, ovfId],
  );
  const poSeedVendorLines = useMemo(
    () =>
      preview
        ? ovfCreatePoSeedVendorLines(preview, {
          ovfId,
          distributorParam,
          remainderFromStock,
        })
        : [],
    [preview, ovfId, distributorParam, remainderFromStock],
  );
  const vendorItemDescriptionByProduct = useMemo(
    () => ovfVendorDescriptionByProduct(poSeedVendorLines, preview?.vendor_lines),
    [poSeedVendorLines, preview?.vendor_lines],
  );
  const resolveVendorItemDescription = useCallback(
    (productName: string) =>
      vendorItemDescriptionByProduct.get(ovfProductKey(productName)) || "",
    [vendorItemDescriptionByProduct],
  );
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
  const filteredVendorAddressEntries = useMemo(() => {
    const needle = vendorAddressSearch.trim().toLowerCase();
    if (!needle) {
      return vendorAddressEntries.map((entry, index) => ({ entry, index }));
    }
    return vendorAddressEntries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => vendorAddressSearchHaystack(entry).includes(needle));
  }, [vendorAddressEntries, vendorAddressSearch]);
  const selectedVendorAddressEntry = useMemo(() => {
    if (!selectedVendor) return null;
    const entries = selectedVendor.addressEntries ?? [];
    return entries[selectedVendorAddressIndex] || entries.find(
      (entry) => entry.address === form.vendorAddress,
    ) || entries[0] || null;
  }, [selectedVendor, selectedVendorAddressIndex, form.vendorAddress]);

  useEffect(() => {
    setVendorAddressMenuOpen(false);
    if (!selectedVendor) {
      setSelectedVendorAddressIndex(0);
      return;
    }
    const matched = findVendorAddressEntryByState(selectedVendor, distributorStateParam);
    setSelectedVendorAddressIndex(matched?.index ?? 0);
  }, [form.vendorId, selectedVendor, distributorStateParam]);

  const lockedVendorDisplayName = useMemo(() => {
    return (
      (form.vendorName || "").trim() ||
      (selectedVendor?.label || "").trim() ||
      (activeDistributorName || "").trim() ||
      ""
    );
  }, [form.vendorName, selectedVendor?.label, activeDistributorName]);

  const inventoryTakenRows = useMemo(() => {
    if (!remainderFromStock || !preview) return [];
    const fromAvailability = (preview.stock_availability || []).filter(
      (row) => Number(row.allocated_qty) > 0,
    );
    if (fromAvailability.length > 0) return fromAvailability;
    const byProduct = new Map<
      string,
      { product_name: string; required_qty: number; allocated_qty: number; remaining_qty: number; on_hand_qty: number }
    >();
    for (const row of preview.stock_allocations || []) {
      const key = ovfProductKey(row.product_name);
      const qty = Number(row.quantity) || 0;
      if (!key || qty <= 0) continue;
      const prev = byProduct.get(key);
      if (prev) {
        prev.allocated_qty += qty;
      } else {
        byProduct.set(key, {
          product_name: row.product_name,
          required_qty: qty,
          allocated_qty: qty,
          remaining_qty: 0,
          on_hand_qty: 0,
        });
      }
    }
    return [...byProduct.values()];
  }, [remainderFromStock, preview]);

  const setField = useCallback(<K extends keyof PoFormState>(key: K, value: PoFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const setLineField = useCallback(
    <K extends keyof PoLineRow>(lineId: string, key: K, value: PoLineRow[K]) => {
      setLines((current) => {
        const next = current.map((row) => {
          if (row.id !== lineId) return row;
          const nextRow = { ...row, [key]: value };
          if (key === "itemDetails") {
            const previousResolved = resolveVendorItemDescription(row.itemDetails);
            const nextResolved = resolveVendorItemDescription(String(value));
            const currentDescription = (row.description || "").trim();
            // Keep a user-edited description; only auto-fill when blank or still the catalog default.
            if (!currentDescription || currentDescription === previousResolved.trim()) {
              nextRow.description = nextResolved;
            }
          }
          if (key === "rate" && row.rateCurrency === "USD") {
            nextRow.inrRateSnapshot = "";
          }
          return nextRow;
        });
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
    [resolveVendorItemDescription],
  );

  const setLineRateCurrency = useCallback(
    (lineId: string, currency: "INR" | "USD") => {
      setLines((current) =>
        current.map((row) => {
          if (row.id !== lineId) return row;
          if (currency === "USD") {
            return { ...row, rateCurrency: "USD", taxPct: "0" };
          }
          const snapshot = row.inrRateSnapshot.trim();
          const exchange = toNumber(row.usdInrRate || form.usdInrRate);
          const converted =
            row.rateCurrency === "USD" && exchange > 0
              ? usdRateToInr(toNumber(row.rate), exchange)
              : toNumber(row.rate);
          const restored =
            snapshot || (converted > 0 ? formatRateValue(converted) : row.rate);
          return {
            ...row,
            rateCurrency: "INR",
            taxPct: normalizeTaxOption(form.taxPercentage || "18"),
            rate: restored,
            inrRateSnapshot: "",
          };
        }),
      );
    },
    [form.taxPercentage, form.usdInrRate],
  );

  function openUsdConvertDialog(lineId: string) {
    const line = lines.find((row) => row.id === lineId);
    setUsdConvertLineId(lineId);
    setUsdConvertRateDraft(line?.usdInrRate || form.usdInrRate || "");
    setUsdConvertError(null);
  }

  function closeUsdConvertDialog() {
    setUsdConvertLineId(null);
    setUsdConvertRateDraft("");
    setUsdConvertError(null);
  }

  function confirmUsdConvert() {
    const targetId = usdConvertLineId;
    if (!targetId) return;
    const exchange = toNumber(usdConvertRateDraft);
    if (!Number.isFinite(exchange) || exchange <= 0) {
      setUsdConvertError("Enter how many INR equal 1 USD (e.g. 83.5).");
      return;
    }
    const exchangeText = formatRateValue(exchange);
    const fx = toNumber(exchangeText);
    setField("usdInrRate", exchangeText);
    setLines((current) => {
      const target = current.find((row) => row.id === targetId);
      if (!target) return current;
      const inrRate = toNumber(target.rate);
      const usdRate = inrRateToUsd(inrRate, fx);
      return current.map((row) => {
        if (row.id !== targetId) return row;
        return {
          ...row,
          rateCurrency: "USD" as const,
          taxPct: "0",
          usdInrRate: exchangeText,
          inrRateSnapshot: target.rate,
          rate: inrRate > 0 ? formatRateValue(usdRate) : row.rate,
        };
      });
    });
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

      const seedVendorLines = ovfCreatePoSeedVendorLines(ovf, {
        ovfId,
        distributorParam,
        remainderFromStock,
      });
      const selectedDistributor = resolvePoDistributorName(
        ovf,
        distributorParam,
        remainderFromStock,
        ovfId,
      );
      const defaultTax = normalizeTaxOption(ovf.tax_percentage, "18");
      const location =
        COMPANY_LOCATIONS.find((loc) => loc.id === "kailash-colony") ?? COMPANY_LOCATIONS[0];
      setForm((current) => {
        const keepVendor =
          Boolean(current.vendorId) && vendorRows.some((row) => row.id === current.vendorId);
        const matched = keepVendor
          ? null
          : matchVendorByDistributor(vendorRows, selectedDistributor);
        const matchedEntry =
          (matched
            ? findVendorAddressEntryByState(matched, distributorStateParam)?.entry
            : null) || matched?.addressEntries?.[0];
        const addressFields = keepVendor
          ? {
            vendorAddress: current.vendorAddress || "",
            vendorGstNumber: current.vendorGstNumber || "",
            sourceOfSupply: current.sourceOfSupply || "",
          }
          : matched
            ? {
              ...applyVendorAddressFields(matchedEntry, matched.taxNumber || ""),
              sourceOfSupply:
                matchedEntry?.sourceOfSupply ||
                distributorStateParam ||
                "",
            }
            : {
              vendorAddress: "",
              vendorGstNumber: "",
              sourceOfSupply: "",
            };
        const pendingItemPlanRows = peekOvfPendingItemPlanPoRows(ovfId);
        const fromItemPlan = pendingItemPlanRows.length > 0;
        // Item-plan / remainder Create PO always starts a new series (never reuse
        // the prior draft for leftover qty or a different distributor state).
        const draftTarget =
          fromItemPlan || remainderFromStock
            ? null
            : resolveCreatePoDraftTarget(ovf, selectedDistributor);
        const entityFromDraftPo = companyLocationFromPoNumber(draftTarget?.companyPoNumber);
        const selectedLocation = companyLocationById(
          current.companyLocationId ||
          entityFromDraftPo?.id ||
          companyLocationFromPoNumber(ovf.company_po_number)?.id ||
          location.id,
        );
        const seededLines =
          seedVendorLines.length > 0
            ? seedVendorLines.map((ln) =>
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
        const distributorHint = selectedDistributor;
        return {
          // Auto-select when distributor matches a vendor; otherwise leave blank for SCM.
          vendorId: keepVendor ? current.vendorId : matched?.id || "",
          vendorName: keepVendor ? current.vendorName : matched?.label || distributorHint,
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
          companyPoNumber: draftTarget
            ? current.companyPoNumber || draftTarget.companyPoNumber || ""
            : current.companyPoNumber || "",
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
          distiSign: "plus",
          foreignAmount:
            current.foreignAmount !== "0"
              ? current.foreignAmount
              : formatOvfAmountField(ovf.freight),
          freightTaxable: current.freightTaxable ?? true,
        };
      });
      setLines((current) => {
        if (current.length > 0) return current;
        const vendorLines = seedVendorLines;
        const mapped = vendorLines
          .map((ln) => {
            const avail = (ovf.stock_availability || []).find(
              (row) => ovfProductKey(row.product_name) === ovfProductKey(ln.product_name),
            );
            const seedQty = Number(ln.qty ?? 0);
            const remainQty = Math.max(0, Number(avail?.remaining_qty ?? seedQty) || 0);
            const itemPlanQtyOverrides = peekOvfPoLineQtyOverrides(ovfId);
            const productKey = ovfProductKey(ln.product_name);
            const hasItemPlanQty =
              Boolean(productKey) &&
              itemPlanQtyOverrides != null &&
              productKey in itemPlanQtyOverrides;
            // Item-plan Create PO: trust the selected create_qty (do not clamp to stock remaining).
            // Stock-remainder without item-plan overrides: cap to remaining demand.
            const qty = hasItemPlanQty
              ? seedQty
              : remainderFromStock
                ? seedQty > 0 && seedQty <= remainQty
                  ? seedQty
                  : remainQty
                : seedQty || 1;
            if (remainderFromStock && qty <= 0) return null;
            return {
              id: crypto.randomUUID(),
              itemDetails: ln.product_name,
              description: parseVendorQuoteNo(ln.description).description,
              partNumber: "",
              hsnCode: "",
              poType: "Goods" as const,
              qty: String(qty),
              rate: String(ln.unit_price ?? 0),
              rateCurrency: "INR" as const,
              taxPct: normalizeTaxOption(
                ln.gst_pct != null && Number.isFinite(Number(ln.gst_pct))
                  ? ln.gst_pct
                  : defaultTax,
                defaultTax,
              ),
              usdInrRate: "",
              inrRateSnapshot: "",
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);
        return mapped.length > 0 ? mapped : [emptyLine(defaultTax)];
      });

      const pendingItemPlanRows = peekOvfPendingItemPlanPoRows(ovfId);
      const fromItemPlan = pendingItemPlanRows.length > 0;
      // Item-plan / remainder Create PO always starts a new series.
      const draftTarget =
        fromItemPlan || remainderFromStock
          ? null
          : resolveCreatePoDraftTarget(ovf, selectedDistributor);
      if (draftTarget) {
        setBanner(
          `Editing draft ${draftTarget.companyPoNumber || ovf.purchase_order_number || "PO"}.`,
        );
      } else if (remainderFromStock && ovf.can_create_po) {
        const taken = (ovf.stock_availability || [])
          .filter((row) => Number(row.allocated_qty) > 0)
          .map((row) => `${row.product_name} × ${row.allocated_qty}`);
        setBanner(
          taken.length > 0
            ? `Taken from inventory: ${taken.join(", ")}. Vendor lines below are remaining demand only.`
            : "Vendor quantities are remaining demand after stock allocation.",
        );
      } else if (!ovf.can_create_po && (ovf.purchase_orders?.length || ovf.purchase_order_id)) {
        const existingLabels = (ovf.purchase_orders || [])
          .map((row) => (row.company_po_number || row.document_number || "").trim())
          .filter(Boolean);
        setBanner(
          existingLabels.length > 0
            ? `PO already exists for this OVF: ${existingLabels.join(", ")}.`
            : `PO ${ovf.purchase_order_number} already exists for this OVF.`,
        );
      } else if (ovf.scm_on_hold && ovf.can_create_po) {
        setBanner(null);
      } else {
        setBanner(null);
      }

      // New PO under the same OVF always takes the next company PO series (+1).
      // Only reuse a number when editing that distributor's existing draft.
      if (draftTarget?.companyPoNumber) {
        setForm((current) => ({
          ...current,
          companyPoNumber: draftTarget.companyPoNumber || current.companyPoNumber,
        }));
      } else {
        const peekEntity =
          companyLocationFromPoNumber(ovf.company_po_number)?.entityCode ||
          location.entityCode;
        void peekNextCompanyPoNumber(peekEntity, ovf.company_id)
          .then((next) => {
            setForm((current) => {
              // Keep peeked number when intentionally starting a new series
              // (item-plan / remainder). Only bail if still editing a draft.
              if (draftTarget?.companyPoNumber) {
                return current;
              }
              const currentEntity = companyLocationById(current.companyLocationId).entityCode;
              const peekedEntity = (next.company_po_number.split("/")[1] || "").toUpperCase();
              if (peekedEntity && peekedEntity !== currentEntity) {
                void peekNextCompanyPoNumber(currentEntity, ovf.company_id)
                  .then((aligned) => {
                    setForm((inner) => ({
                      ...inner,
                      companyPoNumber: aligned.company_po_number,
                    }));
                  })
                  .catch(() => undefined);
                return current;
              }
              return { ...current, companyPoNumber: next.company_po_number };
            });
          })
          .catch(() => undefined);
      }

      if (draftTarget?.id) {
        void getPurchaseOrder(draftTarget.id, { includeCommercial: false })
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
  }, [ovfId, remainderFromStock, distributorParam, distributorStateParam]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Auto-attach the same OVF PDF as View OVF → Download PDF into the OVF document panel. */
  useEffect(() => {
    if (!preview?.ovf_id || !preview.branch_id) return;
    const attachKey = String(preview.ovf_id);
    // Only skip after a successful attach (do not mark before await — Strict Mode
    // remounts would otherwise cancel the first run and skip the second forever).
    if (ovfPdfAttachKeyRef.current === attachKey) return;
    let cancelled = false;

    void (async () => {
      try {
        await ensureScmOvfPdfAttached(preview.ovf_id);
        if (cancelled) return;
        ovfPdfAttachKeyRef.current = attachKey;
        setOvfDocsRefreshKey((key) => key + 1);
      } catch {
        // Allow retry on next preview change / remount.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preview]);

  useEffect(() => {
    if (!shippingMenuOpen && !vendorAddressMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (shippingMenuOpen && !shippingMenuRef.current?.contains(target)) {
        setShippingMenuOpen(false);
      }
      if (vendorAddressMenuOpen && !vendorAddressMenuRef.current?.contains(target)) {
        setVendorAddressMenuOpen(false);
        setVendorAddressSearch("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [shippingMenuOpen, vendorAddressMenuOpen]);

  useEffect(() => {
    if (!vendorAddressMenuOpen) setVendorAddressSearch("");
  }, [vendorAddressMenuOpen]);

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
    if (allLinesUsd || !form.freightTaxable) return 0;
    const linesGst = lines.reduce(
      (sum, row) => sum + lineGstAmount(row, distiPct, form.distiSign),
      0,
    );
    const freightGst = (freightAmount * toNumber(form.taxPercentage)) / 100;
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
    if (allLinesUsd || !form.freightTaxable) return [];
    const buckets = lines
      .filter((row) => !isUsdLine(row))
      .map((row) => ({
        taxableAmount: lineSubtotal(row, distiPct, form.distiSign),
        taxPct: toNumber(row.taxPct),
      }));
    if (freightAmount > 0) {
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

  function onVendorAddressSelect(index: number) {
    const entry = vendorAddressEntries[index];
    if (!entry) return;
    setSelectedVendorAddressIndex(index);
    setVendorAddressMenuOpen(false);
    setVendorAddressSearch("");
    const entityState = companyLocationById(form.companyLocationId).gstState;
    setForm((current) => ({
      ...current,
      ...applyVendorAddressFields(entry, entry.gstNumber || selectedVendor?.taxNumber || ""),
      destinationOfSupply: entityState,
    }));
  }

  function openVendorDialog() {
    setVendorDialogError(null);
    setVendorDraft(
      emptyVendorFormDraft({
        vendorName: activeDistributorName,
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

  function openVendorAddressDialog() {
    if (!selectedVendor) return;
    setVendorAddressDialogError(null);
    setVendorAddressDraft(
      emptyVendorFormAddressBlock({
        billing: { country: "India", street: "", city: "", state: "", pincode: "" },
        destinationOfSupply: form.destinationOfSupply || "",
      }),
    );
    setVendorAddressDialogOpen(true);
  }

  function closeVendorAddressDialog() {
    setVendorAddressDialogOpen(false);
    setVendorAddressDialogBusy(false);
    setVendorAddressDialogError(null);
  }

  async function saveVendorAddressDialog() {
    if (!selectedVendor || !form.vendorId) {
      setVendorAddressDialogError("Select a vendor before adding an address.");
      return;
    }
    if (typeof selectedVendor.version !== "number") {
      setVendorAddressDialogError("Vendor record is missing version. Refresh and try again.");
      return;
    }
    const validationError = validateAddressBlock(
      vendorAddressDraft,
      selectedVendor.addressEntries.length,
    );
    if (validationError) {
      setVendorAddressDialogError(validationError);
      return;
    }
    const createdEntries = buildVendorAddressEntriesFromForm({
      ...emptyVendorFormDraft(),
      addresses: [vendorAddressDraft],
    });
    const newEntry = createdEntries[0];
    if (!newEntry?.address.trim()) {
      setVendorAddressDialogError("Enter a complete vendor address.");
      return;
    }
    const identity = vendorAddressIdentity(newEntry);
    if (selectedVendor.addressEntries.some((entry) => vendorAddressIdentity(entry) === identity)) {
      setVendorAddressDialogError("This address already exists for the vendor.");
      return;
    }
    setVendorAddressDialogBusy(true);
    setVendorAddressDialogError(null);
    try {
      const nextEntries = [...selectedVendor.addressEntries, newEntry];
      const updated = await updateVendorAddresses({
        vendor_id: form.vendorId,
        version: selectedVendor.version,
        addresses: nextEntries,
      });
      const nextIndex = Math.max(0, updated.addressEntries.length - 1);
      setVendors((current) =>
        current
          .map((row) => (row.id === updated.id ? updated : row))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
      );
      setSelectedVendorAddressIndex(nextIndex);
      setForm((current) => ({
        ...current,
        vendorId: updated.id,
        vendorName: updated.label,
        ...applyVendorAddressFields(
          updated.addressEntries[nextIndex] || newEntry,
          (updated.addressEntries[nextIndex] || newEntry).gstNumber,
        ),
      }));
      closeVendorAddressDialog();
    } catch (err) {
      setVendorAddressDialogError(
        err instanceof ApiClientError ? err.message : "Failed to add vendor address",
      );
    } finally {
      setVendorAddressDialogBusy(false);
    }
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
        documents: vendorDraft.documents,
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
      const locked =
        (lockedVendorDisplayName || activeDistributorName || form.vendorName || "").trim();
      if (locked) {
        return `No vendor master record matched "${locked}". Add or link a vendor before creating the purchase order.`;
      }
      return "Select a vendor before creating the purchase order";
    }
    if (!resolveVendorAddress()) {
      return "Vendor address is required";
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
      description: string | null;
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
        description: (row.description || "").trim() || null,
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
        distributor_name: distributorParam || null,
        // Item-plan Create PO and stock-remainder always get a new PO number
        // (leftover qty must not reuse / merge into the prior draft).
        force_new:
          remainderFromStock ||
          peekOvfPendingItemPlanPoRows(ovfId).length > 0,
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
      const pendingPlanRowIds = takeOvfPendingItemPlanPoRows(ovfId);
      bindOvfItemPlanRowsToPo(ovfId, pendingPlanRowIds, {
        id: String(order.id),
        label:
          (order.company_po_number || order.document_number || "").trim() ||
          String(order.id),
      });
      clearOvfPoLineQtyOverrides(ovfId);
      clearOvfPoRemainderProducts(ovfId);
      if (needsApproval) {
        await ensureScmOvfPdfAttached(ovfId).catch(() => null);
        const poPdf = await buildScmPoPrintPdfAttachment(order.id);
        await requestScmFinalizeApproval(order.id, {
          po_pdf_base64: poPdf?.base64 ?? null,
          po_pdf_filename: poPdf?.filename ?? null,
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
            partNo: (row.partNumber || row.itemDetails || "").trim() || "-",
            description:
              (row.description || "").trim() ||
              resolveVendorItemDescription(row.itemDetails) ||
              (row.itemDetails || row.partNumber || "").trim() ||
              "-",
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
      const buckets: Array<{ taxableAmount: number; taxPct: number }> =
        allUsdLines(lines) || !form.freightTaxable
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
            (form.vendorName || selectedVendor?.label || activeDistributorName || "").trim() ||
            "-",
          address: (form.vendorAddress || "").trim() || "-",
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
      const built = await downloadPurchaseOrderPdf(input, undefined, {
        asBase64: true,
        preview: true,
        watermark: true,
      });
      const base64 = built && "base64" in built ? built.base64 : "";
      if (!base64) {
        setError("Failed to preview PO PDF");
        return;
      }
      setPdfPreviewDataUrl(`data:application/pdf;base64,${base64}`);
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
  const createPoDraftTarget = useMemo(() => {
    if (!preview) return null;
    const pendingItemPlan =
      typeof window !== "undefined" && peekOvfPendingItemPlanPoRows(ovfId).length > 0;
    // Item-plan and remainder flows always mint a new PO (no draft reuse).
    if (pendingItemPlan || remainderFromStock) return null;
    return resolveCreatePoDraftTarget(preview, activeDistributorName);
  }, [preview, activeDistributorName, remainderFromStock, ovfId]);
  const editingDraft = Boolean(createPoDraftTarget);
  const blockedForInStockApproval = Boolean(
    preview &&
    !editingDraft &&
    ovfRequiresInStockCreatePoApproval(preview) &&
    !isAdmin &&
    !hasAcceptedCreatePoInStockApproval(ovfId),
  );

  if (!loading && blockedForInStockApproval) {
    return (
      <div className="space-y-4">
        <PageHeader
          backHref={`/procurement/scm/ovf/${ovfId}/item-plan`}
          backText="Item plan"
          title="Create purchase order"
          titleClassName="text-3xl font-semibold tracking-tight sm:text-4xl"
          centerTitle
        />
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Admin approval required</p>
          <p className="mt-1 text-amber-900/90">
            All lines on this OVF are <span className="font-semibold">IN STOCK</span>. Request Create
            PO from the OVF page; after an admin approves, you can create the purchase order here.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/procurement/scm/ovf/${ovfId}/item-plan`}
              className={cn(
                buttonVariants({ size: "sm" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              Item plan
            </Link>
            <Link
              href="/procurement/approvals"
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "cursor-pointer transition-colors duration-200",
              )}
            >
              View approvals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={`/procurement/scm/ovf/${ovfId}/item-plan`}
        backText="Item plan"
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

      {remainderFromStock && inventoryTakenRows.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2.5">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              <Package className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold tracking-tight text-foreground">
                Taken from inventory
              </h2>
              <p className="text-xs text-muted-foreground">
                Already allocated to this OVF - not included in the PO qty below.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-bold tracking-wide text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2 font-bold">Product</th>
                  <th className="px-3 py-2 text-right font-bold">OVF qty</th>
                  <th className="px-3 py-2 text-right font-bold">From inventory</th>
                  <th className="px-3 py-2 text-right font-bold">Remaining for PO</th>
                </tr>
              </thead>
              <tbody>
                {inventoryTakenRows.map((row) => (
                  <tr key={ovfProductKey(row.product_name)} className="border-b border-border/70">
                    <td className="px-3 py-2 font-medium">{row.product_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {row.required_qty}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                      {row.allocated_qty}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.remaining_qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <PoSection title="Vendor details" icon={Building2} tone="white">
            <div className="space-y-3">
              <PoField label="Vendor name *">
                <div
                  className="flex min-h-8 min-w-0 items-center rounded-lg border border-input bg-muted/30 px-3 py-1.5"
                  title={
                    form.vendorId && selectedVendor
                      ? "Vendor is set from the item plan and cannot be changed here"
                      : "Distributor from item plan — link or add a vendor master record"
                  }
                  aria-label="Vendor name (from item plan)"
                >
                  <span className="truncate text-sm font-bold text-foreground">
                    {lockedVendorDisplayName || "—"}
                  </span>
                </div>
              </PoField>
              {!form.vendorId || !selectedVendor ? (
                <div className="space-y-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5">
                  <p className="text-sm text-amber-950">
                    <span className="font-semibold">
                      {lockedVendorDisplayName || "This distributor"}
                    </span>{" "}
                    is not linked to a vendor master record yet. Add the vendor (or pick an
                    existing one) so address and GST can be filled for the PO.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 cursor-pointer gap-1.5 px-3 text-xs transition-colors duration-200"
                      disabled={disabled || vendorDialogBusy}
                      onClick={openVendorDialog}
                    >
                      <Plus className="size-3.5" />
                      Add vendor
                    </Button>
                    {vendors.length > 0 ? (
                      <FinanceSelect
                        value=""
                        disabled={disabled}
                        className="h-8 max-w-xs cursor-pointer text-xs"
                        aria-label="Link existing vendor"
                        onChange={(e) => {
                          const id = e.target.value;
                          const matched = vendors.find((row) => row.id === id);
                          if (!matched) return;
                          const entry = matched.addressEntries?.[0];
                          setForm((current) => ({
                            ...current,
                            vendorId: matched.id,
                            vendorName: matched.label,
                            ...applyVendorAddressFields(entry, matched.taxNumber || ""),
                          }));
                          setError(null);
                        }}
                      >
                        <option value="">Link existing vendor…</option>
                        {vendors.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.label}
                          </option>
                        ))}
                      </FinanceSelect>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {form.vendorId && selectedVendor ? (
                <>
                  <div className="block min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase break-words">
                        Vendor address
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 cursor-pointer gap-1 px-2.5 text-xs transition-colors duration-200"
                        disabled={disabled || vendorAddressDialogBusy}
                        onClick={openVendorAddressDialog}
                      >
                        <Plus className="size-3.5" />
                        Add address
                      </Button>
                    </div>
                    {vendorAddressEntries.length > 0 ? (
                      <div ref={vendorAddressMenuRef} className="relative min-w-0">
                        <button
                          type="button"
                          disabled={disabled}
                          aria-haspopup="listbox"
                          aria-expanded={vendorAddressMenuOpen}
                          aria-label="Select vendor address"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setVendorAddressMenuOpen((open) => !open);
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left text-sm transition-colors duration-200",
                            "hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                            disabled && "cursor-not-allowed opacity-50",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            {(() => {
                              const lines = vendorAddressPreviewLines(selectedVendorAddressEntry);
                              if (lines.length === 0) {
                                return <span className="font-medium text-foreground">-</span>;
                              }
                              return (
                                <span className="space-y-0.5 font-medium text-foreground">
                                  {lines.map((line, index) => (
                                    <span
                                      key={`vendor-address-preview-${index}`}
                                      className="block min-w-0 break-words"
                                    >
                                      {line}
                                    </span>
                                  ))}
                                </span>
                              );
                            })()}
                          </span>
                          <ChevronDown
                            className={cn(
                              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                              vendorAddressMenuOpen && "rotate-180",
                            )}
                          />
                        </button>
                        {vendorAddressMenuOpen && !disabled ? (
                          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-md">
                            <div className="border-b border-border/70 p-2">
                              <div className="relative">
                                <Search
                                  className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                                  aria-hidden
                                />
                                <Input
                                  value={vendorAddressSearch}
                                  onChange={(e) => setVendorAddressSearch(e.target.value)}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="h-8 cursor-text pl-8 text-sm transition-colors duration-200"
                                  placeholder="Search address, city, GST…"
                                  aria-label="Search vendor addresses"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <ul
                              role="listbox"
                              className="max-h-64 overflow-y-auto p-1"
                            >
                              {filteredVendorAddressEntries.length === 0 ? (
                                <li className="px-2.5 py-3 text-sm text-muted-foreground">
                                  No addresses match “{vendorAddressSearch.trim()}”.
                                </li>
                              ) : (
                                filteredVendorAddressEntries.map(({ entry, index }) => {
                                  const selected = index === selectedVendorAddressIndex;
                                  const lines = vendorAddressPreviewLines(entry);
                                  return (
                                    <li
                                      key={`vendor-address-option-${index}`}
                                      role="option"
                                      aria-selected={selected}
                                    >
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          onVendorAddressSelect(index);
                                        }}
                                        className={cn(
                                          "w-full cursor-pointer rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-150",
                                          selected
                                            ? "bg-primary/10 text-foreground"
                                            : "text-foreground hover:bg-muted/60",
                                        )}
                                      >
                                        <span className="block space-y-0.5 font-medium">
                                          {lines.length > 0 ? (
                                            lines.map((line, lineIndex) => (
                                              <span
                                                key={lineIndex}
                                                className="block min-w-0 break-words"
                                              >
                                                {line}
                                              </span>
                                            ))
                                          ) : (
                                            <span>{vendorAddressOptionLabel(entry)}</span>
                                          )}
                                        </span>
                                        {entry.gstNumber ? (
                                          <span className="mt-1 block text-xs text-muted-foreground">
                                            GST {entry.gstNumber}
                                          </span>
                                        ) : null}
                                      </button>
                                    </li>
                                  );
                                })
                              )}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No saved addresses for this vendor.</p>
                    )}
                  </div>
                  <PoField label="GST number *">
                    <Input
                      value={form.vendorGstNumber ?? ""}
                      onChange={(e) => setField("vendorGstNumber", e.target.value)}
                      disabled={disabled}
                      className="h-8"
                      placeholder="Vendor GSTIN"
                    />
                  </PoField>
                </>
              ) : null}
            </div>
          </PoSection>

          <PoSection title="Company details" icon={Landmark} tone="white">
            <div className="space-y-3">
              <PoField label="Entity name *" className="max-w-lg">
                <FinanceSelect
                  value={form.companyLocationId}
                  onChange={(e) => onCompanyLocationChange(e.target.value)}
                  disabled={disabled}
                >
                  {COMPANY_LOCATIONS.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.label}
                    </option>
                  ))}
                </FinanceSelect>
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
                  readOnly
                  className="h-8 cursor-default bg-muted/30 font-medium text-foreground"
                />
              </PoField>
              <PoField label="Payment terms">
                <Input
                  value={form.paymentTerms ?? ""}
                  readOnly
                  className="h-8 cursor-default bg-muted/30 font-medium text-foreground"
                  placeholder="—"
                  aria-label="Payment terms"
                />
              </PoField>
              <PoField label="OVF number">
                <Input
                  value={form.ovfNumber ?? ""}
                  readOnly
                  className="h-8 cursor-default bg-muted/30 font-medium text-foreground"
                />
              </PoField>
              <PoField label="Customer PO number">
                <Input
                  value={form.customerPoNumber ?? ""}
                  readOnly
                  className="h-8 cursor-default bg-muted/30 font-medium text-foreground"
                />
              </PoField>
              <PoField label="Customer PO date">
                <Input
                  type="date"
                  value={form.customerPoDate ?? ""}
                  readOnly
                  className="h-8 cursor-default bg-muted/30 font-medium text-foreground"
                />
              </PoField>
              <PoField label="Customer name">
                <Input
                  value={form.customerName ?? ""}
                  readOnly
                  className="h-8 cursor-default bg-muted/30 font-medium text-foreground"
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

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <ClipboardList className="size-3.5" aria-hidden />
                </span>
                <h2 className="text-sm font-extrabold tracking-tight text-foreground">Line items</h2>
                {remainderFromStock ? (
                  <p className="text-xs text-muted-foreground">
                    Quantities are remaining demand after inventory allocation.
                  </p>
                ) : null}
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
              <table className="w-full min-w-[1320px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-[11px] font-bold tracking-wide text-slate-600 uppercase">
                  <tr>
                    <th className="px-2 py-2.5 font-bold">S.No</th>
                    <th className="min-w-[180px] px-2 py-2.5 font-bold">Product name</th>
                    <th className="min-w-[220px] px-2 py-2.5 font-bold">Item description</th>
                    <th className="min-w-[120px] px-2 py-2.5 font-bold">Part number</th>
                    <th className="min-w-[100px] px-2 py-2.5 font-bold">HSN code</th>
                    <th className="min-w-[100px] px-2 py-2.5 font-bold">PO type</th>
                    <th className="min-w-[72px] px-2 py-2.5 font-bold">Qty</th>
                    <th className="min-w-[168px] px-2 py-2.5 text-center font-bold">Rate</th>
                    <th className="min-w-[88px] px-2 py-2.5 font-bold">Tax %</th>
                    <th className="min-w-[120px] px-2 py-2.5 font-bold">Amount</th>
                    <th className="px-2 py-2.5 font-bold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-6 text-center text-muted-foreground">
                        No line items yet.
                      </td>
                    </tr>
                  ) : null}
                  {lines.map((row, index) => (
                    <tr
                      key={`${row.id}-${index}`}
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
                        <ItemDetailsTextarea
                          value={row.description ?? ""}
                          disabled={disabled}
                          onChange={(value) => setLineField(row.id, "description", value)}
                          placeholder="Item description"
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
                            step="0.01"
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
                            onBlur={() => {
                              if (row.rate === "") return;
                              if (isUsdLine(row) || distiPct === 0) {
                                setLineField(row.id, "rate", formatRateValue(toNumber(row.rate)));
                              }
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
                      <span className="whitespace-nowrap">GST applicable</span>
                      <input
                        type="checkbox"
                        checked={form.freightTaxable}
                        onChange={(e) => setField("freightTaxable", e.target.checked)}
                        disabled={disabled}
                        className="size-3.5 cursor-pointer accent-sky-700 disabled:cursor-not-allowed"
                        aria-label="GST applicable"
                        title="When checked, GST is applied on line items and freight. Untick to remove tax."
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
            ovfId={ovfId}
            branchId={preview.branch_id}
            companyId={preview.company_id}
            title="OVF document"
            allowUpload={false}
            collapsedSummary
            className="border-border bg-card"
            refreshKey={ovfDocsRefreshKey}
          />

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

      {pdfPreviewDataUrl
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="PO preview"
            >
              <div className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    PO preview
                  </h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer transition-colors duration-200"
                    onClick={() => setPdfPreviewDataUrl(null)}
                  >
                    Close
                  </Button>
                </div>
                <DocumentPreviewContent
                  fileName="PO-preview.pdf"
                  dataUrl={pdfPreviewDataUrl}
                  mimeType="application/pdf"
                  viewOnly
                  frameClassName="max-h-[70vh]"
                />
              </div>
            </div>,
            document.body,
          )
        : null}

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
            vendorNamePlaceholder=""
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={vendorAddressDialogOpen}
        title={`Add address · ${selectedVendor?.label || "Vendor"}`}
        description="Save another address for this vendor. It will be available on this PO and future orders."
        confirmLabel="Save address"
        busy={vendorAddressDialogBusy}
        contentClassName="max-w-2xl max-h-[85vh] overflow-y-auto p-6"
        onConfirm={() => void saveVendorAddressDialog()}
        onCancel={closeVendorAddressDialog}
      >
        <div className="mt-4 space-y-4">
          {vendorAddressDialogError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
              {vendorAddressDialogError}
            </p>
          ) : null}
          <VendorAddressBlockFields
            index={selectedVendor?.addressEntries.length ?? 0}
            block={vendorAddressDraft}
            onChange={setVendorAddressDraft}
            onRemove={() => undefined}
            canRemove={false}
            disabled={vendorAddressDialogBusy}
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
            title="USD rate"
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
                  className={cn("h-9 tabular-nums", NO_SPINNER)}
                  autoFocus
                />
              </PoField>
            </div>
          </ConfirmDialog>,
          document.body,
        )
        : null}
    </div>
  );
}
