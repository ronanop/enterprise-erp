"use client";

import { useEffect, useMemo, useState } from "react";
import { Cloud } from "lucide-react";

import {
  CrmDetailGrid,
  CrmDetailItem,
  CrmSection,
} from "@/components/crm/crm-ui";
import { FinanceField, FinanceSelect } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLOUD_VARIANT_LABELS, isCloudConsumptionVariant } from "@/lib/crm-cloud-flow";
import { ApiClientError } from "@/services/api-client";
import { formatInr, updateOpportunity, type Opportunity } from "@/services/sales-crm-service";

const ASSESSMENT_TYPES = [
  "Migration Assessment",
  "Linux Assessment",
  "Windows Assessment",
  "Ola Assessment",
  "General Cloud Assessment",
  "AI Readiness POC",
] as const;

const VARIANT_LABELS = CLOUD_VARIANT_LABELS;

type Props = {
  opportunity: Opportunity;
  cloudVariant?: string | null;
  disabled?: boolean;
  onSaved: () => void | Promise<void>;
};

export function CloudOpportunityPanel({ opportunity, cloudVariant, disabled, onSaved }: Props) {
  const variant = cloudVariant ?? opportunity.cloud_blueprint_variant;
  const isCloud = isCloudConsumptionVariant(variant);
  const [mrr, setMrr] = useState("");
  const [arr, setArr] = useState("");
  const [customerDiscount, setCustomerDiscount] = useState("");
  const [assessmentType, setAssessmentType] = useState("");
  const [phase1, setPhase1] = useState("");
  const [phase2, setPhase2] = useState("");
  const [phase3, setPhase3] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMrr(opportunity.customer_mrr != null ? String(opportunity.customer_mrr) : "");
    setArr(opportunity.customer_arr != null ? String(opportunity.customer_arr) : "");
    setCustomerDiscount(
      opportunity.customer_discount_percent != null ? String(opportunity.customer_discount_percent) : "",
    );
    setAssessmentType(opportunity.assessment_type ?? "");
    setPhase1(
      opportunity.migration_credit_phase1 != null ? String(opportunity.migration_credit_phase1) : "",
    );
    setPhase2(
      opportunity.migration_credit_phase2 != null ? String(opportunity.migration_credit_phase2) : "",
    );
    setPhase3(
      opportunity.migration_credit_phase3 != null ? String(opportunity.migration_credit_phase3) : "",
    );
    setSaved(false);
  }, [opportunity]);

  const profitability = useMemo(() => {
    const dist = opportunity.distributor_discount_percent;
    const cust = customerDiscount ? Number(customerDiscount) : null;
    if (dist == null || cust == null || Number.isNaN(cust)) return null;
    return Number((dist - cust).toFixed(2));
  }, [customerDiscount, opportunity.distributor_discount_percent]);

  if (!isCloud) return null;

  const variantKey = variant ?? "cloud_other";
  const showMigrationCredits = variant === "migration";
  const showAssessment = variant === "poc_assessment" || variant === "migration";

  async function onSave() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateOpportunity(opportunity.id, {
        version: opportunity.version,
        customer_mrr: mrr ? Number(mrr) : null,
        customer_arr: arr ? Number(arr) : null,
        customer_discount_percent: customerDiscount ? Number(customerDiscount) : null,
        assessment_type: assessmentType || null,
        migration_credit_phase1: phase1 ? Number(phase1) : null,
        migration_credit_phase2: phase2 ? Number(phase2) : null,
        migration_credit_phase3: phase3 ? Number(phase3) : null,
      });
      setSaved(true);
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save cloud details");
    } finally {
      setBusy(false);
    }
  }

  function onMrrChange(value: string) {
    setMrr(value);
    const monthly = Number(value);
    if (!Number.isNaN(monthly) && value.trim() !== "") {
      setArr(String(Number((monthly * 12).toFixed(2))));
    }
  }

  return (
    <CrmSection
      title="Cloud Opportunity"
      icon={Cloud}
    >
      <CrmDetailGrid>
        <CrmDetailItem label="Cloud flow">{VARIANT_LABELS[variantKey] ?? variantKey}</CrmDetailItem>
        <CrmDetailItem label="Sub-product">{opportunity.cloud_sub_product || "—"}</CrmDetailItem>
        <CrmDetailItem label="Distributor discount">
          {opportunity.distributor_discount_percent != null
            ? `${opportunity.distributor_discount_percent}% (locked)`
            : "—"}
        </CrmDetailItem>
        <CrmDetailItem label="Profitability (spread)">
          {profitability != null ? `${profitability}%` : opportunity.profitability_percent != null
            ? `${opportunity.profitability_percent}%`
            : "—"}
        </CrmDetailItem>
        {opportunity.onboarding_done ? (
          <CrmDetailItem label="Onboarding date">{opportunity.onboarding_date || "—"}</CrmDetailItem>
        ) : null}
      </CrmDetailGrid>

      <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
        <FinanceField label="Customer MRR (₹)">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={mrr}
            onChange={(e) => onMrrChange(e.target.value)}
            disabled={disabled || busy}
          />
        </FinanceField>
        <FinanceField label="Customer ARR (₹)">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={arr}
            onChange={(e) => setArr(e.target.value)}
            disabled={disabled || busy}
          />
        </FinanceField>
        <FinanceField label="Customer discount (%)">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={customerDiscount}
            onChange={(e) => setCustomerDiscount(e.target.value)}
            disabled={disabled || busy}
          />
        </FinanceField>
        <FinanceField label="Distributor discount (%)">
          <Input
            type="number"
            value={opportunity.distributor_discount_percent ?? ""}
            disabled
            aria-readonly
            className="bg-muted/50"
          />
        </FinanceField>

        {showAssessment ? (
          <FinanceField label="Assessment / POC type">
            <FinanceSelect
              value={assessmentType}
              onChange={(e) => setAssessmentType(e.target.value)}
              disabled={disabled || busy}
            >
              <option value="">Select type</option>
              {ASSESSMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </FinanceSelect>
          </FinanceField>
        ) : null}

        {showMigrationCredits ? (
          <>
            <FinanceField label="Phase 1 credits — Assess (~10% ARR)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={phase1}
                onChange={(e) => setPhase1(e.target.value)}
                disabled={disabled || busy}
                placeholder="Funding amount"
              />
            </FinanceField>
            <FinanceField label="Phase 2 credits — Mobilize (~15% ARR)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={phase2}
                onChange={(e) => setPhase2(e.target.value)}
                disabled={disabled || busy}
              />
            </FinanceField>
            <FinanceField label="Phase 3 credits — Migrate (~25% ARR)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={phase3}
                onChange={(e) => setPhase3(e.target.value)}
                disabled={disabled || busy}
              />
            </FinanceField>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          className="cursor-pointer"
          disabled={disabled || busy}
          onClick={() => void onSave()}
        >
          Save cloud metrics
        </Button>
        {mrr ? (
          <span className="text-xs text-muted-foreground">MRR reference: {formatInr(Number(mrr))}</span>
        ) : null}
        {saved ? <span className="text-xs text-emerald-700">Saved</span> : null}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </CrmSection>
  );
}
