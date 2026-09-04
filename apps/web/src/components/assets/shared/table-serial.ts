import { cn } from "@/lib/utils";

/** 1-based row index for the current page: (page - 1) * pageSize + rowIndex + 1 */
export function tableRowSerial(
  page: number,
  pageSize: number,
  rowIndex: number,
): number {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1;
  const safeIndex = Number.isFinite(rowIndex) && rowIndex >= 0 ? Math.floor(rowIndex) : 0;
  return (safePage - 1) * safeSize + safeIndex + 1;
}

/** For unpaginated lists (single page of results). */
export function tableRowSerialFromIndex(rowIndex: number): number {
  return tableRowSerial(1, 1, rowIndex);
}

export const TABLE_SERIAL_HEADER_LABEL = "#";

export function tableSerialHeaderClassName(className?: string): string {
  return cn(
    "w-10 px-2 py-2.5 text-center font-medium tabular-nums whitespace-nowrap",
    className,
  );
}

export function tableSerialCellClassName(className?: string): string {
  return cn(
    "px-2 py-2 text-center text-xs tabular-nums text-muted-foreground whitespace-nowrap",
    className,
  );
}
