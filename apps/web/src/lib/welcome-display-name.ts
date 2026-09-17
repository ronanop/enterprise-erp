/** Prefer a human name; never surface an email as the greeting. */
export function welcomeDisplayName(
  displayName: string | null | undefined,
  email?: string | null,
): string {
  const raw = (displayName ?? "").trim();
  if (raw && !raw.includes("@") && (!email || raw.toLowerCase() !== email.toLowerCase())) {
    return raw;
  }
  return "there";
}
