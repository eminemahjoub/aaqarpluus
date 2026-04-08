import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
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
      className="scroll-mt-24 border-t border-border/60 bg-muted/25 py-20 sm:py-24"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="pricing-heading"
            className="text-3xl font-bold tracking-tight text-primary sm:text-4xl"
          >
            أسعار واضحة تناسب مرحلتك
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            بدون مفاجآت — اختر الخطة وطوّرها مع نمو محفظتك.
          </p>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 shadow-lg transition hover:scale-[1.02] hover:shadow-xl sm:p-8 ${
                plan.highlighted
                  ? "border-accent/60 bg-gradient-to-b from-white/95 to-primary/[0.06] dark:from-background/95 dark:to-primary/10"
                  : "border-border/80 bg-white/80 backdrop-blur-lg dark:bg-background/80"
              }`}
            >
              {plan.highlighted ? (
                <p className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground shadow-md">
                  الأكثر شعبية
                </p>
              ) : null}
              <h3 className="text-xl font-bold text-primary">{plan.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-primary">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </p>
              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check
                      className="mt-0.5 h-5 w-5 shrink-0 text-secondary"
                      aria-hidden
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="#cta"
                className={`mt-8 inline-flex justify-center rounded-2xl px-5 py-3 text-center text-sm font-semibold shadow-md transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  plan.highlighted
                    ? "bg-accent text-accent-foreground"
                    : "border border-primary/30 bg-background text-primary hover:bg-muted/60"
                }`}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
