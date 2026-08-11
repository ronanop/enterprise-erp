import {
  entityGstState,
  formatEntityAddressBlock,
  formatEntityGstBlock,
  resolveCompanyEntity,
} from "@/config/company-entities";
import type { ProcOrder, ScmOvfPreview } from "@/services/procurement-service";
import type { DeliveryChallanLine } from "@/utils/delivery-challan-storage";

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

/** PDF grid line: `PO/CDT/001 & 31 July, 2026` */
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
  const poNumber = order.company_po_number?.trim() || order.document_number;
  const entity = resolveCompanyEntity(entityCode ?? null, poNumber);
  const dispatchState = entityGstState(entityCode ?? order.entity_code ?? null, poNumber);
  const shipFrom = formatEntityAddressBlock(entity);
  const customerName = resolveChallanCustomerDisplayName(order, ovf);
  const billTo = (ovf?.billing_address || "").trim();
  const shipTo = (ovf?.shipping_address || "").trim();
  const poDateIso = ovf?.po_date || order.document_date;
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
    poNumber,
    poDate: poDateIso?.slice(0, 10) || order.document_date,
    poNumberDate: formatPoNumberDateLine(poNumber, poDateIso?.slice(0, 10) || order.document_date),
    shipFromAddress: shipFrom,
    taxPercentage: String(ovf?.tax_percentage ?? 18),
    remarks: "Not for Sale, Delivery Purpose Only",
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
  return {
    id: crypto.randomUUID(),
    itemName: (ln.product_name || ln.product_code || "").trim(),
    quantitySent: String(Number(ln.quantity) || 0),
    hsnSac: "",
    assetNo: "-",
    rate: String(Number(ln.unit_cost) || 0),
    shipTo: defaultShipTo,
  };
}
