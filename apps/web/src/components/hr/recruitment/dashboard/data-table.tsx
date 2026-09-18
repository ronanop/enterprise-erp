"use client";

import { useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

import { RowActionsItem, RowActionsMenu } from "@/components/ui/row-actions-menu";

export function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: ReactNode;
}) {
  if (rows.length === 0) {
    return <div className="px-2 py-8 text-center text-sm text-muted-foreground">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left">
        <thead>
          <tr className="border-b border-[#F3F4F6] text-[11px] font-medium text-[#9CA3AF]">
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 font-medium whitespace-nowrap first:pl-0 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-[#F8F8FA] text-[12px] text-[#374151] last:border-0 transition-colors duration-150 hover:bg-[#FAFAFC]"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-2.5 align-middle whitespace-nowrap first:pl-0 last:pr-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VerticalKebab({
  items,
}: {
  items: { label: string; onClick: () => void; destructive?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <RowActionsMenu open={open} onOpenChange={setOpen} buttonSize="icon-xs" icon={MoreVertical}>
      {items.map((item) => (
        <RowActionsItem
          key={item.label}
          destructive={item.destructive}
          onClick={() => {
            item.onClick();
            setOpen(false);
          }}
        >
          {item.label}
        </RowActionsItem>
      ))}
    </RowActionsMenu>
  );
}
