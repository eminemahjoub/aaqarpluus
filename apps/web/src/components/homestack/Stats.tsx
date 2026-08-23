"use client";

import { animate, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { Reveal } from "./Reveal";
import type { LandingStats } from "@/lib/landing-stats";

type Stat = {
  value: number | null;
  mode: "count" | "percent" | "sar";
  decimals?: number;
  label: string;
};

function formatValue(v: number, mode: Stat["mode"], decimals: number) {
  if (mode === "sar") {
    return new Intl.NumberFormat("ar-SA", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  }
  return new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);
}

function StatCounter({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const mv = useMotionValue(0);
  const decimals = stat.decimals ?? 0;
  const formatted = useTransform(mv, (v) => formatValue(v, stat.mode, decimals));

  useEffect(() => {
    if (!inView || stat.value === null) return;
    const controls = animate(mv, stat.value, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [inView, mv, stat.value]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    return formatted.on("change", (latest) => {
      node.textContent = latest;
    });
  }, [formatted]);

  const suffix =
    stat.mode === "percent" ? "٪" : stat.mode === "sar" ? "ر.س" : "+";

  return (
    <div className="text-center">
      <p className="flex items-baseline justify-center gap-1 text-4xl font-bold tracking-tight text-primary sm:text-5xl">
        <span ref={ref}>{stat.value === null ? "—" : "٠"}</span>
        {stat.value !== null && <span className="text-accent">{suffix}</span>}
      </p>
      <p className="mt-2.5 text-sm text-muted-foreground sm:text-base">{stat.label}</p>
    </div>
  );
}

export function Stats({ stats }: { stats: LandingStats }) {
  const items: Stat[] = [
    { value: stats.agencies, mode: "count", label: "شركة عقارية تعمل على المنصة" },
    { value: stats.units, mode: "count", label: "وحدة عقارية مدارة" },
    { value: stats.occupancy, mode: "percent", decimals: 1, label: "متوسط الإشغال" },
    { value: stats.collectedSar, mode: "sar", label: "إجمالي التحصيل عبر المنصة" },
  ];

  return (
    <section aria-label="أرقام المنصة" className="border-t border-border/60 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="grid gap-10 rounded-3xl border border-border/60 bg-muted/30 px-6 py-12 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
            {items.map((stat) => (
              <StatCounter key={stat.label} stat={stat} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
