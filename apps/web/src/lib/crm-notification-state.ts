const DISMISSED_CRM_APPROVALS_KEY = "crm_approval_notifications_dismissed";

export function readDismissedCrmApprovalIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_CRM_APPROVALS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function dismissCrmApproval(id: string): void {
  const dismissed = readDismissedCrmApprovalIds();
  dismissed.add(id);
  try {
    localStorage.setItem(
      DISMISSED_CRM_APPROVALS_KEY,
      JSON.stringify([...dismissed].slice(-500)),
    );
  } catch {
    /* Storage is optional; the current component still removes the alert. */
  }
}

/** Repair legacy UTF-8 text decoded with a Windows code page. */
export function normalizeNotificationText(value: string): string {
  return value
    .replaceAll("ΓÇö", "—")
    .replaceAll("â€”", "—")
    .replaceAll("Â", "");
}
