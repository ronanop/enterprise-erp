import {
  entityGstState,
  formatEntityAddressBlock,
  formatEntityGstBlock,
  resolveCompanyEntity,
} from "@/config/company-entities";
import {
  getPurchaseOrder,
  getScmOvfPreview,
  type ProcOrder,
  type ScmOvfPreview,
} from "@/services/procurement-service";
import type {
  DeliveryChallanLine,
  DeliveryChallanRecord,
} from "@/utils/delivery-challan-storage";
import { upsertDeliveryChallan } from "@/utils/delivery-challan-storage";

export type ChallanPrefillHeader = {
  entityName: string;
  entityAddressBlock: string;
  entityGstBlock: string;
  customerName: string;
  customerBillTo: string;
  customerShipTo: string;
  customerGstNo: string;
  kindAttn: string;
  poNumber: string;
  poDate: string;
  poNumberDate: string;
  shipFromAddress: string;
  taxPercentage: string;
  remarks: string;
};

function formatPoDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** PDF / form line: customer PO with date, e.g. `CUST-PO-001 & 31 July, 2026` */
export function formatPoNumberDateLine(poNumber: string, poDateIso: string): string {
  const po = poNumber.trim();
  if (!po) return "";
  const display = formatPoDateDisplay(poDateIso);
  return display ? `${po} & ${display}` : po;
}

/** OVF “Customer Name” (contact); if blank, use “Account” (company). */
export function resolveChallanCustomerDisplayName(
  order: ProcOrder,
  ovf: ScmOvfPreview | null,
): string {
  if (ovf) {
    const person = (ovf.customer_name || "").trim();
    const company = (ovf.account_name || "").trim();
    if (person) return person;
    return company;
  }
  return (order.customer_name || "").trim();
}

export function buildChallanPrefillHeader(
  order: ProcOrder,
  ovf: ScmOvfPreview | null,
  entityCode?: string | null,
): ChallanPrefillHeader {
  const companyPoNumber = order.company_po_number?.trim() || order.document_number;
  const entity = resolveCompanyEntity(entityCode ?? null, companyPoNumber);
  const dispatchState = entityGstState(entityCode ?? order.entity_code ?? null, companyPoNumber);
  const shipFrom = formatEntityAddressBlock(entity);
  const customerName = resolveChallanCustomerDisplayName(order, ovf);
  const billTo = (ovf?.billing_address || "").trim();
  const shipTo = (ovf?.shipping_address || "").trim();
  const customerPo = resolveCustomerPoFields(order, ovf);
  const attnParts = [
    ovf?.shipping_contact_person,
    ovf?.billing_contact_person,
  ].filter(Boolean);
  return {
    entityName: entity.displayName,
    entityAddressBlock: shipFrom,
    entityGstBlock: formatEntityGstBlock(entity, dispatchState),
    customerName,
    customerBillTo: billTo || customerName,
    customerShipTo: shipTo || billTo || customerName,
    customerGstNo: (ovf?.customer_gst || "").trim(),
    kindAttn: attnParts.join(" / "),
    poNumber: customerPo.poNumber,
    poDate: customerPo.poDate,
    poNumberDate: formatPoNumberDateLine(customerPo.poNumber, customerPo.poDate),
    shipFromAddress: shipFrom,
    taxPercentage: String(ovf?.tax_percentage ?? 18),
    remarks: "Not for Sale, Delivery Purpose Only",
  };
}

/** Customer PO number + date from order enrichment / OVF (never company PO/CDT/…). */
export function resolveCustomerPoFields(
  order: ProcOrder,
  ovf: ScmOvfPreview | null,
): { poNumber: string; poDate: string } {
  const poNumber =
    order.customer_po_number?.trim() ||
    ovf?.po_number?.trim() ||
    "";
  const poDateIso =
    ovf?.po_date ||
    order.ovf_date ||
    "";
  const poDate = (poDateIso || "").slice(0, 10);
  return { poNumber, poDate };
}

/** True when stored value is the Cache/company PO (legacy challan mistake). */
export function isCompanyPoStoredValue(
  value: string,
  order: ProcOrder | null | undefined,
): boolean {
  const v = (value || "").trim();
  if (!v || !order) return false;
  const company = (order.company_po_number || "").trim();
  const doc = (order.document_number || "").trim();
  return (Boolean(company) && v === company) || (Boolean(doc) && v === doc);
}

/**
 * Prefer customer PO on challan records that still hold company PO from older prefills.
 */
export function applyCustomerPoToChallanFields<
  T extends { purchaseOrderNumber: string; poDate: string; poNumberDate?: string },
>(fields: T, order: ProcOrder, ovf: ScmOvfPreview | null): T {
  const customer = resolveCustomerPoFields(order, ovf);
  if (!customer.poNumber) return fields;
  const shouldReplace =
    !fields.purchaseOrderNumber.trim() ||
    isCompanyPoStoredValue(fields.purchaseOrderNumber, order);
  if (!shouldReplace) return fields;
  return {
    ...fields,
    purchaseOrderNumber: customer.poNumber,
    poDate: customer.poDate || fields.poDate,
    ...(fields.poNumberDate !== undefined
      ? {
          poNumberDate: formatPoNumberDateLine(
            customer.poNumber,
            customer.poDate || fields.poDate,
          ),
        }
      : {}),
  };
}

/** GST place-of-supply for challan — entity dispatch state vs customer ship-to from PO/OVF. */
export function resolveChallanTaxSupplyStates(
  order: ProcOrder | null,
  ovf: ScmOvfPreview | null,
): { sourceOfSupply: string; destinationOfSupply: string } {
  const poNumber = order?.company_po_number?.trim() || order?.document_number || "";
  const sourceOfSupply = entityGstState(order?.entity_code ?? null, poNumber);
  const destinationOfSupply =
    (ovf?.shipping_state || "").trim() ||
    (ovf?.billing_state || "").trim();
  return { sourceOfSupply, destinationOfSupply };
}

export function resolveEntityPdfBlock(
  order: ProcOrder | null,
  poNumber: string,
  ovf: ScmOvfPreview | null,
): Pick<
  ChallanPrefillHeader,
  "entityName" | "entityAddressBlock" | "entityGstBlock" | "shipFromAddress"
> {
  if (order) {
    const header = buildChallanPrefillHeader(order, ovf, order.entity_code);
    return {
      entityName: header.entityName,
      entityAddressBlock: header.entityAddressBlock,
      entityGstBlock: header.entityGstBlock,
      shipFromAddress: header.shipFromAddress,
    };
  }
  const entity = resolveCompanyEntity(null, poNumber);
  const dispatchState = entityGstState(null, poNumber);
  const shipFrom = formatEntityAddressBlock(entity);
  return {
    entityName: entity.displayName,
    entityAddressBlock: shipFrom,
    entityGstBlock: formatEntityGstBlock(entity, dispatchState),
    shipFromAddress: shipFrom,
  };
}

export function orderLineToChallanLine(
  ln: ProcOrder["lines"][number],
  defaultShipTo: string,
): DeliveryChallanLine {
  const product = (ln.product_name || ln.product_code || "").trim();
  return {
    id: crypto.randomUUID(),
    product,
    itemName: "",
    quantitySent: String(Number(ln.quantity) || 0),
    hsnSac: "",
    assetNo: "-",
    rate: String(Number(ln.unit_cost) || 0),
    shipTo: defaultShipTo,
  };
}

/**
 * Load order/OVF and replace legacy company PO on a saved challan (persists when corrected).
 */
export async function resolveChallanRecordCustomerPo(
  record: DeliveryChallanRecord,
  options?: { persist?: boolean },
): Promise<DeliveryChallanRecord> {
  if (!record.orderId) return record;
  try {
    const order = await getPurchaseOrder(record.orderId);
    let ovf: ScmOvfPreview | null = null;
    if (order.source_module === "crm" && order.source_document_id) {
      try {
        ovf = await getScmOvfPreview(order.source_document_id);
      } catch {
        ovf = null;
      }
    }
    const corrected = applyCustomerPoToChallanFields(record, order, ovf);
    if (
      corrected.purchaseOrderNumber === record.purchaseOrderNumber &&
      corrected.poDate === record.poDate
    ) {
      return record;
    }
    const next: DeliveryChallanRecord = {
      ...record,
      purchaseOrderNumber: corrected.purchaseOrderNumber,
      poDate: corrected.poDate,
      poNumberDate:
        corrected.poNumberDate ||
        formatPoNumberDateLine(corrected.purchaseOrderNumber, corrected.poDate),
    };
    if (options?.persist !== false) {
      upsertDeliveryChallan(next);
    }
    return next;
  } catch {
    return record;
  }
}
