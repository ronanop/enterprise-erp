"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { QmFormShell, QmSelectField, QmTextAreaField, QmTextField } from "@/components/quality/quality-form-fields";
import { useQmSubmit } from "@/components/quality/use-qm-submit";
import {
  createFinalInspection,
  createInprocessInspection,
  createQualityCapa,
  createQualityComplaint,
  createQualityDefect,
  createQualityNcr,
  createQualityPpap,
  createQualityScar,
  createQualityVinTrace,
  createQualityWarrantyClaim,
  createQualityRecall,
  loadQmOptions,
  type QmOption,
} from "@/services/quality-service";

function useQmLookups() {
  const [lookups, setLookups] = useState<{
    companies: QmOption[];
    branches: QmOption[];
    products: QmOption[];
    warehouses: QmOption[];
    uoms: QmOption[];
    vendors: QmOption[];
    customers: QmOption[];
    defectTypes: QmOption[];
    inspectionPlans: QmOption[];
    productionOrders: QmOption[];
    ncrs: QmOption[];
    pfmeas: QmOption[];
    capas: QmOption[];
    vinTraces: QmOption[];
    complaints: QmOption[];
    warrantyClaims: QmOption[];
  }>({
    companies: [],
    branches: [],
    products: [],
    warehouses: [],
    uoms: [],
    vendors: [],
    customers: [],
    defectTypes: [],
    inspectionPlans: [],
    productionOrders: [],
    ncrs: [],
    pfmeas: [],
    capas: [],
    vinTraces: [],
    complaints: [],
    warrantyClaims: [],
  });

  const load = useCallback(async () => {
    const opts = await loadQmOptions();
    setLookups(opts);
    return opts;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { lookups, reload: load };
}

export function InprocessInspectionCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [productionOrderId, setProductionOrderId] = useState(searchParams.get("production_order_id") ?? "");
  const [productId, setProductId] = useState(searchParams.get("product_id") ?? "");
  const [planId, setPlanId] = useState("");
  const [result, setResult] = useState("pending");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !branchId || !productionOrderId || !productId) {
      setError("Company, branch, production order, and product are required.");
      return;
    }
    await run("Creating in-process inspection…", async () => {
      const row = await createInprocessInspection({
        company_id: companyId,
        branch_id: branchId,
        production_order_id: productionOrderId,
        product_id: productId,
        inspection_plan_id: planId || null,
        result,
      });
      router.push(`/quality/inprocess-inspections/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New In-Process Inspection (IPQC)"
      description="Start IPQC from a manufacturing production order."
      backHref="/quality/inprocess-inspections"
      backLabel="Back to IPQC"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField
          label="Production Order"
          value={productionOrderId}
          onChange={setProductionOrderId}
          options={lookups.productionOrders}
          required
        />
        <QmSelectField label="Product" value={productId} onChange={setProductId} options={lookups.products} required />
        <QmSelectField label="Inspection Plan" value={planId} onChange={setPlanId} options={lookups.inspectionPlans} />
        <QmSelectField
          label="Initial Result"
          value={result}
          onChange={setResult}
          options={[
            { id: "pending", label: "Pending" },
            { id: "pass", label: "Pass" },
            { id: "fail", label: "Fail" },
            { id: "rework_required", label: "Rework required" },
          ]}
        />
      </div>
    </QmFormShell>
  );
}

export function FinalInspectionCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [productionOrderId, setProductionOrderId] = useState(searchParams.get("production_order_id") ?? "");
  const [productId, setProductId] = useState(searchParams.get("product_id") ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  const [uomId, setUomId] = useState("");
  const [inspectedQty, setInspectedQty] = useState("0");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !branchId || !productionOrderId || !productId || !warehouseId || !uomId) {
      setError("All required fields must be filled.");
      return;
    }
    await run("Creating final inspection…", async () => {
      const row = await createFinalInspection({
        company_id: companyId,
        branch_id: branchId,
        production_order_id: productionOrderId,
        product_id: productId,
        warehouse_id: warehouseId,
        uom_id: uomId,
        inspected_qty: Number(inspectedQty) || 0,
      });
      router.push(`/quality/final-inspections/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Final Inspection (FQC)"
      description="Final quality check before inventory release."
      backHref="/quality/final-inspections"
      backLabel="Back to FQC"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField
          label="Production Order"
          value={productionOrderId}
          onChange={setProductionOrderId}
          options={lookups.productionOrders}
          required
        />
        <QmSelectField label="Product" value={productId} onChange={setProductId} options={lookups.products} required />
        <QmSelectField label="Warehouse" value={warehouseId} onChange={setWarehouseId} options={lookups.warehouses} required />
        <QmSelectField label="UOM" value={uomId} onChange={setUomId} options={lookups.uoms} required />
        <QmTextField label="Inspected Qty" value={inspectedQty} onChange={setInspectedQty} type="number" required />
      </div>
    </QmFormShell>
  );
}

export function NcrCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [source, setSource] = useState(searchParams.get("source") ?? "inspection");
  const [severity, setSeverity] = useState(searchParams.get("severity") ?? "minor");
  const [description, setDescription] = useState(searchParams.get("description") ?? "");
  const [productId, setProductId] = useState(searchParams.get("product_id") ?? "");
  const [vendorId, setVendorId] = useState(searchParams.get("vendor_id") ?? "");
  const [incomingId, setIncomingId] = useState(searchParams.get("incoming_inspection_id") ?? "");
  const [inprocessId, setInprocessId] = useState(searchParams.get("inprocess_inspection_id") ?? "");
  const [finalId, setFinalId] = useState(searchParams.get("final_inspection_id") ?? "");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !branchId) {
      setError("Company and branch are required.");
      return;
    }
    await run("Creating NCR…", async () => {
      const row = await createQualityNcr({
        company_id: companyId,
        branch_id: branchId,
        source,
        severity,
        description: description || null,
        product_id: productId || null,
        vendor_id: vendorId || null,
        incoming_inspection_id: incomingId || null,
        inprocess_inspection_id: inprocessId || null,
        final_inspection_id: finalId || null,
      });
      router.push(`/quality/ncrs/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Non-Conformance Report"
      description="Raise an NCR from inspection failure, complaint, or manual entry."
      backHref="/quality/ncrs"
      backLabel="Back to NCRs"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField
          label="Source"
          value={source}
          onChange={setSource}
          options={[
            { id: "inspection", label: "Inspection" },
            { id: "complaint", label: "Complaint" },
            { id: "audit", label: "Audit" },
            { id: "other", label: "Other" },
          ]}
        />
        <QmSelectField
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={[
            { id: "minor", label: "Minor" },
            { id: "major", label: "Major" },
            { id: "critical", label: "Critical" },
          ]}
        />
        <QmSelectField label="Product" value={productId} onChange={setProductId} options={lookups.products} />
        <QmSelectField label="Vendor" value={vendorId} onChange={setVendorId} options={lookups.vendors} />
      </div>
      <QmTextAreaField label="Description" value={description} onChange={setDescription} />
      {(incomingId || inprocessId || finalId) && (
        <p className="text-xs text-muted-foreground">
          Linked inspection:{" "}
          {incomingId ? `IQC ${incomingId}` : inprocessId ? `IPQC ${inprocessId}` : `FQC ${finalId}`}
        </p>
      )}
    </QmFormShell>
  );
}

export function CapaCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [ncrId, setNcrId] = useState(searchParams.get("ncr_id") ?? "");
  const [capaType, setCapaType] = useState("corrective");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  const branchesForCompany = lookups.branches.filter((b) => !companyId || !b.companyId || b.companyId === companyId);
  const ncrsForCompany = lookups.ncrs.filter((n) => !companyId || !n.companyId || n.companyId === companyId);

  async function onSubmit() {
    if (!companyId || !branchId || !ncrId) {
      setError("Company, branch, and NCR are required.");
      return;
    }
    await run("Creating CAPA…", async () => {
      const row = await createQualityCapa({
        company_id: companyId,
        branch_id: branchId,
        ncr_id: ncrId,
        capa_type: capaType,
        due_date: dueDate || null,
        notes: notes || null,
        root_causes: rootCause ? [{ cause_text: rootCause }] : [],
        corrective_actions: correctiveAction ? [{ action_text: correctiveAction }] : [],
      });
      router.push(`/quality/capas/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New CAPA"
      description="Corrective and preventive action linked to an NCR."
      backHref="/quality/capas"
      backLabel="Back to CAPAs"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={branchesForCompany} required />
        <QmSelectField label="NCR" value={ncrId} onChange={setNcrId} options={ncrsForCompany} required />
        <QmSelectField
          label="CAPA Type"
          value={capaType}
          onChange={setCapaType}
          options={[
            { id: "corrective", label: "Corrective" },
            { id: "preventive", label: "Preventive" },
            { id: "both", label: "Both" },
          ]}
        />
        <QmTextField label="Due Date" value={dueDate} onChange={setDueDate} type="date" />
      </div>
      <QmTextAreaField label="Root Cause" value={rootCause} onChange={setRootCause} />
      <QmTextAreaField label="Corrective Action" value={correctiveAction} onChange={setCorrectiveAction} />
      <QmTextAreaField label="Notes" value={notes} onChange={setNotes} />
    </QmFormShell>
  );
}

export function ComplaintCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [complaintType, setComplaintType] = useState("other");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [description, setDescription] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !branchId || !customerId) {
      setError("Company, branch, and customer are required.");
      return;
    }
    await run("Creating complaint…", async () => {
      const row = await createQualityComplaint({
        company_id: companyId,
        branch_id: branchId,
        customer_id: customerId,
        complaint_type: complaintType,
        product_id: productId || null,
        quantity: Number(quantity) || 0,
        description: description || null,
      });
      router.push(`/quality/complaints/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Customer Complaint"
      description="Log a customer quality complaint for investigation."
      backHref="/quality/complaints"
      backLabel="Back to complaints"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField label="Customer" value={customerId} onChange={setCustomerId} options={lookups.customers} required />
        <QmSelectField
          label="Type"
          value={complaintType}
          onChange={setComplaintType}
          options={[
            { id: "defective_product", label: "Defective product" },
            { id: "packaging", label: "Packaging" },
            { id: "performance", label: "Performance" },
            { id: "wrong_product", label: "Wrong product" },
            { id: "other", label: "Other" },
          ]}
        />
        <QmSelectField label="Product" value={productId} onChange={setProductId} options={lookups.products} />
        <QmTextField label="Quantity" value={quantity} onChange={setQuantity} type="number" />
      </div>
      <QmTextAreaField label="Description" value={description} onChange={setDescription} />
    </QmFormShell>
  );
}

export function DefectCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [defectTypeId, setDefectTypeId] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [quantity, setQuantity] = useState("1");
  const [sourceType, setSourceType] = useState(searchParams.get("source") ?? "other");
  const [productId, setProductId] = useState(searchParams.get("product_id") ?? "");
  const [description, setDescription] = useState("");
  const [incomingId] = useState(searchParams.get("incoming_inspection_id") ?? "");
  const [inprocessId] = useState(searchParams.get("inprocess_inspection_id") ?? "");
  const [finalId] = useState(searchParams.get("final_inspection_id") ?? "");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
    if (lookups.defectTypes[0] && !defectTypeId) setDefectTypeId(lookups.defectTypes[0].id);
  }, [lookups, companyId, branchId, defectTypeId]);

  async function onSubmit() {
    if (!companyId || !branchId || !defectTypeId) {
      setError("Company, branch, and defect type are required.");
      return;
    }
    await run("Creating defect…", async () => {
      const row = await createQualityDefect({
        company_id: companyId,
        branch_id: branchId,
        defect_type_id: defectTypeId,
        severity,
        quantity: Number(quantity) || 0,
        description: description || null,
        source_inspection_type: sourceType,
        product_id: productId || null,
        incoming_inspection_id: incomingId || null,
        inprocess_inspection_id: inprocessId || null,
        final_inspection_id: finalId || null,
      });
      router.push(`/quality/defects/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Defect"
      description="Log a quality defect. Link to an NCR from the defect detail page."
      backHref="/quality/defects"
      backLabel="Back to defects"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create defect"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField
          label="Defect Type"
          value={defectTypeId}
          onChange={setDefectTypeId}
          options={lookups.defectTypes}
          required
        />
        <QmSelectField
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={[
            { id: "critical", label: "Critical" },
            { id: "major", label: "Major" },
            { id: "minor", label: "Minor" },
          ]}
        />
        <QmSelectField
          label="Source"
          value={sourceType}
          onChange={setSourceType}
          options={[
            { id: "incoming", label: "Incoming inspection" },
            { id: "in_process", label: "In-process inspection" },
            { id: "final", label: "Final inspection" },
            { id: "audit", label: "Audit" },
            { id: "complaint", label: "Complaint" },
            { id: "other", label: "Other" },
          ]}
        />
        <QmTextField label="Quantity" value={quantity} onChange={setQuantity} type="number" min={0} />
        <QmSelectField label="Product" value={productId} onChange={setProductId} options={lookups.products} />
      </div>
      <QmTextAreaField label="Description" value={description} onChange={setDescription} />
    </QmFormShell>
  );
}

export function PpapCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [productId, setProductId] = useState("");
  const [level, setLevel] = useState("3");
  const [planId, setPlanId] = useState("");
  const [pfmeaId, setPfmeaId] = useState("");
  const [notes, setNotes] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
    if (lookups.vendors[0] && !vendorId) setVendorId(lookups.vendors[0].id);
    if (lookups.products[0] && !productId) setProductId(lookups.products[0].id);
    if (lookups.inspectionPlans[0] && !planId) setPlanId(lookups.inspectionPlans[0].id);
  }, [lookups, companyId, branchId, vendorId, productId, planId]);

  async function onSubmit() {
    if (!companyId || !branchId || !vendorId || !productId || !planId) {
      setError("Company, branch, vendor, product, and control plan are required.");
      return;
    }
    await run("Creating PPAP…", async () => {
      const row = await createQualityPpap({
        company_id: companyId,
        branch_id: branchId,
        vendor_id: vendorId,
        product_id: productId,
        submission_level: level,
        inspection_plan_id: planId,
        pfmea_id: pfmeaId || null,
        notes: notes || null,
      });
      router.push(`/quality/ppaps/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New PPAP"
      description="Submit a part approval package for a supplier and part. Approval is documentary only."
      backHref="/quality/ppaps"
      backLabel="Back to PPAPs"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField label="Vendor" value={vendorId} onChange={setVendorId} options={lookups.vendors} required />
        <QmSelectField label="Product" value={productId} onChange={setProductId} options={lookups.products} required />
        <QmSelectField
          label="Submission level"
          value={level}
          onChange={setLevel}
          options={[
            { id: "1", label: "Level 1" },
            { id: "2", label: "Level 2" },
            { id: "3", label: "Level 3" },
            { id: "4", label: "Level 4" },
            { id: "5", label: "Level 5" },
          ]}
          required
        />
        <QmSelectField
          label="Control / inspection plan"
          value={planId}
          onChange={setPlanId}
          options={lookups.inspectionPlans}
          required
        />
        <QmSelectField label="PFMEA (optional)" value={pfmeaId} onChange={setPfmeaId} options={lookups.pfmeas} />
      </div>
      <QmTextAreaField label="Notes" value={notes} onChange={setNotes} />
    </QmFormShell>
  );
}

export function ScarCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [productId, setProductId] = useState("");
  const [ncrId, setNcrId] = useState(searchParams.get("ncr_id") ?? "");
  const [capaId, setCapaId] = useState(searchParams.get("capa_id") ?? "");
  const [severity, setSeverity] = useState("major");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
    if (lookups.vendors[0] && !vendorId) setVendorId(lookups.vendors[0].id);
  }, [lookups, companyId, branchId, vendorId]);

  async function onSubmit() {
    if (!companyId || !branchId || !vendorId) {
      setError("Company, branch, and vendor are required.");
      return;
    }
    await run("Creating SCAR…", async () => {
      const row = await createQualityScar({
        company_id: companyId,
        branch_id: branchId,
        vendor_id: vendorId,
        product_id: productId || null,
        ncr_id: ncrId || null,
        capa_id: capaId || null,
        severity,
        due_date: dueDate || null,
        description: description || null,
      });
      router.push(`/quality/scars/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Supplier Corrective Action Request"
      description="Issue a SCAR to a vendor. This is independent of the internal NCR lifecycle."
      backHref="/quality/scars"
      backLabel="Back to SCARs"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField label="Vendor" value={vendorId} onChange={setVendorId} options={lookups.vendors} required />
        <QmSelectField label="Product (optional)" value={productId} onChange={setProductId} options={lookups.products} />
        <QmSelectField
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={[
            { id: "minor", label: "Minor" },
            { id: "major", label: "Major" },
            { id: "critical", label: "Critical" },
          ]}
        />
        <QmTextField label="Due date" value={dueDate} onChange={setDueDate} type="date" />
        <QmSelectField label="Related NCR (optional)" value={ncrId} onChange={setNcrId} options={lookups.ncrs} />
        <QmSelectField label="Related CAPA (optional)" value={capaId} onChange={setCapaId} options={lookups.capas} />
      </div>
      <QmTextAreaField label="Description" value={description} onChange={setDescription} />
    </QmFormShell>
  );
}

export function VinTraceCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [vin, setVin] = useState("");
  const [productId, setProductId] = useState("");
  const [productionOrderId, setProductionOrderId] = useState("");
  const [componentProductId, setComponentProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [qty, setQty] = useState("1");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
    if (lookups.products[0] && !productId) setProductId(lookups.products[0].id);
  }, [lookups, companyId, branchId, productId]);

  async function onSubmit() {
    if (!companyId || !branchId || !productId || vin.trim().length !== 17) {
      setError("Company, branch, vehicle product, and a 17-character VIN are required.");
      return;
    }
    await run("Creating VIN trace…", async () => {
      const components =
        componentProductId && Number(qty) >= 0
          ? [
              {
                product_id: componentProductId,
                batch_id: batchId || null,
                quantity: qty,
              },
            ]
          : [];
      const row = await createQualityVinTrace({
        company_id: companyId,
        branch_id: branchId,
        vin: vin.trim().toUpperCase(),
        product_id: productId,
        production_order_id: productionOrderId || null,
        components,
      });
      router.push(`/quality/vin-traces/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New VIN trace"
      description="Record a vehicle VIN and optional as-built component batches. Final QC stays lot-based."
      backHref="/quality/vin-traces"
      backLabel="Back to VIN traces"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmTextField label="VIN (17 characters)" value={vin} onChange={setVin} required />
        <QmSelectField
          label="Vehicle / finished good"
          value={productId}
          onChange={setProductId}
          options={lookups.products}
          required
        />
        <QmSelectField
          label="Production order (optional)"
          value={productionOrderId}
          onChange={setProductionOrderId}
          options={lookups.productionOrders}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField
          label="Component product (optional)"
          value={componentProductId}
          onChange={setComponentProductId}
          options={lookups.products}
        />
        <QmTextField label="Component batch UUID (optional)" value={batchId} onChange={setBatchId} />
        <QmTextField label="Component quantity" value={qty} onChange={setQty} type="number" min={0} />
      </div>
    </QmFormShell>
  );
}

export function WarrantyClaimCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [vinTraceId, setVinTraceId] = useState(searchParams.get("vin_trace_id") ?? "");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [componentProductId, setComponentProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [claimType, setClaimType] = useState("field_failure");
  const [ncrId, setNcrId] = useState("");
  const [capaId, setCapaId] = useState("");
  const [complaintId, setComplaintId] = useState(searchParams.get("customer_complaint_id") ?? "");
  const [description, setDescription] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !branchId || !vinTraceId) {
      setError("Company, branch, and VIN trace are required.");
      return;
    }
    await run("Creating warranty claim…", async () => {
      const row = await createQualityWarrantyClaim({
        company_id: companyId,
        branch_id: branchId,
        vin_trace_id: vinTraceId,
        customer_id: customerId || null,
        product_id: productId || null,
        component_product_id: componentProductId || null,
        quantity: Number(quantity) || 1,
        claim_type: claimType,
        ncr_id: ncrId || null,
        capa_id: capaId || null,
        customer_complaint_id: complaintId || null,
        description: description || null,
      });
      router.push(`/quality/warranty-claims/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Warranty Claim"
      description="Record a VIN-linked warranty claim. This does not affect complaint rate or finance posting."
      backHref="/quality/warranty-claims"
      backLabel="Back to warranty claims"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField label="VIN trace" value={vinTraceId} onChange={setVinTraceId} options={lookups.vinTraces} required />
        <QmSelectField label="Customer (optional)" value={customerId} onChange={setCustomerId} options={lookups.customers} />
        <QmSelectField
          label="Vehicle product (optional — defaults from VIN trace)"
          value={productId}
          onChange={setProductId}
          options={lookups.products}
        />
        <QmSelectField
          label="Failed component (optional)"
          value={componentProductId}
          onChange={setComponentProductId}
          options={lookups.products}
        />
        <QmSelectField
          label="Claim type"
          value={claimType}
          onChange={setClaimType}
          options={[
            { id: "field_failure", label: "Field failure" },
            { id: "part_replacement", label: "Part replacement" },
            { id: "goodwill", label: "Goodwill" },
            { id: "campaign", label: "Campaign" },
            { id: "other", label: "Other" },
          ]}
        />
        <QmTextField label="Quantity" value={quantity} onChange={setQuantity} type="number" min={0} />
        <QmSelectField label="Related NCR (optional)" value={ncrId} onChange={setNcrId} options={lookups.ncrs} />
        <QmSelectField label="Related CAPA (optional)" value={capaId} onChange={setCapaId} options={lookups.capas} />
        <QmSelectField
          label="Source complaint (optional)"
          value={complaintId}
          onChange={setComplaintId}
          options={lookups.complaints}
        />
      </div>
      <QmTextAreaField label="Description" value={description} onChange={setDescription} />
    </QmFormShell>
  );
}

export function RecallCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [vinFrom, setVinFrom] = useState("");
  const [vinTo, setVinTo] = useState("");
  const [capaId, setCapaId] = useState(searchParams.get("capa_id") ?? "");
  const [ncrId, setNcrId] = useState(searchParams.get("ncr_id") ?? "");
  const [claimId, setClaimId] = useState(searchParams.get("warranty_claim_id") ?? "");
  const [triggerReason, setTriggerReason] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
    if (lookups.products[0] && !productId) setProductId(lookups.products[0].id);
  }, [lookups, companyId, branchId, productId]);

  async function onSubmit() {
    if (!companyId || !branchId || !productId) {
      setError("Company, branch, and product are required.");
      return;
    }
    await run("Creating recall…", async () => {
      const row = await createQualityRecall({
        company_id: companyId,
        branch_id: branchId,
        product_id: productId,
        trigger_reason: triggerReason || null,
        vin_from: vinFrom.trim() || null,
        vin_to: vinTo.trim() || null,
        capa_id: capaId || null,
        ncr_id: ncrId || null,
        warranty_claim_id: claimId || null,
      });
      router.push(`/quality/recalls/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Recall"
      description="Define a recall campaign and VIN range. CAPA remains the action plan and is linked, not replaced."
      backHref="/quality/recalls"
      backLabel="Back to recalls"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField
          label="Affected product / family"
          value={productId}
          onChange={setProductId}
          options={lookups.products}
          required
        />
        <QmTextField label="VIN from (optional)" value={vinFrom} onChange={setVinFrom} placeholder="17 characters" />
        <QmTextField label="VIN to (optional)" value={vinTo} onChange={setVinTo} placeholder="17 characters" />
        <QmSelectField label="Linked CAPA (optional)" value={capaId} onChange={setCapaId} options={lookups.capas} />
        <QmSelectField label="Origin NCR (optional)" value={ncrId} onChange={setNcrId} options={lookups.ncrs} />
        <QmSelectField
          label="Origin warranty claim (optional)"
          value={claimId}
          onChange={setClaimId}
          options={lookups.warrantyClaims}
        />
      </div>
      <QmTextAreaField label="Trigger reason" value={triggerReason} onChange={setTriggerReason} />
    </QmFormShell>
  );
}
