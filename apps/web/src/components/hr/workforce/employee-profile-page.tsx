"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Pencil, Save } from "lucide-react";

import {
  EmsAvatar,
  EmsFormGrid,
  EmsSkeleton,
  EmsTabBar,
} from "@/components/hr/workforce/ems-primitives";
import { HrEmptyState, HrStatusBadge } from "@/components/hr/hr-primitives";
import { SetupDrawer, SetupField, SetupInput, SetupSelect } from "@/components/hr/setup/setup-drawer";
import { toast, SetupToastHost } from "@/components/hr/setup/setup-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  getEmployeeById,
  loadEmployeeDirectory,
  updateEmployeeRecord,
} from "@/services/employee-management-service";
import { ApiClientError, resourceService } from "@/services/api-client";
import type {
  BankDetails,
  EmployeeDocumentItem,
  EmployeeRecord,
  EmployeeWizardDraft,
} from "@/types/employee-management";
import { emptyBank } from "@/types/employee-management";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "all-details", label: "All details" },
  { id: "employment", label: "Employment" },
  { id: "gov", label: "Government IDs" },
  { id: "bank", label: "Bank" },
  { id: "documents", label: "Documents" },
  { id: "attendance", label: "Attendance" },
  { id: "leave", label: "Leave" },
  { id: "payroll", label: "Payroll" },
  { id: "separation", label: "Separation" },
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
    ["performance", "training", "assets", "activity", "audit"].includes(initialTab)
      ? "overview"
      : initialTab,
  );
  const [editOpen, setEditOpen] = useState(editMode);
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
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-start">
        <EmsAvatar name={record.displayName} photoUrl={record.profilePhotoDataUrl} size="lg" />
        <div className="min-w-0 flex-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Info label="Employee ID" value={record.employeeCode} />
          <Info label="Department" value={record.departmentName} />
          <Info label="Designation" value={record.designationName} />
          <Info label="Reporting manager" value={record.reportingManagerName} />
          <Info label="Branch" value={record.branchName} />
          <Info label="Joined" value={record.joiningDate || "—"} />
          <Info label="Employment type" value={record.employmentType} />
          <Info label="Status" value={<HrStatusBadge status={record.lifecycleStatus} />} />
          <Info label="Email" value={record.officialEmail} />
          <Info label="Phone" value={record.mobile} />
        </div>
      </div>

      <EmsTabBar tabs={TABS} active={tab} onChange={setTab} />

      <div className="min-h-[200px] rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        {tab === "overview" ? (
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <Section title="Personal">
              <p>
                {record.extension.personal.maritalStatus || "—"} ·{" "}
                {record.extension.personal.gender || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {record.extension.personal.currentAddress.city},{" "}
                {record.extension.personal.currentAddress.country}
              </p>
            </Section>
            <Section title="Emergency">
              <p>{record.extension.personal.emergency.name || "—"}</p>
              <p className="text-xs text-muted-foreground">
                {record.extension.personal.emergency.phone}
              </p>
            </Section>
            <Section title="At a glance">
              <p className="text-xs text-muted-foreground">
                Attendance rows: {linked?.attendance.length ?? "…"} · Leave requests:{" "}
                {linked?.leaveRequests.length ?? "…"} · Documents:{" "}
                {(record.extension.documents?.length ?? 0) + (linked?.hrDocuments.length ?? 0)}
              </p>
            </Section>
          </div>
        ) : null}

        {tab === "all-details" ? (
          <AllDetailsView record={record} companyBank={companyBank} />
        ) : null}

        {tab === "employment" ? (
          <EmsFormGrid>
            <Info label="Grade" value={record.extension.employment.grade || "—"} />
            <Info label="Job level" value={record.extension.employment.jobLevel || "—"} />
            <Info label="Shift" value={record.extension.employment.shiftName || "—"} />
            <Info label="Location" value={record.extension.employment.location || "—"} />
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
            <Info label="Type" value={record.employmentType} />
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
            <Section title="Onboarding bank">
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
                  <Info label="UPI" value={record.extension.bank.upiId || "—"} />
                </EmsFormGrid>
              ) : (
                <p className="text-xs text-muted-foreground">No onboarding bank details on file.</p>
              )}
            </Section>
            <Section title="Company salary account">
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
                  <Info label="UPI" value={companyBank.upiId || "—"} />
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
          <Section title="Attendance log">
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
            <Section title="Salary structure">
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
            empty="No separation cases for this employee."
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
        title="Edit employee"
        description="Update profile details and the company salary account."
        wide
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => void saveEdit()}
            >
              <Save className="size-3.5" />
              Save changes
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <EmsFormGrid>
              <SetupField label="First name">
                <SetupInput
                  value={draft.personal.firstName}
                  onChange={(e) =>
                    setDraft({ ...draft, personal: { ...draft.personal, firstName: e.target.value } })
                  }
                />
              </SetupField>
              <SetupField label="Last name">
                <SetupInput
                  value={draft.personal.lastName}
                  onChange={(e) =>
                    setDraft({ ...draft, personal: { ...draft.personal, lastName: e.target.value } })
                  }
                />
              </SetupField>
              <SetupField label="Official email">
                <SetupInput
                  value={draft.personal.officialEmail}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personal: { ...draft.personal, officialEmail: e.target.value },
                    })
                  }
                />
              </SetupField>
              <SetupField label="Mobile">
                <SetupInput
                  value={draft.personal.mobile}
                  onChange={(e) =>
                    setDraft({ ...draft, personal: { ...draft.personal, mobile: e.target.value } })
                  }
                />
              </SetupField>
              <SetupField label="Designation">
                <SetupInput
                  value={draft.employment.designationName}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      employment: { ...draft.employment, designationName: e.target.value },
                    })
                  }
                />
              </SetupField>
              <SetupField label="Status">
                <SetupSelect
                  value={draft.employment.lifecycleStatus}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      employment: {
                        ...draft.employment,
                        lifecycleStatus: e.target.value as typeof draft.employment.lifecycleStatus,
                      },
                    })
                  }
                >
                  {["active", "inactive", "probation", "notice", "resigned", "archived"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SetupSelect>
              </SetupField>
            </EmsFormGrid>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Company salary account
              </h3>
              <EmsFormGrid>
                <SetupField label="Bank name">
                  <SetupInput
                    value={draft.companyBank.bankName}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        companyBank: { ...draft.companyBank, bankName: e.target.value },
                      })
                    }
                  />
                </SetupField>
                <SetupField label="Account holder">
                  <SetupInput
                    value={draft.companyBank.accountHolderName}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        companyBank: { ...draft.companyBank, accountHolderName: e.target.value },
                      })
                    }
                  />
                </SetupField>
                <SetupField label="Account number">
                  <SetupInput
                    value={draft.companyBank.accountNumber}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        companyBank: {
                          ...draft.companyBank,
                          accountNumber: e.target.value,
                          confirmAccountNumber: e.target.value,
                        },
                      })
                    }
                  />
                </SetupField>
                <SetupField label="IFSC">
                  <SetupInput
                    value={draft.companyBank.ifsc}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        companyBank: { ...draft.companyBank, ifsc: e.target.value },
                      })
                    }
                  />
                </SetupField>
              </EmsFormGrid>
            </div>
          </div>
        ) : null}
      </SetupDrawer>
    </div>
  );
}

function AllDetailsView({
  record,
  companyBank,
}: {
  record: EmployeeRecord;
  companyBank: BankDetails;
}) {
  const p = record.extension.personal;
  const e = record.extension.employment;
  const g = record.extension.governmentIds;
  const b = record.extension.bank;
  const education = record.extension.education ?? [];
  const previous = record.extension.previousEmployment ?? [];
  const docs = record.extension.documents ?? [];

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-muted-foreground">
        Complete snapshot of details filled during onboarding or Add employee.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Personal">
          <EmsFormGrid>
            <Info
              label="Name"
              value={`${p.firstName} ${p.middleName} ${p.lastName}`.replace(/\s+/g, " ").trim()}
            />
            <Info label="Official email" value={p.officialEmail || "—"} />
            <Info label="Personal email" value={p.personalEmail || "—"} />
            <Info label="Mobile" value={p.mobile || "—"} />
            <Info label="DOB" value={p.dateOfBirth || "—"} />
            <Info label="Gender" value={p.gender || "—"} />
            <Info label="Marital status" value={p.maritalStatus || "—"} />
            <Info label="Nationality" value={p.nationality || "—"} />
            <Info label="Blood group" value={p.bloodGroup || "—"} />
            <Info
              label="Current address"
              value={
                [p.currentAddress.line1, p.currentAddress.city, p.currentAddress.state, p.currentAddress.pincode]
                  .filter(Boolean)
                  .join(", ") || "—"
              }
            />
            <Info
              label="Emergency"
              value={`${p.emergency.name || "—"} (${p.emergency.relationship || "—"}) ${p.emergency.phone || ""}`}
            />
          </EmsFormGrid>
        </Section>
        <Section title="Employment">
          <EmsFormGrid>
            <Info label="Employee ID" value={e.employeeCode || record.employeeCode} />
            <Info label="Joined" value={e.joiningDate || "—"} />
            <Info label="Department" value={e.departmentName || record.departmentName} />
            <Info label="Designation" value={e.designationName || record.designationName} />
            <Info label="Branch" value={e.branchName || record.branchName} />
            <Info label="Type" value={e.employmentType || "—"} />
            <Info label="Reporting manager" value={e.reportingManagerName || "—"} />
            <Info label="Shift" value={e.shiftName || "—"} />
            <Info label="Status" value={e.lifecycleStatus || "—"} />
          </EmsFormGrid>
        </Section>
        <Section title="Government IDs">
          <EmsFormGrid>
            <Info label="Aadhaar" value={g.aadhaar || "—"} />
            <Info label="PAN" value={g.pan || "—"} />
            <Info label="Passport" value={g.passport || "—"} />
            <Info label="UAN" value={g.uan || "—"} />
            <Info label="ESIC" value={g.esic || "—"} />
            <Info label="DL" value={g.drivingLicense || "—"} />
          </EmsFormGrid>
        </Section>
        <Section title="Banks">
          <EmsFormGrid>
            <Info label="Onboarding bank" value={b.bankName || "—"} />
            <Info label="Onboarding A/C" value={maskAccount(b.accountNumber)} />
            <Info label="Company bank" value={companyBank.bankName || "—"} />
            <Info label="Company A/C" value={maskAccount(companyBank.accountNumber)} />
          </EmsFormGrid>
        </Section>
      </div>

      <Section title="Education (optional)">
        {education.filter((x) => x.degree || x.institution).length === 0 ? (
          <p className="text-xs text-muted-foreground">Not provided</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {education.map((x) => (
              <li key={x.id} className="rounded-lg border border-border/60 px-3 py-2">
                <p className="font-medium">
                  {x.degree || "—"} · {x.institution || "—"}
                </p>
                <p className="text-muted-foreground">
                  {[x.field, x.year, x.grade].filter(Boolean).join(" · ")}
                </p>
                {x.certificateFileName ? (
                  <p className="mt-1 text-muted-foreground">Certificate: {x.certificateFileName}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Previous employment (optional)">
        {previous.filter((x) => x.company || x.designation).length === 0 ? (
          <p className="text-xs text-muted-foreground">Not provided</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {previous.map((x) => (
              <li key={x.id} className="rounded-lg border border-border/60 px-3 py-2">
                <p className="font-medium">
                  {x.company || "—"} · {x.designation || "—"}
                </p>
                <p className="text-muted-foreground">
                  {x.fromDate || "?"} → {x.toDate || "?"} · CTC {x.lastCtc || "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Onboarding documents">
        {docs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No documents</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {docs.map((d) => (
              <li key={d.id}>
                {d.documentType}: {d.fileName}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
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
      <Section title="Uploaded during onboarding">
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

      <Section title="HR / company documents">
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
