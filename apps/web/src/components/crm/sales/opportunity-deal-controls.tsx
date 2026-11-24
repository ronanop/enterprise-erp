"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Landmark, TriangleAlert } from "lucide-react";

import { CrmSection } from "@/components/crm/crm-ui";
import {
  RequiredFieldsDialog,
  missingRequiredMessage,
} from "@/components/crm/sales/required-fields-dialog";
import { FinanceField } from "@/components/finance/journals/finance-form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCrmCode } from "@/lib/crm/format-crm-code";
import { ApiClientError } from "@/services/api-client";
import {
  getOpportunityCustomerExpenseSummary,
  type CustomerExpenseSummary,
} from "@/services/crm-deal-controls-service";
import {
  formatInrPrecise,
  updateOpportunity,
  type Opportunity,
} from "@/services/sales-crm-service";

const SELECT_CLASS =
  "h-8 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-background px-2.5 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

type Props = {
  opportunity: Opportunity;
  onChanged: () => void;
};

/**
 * DR tracking number, open customer expenses to recover, and CapEx / OpEx commercials.
 */
export function OpportunityDealControls({ opportunity, onChanged }: Props) {
  const [summary, setSummary] = useState<CustomerExpenseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mandateOpen, setMandateOpen] = useState(false);
  const [mandateMessage, setMandateMessage] = useState("");
  const [mandateFields, setMandateFields] = useState<string[]>([]);
  const [draft, setDraft] = useState({
    purchase_model: opportunity.purchase_model ?? "",
    lease_type: opportunity.lease_type ?? "",
    lease_partner: opportunity.lease_partner ?? "",
    lease_interest_rate_pct:
      opportunity.lease_interest_rate_pct != null ? String(opportunity.lease_interest_rate_pct) : "",
    lease_tenure_months:
      opportunity.lease_tenure_months != null ? String(opportunity.lease_tenure_months) : "",
    lease_monthly_rental:
      opportunity.lease_monthly_rental != null ? String(opportunity.lease_monthly_rental) : "",
  });

  const load = useCallback(async () => {
    setSummary(await getOpportunityCustomerExpenseSummary(opportunity.id).catch(() => null));
  }, [opportunity.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setDraft({
      purchase_model: opportunity.purchase_model ?? "",
      lease_type: opportunity.lease_type ?? "",
      lease_partner: opportunity.lease_partner ?? "",
      lease_interest_rate_pct:
        opportunity.lease_interest_rate_pct != null
          ? String(opportunity.lease_interest_rate_pct)
          : "",
      lease_tenure_months:
        opportunity.lease_tenure_months != null ? String(opportunity.lease_tenure_months) : "",
      lease_monthly_rental:
        opportunity.lease_monthly_rental != null ? String(opportunity.lease_monthly_rental) : "",
    });
  }, [
    opportunity.purchase_model,
    opportunity.lease_type,
    opportunity.lease_partner,
    opportunity.lease_interest_rate_pct,
    opportunity.lease_tenure_months,
    opportunity.lease_monthly_rental,
  ]);

  const isOpex = draft.purchase_model === "opex";

  async function save() {
    const missing: string[] = [];
    if (!draft.purchase_model.trim()) {
      missing.push("Purchase model");
    }
    if (isOpex) {
      if (!draft.lease_type.trim()) missing.push("Lease type");
      if (!draft.lease_partner.trim()) missing.push("Lease partner");
      if (!draft.lease_interest_rate_pct.trim()) missing.push("Rate of interest (%)");
      if (!draft.lease_tenure_months.trim()) missing.push("Tenure (months)");
      if (!draft.lease_monthly_rental.trim()) missing.push("Monthly rental (₹)");
    }
    if (missing.length > 0) {
      setMandateFields(missing);
      setMandateMessage(missingRequiredMessage(missing));
      setMandateOpen(true);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateOpportunity(opportunity.id, {
        version: opportunity.version,
        purchase_model: (draft.purchase_model || null) as "capex" | "opex" | null,
        ...(isOpex
          ? {
            lease_type: (draft.lease_type || null) as "finance" | "operating" | null,
            lease_partner: draft.lease_partner.trim() || null,
            lease_interest_rate_pct: draft.lease_interest_rate_pct
              ? Number(draft.lease_interest_rate_pct)
              : null,
            lease_tenure_months: draft.lease_tenure_months
              ? Number(draft.lease_tenure_months)
              : null,
            lease_monthly_rental: draft.lease_monthly_rental
              ? Number(draft.lease_monthly_rental)
              : null,
          }
          : {}),
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {summary && summary.open_count > 0 ? (
        <div className="flex flex-wrap items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 transition-colors duration-200 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {formatInrPrecise(summary.open_amount)} already spent on this customer (
              {summary.open_count} {summary.open_count === 1 ? "item" : "items"}) — recover it in
              this deal.
            </p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {summary.open_items.slice(0, 5).map((item) => (
                <li key={item.id} className="truncate">
                  {item.expense_date}: {item.description} — {formatInrPrecise(item.amount)}{" "}
                  (approved by {item.approved_by_name ?? "-"})
                </li>
              ))}
            </ul>
            {opportunity.company_account_id ? (
              <Link
                href={`/crm/companies/${opportunity.company_account_id}#customer-expenses`}
                className="mt-1 inline-block cursor-pointer text-xs font-medium underline underline-offset-2 transition-opacity duration-200 hover:opacity-80"
              >
                Open the customer expense ledger
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <CrmSection title="Deal Tracking & Commercial Model" icon={Landmark}>
        {error ? (
          <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-red-600" role="alert">
            <TriangleAlert className="size-3.5 shrink-0" /> {error}
          </p>
        ) : null}

        <div className="grid min-w-0 gap-x-10 gap-y-3 md:grid-cols-2">
          <FinanceField label="Opportunity / DR Number">
            <Input
              value={formatCrmCode(opportunity.deal_reg_number || opportunity.opportunity_code)}
              disabled
              aria-readonly="true"
              className="h-8 font-mono text-sm"
            />
          </FinanceField>
          <FinanceField label="Purchase model">
            <select
              className={SELECT_CLASS}
              value={draft.purchase_model}
              onChange={(e) => setDraft((d) => ({ ...d, purchase_model: e.target.value }))}
            >
              <option value="">Not set</option>
              <option value="capex">CapEx</option>
              <option value="opex">OpEx (lease / rental)</option>
            </select>
          </FinanceField>

          {isOpex ? (
            <>
              <FinanceField label="Lease type">
                <select
                  className={SELECT_CLASS}
                  value={draft.lease_type}
                  onChange={(e) => setDraft((d) => ({ ...d, lease_type: e.target.value }))}
                >
                  <option value="">Not set</option>
                  <option value="finance">Finance lease</option>
                  <option value="operating">Operating lease</option>
                </select>
              </FinanceField>
              <FinanceField label="Lease partner">
                <Input
                  value={draft.lease_partner}
                  onChange={(e) => setDraft((d) => ({ ...d, lease_partner: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Who funds the lease"
                />
              </FinanceField>
              <FinanceField label="Rate of interest (%)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.lease_interest_rate_pct}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, lease_interest_rate_pct: e.target.value }))
                  }
                  className="h-8 text-sm"
                />
              </FinanceField>
              <FinanceField label="Tenure (months)">
                <Input
                  type="number"
                  min={1}
                  value={draft.lease_tenure_months}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, lease_tenure_months: e.target.value }))
                  }
                  className="h-8 text-sm"
                />
              </FinanceField>
              <FinanceField label="Monthly rental (₹)" className="md:col-span-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.lease_monthly_rental}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, lease_monthly_rental: e.target.value }))
                  }
                  className="h-8 text-sm"
                />
              </FinanceField>
            </>
          ) : null}
        </div>

        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            className="cursor-pointer transition-colors duration-200"
            onClick={() => void save()}
          >
            Save
          </Button>
        </div>
      </CrmSection>

      <RequiredFieldsDialog
        open={mandateOpen}
        message={mandateMessage}
        fields={mandateFields}
        onClose={() => {
          setMandateOpen(false);
          setMandateFields([]);
        }}
      />
    </>
  );
}
