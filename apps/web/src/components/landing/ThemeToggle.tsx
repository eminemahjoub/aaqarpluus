"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  if (!mounted) {
    return (
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/50"
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur-lg transition hover:scale-105 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={isDark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
      aria-pressed={isDark}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-accent" aria-hidden />
      ) : (
        <Moon className="h-5 w-5 text-primary" aria-hidden />
      )}
    </button>
  );
}

