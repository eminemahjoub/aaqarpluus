import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function CTA() {
  return (
    <section
      id="cta"
      className="scroll-mt-24 border-t border-border/60 pb-20 pt-4 sm:pb-24"
      aria-labelledby="cta-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary p-8 shadow-2xl sm:p-12 lg:p-14">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-2xl text-center">
            <h2
              id="cta-heading"
              className="text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl"
            >
              جاهز لإدارة عقاراتك بذكاء؟
            </h2>
            <p className="mt-4 text-lg text-white/90">
              ابدأ تجربتك المجانية اليوم.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#C5A021] px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:scale-[1.03] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                ابدأ مجاناً
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </Link>
              <Link
                href="mailto:sales@aaqarplus.sa"
                className="inline-flex items-center justify-center rounded-2xl border-2 border-white/40 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                تحدث مع المبيعات
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
