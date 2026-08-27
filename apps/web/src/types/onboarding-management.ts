/** Enterprise Digital Onboarding — types */

export type OnboardingCaseStatus =
  | "draft"
  | "invitation_sent"
  | "in_progress"
  | "submitted"
  | "hr_review"
  | "ready_to_join"
  | "pending_join"
  | "joined"
  | "overdue"
  | "cancelled";

export type InvitationChannel = "email" | "sms" | "whatsapp";

export type PortalStepId =
  | "personal"
  | "government_ids"
  | "bank"
  | "emergency"
  | "documents"
  | "policies"
  | "review";

export type ChecklistOwner = "hr" | "manager";

export type ChecklistTaskStatus = "pending" | "in_progress" | "done" | "blocked";

export type DocumentKind =
  | "photo"
  | "resume"
  | "pan"
  | "aadhaar"
  | "passport"
  | "education"
  | "experience"
  | "cancelled_cheque"
  | "bank_details"
  | "appointment_letter"
  | "relieving_letter"
  | "salary_slips"
  | "previous_employer"
  | "signature"
  | "other";

export type DocumentVerifyStatus = "pending" | "verified" | "rejected" | "accepted";

export const PORTAL_STEPS: { id: PortalStepId; label: string; description: string }[] = [
  { id: "personal", label: "Personal Details", description: "Identity and contact" },
  { id: "government_ids", label: "Government IDs", description: "Aadhaar, PAN, and more" },
  { id: "bank", label: "Bank Details", description: "Salary account (required)" },
  { id: "emergency", label: "Emergency Contact", description: "Primary contact" },
  { id: "documents", label: "Upload Documents", description: "Marksheets, resume, bank & employment proofs" },
  { id: "policies", label: "Policies", description: "Agree and upload signature" },
  { id: "review", label: "Review & Submit", description: "Confirm all steps" },
];

export const DEFAULT_HR_CHECKLIST: { code: string; name: string }[] = [
  { code: "VERIFY_DOCS", name: "Verify Documents" },
  { code: "APPROVE_INFO", name: "Approve Information" },
  { code: "GEN_EMP_ID", name: "Generate Employee ID" },
  { code: "CREATE_PROFILE", name: "Create Employee Profile" },
  { code: "ASSIGN_DEPT", name: "Assign Department" },
  { code: "ASSIGN_SHIFT", name: "Assign Shift" },
  { code: "ASSIGN_LEAVE", name: "Assign Leave Policy" },
  { code: "ASSIGN_ROLE", name: "Assign Role" },
  { code: "GEN_EMAIL", name: "Generate Company Email" },
  { code: "GEN_ID_CARD", name: "Generate ID Card" },
  { code: "CREATE_PAYROLL", name: "Create Payroll Record" },
  { code: "ISSUE_LAPTOP", name: "Issue Laptop" },
  { code: "ISSUE_ASSETS", name: "Issue Assets" },
  { code: "SCHEDULE_ORIENT", name: "Schedule Orientation" },
];

/** HR tasks deferred until after the candidate joins and becomes an employee. */
export const POST_JOIN_HR_CHECKLIST: { code: string; name: string }[] = [
  { code: "GEN_EMP_ID", name: "Generate Employee ID" },
  { code: "CREATE_PROFILE", name: "Create Employee Profile" },
  { code: "ASSIGN_DEPT", name: "Assign Department" },
  { code: "ASSIGN_SHIFT", name: "Assign Shift" },
  { code: "ASSIGN_LEAVE", name: "Assign Leave Policy" },
  { code: "ASSIGN_ROLE", name: "Assign Role" },
  { code: "GEN_EMAIL", name: "Generate Company Email" },
  { code: "GEN_ID_CARD", name: "Generate ID Card" },
  { code: "CREATE_PAYROLL", name: "Create Payroll Record" },
  { code: "ISSUE_LAPTOP", name: "Issue Laptop" },
  { code: "ISSUE_ASSETS", name: "Issue Assets" },
  { code: "SCHEDULE_ORIENT", name: "Schedule Orientation" },
];

export const DEFAULT_MANAGER_CHECKLIST: { code: string; name: string }[] = [
  { code: "CREATE_GOALS", name: "Create Goals" },
  { code: "WELCOME_MEETING", name: "Welcome Meeting" },
  { code: "TEAM_INTRO", name: "Team Introduction" },
];

export const ONBOARDING_STATUS_LABELS: Record<OnboardingCaseStatus, string> = {
  draft: "Draft",
  invitation_sent: "Invitation Sent",
  in_progress: "In Progress",
  submitted: "Submitted",
  hr_review: "HR Review",
  ready_to_join: "Ready to Join",
  pending_join: "Pending Join",
  joined: "Joined",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const POLICY_DOCS = [
  { id: "handbook", label: "Employee Handbook" },
  { id: "nda", label: "NDA" },
  { id: "it_policy", label: "IT Policy" },
  { id: "code_of_conduct", label: "Code of Conduct" },
  { id: "privacy", label: "Privacy Policy" },
] as const;

export type PersonalDetails = {
  photoName?: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dob: string;
  maritalStatus: string;
  nationality: string;
  bloodGroup: string;
  phone: string;
  /** Personal / candidate email (not company email) */
  email: string;
  personalEmail: string;
  /** Current residential address */
  address: string;
  /** Permanent address (may match current) */
  permanentAddress: string;
  /** When true, permanent address mirrors current address */
  sameAsCurrentAddress?: boolean;
};

export type GovernmentIds = {
  aadhaar: string;
  pan: string;
  passport: string;
  drivingLicense: string;
  uan: string;
  esic: string;
};

export type BankDetails = {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  upi: string;
};

export type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
  address: string;
};

export type OnboardingDocument = {
  id: string;
  kind: DocumentKind;
  /** Matches HR Setup Document Types code when driven by catalog. */
  typeCode?: string;
  fileName: string;
  uploadedAt: string;
  verifyStatus: DocumentVerifyStatus;
  notes?: string;
  /** Base64 data URL for HR preview (stored with portal progress in local demo). */
  fileDataUrl?: string;
  mimeType?: string;
};

export type SignedPolicyDocument = {
  policyId: string;
  title: string;
  fileName: string;
  fileDataUrl: string;
  mimeType: string;
  signedAt: string;
};

export type PolicyAcceptance = {
  agreed: boolean;
  signature: string;
  signatureFileName?: string;
  signatureDataUrl?: string;
  /** MIME of uploaded signature (for stamping). */
  signatureMimeType?: string;
  acceptedAt?: string;
  policies: string[];
  /** Policy PDFs stamped with candidate signature at submit. */
  signedDocuments?: SignedPolicyDocument[];
};

export type EducationMarks = {
  tenth: string;
  twelfth: string;
  graduation: string;
};

export type PortalPayload = {
  personal: PersonalDetails;
  governmentIds: GovernmentIds;
  bank: BankDetails;
  emergency: EmergencyContact;
  educationMarks: EducationMarks;
  documents: OnboardingDocument[];
  policies: PolicyAcceptance;
  currentStep: PortalStepId;
  submittedAt?: string;
};

export type ChecklistItem = {
  id: string;
  code: string;
  name: string;
  owner: ChecklistOwner;
  status: ChecklistTaskStatus;
  dueDate?: string;
  completedAt?: string;
  notes?: string;
};

export type OnboardingInvitation = {
  token: string;
  sentAt: string;
  expiresAt: string;
  channel: InvitationChannel;
  resendCount: number;
  lastChannel?: InvitationChannel;
};

export type OnboardingCase = {
  id: string;
  caseCode: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  offerId: string;
  offerCode: string;
  joiningDate: string;
  /** HR Setup → Legal Entities */
  entityId?: string;
  entityName?: string;
  department: string;
  designation: string;
  reportingManager: string;
  branch: string;
  /** Org Setup → Branches row id */
  branchId?: string;
  shift: string;
  leavePolicy: string;
  employmentType: string;
  /** Probation length in days (permanent). Applied on activate. */
  probationPeriodDays?: string;
  /** Training duration in days (intern / trainee). */
  trainingDurationDays?: string;
  managementGroupId?: string;
  managementGroupName?: string;
  employeeId?: string;
  /** How HR will set the employee code when completing onboarding. */
  employeeIdMode?: "auto" | "manual";
  /** Intended employee code when `employeeIdMode` is manual (before completion). */
  assignedEmployeeCode?: string;
  buddy?: string;
  hrOwner: string;
  status: OnboardingCaseStatus;
  invitation?: OnboardingInvitation;
  portal: PortalPayload;
  checklist: ChecklistItem[];
  apiOnboardingId?: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  progressPct: number;
  /** Candidate accepted privacy / T&C before portal steps */
  termsAcceptedAt?: string;
  termsVersion?: string;
};

export type OnboardingAuditEntry = {
  id: string;
  caseId?: string;
  action: string;
  detail: string;
  actor: string;
  at: string;
};

export type OnboardingFilters = {
  status: string;
  department: string;
  joiningFrom: string;
  joiningTo: string;
  overdueOnly: boolean;
};

export function emptyOnboardingFilters(): OnboardingFilters {
  return {
    status: "all",
    department: "all",
    joiningFrom: "",
    joiningTo: "",
    overdueOnly: false,
  };
}

export function emptyPersonal(): PersonalDetails {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    dob: "",
    maritalStatus: "",
    nationality: "Indian",
    bloodGroup: "",
    phone: "",
    email: "",
    personalEmail: "",
    address: "",
    permanentAddress: "",
    sameAsCurrentAddress: false,
  };
}

export function emptyGovernmentIds(): GovernmentIds {
  return { aadhaar: "", pan: "", passport: "", drivingLicense: "", uan: "", esic: "" };
}

export function emptyBank(): BankDetails {
  return {
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    ifsc: "",
    branch: "",
    upi: "",
  };
}

export function emptyEmergency(): EmergencyContact {
  return { name: "", relationship: "", phone: "", address: "" };
}

export function emptyEducationMarks(): EducationMarks {
  return { tenth: "", twelfth: "", graduation: "" };
}

export function emptyPortal(email = "", phone = "", name = ""): PortalPayload {
  const parts = name.trim().split(/\s+/);
  return {
    personal: {
      ...emptyPersonal(),
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      email,
      phone,
    },
    governmentIds: emptyGovernmentIds(),
    bank: emptyBank(),
    emergency: emptyEmergency(),
    educationMarks: emptyEducationMarks(),
    documents: [],
    policies: { agreed: false, signature: "", policies: [] },
    currentStep: "personal",
  };
}

export type StartOnboardingInput = {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  joiningDate: string;
  entityId: string;
  entityName: string;
  department: string;
  designation: string;
  reportingManager: string;
  branch: string;
  employmentType: string;
  probationPeriodDays?: string;
  trainingDurationDays?: string;
  hrOwner?: string;
  invitationExpiryDays: number;
  employeeIdMode?: "auto" | "manual";
  assignedEmployeeCode?: string;
};
