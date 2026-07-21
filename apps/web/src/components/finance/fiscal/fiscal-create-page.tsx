"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { FiscalFormFields, useFiscalForm } from "@/components/finance/fiscal/fiscal-form-fields";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { toFiscalPayload } from "@/lib/finance/fiscal-schema";
import { ApiClientError } from "@/services/api-client";
import { createFiscalYear } from "@/services/fiscal-service";

export function FiscalCreatePage() {
  const router = useRouter();
  const form = useFiscalForm();
  const { handleSubmit, formState: { isDirty, isSubmitting, isValid } } = form;
  const [error, setError] = useState<string | null>(null);
  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const created = await createFiscalYear(toFiscalPayload(values));
      router.push(`/finance/fiscal-years/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create fiscal year");
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Create Fiscal Year" description="Define fiscal calendar dates. Twelve monthly periods are auto-generated." actions={
        <Link href="/finance/fiscal-years" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted" onClick={(e) => { if (isDirty && !window.confirm("Discard unsaved changes?")) e.preventDefault(); }}>
          <ArrowLeft className="size-3.5" /> Cancel
        </Link>
      } />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <FiscalFormFields form={form} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end"><Button type="submit" className="cursor-pointer" disabled={!isValid || isSubmitting}>{isSubmitting ? "Saving…" : "Create Fiscal Year"}</Button></div>
      </form>
    </div>
  );
}
