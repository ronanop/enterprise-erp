"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  CoaAccountFormFields,
  useCoaForm,
} from "@/components/finance/coa/coa-account-form-fields";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes";
import { toCoaPayload } from "@/lib/finance/coa-schema";
import { ApiClientError } from "@/services/api-client";
import {
  createAccount,
  listAccountGroups,
  listAccounts,
  type AccountGroup,
} from "@/services/coa-service";

export function CoaCreatePage() {
  const router = useRouter();
  const form = useCoaForm();
  const {
    handleSubmit,
    formState: { isDirty, isSubmitting, isValid },
  } = form;
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [parents, setParents] = useState<{ id: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useUnsavedChangesWarning(isDirty && !isSubmitting);

  const loadLookups = useCallback(async () => {
    try {
      const [g, tree] = await Promise.all([
        listAccountGroups(),
        listAccounts({ tree: true, paged: true, page_size: 500 }),
      ]);
      setGroups(g);
      setParents(
        tree.items.map((a) => ({
          id: a.id,
          label: `${a.account_code} · ${a.account_name}`,
        })),
      );
    } catch {
      setGroups([]);
      setParents([]);
    }
  }, []);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const created = await createAccount(toCoaPayload(values));
      router.push(`/finance/chart-of-accounts/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create account");
    }
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Account"
        description="Add a chart of accounts entry for the company ledger."
        actions={
          <Link
            href="/finance/chart-of-accounts"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted"
            onClick={(e) => {
              if (isDirty && !window.confirm("Discard unsaved changes?")) e.preventDefault();
            }}
          >
            <ArrowLeft className="size-3.5" /> Cancel
          </Link>
        }
      />
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            void onSubmit();
          }
        }}
      >
        <CoaAccountFormFields form={form} groups={groups} parentOptions={parents} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="submit" className="cursor-pointer" disabled={!isValid || isSubmitting}>
            {isSubmitting ? "Saving…" : "Create Account"}
          </Button>
        </div>
      </form>
    </div>
  );
}
