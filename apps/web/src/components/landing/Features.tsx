import {
  BarChart3,
  Building2,
  FileText,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

const items = [
  {
    icon: Building2,
    title: "إدارة المحفظة",
    description:
      "تتبع الوحدات والمباني والمستأجرين في مكان واحد مع بطاقات وحدات واضحة.",
  },
  {
    icon: FileText,
    title: "عقود ووثائق",
    description:
      "قوالب عقود، تذكيرات بالتجديد، وأرشفة آمنة تقلل المخاطر التشغيلية.",
  },
  {
    icon: Wallet,
    title: "تحصيل ومدفوعات",
    description:
      "جدولة الإيجارات، تتبع المدفوعات، وتقارير التحصيل لحظياً.",
  },
  {
    icon: BarChart3,
    title: "تحليلات وتقارير",
    description:
      "لوحات أداء، مؤشرات الإشغال، وتصدير تقارير للإدارة والمستثمرين.",
  },
  {
    icon: Users,
    title: "فرق وصلاحيات",
    description:
      "أدوار مخصصة للمبيعات والصيانة والمحاسبة مع سجل نشاط مفصل.",
  },
  {
    icon: ShieldCheck,
    title: "أمان وامتثال",
    description:
      "تشفير، نسخ احتياطي، وسجلات تدقيق تدعم متطلبات الحوكمة.",
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-24 border-t border-border/60 bg-muted/30 py-20 sm:py-24"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="features-heading"
            className="text-3xl font-bold tracking-tight text-primary sm:text-4xl"
          >
            كل ما تحتاجه لتشغيل عقاراتك
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            وحدات مصممة للشركات العقارية التي تبحث عن السرعة والوضوح والتحكم.
          </p>
        </div>
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
            <li key={item.title}>
              <article className="group h-full rounded-2xl border border-border/80 bg-white/80 p-6 shadow-md backdrop-blur-lg transition hover:scale-[1.02] hover:shadow-xl dark:bg-background/80">
                <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10 p-3 text-primary ring-1 ring-primary/10">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </article>
            </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
