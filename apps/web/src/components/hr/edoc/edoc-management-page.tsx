"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, FolderTree, Shield, Users } from "lucide-react";

import { EdocDocumentTypesPanel } from "@/components/hr/edoc/edoc-document-types-panel";
import {
  EdocEmployeeVault,
  bundlesPush,
  type EmployeeDocBundle,
} from "@/components/hr/edoc/edoc-employee-vault";
import { EdocOtherDocumentsPanel } from "@/components/hr/edoc/edoc-other-documents-panel";
import { OnboardingPoliciesPanel } from "@/components/hr/setup/onboarding-policies-panel";
import { PageHeader } from "@/components/layout/page-header";
import { HrUnderlineTabs, type HrTabItem } from "@/components/hr/hr-primitives";
import { SetupToastHost, toast } from "@/components/hr/setup/setup-toast";
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

type EdocTab = "employees" | "document-types" | "onboarding-policies" | "other";

const TABS: HrTabItem[] = [
  { id: "employees", label: "Employee Documents", icon: Users },
  { id: "document-types", label: "Document Types", icon: FolderTree },
  { id: "onboarding-policies", label: "Onboarding Policies", icon: Shield },
  { id: "other", label: "Other Documents", icon: FileText },
];

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

export function EdocManagementPage() {
  const [tab, setTab] = useState<EdocTab>("employees");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [bundles, setBundles] = useState<EmployeeDocBundle[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [policyCatalog, setPolicyCatalog] = useState<
    ReturnType<typeof listOnboardingPolicies>
  >([]);

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
          entityId: emp.extension?.employment?.entityId || undefined,
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
        if (signatureDataUrl && signatureDataUrl.startsWith("data:image/")) {
          try {
            const policies = listActivePoliciesForPortal(c.entityId);
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
          if (c.entityId) existing.entityId = existing.entityId || c.entityId;
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
            entityId: c.entityId,
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <SetupToastHost />
      <PageHeader
        title="Employee Documents"
        className="shrink-0 border-b-0 pb-0"
      />

      <div className="shrink-0">
      <HrUnderlineTabs
        tabs={TABS}
        value={tab}
        onChange={(id) => setTab(id as EdocTab)}
      />
      </div>

      {tab === "document-types" ? (
        <div className="erp-scroll min-h-0 flex-1 overflow-y-auto">
        <EdocDocumentTypesPanel />
        </div>
      ) : tab === "onboarding-policies" ? (
        <div className="erp-scroll min-h-0 flex-1 overflow-y-auto">
        <OnboardingPoliciesPanel />
        </div>
      ) : tab === "other" ? (
        <div className="erp-scroll min-h-0 flex-1 overflow-y-auto">
        <EdocOtherDocumentsPanel />
        </div>
      ) : (
        <EdocEmployeeVault
          loading={loading}
          bundles={bundles}
          setBundles={setBundles}
          query={query}
          setQuery={setQuery}
          selectedKey={selectedKey}
          setSelectedKey={setSelectedKey}
          policyCatalog={policyCatalog}
        />
      )}
    </div>
  );
}
