import type { CrmMeeting } from "@/services/sales-crm-service";

export const MEETING_VENUE_LABELS: Record<string, string> = {
  client_location: "Client location",
  office: "Office",
  online: "Online",
  phone: "Phone",
  in_person: "In person",
  video: "Video",
};

export const MEETING_RELATED_TO_LABELS: Record<string, string> = {
  company: "Company",
  oem: "OEM",
  distributor: "Distributor",
};

export function formatMeetingWhen(row: CrmMeeting): string {
  const date = row.meeting_date;
  if (row.all_day) return `${date} · All day`;
  const start = row.start_time?.slice(0, 5) ?? "";
  const end = row.end_time?.slice(0, 5) ?? "";
  if (start && end) return `${date} · ${start} – ${end}`;
  if (start) return `${date} · ${start}`;
  return date;
}

export function meetingTypeLabel(mode: string | null | undefined): string {
  if (!mode) return "—";
  return MEETING_VENUE_LABELS[mode] ?? mode.replaceAll("_", " ");
}

export function meetingRelatedToLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return MEETING_RELATED_TO_LABELS[value] ?? value.replaceAll("_", " ");
}
