import { TrendingUp } from "lucide-react";

export function DashboardPreview() {
  return (
    <section
      id="dashboard"
      className="scroll-mt-24 py-20 sm:py-24"
      aria-labelledby="dashboard-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="dashboard-heading"
            className="text-3xl font-bold tracking-tight text-primary sm:text-4xl"
          >
            لوحة تحكم تلخص أداءك
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            معاينة سريعة لما يراه فريقك يومياً — أرقام واضحة، وتنبيهات في الوقت المناسب.
          </p>
        </div>

        <div className="relative mt-14">
          <div
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 blur-2xl"
            aria-hidden
          />
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-white/70 shadow-2xl backdrop-blur-lg dark:bg-background/70">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/90" aria-hidden />
                <span className="h-3 w-3 rounded-full bg-amber-400/90" aria-hidden />
                <span className="h-3 w-3 rounded-full bg-emerald-500/90" aria-hidden />
              </div>
              <p className="text-xs text-muted-foreground sm:text-sm">عقار بلس — لوحة التحكم</p>
              <TrendingUp className="h-5 w-5 text-accent" aria-hidden />
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-[1fr_280px] sm:gap-6 sm:p-6">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "الإشغال", value: "94٪", tone: "text-primary" },
                    { label: "التحصيل الشهري", value: "٢.٤م", tone: "text-secondary" },
                    { label: "عقود تنتهي قريباً", value: "١٢", tone: "text-accent" },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-2xl border border-border/60 bg-muted/40 p-4 shadow-sm"
                    >
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <p className={`mt-1 text-2xl font-bold ${kpi.tone}`}>{kpi.value}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border border-dashed border-primary/25 bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
                  <p className="text-sm font-medium text-primary">اتجاه الإيرادات</p>
                  <div className="mt-4 flex h-36 items-end justify-between gap-2">
                    {[40, 55, 48, 70, 62, 80, 75, 90].map((h, i) => (
                      <div
                        key={i}
                        className="w-full rounded-t-md bg-gradient-to-t from-primary to-secondary opacity-90"
                        style={{ height: `${h}%` }}
                        role="presentation"
                      />
                    ))}
                  </div>
                </div>
              </div>
              <aside className="space-y-3 rounded-2xl border border-border/60 bg-white/80 p-4 backdrop-blur-md dark:bg-background/80">
                <p className="text-sm font-semibold text-primary">تنبيهات</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="rounded-xl bg-muted/60 px-3 py-2">تجديد عقد — برج النخيل</li>
                  <li className="rounded-xl bg-muted/60 px-3 py-2">دفعة متأخرة — وحدة ١٢B</li>
                  <li className="rounded-xl bg-muted/60 px-3 py-2">طلب صيانة — مجمع الواحة</li>
                </ul>
                <button
                  type="button"
                  className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground shadow-md"
                  tabIndex={-1}
                  aria-hidden
                >
                  عرض التفاصيل
                </button>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
