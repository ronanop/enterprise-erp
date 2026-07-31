"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
};

type TriggerProps = React.ComponentProps<"select"> & {
  children?: React.ReactNode;
};

type ItemProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

function collectItems(node: React.ReactNode): ItemProps[] {
  const items: ItemProps[] = [];
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    const type = child.type as { displayName?: string };
    if (type?.displayName === "SelectContent") {
      items.push(...collectItems((child.props as { children?: React.ReactNode }).children));
      return;
    }
    if (type?.displayName === "SelectItem") {
      items.push(child.props as ItemProps);
      return;
    }
    if ((child.props as { children?: React.ReactNode }).children) {
      items.push(...collectItems((child.props as { children?: React.ReactNode }).children));
    }
  });
  return items;
}

function findTrigger(
  node: React.ReactNode,
): React.ReactElement<TriggerProps> | null {
  let found: React.ReactElement<TriggerProps> | null = null;
  React.Children.forEach(node, (child) => {
    if (found || !React.isValidElement(child)) return;
    const type = child.type as { displayName?: string };
    if (type?.displayName === "SelectTrigger") {
      found = child as React.ReactElement<TriggerProps>;
      return;
    }
    found = findTrigger((child.props as { children?: React.ReactNode }).children);
  });
  return found;
}

function Select({ value, defaultValue, onValueChange, children, disabled }: SelectProps) {
  const items = collectItems(children);
  const trigger = findTrigger(children);
  const triggerProps = trigger?.props ?? {};
  const {
    className,
    id,
    "aria-label": ariaLabel,
    children: _triggerChildren,
    ...rest
  } = triggerProps;

  return (
    <select
      id={id}
      aria-label={ariaLabel}
      disabled={disabled}
      value={value}
      defaultValue={defaultValue}
      onChange={(event) => onValueChange?.(event.target.value)}
      className={cn(
        "flex h-8 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {items.map((item) => (
        <option key={item.value} value={item.value} disabled={item.disabled} className={item.className}>
          {item.children}
        </option>
      ))}
    </select>
  );
}

function SelectTrigger({ children }: TriggerProps) {
  return <>{children}</>;
}
SelectTrigger.displayName = "SelectTrigger";

function SelectValue(_props: { placeholder?: string }) {
  return null;
}
SelectValue.displayName = "SelectValue";

function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
SelectContent.displayName = "SelectContent";

function SelectItem(_props: ItemProps) {
  return null;
}
SelectItem.displayName = "SelectItem";

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
