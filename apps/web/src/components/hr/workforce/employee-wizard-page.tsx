"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Eye, FolderOpen } from "lucide-react";

import { EmsFormGrid, EmsStepper } from "@/components/hr/workforce/ems-primitives";
import { SetupDrawer, SetupField, SetupInput, SetupSelect, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { COUNTRY_OPTIONS, INDIA_STATE_OPTIONS } from "@/config/geo-options";
import { loadEmployeeIdConfig, saveEmployeeIdConfig } from "@/config/employee-id";
import { portalToWizardDraft, summarizePortalDetails } from "@/lib/onboarding-to-employee";
import { resolveOrgHeadsForEmployment } from "@/lib/hr/org-heads";
import {
  findUniquenessConflicts,
  validateAadhaar,
  validateBankAccount,
  validateEmail,
  validateIfsc,
  validateMobile,
  validatePan,
} from "@/lib/employee-validators";
import {
  ALLOWED_DOC_TYPES,
  createEmployeeFromWizard,
  getEmployeeById,
  loadEmployeeDirectory,
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
  previewNextEmployeeCode,
  readFileAsDataUrl,
  uniquenessSnapshot,
} from "@/services/employee-management-service";
import { loadOnboardingDirectory } from "@/services/onboarding-management-service";
import { listSalaryStructureOptions } from "@/services/hr-master-connector";
import { listEntityOptions } from "@/services/hr-setup-service";
import type { OnboardingCase } from "@/types/onboarding-management";
import type { EmployeeDocumentItem, EmployeeWizardDraft, EducationEntry, PreviousEmploymentEntry } from "@/types/employee-management";
import {
  emptyBank,
  emptyEducationEntry,
  emptyPreviousEmploymentEntry,
  emptyWizardDraft,
} from "@/types/employee-management";
import { ONBOARDING_STATUS_LABELS } from "@/types/onboarding-management";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  LIFECYCLE_STATUS_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RELATIONSHIP_OPTIONS,
  employmentDurationKind,
} from "@/config/hr-master-options";

const STEPS = [
  { id: "personal", label: "Personal" },
  { id: "employment", label: "Employment" },
  { id: "gov", label: "Government IDs" },
  { id: "bank", label: "Bank" },
  { id: "education", label: "Education" },
  { id: "previous", label: "Previous job" },
  { id: "salary", label: "Salary" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" },
];

const CUSTOM_DESIGNATION_VALUE = "__custom_designation__";

export function EmployeeWizardPage() {
  const router = useRouter();
  const params = useSearchParams();
  const duplicateId = params.get("duplicate");

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<EmployeeWizardDraft>(() =>
    emptyWizardDraft(previewNextEmployeeCode()),
  );
  const [options, setOptions] = useState<Awaited<ReturnType<typeof loadEmployeeDirectory>>["options"] | null>(null);
  const [records, setRecords] = useState<import("@/types/employee-management").EmployeeRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [idConfigOpen, setIdConfigOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingCases, setOnboardingCases] = useState<OnboardingCase[]>([]);
  const [previewCase, setPreviewCase] = useState<OnboardingCase | null>(null);
  const [entityOptions, setEntityOptions] = useState<{ value: string; label: string }[]>([]);

  const load = useCallback(async () => {
    const [{ records: rows, options: opts }, ents] = await Promise.all([
      loadEmployeeDirectory(),
      listEntityOptions(),
    ]);
    setRecords(rows);
    setOptions(opts);
    setEntityOptions(ents);
    if (duplicateId) {
      const src = getEmployeeById(rows, duplicateId);
      if (src) {
        setDraft({
          personal: {
            ...src.extension.personal,
            officialEmail: "",
            mobile: "",
            firstName: `${src.extension.personal.firstName} (Copy)`,
          },
          employment: {
            ...src.extension.employment,
            employeeCode: previewNextEmployeeCode(),
          },
          governmentIds: { ...src.extension.governmentIds, pan: "", aadhaar: "" },
          bank: { ...src.extension.bank, accountNumber: "", confirmAccountNumber: "" },
          companyBank: emptyBank(),
          salary: { ...src.extension.salary },
          documents: [],
          education: [...(src.extension.education ?? [])],
          previousEmployment: [...(src.extension.previousEmployment ?? [])],
        });
      }
    } else {
      setDraft((d) => {
        const branchId = d.employment.branchId || opts.branches[0]?.id || "";
        const departmentId = d.employment.departmentId || opts.departments[0]?.id || "";
        const heads = resolveOrgHeadsForEmployment(branchId, departmentId, opts);
        const entityId = d.employment.entityId || ents[0]?.value || "";
        return {
        ...d,
        employment: {
          ...d.employment,
          joiningDate: d.employment.joiningDate || new Date().toISOString().slice(0, 10),
          entityId,
          entityName: d.employment.entityName || ents.find((e) => e.value === entityId)?.label || "",
          branchId,
          branchName: d.employment.branchName || opts.branches[0]?.label || "",
          departmentId,
          departmentName: d.employment.departmentName || opts.departments[0]?.label || "",
          designationName: d.employment.designationName || opts.designations[0]?.label || "",
          branchHeadName: heads.branchHeadName,
          departmentHeadName: heads.departmentHeadName,
        },
      };
      });
    }
  }, [duplicateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reportingManagerOptions = useMemo(() => {
    const list = options?.managers ?? [];
    const cur = draft.employment.reportingManagerId;
    if (!cur || list.some((m) => m.id === cur)) return list;
    const extra = options?.employees.find((e) => e.id === cur);
    return extra ? [...list, { id: cur, label: extra.label }] : list;
  }, [options?.managers, options?.employees, draft.employment.reportingManagerId]);

  const stepErrors = useMemo(() => {
    const e: string[] = [];
    if (step === 0) {
      if (!draft.personal.firstName.trim()) e.push("First name is required");
      if (!draft.personal.lastName.trim()) e.push("Last name is required");
      const em = validateEmail(draft.personal.officialEmail);
      if (em) e.push(em);
      const mob = validateMobile(draft.personal.mobile);
      if (mob) e.push(mob);
    }
    if (step === 1) {
      if (!draft.employment.joiningDate) e.push("Joining date is required");
      if (!draft.employment.entityId && !entityOptions[0]) e.push("Legal entity is required");
      if (!draft.employment.branchId && !options?.branches[0]) e.push("Branch is required");
      if (!draft.employment.locationId && !draft.employment.location.trim()) {
        e.push("Location is required");
      }
      if (!draft.employment.departmentId && !options?.departments[0]) e.push("Department is required");
      if (!draft.employment.designationName.trim()) e.push("Designation is required");
    }
    if (step === 2) {
      const pan = validatePan(draft.governmentIds.pan);
      if (pan) e.push(pan);
      const aad = validateAadhaar(draft.governmentIds.aadhaar);
      if (aad) e.push(aad);
    }
    if (step === 3) {
      const ifsc = validateIfsc(draft.bank.ifsc);
      if (ifsc) e.push(ifsc);
      const acc = validateBankAccount(draft.bank.accountNumber, draft.bank.confirmAccountNumber);
      if (acc) e.push(acc);
      if (!draft.bank.accountHolderName.trim()) e.push("Account holder name is required");
      if (!draft.bank.bankName.trim()) e.push("Bank name is required");
    }
    if (step === 7) {
      const needed = ["Photo", "PAN", "Aadhaar", "Cancelled Cheque"];
      for (const label of needed) {
        if (!draft.documents.some((d) => d.documentType === label && d.fileName)) {
          e.push(`${label} document is required`);
        }
      }
    }
    e.push(
      ...findUniquenessConflicts(
        {
          employeeCode: draft.employment.employeeCode,
          officialEmail: draft.personal.officialEmail,
          mobile: draft.personal.mobile,
          pan: draft.governmentIds.pan,
          aadhaar: draft.governmentIds.aadhaar,
        },
        uniquenessSnapshot(records),
      ),
    );
    return e;
  }, [step, draft, options, records]);

  function patchPersonal(p: Partial<EmployeeWizardDraft["personal"]>) {
    setDraft((d) => ({ ...d, personal: { ...d.personal, ...p } }));
  }

  function patchEmployment(p: Partial<EmployeeWizardDraft["employment"]>) {
    setDraft((d) => ({ ...d, employment: { ...d.employment, ...p } }));
  }

  async function onPhoto(file: File | null) {
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      toast("Photo max 300 KB", "error");
      return;
    }
    patchPersonal({ profilePhotoDataUrl: await readFileAsDataUrl(file) });
  }

  async function addDocument(file: File, docType: string) {
    if (!ALLOWED_DOC_TYPES.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g)$/i)) {
      toast("Supported: PDF, PNG, JPEG", "error");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast("Max file size 2 MB", "error");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const item: EmployeeDocumentItem = {
      id: crypto.randomUUID(),
      documentType: docType,
      documentNumber: "",
      issueDate: "",
      expiryDate: "",
      fileName: file.name,
      fileDataUrl: dataUrl,
      uploadedBy: "HR User",
      uploadedAt: new Date().toISOString(),
      source: "manual",
    };
    setDraft((d) => ({
      ...d,
      documents: [...d.documents.filter((x) => x.documentType !== docType), item],
    }));
    toast(`${docType} uploaded`, "success");
  }

  function removeDocument(docType: string) {
    setDraft((d) => ({
      ...d,
      documents: d.documents.filter((x) => x.documentType !== docType),
    }));
  }

  async function submit() {
    if (!options) return;
    setSubmitting(true);
    try {
      const created = await createEmployeeFromWizard(draft, options);
      toast(`Employee ${created.employeeCode} created`, "success");
      router.push(`/hr/workforce/${created.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Create failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <SetupToastHost />
      <PageHeader
        title="Add Employee"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                void loadOnboardingDirectory()
                  .then((dir) => {
                    const usable = dir.cases.filter((c) =>
                      ["submitted", "hr_review", "ready_to_join", "joined", "in_progress"].includes(
                        c.status,
                      ),
                    );
                    setOnboardingCases(usable);
                    setPreviewCase(null);
                    setOnboardingOpen(true);
                  })
                  .catch(() => toast("Failed to load onboarding cases", "error"));
              }}
            >
              <FolderOpen className="size-3.5" />
              View / load onboarding details
            </Button>
            <Link href="/hr/workforce">
              <Button variant="outline" size="sm" className="cursor-pointer">
                <ArrowLeft className="size-3.5" />
                Back to directory
              </Button>
            </Link>
            <Link href="/hr/onboarding">
              <Button variant="ghost" size="sm" className="cursor-pointer">
                Onboarding
              </Button>
            </Link>
          </div>
        }
      />

      <SetupDrawer
        open={onboardingOpen}
        onClose={() => {
          setOnboardingOpen(false);
          setPreviewCase(null);
        }}
        title={previewCase ? "Onboarding details" : "Onboarding cases"}
        description={
          previewCase
            ? `${previewCase.candidateName} · ${ONBOARDING_STATUS_LABELS[previewCase.status]}`
            : "See everything filled in the candidate portal, or load it into this form."
        }
        wide
      >
        {!previewCase ? (
          <div className="space-y-2">
            {onboardingCases.length === 0 ? (
              <p className="text-xs text-muted-foreground">No onboarding cases with filled data yet.</p>
            ) : (
              onboardingCases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full cursor-pointer items-start justify-between rounded-lg border border-border/70 px-3 py-2 text-left transition-colors duration-200 hover:bg-muted/40"
                  onClick={() => setPreviewCase(c)}
                >
                  <span>
                    <span className="block text-sm font-medium">{c.candidateName}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {c.caseCode} · {c.candidateEmail} · {c.designation || "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-primary">
                    <Eye className="size-3.5" />
                    {ONBOARDING_STATUS_LABELS[c.status]}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setPreviewCase(null)}
            >
              ← Back to list
            </Button>
            <div className="grid gap-3 sm:grid-cols-2">
              {summarizePortalDetails(previewCase.portal).map((block) => (
                <div key={block.title} className="rounded-lg border border-border/70 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {block.title}
                  </h4>
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {block.lines.length ? (
                      block.lines.map((line) => <li key={line}>{line}</li>)
                    ) : (
                      <li className="text-muted-foreground">—</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
              <Button
                type="button"
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  const mapped = portalToWizardDraft(previewCase);
                  if (options) {
                    const dept = options.departments.find(
                      (d) =>
                        d.label.toLowerCase() === previewCase.department.toLowerCase() ||
                        d.id === previewCase.department,
                    );
                    const branch = options.branches.find(
                      (b) =>
                        b.label.toLowerCase() === previewCase.branch.toLowerCase() ||
                        b.id === previewCase.branch,
                    );
                    mapped.employment.departmentId =
                      mapped.employment.departmentId || dept?.id || options.departments[0]?.id || "";
                    mapped.employment.departmentName =
                      mapped.employment.departmentName || dept?.label || previewCase.department;
                    mapped.employment.branchId =
                      mapped.employment.branchId || branch?.id || options.branches[0]?.id || "";
                    mapped.employment.branchName =
                      mapped.employment.branchName || branch?.label || previewCase.branch;
                    mapped.employment.designationName =
                      mapped.employment.designationName ||
                      previewCase.designation ||
                      options.designations[0]?.label ||
                      "";
                  }
                  setDraft(mapped);
                  setStep(0);
                  setOnboardingOpen(false);
                  setPreviewCase(null);
                  toast("Onboarding details loaded into the form", "success");
                }}
              >
                Use these details
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setPreviewCase(null)}
              >
                Close preview
              </Button>
            </div>
          </div>
        )}
      </SetupDrawer>

      <EmsStepper steps={STEPS} current={step} />

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        {step === 0 ? (
          <div className="space-y-4">
            <SetupField label="Profile photo" hint="JPG/PNG · max 5 MB">
              <div className="space-y-1">
                <input
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png"
                  className="cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1"
                  onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
                />
                {draft.personal.profilePhotoDataUrl ? (
                  <p className="text-[11px] text-muted-foreground">Photo selected</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No file chosen</p>
                )}
              </div>
            </SetupField>
            <EmsFormGrid>
              <SetupField label="First name" required>
                <SetupInput
                  placeholder="e.g. Anil"
                  value={draft.personal.firstName}
                  onChange={(e) => patchPersonal({ firstName: e.target.value })}
                />
              </SetupField>
              <SetupField label="Middle name">
                <SetupInput
                  placeholder="Optional"
                  value={draft.personal.middleName}
                  onChange={(e) => patchPersonal({ middleName: e.target.value })}
                />
              </SetupField>
              <SetupField label="Last name" required>
                <SetupInput
                  placeholder="e.g. Kumar"
                  value={draft.personal.lastName}
                  onChange={(e) => patchPersonal({ lastName: e.target.value })}
                />
              </SetupField>
              <SetupField label="Gender">
                <SetupSelect value={draft.personal.gender} onChange={(e) => patchPersonal({ gender: e.target.value })}>
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Date of birth">
                <SetupInput type="date" value={draft.personal.dateOfBirth} onChange={(e) => patchPersonal({ dateOfBirth: e.target.value })} />
              </SetupField>
              <SetupField label="Marital status">
                <SetupSelect value={draft.personal.maritalStatus} onChange={(e) => patchPersonal({ maritalStatus: e.target.value })}>
                  <option value="">Select status</option>
                  {MARITAL_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Blood group">
                <SetupInput
                  placeholder="e.g. B+"
                  value={draft.personal.bloodGroup}
                  onChange={(e) => patchPersonal({ bloodGroup: e.target.value })}
                />
              </SetupField>
              <SetupField label="Nationality">
                <SetupInput
                  placeholder="e.g. Indian"
                  value={draft.personal.nationality}
                  onChange={(e) => patchPersonal({ nationality: e.target.value })}
                />
              </SetupField>
              <SetupField label="Emp. Contact No." required>
                <SetupInput
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  value={draft.personal.mobile}
                  onChange={(e) => patchPersonal({ mobile: e.target.value })}
                />
              </SetupField>
              <SetupField label="Alternate mobile">
                <SetupInput
                  placeholder="Optional alternate number"
                  inputMode="numeric"
                  value={draft.personal.alternateMobile}
                  onChange={(e) => patchPersonal({ alternateMobile: e.target.value })}
                />
              </SetupField>
              <SetupField label="cache email id" required>
                <SetupInput
                  type="email"
                  placeholder="name@cache.com"
                  value={draft.personal.officialEmail}
                  onChange={(e) => patchPersonal({ officialEmail: e.target.value })}
                />
              </SetupField>
              <SetupField label="Email id">
                <SetupInput
                  type="email"
                  placeholder="name@gmail.com"
                  value={draft.personal.personalEmail}
                  onChange={(e) => patchPersonal({ personalEmail: e.target.value })}
                />
              </SetupField>
            </EmsFormGrid>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Current address</h3>
            <EmsFormGrid>
              <SetupField label="Address">
                <SetupInput
                  placeholder="House / street / area"
                  value={draft.personal.currentAddress.line1}
                  onChange={(e) => patchPersonal({ currentAddress: { ...draft.personal.currentAddress, line1: e.target.value } })}
                />
              </SetupField>
              <SetupField label="City">
                <SetupInput
                  placeholder="e.g. Bengaluru"
                  value={draft.personal.currentAddress.city}
                  onChange={(e) => patchPersonal({ currentAddress: { ...draft.personal.currentAddress, city: e.target.value } })}
                />
              </SetupField>
              <SetupField label="State">
                <SearchableSelect
                  value={draft.personal.currentAddress.state}
                  onChange={(state) =>
                    patchPersonal({
                      currentAddress: { ...draft.personal.currentAddress, state },
                    })
                  }
                  options={INDIA_STATE_OPTIONS}
                  placeholder="Select state…"
                  searchPlaceholder="Search state…"
                />
              </SetupField>
              <SetupField label="Country">
                <SearchableSelect
                  value={draft.personal.currentAddress.country}
                  onChange={(country) =>
                    patchPersonal({
                      currentAddress: { ...draft.personal.currentAddress, country },
                    })
                  }
                  options={COUNTRY_OPTIONS}
                  placeholder="Select country…"
                  searchPlaceholder="Search country…"
                />
              </SetupField>
              <SetupField label="Pincode">
                <SetupInput
                  placeholder="6-digit pincode"
                  inputMode="numeric"
                  value={draft.personal.currentAddress.pincode}
                  onChange={(e) => patchPersonal({ currentAddress: { ...draft.personal.currentAddress, pincode: e.target.value } })}
                />
              </SetupField>
            </EmsFormGrid>
            <SetupField label="Permanent address (same fields)">
              <SetupTextarea
                value={draft.personal.permanentAddress.line1}
                placeholder="Line 1, city, state — or copy from current"
                onChange={(e) => patchPersonal({ permanentAddress: { ...draft.personal.permanentAddress, line1: e.target.value } })}
              />
            </SetupField>
            <EmsFormGrid>
              <SetupField label="Family Member Name">
                <SetupInput
                  placeholder="Full name"
                  value={draft.personal.emergency.name}
                  onChange={(e) => patchPersonal({ emergency: { ...draft.personal.emergency, name: e.target.value } })}
                />
              </SetupField>
              <SetupField label="Contact No.">
                <SetupInput
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  value={draft.personal.emergency.phone}
                  onChange={(e) => patchPersonal({ emergency: { ...draft.personal.emergency, phone: e.target.value } })}
                />
              </SetupField>
              <SetupField label="Relation">
                <SetupSelect
                  value={draft.personal.emergency.relationship}
                  onChange={(e) => patchPersonal({ emergency: { ...draft.personal.emergency, relationship: e.target.value } })}
                >
                  <option value="">Select relationship</option>
                  {RELATIONSHIP_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Fathers name">
                <SetupInput
                  placeholder="Father's full name"
                  value={draft.personal.fatherName || ""}
                  onChange={(e) => patchPersonal({ fatherName: e.target.value })}
                />
              </SetupField>
            </EmsFormGrid>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <SetupField label="Employee ID" hint="Auto-generated · configurable">
                <SetupInput
                  value={draft.employment.employeeCode}
                  onChange={(e) => patchEmployment({ employeeCode: e.target.value })}
                />
              </SetupField>
              <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => setIdConfigOpen((v) => !v)}>
                ID format
              </Button>
            </div>
            {idConfigOpen ? (
              <IdConfigPanel
                onApplied={(code) => {
                  patchEmployment({ employeeCode: code });
                  setIdConfigOpen(false);
                }}
              />
            ) : null}
            <EmsFormGrid>
              <SetupField label="Legal entity" required hint="HR Setup → Legal Entities">
                <SetupSelect
                  value={draft.employment.entityId}
                  onChange={(e) => {
                    const id = e.target.value;
                    patchEmployment({
                      entityId: id,
                      entityName: entityOptions.find((x) => x.value === id)?.label ?? "",
                    });
                  }}
                >
                  <option value="">Select entity…</option>
                  {entityOptions.map((ent) => (
                    <option key={ent.value} value={ent.value}>
                      {ent.label}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Joining date" required>
                <SetupInput type="date" value={draft.employment.joiningDate} onChange={(e) => patchEmployment({ joiningDate: e.target.value })} />
              </SetupField>
              <SetupField label="Branch" required>
                <SetupSelect
                  value={draft.employment.branchId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const heads = options
                      ? resolveOrgHeadsForEmployment(
                          id,
                          draft.employment.departmentId,
                          options,
                        )
                      : { branchHeadName: "", departmentHeadName: "" };
                    patchEmployment({
                      branchId: id,
                      branchName: options?.branches.find((b) => b.id === id)?.label ?? "",
                      locationId: "",
                      location: "",
                      branchHeadName: heads.branchHeadName,
                      departmentHeadName: heads.departmentHeadName,
                    });
                  }}
                >
                  <option value="">Select branch</option>
                  {options?.branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Department" required>
                <SetupSelect
                  value={draft.employment.departmentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const heads = options
                      ? resolveOrgHeadsForEmployment(
                          draft.employment.branchId,
                          id,
                          options,
                        )
                      : { branchHeadName: "", departmentHeadName: "" };
                    patchEmployment({
                      departmentId: id,
                      departmentName: options?.departments.find((d) => d.id === id)?.label ?? "",
                      branchHeadName: heads.branchHeadName,
                      departmentHeadName: heads.departmentHeadName,
                    });
                  }}
                >
                  <option value="">Select department</option>
                  {options?.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Branch head" hint="Set in HR Setup → Branches">
                <SetupInput readOnly value={draft.employment.branchHeadName || "—"} />
              </SetupField>
              <SetupField label="Department head" hint="Set in HR Setup → Departments">
                <SetupInput readOnly value={draft.employment.departmentHeadName || "—"} />
              </SetupField>
              <SetupField label="Designation" required>
                {options?.designations.length ? (
                  <SetupSelect
                    value={
                      draft.employment.designationId ||
                      (draft.employment.designationName.trim() ? CUSTOM_DESIGNATION_VALUE : "")
                    }
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id === CUSTOM_DESIGNATION_VALUE) {
                        patchEmployment({ designationId: "", designationName: "" });
                        return;
                      }
                      patchEmployment({
                        designationId: id,
                        designationName: options?.designations.find((d) => d.id === id)?.label ?? "",
                      });
                    }}
                  >
                    <option value="">Select designation</option>
                    {options.designations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                    <option value={CUSTOM_DESIGNATION_VALUE}>Other (type manually)</option>
                  </SetupSelect>
                ) : null}
                {!options?.designations.length || !draft.employment.designationId ? (
                  <SetupInput
                    className={options?.designations.length ? "mt-1" : undefined}
                    placeholder="e.g. Software Engineer"
                    value={draft.employment.designationName}
                    onChange={(e) =>
                      patchEmployment({ designationName: e.target.value, designationId: "" })
                    }
                  />
                ) : null}
              </SetupField>
              <SetupField label="Location" required>
                <SetupSelect
                  value={draft.employment.locationId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const loc = options?.locations.find((l) => l.id === id);
                    patchEmployment({
                      locationId: id,
                      location: loc?.label ?? "",
                    });
                  }}
                >
                  <option value="">Select location</option>
                  {options?.locations
                    .filter(
                      (loc) =>
                        !draft.employment.branchId || loc.branchId === draft.employment.branchId,
                    )
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.label}
                      </option>
                    ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Management group" hint="Sets shift, calendars, and HRMS features">
                <SetupSelect
                  value={draft.employment.managementGroupId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const grp = options?.managementGroups.find((g) => g.id === id);
                    const shiftLabel = options?.shifts.find((s) => s.id === grp?.shiftId)?.label ?? "";
                    if (
                      draft.employment.shiftId &&
                      grp?.shiftId &&
                      draft.employment.shiftId !== grp.shiftId &&
                      !window.confirm(
                        "Changing management group will update the default attendance shift. Continue?",
                      )
                    ) {
                      return;
                    }
                    patchEmployment({
                      managementGroupId: id,
                      managementGroupName: grp?.label ?? "",
                      employmentType: grp?.employmentType ?? draft.employment.employmentType,
                      shiftId: grp?.shiftId ?? draft.employment.shiftId,
                      shiftName: shiftLabel,
                    });
                  }}
                >
                  <option value="">Select group…</option>
                  {options?.managementGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Employment type">
                <SetupSelect
                  value={draft.employment.employmentType}
                  onChange={(e) => {
                    const next = e.target.value;
                    const kind = employmentDurationKind(next);
                    patchEmployment({
                      employmentType: next,
                      probationPeriodDays: kind === "probation" ? draft.employment.probationPeriodDays : "",
                      trainingDurationDays: kind === "training" ? draft.employment.trainingDurationDays : "",
                    });
                  }}
                >
                  {EMPLOYMENT_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Reporting manager" hint="Only reporting managers (not all employees)">
                <SetupSelect
                  value={draft.employment.reportingManagerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    patchEmployment({
                      reportingManagerId: id,
                      reportingManagerName: reportingManagerOptions.find((m) => m.id === id)?.label.split(" (")[0] ?? "",
                    });
                  }}
                >
                  <option value="">None</option>
                  {reportingManagerOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Grade">
                <SetupInput
                  placeholder="e.g. L2 / Band B"
                  value={draft.employment.grade}
                  onChange={(e) => patchEmployment({ grade: e.target.value })}
                />
              </SetupField>
              <SetupField label="Job level">
                <SetupInput
                  placeholder="e.g. Junior / Mid / Senior"
                  value={draft.employment.jobLevel}
                  onChange={(e) => patchEmployment({ jobLevel: e.target.value })}
                />
              </SetupField>
              <SetupField label="Shift">
                <SetupSelect
                  value={draft.employment.shiftId}
                  onChange={(e) => {
                    const id = e.target.value;
                    patchEmployment({
                      shiftId: id,
                      shiftName: options?.shifts.find((s) => s.id === id)?.label ?? "",
                    });
                  }}
                >
                  <option value="">Select</option>
                  {options?.shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              {employmentDurationKind(draft.employment.employmentType) === "probation" ? (
                <SetupField label="Probation period (days)">
                  <SetupInput
                    placeholder="e.g. 90"
                    inputMode="numeric"
                    value={draft.employment.probationPeriodDays}
                    onChange={(e) => patchEmployment({ probationPeriodDays: e.target.value })}
                  />
                </SetupField>
              ) : null}
              {employmentDurationKind(draft.employment.employmentType) === "training" ? (
                <SetupField label="Training duration (days)">
                  <SetupInput
                    placeholder="e.g. 90"
                    inputMode="numeric"
                    value={draft.employment.trainingDurationDays}
                    onChange={(e) => patchEmployment({ trainingDurationDays: e.target.value })}
                  />
                </SetupField>
              ) : null}
              <SetupField label="Confirmation date">
                <SetupInput type="date" value={draft.employment.confirmationDate} onChange={(e) => patchEmployment({ confirmationDate: e.target.value })} />
              </SetupField>
              <SetupField label="Employee status">
                <SetupSelect value={draft.employment.lifecycleStatus} onChange={(e) => patchEmployment({ lifecycleStatus: e.target.value as EmployeeWizardDraft["employment"]["lifecycleStatus"] })}>
                  {LIFECYCLE_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
            </EmsFormGrid>
          </div>
        ) : null}

        {step === 2 ? (
          <GovIdsStep draft={draft} setDraft={setDraft} />
        ) : null}
        {step === 3 ? (
          <BankStep draft={draft} setDraft={setDraft} />
        ) : null}
        {step === 4 ? (
          <EducationStep draft={draft} setDraft={setDraft} />
        ) : null}
        {step === 5 ? (
          <PreviousEmploymentStep draft={draft} setDraft={setDraft} />
        ) : null}
        {step === 6 ? (
          <SalaryStep draft={draft} setDraft={setDraft} />
        ) : null}
        {step === 7 ? (
          <DocumentsStep
            draft={draft}
            onAdd={addDocument}
            onRemove={removeDocument}
          />
        ) : null}
        {step === 8 ? (
          <ReviewStep draft={draft} />
        ) : null}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => {
              if (stepErrors.length) {
                toast(stepErrors[0], "error");
                return;
              }
              setStep((s) => s + 1);
            }}
          >
            Next
            <ArrowRight className="size-3.5" />
          </Button>
        ) : (
          <Button type="button" className="cursor-pointer" disabled={submitting} onClick={() => void submit()}>
            <Check className="size-3.5" />
            {submitting ? "Creating…" : "Create employee"}
          </Button>
        )}
      </div>
    </div>
  );
}

function IdConfigPanel({ onApplied }: { onApplied: (code: string) => void }) {
  const [cfg, setCfg] = useState(loadEmployeeIdConfig());
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs space-y-2">
      <SetupField label="Format">
        <SetupSelect value={cfg.mode} onChange={(e) => setCfg({ ...cfg, mode: e.target.value as typeof cfg.mode })}>
          <option value="emp_seq">EMP-000001</option>
          <option value="comp_emp">COMP01-EMP000001</option>
        </SetupSelect>
      </SetupField>
      <SetupField label="Prefix">
        <SetupInput value={cfg.prefix} onChange={(e) => setCfg({ ...cfg, prefix: e.target.value })} />
      </SetupField>
      <SetupField label="Company code">
        <SetupInput value={cfg.companyCode} onChange={(e) => setCfg({ ...cfg, companyCode: e.target.value })} />
      </SetupField>
      <Button
        type="button"
        size="sm"
        className="cursor-pointer"
        onClick={() => {
          saveEmployeeIdConfig(cfg);
          onApplied(previewNextEmployeeCode());
        }}
      >
        Apply & regenerate ID
      </Button>
    </div>
  );
}

function GovIdsStep({
  draft,
  setDraft,
}: {
  draft: EmployeeWizardDraft;
  setDraft: Dispatch<SetStateAction<EmployeeWizardDraft>>;
}) {
  const g = draft.governmentIds;
  const set = (p: Partial<typeof g>) => setDraft((d) => ({ ...d, governmentIds: { ...d.governmentIds, ...p } }));
  const fields: { label: string; key: keyof typeof g; required?: boolean; placeholder: string }[] = [
    { label: "Aadhaar", key: "aadhaar", required: true, placeholder: "16-digit Aadhaar" },
    { label: "PAN", key: "pan", required: true, placeholder: "ABCDE1234F" },
    { label: "Passport", key: "passport", placeholder: "Optional passport number" },
    { label: "Driving license", key: "drivingLicense", placeholder: "Optional DL number" },
    { label: "UAN", key: "uan", placeholder: "PF UAN (optional)" },
    { label: "ESIC", key: "esic", placeholder: "ESIC number (optional)" },
    { label: "Voter ID", key: "voterId", placeholder: "Optional voter ID" },
  ];
  return (
    <EmsFormGrid>
      {fields.map(({ label, key, required, placeholder }) => (
        <SetupField key={key} label={label} required={required}>
          <SetupInput
            placeholder={placeholder}
            value={String(g[key] ?? "")}
            onChange={(e) => set({ [key]: e.target.value })}
          />
        </SetupField>
      ))}
      <SetupField label="Issue date">
        <SetupInput type="date" value={g.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
      </SetupField>
      <SetupField label="Expiry date">
        <SetupInput type="date" value={g.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} />
      </SetupField>
    </EmsFormGrid>
  );
}

function BankStep({
  draft,
  setDraft,
}: {
  draft: EmployeeWizardDraft;
  setDraft: Dispatch<SetStateAction<EmployeeWizardDraft>>;
}) {
  const b = draft.bank;
  const set = (p: Partial<typeof b>) => setDraft((d) => ({ ...d, bank: { ...d.bank, ...p } }));
  return (
    <EmsFormGrid>
      <SetupField label="Account holder name" required>
        <SetupInput
          placeholder="Name as on bank account"
          value={b.accountHolderName}
          onChange={(e) => set({ accountHolderName: e.target.value })}
        />
      </SetupField>
      <SetupField label="Bank name" required>
        <SetupInput
          placeholder="e.g. HDFC Bank"
          value={b.bankName}
          onChange={(e) => set({ bankName: e.target.value })}
        />
      </SetupField>
      <SetupField label="Branch name">
        <SetupInput
          placeholder="e.g. Koramangala"
          value={b.branchName}
          onChange={(e) => set({ branchName: e.target.value })}
        />
      </SetupField>
      <SetupField label="Account number" required>
        <SetupInput
          placeholder="9–18 digit account number"
          inputMode="numeric"
          value={b.accountNumber}
          onChange={(e) => set({ accountNumber: e.target.value })}
        />
      </SetupField>
      <SetupField label="Confirm account number" required>
        <SetupInput
          placeholder="Re-enter account number"
          inputMode="numeric"
          value={b.confirmAccountNumber}
          onChange={(e) => set({ confirmAccountNumber: e.target.value })}
        />
      </SetupField>
      <SetupField label="IFSC" required>
        <SetupInput
          placeholder="e.g. HDFC0001234"
          value={b.ifsc}
          onChange={(e) => set({ ifsc: e.target.value.toUpperCase() })}
        />
      </SetupField>
      <SetupField label="Swift">
        <SetupInput
          placeholder="Optional SWIFT code"
          value={b.swift}
          onChange={(e) => set({ swift: e.target.value })}
        />
      </SetupField>
    </EmsFormGrid>
  );
}

function SalaryStep({
  draft,
  setDraft,
}: {
  draft: EmployeeWizardDraft;
  setDraft: Dispatch<SetStateAction<EmployeeWizardDraft>>;
}) {
  const s = draft.salary;
  const set = (p: Partial<typeof s>) => setDraft((d) => ({ ...d, salary: { ...d.salary, ...p } }));
  const structures = listSalaryStructureOptions();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Optional — select a Payroll salary structure when available.
      </p>
      <EmsFormGrid>
        <SetupField label="Basic salary">
          <SetupInput value={s.basicSalary} onChange={(e) => set({ basicSalary: e.target.value })} />
        </SetupField>
        <SetupField label="CTC">
          <SetupInput value={s.ctc} onChange={(e) => set({ ctc: e.target.value })} />
        </SetupField>
        <SetupField label="Salary structure">
          {structures.length > 0 ? (
            <SetupSelect
              value={s.salaryStructure}
              onChange={(e) => {
                const id = e.target.value;
                const opt = structures.find((x) => x.id === id || x.label === id);
                set({ salaryStructure: opt?.label || id });
              }}
            >
              <option value="">Select payroll structure…</option>
              {structures.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </SetupSelect>
          ) : (
            <SetupInput
              value={s.salaryStructure}
              onChange={(e) => set({ salaryStructure: e.target.value })}
              placeholder="Create structures in Payroll first"
            />
          )}
        </SetupField>
        <SetupField label="Payroll group">
          <SetupInput value={s.payrollGroup} onChange={(e) => set({ payrollGroup: e.target.value })} />
        </SetupField>
        <SetupField label="Income tax regime">
          <SetupSelect value={s.incomeTaxRegime} onChange={(e) => set({ incomeTaxRegime: e.target.value })}>
            <option value="new">New</option>
            <option value="old">Old</option>
          </SetupSelect>
        </SetupField>
      </EmsFormGrid>
      <div className="flex flex-wrap gap-4 text-xs">
        {(
          [
            ["PF", "pf"],
            ["ESI", "esi"],
            ["Professional tax", "professionalTax"],
          ] as const
        ).map(([label, key]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={s[key]} onChange={(e) => set({ [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function DocumentsStep({
  draft,
  onAdd,
  onRemove,
}: {
  draft: EmployeeWizardDraft;
  onAdd: (file: File, type: string) => Promise<void>;
  onRemove: (type: string) => void;
}) {
  const types: { label: string; required?: boolean; accept: string }[] = [
    { label: "Photo", required: true, accept: "image/*,.jpg,.jpeg,.png" },
    { label: "PAN", required: true, accept: ".pdf,image/*,.jpg,.jpeg,.png" },
    { label: "Aadhaar", required: true, accept: ".pdf,image/*,.jpg,.jpeg,.png" },
    { label: "Cancelled Cheque", required: true, accept: ".pdf,image/*,.jpg,.jpeg,.png" },
    { label: "Resume", accept: ".pdf,.doc,.docx" },
    { label: "Graduation Certificate", accept: ".pdf,image/*" },
    { label: "Appointment Letter", accept: ".pdf" },
    { label: "Relieving Letter", accept: ".pdf" },
    { label: "Salary Slips", accept: ".pdf,image/*" },
    { label: "Previous Employer Certificate", accept: ".pdf,image/*" },
    { label: "Work Experience", accept: ".pdf,image/*" },
    { label: "Signature", accept: "image/*,.pdf" },
    { label: "Passport", accept: ".pdf,image/*" },
    { label: "Other", accept: ".pdf,image/*" },
  ];

  function latest(type: string) {
    return draft.documents.find((d) => d.documentType === type);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Upload proofs (PDF / JPG / PNG · max 5 MB). Fields marked * are important for hire.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {types.map((t) => {
          const file = latest(t.label);
          return (
            <SetupField key={t.label} label={t.label} required={t.required} hint={file ? undefined : "Choose a file"}>
              <div className="space-y-1.5">
                <input
                  type="file"
                  accept={t.accept}
                  className="block w-full cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onAdd(f, t.label);
                    e.target.value = "";
                  }}
                />
                {file ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px]">
                    <span className="truncate text-foreground">{file.fileName}</span>
                    <button
                      type="button"
                      className="cursor-pointer shrink-0 text-destructive underline-offset-2 hover:underline"
                      onClick={() => onRemove(t.label)}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No file chosen</p>
                )}
              </div>
            </SetupField>
          );
        })}
      </div>
      {draft.documents.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {draft.documents.length} document(s) attached
        </p>
      ) : null}
    </div>
  );
}

function EducationStep({
  draft,
  setDraft,
}: {
  draft: EmployeeWizardDraft;
  setDraft: Dispatch<SetStateAction<EmployeeWizardDraft>>;
}) {
  const rows = draft.education;

  function update(id: string, patch: Partial<EducationEntry>) {
    setDraft((d) => ({
      ...d,
      education: d.education.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  async function onCertificate(id: string, file: File | undefined) {
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g)$/i)) {
      toast("Supported: PDF, PNG, JPEG", "error");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast("Max file size 5 MB", "error");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    update(id, { certificateFileName: file.name, certificateDataUrl: dataUrl });
    toast("Certificate uploaded", "success");
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Optional — add education history and upload marksheets / certificates (PDF or image).
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-xs text-muted-foreground">
          No education records yet. Click “Add education” to start.
        </p>
      ) : (
        rows.map((row, idx) => (
          <div key={row.id} className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                Entry {idx + 1}
                {idx === 0 ? " · e.g. 10th / 12th / Graduation" : ""}
              </p>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="cursor-pointer text-destructive"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    education: d.education.filter((r) => r.id !== row.id),
                  }))
                }
              >
                Remove
              </Button>
            </div>
            <EmsFormGrid>
              <SetupField label="Degree / qualification" required>
                <SetupInput
                  placeholder="e.g. 10th / 12th / B.Tech / MBA"
                  value={row.degree}
                  onChange={(e) => update(row.id, { degree: e.target.value })}
                />
              </SetupField>
              <SetupField label="Institution" required>
                <SetupInput
                  placeholder="School / college name"
                  value={row.institution}
                  onChange={(e) => update(row.id, { institution: e.target.value })}
                />
              </SetupField>
              <SetupField label="Field of study">
                <SetupInput
                  placeholder="e.g. Computer Science"
                  value={row.field}
                  onChange={(e) => update(row.id, { field: e.target.value })}
                />
              </SetupField>
              <SetupField label="Year">
                <SetupInput
                  placeholder="e.g. 2018"
                  inputMode="numeric"
                  value={row.year}
                  onChange={(e) => update(row.id, { year: e.target.value })}
                />
              </SetupField>
              <SetupField label="Grade / marks" required>
                <SetupInput
                  placeholder="e.g. 85% or 8.5 CGPA"
                  value={row.grade}
                  onChange={(e) => update(row.id, { grade: e.target.value })}
                />
              </SetupField>
              <SetupField
                label="Certificate / marksheet"
                hint="PDF or image · max 5 MB"
              >
                <div className="space-y-1.5">
                  <input
                    type="file"
                    accept=".pdf,image/*,.jpg,.jpeg,.png"
                    className="block w-full cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1"
                    onChange={(e) => {
                      void onCertificate(row.id, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {row.certificateFileName ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px]">
                      <span className="truncate">{row.certificateFileName}</span>
                      <button
                        type="button"
                        className="cursor-pointer shrink-0 text-destructive underline-offset-2 hover:underline"
                        onClick={() =>
                          update(row.id, { certificateFileName: "", certificateDataUrl: "" })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No file chosen</p>
                  )}
                </div>
              </SetupField>
            </EmsFormGrid>
          </div>
        ))
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="cursor-pointer"
        onClick={() =>
          setDraft((d) => ({ ...d, education: [...d.education, emptyEducationEntry()] }))
        }
      >
        Add education
      </Button>
    </div>
  );
}

function PreviousEmploymentStep({
  draft,
  setDraft,
}: {
  draft: EmployeeWizardDraft;
  setDraft: Dispatch<SetStateAction<EmployeeWizardDraft>>;
}) {
  const rows = draft.previousEmployment;

  function update(id: string, patch: Partial<PreviousEmploymentEntry>) {
    setDraft((d) => ({
      ...d,
      previousEmployment: d.previousEmployment.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      ),
    }));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Optional — previous employer details are not mandatory for direct hire.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-xs text-muted-foreground">
          No previous employment added.
        </p>
      ) : (
        rows.map((row, idx) => (
          <div key={row.id} className="space-y-3 rounded-lg border border-border/70 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Employer {idx + 1}</p>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="cursor-pointer text-destructive"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    previousEmployment: d.previousEmployment.filter((r) => r.id !== row.id),
                  }))
                }
              >
                Remove
              </Button>
            </div>
            <EmsFormGrid>
              <SetupField label="Company">
                <SetupInput
                  placeholder="Previous company name"
                  value={row.company}
                  onChange={(e) => update(row.id, { company: e.target.value })}
                />
              </SetupField>
              <SetupField label="Designation">
                <SetupInput
                  placeholder="e.g. Software Engineer"
                  value={row.designation}
                  onChange={(e) => update(row.id, { designation: e.target.value })}
                />
              </SetupField>
              <SetupField label="From">
                <SetupInput type="date" value={row.fromDate} onChange={(e) => update(row.id, { fromDate: e.target.value })} />
              </SetupField>
              <SetupField label="To">
                <SetupInput type="date" value={row.toDate} onChange={(e) => update(row.id, { toDate: e.target.value })} />
              </SetupField>
              <SetupField label="Last CTC">
                <SetupInput
                  placeholder="e.g. 8 LPA"
                  value={row.lastCtc}
                  onChange={(e) => update(row.id, { lastCtc: e.target.value })}
                />
              </SetupField>
              <SetupField label="Reason for leaving">
                <SetupInput
                  placeholder="Optional reason"
                  value={row.reasonForLeaving}
                  onChange={(e) => update(row.id, { reasonForLeaving: e.target.value })}
                />
              </SetupField>
            </EmsFormGrid>
          </div>
        ))
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="cursor-pointer"
        onClick={() =>
          setDraft((d) => ({
            ...d,
            previousEmployment: [...d.previousEmployment, emptyPreviousEmploymentEntry()],
          }))
        }
      >
        Add previous employer
      </Button>
    </div>
  );
}

function ReviewStep({ draft }: { draft: EmployeeWizardDraft }) {
  return (
    <div className="grid gap-4 text-xs md:grid-cols-2">
      <ReviewBlock title="Personal" lines={[
        `${draft.personal.firstName} ${draft.personal.lastName}`,
        draft.personal.officialEmail,
        draft.personal.mobile,
      ]} />
      <ReviewBlock title="Employment" lines={[
        draft.employment.employeeCode,
        draft.employment.entityName,
        draft.employment.designationName,
        draft.employment.joiningDate,
        draft.employment.lifecycleStatus,
      ].filter(Boolean)} />
      <ReviewBlock title="Government IDs" lines={[draft.governmentIds.pan, draft.governmentIds.aadhaar].filter(Boolean)} />
      <ReviewBlock title="Bank" lines={[draft.bank.bankName, draft.bank.ifsc].filter(Boolean)} />
      <ReviewBlock
        title="Education"
        lines={[
          draft.education.filter((e) => e.degree || e.institution).length
            ? `${draft.education.filter((e) => e.degree || e.institution).length} record(s)`
            : "Skipped (optional)",
        ]}
      />
      <ReviewBlock
        title="Previous Employment"
        lines={[
          draft.previousEmployment.filter((e) => e.company || e.designation).length
            ? `${draft.previousEmployment.filter((e) => e.company || e.designation).length} employer(s)`
            : "Skipped (optional)",
        ]}
      />
      <ReviewBlock title="Salary" lines={[draft.salary.ctc ? `CTC ${draft.salary.ctc}` : "Skipped"]} />
      <ReviewBlock title="Documents" lines={[`${draft.documents.length} file(s)`]} />
    </div>
  );
}

function ReviewBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <h4 className="font-semibold text-foreground">{title}</h4>
      <ul className="mt-2 space-y-0.5 text-muted-foreground">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
