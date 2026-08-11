/** Enterprise Employee Management System — unified view model */

export type EmployeeLifecycleStatus =
  | "active"
  | "inactive"
  | "probation"
  | "notice"
  | "resigned"
  | "archived";

export type EmployeeIdFormatMode = "emp_seq" | "comp_emp";

export type EmployeeIdConfig = {
  mode: EmployeeIdFormatMode;
  prefix: string;
  padding: number;
  companyCode: string;
};

export type AddressBlock = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
};

export type EmergencyContact = {
  name: string;
  phone: string;
  relationship: string;
};

export type GovernmentIds = {
  aadhaar: string;
  aadhaarFileName?: string;
  pan: string;
  panFileName?: string;
  passport: string;
  passportFileName?: string;
  drivingLicense: string;
  drivingLicenseFileName?: string;
  uan: string;
  esic: string;
  voterId: string;
  issueDate: string;
  expiryDate: string;
};

export type BankDetails = {
  accountHolderName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
  swift: string;
  upiId: string;
  cancelledChequeFileName?: string;
};

export type SalaryDetails = {
  basicSalary: string;
  ctc: string;
  salaryStructure: string;
  pf: boolean;
  esi: boolean;
  professionalTax: boolean;
  incomeTaxRegime: string;
  payrollGroup: string;
};

export type EmployeeDocumentItem = {
  id: string;
  documentType: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  fileName: string;
  fileDataUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  /** Where the file came from — onboarding portal vs HR/manual. */
  source?: "onboarding" | "hr" | "manual";
};

export type EducationEntry = {
  id: string;
  degree: string;
  institution: string;
  field: string;
  year: string;
  grade: string;
  /** Optional certificate / marksheet upload */
  certificateFileName?: string;
  certificateDataUrl?: string;
};

export type PreviousEmploymentEntry = {
  id: string;
  company: string;
  designation: string;
  fromDate: string;
  toDate: string;
  lastCtc: string;
  reasonForLeaving: string;
};

export type PersonalInfo = {
  profilePhotoDataUrl?: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  maritalStatus: string;
  bloodGroup: string;
  nationality: string;
  mobile: string;
  alternateMobile: string;
  officialEmail: string;
  personalEmail: string;
  currentAddress: AddressBlock;
  permanentAddress: AddressBlock;
  emergency: EmergencyContact;
};

export type EmploymentInfo = {
  employeeCode: string;
  joiningDate: string;
  departmentId: string;
  departmentName: string;
  designationId: string;
  designationName: string;
  branchId: string;
  branchName: string;
  locationId: string;
  location: string;
  employmentType: string;
  reportingManagerId: string;
  reportingManagerName: string;
  branchHeadName: string;
  departmentHeadName: string;
  grade: string;
  jobLevel: string;
  shiftId: string;
  shiftName: string;
  managementGroupId: string;
  managementGroupName: string;
  entityId: string;
  entityName: string;
  leavePolicyId: string;
  leavePolicyName: string;
  probationPeriodDays: string;
  confirmationDate: string;
  lifecycleStatus: EmployeeLifecycleStatus;
};

export type EmployeeExtension = {
  personal: PersonalInfo;
  employment: EmploymentInfo;
  governmentIds: GovernmentIds;
  /** Bank details the employee provided during onboarding / add-employee. */
  bank: BankDetails;
  /** Salary account opened by the company after hire (manual HR entry). */
  companyBank: BankDetails;
  salary: SalaryDetails;
  documents: EmployeeDocumentItem[];
  education: EducationEntry[];
  previousEmployment: PreviousEmploymentEntry[];
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
};

export type ActivityEvent = {
  id: string;
  employeeId: string;
  type: string;
  title: string;
  detail?: string;
  actor: string;
  at: string;
};

export type AuditEntry = {
  id: string;
  employeeId: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
};

export type EmployeeRecord = {
  id: string;
  masterVersion: number;
  profileId?: string;
  profileVersion?: number;
  employmentId?: string;
  employmentVersion?: number;
  employeeCode: string;
  displayName: string;
  officialEmail: string;
  mobile: string;
  departmentId: string;
  departmentName: string;
  designationName: string;
  branchId: string;
  branchName: string;
  locationId: string;
  locationName: string;
  reportingManagerId: string;
  reportingManagerName: string;
  employmentType: string;
  joiningDate: string;
  lifecycleStatus: EmployeeLifecycleStatus;
  profilePhotoDataUrl?: string;
  gender: string;
  isDeleted: boolean;
  extension: EmployeeExtension;
};

export type EmployeeListFilters = {
  branchId: string;
  entityId: string;
  departmentId: string;
  designation: string;
  employmentType: string;
  status: string;
  reportingManagerId: string;
  location: string;
  joiningFrom: string;
  gender: string;
};

export type EmployeeWizardDraft = {
  personal: PersonalInfo;
  employment: EmploymentInfo;
  governmentIds: GovernmentIds;
  bank: BankDetails;
  companyBank: BankDetails;
  salary: SalaryDetails;
  documents: EmployeeDocumentItem[];
  education: EducationEntry[];
  previousEmployment: PreviousEmploymentEntry[];
};

export const EMPTY_ADDRESS: AddressBlock = {
  line1: "",
  city: "",
  state: "",
  country: "IN",
  pincode: "",
};

export function emptyPersonal(): PersonalInfo {
  return {
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    maritalStatus: "",
    bloodGroup: "",
    nationality: "Indian",
    mobile: "",
    alternateMobile: "",
    officialEmail: "",
    personalEmail: "",
    currentAddress: { ...EMPTY_ADDRESS },
    permanentAddress: { ...EMPTY_ADDRESS },
    emergency: { name: "", phone: "", relationship: "" },
  };
}

export function emptyEmployment(code = ""): EmploymentInfo {
  return {
    employeeCode: code,
    joiningDate: "",
    departmentId: "",
    departmentName: "",
    designationId: "",
    designationName: "",
    branchId: "",
    branchName: "",
    locationId: "",
    location: "",
    employmentType: "permanent",
    reportingManagerId: "",
    reportingManagerName: "",
    branchHeadName: "",
    departmentHeadName: "",
    grade: "",
    jobLevel: "",
    shiftId: "",
    shiftName: "",
    managementGroupId: "",
    managementGroupName: "",
    entityId: "",
    entityName: "",
    leavePolicyId: "",
    leavePolicyName: "",
    probationPeriodDays: "90",
    confirmationDate: "",
    lifecycleStatus: "active",
  };
}

export function emptyGovernmentIds(): GovernmentIds {
  return {
    aadhaar: "",
    pan: "",
    passport: "",
    drivingLicense: "",
    uan: "",
    esic: "",
    voterId: "",
    issueDate: "",
    expiryDate: "",
  };
}

export function emptyBank(): BankDetails {
  return {
    accountHolderName: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifsc: "",
    swift: "",
    upiId: "",
  };
}

export function emptySalary(): SalaryDetails {
  return {
    basicSalary: "",
    ctc: "",
    salaryStructure: "",
    pf: true,
    esi: false,
    professionalTax: true,
    incomeTaxRegime: "new",
    payrollGroup: "",
  };
}

export function emptyEducationEntry(): EducationEntry {
  return {
    id: crypto.randomUUID(),
    degree: "",
    institution: "",
    field: "",
    year: "",
    grade: "",
    certificateFileName: "",
    certificateDataUrl: "",
  };
}

export function emptyPreviousEmploymentEntry(): PreviousEmploymentEntry {
  return {
    id: crypto.randomUUID(),
    company: "",
    designation: "",
    fromDate: "",
    toDate: "",
    lastCtc: "",
    reasonForLeaving: "",
  };
}

export function emptyWizardDraft(nextCode: string): EmployeeWizardDraft {
  return {
    personal: emptyPersonal(),
    employment: emptyEmployment(nextCode),
    governmentIds: emptyGovernmentIds(),
    bank: emptyBank(),
    companyBank: emptyBank(),
    salary: emptySalary(),
    documents: [],
    education: [],
    previousEmployment: [],
  };
}
