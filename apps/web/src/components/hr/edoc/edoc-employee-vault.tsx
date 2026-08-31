"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Filter,
  Folder,
  GraduationCap,
  GripVertical,
  Landmark,
  Maximize2,
  Search,
  Shield,
  UserMinus,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import { DocumentPreviewContent } from "@/components/hr/shared/document-preview-content";
import { HrLoadingBlock } from "@/components/hr/hr-primitives";
import { toast } from "@/components/hr/setup/setup-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";
import { triggerDataUrlDownload } from "@/lib/document-preview";
import type { OnboardingDocument } from "@/types/onboarding-management";
import { policyAppliesToEntity, type OnboardingPolicyDoc } from "@/services/onboarding-policies-service";
import type { ExitDocument } from "@/types/offboarding";
import { cn } from "@/lib/utils";

export type EmployeeDocBundle = {
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
  entityId?: string;
  caseCode?: string;
  offboardingDocs: ExitDocument[];
  offboardingCaseCode?: string;
};

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
  icon: LucideIcon;
};

const DOC_SECTIONS: DocSectionDef[] = [
  { id: "photo", title: "Photo", hint: "max 300 KB, JPG or PNG only", icon: Camera },
  { id: "resume", title: "Resume", hint: "CV / resume uploaded at onboarding", icon: FileText },
  { id: "education", title: "Education", hint: "10th, 12th and other education certificates", icon: GraduationCap },
  { id: "bank", title: "Bank Details", hint: "Cancelled cheque / passbook proof", icon: Landmark },
  { id: "employment_letters", title: "Payslips & Letters", hint: "Salary slips, relieving and experience letters", icon: Wallet },
  { id: "other", title: "Other Documents", hint: "Certificates and unclassified uploads", icon: Folder },
];

const REQUIRED_SLOTS: DocSectionId[] = [
  "photo",
  "resume",
  "education",
  "bank",
  "employment_letters",
  "other",
  "policies",
];

type Completeness = { filled: number; required: number; pct: number };

type VaultFilter = "all" | "complete" | "incomplete";

type PreviewTarget =
  | { kind: "doc"; doc: OnboardingDocument; sectionId: DocSectionId }
  | { kind: "policy"; doc: OnboardingDocument }
  | null;

function normalizeBlob(d: OnboardingDocument): string {
  return `${d.kind || ""} ${d.typeCode || ""} ${d.fileName || ""}`.toLowerCase();
}

function matchSection(d: OnboardingDocument): DocSectionId {
  const code = (d.typeCode || "").toUpperCase();
  const kind = (d.kind || "").toLowerCase();
  const blob = normalizeBlob(d);

  if (kind === "photo" || code === "DOC-PHOTO" || blob.includes("passport photo")) return "photo";
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
    code === "DOC-RLV" ||
    code.startsWith("DOC-RLV-") ||
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

export function groupDocs(docs: OnboardingDocument[]): Record<DocSectionId, OnboardingDocument[]> {
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
  for (const d of docs) empty[matchSection(d)].push(d);
  return empty;
}

function slotFilled(bundle: EmployeeDocBundle, grouped: Record<DocSectionId, OnboardingDocument[]>, id: DocSectionId) {
  if (id === "policies") {
    return Boolean(bundle.signedPolicyDocs?.length || bundle.policiesAccepted.length);
  }
  if (id === "offboarding") return bundle.offboardingDocs.length > 0;
  return grouped[id].length > 0;
}

export function completeness(bundle: EmployeeDocBundle): Completeness {
  const grouped = groupDocs(bundle.documents);
  const filled = REQUIRED_SLOTS.filter((id) => slotFilled(bundle, grouped, id)).length;
  const required = REQUIRED_SLOTS.length;
  return { filled, required, pct: Math.round((filled / required) * 100) };
}

export function downloadEmployeeDocs(bundle: EmployeeDocBundle): number {
  const files = [...bundle.documents, ...(bundle.signedPolicyDocs ?? [])].filter((d) => d.fileDataUrl);
  files.forEach((d, i) => {
    window.setTimeout(() => triggerDataUrlDownload(d.fileDataUrl!, d.fileName || "document"), i * 120);
  });
  return files.length;
}

function policyIdFromSignedDoc(d: OnboardingDocument): string | undefined {
  const code = d.typeCode || "";
  if (code.startsWith("SIGNED-POLICY-")) return code.slice("SIGNED-POLICY-".length);
  return undefined;
}

function isPolicySigned(bundle: EmployeeDocBundle, policy: OnboardingPolicyDoc): boolean {
  if (bundle.policiesAccepted.includes(policy.id)) return true;
  const docs = bundle.signedPolicyDocs ?? [];
  if (docs.some((d) => policyIdFromSignedDoc(d) === policy.id)) return true;
  const title = policy.title.trim().toLowerCase();
  if (!title) return false;
  return docs.some((d) => (d.notes || "").trim().toLowerCase() === title);
}

function signedDocForPolicy(bundle: EmployeeDocBundle, policy: OnboardingPolicyDoc): OnboardingDocument | undefined {
  const docs = bundle.signedPolicyDocs ?? [];
  return (
    docs.find((d) => policyIdFromSignedDoc(d) === policy.id) ||
    docs.find((d) => (d.notes || "").trim().toLowerCase() === policy.title.trim().toLowerCase())
  );
}

function requiredPoliciesForBundle(catalog: OnboardingPolicyDoc[], entityId?: string) {
  return catalog
    .filter((p) => p.status === "active" && policyAppliesToEntity(p, entityId))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

const PREVIEW_MIN = 280;
const PREVIEW_MAX = 920;
const PREVIEW_DEFAULT = 420;

function ringColor(pct: number) {
  if (pct >= 100) return "text-emerald-500";
  if (pct >= 70) return "text-primary";
  if (pct >= 40) return "text-amber-500";
  return "text-rose-500";
}

function formatUploaded(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function dataUrlBytes(url?: string) {
  if (!url) return 0;
  const i = url.indexOf(",");
  const b64 = i >= 0 ? url.slice(i + 1) : url;
  return Math.floor((b64.length * 3) / 4);
}

function formatBytes(n: number) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function sectionVerify(docs: OnboardingDocument[]): "verified" | "pending" | "missing" {
  if (!docs.length) return "missing";
  if (docs.some((d) => d.verifyStatus === "verified" || d.verifyStatus === "accepted")) return "verified";
  return "pending";
}

function latestUpload(docs: OnboardingDocument[]) {
  return docs.map((d) => d.uploadedAt).filter(Boolean).sort().at(-1);
}

type Props = {
  loading: boolean;
  bundles: EmployeeDocBundle[];
  setBundles: (next: EmployeeDocBundle[] | ((prev: EmployeeDocBundle[]) => EmployeeDocBundle[])) => void;
  query: string;
  setQuery: (q: string) => void;
  selectedKey: string | null;
  setSelectedKey: (key: string | null) => void;
  policyCatalog: OnboardingPolicyDoc[];
};

export function EdocEmployeeVault({
  loading,
  bundles,
  query,
  setQuery,
  selectedKey,
  setSelectedKey,
  policyCatalog,
}: Props) {
  const [filter, setFilter] = useState<VaultFilter>("all");
  const [preview, setPreview] = useState<PreviewTarget>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState(PREVIEW_DEFAULT);
  const [bigView, setBigView] = useState(false);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bundles.filter((b) => {
      const hay = [b.name, b.code, b.email, b.caseCode ?? ""].join(" ").toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (filter === "all") return true;
      const pct = completeness(b).pct;
      return filter === "complete" ? pct >= 100 : pct < 100;
    });
  }, [bundles, query, filter]);

  const selected = useMemo(
    () => bundles.find((b) => b.key === selectedKey) ?? null,
    [bundles, selectedKey],
  );

  const grouped = useMemo(() => (selected ? groupDocs(selected.documents) : null), [selected]);

  const requiredPolicies = useMemo(
    () => (selected ? requiredPoliciesForBundle(policyCatalog, selected.entityId) : []),
    [selected, policyCatalog],
  );

  const signedRequired = selected
    ? requiredPolicies.filter((p) => isPolicySigned(selected, p)).length
    : 0;

  useEffect(() => {
    setPreview(null);
    setBigView(false);
  }, [selected?.key]);

  function openDoc(doc: OnboardingDocument | undefined, sectionId?: DocSectionId) {
    if (!doc?.fileDataUrl) {
      toast("No file to preview", "error");
      return;
    }
    if (sectionId) setPreview({ kind: "doc", doc, sectionId });
    else setPreview({ kind: "doc", doc, sectionId: matchSection(doc) });
  }

  const previewDoc = preview?.doc ?? null;
  const previewBytes = dataUrlBytes(previewDoc?.fileDataUrl);
  const previewOpen = Boolean(previewDoc?.fileDataUrl);

  function onDownloadAll() {
    if (!selected) return;
    const n = downloadEmployeeDocs(selected);
    if (!n) toast("No files to download", "error");
    else toast(`Downloading ${n} file${n === 1 ? "" : "s"}`, "success");
  }

  function downloadPreview() {
    if (!previewDoc?.fileDataUrl) {
      toast("No file to download", "error");
      return;
    }
    triggerDataUrlDownload(previewDoc.fileDataUrl, previewDoc.fileName || "document");
  }

  function onResizePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startW: previewWidth };
  }

  function onResizePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const next = dragRef.current.startW + (dragRef.current.startX - e.clientX);
    setPreviewWidth(Math.min(PREVIEW_MAX, Math.max(PREVIEW_MIN, next)));
  }

  function onResizePointerUp(e: PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  if (loading) {
    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <HrLoadingBlock label="Loading documents…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <aside className="flex w-[20rem] min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="border-b border-border/60 p-3">
            <div className="flex items-center gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee…"
                  className="h-9 pl-8"
                />
              </div>
              <select
                aria-label="Filter by completion"
                value={filter}
                onChange={(e) => setFilter(e.target.value as VaultFilter)}
                className="h-9 cursor-pointer rounded-lg border border-input bg-transparent px-1.5 text-xs outline-none"
              >
                <option value="all">All</option>
                <option value="incomplete">Incomplete</option>
                <option value="complete">Complete</option>
              </select>
              <Filter className="size-3.5 shrink-0 text-muted-foreground" />
            </div>
          </div>
          <ul className="erp-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <li className="px-2 py-8 text-center text-xs text-muted-foreground">
                No employees match this search
              </li>
            ) : (
              filtered.map((b) => {
                const c = completeness(b);
                const photo = groupDocs(b.documents).photo[0]?.fileDataUrl;
                const active = selectedKey === b.key;
                return (
                  <li key={b.key}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors",
                        active
                          ? "bg-primary/10 ring-1 ring-primary/25"
                          : "hover:bg-muted/60",
                      )}
                      onClick={() => setSelectedKey(b.key)}
                    >
                      <Avatar src={photo} name={b.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{b.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{b.email || "—"}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">{b.code}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-0.5">
                        <CompletionRing pct={c.pct} label={`${c.filled}/${c.required}`} />
                        <span className="text-[9px] tabular-nums text-muted-foreground">
                          {c.filled}/{c.required} docs
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className="erp-scroll min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border border-border/70 bg-card p-4 shadow-sm">
          {!selected || !grouped ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Select an employee to view documents.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.email || "No email"}
                    {" · "}
                    {selected.code}
                    {selected.caseCode ? ` · ${selected.caseCode}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="cursor-pointer" onClick={onDownloadAll}>
                  <Download className="size-3.5" />
                  Download All
                </Button>
              </div>

              {DOC_SECTIONS.map((sec) => {
                const rows = grouped[sec.id];
                const status = sectionVerify(rows);
                const uploaded = latestUpload(rows);
                const Icon = sec.icon;
                const previewing = preview?.kind === "doc" && preview.sectionId === sec.id;
                return (
                  <article
                    key={sec.id}
                    className={cn(
                      "rounded-xl border bg-background px-3 py-3 shadow-sm transition-colors",
                      previewing ? "border-primary/40 ring-1 ring-primary/20" : "border-border/70",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
                        <Icon className="size-4" />
                      </div>
                      <button
                        type="button"
                        className="min-w-0 flex-1 cursor-pointer text-left"
                        onClick={() => openDoc(rows.find((r) => r.fileDataUrl) ?? rows[0], sec.id)}
                      >
                        <p className="text-sm font-semibold">{sec.title}</p>
                        <p className="text-[11px] text-muted-foreground">{sec.hint}</p>
                        {uploaded ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Uploaded: {formatUploaded(uploaded)}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-muted-foreground">Not uploaded</p>
                        )}
                      </button>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={status} />
                        <SectionMenu
                          open={menuId === sec.id}
                          onOpenChange={(o) => setMenuId(o ? sec.id : null)}
                          onView={() => {
                            openDoc(rows.find((r) => r.fileDataUrl) ?? rows[0], sec.id);
                            setMenuId(null);
                          }}
                          onDownload={() => {
                            const d = rows.find((r) => r.fileDataUrl);
                            if (d?.fileDataUrl) triggerDataUrlDownload(d.fileDataUrl, d.fileName);
                            else toast("No file to download", "error");
                            setMenuId(null);
                          }}
                        />
                      </div>
                    </div>
                    {rows.length > 1 ? (
                      <ul className="mt-2 space-y-1 border-t border-border/50 pt-2">
                        {rows.map((d) => (
                          <li key={d.id}>
                            <button
                              type="button"
                              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-xs hover:bg-muted/50"
                              onClick={() => openDoc(d, sec.id)}
                            >
                              <span className="truncate">{d.fileName}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {d.verifyStatus}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })}

              <article className="rounded-xl border border-border/70 bg-background px-3 py-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
                    <Shield className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Policies Accepted</p>
                      <Badge variant={signedRequired && signedRequired === requiredPolicies.length ? "success" : "secondary"} className="text-[10px]">
                        {signedRequired} / {requiredPolicies.length} Signed
                      </Badge>
                    </div>
                    {requiredPolicies.length === 0 ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        No active onboarding policies for this company.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {requiredPolicies.map((policy) => {
                          const signed = selected ? isPolicySigned(selected, policy) : false;
                          const doc = selected ? signedDocForPolicy(selected, policy) : undefined;
                          return (
                            <li
                              key={policy.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2"
                            >
                              <span className="truncate text-sm">{policy.title}</span>
                              <div className="flex shrink-0 items-center gap-2">
                                {signed ? (
                                  <Badge variant="success" className="text-[10px]">
                                    <CheckCircle2 className="size-3" />
                                    Signed
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Missing
                                  </Badge>
                                )}
                                {doc?.fileDataUrl ? (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    className="cursor-pointer"
                                    onClick={() => setPreview({ kind: "policy", doc })}
                                  >
                                    View
                                  </Button>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </article>

              {selected.offboardingDocs.length > 0 ? (
                <article className="rounded-xl border border-border/70 bg-background px-3 py-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
                      <UserMinus className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Offboarding</p>
                      <p className="text-[11px] text-muted-foreground">
                        Exit / relieving documents
                        {selected.offboardingCaseCode ? ` · ${selected.offboardingCaseCode}` : ""}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {selected.offboardingDocs.map((d) => (
                          <li key={d.id} className="rounded-lg border border-border/60 px-2.5 py-2 text-sm">
                            <p className="font-medium">{d.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {d.docType.replace(/_/g, " ")}
                              {d.fileName ? ` · ${d.fileName}` : ""}
                              {d.uploadedAt ? ` · ${formatUploaded(d.uploadedAt)}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ) : null}
            </div>
          )}
        </section>

        {previewOpen && previewDoc?.fileDataUrl ? (
          <aside
            className="relative flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
            style={{ width: previewWidth }}
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize document preview"
              className="absolute inset-y-0 left-0 z-10 flex w-2 cursor-col-resize items-center justify-center hover:bg-primary/15"
              onPointerDown={onResizePointerDown}
              onPointerMove={onResizePointerMove}
              onPointerUp={onResizePointerUp}
              onPointerCancel={onResizePointerUp}
            >
              <GripVertical className="size-3 text-muted-foreground" />
            </div>
            <div className="flex items-start justify-between gap-2 border-b border-border/60 py-2.5 pr-2 pl-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{previewDoc.fileName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatUploaded(previewDoc.uploadedAt) || "—"}
                  {" · "}
                  {formatBytes(previewBytes)}
                  {" · "}
                  {previewDoc.verifyStatus || "pending"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="cursor-pointer"
                  title="Big view"
                  onClick={() => setBigView(true)}
                >
                  <Maximize2 className="size-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="cursor-pointer"
                  title="Close preview"
                  onClick={() => {
                    setPreview(null);
                    setBigView(false);
                  }}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="erp-scroll min-h-0 flex-1 overflow-auto p-2">
              <DocumentPreviewContent
                fileName={previewDoc.fileName}
                dataUrl={previewDoc.fileDataUrl}
                mimeType={previewDoc.mimeType}
                frameClassName="max-h-[52vh]"
              />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border/60 p-3">
              <Button size="sm" className="cursor-pointer" onClick={downloadPreview}>
                <Download className="size-3.5" />
                Download
              </Button>
              <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setBigView(true)}>
                <Maximize2 className="size-3.5" />
                Big view
              </Button>
            </div>
          </aside>
        ) : null}
      </div>

      {bigView && previewDoc?.fileDataUrl ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{previewDoc.fileName}</p>
              <p className="text-[11px] text-muted-foreground">
                {selected?.name ?? "Document"}
                {" · "}
                {formatBytes(previewBytes)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="outline" className="cursor-pointer" onClick={downloadPreview}>
                <Download className="size-3.5" />
                Download
              </Button>
              <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setBigView(false)}>
                <X className="size-3.5" />
                Close
              </Button>
            </div>
          </div>
          <div className="erp-scroll min-h-0 flex-1 overflow-auto p-4">
            <DocumentPreviewContent
              fileName={previewDoc.fileName}
              dataUrl={previewDoc.fileDataUrl}
              mimeType={previewDoc.mimeType}
              frameClassName="max-h-[calc(100vh-7rem)]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ src, name }: { src?: string; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-10 shrink-0 rounded-full border border-border/60 object-cover" />
    );
  }
  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
      {initials(name)}
    </span>
  );
}

function CompletionRing({ pct, label }: { pct: number; label: string }) {
  const size = 44;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${pct}% · ${label} docs`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={ringColor(pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[9px] font-bold tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "verified" | "pending" | "missing" }) {
  if (status === "verified") {
    return (
      <Badge variant="success" className="text-[10px]">
        <CheckCircle2 className="size-3" />
        Verified
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="warning" className="text-[10px]">
        <Clock3 className="size-3" />
        Pending Verification
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      Missing
    </Badge>
  );
}

function SectionMenu({
  open,
  onOpenChange,
  onView,
  onDownload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onView: () => void;
  onDownload: () => void;
}) {
  return (
    <RowActionsMenu open={open} onOpenChange={onOpenChange} buttonSize="icon-xs">
      <RowActionsItem onClick={onView}>View</RowActionsItem>
      <RowActionsItem onClick={onDownload}>Download</RowActionsItem>
    </RowActionsMenu>
  );
}

export function bundlesPush(
  byEmail: Map<string, EmployeeDocBundle>,
  byEmpId: Map<string, EmployeeDocBundle>,
  bundle: EmployeeDocBundle,
) {
  if (bundle.employeeId) byEmpId.set(bundle.employeeId, bundle);
  if (bundle.email) byEmail.set(bundle.email, bundle);
  else byEmpId.set(bundle.key, bundle);
}
