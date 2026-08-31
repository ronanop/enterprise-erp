"use client";

import { Plus, Trash2 } from "lucide-react";

import { SetupField, SetupInput } from "@/components/hr/setup/setup-drawer";
import { Button } from "@/components/ui/button";

export type RoomEquipmentItem = {
  name: string;
  remarks: string;
  serial: string;
};

export function emptyEquipmentItem(): RoomEquipmentItem {
  return { name: "", remarks: "", serial: "" };
}

/** Normalize API / legacy comma-list / JSON string into structured items. */
export function normalizeRoomEquipment(value: unknown): RoomEquipmentItem[] {
  if (value == null || value === "") return [];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        return normalizeRoomEquipment(JSON.parse(trimmed));
      } catch {
        /* fall through */
      }
    }
    return trimmed
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name, remarks: "", serial: "" }));
  }

  if (Array.isArray(value)) {
    return value
      .map((item): RoomEquipmentItem => {
        if (item && typeof item === "object") {
          const o = item as Record<string, unknown>;
          return {
            name: String(o.name ?? o.label ?? "").trim(),
            remarks: String(o.remarks ?? o.remark ?? o.note ?? "").trim(),
            serial: String(o.serial ?? o.serial_number ?? o.number ?? "").trim(),
          };
        }
        const name = String(item).trim();
        return { name, remarks: "", serial: "" };
      })
      .filter((i) => i.name);
  }

  return [];
}

export function roomEquipmentToJson(items: RoomEquipmentItem[]): string {
  const clean = items.map((i) => ({
    name: i.name.trim(),
    remarks: i.remarks.trim(),
    serial: i.serial.trim(),
  }));
  return JSON.stringify(clean);
}

export function parseRoomEquipmentForm(value: string | undefined): RoomEquipmentItem[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return normalizeRoomEquipment(parsed);
    return parsed.map((item): RoomEquipmentItem => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        return {
          name: String(o.name ?? "").trim(),
          remarks: String(o.remarks ?? o.remark ?? "").trim(),
          serial: String(o.serial ?? o.serial_number ?? o.number ?? "").trim(),
        };
      }
      return { name: String(item).trim(), remarks: "", serial: "" };
    });
  } catch {
    return normalizeRoomEquipment(value);
  }
}

export function formatRoomEquipmentSummary(items: RoomEquipmentItem[]): string {
  if (!items.length) return "—";
  return items
    .map((i) => {
      let s = i.name;
      if (i.remarks) s += ` (${i.remarks})`;
      if (i.serial) s += ` · ${i.serial}`;
      return s;
    })
    .join(", ");
}

export function roomEquipmentForApi(formValue: string | undefined): RoomEquipmentItem[] {
  return parseRoomEquipmentForm(formValue).filter((i) => i.name.trim());
}

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (json: string) => void;
};

export function RoomEquipmentEditor({ value, disabled, onChange }: Props) {
  const items = parseRoomEquipmentForm(value);
  const rows = items.length ? items : [emptyEquipmentItem()];

  function updateRow(index: number, patch: Partial<RoomEquipmentItem>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(roomEquipmentToJson(next));
  }

  function addRow() {
    onChange(roomEquipmentToJson([...rows, emptyEquipmentItem()]));
  }

  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    onChange(roomEquipmentToJson(next.length ? next : [emptyEquipmentItem()]));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 sm:grid-cols-[1fr_1fr_0.9fr_auto]"
        >
          <SetupField label="Object / equipment">
            <SetupInput
              placeholder="e.g. HDMI"
              value={row.name}
              disabled={disabled}
              onChange={(e) => updateRow(index, { name: e.target.value })}
            />
          </SetupField>
          <SetupField label="Remarks">
            <SetupInput
              placeholder="e.g. Working"
              value={row.remarks}
              disabled={disabled}
              onChange={(e) => updateRow(index, { remarks: e.target.value })}
            />
          </SetupField>
          <SetupField label="Serial / number" hint="Optional">
            <SetupInput
              placeholder="Optional"
              value={row.serial}
              disabled={disabled}
              onChange={(e) => updateRow(index, { serial: e.target.value })}
            />
          </SetupField>
          <div className="flex items-end pb-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="cursor-pointer text-destructive hover:text-destructive"
              disabled={disabled || rows.length <= 1}
              onClick={() => removeRow(index)}
              aria-label="Remove item"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="cursor-pointer h-8 text-xs"
        disabled={disabled}
        onClick={addRow}
      >
        <Plus className="size-3.5" />
        Add equipment
      </Button>
    </div>
  );
}
