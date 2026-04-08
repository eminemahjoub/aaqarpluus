import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { Benefits } from "@/components/landing/Benefits";
import { Pricing } from "@/components/landing/Pricing";
import { Testimonials } from "@/components/landing/Testimonials";
import { CTA } from "@/components/landing/CTA";

export const metadata: Metadata = {
  title: {
    default: "عقار بلس | نظام إدارة عقارات ذكي",
    template: "%s | عقار بلس",
  },
  description:
    "منصة عقارية فاخرة لإدارة المحافظ والعقود والتحصيل — للشركات العقارية في السعودية.",
  keywords: [
    "إدارة عقارات",
    "عقار بلس",
    "السعودية",
    "نظام عقاري",
    "تحصيل إيجارات",
  ],
  openGraph: {
    title: "عقار بلس — نظام إدارة عقارات ذكي",
    description:
      "ثقة وفخامة وذكاء تشغيلي لشركات العقار في المملكة.",
    locale: "ar_SA",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function MarketingPage() {
  return (
    <MarketingShell mainId="main-content">
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <Features />
        <DashboardPreview />
        <Benefits />
        <Pricing />
        <Testimonials />
        <CTA />
      </main>
    </MarketingShell>
  );
}
