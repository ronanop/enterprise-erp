import { mockApi } from "@/data/mock-ess";
import {
  mockDocuments,
  mockHolidays,
  mockNotifications,
} from "@/data/mock-portal";
import { ApiClientError, apiClient } from "@/services/api-client";
import type {
  EssAttendance,
  EssBank,
  EssDocument,
  EssEmergencyContact,
  EssEducationSkills,
  EssAnnouncement,
  EssAsset,
  EssHolidayCalendar,
  EssKyc,
  EssLeaveBalance,
  EssLeaveRequest,
  EssLeaveType,
  EssMe,
  EssNotification,
  EssPayslip,
  EssPerformanceItem,
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

export const essService = {
  me: () =>
    env.useMock ? wrapMock(() => mockApi.me()) : apiClient<EssMe>("/ess/me"),

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

  attendance: (fromDate?: string, toDate?: string) =>
    env.useMock
      ? wrapMock(() => mockApi.attendance())
      : apiClient<EssAttendance[]>("/ess/attendance", {
          query: { from_date: fromDate, to_date: toDate },
        }),

  punch: async () => {
    if (env.useMock) return wrapMock(() => mockApi.punch());
    const coords = await readGeolocation();
    return apiClient<EssPunch>("/ess/attendance/punch", {
      method: "POST",
      body: coords,
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
          } satisfies EssSeparationItem,
        }))
      : apiClient<EssSeparationItem>("/ess/separation", { method: "POST", body }),
};
