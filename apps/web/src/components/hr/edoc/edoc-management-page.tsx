"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Search, Shield, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { HrLoadingBlock, HrUnderlineTabs, type HrTabItem } from "@/components/hr/hr-primitives";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadOnboardingDirectory } from "@/services/onboarding-management-service";
import { listOnboardingPolicies } from "@/services/onboarding-policies-service";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import type { OnboardingCase, OnboardingDocument } from "@/types/onboarding-management";
import type { EmployeeRecord } from "@/types/employee-management";

type EdocTab = "employees" | "policies" | "other";

const TABS: HrTabItem[] = [
  { id: "employees", label: "Employee Docs", icon: Users },
  { id: "policies", label: "Policies", icon: Shield },
  { id: "other", label: "Other", icon: FileText },
];

type EmployeeDocBundle = {
  key: string;
  name: string;
  code: string;
  email: string;
  source: "employee" | "onboarding";
  employeeId?: string;
  documents: OnboardingDocument[];
  policiesAccepted: string[];
  policiesAcceptedAt?: string;
  signature?: string;
  signatureFileName?: string;
  caseCode?: string;
};

function docsFromEmployee(emp: EmployeeRecord): OnboardingDocument[] {
  const ext = emp.extension?.documents ?? [];
  return ext.map((d, i) => ({
    id: d.id || `emp-doc-${i}`,
    kind: (d.documentType as OnboardingDocument["kind"]) || "other",
    typeCode: d.documentType,
    fileName: d.fileName || d.documentType || "Document",
    uploadedAt: d.uploadedAt || emp.extension?.updatedAt || "",
    verifyStatus: "pending" as const,
    fileDataUrl: d.fileDataUrl,
  }));
}

export function EdocManagementPage() {
  const [tab, setTab] = useState<EdocTab>("employees");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [bundles, setBundles] = useState<EmployeeDocBundle[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [policyCatalog, setPolicyCatalog] = useState(listOnboardingPolicies(true));
  const [previewDoc, setPreviewDoc] = useState<OnboardingDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dir, empDir] = await Promise.all([
        loadOnboardingDirectory().catch(() => ({ cases: [] as OnboardingCase[] })),
        loadEmployeeDirectory().catch(() => ({ records: [] as EmployeeRecord[] })),
      ]);
      setPolicyCatalog(listOnboardingPolicies(true));
      const employees = empDir.records ?? [];

      const byEmail = new Map<string, EmployeeDocBundle>();
      const byEmpId = new Map<string, EmployeeDocBundle>();

      for (const emp of employees) {
        const name = emp.displayName || emp.employeeCode || "Employee";
        const email = (
          emp.extension?.personal?.personalEmail ||
          emp.extension?.personal?.email ||
          emp.officialEmail ||
          ""
        ).toLowerCase();
        const bundle: EmployeeDocBundle = {
          key: `emp:${emp.id}`,
          name,
          code: emp.employeeCode || emp.id.slice(0, 8),
          email,
          source: "employee",
          employeeId: emp.id,
          documents: docsFromEmployee(emp),
          policiesAccepted: [],
        };
        byEmpId.set(emp.id, bundle);
        if (email) byEmail.set(email, bundle);
      }

      for (const c of dir.cases) {
        const email = (c.candidateEmail || "").toLowerCase();
        const existing =
          (c.employeeId && byEmpId.get(c.employeeId)) ||
          (email ? byEmail.get(email) : undefined);

        const portalDocs = c.portal?.documents ?? [];
        const accepted = c.portal?.policies?.policies ?? [];
        const acceptedAt = c.portal?.policies?.acceptedAt;
        const signature = c.portal?.policies?.signature;
        const signatureFileName = c.portal?.policies?.signatureFileName;

        if (existing) {
          const seen = new Set(existing.documents.map((d) => d.id));
          for (const d of portalDocs) {
            if (!seen.has(d.id)) existing.documents.push(d);
          }
          if (accepted.length) existing.policiesAccepted = accepted;
          if (acceptedAt) existing.policiesAcceptedAt = acceptedAt;
          if (signature) existing.signature = signature;
          if (signatureFileName) existing.signatureFileName = signatureFileName;
          existing.caseCode = c.caseCode;
        } else {
          const bundle: EmployeeDocBundle = {
            key: `onb:${c.id}`,
            name: c.candidateName,
            code: c.caseCode,
            email,
            source: "onboarding",
            employeeId: c.employeeId,
            documents: [...portalDocs],
            policiesAccepted: accepted,
            policiesAcceptedAt: acceptedAt,
            signature,
            signatureFileName,
            caseCode: c.caseCode,
          };
          bundlesPush(byEmail, byEmpId, bundle);
        }
      }

      const merged = Array.from(
        new Map(
          [...byEmpId.values(), ...byEmail.values()].map((b) => [b.key, b]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name));

      setBundles(merged);
      setSelectedKey((prev) =>
        prev && merged.some((b) => b.key === prev) ? prev : merged[0]?.key ?? null,
      );
    } catch {
      toast("Failed to load documents", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bundles;
    return bundles.filter((b) =>
      [b.name, b.code, b.email, b.caseCode ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [bundles, query]);

  const selected = useMemo(
    () => bundles.find((b) => b.key === selectedKey) ?? null,
    [bundles, selectedKey],
  );

  const policyTitle = (id: string) =>
    policyCatalog.find((p) => p.id === id)?.title ?? id.replace(/_/g, " ");

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader title="EDoc" />

      <HrUnderlineTabs
        tabs={TABS}
        value={tab}
        onChange={(id) => setTab(id as EdocTab)}
      />

      {loading ? (
        <HrLoadingBlock label="Loading documents…" />
      ) : tab === "policies" ? (
        <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Policy library</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Managed in Org Setup → Employment → Onboarding Policies. Active policies appear on the
            candidate portal.
          </p>
          <ul className="mt-3 space-y-2">
            {policyCatalog.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{p.status}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.body}</p>
              </li>
            ))}
            {policyCatalog.length === 0 ? (
              <p className="text-xs text-muted-foreground">No policies configured yet.</p>
            ) : null}
          </ul>
        </section>
      ) : tab === "other" ? (
        <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm text-sm text-muted-foreground">
          Other organisational document packs (contracts, templates) can be added here. Employee KYC
          and policy acceptance are under Employee Docs.
        </section>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,18rem)_1fr]">
          <aside className="rounded-xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee…"
                  className="h-9 pl-8"
                />
              </div>
            </div>
            <ul className="erp-scroll max-h-[calc(100vh-16rem)] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <li className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No employees with documents
                </li>
              ) : (
                filtered.map((b) => (
                  <li key={b.key}>
                    <button
                      type="button"
                      className={cn(
                        "w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors",
                        selectedKey === b.key
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted/50",
                      )}
                      onClick={() => setSelectedKey(b.key)}
                    >
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {b.code}
                        {b.documents.length ? ` · ${b.documents.length} docs` : ""}
                        {b.policiesAccepted.length ? ` · ${b.policiesAccepted.length} policies` : ""}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>

          <section className="min-w-0 space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            {!selected ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Select an employee to view documents and accepted policies.
              </p>
            ) : (
              <>
                <div>
                  <h2 className="text-base font-semibold">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.code}
                    {selected.email ? ` · ${selected.email}` : ""}
                    {selected.caseCode ? ` · Onboarding ${selected.caseCode}` : ""}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Collected documents
                  </h3>
                  {selected.documents.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">No documents on file.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {selected.documents.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{d.fileName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {d.kind}
                              {d.uploadedAt ? ` · ${String(d.uploadedAt).slice(0, 10)}` : ""}
                              {d.verifyStatus ? ` · ${d.verifyStatus}` : ""}
                            </p>
                          </div>
                          {d.fileDataUrl ? (
                            <button
                              type="button"
                              className="shrink-0 cursor-pointer text-xs font-medium text-primary underline-offset-2 hover:underline"
                              onClick={() => setPreviewDoc(d)}
                            >
                              View
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Policies accepted at onboarding
                  </h3>
                  {selected.policiesAccepted.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No policy acceptance recorded for this person.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {selected.policiesAccepted.map((id) => (
                        <li
                          key={id}
                          className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                        >
                          {policyTitle(id)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {selected.policiesAcceptedAt ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Accepted {selected.policiesAcceptedAt.slice(0, 19).replace("T", " ")}
                    </p>
                  ) : null}
                  {selected.signature || selected.signatureFileName ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Signature: {selected.signatureFileName || selected.signature}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {previewDoc?.fileDataUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{previewDoc.fileName}</p>
              <button
                type="button"
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setPreviewDoc(null)}
              >
                Close
              </button>
            </div>
            {previewDoc.mimeType?.startsWith("image/") ||
            previewDoc.fileDataUrl.startsWith("data:image") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewDoc.fileDataUrl}
                alt={previewDoc.fileName}
                className="max-h-[70vh] w-auto max-w-full rounded-md"
              />
            ) : (
              <iframe
                title={previewDoc.fileName}
                src={previewDoc.fileDataUrl}
                className="h-[70vh] w-full rounded-md border border-border"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function bundlesPush(
  byEmail: Map<string, EmployeeDocBundle>,
  byEmpId: Map<string, EmployeeDocBundle>,
  bundle: EmployeeDocBundle,
) {
  if (bundle.employeeId) byEmpId.set(bundle.employeeId, bundle);
  if (bundle.email) byEmail.set(bundle.email, bundle);
  else byEmpId.set(bundle.key, bundle);
}
