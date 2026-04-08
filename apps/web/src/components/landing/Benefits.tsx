import { BadgeCheck, Headphones, LineChart, Lock } from "lucide-react";

const benefits = [
  {
    icon: LineChart,
    title: "قرارات مبنية على بيانات",
    body: "مؤشرات موحّدة تساعد الإدارة على رؤية الأداء دون جداول معقدة.",
  },
  {
    icon: Lock,
    title: "ثقة للعلامة والمستثمر",
    body: "هيكلة صلاحيات وسجلات تدعم الجودة والشفافية في كل تعامل.",
  },
  {
    icon: Headphones,
    title: "دعم يفهم السوق المحلي",
    body: "فريق يراعي خصوصية السوق السعودي ومتطلبات الشركات العقارية.",
  },
  {
    icon: BadgeCheck,
    title: "تجربة فاخرة وسهلة",
    body: "واجهة هادئة تقلل الضجيج وتسرّع تدريب الفرق الجديدة.",
  },
];

export function Benefits() {
  return (
    <section
      id="benefits"
      className="scroll-mt-24 border-t border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-secondary/[0.08] py-20 sm:py-24"
      aria-labelledby="benefits-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2
              id="benefits-heading"
              className="text-3xl font-bold tracking-tight text-primary sm:text-4xl"
            >
              لماذا تختار عقار بلس؟
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              نجمع بين الفخامة في التجربة والذكاء في التشغيل — لتقديم خدمة عقارية
              تليق بعملائك وتدعم نموك بثقة.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {benefits.map((b) => (
              <li key={b.title}>
                <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-white/75 p-5 shadow-md backdrop-blur-lg transition hover:shadow-lg dark:bg-background/75">
                  <b.icon className="h-8 w-8 text-accent" aria-hidden />
                  <h3 className="mt-3 font-semibold text-primary">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
