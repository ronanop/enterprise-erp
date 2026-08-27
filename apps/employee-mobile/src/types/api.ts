export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T | null;
};

export type ErrorResponse = {
  success: false;
  message: string;
  errors?: string[];
};

export type TokenData = {
  access_token: string | null;
  refresh_token: string | null;
  token_type: string;
  session_id: string | null;
  mfa_required: boolean;
  mfa_challenge_token: string | null;
};

export type AuthUser = {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  user_type: string;
  status: string;
  mfa_enabled: boolean;
  role_ids: string[];
};

export type UserProfile = {
  user: AuthUser;
  permissions: string[];
};

export type EssMe = {
  employee_id: string;
  company_id: string;
  branch_id: string;
  department_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  designation: string;
  date_of_joining: string;
  status: string;
  display_name: string;
  role_codes?: string[];
  ess_role?: "employee" | "manager" | "admin";
  is_manager?: boolean;
  can_approve_team_leave?: boolean;
  pending_approvals_count?: number;
  must_change_password?: boolean;
  pending_policy_count?: number;
  is_ess_admin?: boolean;
  admin_use_web_portal?: boolean;
};

export type EssLeaveType = {
  id: string;
  leave_type_code: string;
  leave_type_name: string;
  is_paid: boolean;
  max_days_per_year: string | number | null;
  monthly_credit_days?: string | number | null;
  status: string;
};

export type EssLeaveBalance = {
  id: string;
  leave_type_id: string;
  balance_year: number;
  opening_balance: string | number;
  accrued: string | number;
  used: string | number;
  closing_balance: string | number;
  status: string;
};

export type EssLeaveRequest = {
  id: string;
  document_number: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_count: string | number;
  reason: string | null;
  status: string;
};

export type EssApprovalItem = {
  category: "leave" | "on_duty" | "compoff" | "attendance_correction" | "wfh";
  id: string;
  employee_id: string;
  employee_code: string;
  display_name: string;
  title: string;
  detail: string;
  status: string;
  occurred_at: string;
};

export type EssAttendance = {
  id: string;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_hours: string | number | null;
  attendance_status: string;
  source: string;
  status: string;
  late_minutes?: number | null;
  overtime_minutes?: number | null;
  early_leave_minutes?: number | null;
};

export type EssAttendanceSummary = {
  month: string;
  present_days: number;
  late_days: number;
  total_overtime_minutes: number;
  work_from_home_days: number;
};

export type EssPunchPolicy = {
  geofence_required: boolean;
  selfie_required: boolean;
  face_at_punch_required: boolean;
  face_enrolled: boolean;
};

export type EssWfhRequest = {
  id: string;
  wfh_date: string;
  end_date: string | null;
  portion: string;
  reason: string | null;
  status: string;
};

export type EssPunch = {
  action: string;
  attendance: EssAttendance;
};

export type EssPayslip = {
  id: string;
  document_number: string;
  employee_code: string | null;
  employee_name: string | null;
  payroll_period_id: string;
  period_name?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  gross_salary: string | number;
  total_deductions: string | number;
  net_salary: string | number;
  issued_at: string | null;
  delivery_status: string;
  payment_status: string;
  status: string;
  payslip_json?: Record<string, unknown> | null;
  export_text?: string | null;
  attendance_summary?: Record<string, unknown> | null;
  earnings?: Array<{ code?: string; label?: string; amount?: number }> | null;
  deductions?: Array<{ code?: string; label?: string; amount?: number }> | null;
  company_id?: string;
  branch_id?: string;
};

export type EssBank = {
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_name: string | null;
  bank_account_holder: string | null;
};

export type EssKyc = {
  aadhaar_number: string | null;
  pan_number: string | null;
  uan_number: string | null;
};

export type EssDocument = {
  id: string;
  document_number: string;
  document_type: string;
  document_name: string;
  storage_uri: string;
  issued_on: string | null;
  expires_on: string | null;
  verification_status: string;
  status: string;
};

export type EssHolidayCalendar = {
  id: string;
  calendar_code: string;
  calendar_name: string;
  calendar_year: number;
  holidays_json: Array<{ date?: string; name?: string; kind?: string }> | Record<string, unknown> | null;
  status: string;
  branch_id: string | null;
};

export type EssNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  created_at: string;
  href?: string | null;
};

export type EssEmergencyContact = {
  name: string | null;
  mobile: string | null;
  blood_group: string | null;
  relationship: string | null;
};

export type EssFaceStatus = {
  enrolled: boolean;
  enabled: boolean;
  verification_required: boolean;
};

export type EssFaceVerifyResult = {
  verified: boolean;
  message: string;
};

export type EssEducationItem = {
  id?: string | null;
  degree: string;
  institution?: string | null;
  field_of_study?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  grade?: string | null;
};

export type EssSkillItem = {
  id?: string | null;
  name: string;
  level?: string | null;
  years?: number | null;
};

export type EssEducationSkills = {
  education: EssEducationItem[];
  skills: EssSkillItem[];
};

export type EssTeamLeaveItem = {
  id: string;
  employee_id: string;
  employee_code: string;
  display_name: string;
  document_number: string;
  start_date: string;
  end_date: string;
  days_count: string | number;
  status: string;
};

export type EssAnnouncement = {
  id: string;
  title: string;
  body: string;
  tag: string;
  pinned: boolean;
  published_on: string | null;
};

export type EssAsset = {
  id: string;
  asset_code: string;
  asset_name: string;
  asset_type: string;
  serial_number: string | null;
  status: string;
  assignment_status: string | null;
};

export type EssAssetDetail = EssAsset & {
  qr_code: string | null;
  barcode: string | null;
};

export type EssMeetingRoom = {
  id: string;
  room_code: string;
  room_name: string;
  capacity: number;
  equipment_json: string[] | null;
  notes: string | null;
  status: string;
};

export type EssMeetingBooking = {
  id: string;
  room_id: string | null;
  room_name: string | null;
  title: string;
  request_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  requested_by_employee_id: string;
  requested_by_name?: string | null;
};

export type EssMeetingRoomAvailability = {
  room: EssMeetingRoom;
  is_busy: boolean;
  bookings: EssMeetingBooking[];
};

export type EssSupportTicket = {
  id: string;
  document_number: string;
  subject: string;
  status: string;
  kind: string;
  urgency: string | null;
  created_at: string;
  asset_id: string | null;
};

export type EssSupportTicketDetail = EssSupportTicket & {
  description: string | null;
  opened_at: string | null;
  resolved_at: string | null;
};

export type EssSupportTicketComment = {
  id: string;
  body: string;
  commented_at: string;
  author_employee_id: string | null;
};

export type EssPolicyItem = {
  id: string;
  policy_code: string;
  title: string;
  policy_version: number;
  is_mandatory: boolean;
  acknowledged: boolean;
  step_count: number;
};

export type EssPolicyStep = {
  order: number;
  title: string;
  body: string;
};

export type EssPolicyWalkthrough = EssPolicyItem & {
  steps: EssPolicyStep[];
};

export type EssTrainingItem = {
  id: string;
  training_id: string;
  training_code: string;
  training_name: string;
  training_type: string | null;
  start_date: string | null;
  attendance_status: string;
  status: string;
};

export type EssPerformanceItem = {
  id: string;
  document_number: string;
  review_cycle: string;
  period_start: string | null;
  period_end: string | null;
  overall_rating: number | null;
  status: string;
};

export type EssSeparationItem = {
  id: string;
  document_number: string;
  separation_type: string;
  requested_last_working_date: string;
  status: string;
  fnf_status: string | null;
  notice_status?: string | null;
  expected_exit_date?: string | null;
  notice_period_days?: number | null;
};
