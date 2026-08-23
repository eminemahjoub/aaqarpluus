"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimal shadcn-style Select compound — native <select> driven, no Radix,
 * no cva. Exposes the familiar API surface:
 *
 *   <Select value={v} onValueChange={setV} placeholder="اختر">
 *     <SelectTrigger />
 *     <SelectContent>
 *       <SelectItem value="a">أ</SelectItem>
 *     </SelectContent>
 *   </Select>
 *
 * Only Select (props holder), SelectTrigger (renders the listbox),
 * SelectContent (passthrough) and SelectItem (option) carry behavior;
 * SelectValue is a no-op kept for API compatibility.
 */

type SelectContextValue = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  children: React.ReactNode;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function collectOptions(children: React.ReactNode): {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}[] {
  const options: { value: string; label: React.ReactNode; disabled?: boolean }[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const type = child.type as { displayName?: string };
    const props = child.props as {
      value?: unknown;
      children?: React.ReactNode;
      disabled?: boolean;
    };
    if (type?.displayName === "SelectItem") {
      options.push({
        value: String(props.value),
        label: props.children,
        disabled: Boolean(props.disabled),
      });
    } else if (props.children) {
      options.push(...collectOptions(props.children));
    }
  });
  return options;
}

export function Select({
  value,
  onValueChange,
  disabled,
  placeholder,
  children,
  className,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx: SelectContextValue = { value, onValueChange, disabled, placeholder, children };
  return (
    <SelectContext.Provider value={ctx}>
      <div className={cn("relative", className)}>{children}</div>
    </SelectContext.Provider>
  );
}
Select.displayName = "Select";

export function SelectTrigger({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const ctx = React.useContext(SelectContext);
  const options = collectOptions(ctx?.children ?? null);

  return (
    <div className={cn("relative", className)}>
      <select
        value={ctx?.value ?? ""}
        onChange={(e) => ctx?.onValueChange(e.target.value)}
        disabled={ctx?.disabled || props.disabled}
        id={props.id}
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-500 focus-visible:border-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100",
          className
        )}
      >
        {ctx?.placeholder && (
          <option value="" disabled>
            {ctx.placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}
SelectTrigger.displayName = "SelectTrigger";

export function SelectValue(_props: { placeholder?: string; className?: string }) {
  return null;
}
SelectValue.displayName = "SelectValue";

export function SelectContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}
SelectContent.displayName = "SelectContent";

export function SelectItem({
  value,
  disabled,
  children,
  className,
}: {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <option value={value} disabled={disabled} className={className}>
      {children}
    </option>
  );
}
SelectItem.displayName = "SelectItem";