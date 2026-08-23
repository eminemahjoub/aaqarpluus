"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";
import { AqarPhoneScreen } from "./AqarPhoneScreen";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-white pb-16 pt-8 sm:pb-24 sm:pt-10"
    >
      <div
        className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full bg-accent/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-8">
        <div className="text-center lg:text-start">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-[13px] font-medium text-primary"
          >
            <Sparkles className="h-4 w-4 text-accent" aria-hidden />
            منصة عقارية موثوقة للشركات في السعودية
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="text-balance text-4xl font-bold leading-[1.2] tracking-tight text-primary sm:text-5xl lg:text-6xl"
          >
            نظام إدارة عقارات <span className="text-accent">ذكي</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18 }}
            className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground lg:mx-0"
          >
            أدر محفظتك العقارية، عقود الإيجار، والتحصيل من لوحة واحدة — بتجربة
            فاخرة تعكس ثقة علامتك وتساعد فرقك على اتخاذ قرارات أذكى بسرعة.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28 }}
            className="mt-9 flex flex-col items-center gap-3.5 sm:flex-row sm:justify-center lg:justify-start"
            role="group"
            aria-label="إجراءات رئيسية"
          >
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-8 py-3.5 text-base font-semibold text-accent-foreground shadow-lg transition hover:scale-[1.02] hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-auto"
            >
              ابدأ مجاناً
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <Link
              href="#pricing"
              className="inline-flex w-full items-center justify-center rounded-2xl border-2 border-primary/30 bg-background/80 px-8 py-3.5 text-base font-semibold text-primary shadow-sm backdrop-blur-lg transition hover:border-primary hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-auto"
            >
              احجز عرضاً توضيحياً
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotateY: 18 }}
          animate={{ opacity: 1, y: 0, rotateY: 6 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex justify-center lg:justify-start"
          style={{ transformPerspective: 1200 }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-[110%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-primary/20 via-accent/10 to-transparent blur-2xl"
            aria-hidden
          />
          <PhoneFrame label="عقار بلس — لوحة التحكم للجوال">
            <AqarPhoneScreen />
          </PhoneFrame>
        </motion.div>
      </div>
    </section>
  );
}
