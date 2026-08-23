import { MapPin } from "lucide-react";
import { Reveal } from "./Reveal";
import type { LandingCity } from "@/lib/landing-stats";

export function Cities({ cities }: { cities: LandingCity[] }) {
  if (cities.length === 0) return null;

  const max = Math.max(...cities.map((c) => c.count), 1);

  return (
    <section aria-labelledby="cities-heading" className="border-t border-border/60 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="cities-heading" className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              نعمل في مدن السعودية
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              عقارات فعلية تُدار عبر المنصة في مختلف المدن.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cities.map((c, i) => (
            <Reveal key={c.city} delay={i * 0.06}>
              <div className="group rounded-2xl border border-border/70 bg-muted/30 p-6 transition hover:border-primary/30 hover:bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <MapPin className="h-5 w-5 text-primary" aria-hidden />
                    </span>
                    <h3 className="font-bold text-foreground">{c.city}</h3>
                  </div>
                  <span className="text-2xl font-bold text-primary">{c.count}</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border/60" aria-hidden>
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-primary to-secondary transition-all duration-700"
                    style={{ width: `${Math.max((c.count / max) * 100, 8)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.count} عقار</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
