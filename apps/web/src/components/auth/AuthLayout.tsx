import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { MarketingShell } from "@/components/landing/MarketingShell";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <MarketingShell mainId="auth-main" variant="auth">
      <main
        id="auth-main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8"
      >
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex justify-center">
            <Link href="/">
              <Image
                src="/logo.png"
                alt="عقار بلس"
                width={80}
                height={80}
                className="h-20 w-auto"
                priority
              />
            </Link>
          </div>
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 sm:text-base">{subtitle}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/95 p-8 shadow-xl backdrop-blur-sm dark:border-emerald-800/50 dark:bg-[#0f291e]/95">
            {children}
          </div>

          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            منصة موثوقة لإدارة العقارات في المملكة العربية السعودية
          </p>
        </div>
      </main>
    </MarketingShell>
  );
}
