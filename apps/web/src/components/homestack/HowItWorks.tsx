import { UserPlus, Building2, Wallet } from "lucide-react";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    icon: UserPlus,
    title: "أنشئ حسابك",
    description: "سجّل خلال دقائق وأنشئ ملف شركتك العقارية مع إضافة مكاتبك وفريقك.",
  },
  {
    icon: Building2,
    title: "أضف عقاراتك ووحداتك",
    description: "سجّل العقارات والوحدات والمستأجرين والعقود في مكان واحد منظم.",
  },
  {
    icon: Wallet,
    title: "ابدأ بالتحصيل",
    description: "تابع الإيجارات والدفعات والمصروفات وتقارير الأداء بشكل لحظي.",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="border-t border-border/60 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="how-heading" className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              كيف تعمل المنصة؟
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              ثلاث خطوات بسيطة تفصلك عن إدارة عقاراتك بكامل الاحترافية.
            </p>
          </div>
        </Reveal>
        <div className="relative mt-14">
          <div className="absolute inset-x-0 top-10 hidden h-px bg-border/70 lg:block" aria-hidden />
          <div className="grid gap-10 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.12}>
                <div className="relative text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 shadow-sm">
                    <step.icon className="h-9 w-9 text-primary" aria-hidden />
                    <span className="absolute -end-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">{step.title}</h3>
                  <p className="mx-auto mt-2.5 max-w-xs text-muted-foreground">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
