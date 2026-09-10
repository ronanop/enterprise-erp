"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { QmFormShell, QmSelectField, QmTextAreaField, QmTextField } from "@/components/quality/quality-form-fields";
import { mapQtyApiError, parseNonNegativeQty, validateQtyInputs, type QtyFieldErrors } from "@/components/quality/quality-qty";
import { useQmSubmit } from "@/components/quality/use-qm-submit";
import {
  createIncomingInspection,
  listQmCharacteristics,
  loadQmOptions,
  type QmCharacteristic,
  type QmOption,
} from "@/services/quality-service";
import { ApiClientError } from "@/services/api-client";

type ChecklistRow = {
  characteristic_id: string;
  characteristic_name: string;
  measured_value: string;
  measured_text: string;
  pass_fail: string;
};

export function IncomingInspectionCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lookups, setLookups] = useState<{
    companies: QmOption[];
    branches: QmOption[];
    products: QmOption[];
    warehouses: QmOption[];
    uoms: QmOption[];
    vendors: QmOption[];
    inspectionPlans: QmOption[];
  }>({
    companies: [],
    branches: [],
    products: [],
    warehouses: [],
    uoms: [],
    vendors: [],
    inspectionPlans: [],
  });
  const [companyId, setCompanyId] = useState(searchParams.get("company_id") ?? "");
  const [branchId, setBranchId] = useState(searchParams.get("branch_id") ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState(searchParams.get("product_id") ?? "");
  const [uomId, setUomId] = useState("");
  const [vendorId, setVendorId] = useState(searchParams.get("vendor_id") ?? "");
  const [planId, setPlanId] = useState(searchParams.get("plan_id") ?? "");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [inspectedQty, setInspectedQty] = useState(searchParams.get("qty") ?? "0");
  const [acceptedQty, setAcceptedQty] = useState(searchParams.get("qty") ?? "0");
  const [rejectedQty, setRejectedQty] = useState("0");
  const [qtyErrors, setQtyErrors] = useState<QtyFieldErrors>({});
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  const loadLookups = useCallback(async () => {
    const opts = await loadQmOptions();
    setLookups({
      companies: opts.companies,
      branches: opts.branches,
      products: opts.products,
      warehouses: opts.warehouses,
      uoms: opts.uoms,
      vendors: opts.vendors,
      inspectionPlans: opts.inspectionPlans,
    });
    if (!companyId && opts.companies[0]) setCompanyId(opts.companies[0].id);
    if (!branchId && opts.branches[0]) setBranchId(opts.branches[0].id);
  }, [branchId, companyId]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (!planId) {
      setChecklist([]);
      return;
    }
    void listQmCharacteristics(planId).then((chars: QmCharacteristic[]) => {
      setChecklist(
        chars.map((c) => ({
          characteristic_id: c.id,
          characteristic_name: c.characteristic_name,
          measured_value: "",
          measured_text: "",
          pass_fail: "",
        })),
      );
    });
  }, [planId]);

  async function onSubmit() {
    if (!companyId || !branchId || !warehouseId || !productId || !uomId) {
      setError("Company, branch, warehouse, product, and UOM are required.");
      return;
    }
    if (!planId) {
      setError("Select an Inspection Plan — checklist lines are required before you can Complete.");
      return;
    }
    const filledLines = checklist.filter((ln) => ln.measured_value || ln.measured_text || ln.pass_fail);
    if (filledLines.length === 0) {
      setError("Fill at least one checklist row (Measured, Text, or Pass/Fail) before saving.");
      return;
    }
    const fieldErrors = validateQtyInputs(inspectedQty, acceptedQty, rejectedQty);
    if (Object.keys(fieldErrors).length > 0) {
      setQtyErrors(fieldErrors);
      return;
    }
    setQtyErrors({});
    const inspected = parseNonNegativeQty(inspectedQty);
    const accepted = parseNonNegativeQty(acceptedQty);
    const rejected = parseNonNegativeQty(rejectedQty);
    await run("Creating incoming inspection…", async () => {
      const lines = filledLines.map((ln, i) => ({
          line_number: i + 1,
          characteristic_id: ln.characteristic_id,
          measured_value: ln.measured_value ? Number(ln.measured_value) : null,
          measured_text: ln.measured_text || null,
          pass_fail: ln.pass_fail === "pass" || ln.pass_fail === "fail" ? ln.pass_fail : null,
          is_out_of_spec: ln.pass_fail === "fail",
        }));
      try {
        const row = await createIncomingInspection({
          company_id: companyId,
          branch_id: branchId,
          warehouse_id: warehouseId,
          product_id: productId,
          uom_id: uomId,
          vendor_id: vendorId || null,
          inspection_plan_id: planId || null,
          document_date: documentDate,
          inspected_qty: inspected,
          accepted_qty: accepted,
          rejected_qty: rejected,
          lines,
        });
        router.push(`/quality/incoming-inspections/${row.id}`);
      } catch (err) {
        const msg = err instanceof ApiClientError ? err.message : "";
        const fieldErrors = mapQtyApiError(msg);
        if (fieldErrors) {
          setQtyErrors(fieldErrors);
          return;
        }
        throw err;
      }
    });
  }

  return (
    <QmFormShell
      title="New Incoming Inspection (IQC)"
      description="Create IQC from procurement receipt. Stock is quarantined on save when quantity is entered."
      backHref="/quality/incoming-inspections"
      backLabel="Back to IQC"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Save draft"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField label="Warehouse" value={warehouseId} onChange={setWarehouseId} options={lookups.warehouses} required />
        <QmSelectField label="Product" value={productId} onChange={setProductId} options={lookups.products} required />
        <QmSelectField label="UOM" value={uomId} onChange={setUomId} options={lookups.uoms} required />
        <QmSelectField label="Vendor" value={vendorId} onChange={setVendorId} options={lookups.vendors} />
        <QmSelectField
          label="Inspection Plan"
          value={planId}
          onChange={setPlanId}
          options={lookups.inspectionPlans}
          required
        />
        <QmTextField label="Document Date" value={documentDate} onChange={setDocumentDate} type="date" required />
        <QmTextField
          label="Inspected Qty"
          value={inspectedQty}
          onChange={(v) => {
            setInspectedQty(v);
            setQtyErrors((prev) => {
              const next = { ...prev };
              delete next.inspected;
              delete next.accepted;
              delete next.rejected;
              return next;
            });
          }}
          type="number"
          min={0}
          required
          error={qtyErrors.inspected}
        />
        <QmTextField
          label="Accepted Qty"
          value={acceptedQty}
          onChange={(v) => {
            setAcceptedQty(v);
            setQtyErrors((prev) => {
              const next = { ...prev };
              delete next.accepted;
              delete next.rejected;
              return next;
            });
          }}
          type="number"
          min={0}
          error={qtyErrors.accepted}
        />
        <QmTextField
          label="Rejected Qty"
          value={rejectedQty}
          onChange={(v) => {
            setRejectedQty(v);
            setQtyErrors((prev) => {
              const next = { ...prev };
              delete next.accepted;
              delete next.rejected;
              return next;
            });
          }}
          type="number"
          min={0}
          error={qtyErrors.rejected}
        />
      </div>

      {checklist.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Checklist (from plan)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Fill at least one row below — required to <strong>Complete</strong> the inspection later.
            </p>
          </div>
          <div className="erp-scroll overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                  <th className="px-3 py-2">Characteristic</th>
                  <th className="px-3 py-2">Measured</th>
                  <th className="px-3 py-2">Text</th>
                  <th className="px-3 py-2">Pass/Fail</th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((ln, idx) => (
                  <tr key={ln.characteristic_id} className="border-b border-border/50">
                    <td className="px-3 py-2">{ln.characteristic_name}</td>
                    <td className="px-3 py-2">
                      <InputCell
                        value={ln.measured_value}
                        onChange={(v) =>
                          setChecklist((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, measured_value: v } : r)),
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <InputCell
                        value={ln.measured_text}
                        onChange={(v) =>
                          setChecklist((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, measured_text: v } : r)),
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={ln.pass_fail}
                        onChange={(e) =>
                          setChecklist((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, pass_fail: e.target.value } : r)),
                          )
                        }
                        className="h-8 rounded border border-input bg-background px-2 text-sm"
                      >
                        <option value="">—</option>
                        <option value="pass">Pass</option>
                        <option value="fail">Fail</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : planId ? (
        <div className="rounded-lg border border-dashed border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This plan has no characteristics. Add them under{" "}
          <a href={`/quality/plans/${planId}`} className="font-medium underline underline-offset-2">
            Inspection Plan detail → Add characteristic
          </a>{" "}
          then return here.
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Select an <strong>Inspection Plan</strong> above to load the checklist. Without checklist lines you cannot
          Complete the inspection.
        </div>
      )}
    </QmFormShell>
  );
}

function InputCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full min-w-[80px] rounded border border-input bg-background px-2 text-sm"
    />
  );
}
