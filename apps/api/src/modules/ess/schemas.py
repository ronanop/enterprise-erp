"""ESS request/response schemas."""

from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class EssMeResponse(BaseModel):
    employee_id: UUID
    company_id: UUID
    branch_id: UUID
    department_id: UUID
    employee_code: str
    first_name: str
    last_name: str
    email: str
    mobile: str
    designation: str
    date_of_joining: date
    status: str
    display_name: str
    department_name: str | None = None
    manager_name: str | None = None
    company_name: str | None = None
    branch_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    marital_status: str | None = None
    nationality: str | None = None
    blood_group: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    has_profile_photo: bool = False
    photo_url: str | None = None
    role_codes: list[str] = Field(default_factory=list)
    ess_role: str = "employee"
    is_manager: bool = False
    can_approve_team_leave: bool = False
    pending_approvals_count: int = 0
    must_change_password: bool = False
    pending_policy_count: int = 0
    is_ess_admin: bool = False
    admin_use_web_portal: bool = False


class EssMeUpdate(BaseModel):
    mobile: str | None = None


class EssLeaveRequestCreate(BaseModel):
    leave_type_id: UUID
    start_date: date
    end_date: date
    days_count: Decimal = Field(gt=0)
    reason: str | None = None


class EssLeaveTypeResponse(OrmModel):
    id: UUID
    leave_type_code: str
    leave_type_name: str
    is_paid: bool
    max_days_per_year: Decimal | None
    monthly_credit_days: Decimal | None = None
    status: str


class EssLeaveBalanceResponse(OrmModel):
    id: UUID
    leave_type_id: UUID
    balance_year: int
    opening_balance: Decimal
    accrued: Decimal
    used: Decimal
    closing_balance: Decimal
    status: str


class EssLeaveRequestResponse(OrmModel):
    id: UUID
    document_number: str
    leave_type_id: UUID
    start_date: date
    end_date: date
    days_count: Decimal
    reason: str | None = None
    status: str


class EssAttendanceResponse(BaseModel):
    id: UUID
    attendance_date: date
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    total_hours: Decimal | None = None
    attendance_status: str
    source: str
    status: str
    late_minutes: int | None = None
    overtime_minutes: int | None = None
    early_leave_minutes: int | None = None


class EssAttendanceSummaryResponse(BaseModel):
    month: str
    present_days: int
    late_days: int
    total_overtime_minutes: int
    work_from_home_days: int


class EssWorkLocationItem(BaseModel):
    id: UUID
    location_name: str
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    geofence_radius_meters: int | None = None
    location_type: str | None = None
    is_home: bool = False


class EssPunchPolicyResponse(BaseModel):
    geofence_required: bool = False
    selfie_required: bool = False
    face_at_punch_required: bool = False
    face_enrolled: bool = False
    work_locations: list[EssWorkLocationItem] = Field(default_factory=list)
    home_office_name: str | None = None


class EssPunchRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    image_base64: str | None = Field(default=None, min_length=32)


class EssPunchResponse(BaseModel):
    action: str
    attendance: EssAttendanceResponse


class EssBankResponse(BaseModel):
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    bank_account_holder: str | None = None


class EssBankUpdate(BaseModel):
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    bank_name: str | None = None
    bank_account_holder: str | None = None


class EssKycResponse(BaseModel):
    aadhaar_number: str | None = None
    pan_number: str | None = None
    uan_number: str | None = None


class EssDocumentResponse(OrmModel):
    id: UUID
    document_number: str
    document_type: str
    document_name: str
    storage_uri: str
    issued_on: date | None = None
    expires_on: date | None = None
    verification_status: str
    status: str


class EssDocumentUploadBody(BaseModel):
    document_type: str = Field(
        ...,
        description="id_proof | address_proof | contract | certificate | other",
    )
    document_name: str = Field(..., min_length=1, max_length=255)
    file_name: str = Field(..., min_length=1, max_length=255)
    content_base64: str = Field(..., min_length=1)
    content_type: str | None = None
    issued_on: date | None = None
    expires_on: date | None = None


class EssHolidayCalendarResponse(OrmModel):
    id: UUID
    calendar_code: str
    calendar_name: str
    calendar_year: int
    holidays_json: list | dict | None = None
    status: str
    branch_id: UUID | None = None


class EssNotificationResponse(BaseModel):
    id: UUID
    title: str
    body: str
    kind: str
    read: bool
    created_at: datetime
    href: str | None = None


class EssPayslipSummary(BaseModel):
    id: UUID
    document_number: str
    employee_code: str | None = None
    employee_name: str | None = None
    payroll_period_id: UUID
    period_name: str | None = None
    period_start: str | None = None
    period_end: str | None = None
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    issued_at: datetime | None = None
    delivery_status: str
    payment_status: str
    status: str


class EssPayslipDetail(EssPayslipSummary):
    payslip_json: dict | None = None
    export_text: str | None = None
    attendance_summary: dict | None = None
    earnings: list[dict] | None = None
    deductions: list[dict] | None = None
    company_id: UUID
    branch_id: UUID


class EssEmergencyContactResponse(BaseModel):
    name: str | None = None
    mobile: str | None = None
    blood_group: str | None = None
    relationship: str | None = None


class EssEmergencyUpdate(BaseModel):
    emergency_contact_name: str | None = None
    emergency_contact_mobile: str | None = None


class EssEducationItem(BaseModel):
    id: str | None = None
    degree: str
    institution: str | None = None
    field_of_study: str | None = None
    start_year: int | None = None
    end_year: int | None = None
    grade: str | None = None


class EssSkillItem(BaseModel):
    id: str | None = None
    name: str
    level: str | None = None
    years: float | None = None


class EssEducationSkillsResponse(BaseModel):
    education: list[EssEducationItem] = []
    skills: list[EssSkillItem] = []


class EssEducationSkillsUpdate(BaseModel):
    education: list[EssEducationItem] | None = None
    skills: list[EssSkillItem] | None = None


class EssTeamLeaveItem(BaseModel):
    id: UUID
    employee_id: UUID
    employee_code: str
    display_name: str
    document_number: str
    start_date: date
    end_date: date
    days_count: Decimal
    status: str


class EssTeamMember(BaseModel):
    """Direct report shown on the manager Team screen."""

    employee_id: UUID
    employee_code: str
    display_name: str
    designation: str
    email: str
    mobile: str
    department_name: str | None = None
    status: str


class EssApprovalItem(BaseModel):
    """Pending manager action for a direct report."""

    category: str
    id: UUID
    employee_id: UUID
    employee_code: str
    display_name: str
    title: str
    detail: str
    status: str
    occurred_at: datetime


class EssUnreadCountResponse(BaseModel):
    unread_count: int


class EssNotificationPollResponse(BaseModel):
    unread_count: int
    latest: EssNotificationResponse | None = None


class EssAnnouncementItem(BaseModel):
    id: str
    title: str
    body: str
    tag: str = "News"
    pinned: bool = False
    published_on: date | None = None


class EssAssetItem(BaseModel):
    id: UUID
    asset_code: str
    asset_name: str
    asset_type: str
    serial_number: str | None = None
    status: str
    assignment_status: str | None = None


class EssTrainingItem(BaseModel):
    id: UUID
    training_id: UUID
    training_code: str
    training_name: str
    training_type: str | None = None
    start_date: date | None = None
    attendance_status: str
    status: str


class EssPerformanceItem(BaseModel):
    id: UUID
    document_number: str
    review_cycle: str
    period_start: date | None = None
    period_end: date | None = None
    overall_rating: int | None = None
    status: str


class EssSeparationItem(BaseModel):
    id: UUID
    document_number: str
    separation_type: str
    requested_last_working_date: date
    status: str
    fnf_status: str | None = None
    notice_status: str | None = None
    expected_exit_date: date | None = None
    notice_period_days: int | None = None


class EssSeparationCreate(BaseModel):
    separation_type: str = "resignation"
    requested_last_working_date: date
    reason: str | None = None
    resignation_date: date | None = None
    notice_period_days: int | None = None


class EssAttendanceCorrectionCreate(BaseModel):
    attendance_date: date
    field_name: str = "check_out"
    new_value: str
    reason: str | None = None
    attendance_id: UUID | None = None
    old_value: str | None = None
    submit: bool = True


class EssAttendanceCorrectionResponse(OrmModel):
    id: UUID
    attendance_date: date
    field_name: str
    old_value: str | None = None
    new_value: str
    reason: str | None = None
    status: str
    attendance_id: UUID | None = None


class EssOnDutyCreate(BaseModel):
    duty_date: date
    end_date: date | None = None
    portion: str = "full_day"
    duty_location: str | None = None
    purpose: str | None = None
    reason: str | None = None


class EssOnDutyResponse(OrmModel):
    id: UUID
    duty_date: date
    end_date: date | None = None
    portion: str
    duty_location: str | None = None
    purpose: str | None = None
    reason: str | None = None
    status: str


class EssWfhCreate(BaseModel):
    wfh_date: date
    end_date: date | None = None
    portion: str = "full_day"
    reason: str | None = None


class EssWfhResponse(OrmModel):
    id: UUID
    wfh_date: date
    end_date: date | None = None
    portion: str
    reason: str | None = None
    status: str


class EssProfileUpdateCreate(BaseModel):
    notes: str | None = None


class EssProfileUpdateResponse(OrmModel):
    id: UUID
    notes: str | None = None
    status: str
    created_at: datetime | None = None
    decided_at: datetime | None = None
    decision_notes: str | None = None


class EssCompoffCreate(BaseModel):
    earned_date: date
    extra_hours: float
    requested_days: float | None = None
    reason: str | None = None


class EssCompoffResponse(OrmModel):
    id: UUID
    earned_date: date
    extra_hours: float
    requested_days: float
    reason: str | None = None
    status: str


class EssDeviceTokenRegister(BaseModel):
    token: str
    platform: str = "web"


class EssFaceImageBody(BaseModel):
    image_base64: str = Field(min_length=32)


class EssFaceStatusResponse(BaseModel):
    enrolled: bool
    enabled: bool
    verification_required: bool


class EssFaceVerifyResponse(BaseModel):
    verified: bool
    message: str


class EssFaceEnabledBody(BaseModel):
    enabled: bool = True


# --- Phase 5: workplace (rooms, assets, support) ---


class EssMeetingRoomItem(BaseModel):
    id: UUID
    room_code: str
    room_name: str
    capacity: int
    equipment_json: list | None = None
    notes: str | None = None
    status: str


class EssMeetingBookingResponse(BaseModel):
    id: UUID
    room_id: UUID | None
    room_name: str | None = None
    title: str
    request_date: date
    start_time: time | None = None
    end_time: time | None = None
    status: str
    requested_by_employee_id: UUID
    requested_by_name: str | None = None


class EssMeetingRoomAvailability(BaseModel):
    room: EssMeetingRoomItem
    is_busy: bool
    bookings: list[EssMeetingBookingResponse] = []


class EssMeetingBookingCreate(BaseModel):
    room_id: UUID
    title: str
    request_date: date
    start_time: time | None = None
    end_time: time | None = None
    agenda: str | None = None


class EssAssetDetail(EssAssetItem):
    qr_code: str | None = None
    barcode: str | None = None


class EssSupportTicketItem(BaseModel):
    id: UUID
    document_number: str
    subject: str
    status: str
    kind: str
    urgency: str | None = None
    created_at: datetime
    asset_id: UUID | None = None


class EssSupportTicketDetail(EssSupportTicketItem):
    description: str | None = None
    opened_at: datetime | None = None
    resolved_at: datetime | None = None


class EssSupportTicketCreate(BaseModel):
    kind: str = "it"
    subject: str
    description: str | None = None
    urgency: str | None = None
    asset_id: UUID | None = None


class EssSupportTicketCommentItem(BaseModel):
    id: UUID
    body: str
    commented_at: datetime
    author_employee_id: UUID | None = None


class EssSupportTicketCommentCreate(BaseModel):
    body: str


class EssAssetTicketCreate(BaseModel):
    subject: str | None = None
    description: str
    problem_category: str | None = None
    urgency: str | None = None


# --- Phase 6: compliance ---


class EssPolicyStep(BaseModel):
    order: int
    title: str
    body: str


class EssPolicyItem(BaseModel):
    id: UUID
    policy_code: str
    title: str
    policy_version: int
    is_mandatory: bool
    acknowledged: bool
    step_count: int = 0


class EssPolicyWalkthrough(BaseModel):
    id: UUID
    policy_code: str
    title: str
    policy_version: int
    is_mandatory: bool
    acknowledged: bool
    steps: list[EssPolicyStep]


class EssPolicyAckResponse(BaseModel):
    policy_id: UUID
    policy_version: int
    acknowledged_at: datetime


class EssChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


class EssFeedImageInput(BaseModel):
    file_base64: str = Field(..., min_length=1)
    content_type: str | None = None
    file_name: str | None = None


class EssFeedPostCreate(BaseModel):
    caption: str = ""
    images: list[EssFeedImageInput] | None = None
    # Legacy single-photo fields (still accepted)
    file_base64: str | None = Field(default=None, min_length=1)
    content_type: str | None = None
    file_name: str | None = None

    def resolved_images(self) -> list[EssFeedImageInput]:
        imgs = list(self.images or [])
        if not imgs and self.file_base64:
            imgs = [
                EssFeedImageInput(
                    file_base64=self.file_base64,
                    content_type=self.content_type,
                    file_name=self.file_name,
                )
            ]
        return imgs


class EssFeedPostCaptionUpdate(BaseModel):
    caption: str = Field(default="", max_length=2000)


class EssFeedMediaItem(BaseModel):
    sort_order: int
    content_type: str


class EssFeedPostItem(BaseModel):
    id: UUID
    author_employee_id: UUID
    author_name: str
    author_initials: str
    caption: str
    like_count: int
    comment_count: int
    liked_by_me: bool
    created_at: datetime
    image_content_type: str
    image_count: int = 1
    images: list[EssFeedMediaItem] = Field(default_factory=list)


class EssFeedLikeResponse(BaseModel):
    post_id: UUID
    liked_by_me: bool
    like_count: int


class EssFeedCommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000)


class EssFeedCommentItem(BaseModel):
    id: UUID
    post_id: UUID
    author_employee_id: UUID
    author_name: str
    body: str
    created_at: datetime


class EssEmployeeDirectoryItem(BaseModel):
    employee_id: UUID
    employee_code: str
    name: str
    initials: str
    company_code: str = ""
    designation: str = ""
    is_manager: bool = False
    department_id: UUID | None = None
    department_name: str = ""


class EssDepartmentDirectoryItem(BaseModel):
    department_id: UUID
    department_code: str
    department_name: str
    company_code: str = ""
    member_count: int = 0
    head_employee_id: UUID | None = None
    head_name: str = ""
    head_employee_code: str = ""
    assignable: bool = False


class EssTaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    deadline: datetime | None = None
    assignment_mode: str = Field(default="users", pattern="^(users|department)$")
    assignee_employee_ids: list[UUID] = Field(default_factory=list)
    department_id: UUID | None = None


class EssTaskReassign(BaseModel):
    assignee_employee_ids: list[UUID] = Field(..., min_length=1)


class EssTaskProofFileInput(BaseModel):
    file_base64: str = Field(..., min_length=1)
    file_name: str = Field(..., min_length=1, max_length=255)
    content_type: str | None = None


class EssTaskCompleteBody(BaseModel):
    note: str = ""
    files: list[EssTaskProofFileInput] = Field(..., min_length=1, max_length=5)


class EssTaskRequestRedoBody(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    deadline: datetime | None = None


class EssTaskMilestone(BaseModel):
    key: str
    label: str
    done: bool


class EssTaskProofItem(BaseModel):
    id: UUID
    assignee_id: UUID
    file_name: str
    content_type: str
    byte_size: int
    note: str = ""
    download_path: str
    created_at: datetime


class EssTaskAssigneeItem(BaseModel):
    id: UUID
    employee_id: UUID
    employee_code: str
    name: str
    initials: str
    status: str
    responded_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    review_note: str = ""
    submitted_at: datetime | None = None
    verified_at: datetime | None = None
    proofs: list[EssTaskProofItem] = Field(default_factory=list)
    milestones: list[EssTaskMilestone] = Field(default_factory=list)


class EssTaskEventItem(BaseModel):
    id: UUID
    event_type: str
    label: str
    detail: str = ""
    actor_name: str | None = None
    created_at: datetime


class EssTaskItem(BaseModel):
    id: UUID
    title: str
    description: str
    deadline: datetime | None = None
    status: str
    assignment_mode: str = "users"
    department_id: UUID | None = None
    department_name: str = ""
    department_code: str = ""
    can_reassign_within_department: bool = False
    can_verify: bool = False
    creator_employee_id: UUID
    creator_name: str
    creator_initials: str
    creator_employee_code: str = ""
    assignee_count: int
    assignees: list[EssTaskAssigneeItem] = Field(default_factory=list)
    my_assignee_status: str | None = None
    events: list[EssTaskEventItem] = Field(default_factory=list)
    created_at: datetime
