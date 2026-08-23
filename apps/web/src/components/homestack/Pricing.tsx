import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

const PLANS = [
  {
    name: "أساسي",
    price: "٩٩",
    period: "ريال / شهرياً",
    description: "للفرق الصغيرة التي تبدأ بتنظيم وحداتها.",
    features: ["حتى ٥٠ وحدة", "تقارير أساسية", "مستخدمان", "دعم بالبريد"],
    cta: "ابدأ الآن",
    highlighted: false,
  },
  {
    name: "احترافي",
    price: "٢٩٩",
    period: "ريال / شهرياً",
    description: "الأكثر طلباً — للشركات المتنامية.",
    features: [
      "وحدات غير محدودة",
      "تحليلات متقدمة",
      "حتى ٢٠ مستخدماً",
      "تكاملات وواجهات برمجية",
      "دعم أولوية",
    ],
    cta: "اختر الاحترافي",
    highlighted: true,
  },
  {
    name: "مؤسسات",
    price: "مخصص",
    period: "حسب احتياجك",
    description: "حوكمة، تدريب، وتمكين كامل للمؤسسات الكبرى.",
    features: ["مدير نجاح", "SLA مخصص", "بيئة معزولة", "تقارير تنفيذية"],
    cta: "تواصل مع المبيعات",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="scroll-mt-24 border-t border-border/60 bg-white py-20 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            أسعار واضحة تناسب مرحلتك
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            بدون مفاجآت — اختر الخطة وطوّرها مع نمو محفظتك.
          </p>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.1} className="h-full">
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-8 shadow-lg transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl",
                  plan.highlighted
                    ? "border-accent/60 bg-gradient-to-b from-white/95 to-primary/[0.06] shadow-[0_28px_60px_-18px_rgba(27,94,60,0.3)] dark:from-background/95 dark:to-primary/10"
                    : "border-border/80 bg-white/80 backdrop-blur-lg dark:bg-background/80",
                )}
              >
                {plan.highlighted ? (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-accent-foreground shadow-md">
                    الأكثر شعبية
                  </span>
                ) : null}

                <h3 className="text-xl font-bold text-primary">{plan.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

                <p className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </p>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-[15px] text-muted-foreground">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-secondary" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.highlighted ? "/signup" : "#cta"}
                  className={cn(
                    "mt-9 inline-flex justify-center rounded-2xl px-5 py-3.5 text-center text-sm font-semibold shadow-md transition hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent",
                    plan.highlighted
                      ? "bg-accent text-accent-foreground"
                      : "border border-primary/30 bg-background text-primary hover:bg-muted/60",
                  )}
                >
                  {plan.cta}
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
