"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  Contact,
  Download,
  FileText,
  GraduationCap,
  KeyRound,
  Landmark,
  Pencil,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  EmsAvatar,
  EmsFormGrid,
  EmsSkeleton,
  EmsTabBar,
} from "@/components/hr/workforce/ems-primitives";
import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import {
  SetupDrawer,
  SetupField,
  SetupInput,
  SetupSelect,
  SetupTextarea,
} from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  getEmployeeById,
  loadEmployeeDirectory,
  updateEmployeeRecord,
} from "@/services/employee-management-service";
import { ApiClientError, resourceService } from "@/services/api-client";
import { hrEssPoliciesService } from "@/services/hr-ess-policies-service";
import {
  formatEmploymentTypeLabel,
  formatMaritalStatusLabel,
  formatRelationshipLabel,
  EMPLOYMENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  LIFECYCLE_STATUS_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "@/config/hr-master-options";
import type {
  BankDetails,
  EmployeeDocumentItem,
  EmployeeRecord,
  EmployeeWizardDraft,
} from "@/types/employee-management";
import { emptyBank } from "@/types/employee-management";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "employment", label: "Employment" },
  { id: "gov", label: "Government IDs" },
  { id: "bank", label: "Bank" },
  { id: "documents", label: "Documents" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
  { id: "payroll", label: "Payroll" },
  { id: "separation", label: "Offboarding" },
];

type ProfileEditSection =
  | "choose"
  | "personal"
  | "employment"
  | "government"
  | "bank"
  | "salary"
  | "education"
  | "history"
  | "documents";

const EDIT_SECTIONS: {
  id: Exclude<ProfileEditSection, "choose">;
  title: string;
  description: string;
  icon: typeof UserRound;
}[] = [
  { id: "personal", title: "Personal & contact", description: "Identity, contact details, addresses, and emergency contact.", icon: UserRound },
  { id: "employment", title: "Employment", description: "Organisation, role, manager, work location, and status.", icon: Building2 },
  { id: "government", title: "Government IDs", description: "Tax, identity, statutory, and licence details.", icon: ShieldCheck },
  { id: "bank", title: "Bank accounts", description: "Onboarding and company salary account details.", icon: Landmark },
  { id: "salary", title: "Payroll & salary", description: "Salary structure, statutory deductions, and tax setup.", icon: BriefcaseBusiness },
  { id: "education", title: "Education", description: "Qualifications, institutions, and certificates.", icon: GraduationCap },
  { id: "history", title: "Previous employment", description: "Prior employers and work history.", icon: Contact },
  { id: "documents", title: "Documents", description: "Employee documents and file metadata.", icon: FileText },
];

type LinkedData = {
  attendance: Record<string, unknown>[];
  leaveRequests: Record<string, unknown>[];
  leaveBalances: Record<string, unknown>[];
  hrDocuments: Record<string, unknown>[];
  payslips: Record<string, unknown>[];
  salaries: Record<string, unknown>[];
  separation: Record<string, unknown>[];
};

function asRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  }
  return [];
}

function matchesEmployee(row: Record<string, unknown>, employeeId: string, employeeCode: string) {
  const id = String(row.employee_id ?? "");
  const code = String(row.employee_code ?? "");
  return id === employeeId || (employeeCode && code === employeeCode);
}

function bankFilled(b?: BankDetails | null) {
  if (!b) return false;
  return Boolean(b.accountNumber || b.ifsc || b.bankName || b.accountHolderName);
}

function maskAccount(account?: string) {
  if (!account) return "—";
  return account.length <= 4 ? account : `••••${account.slice(-4)}`;
}

function formatAttendanceMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function formatAttendanceTime(value: unknown): string {
  if (value == null || value === "") return "—";
  const s = String(value);
  if (s.length >= 16 && s.includes("T")) return s.slice(11, 16);
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s;
}

async function loadLinkedData(employeeId: string, employeeCode: string): Promise<LinkedData> {
  const [attendance, leaveRequests, leaveBalances, hrDocuments, payslips, salaries, separation] =
    await Promise.all([
      resourceService.list("/hr/attendance", { page_size: 200 }).catch(() => ({ data: [] })),
      resourceService.list("/hr/leave-requests", { page_size: 100 }).catch(() => ({ data: [] })),
      resourceService.list("/hr/leave-balances", { page_size: 100 }).catch(() => ({ data: [] })),
      resourceService.list("/hr/employee-documents", { page_size: 100 }).catch(() => ({ data: [] })),
      resourceService.list("/payroll/payslips", { page_size: 100 }).catch(() => ({ data: [] })),
      resourceService.list("/payroll/employee-salaries", { page_size: 100 }).catch(() => ({ data: [] })),
      resourceService.list("/hr/separation", { page_size: 100 }).catch(() => ({ data: [] })),
    ]);

  const filter = (rows: Record<string, unknown>[]) =>
    rows.filter((r) => matchesEmployee(r, employeeId, employeeCode));

  return {
    attendance: filter(asRows(attendance.data)),
    leaveRequests: filter(asRows(leaveRequests.data)),
    leaveBalances: filter(asRows(leaveBalances.data)),
    hrDocuments: filter(asRows(hrDocuments.data)),
    payslips: filter(asRows(payslips.data)),
    salaries: filter(asRows(salaries.data)),
    separation: filter(asRows(separation.data)),
  };
}

export function EmployeeProfilePage({ employeeId }: { employeeId: string }) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "overview";
  const editMode = searchParams.get("edit") === "1";

  const [record, setRecord] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(
    ["performance", "training", "assets", "activity", "audit", "all-details"].includes(initialTab)
      ? "overview"
      : initialTab,
  );
  const [editOpen, setEditOpen] = useState(editMode);
  const [editSection, setEditSection] = useState<ProfileEditSection>("choose");
  const [draft, setDraft] = useState<EmployeeWizardDraft | null>(null);
  const [linked, setLinked] = useState<LinkedData | null>(null);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [attendanceMonth, setAttendanceMonth] = useState<string>("all");
  const [attendanceStatus, setAttendanceStatus] = useState<"all" | "present" | "absent">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { records } = await loadEmployeeDirectory();
      const found = getEmployeeById(records, employeeId) ?? null;
      setRecord(found);
      if (found) {
        setDraft({
          personal: found.extension.personal,
          employment: found.extension.employment,
          governmentIds: found.extension.governmentIds,
          bank: found.extension.bank,
          companyBank: found.extension.companyBank ?? emptyBank(),
          salary: found.extension.salary,
          documents: found.extension.documents,
          education: found.extension.education ?? [],
          previousEmployment: found.extension.previousEmployment ?? [],
        });
        setLinkedLoading(true);
        try {
          setLinked(await loadLinkedData(found.id, found.employeeCode));
        } finally {
          setLinkedLoading(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!initialTab) return;
    if (["performance", "training", "assets", "activity", "audit"].includes(initialTab)) {
      setTab("overview");
      return;
    }
    setTab(initialTab);
  }, [initialTab]);

  async function saveEdit() {
    if (!record || !draft) return;
    try {
      await updateEmployeeRecord(record, draft);
      toast("Employee updated", "success");
      setEditOpen(false);
      void load();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Update failed", "error");
    }
  }

  async function forceEssPasswordReset() {
    if (!record) return;
    const ok = window.confirm(
      "Require this employee to change their password on the next ESS login?",
    );
    if (!ok) return;
    try {
      await hrEssPoliciesService.forcePasswordReset(record.id);
      toast("ESS password reset required on next login", "success");
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.message : "Force password reset failed",
        "error",
      );
    }
  }

  const attendanceMonthOptions = useMemo(() => {
    const months = new Set<string>();
    for (const r of linked?.attendance ?? []) {
      const ym = String(r.attendance_date ?? "").slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) months.add(ym);
    }
    return Array.from(months).sort().reverse();
  }, [linked?.attendance]);

  const filteredAttendance = useMemo(() => {
    let rows = [...(linked?.attendance ?? [])];
    if (attendanceMonth !== "all") {
      rows = rows.filter((r) => String(r.attendance_date ?? "").startsWith(attendanceMonth));
    }
    if (attendanceStatus !== "all") {
      rows = rows.filter((r) => {
        const st = String(r.attendance_status ?? r.status ?? "").toLowerCase();
        if (attendanceStatus === "present") return st.includes("present");
        return st.includes("absent");
      });
    }
    rows.sort((a, b) =>
      String(b.attendance_date ?? "").localeCompare(String(a.attendance_date ?? "")),
    );
    return rows;
  }, [linked?.attendance, attendanceMonth, attendanceStatus]);

  if (loading && !record) return <EmsSkeleton rows={8} />;

  if (!record) {
    return (
      <HrEmptyState
        title="Employee not found"
        description="This profile may have been archived or you lack access."
        action={
          <Link href="/hr/workforce">
            <Button size="sm" className="cursor-pointer transition-colors duration-200">
              Back to directory
            </Button>
          </Link>
        }
      />
    );
  }

  const companyBank = record.extension.companyBank ?? emptyBank();

  return (
    <div className="space-y-5">
      <SetupToastHost />
      <PageHeader
        title={record.displayName}
        description={`${record.employeeCode} · ${record.designationName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/hr/workforce">
              <Button variant="outline" size="sm" className="cursor-pointer transition-colors duration-200">
                <ArrowLeft className="size-3.5" />
                Directory
              </Button>
            </Link>
            <Button
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => {
                setEditSection("choose");
                setEditOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void forceEssPasswordReset()}
            >
              <KeyRound className="size-3.5" />
              Require ESS password change
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-start">
        <EmsAvatar name={record.displayName} photoUrl={record.profilePhotoDataUrl} size="lg" />
        <div className="min-w-0 flex-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Info label="Employee ID" value={record.employeeCode} />
          <Info
            label="Legal entity"
            value={record.extension.employment.entityName || "—"}
          />
          <Info label="Department" value={record.departmentName} />
          <Info label="Designation" value={record.designationName} />
          <Info label="Reporting manager" value={record.reportingManagerName} />
          <Info label="Branch" value={record.branchName} />
          <Info label="Joined" value={record.joiningDate || "—"} />
          <Info label="Employment type" value={formatEmploymentTypeLabel(record.employmentType)} />
          <Info label="Status" value={<HrStatusBadge status={record.lifecycleStatus} />} />
          <Info label="Email" value={record.officialEmail} />
          <Info label="Phone" value={record.mobile} />
        </div>
      </div>

      <EmsTabBar tabs={TABS} active={tab} onChange={setTab} />

      <div className="min-h-[200px] rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        {tab === "overview" ? (
          <OverviewTab record={record} linked={linked} linkedLoading={linkedLoading} />
        ) : null}

        {tab === "employment" ? (
          <EmsFormGrid>
            <Info
              label="Legal entity"
              value={record.extension.employment.entityName || "—"}
            />
            <Info label="Grade" value={record.extension.employment.grade || "—"} />
            <Info label="Job level" value={record.extension.employment.jobLevel || "—"} />
            <Info label="Shift" value={record.extension.employment.shiftName || "—"} />
            <Info label="Location" value={record.locationName || record.extension.employment.location || "—"} />
            <Info
              label="Probation days"
              value={record.extension.employment.probationPeriodDays || "—"}
            />
            <Info
              label="Confirmation"
              value={record.extension.employment.confirmationDate || "—"}
            />
            <Info label="Department" value={record.departmentName} />
            <Info label="Designation" value={record.designationName} />
            <Info label="Reporting manager" value={record.reportingManagerName} />
            <Info label="Type" value={formatEmploymentTypeLabel(record.employmentType)} />
            <Info label="Joined" value={record.joiningDate || "—"} />
            <Info label="Status" value={record.lifecycleStatus} />
          </EmsFormGrid>
        ) : null}

        {tab === "gov" ? (
          <EmsFormGrid>
            <Info label="Aadhaar" value={record.extension.governmentIds.aadhaar || "—"} />
            <Info label="PAN" value={record.extension.governmentIds.pan || "—"} />
            <Info label="Passport" value={record.extension.governmentIds.passport || "—"} />
            <Info label="UAN" value={record.extension.governmentIds.uan || "—"} />
            <Info label="ESIC" value={record.extension.governmentIds.esic || "—"} />
            <Info label="DL" value={record.extension.governmentIds.drivingLicense || "—"} />
            <Info label="Voter ID" value={record.extension.governmentIds.voterId || "—"} />
          </EmsFormGrid>
        ) : null}

        {tab === "bank" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Onboarding Bank">
              <p className="mb-2 text-xs text-muted-foreground">
                Account details provided by the employee during onboarding / hire.
              </p>
              {bankFilled(record.extension.bank) ? (
                <EmsFormGrid>
                  <Info label="Bank" value={record.extension.bank.bankName || "—"} />
                  <Info label="Holder" value={record.extension.bank.accountHolderName || "—"} />
                  <Info label="IFSC" value={record.extension.bank.ifsc || "—"} />
                  <Info label="Account" value={maskAccount(record.extension.bank.accountNumber)} />
                  <Info label="Branch" value={record.extension.bank.branchName || "—"} />
                </EmsFormGrid>
              ) : (
                <p className="text-xs text-muted-foreground">No onboarding bank details on file.</p>
              )}
            </Section>
            <Section title="Company Salary Account">
              <p className="mb-2 text-xs text-muted-foreground">
                Account opened / maintained by the company after hire (used for payroll).
              </p>
              {bankFilled(companyBank) ? (
                <EmsFormGrid>
                  <Info label="Bank" value={companyBank.bankName || "—"} />
                  <Info label="Holder" value={companyBank.accountHolderName || "—"} />
                  <Info label="IFSC" value={companyBank.ifsc || "—"} />
                  <Info label="Account" value={maskAccount(companyBank.accountNumber)} />
                  <Info label="Branch" value={companyBank.branchName || "—"} />
                </EmsFormGrid>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Not set yet. Use Edit to add the company salary account.
                </p>
              )}
            </Section>
          </div>
        ) : null}

        {tab === "documents" ? (
          <DocumentsTab
            onboardingDocs={record.extension.documents ?? []}
            hrDocs={linked?.hrDocuments ?? []}
            loading={linkedLoading}
          />
        ) : null}

        {tab === "attendance" ? (
          <Section title="Attendance Log">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="profile-att-month" className="sr-only">
                  Month
                </label>
                <span className="text-[11px] text-muted-foreground">Month</span>
                <select
                  id="profile-att-month"
                  value={attendanceMonth}
                  onChange={(e) => setAttendanceMonth(e.target.value)}
                  className="h-9 min-w-[9.5rem] cursor-pointer rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="all">All months</option>
                  {attendanceMonthOptions.map((ym) => (
                    <option key={ym} value={ym}>
                      {formatAttendanceMonthLabel(ym)}
                    </option>
                  ))}
                </select>
                <label htmlFor="profile-att-status" className="sr-only">
                  Status
                </label>
                <span className="text-[11px] text-muted-foreground">Status</span>
                <select
                  id="profile-att-status"
                  value={attendanceStatus}
                  onChange={(e) =>
                    setAttendanceStatus(e.target.value as "all" | "present" | "absent")
                  }
                  className="h-9 min-w-[8rem] cursor-pointer rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="all">All</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {filteredAttendance.length} record{filteredAttendance.length === 1 ? "" : "s"}
                {(linked?.attendance.length ?? 0) > filteredAttendance.length
                  ? ` · ${linked?.attendance.length ?? 0} total`
                  : null}
              </p>
            </div>
            <DataTableTab
              loading={linkedLoading}
              empty="No attendance records match these filters."
              columns={["Date", "Status", "Check-in", "Check-out", "Source"]}
              rows={filteredAttendance.map((r) => [
                String(r.attendance_date ?? "—"),
                String(r.attendance_status ?? r.status ?? "—"),
                formatAttendanceTime(r.check_in_at),
                formatAttendanceTime(r.check_out_at),
                String(r.source ?? "—"),
              ])}
            />
          </Section>
        ) : null}

        {tab === "leave" ? (
          <div className="space-y-4">
            <Section title="Balances">
              <DataTableTab
                loading={linkedLoading}
                empty="No leave balances."
                columns={["Type", "Opening", "Used", "Balance", "Year"]}
                rows={(linked?.leaveBalances ?? []).map((r) => [
                  String(r.leave_type_name ?? r.leave_type_id ?? "—"),
                  String(r.opening_balance ?? r.entitled ?? "—"),
                  String(r.used ?? r.availed ?? "—"),
                  String(r.balance ?? r.closing_balance ?? "—"),
                  String(r.year ?? r.leave_year ?? "—"),
                ])}
              />
            </Section>
            <Section title="Requests">
              <DataTableTab
                loading={linkedLoading}
                empty="No leave requests."
                columns={["From", "To", "Days", "Status", "Reason"]}
                rows={(linked?.leaveRequests ?? []).map((r) => [
                  String(r.from_date ?? r.start_date ?? "—"),
                  String(r.to_date ?? r.end_date ?? "—"),
                  String(r.days ?? r.total_days ?? "—"),
                  String(r.status ?? "—"),
                  String(r.reason ?? r.remarks ?? "—").slice(0, 60),
                ])}
              />
            </Section>
          </div>
        ) : null}

        {tab === "payroll" ? (
          <div className="space-y-4">
            <Section title="Salary Structure">
              <EmsFormGrid>
                <Info label="CTC" value={record.extension.salary.ctc || "—"} />
                <Info label="Basic" value={record.extension.salary.basicSalary || "—"} />
                <Info label="Structure" value={record.extension.salary.salaryStructure || "—"} />
                <Info label="Payroll group" value={record.extension.salary.payrollGroup || "—"} />
                <Info label="Tax regime" value={record.extension.salary.incomeTaxRegime || "—"} />
              </EmsFormGrid>
              {(linked?.salaries.length ?? 0) > 0 ? (
                <div className="mt-3">
                  <DataTableTab
                    loading={false}
                    empty=""
                    columns={["Structure", "Effective", "CTC", "Status"]}
                    rows={(linked?.salaries ?? []).map((r) => [
                      String(r.structure_name ?? r.salary_structure_id ?? "—"),
                      String(r.effective_from ?? "—"),
                      String(r.ctc ?? r.gross ?? "—"),
                      String(r.status ?? "—"),
                    ])}
                  />
                </div>
              ) : null}
            </Section>
            <Section title="Payslips">
              <DataTableTab
                loading={linkedLoading}
                empty="No payslips for this employee."
                columns={["Document", "Period", "Net", "Status"]}
                rows={(linked?.payslips ?? []).map((r) => [
                  String(r.document_number ?? r.payslip_code ?? r.id ?? "—"),
                  String(r.period_label ?? r.payroll_period_id ?? r.month ?? "—"),
                  String(r.net_pay ?? r.net_amount ?? "—"),
                  String(r.status ?? "—"),
                ])}
              />
            </Section>
          </div>
        ) : null}

        {tab === "separation" ? (
          <DataTableTab
            loading={linkedLoading}
            empty="No offboarding cases for this employee."
            columns={["Type", "Last day", "Status", "Reason"]}
            rows={(linked?.separation ?? []).map((r) => [
              String(r.separation_type ?? r.type ?? "—"),
              String(r.last_working_date ?? r.exit_date ?? "—"),
              String(r.status ?? "—"),
              String(r.reason ?? r.remarks ?? "—").slice(0, 80),
            ])}
          />
        ) : null}
      </div>

      <SetupDrawer
        open={editOpen}
        title={editSection === "choose" ? "Edit Employee" : `Edit · ${EDIT_SECTIONS.find((section) => section.id === editSection)?.title ?? "Employee"}`}
        description={
          editSection === "choose"
            ? "Choose the details you want to update."
            : "Update the selected employee details, then save your changes."
        }
        wide
        onClose={() => {
          setEditOpen(false);
          setEditSection("choose");
        }}
        footer={
          <>
            {editSection !== "choose" ? (
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => setEditSection("choose")}
              >
                <ChevronLeft className="size-3.5" />
                All sections
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => {
                setEditOpen(false);
                setEditSection("choose");
              }}
            >
              Cancel
            </Button>
            {editSection !== "choose" ? (
              <Button
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={() => void saveEdit()}
              >
                <Save className="size-3.5" />
                Save changes
              </Button>
            ) : null}
          </>
        }
      >
        {draft ? (
          <EmployeeEditForm section={editSection} draft={draft} setDraft={setDraft} onSelectSection={setEditSection} />
        ) : null}
      </SetupDrawer>
    </div>
  );
}

function EmployeeEditForm({
  section,
  draft,
  setDraft,
  onSelectSection,
}: {
  section: ProfileEditSection;
  draft: EmployeeWizardDraft;
  setDraft: Dispatch<SetStateAction<EmployeeWizardDraft | null>>;
  onSelectSection: (section: ProfileEditSection) => void;
}) {
  const update = (patch: Partial<EmployeeWizardDraft>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));
  const patchPersonal = (personal: Partial<EmployeeWizardDraft["personal"]>) =>
    update({ personal: { ...draft.personal, ...personal } });
  const patchEmployment = (employment: Partial<EmployeeWizardDraft["employment"]>) =>
    update({ employment: { ...draft.employment, ...employment } });

  if (section === "choose") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {EDIT_SECTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className="group flex cursor-pointer gap-3 rounded-xl border border-border/70 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">{item.title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (section === "personal") {
    const p = draft.personal;
    return (
      <div className="space-y-5">
        <SectionHeading title="Personal details" />
        <SetupField label="Profile photo" hint="JPG, JPEG, or PNG">
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="block w-full cursor-pointer text-xs file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void readFileAsDataUrl(file).then((profilePhotoDataUrl) => patchPersonal({ profilePhotoDataUrl }));
            }}
          />
        </SetupField>
        <EmsFormGrid>
          <Field label="First name" value={p.firstName} onChange={(firstName) => patchPersonal({ firstName })} />
          <Field label="Middle name" value={p.middleName} onChange={(middleName) => patchPersonal({ middleName })} />
          <Field label="Last name" value={p.lastName} onChange={(lastName) => patchPersonal({ lastName })} />
          <SetupField label="Gender"><SetupSelect value={p.gender} onChange={(e) => patchPersonal({ gender: e.target.value })}><option value="">Select gender</option>{GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SetupSelect></SetupField>
          <Field label="Date of birth" type="date" value={p.dateOfBirth} onChange={(dateOfBirth) => patchPersonal({ dateOfBirth })} />
          <SetupField label="Marital status"><SetupSelect value={p.maritalStatus} onChange={(e) => patchPersonal({ maritalStatus: e.target.value })}><option value="">Select status</option>{MARITAL_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SetupSelect></SetupField>
          <Field label="Blood group" value={p.bloodGroup} onChange={(bloodGroup) => patchPersonal({ bloodGroup })} />
          <Field label="Nationality" value={p.nationality} onChange={(nationality) => patchPersonal({ nationality })} />
          <Field label="Official email" type="email" value={p.officialEmail} onChange={(officialEmail) => patchPersonal({ officialEmail })} />
          <Field label="Personal email" type="email" value={p.personalEmail} onChange={(personalEmail) => patchPersonal({ personalEmail })} />
          <Field label="Mobile" value={p.mobile} onChange={(mobile) => patchPersonal({ mobile })} />
          <Field label="Alternate mobile" value={p.alternateMobile} onChange={(alternateMobile) => patchPersonal({ alternateMobile })} />
        </EmsFormGrid>
        <SectionHeading title="Current address" />
        <AddressFields value={p.currentAddress} onChange={(currentAddress) => patchPersonal({ currentAddress })} />
        <SectionHeading title="Permanent address" />
        <AddressFields value={p.permanentAddress} onChange={(permanentAddress) => patchPersonal({ permanentAddress })} />
        <SectionHeading title="Emergency contact" />
        <EmsFormGrid>
          <Field label="Name" value={p.emergency.name} onChange={(name) => patchPersonal({ emergency: { ...p.emergency, name } })} />
          <Field label="Phone" value={p.emergency.phone} onChange={(phone) => patchPersonal({ emergency: { ...p.emergency, phone } })} />
          <SetupField label="Relationship"><SetupSelect value={p.emergency.relationship} onChange={(e) => patchPersonal({ emergency: { ...p.emergency, relationship: e.target.value } })}><option value="">Select relationship</option>{RELATIONSHIP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SetupSelect></SetupField>
        </EmsFormGrid>
      </div>
    );
  }

  if (section === "employment") {
    const e = draft.employment;
    const fields: { label: string; key: keyof typeof e; type?: string }[] = [
      { label: "Employee ID", key: "employeeCode" }, { label: "Joining date", key: "joiningDate", type: "date" },
      { label: "Legal entity ID", key: "entityId" }, { label: "Legal entity", key: "entityName" },
      { label: "Branch ID", key: "branchId" }, { label: "Branch", key: "branchName" },
      { label: "Department ID", key: "departmentId" }, { label: "Department", key: "departmentName" },
      { label: "Designation ID", key: "designationId" }, { label: "Designation", key: "designationName" },
      { label: "Location ID", key: "locationId" }, { label: "Location", key: "location" },
      { label: "Manager ID", key: "reportingManagerId" }, { label: "Reporting manager", key: "reportingManagerName" },
      { label: "Management group ID", key: "managementGroupId" }, { label: "Management group", key: "managementGroupName" },
      { label: "Grade", key: "grade" }, { label: "Job level", key: "jobLevel" },
      { label: "Shift ID", key: "shiftId" }, { label: "Shift", key: "shiftName" },
      { label: "Leave policy ID", key: "leavePolicyId" }, { label: "Leave policy", key: "leavePolicyName" },
      { label: "Branch head", key: "branchHeadName" }, { label: "Department head", key: "departmentHeadName" },
      { label: "Probation days", key: "probationPeriodDays" }, { label: "Confirmation date", key: "confirmationDate", type: "date" },
    ];
    return <div className="space-y-4"><p className="text-xs text-muted-foreground">Use the saved master IDs when changing organisation assignments.</p><EmsFormGrid>{fields.map(({ label, key, type }) => <Field key={key} label={label} type={type} value={e[key]} onChange={(value) => patchEmployment({ [key]: value })} />)}<SetupField label="Employment type"><SetupSelect value={e.employmentType} onChange={(event) => patchEmployment({ employmentType: event.target.value })}>{EMPLOYMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SetupSelect></SetupField><SetupField label="Status"><SetupSelect value={e.lifecycleStatus} onChange={(event) => patchEmployment({ lifecycleStatus: event.target.value as typeof e.lifecycleStatus })}>{LIFECYCLE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SetupSelect></SetupField></EmsFormGrid></div>;
  }

  if (section === "government") return <GovernmentForm draft={draft} update={update} />;
  if (section === "bank") return <BankForm draft={draft} update={update} />;
  if (section === "salary") return <SalaryForm draft={draft} update={update} />;
  if (section === "education") return <EducationForm draft={draft} update={update} />;
  if (section === "history") return <EmploymentHistoryForm draft={draft} update={update} />;
  return <DocumentsForm draft={draft} update={update} />;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <SetupField label={label}><SetupInput type={type} value={value} onChange={(event) => onChange(event.target.value)} /></SetupField>;
}

function SectionHeading({ title }: { title: string }) {
  return <h3 className="border-b border-border/60 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>;
}

function AddressFields({ value, onChange }: { value: EmployeeWizardDraft["personal"]["currentAddress"]; onChange: (value: EmployeeWizardDraft["personal"]["currentAddress"]) => void }) {
  return <EmsFormGrid><Field label="Address line 1" value={value.line1} onChange={(line1) => onChange({ ...value, line1 })} /><Field label="Address line 2" value={value.line2 ?? ""} onChange={(line2) => onChange({ ...value, line2 })} /><Field label="City" value={value.city} onChange={(city) => onChange({ ...value, city })} /><Field label="State" value={value.state} onChange={(state) => onChange({ ...value, state })} /><Field label="Country" value={value.country} onChange={(country) => onChange({ ...value, country })} /><Field label="Pincode" value={value.pincode} onChange={(pincode) => onChange({ ...value, pincode })} /></EmsFormGrid>;
}

function GovernmentForm({ draft, update }: EditFormProps) {
  const g = draft.governmentIds;
  const set = (governmentIds: Partial<typeof g>) => update({ governmentIds: { ...g, ...governmentIds } });
  return <EmsFormGrid><Field label="Aadhaar" value={g.aadhaar} onChange={(aadhaar) => set({ aadhaar })} /><Field label="PAN" value={g.pan} onChange={(pan) => set({ pan })} /><Field label="Passport" value={g.passport} onChange={(passport) => set({ passport })} /><Field label="UAN" value={g.uan} onChange={(uan) => set({ uan })} /><Field label="ESIC" value={g.esic} onChange={(esic) => set({ esic })} /><Field label="Driving licence" value={g.drivingLicense} onChange={(drivingLicense) => set({ drivingLicense })} /><Field label="Voter ID" value={g.voterId} onChange={(voterId) => set({ voterId })} /><Field label="Issue date" type="date" value={g.issueDate} onChange={(issueDate) => set({ issueDate })} /><Field label="Expiry date" type="date" value={g.expiryDate} onChange={(expiryDate) => set({ expiryDate })} /></EmsFormGrid>;
}

function BankFields({ title, value, onChange }: { title: string; value: EmployeeWizardDraft["bank"]; onChange: (value: EmployeeWizardDraft["bank"]) => void }) {
  return <div className="space-y-3"><SectionHeading title={title} /><EmsFormGrid><Field label="Bank name" value={value.bankName} onChange={(bankName) => onChange({ ...value, bankName })} /><Field label="Account holder" value={value.accountHolderName} onChange={(accountHolderName) => onChange({ ...value, accountHolderName })} /><Field label="Account number" value={value.accountNumber} onChange={(accountNumber) => onChange({ ...value, accountNumber, confirmAccountNumber: accountNumber })} /><Field label="IFSC" value={value.ifsc} onChange={(ifsc) => onChange({ ...value, ifsc })} /><Field label="Branch" value={value.branchName} onChange={(branchName) => onChange({ ...value, branchName })} /><Field label="SWIFT" value={value.swift} onChange={(swift) => onChange({ ...value, swift })} /><Field label="UPI ID" value={value.upiId} onChange={(upiId) => onChange({ ...value, upiId })} /></EmsFormGrid></div>;
}

function BankForm({ draft, update }: EditFormProps) {
  return <div className="space-y-6"><BankFields title="Onboarding bank account" value={draft.bank} onChange={(bank) => update({ bank })} /><BankFields title="Company salary account" value={draft.companyBank} onChange={(companyBank) => update({ companyBank })} /></div>;
}

function SalaryForm({ draft, update }: EditFormProps) {
  const s = draft.salary;
  const set = (salary: Partial<typeof s>) => update({ salary: { ...s, ...salary } });
  return <EmsFormGrid><Field label="CTC" value={s.ctc} onChange={(ctc) => set({ ctc })} /><Field label="Basic salary" value={s.basicSalary} onChange={(basicSalary) => set({ basicSalary })} /><Field label="Salary structure" value={s.salaryStructure} onChange={(salaryStructure) => set({ salaryStructure })} /><Field label="Payroll group" value={s.payrollGroup} onChange={(payrollGroup) => set({ payrollGroup })} /><Field label="Income tax regime" value={s.incomeTaxRegime} onChange={(incomeTaxRegime) => set({ incomeTaxRegime })} /><Toggle label="Provident fund (PF)" checked={s.pf} onChange={(pf) => set({ pf })} /><Toggle label="Employee state insurance (ESI)" checked={s.esi} onChange={(esi) => set({ esi })} /><Toggle label="Professional tax" checked={s.professionalTax} onChange={(professionalTax) => set({ professionalTax })} /></EmsFormGrid>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <SetupField label={label}><label className="flex h-8 items-center gap-2 rounded-lg border border-input px-2.5 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> Enabled</label></SetupField>;
}

type EditFormProps = {
  draft: EmployeeWizardDraft;
  update: (patch: Partial<EmployeeWizardDraft>) => void;
};

function EducationForm({ draft, update }: EditFormProps) {
  const updateRow = (index: number, patch: Partial<EmployeeWizardDraft["education"][number]>) => update({ education: draft.education.map((row, i) => i === index ? { ...row, ...patch } : row) });
  return <div className="space-y-4"><Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => update({ education: [...draft.education, { id: `education-${Date.now()}`, degree: "", institution: "", field: "", year: "", grade: "" }] })}>Add qualification</Button>{draft.education.map((row, index) => <EditableRow key={row.id} title={`Qualification ${index + 1}`} onRemove={() => update({ education: draft.education.filter((_, i) => i !== index) })}><EmsFormGrid><Field label="Degree" value={row.degree} onChange={(degree) => updateRow(index, { degree })} /><Field label="Institution" value={row.institution} onChange={(institution) => updateRow(index, { institution })} /><Field label="Field of study" value={row.field} onChange={(field) => updateRow(index, { field })} /><Field label="Year" value={row.year} onChange={(year) => updateRow(index, { year })} /><Field label="Grade" value={row.grade} onChange={(grade) => updateRow(index, { grade })} /></EmsFormGrid></EditableRow>)}{!draft.education.length ? <EmptyEditState text="No education records yet." /> : null}</div>;
}

function EmploymentHistoryForm({ draft, update }: EditFormProps) {
  const updateRow = (index: number, patch: Partial<EmployeeWizardDraft["previousEmployment"][number]>) => update({ previousEmployment: draft.previousEmployment.map((row, i) => i === index ? { ...row, ...patch } : row) });
  return <div className="space-y-4"><Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => update({ previousEmployment: [...draft.previousEmployment, { id: `employment-${Date.now()}`, company: "", designation: "", fromDate: "", toDate: "", lastCtc: "", reasonForLeaving: "" }] })}>Add employer</Button>{draft.previousEmployment.map((row, index) => <EditableRow key={row.id} title={`Employer ${index + 1}`} onRemove={() => update({ previousEmployment: draft.previousEmployment.filter((_, i) => i !== index) })}><EmsFormGrid><Field label="Company" value={row.company} onChange={(company) => updateRow(index, { company })} /><Field label="Designation" value={row.designation} onChange={(designation) => updateRow(index, { designation })} /><Field label="From date" type="date" value={row.fromDate} onChange={(fromDate) => updateRow(index, { fromDate })} /><Field label="To date" type="date" value={row.toDate} onChange={(toDate) => updateRow(index, { toDate })} /><Field label="Last CTC" value={row.lastCtc} onChange={(lastCtc) => updateRow(index, { lastCtc })} /></EmsFormGrid><SetupField label="Reason for leaving"><SetupTextarea value={row.reasonForLeaving} onChange={(event) => updateRow(index, { reasonForLeaving: event.target.value })} /></SetupField></EditableRow>)}{!draft.previousEmployment.length ? <EmptyEditState text="No previous employment records yet." /> : null}</div>;
}

function DocumentsForm({ draft, update }: EditFormProps) {
  const updateRow = (index: number, patch: Partial<EmployeeWizardDraft["documents"][number]>) => update({ documents: draft.documents.map((row, i) => i === index ? { ...row, ...patch } : row) });
  return <div className="space-y-4"><Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => update({ documents: [...draft.documents, { id: `document-${Date.now()}`, documentType: "", documentNumber: "", issueDate: "", expiryDate: "", fileName: "", uploadedBy: "HR", uploadedAt: new Date().toISOString(), source: "manual" }] })}>Add document</Button>{draft.documents.map((row, index) => <EditableRow key={row.id} title={`Document ${index + 1}`} onRemove={() => update({ documents: draft.documents.filter((_, i) => i !== index) })}><EmsFormGrid><Field label="Document type" value={row.documentType} onChange={(documentType) => updateRow(index, { documentType })} /><Field label="Document number" value={row.documentNumber} onChange={(documentNumber) => updateRow(index, { documentNumber })} /><Field label="Issue date" type="date" value={row.issueDate} onChange={(issueDate) => updateRow(index, { issueDate })} /><Field label="Expiry date" type="date" value={row.expiryDate} onChange={(expiryDate) => updateRow(index, { expiryDate })} /><Field label="File name" value={row.fileName} onChange={(fileName) => updateRow(index, { fileName })} /><SetupField label="Replace file"><input type="file" className="block w-full cursor-pointer text-xs" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void readFileAsDataUrl(file).then((fileDataUrl) => updateRow(index, { fileName: file.name, fileDataUrl })); }} /></SetupField></EmsFormGrid></EditableRow>)}{!draft.documents.length ? <EmptyEditState text="No employee documents yet." /> : null}</div>;
}

function EditableRow({ title, onRemove, children }: { title: string; onRemove: () => void; children: ReactNode }) {
  return <section className="space-y-3 rounded-xl border border-border/70 p-3"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{title}</h3><Button type="button" variant="ghost" size="sm" className="cursor-pointer text-destructive hover:text-destructive" onClick={onRemove}>Remove</Button></div>{children}</section>;
}

function EmptyEditState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border/80 p-4 text-center text-xs text-muted-foreground">{text}</p>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatGenderLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const hit = GENDER_OPTIONS.find((o) => o.value === value.toLowerCase());
  if (hit) return hit.label;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatAddressLine(parts: (string | undefined | null)[]): string {
  const cleaned = parts.map((p) => (p || "").trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : "—";
}

function isEmptyValue(value: ReactNode): boolean {
  if (value == null) return true;
  if (typeof value === "string") {
    const t = value.trim();
    return !t || t === "—";
  }
  return false;
}

function OverviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <h3 className="border-b border-border/50 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="mt-3 flex-1">{children}</div>
    </div>
  );
}

function OverviewField({
  label,
  value,
  hideIfEmpty = false,
  className,
}: {
  label: string;
  value: ReactNode;
  hideIfEmpty?: boolean;
  className?: string;
}) {
  if (hideIfEmpty && isEmptyValue(value)) return null;
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-medium text-foreground">
        {isEmptyValue(value) ? "—" : value}
      </p>
    </div>
  );
}

function OverviewTab({
  record,
  linked,
  linkedLoading,
}: {
  record: EmployeeRecord;
  linked: LinkedData | null;
  linkedLoading: boolean;
}) {
  const p = record.extension.personal;
  const docCount =
    (record.extension.documents?.length ?? 0) + (linked?.hrDocuments.length ?? 0);
  const attendanceCount = linkedLoading ? null : (linked?.attendance.length ?? 0);
  const leaveCount = linkedLoading ? null : (linked?.leaveRequests.length ?? 0);

  const fullAddress = formatAddressLine([
    p.currentAddress.line1,
    p.currentAddress.line2,
    p.currentAddress.city,
    p.currentAddress.state,
    p.currentAddress.pincode,
    p.currentAddress.country,
  ]);
  const permanentAddress = formatAddressLine([
    p.permanentAddress.line1,
    p.permanentAddress.line2,
    p.permanentAddress.city,
    p.permanentAddress.state,
    p.permanentAddress.pincode,
    p.permanentAddress.country,
  ]);

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          At a glance
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Attendance records", value: attendanceCount },
            { label: "Leave requests", value: leaveCount },
            { label: "Documents on file", value: docCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3"
            >
              <p className="text-[11px] font-medium text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {stat.value == null ? "…" : stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <OverviewCard title="Personal">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <OverviewField
                label="Gender"
                value={formatGenderLabel(p.gender || record.gender)}
              />
              <OverviewField
                label="Marital status"
                value={formatMaritalStatusLabel(p.maritalStatus)}
              />
              <OverviewField label="Date of birth" value={p.dateOfBirth} hideIfEmpty />
              <OverviewField label="Nationality" value={p.nationality} hideIfEmpty />
              <OverviewField label="Blood group" value={p.bloodGroup} hideIfEmpty />
              <OverviewField
                label="Current address"
                value={fullAddress}
                className="sm:col-span-2"
              />
              <OverviewField
                label="Permanent address"
                value={permanentAddress}
                className="sm:col-span-2"
              />
            </div>
          </OverviewCard>

          <OverviewCard title="Contact">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <OverviewField
                label="Official email"
                value={p.officialEmail || record.officialEmail}
              />
              <OverviewField label="Personal email" value={p.personalEmail} hideIfEmpty />
              <OverviewField label="Mobile" value={p.mobile || record.mobile} />
            </div>
          </OverviewCard>
        </div>

        <div className="flex flex-col gap-4">
          <OverviewCard title="Employment">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <OverviewField
                label="Legal entity"
                value={record.extension.employment.entityName}
              />
              <OverviewField label="Department" value={record.departmentName} />
              <OverviewField label="Designation" value={record.designationName} />
              <OverviewField label="Branch" value={record.branchName} />
              <OverviewField label="Reporting manager" value={record.reportingManagerName} />
              <OverviewField
                label="Employment type"
                value={formatEmploymentTypeLabel(record.employmentType)}
              />
              <OverviewField label="Joined" value={record.joiningDate} />
              <OverviewField
                label="Status"
                value={<HrStatusBadge status={record.lifecycleStatus} />}
              />
            </div>
          </OverviewCard>

          <OverviewCard title="Emergency contact">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <OverviewField label="Name" value={p.emergency.name} />
              <OverviewField
                label="Relationship"
                value={formatRelationshipLabel(p.emergency.relationship)}
              />
              <OverviewField label="Phone" value={p.emergency.phone} />
            </div>
          </OverviewCard>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  const empty =
    value == null ||
    value === "" ||
    (typeof value === "string" && value.trim() === "");
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{empty ? "—" : value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function DataTableTab({
  loading,
  empty,
  columns,
  rows,
}: {
  loading: boolean;
  empty: string;
  columns: string[];
  rows: string[][];
}) {
  if (loading) {
    return <p className="text-xs text-muted-foreground">Loading…</p>;
  }
  if (!rows.length) {
    return empty ? <p className="text-xs text-muted-foreground">{empty}</p> : null;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            {columns.map((c) => (
              <th key={c} className="py-2 pr-3 font-medium uppercase tracking-wide">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-3 align-top text-foreground">
                  {cell || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsTab({
  onboardingDocs,
  hrDocs,
  loading,
}: {
  onboardingDocs: EmployeeDocumentItem[];
  hrDocs: Record<string, unknown>[];
  loading: boolean;
}) {
  const portalDocs = onboardingDocs.filter(
    (d) => !d.source || d.source === "onboarding" || d.uploadedBy.toLowerCase().includes("onboarding"),
  );
  const otherLocal = onboardingDocs.filter((d) => !portalDocs.includes(d));

  return (
    <div className="space-y-5">
      <Section title="Uploaded During Onboarding">
        {!portalDocs.length ? (
          <p className="text-xs text-muted-foreground">No documents uploaded during onboarding.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {portalDocs.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{d.documentType}</p>
                  <p className="text-muted-foreground">
                    {d.fileName} · {d.uploadedBy} ·{" "}
                    {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : "—"}
                  </p>
                  {d.expiryDate ? <p className="text-amber-700">Expires {d.expiryDate}</p> : null}
                </div>
                {d.fileDataUrl ? (
                  <a
                    href={d.fileDataUrl}
                    download={d.fileName}
                    className="cursor-pointer text-primary transition-colors duration-200 hover:underline"
                  >
                    <Download className="inline size-3.5" /> Download
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="HR / Company Documents">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !hrDocs.length && !otherLocal.length ? (
          <p className="text-xs text-muted-foreground">No additional HR documents on file.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {otherLocal.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <p className="font-medium">{d.documentType}</p>
                  <p className="text-muted-foreground">
                    {d.fileName} · {d.uploadedBy}
                  </p>
                </div>
                {d.fileDataUrl ? (
                  <a
                    href={d.fileDataUrl}
                    download={d.fileName}
                    className="cursor-pointer text-primary transition-colors duration-200 hover:underline"
                  >
                    <Download className="inline size-3.5" /> Download
                  </a>
                ) : null}
              </li>
            ))}
            {hrDocs.map((d) => (
              <li
                key={String(d.id)}
                className="rounded-lg border border-border/60 px-3 py-2"
              >
                <p className="font-medium">
                  {String(d.document_type ?? "Document")}: {String(d.document_name ?? "—")}
                </p>
                <p className="text-muted-foreground">
                  {String(d.document_number ?? "")} · {String(d.verification_status ?? d.status ?? "")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
