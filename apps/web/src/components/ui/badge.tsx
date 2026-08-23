import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "green" | "red" | "amber" | "blue" | "gray";

const variants: Record<BadgeVariant, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

export function Badge({
  variant = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}