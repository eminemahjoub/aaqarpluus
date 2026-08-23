import { ShieldCheck, Lock, DatabaseBackup, EyeOff } from "lucide-react";
import { Reveal } from "./Reveal";

const POINTS = [
  {
    icon: Lock,
    title: "تشفير البيانات",
    description: "جميع بياناتك مشفّرة أثناء النقل والتخزين لحمايتها من أي وصول غير مصرح به.",
  },
  {
    icon: DatabaseBackup,
    title: "نسخ احتياطي مستمر",
    description: "نسخ احتياطية منتظمة لضمان عدم فقدان أي من بيانات عقاراتك وعقودك.",
  },
  {
    icon: EyeOff,
    title: "التحكم بالصلاحيات",
    description: "حدد من يمكنه الاطلاع على العقود والبيانات المالية لكل مستخدم داخل شركتك.",
  },
  {
    icon: ShieldCheck,
    title: "توافق مع الأنظمة",
    description: "المنصة مبنية وفق أفضل الممارسات وتلتزم بمتطلبات حماية البيانات في السوق السعودي.",
  },
];

export function Security() {
  return (
    <section aria-labelledby="security-heading" className="border-t border-border/60 bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div>
              <h2 id="security-heading" className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                بياناتك محمية وأمانك أولويتنا
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                ندرك أن بياناتك العقارية حساسة، لذلك بنينا المنصة على أساس متين من الأمان والخصوصية منذ اليوم الأول.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary">
                  تشفير من الطرف إلى الطرف
                </span>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent-foreground">
                  نسخ احتياطي يومي
                </span>
                <span className="rounded-full border border-border/70 bg-white px-4 py-1.5 text-sm font-semibold text-muted-foreground">
                  صلاحيات مرنة
                </span>
              </div>
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {POINTS.map((point, i) => (
              <Reveal key={point.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <point.icon className="h-6 w-6 text-primary" aria-hidden />
                  </div>
                  <h3 className="mt-4 font-bold text-foreground">{point.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{point.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
