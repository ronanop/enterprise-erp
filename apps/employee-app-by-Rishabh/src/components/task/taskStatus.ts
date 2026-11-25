import { colors } from "@/theme/colors";

export function taskStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "assigned":
      return "Awaiting accept";
    case "accepted":
      return "Accepted";
    case "started":
    case "in_progress":
      return "In progress";
    case "pending_verification":
      return "Proof in review";
    case "redo_requested":
      return "Proof rejected";
    case "completed":
      return "Completed";
    case "declined":
      return "Rejected";
    case "transferred":
      return "Transferred";
    case "open":
      return "Open";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "Unknown";
  }
}

export function taskStatusColor(status: string | null | undefined): string {
  switch (status) {
    case "completed":
      return colors.success;
    case "pending_verification":
      return colors.secondary;
    case "redo_requested":
    case "declined":
    case "transferred":
    case "cancelled":
      return colors.error;
    case "started":
    case "in_progress":
    case "accepted":
      return colors.primary;
    default:
      return colors.onSurfaceVariant;
  }
}

/** Elapsed work timer from started_at. */
export function formatElapsed(startedAt: string | null | undefined): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
