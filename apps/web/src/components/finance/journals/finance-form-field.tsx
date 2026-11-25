"use client";

import {
  Children,
  forwardRef,
  isValidElement,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

function FieldLabelText({ label }: { label: string }) {
  const trimmed = label.trimEnd();
  const required = trimmed.endsWith("*");
  const text = required ? trimmed.slice(0, -1).trimEnd() : trimmed;
  return (
    <>
      {text}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </>
  );
}

export function FinanceField({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block min-w-0 space-y-1.5", className)} htmlFor={htmlFor}>
      <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase break-words">
        <FieldLabelText label={label} />
      </span>
      <div className="min-w-0">{children}</div>
      {hint && !error ? (
        <span className="block text-[11px] leading-snug text-muted-foreground">{hint}</span>
      ) : null}
      {error ? <span className="block text-[11px] text-destructive">{error}</span> : null}
    </label>
  );
}

function optionText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return optionText(node.props.children);
  }
  return "";
}

function extractSelectOptions(children: ReactNode): SearchableSelectOption[] {
  const out: SearchableSelectOption[] = [];
  Children.forEach(children, (child) => {
    if (
      !isValidElement<{
        value?: string | number;
        disabled?: boolean;
        children?: ReactNode;
        "data-description"?: string;
      }>(child)
    ) {
      return;
    }
    if (child.type !== "option") return;
    const raw = child.props.value;
    const value = raw == null ? "" : String(raw);
    const description =
      typeof child.props["data-description"] === "string"
        ? child.props["data-description"].trim()
        : "";
    out.push({
      value,
      label: optionText(child.props.children) || value || "—",
      description: description || undefined,
      disabled: Boolean(child.props.disabled),
    });
  });
  return out;
}

/**
 * CRM-style popover select (same look as designation / product-type pickers).
 * Keeps a visually hidden native &lt;select&gt; for react-hook-form / form posts.
 * Falls back to native control when `multiple` is set.
 */
export const FinanceSelect = forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  function FinanceSelect(
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      onBlur,
      disabled,
      id,
      name,
      required,
      multiple,
      ...props
    },
    ref,
  ) {
    const options = useMemo(() => extractSelectOptions(children), [children]);
    const [uncontrolled, setUncontrolled] = useState(() =>
      defaultValue == null ? "" : String(Array.isArray(defaultValue) ? defaultValue[0] : defaultValue),
    );
    const current = value !== undefined ? String(value) : uncontrolled;

    if (multiple) {
      return (
        <select
          ref={ref}
          id={id}
          name={name}
          required={required}
          disabled={disabled}
          multiple
          className={cn(
            "flex h-8 w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          onBlur={onBlur}
          {...props}
        >
          {children}
        </select>
      );
    }

    const empty = options.find((o) => o.value === "");
    const placeholder = empty?.label || "Select…";

    return (
      // Contain sr-only absolute select so it cannot extend document scrollHeight.
      <div className="relative min-w-0 overflow-hidden">
        <select
          ref={ref}
          id={id}
          name={name}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          value={current}
          onChange={onChange}
          onBlur={onBlur}
          {...props}
        >
          {children}
        </select>
        <SearchableSelect
          value={current}
          onChange={(next) => {
            if (value === undefined) setUncontrolled(next);
            onChange?.({
              target: { value: next, name: name ?? "", id: id ?? "" },
              currentTarget: { value: next, name: name ?? "", id: id ?? "" },
            } as unknown as React.ChangeEvent<HTMLSelectElement>);
          }}
          options={options}
          placeholder={placeholder}
          searchPlaceholder="Search…"
          disabled={disabled}
          className={cn(className)}
          allowCustomValue={false}
          searchable={options.length > 8}
        />
      </div>
    );
  },
);
FinanceSelect.displayName = "FinanceSelect";

export function FinanceTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors",
        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
