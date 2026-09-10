"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ModuleCrossLink,
  ModuleDetailGrid,
  ModuleDetailPage,
  ModuleDetailSection,
  ModuleWorkflowActions,
  textOrDash,
} from "@/components/module/module-detail-ui";
import { QmFormShell, QmSelectField, QmTextAreaField, QmTextField } from "@/components/quality/quality-form-fields";
import { useQmSubmit } from "@/components/quality/use-qm-submit";
import { FinanceStatusBadge } from "@/components/finance/finance-status-badge";
import { ApiClientError } from "@/services/api-client";
import {
  activateInspectionPlan,
  createCharacteristic,
  createDefectType,
  createInspectionPlan,
  createPfmea,
  createQualityAudit,
  createQualityScore,
  createQualitySupplierScore,
  createSamplingPlan,
  getInspectionPlan,
  getMasterRecord,
  listQmCharacteristics,
  loadQmOptions,
  qualityScoreAction,
  type QmCharacteristic,
  type QmOption,
} from "@/services/quality-service";

export function InspectionPlanDetailPage({ planId }: { planId: string }) {
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [characteristics, setCharacteristics] = useState<QmCharacteristic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plan, chars] = await Promise.all([
        getInspectionPlan(planId),
        listQmCharacteristics(planId),
      ]);
      setRow(plan as unknown as Record<string, unknown>);
      setCharacteristics(chars);
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = String(row?.status ?? "");
  const actions = useMemo(() => {
    if (status === "draft") return [{ key: "activate", label: "Activate plan" }];
    return [];
  }, [status]);

  async function onActivate() {
    setBusy(true);
    setSuccess("Activating plan…");
    setError(null);
    try {
      await activateInspectionPlan(planId);
      await load();
      setSuccess("Inspection plan activated.");
    } catch (err) {
      setSuccess(null);
      setError(err instanceof ApiClientError ? err.message : "Activation failed");
    } finally {
      setBusy(false);
    }
  }

  const iqcHref =
    status === "active"
      ? `/quality/incoming-inspections/new?plan_id=${planId}`
      : null;

  return (
    <ModuleDetailPage
      title={String(row?.plan_name ?? row?.plan_code ?? "Inspection Plan")}
      subtitle="Quality inspection plan — define checklist for IQC/IPQC/FQC"
      backHref="/quality/plans"
      backLabel="Back to plans"
      status={status}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ModuleWorkflowActions
            actions={actions}
            busy={busy}
            onAction={() => void onActivate()}
          />
          {iqcHref ? (
            <Link
              href={iqcHref}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
            >
              Start IQC with this plan
            </Link>
          ) : null}
          <Link
            href={`/quality/characteristics/new?plan_id=${planId}`}
            className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-card px-3 text-sm font-medium shadow-sm"
          >
            Add characteristic
          </Link>
        </div>
      }
    >
      {row ? (
        <div className="space-y-6">
          {success ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}
          <ModuleDetailSection title="Plan Details">
            <ModuleDetailGrid
              items={[
                { label: "Plan Code", value: textOrDash(row.plan_code as string) },
                { label: "Inspection Type", value: textOrDash(row.inspection_type as string) },
                { label: "Status", value: <FinanceStatusBadge status={status} /> },
                { label: "Product ID", value: textOrDash(row.product_id as string) },
                { label: "Sampling Plan", value: textOrDash(row.sampling_plan_id as string) },
                { label: "Revision", value: textOrDash(row.revision as string) },
                { label: "Process name", value: textOrDash(row.process_name as string) },
                { label: "Notes", value: textOrDash(row.notes as string), fullWidth: true },
              ]}
            />
          </ModuleDetailSection>
          <ModuleDetailSection title={`Characteristics (${characteristics.length})`}>
            {characteristics.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No characteristics linked. Add characteristics under Quality Masters → Characteristics
                with this plan selected.
              </p>
            ) : (
              <div className="erp-scroll overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground uppercase">
                      <th className="py-2 pr-4">Code</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Target</th>
                      <th className="py-2">Mandatory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {characteristics.map((c) => (
                      <tr key={c.id} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-mono text-xs">{c.characteristic_code}</td>
                        <td className="py-2 pr-4">
                          <ModuleCrossLink
                            href={`/quality/characteristics/${c.id}`}
                            label={c.characteristic_name}
                          />
                        </td>
                        <td className="py-2 pr-4">{c.characteristic_type}</td>
                        <td className="py-2 pr-4">{textOrDash(c.target_value)}</td>
                        <td className="py-2">{c.is_mandatory ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ModuleDetailSection>
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}

type MasterConfig = {
  title: string;
  backHref: string;
  backLabel: string;
  apiPath: string;
  fields: { key: string; label: string }[];
};

const MASTER_CONFIGS: Record<string, MasterConfig> = {
  "sampling-plans": {
    title: "Sampling Plan",
    backHref: "/quality/sampling-plans",
    backLabel: "Back to sampling plans",
    apiPath: "/quality/sampling-plans",
    fields: [
      { key: "plan_code", label: "Plan Code" },
      { key: "plan_name", label: "Plan Name" },
      { key: "inspection_level", label: "Inspection Level" },
      { key: "sample_size", label: "Sample Size" },
      { key: "accept_count", label: "Accept Count" },
      { key: "reject_count", label: "Reject Count" },
      { key: "status", label: "Status" },
    ],
  },
  characteristics: {
    title: "Characteristic",
    backHref: "/quality/characteristics",
    backLabel: "Back to characteristics",
    apiPath: "/quality/characteristics",
    fields: [
      { key: "characteristic_code", label: "Code" },
      { key: "characteristic_name", label: "Name" },
      { key: "characteristic_type", label: "Type" },
      { key: "target_value", label: "Target" },
      { key: "min_value", label: "Min" },
      { key: "max_value", label: "Max" },
      { key: "is_mandatory", label: "Mandatory" },
      { key: "reaction_plan", label: "Reaction plan" },
      { key: "control_method", label: "Control method" },
      { key: "sample_frequency", label: "Sample frequency" },
      { key: "inspection_plan_id", label: "Inspection Plan" },
      { key: "status", label: "Status" },
    ],
  },
  "defect-types": {
    title: "Defect Type",
    backHref: "/quality/defect-types",
    backLabel: "Back to defect types",
    apiPath: "/quality/defect-types",
    fields: [
      { key: "defect_type_code", label: "Code" },
      { key: "defect_type_name", label: "Name" },
      { key: "severity_default", label: "Default Severity" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
    ],
  },
  pfmeas: {
    title: "PFMEA",
    backHref: "/quality/pfmeas",
    backLabel: "Back to PFMEA",
    apiPath: "/quality/pfmeas",
    fields: [
      { key: "pfmea_code", label: "Code" },
      { key: "pfmea_name", label: "Name" },
      { key: "inspection_plan_id", label: "Inspection Plan" },
      { key: "process_name", label: "Process" },
      { key: "revision", label: "Revision" },
      { key: "status", label: "Status" },
      { key: "notes", label: "Notes" },
    ],
  },
  scores: {
    title: "Quality Score",
    backHref: "/quality/scores",
    backLabel: "Back to scores",
    apiPath: "/quality/scores",
    fields: [
      { key: "score_code", label: "Score Code" },
      { key: "score_dimension", label: "Dimension" },
      { key: "period_start", label: "Period Start" },
      { key: "period_end", label: "Period End" },
      { key: "first_pass_yield", label: "FPY" },
      { key: "defect_rate", label: "Defect Rate" },
      { key: "status", label: "Status" },
    ],
  },
};

export function MasterRecordDetailPage({
  resourceKey,
  recordId,
}: {
  resourceKey: keyof typeof MASTER_CONFIGS;
  recordId: string;
}) {
  const cfg = MASTER_CONFIGS[resourceKey];
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreMetrics, setScoreMetrics] = useState({
    inspected: "100",
    passed: "95",
    defects: "5",
    rework: "2",
    complaints: "1",
    supplierScores: "80",
    supplierCount: "1",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRow(await getMasterRecord(cfg.apiPath, recordId));
    } catch (err) {
      setRow(null);
      setError(err instanceof ApiClientError ? err.message : "Failed to load record");
    } finally {
      setLoading(false);
    }
  }, [cfg.apiPath, recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPublishScore() {
    if (resourceKey !== "scores" || !row) return;
    setBusy(true);
    setError(null);
    try {
      await qualityScoreAction(recordId, "publish", {
        inspected: Number(scoreMetrics.inspected) || 0,
        passed: Number(scoreMetrics.passed) || 0,
        defects: Number(scoreMetrics.defects) || 0,
        rework: Number(scoreMetrics.rework) || 0,
        complaints: Number(scoreMetrics.complaints) || 0,
        supplier_scores: Number(scoreMetrics.supplierScores) || 0,
        supplier_count: Number(scoreMetrics.supplierCount) || 1,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  const planId = row?.inspection_plan_id ? String(row.inspection_plan_id) : null;

  return (
    <ModuleDetailPage
      title={String(row?.plan_name ?? row?.characteristic_name ?? row?.defect_type_name ?? row?.score_code ?? row?.pfmea_name ?? row?.pfmea_code ?? cfg.title)}
      subtitle={cfg.title}
      backHref={cfg.backHref}
      backLabel={cfg.backLabel}
      status={row?.status != null ? String(row.status) : undefined}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      busy={busy}
      actions={
        resourceKey === "scores" && String(row?.status) === "draft" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPublishScore()}
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
          >
            Publish score
          </button>
        ) : null
      }
    >
      {row ? (
        <div className="space-y-6">
          <ModuleDetailSection title="Details">
            <ModuleDetailGrid
              items={cfg.fields.map((f) => ({
                label: f.label,
                value:
                  f.key === "status" || f.key === "severity_default" ? (
                    <FinanceStatusBadge status={String(row[f.key] ?? "")} />
                  ) : f.key === "inspection_plan_id" && planId ? (
                    <ModuleCrossLink href={`/quality/plans/${planId}`} label="View plan" />
                  ) : f.key === "is_mandatory" ? (
                    row[f.key] ? "Yes" : "No"
                  ) : (
                    textOrDash(row[f.key] as string | number | null | undefined)
                  ),
              }))}
            />
            </ModuleDetailSection>
          {resourceKey === "pfmeas" && Array.isArray(row.lines) && (row.lines as { id: string }[]).length > 0 ? (
            <ModuleDetailSection title="Failure modes">
              <div className="erp-scroll overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-4">Seq</th>
                      <th className="py-2 pr-4">Mode</th>
                      <th className="py-2 pr-4">S</th>
                      <th className="py-2 pr-4">O</th>
                      <th className="py-2 pr-4">D</th>
                      <th className="py-2">RPN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(row.lines as Record<string, unknown>[]).map((line) => (
                      <tr key={String(line.id)} className="border-b border-border/50">
                        <td className="py-2 pr-4">{textOrDash(line.sequence_no as number)}</td>
                        <td className="py-2 pr-4">{textOrDash(line.failure_mode as string)}</td>
                        <td className="py-2 pr-4">{textOrDash(line.severity as number)}</td>
                        <td className="py-2 pr-4">{textOrDash(line.occurrence as number)}</td>
                        <td className="py-2 pr-4">{textOrDash(line.detection as number)}</td>
                        <td className="py-2 font-medium">{textOrDash(line.rpn as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ModuleDetailSection>
          ) : null}
          {resourceKey === "scores" && String(row.status) === "draft" ? (
            <ModuleDetailSection title="Publish metrics">
              <p className="mb-3 text-xs text-muted-foreground">
                Enter period counts. Publish computes FPY, defect rate, rework rate, and complaint rate.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["inspected", "Inspected"],
                    ["passed", "Passed"],
                    ["defects", "Defects"],
                    ["rework", "Rework"],
                    ["complaints", "Complaints"],
                    ["supplierScores", "Supplier score sum"],
                    ["supplierCount", "Supplier count"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={scoreMetrics[key]}
                      onChange={(e) => setScoreMetrics((m) => ({ ...m, [key]: e.target.value }))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </label>
                ))}
              </div>
            </ModuleDetailSection>
          ) : null}
        </div>
      ) : null}
    </ModuleDetailPage>
  );
}

export function InspectionPlanCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [planName, setPlanName] = useState("");
  const [inspectionType, setInspectionType] = useState("incoming");
  const [productId, setProductId] = useState("");
  const [revision, setRevision] = useState("");
  const [processName, setProcessName] = useState("");
  const [notes, setNotes] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !planName.trim()) {
      setError("Company and plan name are required.");
      return;
    }
    await run("Creating inspection plan…", async () => {
      const row = await createInspectionPlan({
        company_id: companyId,
        branch_id: branchId || null,
        plan_name: planName.trim(),
        inspection_type: inspectionType,
        product_id: productId || null,
        revision: revision.trim() || null,
        process_name: processName.trim() || null,
        notes: notes || null,
      });
      router.push(`/quality/plans/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Inspection Plan"
      description="Define how incoming, in-process, or final inspections should be performed."
      backHref="/quality/plans"
      backLabel="Back to plans"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create plan"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} />
        <QmTextField label="Plan Name" value={planName} onChange={setPlanName} required />
        <QmSelectField
          label="Inspection Type"
          value={inspectionType}
          onChange={setInspectionType}
          options={[
            { id: "incoming", label: "Incoming (IQC)" },
            { id: "inprocess", label: "In-Process (IPQC)" },
            { id: "final", label: "Final (FQC)" },
          ]}
          required
        />
        <QmSelectField label="Product (optional)" value={productId} onChange={setProductId} options={lookups.products} />
        <QmTextField label="Revision" value={revision} onChange={setRevision} />
        <QmTextField label="Process name" value={processName} onChange={setProcessName} />
      </div>
      <QmTextAreaField label="Notes" value={notes} onChange={setNotes} />
    </QmFormShell>
  );
}

export function AuditCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [auditType, setAuditType] = useState("internal");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
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
    await run("Creating audit…", async () => {
      const row = await createQualityAudit({
        company_id: companyId,
        branch_id: branchId,
        audit_type: auditType,
        planned_start: plannedStart || null,
        planned_end: plannedEnd || null,
      });
      router.push(`/quality/audits/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Quality Audit"
      description="Schedule an internal, supplier, or process audit."
      backHref="/quality/audits"
      backLabel="Back to audits"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create audit"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} required />
        <QmSelectField
          label="Audit Type"
          value={auditType}
          onChange={setAuditType}
          options={[
            { id: "internal", label: "Internal" },
            { id: "supplier", label: "Supplier" },
            { id: "process", label: "Process" },
          ]}
        />
        <QmTextField label="Planned Start" value={plannedStart} onChange={setPlannedStart} type="date" />
        <QmTextField label="Planned End" value={plannedEnd} onChange={setPlannedEnd} type="date" />
      </div>
    </QmFormShell>
  );
}

function useQmLookups() {
  const [lookups, setLookups] = useState<{
    companies: QmOption[];
    branches: QmOption[];
    products: QmOption[];
    vendors: QmOption[];
    inspectionPlans: QmOption[];
    uoms: QmOption[];
  }>({ companies: [], branches: [], products: [], vendors: [], inspectionPlans: [], uoms: [] });

  useEffect(() => {
    void loadQmOptions().then((opts) =>
      setLookups({
        companies: opts.companies,
        branches: opts.branches,
        products: opts.products,
        vendors: opts.vendors,
        inspectionPlans: opts.inspectionPlans,
        uoms: opts.uoms,
      }),
    );
  }, []);

  return { lookups };
}

export function SamplingPlanCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [samplingName, setSamplingName] = useState("");
  const [sampleSize, setSampleSize] = useState("5");
  const [acceptCount, setAcceptCount] = useState("0");
  const [rejectCount, setRejectCount] = useState("1");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !samplingName.trim()) {
      setError("Company and sampling plan name are required.");
      return;
    }
    await run("Creating sampling plan…", async () => {
      const row = await createSamplingPlan({
        company_id: companyId,
        branch_id: branchId || null,
        sampling_name: samplingName.trim(),
        sample_size: Number(sampleSize),
        accept_count: Number(acceptCount),
        reject_count: Number(rejectCount),
      });
      router.push(`/quality/sampling-plans/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Sampling Plan"
      description="Define AQL sampling rules for lot acceptance."
      backHref="/quality/sampling-plans"
      backLabel="Back to sampling plans"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create sampling plan"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} />
        <QmTextField label="Plan Name" value={samplingName} onChange={setSamplingName} required />
        <QmTextField label="Sample Size" value={sampleSize} onChange={setSampleSize} type="number" required />
        <QmTextField label="Accept Count" value={acceptCount} onChange={setAcceptCount} type="number" />
        <QmTextField label="Reject Count" value={rejectCount} onChange={setRejectCount} type="number" required />
      </div>
    </QmFormShell>
  );
}

export function CharacteristicCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [planId, setPlanId] = useState(searchParams.get("plan_id") ?? "");
  const [name, setName] = useState("");
  const [charType, setCharType] = useState("numeric");
  const [target, setTarget] = useState("");
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [reactionPlan, setReactionPlan] = useState("");
  const [controlMethod, setControlMethod] = useState("");
  const [sampleFrequency, setSampleFrequency] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !name.trim()) {
      setError("Company and characteristic name are required.");
      return;
    }
    await run("Creating characteristic…", async () => {
      const row = await createCharacteristic({
        company_id: companyId,
        branch_id: branchId || null,
        inspection_plan_id: planId || null,
        characteristic_name: name.trim(),
        characteristic_type: charType,
        target_value: target ? Number(target) : null,
        min_value: minVal ? Number(minVal) : null,
        max_value: maxVal ? Number(maxVal) : null,
        is_mandatory: mandatory,
        reaction_plan: reactionPlan.trim() || null,
        control_method: controlMethod.trim() || null,
        sample_frequency: sampleFrequency.trim() || null,
      });
      router.push(`/quality/characteristics/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Characteristic"
      description="Add a measurable or pass/fail checkpoint to an inspection plan."
      backHref="/quality/characteristics"
      backLabel="Back to characteristics"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create characteristic"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} />
        <QmSelectField
          label="Inspection Plan"
          value={planId}
          onChange={setPlanId}
          options={lookups.inspectionPlans}
        />
        <QmTextField label="Characteristic Name" value={name} onChange={setName} required />
        <QmSelectField
          label="Type"
          value={charType}
          onChange={setCharType}
          options={[
            { id: "numeric", label: "Numeric" },
            { id: "text", label: "Text" },
            { id: "pass_fail", label: "Pass / Fail" },
          ]}
        />
        <QmTextField label="Target Value" value={target} onChange={setTarget} type="number" />
        <QmTextField label="Min Value" value={minVal} onChange={setMinVal} type="number" />
        <QmTextField label="Max Value" value={maxVal} onChange={setMaxVal} type="number" />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mandatory}
            onChange={(e) => setMandatory(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Mandatory checkpoint
        </label>
        <QmTextField label="Control method" value={controlMethod} onChange={setControlMethod} />
        <QmTextField label="Sample frequency" value={sampleFrequency} onChange={setSampleFrequency} />
      </div>
      <QmTextAreaField label="Reaction plan" value={reactionPlan} onChange={setReactionPlan} />
    </QmFormShell>
  );
}

export function DefectTypeCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [category, setCategory] = useState("other");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !name.trim()) {
      setError("Company and defect type name are required.");
      return;
    }
    await run("Creating defect type…", async () => {
      const row = await createDefectType({
        company_id: companyId,
        branch_id: branchId || null,
        defect_type_name: name.trim(),
        severity_default: severity,
        category,
      });
      router.push(`/quality/defect-types/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Defect Type"
      description="Catalog a defect category for inspection and NCR logging."
      backHref="/quality/defect-types"
      backLabel="Back to defect types"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create defect type"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} />
        <QmTextField label="Defect Type Name" value={name} onChange={setName} required />
        <QmSelectField
          label="Default Severity"
          value={severity}
          onChange={setSeverity}
          options={[
            { id: "critical", label: "Critical" },
            { id: "major", label: "Major" },
            { id: "minor", label: "Minor" },
          ]}
        />
        <QmSelectField
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { id: "appearance", label: "Appearance" },
            { id: "dimension", label: "Dimension" },
            { id: "functional", label: "Functional" },
            { id: "other", label: "Other" },
          ]}
        />
      </div>
    </QmFormShell>
  );
}

export function QualityScoreCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [dimension, setDimension] = useState("company");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
  }, [lookups, companyId, branchId]);

  async function onSubmit() {
    if (!companyId || !periodStart || !periodEnd) {
      setError("Company and period dates are required.");
      return;
    }
    await run("Creating quality score…", async () => {
      const row = await createQualityScore({
        company_id: companyId,
        branch_id: branchId || null,
        score_dimension: dimension,
        period_start: periodStart,
        period_end: periodEnd,
      });
      router.push(`/quality/scores/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Quality Score"
      description="Open a scoring period for FPY, defect rate, and supplier KPIs."
      backHref="/quality/scores"
      backLabel="Back to scores"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create score"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} />
        <QmSelectField
          label="Dimension"
          value={dimension}
          onChange={setDimension}
          options={[
            { id: "company", label: "Company" },
            { id: "branch", label: "Branch" },
            { id: "product", label: "Product" },
          ]}
        />
        <QmTextField label="Period Start" value={periodStart} onChange={setPeriodStart} type="date" required />
        <QmTextField label="Period End" value={periodEnd} onChange={setPeriodEnd} type="date" required />
      </div>
    </QmFormShell>
  );
}

export function SupplierQualityCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [acceptRate, setAcceptRate] = useState("");
  const [defectRate, setDefectRate] = useState("");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
    if (lookups.vendors[0] && !vendorId) setVendorId(lookups.vendors[0].id);
  }, [lookups, companyId, branchId, vendorId]);

  async function onSubmit() {
    if (!companyId || !vendorId || !periodStart || !periodEnd) {
      setError("Company, vendor, and period dates are required.");
      return;
    }
    await run("Creating supplier scorecard…", async () => {
      const row = await createQualitySupplierScore({
        company_id: companyId,
        branch_id: branchId || null,
        vendor_id: vendorId,
        score_period_start: periodStart,
        score_period_end: periodEnd,
        incoming_accept_rate: acceptRate ? Number(acceptRate) : null,
        defect_rate: defectRate ? Number(defectRate) : null,
      });
      router.push(`/quality/supplier-quality/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New Supplier Quality Scorecard"
      description="Score a vendor for incoming accept rate, defects, and NCR history."
      backHref="/quality/supplier-quality"
      backLabel="Back to supplier quality"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create scorecard"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} />
        <QmSelectField label="Vendor" value={vendorId} onChange={setVendorId} options={lookups.vendors} required />
        <QmTextField label="Period Start" value={periodStart} onChange={setPeriodStart} type="date" required />
        <QmTextField label="Period End" value={periodEnd} onChange={setPeriodEnd} type="date" required />
        <QmTextField label="Incoming Accept Rate %" value={acceptRate} onChange={setAcceptRate} type="number" />
        <QmTextField label="Defect Rate %" value={defectRate} onChange={setDefectRate} type="number" />
      </div>
    </QmFormShell>
  );
}

export function PfmeaCreatePage() {
  const router = useRouter();
  const { lookups } = useQmLookups();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [planId, setPlanId] = useState("");
  const [productId, setProductId] = useState("");
  const [processName, setProcessName] = useState("");
  const [revision, setRevision] = useState("");
  const [failureMode, setFailureMode] = useState("");
  const [severity, setSeverity] = useState("5");
  const [occurrence, setOccurrence] = useState("5");
  const [detection, setDetection] = useState("5");
  const { saving, statusMessage, error, setError, run } = useQmSubmit();

  useEffect(() => {
    if (lookups.companies[0] && !companyId) setCompanyId(lookups.companies[0].id);
    if (lookups.branches[0] && !branchId) setBranchId(lookups.branches[0].id);
    if (lookups.inspectionPlans[0] && !planId) setPlanId(lookups.inspectionPlans[0].id);
  }, [lookups, companyId, branchId, planId]);

  async function onSubmit() {
    if (!companyId || !name.trim() || !planId) {
      setError("Company, name, and inspection plan are required.");
      return;
    }
    await run("Creating PFMEA…", async () => {
      const lines = failureMode.trim()
        ? [
            {
              failure_mode: failureMode.trim(),
              severity: Number(severity) || 5,
              occurrence: Number(occurrence) || 5,
              detection: Number(detection) || 5,
            },
          ]
        : [];
      const row = await createPfmea({
        company_id: companyId,
        branch_id: branchId || null,
        pfmea_name: name.trim(),
        inspection_plan_id: planId,
        product_id: productId || null,
        process_name: processName.trim() || null,
        revision: revision.trim() || null,
        lines,
      });
      router.push(`/quality/pfmeas/${row.id}`);
    });
  }

  return (
    <QmFormShell
      title="New PFMEA"
      description="Document process failure modes, S/O/D ratings, and calculated RPN."
      backHref="/quality/pfmeas"
      backLabel="Back to PFMEA"
      onSubmit={() => void onSubmit()}
      saving={saving}
      statusMessage={statusMessage}
      error={error}
      submitLabel="Create PFMEA"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <QmSelectField label="Company" value={companyId} onChange={setCompanyId} options={lookups.companies} required />
        <QmSelectField label="Branch" value={branchId} onChange={setBranchId} options={lookups.branches} />
        <QmTextField label="PFMEA name" value={name} onChange={setName} required />
        <QmSelectField
          label="Inspection / control plan"
          value={planId}
          onChange={setPlanId}
          options={lookups.inspectionPlans}
          required
        />
        <QmSelectField label="Product (optional)" value={productId} onChange={setProductId} options={lookups.products} />
        <QmTextField label="Process name" value={processName} onChange={setProcessName} />
        <QmTextField label="Revision" value={revision} onChange={setRevision} />
        <QmTextField label="Failure mode (optional first line)" value={failureMode} onChange={setFailureMode} />
        <QmTextField label="Severity (1–10)" value={severity} onChange={setSeverity} type="number" />
        <QmTextField label="Occurrence (1–10)" value={occurrence} onChange={setOccurrence} type="number" />
        <QmTextField label="Detection (1–10)" value={detection} onChange={setDetection} type="number" />
      </div>
    </QmFormShell>
  );
}

