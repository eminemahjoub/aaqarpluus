import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { Navbar } from "@/components/landing/Navbar";
import { getUserFromCookies } from "@/lib/api-helpers";
import { cookies } from "next/headers";
import { REFRESH_COOKIE } from "@/lib/auth";

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
  const user = await getUserFromCookies();
  const cookieStore = await cookies();
  const hasRefresh = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);
  const isAuthed = Boolean(user) || hasRefresh;
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <QueryProvider>
            {!isAuthed ? <Navbar /> : null}
            <div className={!isAuthed ? "pt-16 sm:pt-[4.25rem]" : ""}>{children}</div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
