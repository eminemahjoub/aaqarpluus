import { Navbar } from "@/components/homestack/Navbar";
import { Hero } from "@/components/homestack/Hero";
import { SocialProof } from "@/components/homestack/SocialProof";
import { Stats } from "@/components/homestack/Stats";
import { HowItWorks } from "@/components/homestack/HowItWorks";
import { Features } from "@/components/homestack/Features";
import { Benefits } from "@/components/homestack/Benefits";
import { Cities } from "@/components/homestack/Cities";
import { Security } from "@/components/homestack/Security";
import { Pricing } from "@/components/homestack/Pricing";
import { FAQ } from "@/components/homestack/FAQ";
import { DemoRequest } from "@/components/homestack/DemoRequest";
import { Updates } from "@/components/homestack/Updates";
import { FinalCTA } from "@/components/homestack/FinalCTA";
import { Footer } from "@/components/homestack/Footer";
import { getLandingStats } from "@/lib/landing-stats";

export const revalidate = 300;

export default async function AqarPlusLandingPage() {
  const stats = await getLandingStats();

  return (
    <>
      <a
        href="#main-content"
        className="fixed start-4 top-4 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground opacity-0 transition focus:translate-y-0 focus:opacity-100"
      >
        تخطي إلى المحتوى
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="bg-white">
        <Hero />
        <SocialProof />
        <Stats stats={stats} />
        <HowItWorks />
        <Features />
        <Benefits />
        <Cities cities={stats.cities} />
        <Security />
        <Pricing />
        <FAQ />
        <DemoRequest />
        <Updates />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
