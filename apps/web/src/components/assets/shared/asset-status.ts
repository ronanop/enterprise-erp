/** CR-004 shared operational status tokens (UI only). */

export const OPERATIONAL_STATUS_VALUES = [
  "READY_TO_MOVE",
  "ASSIGNED",
  "RETIRED",
  "PENDING_DISPOSAL",
  "DISPOSED",
] as const;

export type OperationalStatusValue = (typeof OPERATIONAL_STATUS_VALUES)[number];

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatusValue, string> = {
  READY_TO_MOVE: "Ready to move",
  ASSIGNED: "Assigned",
  RETIRED: "Retired",
  PENDING_DISPOSAL: "Pending disposal",
  DISPOSED: "Disposed",
};

export function isOperationalStatus(value: string): value is OperationalStatusValue {
  return (OPERATIONAL_STATUS_VALUES as readonly string[]).includes(value);
}
