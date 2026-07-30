"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { EmsFormGrid, EmsStepper } from "@/components/hr/workforce/ems-primitives";
import { SetupField, SetupInput, SetupSelect, SetupTextarea } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { loadEmployeeIdConfig, saveEmployeeIdConfig } from "@/config/employee-id";
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
  previewNextEmployeeCode,
  readFileAsDataUrl,
  uniquenessSnapshot,
} from "@/services/employee-management-service";
import { listSalaryStructureOptions } from "@/services/hr-master-connector";
import type { EmployeeDocumentItem, EmployeeWizardDraft } from "@/types/employee-management";
import { emptyWizardDraft } from "@/types/employee-management";

const STEPS = [
  { id: "personal", label: "Personal" },
  { id: "employment", label: "Employment" },
  { id: "gov", label: "Government IDs" },
  { id: "bank", label: "Bank" },
  { id: "salary", label: "Salary" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review" },
];

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

  const load = useCallback(async () => {
    const { records: rows, options: opts } = await loadEmployeeDirectory();
    setRecords(rows);
    setOptions(opts);
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
          salary: { ...src.extension.salary },
          documents: [],
        });
      }
    }
  }, [duplicateId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      if (!draft.employment.branchId && !options?.branches[0]) e.push("Branch is required");
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
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast("Photo max 5 MB", "error");
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
      toast("Max file size 5 MB", "error");
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
    };
    setDraft((d) => ({ ...d, documents: [...d.documents, item] }));
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
        title="Add employee"
        description="Guided wizard — personal, employment, compliance, bank, optional payroll, and documents."
        actions={
          <Link href="/hr/workforce">
            <Button variant="outline" size="sm" className="cursor-pointer">
              <ArrowLeft className="size-3.5" />
              Back to directory
            </Button>
          </Link>
        }
      />

      <EmsStepper steps={STEPS} current={step} />

      {stepErrors.length && step < 6 ? (
        <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {stepErrors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        {step === 0 ? (
          <div className="space-y-4">
            <SetupField label="Profile photo">
              <input type="file" accept="image/*" className="cursor-pointer text-xs" onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)} />
            </SetupField>
            <EmsFormGrid>
              <SetupField label="First name" required>
                <SetupInput value={draft.personal.firstName} onChange={(e) => patchPersonal({ firstName: e.target.value })} />
              </SetupField>
              <SetupField label="Middle name">
                <SetupInput value={draft.personal.middleName} onChange={(e) => patchPersonal({ middleName: e.target.value })} />
              </SetupField>
              <SetupField label="Last name" required>
                <SetupInput value={draft.personal.lastName} onChange={(e) => patchPersonal({ lastName: e.target.value })} />
              </SetupField>
              <SetupField label="Gender">
                <SetupSelect value={draft.personal.gender} onChange={(e) => patchPersonal({ gender: e.target.value })}>
                  <option value="">Select</option>
                  {["male", "female", "other", "prefer_not_to_say"].map((g) => (
                    <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Date of birth">
                <SetupInput type="date" value={draft.personal.dateOfBirth} onChange={(e) => patchPersonal({ dateOfBirth: e.target.value })} />
              </SetupField>
              <SetupField label="Marital status">
                <SetupSelect value={draft.personal.maritalStatus} onChange={(e) => patchPersonal({ maritalStatus: e.target.value })}>
                  <option value="">Select</option>
                  {["single", "married", "divorced", "widowed"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Blood group">
                <SetupInput value={draft.personal.bloodGroup} onChange={(e) => patchPersonal({ bloodGroup: e.target.value })} />
              </SetupField>
              <SetupField label="Nationality">
                <SetupInput value={draft.personal.nationality} onChange={(e) => patchPersonal({ nationality: e.target.value })} />
              </SetupField>
              <SetupField label="Mobile" required>
                <SetupInput value={draft.personal.mobile} onChange={(e) => patchPersonal({ mobile: e.target.value })} />
              </SetupField>
              <SetupField label="Alternate mobile">
                <SetupInput value={draft.personal.alternateMobile} onChange={(e) => patchPersonal({ alternateMobile: e.target.value })} />
              </SetupField>
              <SetupField label="Official email" required>
                <SetupInput type="email" value={draft.personal.officialEmail} onChange={(e) => patchPersonal({ officialEmail: e.target.value })} />
              </SetupField>
              <SetupField label="Personal email">
                <SetupInput type="email" value={draft.personal.personalEmail} onChange={(e) => patchPersonal({ personalEmail: e.target.value })} />
              </SetupField>
            </EmsFormGrid>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">Current address</h3>
            <EmsFormGrid>
              <SetupField label="Address">
                <SetupInput value={draft.personal.currentAddress.line1} onChange={(e) => patchPersonal({ currentAddress: { ...draft.personal.currentAddress, line1: e.target.value } })} />
              </SetupField>
              <SetupField label="City">
                <SetupInput value={draft.personal.currentAddress.city} onChange={(e) => patchPersonal({ currentAddress: { ...draft.personal.currentAddress, city: e.target.value } })} />
              </SetupField>
              <SetupField label="State">
                <SetupInput value={draft.personal.currentAddress.state} onChange={(e) => patchPersonal({ currentAddress: { ...draft.personal.currentAddress, state: e.target.value } })} />
              </SetupField>
              <SetupField label="Country">
                <SetupInput value={draft.personal.currentAddress.country} onChange={(e) => patchPersonal({ currentAddress: { ...draft.personal.currentAddress, country: e.target.value } })} />
              </SetupField>
              <SetupField label="Pincode">
                <SetupInput value={draft.personal.currentAddress.pincode} onChange={(e) => patchPersonal({ currentAddress: { ...draft.personal.currentAddress, pincode: e.target.value } })} />
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
              <SetupField label="Emergency contact name">
                <SetupInput value={draft.personal.emergency.name} onChange={(e) => patchPersonal({ emergency: { ...draft.personal.emergency, name: e.target.value } })} />
              </SetupField>
              <SetupField label="Emergency phone">
                <SetupInput value={draft.personal.emergency.phone} onChange={(e) => patchPersonal({ emergency: { ...draft.personal.emergency, phone: e.target.value } })} />
              </SetupField>
              <SetupField label="Relationship">
                <SetupInput value={draft.personal.emergency.relationship} onChange={(e) => patchPersonal({ emergency: { ...draft.personal.emergency, relationship: e.target.value } })} />
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
              <SetupField label="Joining date" required>
                <SetupInput type="date" value={draft.employment.joiningDate} onChange={(e) => patchEmployment({ joiningDate: e.target.value })} />
              </SetupField>
              <SetupField label="Branch">
                <SetupSelect
                  value={draft.employment.branchId}
                  onChange={(e) => {
                    const id = e.target.value;
                    patchEmployment({
                      branchId: id,
                      branchName: options?.branches.find((b) => b.id === id)?.label ?? "",
                    });
                  }}
                >
                  <option value="">Select</option>
                  {options?.branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Department">
                <SetupSelect
                  value={draft.employment.departmentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    patchEmployment({
                      departmentId: id,
                      departmentName: options?.departments.find((d) => d.id === id)?.label ?? "",
                    });
                  }}
                >
                  <option value="">Select</option>
                  {options?.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Designation">
                <SetupSelect
                  value={draft.employment.designationId}
                  onChange={(e) => {
                    const id = e.target.value;
                    patchEmployment({
                      designationId: id,
                      designationName: options?.designations.find((d) => d.id === id)?.label ?? "",
                    });
                  }}
                >
                  <option value="">Select or type below</option>
                  {options?.designations.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </SetupSelect>
                <SetupInput
                  className="mt-1"
                  placeholder="Designation name"
                  value={draft.employment.designationName}
                  onChange={(e) => patchEmployment({ designationName: e.target.value })}
                />
              </SetupField>
              <SetupField label="Location">
                <SetupInput value={draft.employment.location} onChange={(e) => patchEmployment({ location: e.target.value })} />
              </SetupField>
              <SetupField label="Employment type">
                <SetupSelect value={draft.employment.employmentType} onChange={(e) => patchEmployment({ employmentType: e.target.value })}>
                  {["permanent", "contract", "intern", "consultant"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Reporting manager">
                <SetupSelect
                  value={draft.employment.reportingManagerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    patchEmployment({
                      reportingManagerId: id,
                      reportingManagerName: options?.managers.find((m) => m.id === id)?.label.split(" (")[0] ?? "",
                    });
                  }}
                >
                  <option value="">None</option>
                  {options?.managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </SetupSelect>
              </SetupField>
              <SetupField label="Grade">
                <SetupInput value={draft.employment.grade} onChange={(e) => patchEmployment({ grade: e.target.value })} />
              </SetupField>
              <SetupField label="Job level">
                <SetupInput value={draft.employment.jobLevel} onChange={(e) => patchEmployment({ jobLevel: e.target.value })} />
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
              <SetupField label="Probation (days)">
                <SetupInput value={draft.employment.probationPeriodDays} onChange={(e) => patchEmployment({ probationPeriodDays: e.target.value })} />
              </SetupField>
              <SetupField label="Confirmation date">
                <SetupInput type="date" value={draft.employment.confirmationDate} onChange={(e) => patchEmployment({ confirmationDate: e.target.value })} />
              </SetupField>
              <SetupField label="Employee status">
                <SetupSelect value={draft.employment.lifecycleStatus} onChange={(e) => patchEmployment({ lifecycleStatus: e.target.value as EmployeeWizardDraft["employment"]["lifecycleStatus"] })}>
                  {["active", "inactive", "probation", "notice", "resigned"].map((s) => (
                    <option key={s} value={s}>{s}</option>
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
          <SalaryStep draft={draft} setDraft={setDraft} />
        ) : null}
        {step === 5 ? (
          <DocumentsStep draft={draft} setDraft={setDraft} onAdd={addDocument} />
        ) : null}
        {step === 6 ? (
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
  return (
    <EmsFormGrid>
      {(
        [
          ["Aadhaar", "aadhaar"],
          ["PAN", "pan"],
          ["Passport", "passport"],
          ["Driving license", "drivingLicense"],
          ["UAN", "uan"],
          ["ESIC", "esic"],
          ["Voter ID", "voterId"],
        ] as const
      ).map(([label, key]) => (
        <SetupField key={key} label={label}>
          <SetupInput value={g[key]} onChange={(e) => set({ [key]: e.target.value })} />
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
      <SetupField label="Account holder name">
        <SetupInput value={b.accountHolderName} onChange={(e) => set({ accountHolderName: e.target.value })} />
      </SetupField>
      <SetupField label="Bank name">
        <SetupInput value={b.bankName} onChange={(e) => set({ bankName: e.target.value })} />
      </SetupField>
      <SetupField label="Branch name">
        <SetupInput value={b.branchName} onChange={(e) => set({ branchName: e.target.value })} />
      </SetupField>
      <SetupField label="Account number">
        <SetupInput value={b.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} />
      </SetupField>
      <SetupField label="Confirm account number">
        <SetupInput value={b.confirmAccountNumber} onChange={(e) => set({ confirmAccountNumber: e.target.value })} />
      </SetupField>
      <SetupField label="IFSC">
        <SetupInput value={b.ifsc} onChange={(e) => set({ ifsc: e.target.value.toUpperCase() })} />
      </SetupField>
      <SetupField label="Swift">
        <SetupInput value={b.swift} onChange={(e) => set({ swift: e.target.value })} />
      </SetupField>
      <SetupField label="UPI ID">
        <SetupInput value={b.upiId} onChange={(e) => set({ upiId: e.target.value })} />
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
}: {
  draft: EmployeeWizardDraft;
  setDraft: Dispatch<SetStateAction<EmployeeWizardDraft>>;
  onAdd: (file: File, type: string) => Promise<void>;
}) {
  const types = [
    "Resume",
    "Photo",
    "PAN",
    "Aadhaar",
    "Cancelled Cheque",
    "Graduation Certificate",
    "Appointment Letter",
    "Relieving Letter",
    "Salary Slips",
    "Previous Employer Certificate",
    "Work Experience",
    "Signature",
    "Passport",
    "Other",
  ];
  return (
    <div className="space-y-3">
      {types.map((t) => (
        <SetupField key={t} label={t}>
          <input
            type="file"
            className="cursor-pointer text-xs"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onAdd(f, t);
            }}
          />
        </SetupField>
      ))}
      <ul className="text-xs space-y-1">
        {draft.documents.map((d) => (
          <li key={d.id} className="flex justify-between rounded border border-border/60 px-2 py-1">
            <span>{d.documentType}: {d.fileName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewStep({ draft }: { draft: EmployeeWizardDraft }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 text-xs">
      <ReviewBlock title="Personal" lines={[
        `${draft.personal.firstName} ${draft.personal.lastName}`,
        draft.personal.officialEmail,
        draft.personal.mobile,
      ]} />
      <ReviewBlock title="Employment" lines={[
        draft.employment.employeeCode,
        draft.employment.designationName,
        draft.employment.joiningDate,
        draft.employment.lifecycleStatus,
      ]} />
      <ReviewBlock title="Government IDs" lines={[draft.governmentIds.pan, draft.governmentIds.aadhaar].filter(Boolean)} />
      <ReviewBlock title="Bank" lines={[draft.bank.bankName, draft.bank.ifsc].filter(Boolean)} />
      <ReviewBlock title="Salary" lines={[draft.salary.ctc ? `CTC ${draft.salary.ctc}` : "Skipped"]} />
      <ReviewBlock title="Documents" lines={[ `${draft.documents.length} file(s)` ]} />
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
