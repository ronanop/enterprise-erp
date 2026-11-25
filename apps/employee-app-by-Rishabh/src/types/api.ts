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
  must_change_password?: boolean;
};

export type EssCompanyLookup = {
  company_code: string;
  company_name: string;
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
  department_name?: string | null;
  manager_name?: string | null;
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

export type HrmsLeaveBalance = {
  leave_type_code: string;
  leave_type_name: string;
  opening_balance: number;
  accrued: number;
  used: number;
  closing_balance: number;
  year: number | null;
};

/** Profile pulled by the ERP API from the remote HRMS configured by the tenant admin. */
export type HrmsProfile = {
  user_id: string;
  employee_id: string | null;
  employee_code: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  designation: string;
  department: string;
  manager: string;
  manager_code: string;
  branch: string;
  company: string;
  status: string;
  date_of_joining: string | null;
  date_of_leaving: string | null;
  gender: string | null;
  date_of_birth: string | null;
  employment_type: string | null;
  work_location: string | null;
  is_manager: boolean;
  leave_balances: HrmsLeaveBalance[];
  leave_balance_total: number;
  leave_used_total: number;
  profile_fetched_at: string | null;
  leave_fetched_at: string | null;
  leave_refreshed: boolean;
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

/** Instagram-style workplace feed */
export type EssFeedAspectRatio = "1:1" | "3:4" | "4:3";

export type EssFeedMediaItem = {
  id: string;
  media_type: "image" | "video" | string;
  sort_order: number;
  content_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  processing_status: string;
  url: string;
};

export type EssFeedPost = {
  id: string;
  author_employee_id: string;
  author_name: string;
  author_employee_code: string;
  caption: string | null;
  aspect_ratio: EssFeedAspectRatio | string;
  status: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  published_at: string;
  media: EssFeedMediaItem[];
};

export type EssFeedComment = {
  id: string;
  post_id: string;
  author_employee_id: string;
  author_name: string;
  body: string;
  is_edited: boolean;
  created_at: string;
};

export type EssFeedMediaUpload = {
  media_type: "image" | "video";
  file_name: string;
  content_base64: string;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
};

export type EssFeedPostCreate = {
  caption?: string | null;
  aspect_ratio: EssFeedAspectRatio;
  media: EssFeedMediaUpload[];
};

/** Instagram-style Stories (24h) */
export type EssStoryTrayAuthor = {
  author_employee_id: string;
  author_name: string;
  author_employee_code: string;
  is_me: boolean;
  has_unseen: boolean;
  story_count: number;
  latest_published_at: string;
};

export type EssStoryOverlay = {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  font_size: number;
  background_enabled?: boolean;
  background_color?: string;
};

export type EssStoryMention = {
  employee_id: string;
  display_name: string;
  email?: string | null;
};

export type EssStoryMentionSearchHit = {
  employee_id: string;
  display_name: string;
  email: string;
  employee_code: string;
  name_is_duplicate: boolean;
};

export type EssStoryItem = {
  id: string;
  author_employee_id: string;
  author_name: string;
  author_employee_code: string;
  media_type: "image" | "video" | string;
  content_type: string;
  caption: string | null;
  overlays?: EssStoryOverlay[];
  mentions?: EssStoryMention[];
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  published_at: string;
  expires_at: string;
  viewed_by_me: boolean;
  liked_by_me?: boolean;
  like_count?: number;
  url: string;
};

export type EssStoryCreate = {
  media_type: "image" | "video";
  file_name: string;
  content_base64: string;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
  overlays?: EssStoryOverlay[];
  mentions?: { employee_id: string; display_name: string }[];
};

/** Workplace Tasks */
export type EssEmployeeDirectoryItem = {
  employee_id: string;
  employee_code: string;
  name: string;
  initials: string;
  company_code?: string;
  designation?: string;
  is_manager?: boolean;
  department_id?: string | null;
  department_name?: string;
};

export type EssDepartmentDirectoryItem = {
  department_id: string;
  department_code: string;
  department_name: string;
  company_code?: string;
  member_count?: number;
  head_employee_id?: string | null;
  head_name?: string;
  head_employee_code?: string;
  assignable: boolean;
};

export type EssTaskProofItem = {
  id: string;
  assignee_id: string;
  file_name: string;
  content_type: string;
  byte_size: number;
  note?: string;
  download_path: string;
  created_at: string;
};

export type EssTaskMilestone = {
  key: string;
  label: string;
  done: boolean;
};

export type EssTaskAssigneeItem = {
  id: string;
  employee_id: string;
  employee_code: string;
  name: string;
  initials: string;
  status: string;
  responded_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  review_note?: string;
  submitted_at?: string | null;
  verified_at?: string | null;
  proofs?: EssTaskProofItem[];
  milestones?: EssTaskMilestone[];
};

export type EssTaskEventItem = {
  id: string;
  event_type: string;
  label: string;
  detail?: string;
  actor_name?: string | null;
  created_at: string;
};

export type EssTaskItem = {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  status: string;
  assignment_mode: "users" | "department" | string;
  department_id?: string | null;
  department_name?: string;
  department_code?: string;
  can_reassign_within_department?: boolean;
  can_verify?: boolean;
  creator_employee_id: string;
  creator_name: string;
  creator_initials: string;
  creator_employee_code?: string;
  assignee_count: number;
  assignees: EssTaskAssigneeItem[];
  my_assignee_status: string | null;
  events?: EssTaskEventItem[];
  created_at: string;
};

export type EssTaskCreate = {
  title: string;
  description?: string;
  deadline?: string | null;
  assignment_mode: "users" | "department";
  assignee_employee_ids?: string[];
  department_id?: string | null;
};

export type EssTaskReassign = {
  assignee_employee_ids: string[];
};

export type EssTaskTransfer = {
  assignment_mode: "users" | "department";
  assignee_employee_ids?: string[];
  department_id?: string | null;
  note?: string;
};

export type EssTaskProofFileInput = {
  file_base64: string;
  file_name: string;
  content_type?: string | null;
};

export type EssTaskCompleteBody = {
  note?: string;
  files: EssTaskProofFileInput[];
};

export type EssTaskRequestRedoBody = {
  reason: string;
  title?: string | null;
  description?: string | null;
  deadline?: string | null;
};
