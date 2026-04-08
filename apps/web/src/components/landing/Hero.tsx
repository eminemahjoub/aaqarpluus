import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden pt-8 pb-16 sm:pt-10 sm:pb-24 lg:pt-12 lg:pb-28"
      aria-labelledby="hero-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-secondary/10 dark:from-primary/25 dark:via-background dark:to-secondary/20"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="animate-fade-in-up mb-4 inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/70 px-4 py-1.5 text-sm font-medium text-primary shadow-sm backdrop-blur-lg dark:bg-background/60">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden />
            منصة عقارية موثوقة للشركات في السعودية
          </p>
          <h1
            id="hero-heading"
            className="animate-fade-in-up animation-delay-100 text-balance bg-gradient-to-l from-primary via-secondary to-primary bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl lg:text-6xl"
          >
            نظام إدارة عقارات ذكي
          </h1>
          <p
            className="animation-delay-200 animate-fade-in-up mt-6 text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            أدر محفظتك العقارية، عقود الإيجار، والتحصيل من لوحة واحدة — بتجربة فاخرة
            تعكس ثقة علامتك وتساعد فرقك على اتخاذ قرارات أذكى بسرعة.
          </p>
          <div
            className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
            role="group"
            aria-label="إجراءات رئيسية"
          >
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-8 py-3.5 text-base font-semibold text-accent-foreground shadow-lg transition hover:scale-[1.02] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ابدأ مجاناً
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center rounded-2xl border-2 border-primary/30 bg-background/80 px-8 py-3.5 text-base font-semibold text-primary shadow-sm backdrop-blur-lg transition hover:border-primary hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              احجز عرضاً توضيحياً
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
