/** Map onboarding portal payload ↔ employee wizard / extension fields. */

import type { OnboardingCase, PortalPayload } from "@/types/onboarding-management";
import type {
  BankDetails,
  EducationEntry,
  EmployeeDocumentItem,
  EmployeeWizardDraft,
  GovernmentIds,
  PreviousEmploymentEntry,
} from "@/types/employee-management";
import {
  emptyBank,
  emptyEmployment,
  emptyGovernmentIds,
  emptyPersonal,
  emptySalary,
} from "@/types/employee-management";
import { previewNextEmployeeCode } from "@/services/employee-management-service";

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || full, last: parts.slice(1).join(" ") };
}

export function portalToWizardDraft(
  caseRow: OnboardingCase,
  employeeCode?: string,
): EmployeeWizardDraft {
  const p = caseRow.portal;
  const personal = emptyPersonal();
  personal.firstName = p.personal.firstName || splitName(caseRow.candidateName).first;
  personal.middleName = p.personal.middleName || "";
  personal.lastName = p.personal.lastName || splitName(caseRow.candidateName).last;
  personal.gender = p.personal.gender || "";
  personal.dateOfBirth = p.personal.dob || "";
  personal.maritalStatus = p.personal.maritalStatus || "";
  personal.nationality = p.personal.nationality || "Indian";
  personal.bloodGroup = p.personal.bloodGroup || "";
  personal.mobile = p.personal.phone || caseRow.candidatePhone || "";
  personal.officialEmail = caseRow.candidateEmail || p.personal.email || "";
  personal.personalEmail = p.personal.personalEmail || p.personal.email || "";
  personal.currentAddress = {
    ...personal.currentAddress,
    line1: p.personal.address || "",
  };
  personal.emergency = {
    name: p.emergency.name || "",
    phone: p.emergency.phone || "",
    relationship: p.emergency.relationship || "",
  };

  const governmentIds: GovernmentIds = {
    ...emptyGovernmentIds(),
    aadhaar: p.governmentIds.aadhaar || "",
    pan: p.governmentIds.pan || "",
    passport: p.governmentIds.passport || "",
    drivingLicense: p.governmentIds.drivingLicense || "",
    uan: p.governmentIds.uan || "",
    esic: p.governmentIds.esic || "",
  };

  const bank: BankDetails = {
    ...emptyBank(),
    bankName: p.bank.bankName || "",
    accountHolderName: p.bank.accountHolder || "",
    accountNumber: p.bank.accountNumber || "",
    confirmAccountNumber: p.bank.accountNumber || "",
    ifsc: p.bank.ifsc || "",
    branchName: p.bank.branch || "",
    upiId: p.bank.upi || "",
  };

  const employment = emptyEmployment(employeeCode || previewNextEmployeeCode());
  employment.joiningDate = caseRow.joiningDate || new Date().toISOString().slice(0, 10);
  employment.departmentName = caseRow.department || "";
  employment.designationName = caseRow.designation || "";
  employment.branchName = caseRow.branch || "";
  employment.shiftName = caseRow.shift || "";
  employment.leavePolicyName = caseRow.leavePolicy || "";
  employment.employmentType = caseRow.employmentType || "permanent";
  employment.reportingManagerName = caseRow.reportingManager || "";

  const documents: EmployeeDocumentItem[] = (p.documents || []).map((d) => ({
    id: d.id,
    documentType: d.kind,
    documentNumber: "",
    issueDate: "",
    expiryDate: "",
    fileName: d.fileName,
    fileDataUrl: d.fileDataUrl,
    uploadedBy: "Onboarding portal",
    uploadedAt: d.uploadedAt,
    source: "onboarding" as const,
  }));

  const education: EducationEntry[] = [];
  const previousEmployment: PreviousEmploymentEntry[] = [];

  return {
    personal,
    employment,
    governmentIds,
    bank,
    companyBank: emptyBank(),
    salary: emptySalary(),
    documents,
    education,
    previousEmployment,
  };
}

export function summarizePortalDetails(portal: PortalPayload): {
  title: string;
  lines: string[];
}[] {
  return [
    {
      title: "Personal",
      lines: [
        [portal.personal.firstName, portal.personal.middleName, portal.personal.lastName]
          .filter(Boolean)
          .join(" "),
        portal.personal.personalEmail || portal.personal.email,
        portal.personal.phone,
        portal.personal.dob,
        portal.personal.gender,
        portal.personal.address,
      ].filter(Boolean),
    },
    {
      title: "Government IDs",
      lines: [
        portal.governmentIds.aadhaar && `Aadhaar: ${portal.governmentIds.aadhaar}`,
        portal.governmentIds.pan && `PAN: ${portal.governmentIds.pan}`,
        portal.governmentIds.passport && `Passport: ${portal.governmentIds.passport}`,
        portal.governmentIds.uan && `UAN: ${portal.governmentIds.uan}`,
        portal.governmentIds.esic && `ESIC: ${portal.governmentIds.esic}`,
      ].filter(Boolean) as string[],
    },
    {
      title: "Bank",
      lines: [
        portal.bank.bankName,
        portal.bank.accountHolder,
        portal.bank.accountNumber && `A/C …${portal.bank.accountNumber.slice(-4)}`,
        portal.bank.ifsc,
      ].filter(Boolean) as string[],
    },
    {
      title: "Emergency",
      lines: [
        portal.emergency.name,
        portal.emergency.relationship,
        portal.emergency.phone,
      ].filter(Boolean),
    },
    {
      title: "Education marks",
      lines: [
        portal.educationMarks?.tenth && `10th: ${portal.educationMarks.tenth}`,
        portal.educationMarks?.twelfth && `12th: ${portal.educationMarks.twelfth}`,
        portal.educationMarks?.graduation && `Graduation: ${portal.educationMarks.graduation}`,
      ].filter(Boolean) as string[],
    },
    {
      title: "Documents",
      lines:
        portal.documents.length === 0
          ? ["None uploaded"]
          : portal.documents.map((d) => `${d.kind}: ${d.fileName} (${d.verifyStatus})`),
    },
    {
      title: "Policies",
      lines: [
        portal.policies.agreed ? "Agreed" : "Not agreed",
        portal.policies.signature && `Signature: ${portal.policies.signature}`,
        ...(portal.policies.policies || []),
      ].filter(Boolean) as string[],
    },
  ];
}
