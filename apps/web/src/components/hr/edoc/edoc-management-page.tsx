"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  FolderTree,
  Search,
  Shield,
  Users,
} from "lucide-react";

import { EdocDocumentTypesPanel } from "@/components/hr/edoc/edoc-document-types-panel";
import { EdocOtherDocumentsPanel } from "@/components/hr/edoc/edoc-other-documents-panel";
import { DocumentPreviewContent } from "@/components/hr/shared/document-preview-content";
import { OnboardingPoliciesPanel } from "@/components/hr/setup/onboarding-policies-panel";
import { PageHeader } from "@/components/layout/page-header";
import { HrLoadingBlock, HrUnderlineTabs, type HrTabItem } from "@/components/hr/hr-primitives";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadOnboardingDirectory } from "@/services/onboarding-management-service";
import { listOnboardingPolicies, ensureOnboardingPoliciesLoaded, listActivePoliciesForPortal } from "@/services/onboarding-policies-service";
import {
  ensureSignedPolicyDocsLoaded,
  getSignedPolicyDocsForCase,
  saveSignedPolicyDocsForCase,
} from "@/lib/onboarding-signed-docs-store";
import { stampPoliciesWithSignature } from "@/lib/stamp-policy-signatures";
import { loadEmployeeDirectory } from "@/services/employee-management-service";
import { loadOffboardingCases } from "@/services/offboarding-service";
import type { OnboardingCase, OnboardingDocument } from "@/types/onboarding-management";
import type { EmployeeRecord } from "@/types/employee-management";
import type { ExitDocument } from "@/types/offboarding";

type EdocTab = "employees" | "document-types" | "onboarding-policies" | "other";

const TABS: HrTabItem[] = [
  { id: "employees", label: "Employee Docs", icon: Users },
  { id: "document-types", label: "Document Types", icon: FolderTree },
  { id: "onboarding-policies", label: "Onboarding Policies", icon: Shield },
  { id: "other", label: "Other", icon: FileText },
];

type DocSectionId =
  | "photo"
  | "resume"
  | "education"
  | "bank"
  | "employment_letters"
  | "other"
  | "policies"
  | "offboarding";

type DocSectionDef = {
  id: DocSectionId;
  title: string;
  hint: string;
};

const DOC_SECTIONS: DocSectionDef[] = [
  {
    id: "photo",
    title: "Photo",
    hint: "Upload passport size photo — max 300 KB, JPG or PNG only",
  },
  {
    id: "resume",
    title: "Resume",
    hint: "CV / resume uploaded at onboarding",
  },
  {
    id: "education",
    title: "Education",
    hint: "10th, 12th and other education certificates",
  },
  {
    id: "bank",
    title: "Bank details",
    hint: "Cancelled cheque / passbook proof",
  },
  {
    id: "employment_letters",
    title: "Payslips & letters",
    hint: "Salary slips, relieving and experience letters",
  },
  {
    id: "other",
    title: "Other documents",
    hint: "Certificates and unclassified uploads",
  },
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
  signatureDataUrl?: string;
  signedPolicyDocs?: OnboardingDocument[];
  caseCode?: string;
  offboardingDocs: ExitDocument[];
  offboardingCaseCode?: string;
};

function docsFromEmployee(emp: EmployeeRecord): OnboardingDocument[] {
  const ext = emp.extension?.documents ?? [];
  const docs: OnboardingDocument[] = ext.map((d, i) => ({
    id: d.id || `emp-doc-${i}`,
    kind: (d.documentType as OnboardingDocument["kind"]) || "other",
    typeCode: d.documentType,
    fileName: d.fileName || d.documentType || "Document",
    uploadedAt: d.uploadedAt || emp.extension?.updatedAt || "",
    verifyStatus: "pending" as const,
    fileDataUrl: d.fileDataUrl,
  }));

  const photoUrl =
    emp.profilePhotoDataUrl || emp.extension?.personal?.profilePhotoDataUrl;
  if (photoUrl && !docs.some((d) => d.kind === "photo" || d.typeCode === "DOC-PHOTO")) {
    docs.unshift({
      id: `photo-${emp.id}`,
      kind: "photo",
      typeCode: "DOC-PHOTO",
      fileName: "Photo",
      uploadedAt: emp.extension?.updatedAt || "",
      verifyStatus: "verified",
      fileDataUrl: photoUrl,
      mimeType: "image/jpeg",
    });
  }
  return docs;
}

function normalizeBlob(d: OnboardingDocument): string {
  return `${d.kind || ""} ${d.typeCode || ""} ${d.fileName || ""}`.toLowerCase();
}

function matchSection(d: OnboardingDocument): DocSectionId {
  const code = (d.typeCode || "").toUpperCase();
  const kind = (d.kind || "").toLowerCase();
  const blob = normalizeBlob(d);

  if (kind === "photo" || code === "DOC-PHOTO" || blob.includes("passport photo")) {
    return "photo";
  }
  if (kind === "resume" || code === "DOC-RESUME" || blob.includes("resume") || blob.includes("cv")) {
    return "resume";
  }
  if (
    kind === "education" ||
    code === "DOC-10TH" ||
    code === "DOC-12TH" ||
    code === "DOC-GRAD" ||
    code.startsWith("DOC-10") ||
    code.startsWith("DOC-12") ||
    blob.includes("marksheet") ||
    blob.includes("education") ||
    blob.includes("degree")
  ) {
    return "education";
  }
  if (
    kind === "cancelled_cheque" ||
    kind === "bank_details" ||
    code === "DOC-CHEQUE" ||
    blob.includes("cheque") ||
    blob.includes("passbook") ||
    blob.includes("bank")
  ) {
    return "bank";
  }
  if (
    kind === "salary_slips" ||
    kind === "relieving_letter" ||
    kind === "appointment_letter" ||
    kind === "experience" ||
    kind === "previous_employer" ||
    code === "DOC-SLIPS" ||
    code === "DOC-REL" ||
    code === "DOC-APPT" ||
    blob.includes("salary") ||
    blob.includes("relieving") ||
    blob.includes("experience") ||
    blob.includes("appointment")
  ) {
    return "employment_letters";
  }
  return "other";
}

function groupDocs(docs: OnboardingDocument[]): Record<DocSectionId, OnboardingDocument[]> {
  const empty: Record<DocSectionId, OnboardingDocument[]> = {
    photo: [],
    resume: [],
    education: [],
    bank: [],
    employment_letters: [],
    other: [],
    policies: [],
    offboarding: [],
  };
  for (const d of docs) {
    empty[matchSection(d)].push(d);
  }
  return empty;
}

export function EdocManagementPage() {
  const [tab, setTab] = useState<EdocTab>("employees");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [bundles, setBundles] = useState<EmployeeDocBundle[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [policyCatalog, setPolicyCatalog] = useState<
    ReturnType<typeof listOnboardingPolicies>
  >([]);
  const [previewDoc, setPreviewDoc] = useState<OnboardingDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dir, empDir, offboarding] = await Promise.all([
        loadOnboardingDirectory().catch(() => ({ cases: [] as OnboardingCase[] })),
        loadEmployeeDirectory().catch(() => ({ records: [] as EmployeeRecord[] })),
        loadOffboardingCases().catch(() => [] as Awaited<ReturnType<typeof loadOffboardingCases>>),
        ensureOnboardingPoliciesLoaded().catch(() => []),
        ensureSignedPolicyDocsLoaded().catch(() => ({})),
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
          signedPolicyDocs: [],
          offboardingDocs: [],
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
        const signatureDataUrl = c.portal?.policies?.signatureDataUrl;
        const fromCase = c.portal?.policies?.signedDocuments ?? [];
        let fromIdb = await getSignedPolicyDocsForCase(c.id);
        // Re-stamp whenever a signature image exists so legacy "Digitally signed"
        // labels are replaced with signature-only PDFs.
        if (signatureDataUrl && signatureDataUrl.startsWith("data:image/")) {
          try {
            const policies = listActivePoliciesForPortal();
            if (policies.length) {
              const stamped = await stampPoliciesWithSignature({
                policies,
                signatureDataUrl,
                signatureMimeType: c.portal?.policies?.signatureMimeType,
                candidateName: c.candidateName,
              });
              await saveSignedPolicyDocsForCase(c.id, stamped);
              fromIdb = stamped;
            }
          } catch (err) {
            console.warn("Could not refresh signed policy PDFs", err);
          }
        }
        const signedSource = fromIdb.length
          ? fromIdb
          : fromCase.filter((s) => Boolean(s.fileDataUrl));
        const signedPolicyDocs: OnboardingDocument[] = signedSource.map((s) => ({
          id: `signed-policy-${c.id}-${s.policyId}`,
          kind: "other" as const,
          typeCode: `SIGNED-POLICY-${s.policyId}`,
          fileName: s.fileName,
          uploadedAt: s.signedAt,
          verifyStatus: "accepted" as const,
          notes: s.title,
          fileDataUrl: s.fileDataUrl,
          mimeType: s.mimeType || "application/pdf",
        }));

        if (existing) {
          const seen = new Set(existing.documents.map((d) => d.id));
          for (const d of portalDocs) {
            if (!seen.has(d.id)) existing.documents.push(d);
          }
          if (accepted.length) existing.policiesAccepted = accepted;
          if (acceptedAt) existing.policiesAcceptedAt = acceptedAt;
          if (signature) existing.signature = signature;
          if (signatureFileName) existing.signatureFileName = signatureFileName;
          if (signatureDataUrl) existing.signatureDataUrl = signatureDataUrl;
          if (signedPolicyDocs.length) existing.signedPolicyDocs = signedPolicyDocs;
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
            signatureDataUrl,
            signedPolicyDocs,
            caseCode: c.caseCode,
            offboardingDocs: [],
          };
          bundlesPush(byEmail, byEmpId, bundle);
        }
      }

      for (const ob of offboarding) {
        const docs = ob.documents ?? [];
        if (!docs.length) continue;
        const existing =
          (ob.employeeId && byEmpId.get(ob.employeeId)) ||
          [...byEmpId.values(), ...byEmail.values()].find(
            (b) =>
              b.code.toLowerCase() === (ob.employeeCode || "").toLowerCase() ||
              b.name.toLowerCase() === (ob.employeeName || "").toLowerCase(),
          );
        if (existing) {
          existing.offboardingDocs = [...existing.offboardingDocs, ...docs];
          existing.offboardingCaseCode = ob.documentNumber;
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

  const grouped = useMemo(
    () => (selected ? groupDocs(selected.documents) : null),
    [selected],
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

      {tab === "document-types" ? (
        <EdocDocumentTypesPanel />
      ) : tab === "onboarding-policies" ? (
        <OnboardingPoliciesPanel />
      ) : tab === "other" ? (
        <EdocOtherDocumentsPanel />
      ) : loading ? (
        <HrLoadingBlock label="Loading documents…" />
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
                          ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                          : "text-foreground hover:bg-muted/60",
                      )}
                      onClick={() => setSelectedKey(b.key)}
                    >
                      <p className="truncate text-sm font-medium text-inherit">{b.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {b.code}
                        {b.documents.length ? ` · ${b.documents.length} docs` : ""}
                        {(b.signedPolicyDocs?.length || b.policiesAccepted.length)
                          ? ` · ${b.signedPolicyDocs?.length || b.policiesAccepted.length} policies`
                          : ""}
                        {b.offboardingDocs.length ? ` · exit` : ""}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </aside>

          <section className="erp-scroll max-h-[calc(100vh-14rem)] min-w-0 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            {!selected || !grouped ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Select an employee to view documents section-wise.
              </p>
            ) : (
              <>
                <div>
                  <h2 className="text-base font-semibold">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.code}
                    {selected.email ? ` · ${selected.email}` : ""}
                    {selected.caseCode ? ` · Onboarding ${selected.caseCode}` : ""}
                    {selected.offboardingCaseCode
                      ? ` · Exit ${selected.offboardingCaseCode}`
                      : ""}
                  </p>
                </div>

                {DOC_SECTIONS.map((sec) => {
                  const rows = grouped[sec.id];
                  const hideEmptyOther = sec.id === "other" && rows.length === 0;
                  if (hideEmptyOther) return null;
                  return (
                    <DocSectionCard
                      key={`${selected.key}-${sec.id}`}
                      title={sec.title}
                      hint={sec.hint}
                      count={rows.length}
                      defaultOpen={false}
                    >
                      {rows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Not uploaded</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {rows.map((d) => (
                            <DocRow
                              key={d.id}
                              fileName={d.fileName}
                              meta={[
                                d.kind,
                                d.uploadedAt ? String(d.uploadedAt).slice(0, 10) : "",
                                d.verifyStatus || "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                              previewable={Boolean(d.fileDataUrl)}
                              thumbUrl={
                                d.kind === "photo" || d.mimeType?.startsWith("image/")
                                  ? d.fileDataUrl
                                  : undefined
                              }
                              onView={() => setPreviewDoc(d)}
                            />
                          ))}
                        </ul>
                      )}
                    </DocSectionCard>
                  );
                })}

                <DocSectionCard
                  key={`${selected.key}-policies`}
                  title="Policies accepted"
                  hint="Signed policy PDFs — signature on every page (bottom-right)"
                  count={
                    selected.signedPolicyDocs?.length
                      ? selected.signedPolicyDocs.length
                      : selected.policiesAccepted.length
                  }
                  defaultOpen={Boolean(selected.signedPolicyDocs?.length || selected.policiesAccepted.length)}
                >
                  {selected.policiesAccepted.length === 0 &&
                  !(selected.signedPolicyDocs?.length) ? (
                    <p className="text-xs text-muted-foreground">
                      No policy acceptance recorded for this person.
                    </p>
                  ) : selected.signedPolicyDocs?.length ? (
                    <ul className="space-y-1.5">
                      {selected.signedPolicyDocs.map((d) => (
                        <DocRow
                          key={d.id}
                          fileName={d.notes || d.fileName}
                          meta={[
                            "Signed · every page",
                            d.uploadedAt ? String(d.uploadedAt).slice(0, 10) : "",
                            "accepted",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          previewable={Boolean(d.fileDataUrl)}
                          onView={() => setPreviewDoc(d)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <>
                      <ul className="space-y-1.5">
                        {selected.policiesAccepted.map((id) => (
                          <li
                            key={id}
                            className="flex items-start gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                          >
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                            <span>{policyTitle(id)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[10px] text-amber-700">
                        Agreed only — no stamped PDFs yet. Candidate must submit with an uploaded
                        signature image (PNG/JPG ≤ 100 KB) so HR can open signed copies here.
                      </p>
                    </>
                  )}
                  {selected.policiesAcceptedAt ? (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Accepted {selected.policiesAcceptedAt.slice(0, 19).replace("T", " ")}
                    </p>
                  ) : null}
                  {selected.signature || selected.signatureFileName || selected.signatureDataUrl ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Signature:{" "}
                        {selected.signatureFileName ||
                          (selected.signatureDataUrl ? "Uploaded image" : selected.signature) ||
                          "Uploaded"}
                      </span>
                      {selected.signatureDataUrl ? (
                        <button
                          type="button"
                          className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() =>
                            setPreviewDoc({
                              id: "signature",
                              kind: "signature",
                              fileName: selected.signatureFileName || "Signature",
                              uploadedAt: selected.policiesAcceptedAt || "",
                              verifyStatus: "verified",
                              fileDataUrl: selected.signatureDataUrl,
                              mimeType: "image/png",
                            })
                          }
                        >
                          View
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </DocSectionCard>

                {selected.offboardingDocs.length > 0 ? (
                  <DocSectionCard
                    key={`${selected.key}-offboarding`}
                    title="Offboarding"
                    hint="Exit / relieving documents from separation workflow"
                    count={selected.offboardingDocs.length}
                    defaultOpen={false}
                  >
                    <ul className="space-y-1.5">
                      {selected.offboardingDocs.map((d) => (
                        <li
                          key={d.id}
                          className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                        >
                          <p className="font-medium">{d.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {d.docType.replace(/_/g, " ")}
                            {d.fileName ? ` · ${d.fileName}` : ""}
                            {d.uploadedAt ? ` · ${d.uploadedAt.slice(0, 10)}` : ""}
                          </p>
                          {d.notes ? (
                            <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </DocSectionCard>
                ) : null}
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
            {previewDoc.fileDataUrl ? (
              <DocumentPreviewContent
                fileName={previewDoc.fileName}
                dataUrl={previewDoc.fileDataUrl}
                mimeType={previewDoc.mimeType}
                frameClassName="max-h-[70vh]"
                viewOnly
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DocSectionCard({
  title,
  hint,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/10">
      <button
        type="button"
        className="flex w-full cursor-pointer items-start justify-between gap-2 px-3 py-3 text-left transition-colors hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                open ? "rotate-0" : "-rotate-90",
              )}
            />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              {title}
            </h3>
          </div>
          <p className="mt-0.5 pl-5 text-[10px] text-muted-foreground">{hint}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            count > 0
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-muted text-muted-foreground",
          )}
        >
          {count > 0 ? `${count} file${count === 1 ? "" : "s"}` : "Empty"}
        </span>
      </button>
      {open ? <div className="border-t border-border/50 px-3 py-3">{children}</div> : null}
    </div>
  );
}

function DocRow({
  fileName,
  meta,
  previewable,
  thumbUrl,
  onView,
}: {
  fileName: string;
  meta: string;
  previewable: boolean;
  thumbUrl?: string;
  onView: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            className="size-9 shrink-0 rounded-md border border-border/60 object-cover"
          />
        ) : (
          <FileText className="size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium">{fileName}</p>
          {meta ? <p className="truncate text-[10px] text-muted-foreground">{meta}</p> : null}
        </div>
      </div>
      {previewable ? (
        <button
          type="button"
          className="shrink-0 cursor-pointer text-xs font-medium text-primary underline-offset-2 hover:underline"
          onClick={onView}
        >
          View
        </button>
      ) : (
        <span className="shrink-0 text-[10px] text-muted-foreground">No preview</span>
      )}
    </li>
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
