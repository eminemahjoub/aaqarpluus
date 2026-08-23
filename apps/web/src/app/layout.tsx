import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { NavbarGate } from "@/components/landing/NavbarGate";
import { startProcessingInterval } from "@/lib/notifications/processor";

// Start the notification queue processor (5-minute interval).
// This module only ever executes server-side inside this server component;
// the browser bundle never imports or runs it.
if (typeof window === "undefined") {
  startProcessingInterval(5 * 60 * 1000);
}
// Alternative for VPS deployment (no app-level interval needed):
// */5 * * * * curl -s http://localhost:3000/api/notifications/process

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
