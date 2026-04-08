"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

const links = [
  { href: "/#features", label: "الميزات" },
  { href: "/#dashboard", label: "لوحة التحكم" },
  { href: "/#benefits", label: "لماذا نحن" },
  { href: "/#pricing", label: "الأسعار" },
  { href: "/#testimonials", label: "آراء العملاء" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUser(data ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const onResize = () => {
      if (window.matchMedia("(min-width: 768px)").matches) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const hideLoginNav = pathname === "/login";
  const hideSignupNav = pathname === "/signup";

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-white/70 backdrop-blur-lg dark:bg-background/70">
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[4.25rem] sm:px-6 lg:px-8"
        aria-label="التنقل الرئيسي"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-primary transition hover:text-secondary"
        >
          <Image
            src="/logo.png"
            alt="عقار بلس"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl object-contain"
            priority
          />
          <span className="hidden sm:inline">عقار بلس</span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/80 hover:text-primary"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {!loading && (
            <>
              {user ? (
                <UserMenu user={user} />
              ) : (
                <>
                  {!hideLoginNav && (
                    <Link
                      href="/login"
                      className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/80 hover:text-primary sm:inline-flex"
                    >
                      تسجيل الدخول
                    </Link>
                  )}
                  {!hideSignupNav && (
                    <Link
                      href="/signup"
                      className="hidden rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-md transition hover:scale-[1.02] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
                    >
                      إنشاء حساب
                    </Link>
                  )}
                </>
              )}
            </>
          )}
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
          {links.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-xl px-3 py-3 text-base font-medium text-foreground hover:bg-muted/80"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
          {!loading && !user && (
            <>
              {!hideLoginNav && (
                <li>
                  <Link
                    href="/login"
                    className="block rounded-xl px-3 py-3 text-base font-medium text-primary hover:bg-muted/80"
                    onClick={() => setOpen(false)}
                  >
                    تسجيل الدخول
                  </Link>
                </li>
              )}
              {!hideSignupNav && (
                <li>
                  <Link
                    href="/signup"
                    className="mt-2 block rounded-xl bg-accent px-4 py-3 text-center text-base font-semibold text-accent-foreground shadow-md"
                    onClick={() => setOpen(false)}
                  >
                    إنشاء حساب
                  </Link>
                </li>
              )}
            </>
          )}
        </ul>
      </div>
    </header>
  );
}
