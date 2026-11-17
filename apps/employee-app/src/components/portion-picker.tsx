"use client";

const OPTIONS = [
  { value: "full_day", label: "Full day" },
  { value: "first_half", label: "First half" },
  { value: "second_half", label: "Second half" },
] as const;

type PortionPickerProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

/** Mobile-safe portion control (avoids oversized native &lt;select&gt; menus). */
export function PortionPicker({
  value,
  onChange,
  label = "Portion",
}: PortionPickerProps) {
  return (
    <fieldset className="block min-w-0">
      <legend className="text-xs font-semibold text-[#434655]">{label}</legend>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={
                active
                  ? "rounded-lg border border-[#004ac6] bg-[#004ac6] px-1.5 py-2 text-center text-[11px] font-semibold leading-tight text-white shadow-sm"
                  : "rounded-lg border border-[#c4c6d4] bg-white px-1.5 py-2 text-center text-[11px] font-semibold leading-tight text-[#0b1c30]"
              }
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
