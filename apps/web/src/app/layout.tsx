import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { NavbarGate } from "@/components/landing/NavbarGate";

// Queue processing lives in the standalone worker (scripts/queue-worker.ts),
// not in the web process — process separation + atomic row claiming
// (FOR UPDATE SKIP LOCKED) prevent races and duplicate delivery.
// Manual drain fallback: POST /api/notifications/process (admin-only),
// or cron: * * * * * curl -sf http://localhost:3000/api/notifications/process

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "عقار بلس | نظام إدارة عقارات ذكي",
    template: "%s | عقار بلس",
  },
  description:
    "منصة عقارية فاخرة لإدارة المحافظ والعقود والتحصيل — للشركات العقارية في السعودية.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://aaqarplus.sa",
  ),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <QueryProvider>
            <NavbarGate />
            <div className="pt-16 sm:pt-[4.25rem]">{children}</div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
