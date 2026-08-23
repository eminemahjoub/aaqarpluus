import { Receipt, FileBarChart, RefreshCw } from "lucide-react";
import { Reveal } from "./Reveal";

const UPDATES = [
  {
    icon: Receipt,
    tag: "التحصيل",
    title: "تحصيل إيجارات مؤتمت",
    description: "جدولة الدفعات تلقائياً مع تنبيهات تلقائية للمستأجرين قبل وبعد استحقاق الدفعة.",
  },
  {
    icon: FileBarChart,
    tag: "التقارير",
    title: "تقارير مالية تفصيلية",
    description: "تقارير الإيرادات والمصروفات والأرباح لكل عقار ووحدة، قابلة للتصدير بضغطة واحدة.",
  },
  {
    icon: RefreshCw,
    tag: "العقود",
    title: "تجديد العقود بذكاء",
    description: "تنبيهات استحقاق العقود وإعادة تجديدها بسعر محدث خلال ثوانٍ دون إعادة إنشاء عقد جديد.",
  },
];

export function Updates() {
  return (
    <section aria-labelledby="updates-heading" className="border-t border-border/60 bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="updates-heading" className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              آخر تحديثات المنصة
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              نطوّر عقار بلس باستمرار لتسهيل إدارة أعمالك العقارية.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {UPDATES.map((u, i) => (
            <Reveal key={u.title} delay={i * 0.1}>
              <article className="group h-full rounded-2xl border border-border/70 bg-white p-6 shadow-sm transition hover:border-primary/30 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <u.icon className="h-6 w-6 text-primary" aria-hidden />
                  </span>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent-foreground">{u.tag}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-foreground">{u.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{u.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
