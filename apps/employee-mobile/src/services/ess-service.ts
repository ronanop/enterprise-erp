import { mockApi } from "@/data/mock-ess";
import { readGeolocation } from "@/lib/geolocation";
import { ApiClientError, apiClient, apiClientBytes } from "@/services/api-client";
import type {
  EssAnnouncement,
  EssApprovalItem,
  EssAsset,
  EssAssetDetail,
  EssAttendance,
  EssAttendanceSummary,
  EssBank,
  EssDocument,
  EssEducationSkills,
  EssEmergencyContact,
  EssFaceStatus,
  EssFaceVerifyResult,
  EssHolidayCalendar,
  EssKyc,
  EssLeaveBalance,
  EssLeaveRequest,
  EssLeaveType,
  EssMe,
  EssMeetingBooking,
  EssMeetingRoom,
  EssMeetingRoomAvailability,
  EssNotification,
  EssPayslip,
  EssPolicyItem,
  EssPolicyWalkthrough,
  EssPunch,
  EssPunchPolicy,
  EssSeparationItem,
  EssSupportTicket,
  EssSupportTicketComment,
  EssSupportTicketDetail,
  EssTeamLeaveItem,
  EssTrainingItem,
  EssPerformanceItem,
  EssWfhRequest,
} from "@/types/api";
import { env } from "@/utils/env";

async function wrapMock<T>(
  fn: () => Promise<{ success: boolean; message: string; data: T | null }>,
) {
  try {
    return await fn();
  } catch (err) {
    throw new ApiClientError(
      err instanceof Error ? err.message : "Demo action failed",
      400,
    );
  }
}

let essMeInflight: Promise<Awaited<ReturnType<typeof apiClient<EssMe>>>> | null =
  null;

function essMe() {
  if (env.useMock) return wrapMock(() => mockApi.me());
  if (!essMeInflight) {
    essMeInflight = apiClient<EssMe>("/ess/me").finally(() => {
      essMeInflight = null;
    });
  }
  return essMeInflight;
}

export const essService = {
  me: essMe,

  leaveTypes: () =>
    env.useMock
      ? wrapMock(() => mockApi.leaveTypes())
      : apiClient<EssLeaveType[]>("/ess/leave-types"),

  leaveBalances: () =>
    env.useMock
      ? wrapMock(() => mockApi.leaveBalances())
      : apiClient<EssLeaveBalance[]>("/ess/leave-balances"),

  leaveRequests: () =>
    env.useMock
      ? wrapMock(() => mockApi.leaveRequests())
      : apiClient<EssLeaveRequest[]>("/ess/leave-requests"),

  leaveRequest: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.leaveRequest(id))
      : apiClient<EssLeaveRequest>(`/ess/leave-requests/${id}`),

  createLeaveRequest: (body: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_count: string | number;
    reason?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.createLeaveRequest(body))
      : apiClient<EssLeaveRequest>("/ess/leave-requests", {
          method: "POST",
          body,
        }),

  cancelLeaveRequest: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.cancelLeaveRequest(id))
      : apiClient<EssLeaveRequest>(`/ess/leave-requests/${id}/cancel`, {
          method: "POST",
          body: {},
        }),

  attendance: (fromDate?: string, toDate?: string) =>
    env.useMock
      ? wrapMock(() => mockApi.attendance())
      : apiClient<EssAttendance[]>("/ess/attendance", {
          query: { from_date: fromDate, to_date: toDate },
        }),

  attendanceSummary: (month: string) =>
    env.useMock
      ? wrapMock(() => mockApi.attendanceSummary(month))
      : apiClient<EssAttendanceSummary>("/ess/attendance/summary", {
          query: { month },
        }),

  punchPolicy: () =>
    env.useMock
      ? wrapMock(() => mockApi.punchPolicy())
      : apiClient<EssPunchPolicy>("/ess/attendance/punch-policy"),

  punch: async (opts?: { image_base64?: string | null }) => {
    if (env.useMock) return wrapMock(() => mockApi.punch());
    const coords = await readGeolocation();
    const body: Record<string, unknown> = { ...coords };
    if (opts?.image_base64) body.image_base64 = opts.image_base64;
    return apiClient<EssPunch>("/ess/attendance/punch", {
      method: "POST",
      body,
    });
  },

  payslips: () =>
    env.useMock
      ? wrapMock(() => mockApi.payslips())
      : apiClient<EssPayslip[]>("/ess/payslips"),

  payslip: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.payslip(id))
      : apiClient<EssPayslip>(`/ess/payslips/${id}`),

  /** Returns payslip export text/bytes for sharing. */
  downloadPayslipText: async (id: string) => {
    if (env.useMock) {
      const res = await mockApi.payslip(id);
      const p = res.data!;
      return [
        `Payslip ${p.document_number}`,
        `Employee: ${p.employee_name ?? ""} (${p.employee_code ?? ""})`,
        `Gross: ${p.gross_salary}`,
        `Deductions: ${p.total_deductions}`,
        `Net: ${p.net_salary}`,
        `Status: ${p.payment_status}`,
      ].join("\n");
    }
    const bytes = await apiClientBytes(`/ess/payslips/${id}/download`);
    return new TextDecoder().decode(bytes);
  },

  holidays: () =>
    env.useMock
      ? wrapMock(() => mockApi.holidays())
      : apiClient<EssHolidayCalendar[]>("/ess/holidays"),

  notifications: () =>
    env.useMock
      ? wrapMock(() => mockApi.notifications())
      : apiClient<EssNotification[]>("/ess/notifications"),

  notificationUnreadCount: () =>
    env.useMock
      ? wrapMock(() => mockApi.notificationUnreadCount())
      : apiClient<{ unread_count: number }>("/ess/notifications/unread-count"),

  markNotificationRead: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.markNotificationRead(id))
      : apiClient(`/ess/notifications/${id}/read`, {
          method: "POST",
          body: {},
        }),

  markAllNotificationsRead: () =>
    env.useMock
      ? wrapMock(() => mockApi.markAllNotificationsRead())
      : apiClient<{ marked: number }>("/ess/notifications/read-all", {
          method: "POST",
          body: {},
        }),

  registerDeviceToken: (body: { token: string; platform?: string }) =>
    env.useMock
      ? wrapMock(() => mockApi.registerDeviceToken())
      : apiClient("/ess/device-tokens", { method: "POST", body }),

  faceStatus: () =>
    env.useMock
      ? wrapMock(() => mockApi.faceStatus())
      : apiClient<EssFaceStatus>("/ess/security/face/status"),

  faceVerify: (image_base64: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: { verified: true, message: "OK" } satisfies EssFaceVerifyResult,
        }))
      : apiClient<EssFaceVerifyResult>("/ess/security/face/verify", {
          method: "POST",
          body: { image_base64 },
        }),

  changePassword: (body: {
    current_password: string;
    new_password: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.changePassword())
      : apiClient<{ ok: boolean }>("/ess/security/change-password", {
          method: "POST",
          body,
        }),

  listWfh: () =>
    env.useMock
      ? wrapMock(() => mockApi.listWfh())
      : apiClient<EssWfhRequest[]>("/ess/wfh-requests"),

  createWfh: (body: {
    wfh_date: string;
    end_date?: string;
    portion?: string;
    reason?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.createWfh(body))
      : apiClient<EssWfhRequest>("/ess/wfh-requests", { method: "POST", body }),

  listOnDuty: () =>
    env.useMock
      ? wrapMock(() => mockApi.listOnDuty())
      : apiClient("/ess/on-duty-requests"),

  createOnDuty: (body: {
    duty_date: string;
    end_date?: string;
    portion?: string;
    duty_location?: string;
    purpose?: string;
    reason?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.createOnDuty(body))
      : apiClient("/ess/on-duty-requests", { method: "POST", body }),

  listCompoff: () =>
    env.useMock
      ? wrapMock(() => mockApi.listCompoff())
      : apiClient("/ess/compoff-requests"),

  createCompoff: (body: {
    earned_date: string;
    extra_hours: number;
    requested_days?: number;
    reason?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.createCompoff(body))
      : apiClient("/ess/compoff-requests", { method: "POST", body }),

  createAttendanceCorrection: (body: {
    attendance_date: string;
    field_name: string;
    new_value: string;
    reason?: string;
    attendance_id?: string;
    old_value?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.createAttendanceCorrection(body))
      : apiClient("/ess/attendance-corrections", {
          method: "POST",
          body: { ...body, submit: true },
        }),

  listCorrections: () =>
    env.useMock
      ? wrapMock(() => mockApi.listCorrections())
      : apiClient("/ess/attendance-corrections"),

  approvals: () =>
    env.useMock
      ? wrapMock(() => mockApi.approvals())
      : apiClient<EssApprovalItem[]>("/ess/approvals"),

  actOnApproval: (
    category: EssApprovalItem["category"],
    id: string,
    action: "approve" | "reject",
  ) => {
    if (env.useMock) {
      return wrapMock(() => mockApi.actOnApproval(category, id, action));
    }
    if (category === "leave") {
      const path =
        action === "approve"
          ? `/ess/team-leave/${id}/manager-approve`
          : `/ess/team-leave/${id}/reject`;
      return apiClient(path, { method: "POST", body: {} });
    }
    if (category === "compoff") {
      const path =
        action === "approve"
          ? `/ess/team-compoff/${id}/manager-approve`
          : `/ess/team-compoff/${id}/reject`;
      return apiClient(path, { method: "POST", body: {} });
    }
    if (category === "on_duty") {
      const path =
        action === "approve"
          ? `/ess/team-on-duty/${id}/approve`
          : `/ess/team-on-duty/${id}/reject`;
      return apiClient(path, { method: "POST", body: {} });
    }
    if (category === "wfh") {
      const path =
        action === "approve"
          ? `/ess/team-wfh/${id}/manager-approve`
          : `/ess/team-wfh/${id}/reject`;
      return apiClient(path, { method: "POST", body: {} });
    }
    const path =
      action === "approve"
        ? `/ess/team-corrections/${id}/approve`
        : `/ess/team-corrections/${id}/reject`;
    return apiClient(path, { method: "POST", body: {} });
  },

  teamLeave: () =>
    env.useMock
      ? wrapMock(() => mockApi.teamLeave())
      : apiClient<EssTeamLeaveItem[]>("/ess/team-leave"),

  managerApproveTeamLeave: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.managerApproveTeamLeave(id))
      : apiClient(`/ess/team-leave/${id}/manager-approve`, {
          method: "POST",
          body: {},
        }),

  rejectTeamLeave: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.rejectTeamLeave(id))
      : apiClient(`/ess/team-leave/${id}/reject`, {
          method: "POST",
          body: {},
        }),

  bank: () =>
    env.useMock
      ? wrapMock(() => mockApi.bank())
      : apiClient<EssBank>("/ess/profile/bank"),

  updateBank: (body: Partial<EssBank>) =>
    env.useMock
      ? wrapMock(() => mockApi.updateBank(body))
      : apiClient<EssBank>("/ess/profile/bank", { method: "PATCH", body }),

  kyc: () =>
    env.useMock
      ? wrapMock(() => mockApi.kyc())
      : apiClient<EssKyc>("/ess/profile/kyc"),

  emergency: () =>
    env.useMock
      ? wrapMock(() => mockApi.emergency())
      : apiClient<EssEmergencyContact>("/ess/profile/emergency"),

  updateEmergency: (body: {
    emergency_contact_name?: string;
    emergency_contact_mobile?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.updateEmergency(body))
      : apiClient<EssEmergencyContact>("/ess/profile/emergency", {
          method: "PATCH",
          body,
        }),

  educationSkills: () =>
    env.useMock
      ? wrapMock(() => mockApi.educationSkills())
      : apiClient<EssEducationSkills>("/ess/profile/education"),

  updateEducationSkills: (body: EssEducationSkills) =>
    env.useMock
      ? wrapMock(() => mockApi.updateEducationSkills(body))
      : apiClient<EssEducationSkills>("/ess/profile/education", {
          method: "PATCH",
          body,
        }),

  documents: () =>
    env.useMock
      ? wrapMock(() => mockApi.documents())
      : apiClient<EssDocument[]>("/ess/documents"),

  document: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.document(id))
      : apiClient<EssDocument>(`/ess/documents/${id}`),

  uploadDocument: (body: {
    document_type: string;
    document_name: string;
    file_name: string;
    content_base64: string;
    content_type?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.uploadDocument(body))
      : apiClient<EssDocument>("/ess/documents", { method: "POST", body }),

  announcements: () =>
    env.useMock
      ? wrapMock(() => mockApi.announcements())
      : apiClient<EssAnnouncement[]>("/ess/announcements"),

  assets: () =>
    env.useMock
      ? wrapMock(() => mockApi.assets())
      : apiClient<EssAsset[]>("/ess/assets"),

  asset: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.asset(id))
      : apiClient<EssAssetDetail>(`/ess/assets/${id}`),

  lookupAsset: (code: string) =>
    env.useMock
      ? wrapMock(() => mockApi.lookupAsset(code))
      : apiClient<EssAssetDetail>(
          `/ess/assets/lookup?code=${encodeURIComponent(code)}`,
        ),

  createAssetTicket: (
    assetId: string,
    body: {
      subject?: string;
      description: string;
      problem_category?: string;
      urgency?: string;
    },
  ) =>
    env.useMock
      ? wrapMock(() => mockApi.createAssetTicket(assetId, body))
      : apiClient<EssSupportTicketDetail>(`/ess/assets/${assetId}/tickets`, {
          method: "POST",
          body,
        }),

  meetingRooms: () =>
    env.useMock
      ? wrapMock(() => mockApi.meetingRooms())
      : apiClient<EssMeetingRoom[]>("/ess/meeting-rooms"),

  meetingRoomAvailability: (onDate: string) =>
    env.useMock
      ? wrapMock(() => mockApi.meetingRoomAvailability(onDate))
      : apiClient<EssMeetingRoomAvailability[]>(
          `/ess/meeting-rooms/availability?on_date=${encodeURIComponent(onDate)}`,
        ),

  createMeetingBooking: (body: {
    room_id: string;
    title: string;
    request_date: string;
    start_time?: string;
    end_time?: string;
    agenda?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.createMeetingBooking(body))
      : apiClient<EssMeetingBooking>("/ess/meeting-rooms/bookings", {
          method: "POST",
          body,
        }),

  myMeetingBookings: () =>
    env.useMock
      ? wrapMock(() => mockApi.myMeetingBookings())
      : apiClient<EssMeetingBooking[]>("/ess/meeting-rooms/bookings"),

  supportTickets: () =>
    env.useMock
      ? wrapMock(() => mockApi.supportTickets())
      : apiClient<EssSupportTicket[]>("/ess/support-tickets"),

  supportTicket: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.supportTicket(id))
      : apiClient<EssSupportTicketDetail>(`/ess/support-tickets/${id}`),

  createSupportTicket: (body: {
    kind: string;
    subject: string;
    description?: string;
    urgency?: string;
    asset_id?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.createSupportTicket(body))
      : apiClient<EssSupportTicketDetail>("/ess/support-tickets", {
          method: "POST",
          body,
        }),

  supportTicketComments: (ticketId: string) =>
    env.useMock
      ? wrapMock(() => mockApi.supportTicketComments(ticketId))
      : apiClient<EssSupportTicketComment[]>(
          `/ess/support-tickets/${ticketId}/comments`,
        ),

  addSupportTicketComment: (ticketId: string, body: { body: string }) =>
    env.useMock
      ? wrapMock(() => mockApi.addSupportTicketComment(ticketId, body))
      : apiClient<EssSupportTicketComment>(
          `/ess/support-tickets/${ticketId}/comments`,
          { method: "POST", body },
        ),

  policies: () =>
    env.useMock
      ? wrapMock(() => mockApi.policies())
      : apiClient<EssPolicyItem[]>("/ess/policies"),

  policyWalkthrough: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.policyWalkthrough(id))
      : apiClient<EssPolicyWalkthrough>(`/ess/policies/${id}`),

  acknowledgePolicy: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.acknowledgePolicy(id))
      : apiClient<{
          policy_id: string;
          policy_version: number;
          acknowledged_at: string;
        }>(`/ess/policies/${id}/acknowledge`, { method: "POST", body: {} }),

  training: () =>
    env.useMock
      ? wrapMock(() => mockApi.training())
      : apiClient<EssTrainingItem[]>("/ess/training"),

  performance: () =>
    env.useMock
      ? wrapMock(() => mockApi.performance())
      : apiClient<EssPerformanceItem[]>("/ess/performance"),

  separation: () =>
    env.useMock
      ? wrapMock(() => mockApi.separation())
      : apiClient<EssSeparationItem[]>("/ess/separation"),

  createSeparation: (body: {
    separation_type?: string;
    requested_last_working_date: string;
    reason?: string;
  }) =>
    env.useMock
      ? wrapMock(() => mockApi.createSeparation(body))
      : apiClient<EssSeparationItem>("/ess/separation", {
          method: "POST",
          body,
        }),
};
