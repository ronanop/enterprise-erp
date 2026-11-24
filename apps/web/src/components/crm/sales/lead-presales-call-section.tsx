"use client";

import { useEffect, useMemo, useState } from "react";
import { PhoneCall } from "lucide-react";

import { CrmSection } from "@/components/crm/crm-ui";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatPresalesCallByProduct,
  isPresalesCallReadyForProducts,
  parsePresalesCallByProduct,
  presalesRowsForProductTypes,
  summarizePresalesCall,
  type PresalesCallByProduct,
  type PresalesCallProductEntry,
} from "@/lib/crm/lead-presales-call";
import { parseLeadProductTypes } from "@/lib/crm/lead-product-options";
import { ApiClientError } from "@/services/api-client";
import {
  updateSalesLead,
  type SalesLead,
} from "@/services/sales-crm-service";

type LeadPresalesCallSectionProps = {
  lead: SalesLead;
  onSaved: (lead: SalesLead) => void;
};

function needsPresalesCallGate(lead: SalesLead): boolean {
  return Boolean(lead.company_account_id) && (Boolean(lead.requires_boq) || Boolean(lead.requires_sow));
}

function seedMapFromLead(lead: SalesLead): PresalesCallByProduct {
  const fromJson = parsePresalesCallByProduct(lead.presales_call_by_product);
  const productTypes = parseLeadProductTypes(lead.product_type);
  if (Object.keys(fromJson).length > 0) {
    const seeded: PresalesCallByProduct = {};
    for (const productType of productTypes) {
      seeded[productType] = fromJson[productType] ?? {
        aligned: null,
        contact_name: "",
      };
    }
    return seeded;
  }
  // Legacy single-field leads: apply the same answer to every product type.
  if (lead.presales_call_aligned == null && !lead.presales_call_contact_name) {
    return Object.fromEntries(
      productTypes.map((productType) => [productType, { aligned: null, contact_name: "" }]),
    );
  }
  const legacy: PresalesCallProductEntry = {
    aligned:
      lead.presales_call_aligned === true
        ? true
        : lead.presales_call_aligned === false
          ? false
          : null,
    contact_name: lead.presales_call_contact_name ?? "",
  };
  return Object.fromEntries(productTypes.map((productType) => [productType, { ...legacy }]));
}

export function LeadPresalesCallSection({ lead, onSaved }: LeadPresalesCallSectionProps) {
  const productTypes = useMemo(
    () => parseLeadProductTypes(lead.product_type),
    [lead.product_type],
  );
  const [byProduct, setByProduct] = useState<PresalesCallByProduct>(() => seedMapFromLead(lead));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setByProduct(seedMapFromLead(lead));
  }, [lead.id, lead.presales_call_by_product, lead.presales_call_aligned, lead.presales_call_contact_name, lead.product_type]);

  if (!needsPresalesCallGate(lead)) return null;

  const rows = presalesRowsForProductTypes(productTypes, byProduct);
  const ready = isPresalesCallReadyForProducts(productTypes, byProduct);
  const canEdit = lead.blueprint_state === "open";

  function setProductEntry(productType: string, patch: Partial<PresalesCallProductEntry>) {
    setByProduct((prev) => ({
      ...prev,
      [productType]: {
        aligned: prev[productType]?.aligned ?? null,
        contact_name: prev[productType]?.contact_name ?? "",
        ...patch,
      },
    }));
    setError(null);
  }

  async function onSave() {
    if (!canEdit) return;
    if (productTypes.length === 0) {
      setError("Select product type(s) on the lead before confirming PreSales call.");
      return;
    }
    for (const productType of productTypes) {
      const entry = byProduct[productType];
      if (entry?.aligned !== true && entry?.aligned !== false) {
        setError(`Select Yes or No for ${productType}.`);
        return;
      }
      if (entry.aligned === true && !entry.contact_name.trim()) {
        setError(`Enter the PreSales contact person for ${productType}.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const summary = summarizePresalesCall(byProduct);
      const updated = await updateSalesLead(lead.id, {
        version: lead.version,
        presales_call_by_product: formatPresalesCallByProduct(byProduct),
        presales_call_aligned: summary.aligned,
        presales_call_contact_name: summary.contact_name,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save PreSales call step");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CrmSection title="PreSales Call Alignment" icon={PhoneCall}>
      <p className="mb-3 text-sm text-muted-foreground">
        Confirm the PreSales call for each selected product type before BOQ and SOW attachment is
        routed to My Jobs.
      </p>
      {productTypes.length === 0 ? (
        <p className="text-sm text-amber-700">
          No product types on this lead. Edit the lead and select product type(s) first.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map(({ productType, entry }) => (
            <div
              key={productType}
              className="rounded-lg border border-border/70 bg-muted/20 p-3"
            >
              <p className="mb-2 text-sm font-semibold text-foreground">{productType}</p>
              <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
                <FinanceField label="Call aligned with PreSales? *">
                  <div
                    role="group"
                    aria-label={`${productType} call aligned`}
                    className="flex flex-wrap gap-4 rounded-lg border border-input bg-background px-2.5 py-2"
                  >
                    {(
                      [
                        { value: true, label: "Yes" },
                        { value: false, label: "No" },
                      ] as const
                    ).map((option) => {
                      const checked = entry.aligned === option.value;
                      return (
                        <label
                          key={String(option.value)}
                          className="inline-flex cursor-pointer items-center gap-2 text-sm transition-colors duration-150"
                        >
                          <input
                            type="checkbox"
                            className="size-4 cursor-pointer accent-primary"
                            checked={checked}
                            disabled={!canEdit || saving}
                            onChange={() => {
                              if (checked) {
                                setProductEntry(productType, {
                                  aligned: null,
                                  contact_name: option.value ? "" : entry.contact_name,
                                });
                                return;
                              }
                              setProductEntry(productType, {
                                aligned: option.value,
                                contact_name: option.value ? entry.contact_name : "",
                              });
                            }}
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                </FinanceField>
                <FinanceField label="PreSales contact person *">
                  <Input
                    value={entry.contact_name}
                    onChange={(event) =>
                      setProductEntry(productType, { contact_name: event.target.value })
                    }
                    placeholder={`${productType} contact person`}
                    disabled={!canEdit || saving || entry.aligned !== true}
                  />
                </FinanceField>
              </div>
            </div>
          ))}
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {ready ? (
        <p className="mt-3 text-sm text-emerald-700">
          Call aligned for all product types — BOQ / SOW attachment can proceed in My Jobs.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Save Yes with a contact person for every product type to unlock BOQ and SOW.
        </p>
      )}
      {canEdit ? (
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            disabled={saving || productTypes.length === 0}
            onClick={() => void onSave()}
          >
            {saving ? "Saving…" : ready ? "Update PreSales call" : "Save & continue to BOQ / SOW"}
          </Button>
        </div>
      ) : null}
    </CrmSection>
  );
}

export function leadNeedsPresalesCallGate(lead: SalesLead): boolean {
  return needsPresalesCallGate(lead);
}

export function leadPresalesCallReady(lead: SalesLead): boolean {
  if (!needsPresalesCallGate(lead)) return true;
  const productTypes = parseLeadProductTypes(lead.product_type);
  const map = seedMapFromLead(lead);
  return isPresalesCallReadyForProducts(productTypes, map);
}
