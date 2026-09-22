import { buildDefaultPoTaxes } from "@/utils/purchase-order-pdf";
import type { DeliveryChallanLine } from "@/utils/delivery-challan-storage";

export type ChallanTaxSummaryRow = {
  label: string;
  rateLabel: string;
  amount: string;
  emphasis?: boolean;
};

export function challanLineTaxableTotal(lines: DeliveryChallanLine[]): number {
  return lines.reduce((sum, ln) => {
    const qty = Number(ln.quantitySent) || 0;
    const rate = Number(ln.rate) || 0;
    return sum + qty * rate;
  }, 0);
}

export function computeDeliveryChallanTaxSummary(params: {
  lines: DeliveryChallanLine[];
  taxPct: number;
  sourceOfSupply: string;
  destinationOfSupply: string;
  formatAmount: (n: number) => string;
}): {
  taxable: number;
  grandTotal: number;
  igstAmount: number;
  rows: ChallanTaxSummaryRow[];
} {
  const taxable = challanLineTaxableTotal(params.lines);
  const pct = Number(params.taxPct) || 0;
  const taxes = buildDefaultPoTaxes({
    taxableAmount: taxable,
    taxPct: pct,
    sourceOfSupply: params.sourceOfSupply,
    destinationOfSupply: params.destinationOfSupply,
  });
  const taxTotal = taxes.reduce((s, t) => s + t.amountInr, 0);
  const grandTotal = taxable + taxTotal;

  const cgst = taxes.find((t) => t.label.startsWith("CGST"));
  const sgst = taxes.find((t) => t.label.startsWith("SGST"));
  const igst = taxes.find((t) => t.label.startsWith("IGST"));
  const halfPct = pct > 0 ? pct / 2 : 9;

  const source = (params.sourceOfSupply || "").trim().toLowerCase();
  const destination = (params.destinationOfSupply || "").trim().toLowerCase();
  const interState = Boolean(source && destination && source !== destination);

  const rows: ChallanTaxSummaryRow[] = [
    {
      label: "Total Taxable Value",
      rateLabel: "",
      amount: params.formatAmount(taxable),
      emphasis: true,
    },
  ];

  if (interState && igst) {
    rows.push({
      label: "IGST",
      rateLabel: `${pct || 18}%`,
      amount: params.formatAmount(igst.amountInr),
    });
  } else {
    if (cgst) {
      rows.push({
        label: "CGST",
        rateLabel: `${halfPct}%`,
        amount: params.formatAmount(cgst.amountInr),
      });
    }
    if (sgst) {
      rows.push({
        label: "SGST",
        rateLabel: `${halfPct}%`,
        amount: params.formatAmount(sgst.amountInr),
      });
    }
  }

  rows.push({
    label: "Grand Total",
    rateLabel: "",
    amount: params.formatAmount(grandTotal),
    emphasis: true,
  });

  return {
    taxable,
    grandTotal,
    igstAmount: igst?.amountInr ?? 0,
    rows,
  };
}
