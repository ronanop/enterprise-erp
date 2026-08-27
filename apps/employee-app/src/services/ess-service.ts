import { mockApi } from "@/data/mock-ess";
import {
  mockDocuments,
  mockHolidays,
  mockNotifications,
} from "@/data/mock-portal";
import { ApiClientError, apiClient, apiClientBlob } from "@/services/api-client";
import type {
  EssAttendance,
  EssBank,
  EssDocument,
  EssFaceStatus,
  EssFaceVerifyResult,
  EssEducationSkills,
  EssEmergencyContact,
  EssAnnouncement,
  EssApprovalItem,
  EssAsset,
  EssAssetDetail,
  EssMeetingBooking,
  EssMeetingRoom,
  EssMeetingRoomAvailability,
  EssSupportTicket,
  EssSupportTicketComment,
  EssSupportTicketDetail,
  EssHolidayCalendar,
  EssKyc,
  EssLeaveBalance,
  EssLeaveRequest,
  EssLeaveType,
  EssMe,
  EssNotification,
  EssPayslip,
  EssPerformanceItem,
  EssPolicyItem,
  EssPolicyWalkthrough,
  EssPunch,
  EssSeparationItem,
  EssTeamLeaveItem,
  EssTrainingItem,
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

async function readGeolocation(): Promise<{
  latitude?: number;
  longitude?: number;
}> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {};
  }
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30_000,
      });
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    return {};
  }
}

let essMeInflight: Promise<Awaited<ReturnType<typeof apiClient<EssMe>>>> | null = null;

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
      ? wrapMock(async () => {
          const res = await mockApi.leaveRequests();
          const row = (res.data ?? []).find((r) => r.id === id);
          if (!row) throw new Error("Leave request not found");
          return { success: true, message: "OK", data: row };
        })
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
      ? wrapMock(async () => {
          const res = await mockApi.leaveRequests();
          const row = (res.data ?? []).find((r) => r.id === id);
          if (!row) throw new Error("Leave request not found");
          return {
            success: true,
            message: "Cancelled",
            data: { ...row, status: "cancelled" },
          };
        })
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
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            month,
            present_days: 0,
            late_days: 0,
            total_overtime_minutes: 0,
            work_from_home_days: 0,
          },
        }))
      : apiClient<import("@/types/api").EssAttendanceSummary>(
          "/ess/attendance/summary",
          { query: { month } },
        ),

  punchPolicy: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            geofence_required: false,
            selfie_required: false,
            face_at_punch_required: false,
            face_enrolled: false,
          },
        }))
      : apiClient<import("@/types/api").EssPunchPolicy>(
          "/ess/attendance/punch-policy",
        ),

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

  createAttendanceCorrection: (body: {
    attendance_date: string;
    field_name: string;
    new_value: string;
    reason?: string;
    attendance_id?: string;
    old_value?: string;
  }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "Correction submitted",
          data: {
            id: "mock-corr",
            attendance_date: body.attendance_date,
            field_name: body.field_name,
            new_value: body.new_value,
            reason: body.reason ?? null,
            status: "submitted",
            attendance_id: body.attendance_id ?? null,
            old_value: body.old_value ?? null,
          },
        }))
      : apiClient("/ess/attendance-corrections", {
          method: "POST",
          body: { ...body, submit: true },
        }),

  listOnDuty: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] }))
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
      ? wrapMock(async () => ({
          success: true,
          message: "On Duty submitted",
          data: {
            id: "mock-onduty",
            ...body,
            portion: body.portion ?? "full_day",
            end_date: body.end_date ?? null,
            duty_location: body.duty_location ?? null,
            purpose: body.purpose ?? null,
            reason: body.reason ?? null,
            status: "submitted",
          },
        }))
      : apiClient("/ess/on-duty-requests", { method: "POST", body }),

  listWfh: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] }))
      : apiClient<import("@/types/api").EssWfhRequest[]>("/ess/wfh-requests"),

  createWfh: (body: {
    wfh_date: string;
    end_date?: string;
    portion?: string;
    reason?: string;
  }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "WFH submitted",
          data: {
            id: "mock-wfh",
            wfh_date: body.wfh_date,
            end_date: body.end_date ?? null,
            portion: body.portion ?? "full_day",
            reason: body.reason ?? null,
            status: "submitted",
          },
        }))
      : apiClient<import("@/types/api").EssWfhRequest>("/ess/wfh-requests", {
          method: "POST",
          body,
        }),

  listCompoff: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] }))
      : apiClient("/ess/compoff-requests"),

  createCompoff: (body: {
    earned_date: string;
    extra_hours: number;
    requested_days?: number;
    reason?: string;
  }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "Comp Off submitted",
          data: {
            id: "mock-compoff",
            earned_date: body.earned_date,
            extra_hours: body.extra_hours,
            requested_days: body.requested_days ?? 1,
            reason: body.reason ?? null,
            status: "submitted",
          },
        }))
      : apiClient("/ess/compoff-requests", { method: "POST", body }),

  registerDeviceToken: (body: { token: string; platform?: string }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "Device token registered",
          data: { id: "mock-token", platform: body.platform ?? "web", is_active: true },
        }))
      : apiClient("/ess/device-tokens", { method: "POST", body }),

  bank: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            bank_account_number: "501002458942",
            bank_ifsc: "HDFC0001042",
            bank_name: "HDFC Bank",
            bank_account_holder: "Riya Sharma",
          } satisfies EssBank,
        }))
      : apiClient<EssBank>("/ess/profile/bank"),

  updateBank: (body: Partial<EssBank>) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            bank_account_number: body.bank_account_number ?? "501002458942",
            bank_ifsc: body.bank_ifsc ?? "HDFC0001042",
            bank_name: body.bank_name ?? "HDFC Bank",
            bank_account_holder: body.bank_account_holder ?? "Riya Sharma",
          } satisfies EssBank,
        }))
      : apiClient<EssBank>("/ess/profile/bank", { method: "PATCH", body }),

  kyc: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            aadhaar_number: "********1234",
            pan_number: "******1A",
            uan_number: "100200300400",
          } satisfies EssKyc,
        }))
      : apiClient<EssKyc>("/ess/profile/kyc"),

  documents: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: mockDocuments.map(
            (d): EssDocument => ({
              id: d.id,
              document_number: d.id.toUpperCase(),
              document_type:
                d.category === "Personal"
                  ? "id_proof"
                  : d.category === "Tax"
                    ? "other"
                    : "contract",
              document_name: d.title,
              storage_uri: `/documents/${d.id}`,
              issued_on: null,
              expires_on: null,
              verification_status: "verified",
              status: "active",
            }),
          ),
        }))
      : apiClient<EssDocument[]>("/ess/documents"),

  document: (id: string) =>
    env.useMock
      ? wrapMock(async () => {
          const mapped = mockDocuments.map(
            (d): EssDocument => ({
              id: d.id,
              document_number: d.id.toUpperCase(),
              document_type:
                d.category === "Personal"
                  ? "id_proof"
                  : d.category === "Tax"
                    ? "other"
                    : "contract",
              document_name: d.title,
              storage_uri: `/documents/${d.id}`,
              issued_on: null,
              expires_on: null,
              verification_status: "verified",
              status: "active",
            }),
          );
          const row = mapped.find((d) => d.id === id);
          if (!row) throw new Error("Document not found");
          return { success: true, message: "OK", data: row };
        })
      : apiClient<EssDocument>(`/ess/documents/${id}`),

  uploadDocument: (body: {
    document_type: string;
    document_name: string;
    file_name: string;
    content_base64: string;
    content_type?: string;
    issued_on?: string;
    expires_on?: string;
  }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "Uploaded",
          data: {
            id: crypto.randomUUID(),
            document_number: "DOC-MOCK",
            document_type: body.document_type,
            document_name: body.document_name,
            storage_uri: "ess-doc:mock/file.pdf",
            verification_status: "pending",
            status: "active",
            issued_on: body.issued_on ?? null,
            expires_on: body.expires_on ?? null,
          } satisfies EssDocument,
        }))
      : apiClient<EssDocument>("/ess/documents", { method: "POST", body }),

  downloadDocumentBlob: (id: string) =>
    env.useMock
      ? Promise.reject(new ApiClientError("Download not available in demo mode", 400))
      : apiClientBlob(`/ess/documents/${id}/download`),

  holidays: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: [
            {
              id: "mock-cal",
              calendar_code: "IN-NAT",
              calendar_name: "National Holidays",
              calendar_year: new Date().getFullYear(),
              holidays_json: mockHolidays.map((h) => ({
                date: h.date,
                name: h.name,
                kind: h.kind,
              })),
              status: "published",
              branch_id: null,
            } satisfies EssHolidayCalendar,
          ],
        }))
      : apiClient<EssHolidayCalendar[]>("/ess/holidays"),

  notifications: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: mockNotifications.map(
            (n): EssNotification => ({
              id: n.id,
              title: n.title,
              body: n.body,
              kind: n.kind,
              read: !n.unread,
              created_at: new Date().toISOString(),
            }),
          ),
        }))
      : apiClient<EssNotification[]>("/ess/notifications"),

  notificationUnreadCount: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            unread_count: mockNotifications.filter((n) => n.unread).length,
          },
        }))
      : apiClient<{ unread_count: number }>("/ess/notifications/unread-count"),

  notificationPoll: () =>
    env.useMock
      ? wrapMock(async () => {
          const unread = mockNotifications.filter((n) => n.unread);
          const first = unread[0];
          return {
            success: true,
            message: "OK",
            data: {
              unread_count: unread.length,
              latest: first
                ? {
                    id: first.id,
                    title: first.title,
                    body: first.body,
                    kind: first.kind,
                    read: !first.unread,
                    created_at: new Date().toISOString(),
                  }
                : null,
            },
          };
        })
      : apiClient<{
          unread_count: number;
          latest: EssNotification | null;
        }>("/ess/notifications/poll"),

  markAllNotificationsRead: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: { marked: mockNotifications.length },
        }))
      : apiClient<{ marked: number }>("/ess/notifications/read-all", {
          method: "POST",
          body: {},
        }),

  markNotificationRead: (id: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: { id },
        }))
      : apiClient(`/ess/notifications/${id}/read`, { method: "POST", body: {} }),

  payslips: () =>
    env.useMock
      ? wrapMock(() => mockApi.payslips())
      : apiClient<EssPayslip[]>("/ess/payslips"),

  payslip: (id: string) =>
    env.useMock
      ? wrapMock(() => mockApi.payslip(id))
      : apiClient<EssPayslip>(`/ess/payslips/${id}`),

  emergency: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            name: null,
            mobile: null,
            blood_group: null,
            relationship: null,
          } satisfies EssEmergencyContact,
        }))
      : apiClient<EssEmergencyContact>("/ess/profile/emergency"),

  updateEmergency: (body: { emergency_contact_name?: string; emergency_contact_mobile?: string }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            name: body.emergency_contact_name ?? null,
            mobile: body.emergency_contact_mobile ?? null,
            blood_group: null,
            relationship: null,
          } satisfies EssEmergencyContact,
        }))
      : apiClient<EssEmergencyContact>("/ess/profile/emergency", { method: "PATCH", body }),

  educationSkills: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: { education: [], skills: [] } satisfies EssEducationSkills,
        }))
      : apiClient<EssEducationSkills>("/ess/profile/education"),

  updateEducationSkills: (body: EssEducationSkills) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: body,
        }))
      : apiClient<EssEducationSkills>("/ess/profile/education", { method: "PATCH", body }),

  teamLeave: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssTeamLeaveItem[] }))
      : apiClient<EssTeamLeaveItem[]>("/ess/team-leave"),

  managerApproveTeamLeave: (id: string) =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: null }))
      : apiClient(`/ess/team-leave/${id}/manager-approve`, { method: "POST", body: {} }),

  rejectTeamLeave: (id: string) =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: null }))
      : apiClient(`/ess/team-leave/${id}/reject`, { method: "POST", body: {} }),

  approvals: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssApprovalItem[] }))
      : apiClient<EssApprovalItem[]>("/ess/approvals"),

  actOnApproval: (
    category: EssApprovalItem["category"],
    id: string,
    action: "approve" | "reject",
  ) => {
    if (env.useMock) {
      return wrapMock(async () => ({
        success: true,
        message: "OK",
        data: { id, status: action === "approve" ? "approved" : "rejected" },
      }));
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

  announcements: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssAnnouncement[] }))
      : apiClient<EssAnnouncement[]>("/ess/announcements"),

  assets: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssAsset[] }))
      : apiClient<EssAsset[]>("/ess/assets"),

  training: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssTrainingItem[] }))
      : apiClient<EssTrainingItem[]>("/ess/training"),

  performance: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssPerformanceItem[] }))
      : apiClient<EssPerformanceItem[]>("/ess/performance"),

  separation: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssSeparationItem[] }))
      : apiClient<EssSeparationItem[]>("/ess/separation"),

  createSeparation: (body: {
    separation_type?: string;
    requested_last_working_date: string;
    reason?: string;
  }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            id: crypto.randomUUID(),
            document_number: "SEP-LOCAL",
            separation_type: body.separation_type ?? "resignation",
            requested_last_working_date: body.requested_last_working_date,
            status: "draft",
            fnf_status: "pending",
            notice_status: "pending",
          } satisfies EssSeparationItem,
        }))
      : apiClient<EssSeparationItem>("/ess/separation", { method: "POST", body }),

  faceStatus: () =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            enrolled: false,
            enabled: false,
            verification_required: false,
          } satisfies EssFaceStatus,
        }))
      : apiClient<EssFaceStatus>("/ess/security/face/status"),

  faceEnroll: (image_base64: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            enrolled: true,
            enabled: true,
            verification_required: true,
          } satisfies EssFaceStatus,
        }))
      : apiClient<EssFaceStatus>("/ess/security/face/enroll", {
          method: "POST",
          body: { image_base64 },
        }),

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

  faceSetEnabled: (enabled: boolean) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            enrolled: true,
            enabled,
            verification_required: enabled,
          } satisfies EssFaceStatus,
        }))
      : apiClient<EssFaceStatus>("/ess/security/face/enabled", {
          method: "PATCH",
          body: { enabled },
        }),

  asset: (id: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: null as EssAssetDetail | null,
        }))
      : apiClient<EssAssetDetail>(`/ess/assets/${id}`),

  lookupAsset: (code: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: null as EssAssetDetail | null,
        }))
      : apiClient<EssAssetDetail>(`/ess/assets/lookup?code=${encodeURIComponent(code)}`),

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
      ? wrapMock(async () => ({
          success: true,
          message: "Ticket created",
          data: {
            id: "mock-ticket",
            document_number: "HD-0001",
            subject: body.subject ?? "Asset issue",
            status: "submitted",
            kind: "asset",
            urgency: body.urgency ?? "medium",
            created_at: new Date().toISOString(),
            asset_id: assetId,
            description: body.description,
            opened_at: new Date().toISOString(),
            resolved_at: null,
          } satisfies EssSupportTicketDetail,
        }))
      : apiClient<EssSupportTicketDetail>(`/ess/assets/${assetId}/tickets`, {
          method: "POST",
          body,
        }),

  meetingRooms: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssMeetingRoom[] }))
      : apiClient<EssMeetingRoom[]>("/ess/meeting-rooms"),

  meetingRoomAvailability: (onDate: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: [] as EssMeetingRoomAvailability[],
        }))
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
      ? wrapMock(async () => ({
          success: true,
          message: "Booked",
          data: {
            id: "mock-booking",
            room_id: body.room_id,
            room_name: "Room",
            title: body.title,
            request_date: body.request_date,
            start_time: body.start_time ?? null,
            end_time: body.end_time ?? null,
            status: "approved",
            requested_by_employee_id: "mock",
          } satisfies EssMeetingBooking,
        }))
      : apiClient<EssMeetingBooking>("/ess/meeting-rooms/bookings", {
          method: "POST",
          body,
        }),

  supportTickets: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssSupportTicket[] }))
      : apiClient<EssSupportTicket[]>("/ess/support-tickets"),

  supportTicket: (id: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: null as EssSupportTicketDetail | null,
        }))
      : apiClient<EssSupportTicketDetail>(`/ess/support-tickets/${id}`),

  createSupportTicket: (body: {
    kind: string;
    subject: string;
    description?: string;
    urgency?: string;
    asset_id?: string;
  }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "Created",
          data: {
            id: "mock",
            document_number: "HD-0002",
            subject: body.subject,
            status: "submitted",
            kind: body.kind,
            urgency: body.urgency ?? null,
            created_at: new Date().toISOString(),
            asset_id: body.asset_id ?? null,
            description: body.description ?? null,
            opened_at: new Date().toISOString(),
            resolved_at: null,
          } satisfies EssSupportTicketDetail,
        }))
      : apiClient<EssSupportTicketDetail>("/ess/support-tickets", { method: "POST", body }),

  supportTicketComments: (ticketId: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: [] as EssSupportTicketComment[],
        }))
      : apiClient<EssSupportTicketComment[]>(`/ess/support-tickets/${ticketId}/comments`),

  addSupportTicketComment: (ticketId: string, body: { body: string }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            id: "c1",
            body: body.body,
            commented_at: new Date().toISOString(),
            author_employee_id: null,
          } satisfies EssSupportTicketComment,
        }))
      : apiClient<EssSupportTicketComment>(`/ess/support-tickets/${ticketId}/comments`, {
          method: "POST",
          body,
        }),

  policies: () =>
    env.useMock
      ? wrapMock(async () => ({ success: true, message: "OK", data: [] as EssPolicyItem[] }))
      : apiClient<EssPolicyItem[]>("/ess/policies"),

  policyWalkthrough: (id: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: null as EssPolicyWalkthrough | null,
        }))
      : apiClient<EssPolicyWalkthrough>(`/ess/policies/${id}`),

  acknowledgePolicy: (id: string) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: {
            policy_id: id,
            policy_version: 1,
            acknowledged_at: new Date().toISOString(),
          },
        }))
      : apiClient<{ policy_id: string; policy_version: number; acknowledged_at: string }>(
          `/ess/policies/${id}/acknowledge`,
          { method: "POST", body: {} },
        ),

  changePassword: (body: { current_password: string; new_password: string }) =>
    env.useMock
      ? wrapMock(async () => ({
          success: true,
          message: "OK",
          data: { ok: true },
        }))
      : apiClient<{ ok: boolean }>("/ess/security/change-password", {
          method: "POST",
          body,
        }),
};
