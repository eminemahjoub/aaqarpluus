"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

/** Field-level help tooltip — keyboard-accessible (focus + hover). */
export function FieldHelp({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <HelpCircle
        tabIndex={0}
        aria-label="مساعدة"
        className="h-4 w-4 cursor-help text-gray-400 outline-none focus-visible:text-emerald-600"
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-6 z-30 hidden w-56 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg group-hover:block group-focus-within:block dark:bg-gray-700"
      >
        {text}
      </span>
    </span>
  );
}