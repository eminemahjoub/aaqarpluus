"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AqarPlusLogo } from "./AqarPlusLogo";
import { SocialLinks } from "./SocialLinks";

const NAV_LINKS = [
  { label: "الميزات", href: "#features" },
  { label: "لماذا نحن", href: "#benefits" },
  { label: "الأسعار", href: "#pricing" },
  { label: "أسئلة شائعة", href: "#faq" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled || open
          ? "border-b border-border/60 bg-white/75 shadow-[0_1px_20px_rgba(27,94,60,0.06)] backdrop-blur-xl dark:bg-background/75"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="التنقل الرئيسي"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-[4.25rem] sm:px-6 lg:px-8"
      >
        <AqarPlusLogo />

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/80 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <SocialLinks />
          </div>
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/80 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex"
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition hover:scale-[1.02] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ابدأ مجاناً
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-nav"
        className={`border-t border-border/60 bg-white/95 backdrop-blur-lg dark:bg-background/95 md:hidden ${
          open ? "block" : "hidden"
        }`}
      >
        <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="block rounded-xl px-3 py-3 text-base font-medium text-foreground hover:bg-muted/80"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <Link
              href="/login"
              className="block rounded-xl px-3 py-3 text-base font-medium text-primary hover:bg-muted/80"
              onClick={() => setOpen(false)}
            >
              تسجيل الدخول
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
