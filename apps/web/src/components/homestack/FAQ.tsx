"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

const FAQS = [
  {
    q: "كم يستغرق إعداد النظام وإدخال بيانات محفظتي؟",
    a: "يتم إعداد الحساب خلال دقائق، وفريقنا يساعدك على استيراد بيانات وحداتك وعقودك بأمان — لتشغيل كامل خلال أيام وليس أسابيع.",
  },
  {
    q: "هل يمكنني تخصيص صلاحيات فريقي؟",
    a: "نعم. وحدات صلاحيات مخصصة للمبيعات والصيانة والمحاسبة مع سجل نشاط مفصل لكل عملية، بما يدعم الحوكمة والرقابة الداخلية.",
  },
  {
    q: "كيف يعمل التحصيل والمتابعة؟",
    a: "جدولة الإيجارات، تذكيرات تلقائية قبل الاستحقاق، وتتبع المدفوعات لحظياً مع تقارير تحصيل جاهزة للعرض على الإدارة والمستثمرين.",
  },
  {
    q: "هل بياناتنا آمنة؟",
    a: "نعم — تشفير البيانات، نسخ احتياطي دوري، وسجلات تدقيق كاملة تدعم متطلبات الحوكمة وحماية معلومات العملاء.",
  },
  {
    q: "هل يوجد دعم فني بعد الاشتراك؟",
    a: "بالتأكيد. فريقنا يفهم السوق العقاري السعودي ويراعي خصوصيته، ويتوفر دعم عبر البريد والقنوات المباشرة حسب خطتك.",
  },
  {
    q: "هل يمكنني تجربة النظام قبل الاشتراك؟",
    a: "نعم — ابدأ تجربتك المجانية اليوم بدون بطاقة ائتمانية، واستكشف جميع الوحدات قبل اتخاذ قرارك.",
  },
  {
    q: "هل تدعم المنصة التكامل مع منصات إيجار وسكني؟",
    a: "نعم. المنصة مصممة لتتوافق مع متطلبات السوق السعودي وتدعم استيراد بيانات العقود والمستأجرين بما يسهل الربط مع المنصات الحكومية عند توفر خدماتها.",
  },
  {
    q: "كيف يتم ترحيل بياناتي الحالية إلى عقار بلس؟",
    a: "فريقنا يساعدك على استيراد بيانات العقارات والوحدات والعقود والمستأجرين من ملفات Excel أو أنظمتك الحالية بأمان، مع ضمان سلامة البيانات قبل التشغيل الفعلي.",
  },
];

function FaqItem({
  faq,
  index,
  open,
  onToggle,
}: {
  faq: { q: string; a: string };
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = `faq-panel-${index}`;
  const buttonId = `faq-button-${index}`;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors",
        open
          ? "border-accent/50 bg-white shadow-[0_16px_40px_-16px_rgba(27,94,60,0.2)] dark:bg-background"
          : "border-border/80 bg-white/70 hover:border-primary/30 dark:bg-background/70",
      )}
    >
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-start text-base font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {faq.q}
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300",
              open ? "rotate-45 bg-accent text-accent-foreground" : "bg-muted text-primary",
            )}
            aria-hidden
          >
            <Plus className="h-4 w-4" />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="px-6 pb-6 leading-relaxed text-muted-foreground">{faq.a}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-border/60 bg-muted/25 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-primary sm:text-4xl">
            أسئلة شائعة
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            كل ما تريد معرفته عن عقار بلس قبل أن تبدأ.
          </p>
        </Reveal>

        <div className="mt-12 space-y-4">
          {FAQS.map((faq, i) => (
            <Reveal key={faq.q} delay={Math.min(i * 0.06, 0.3)}>
              <FaqItem
                faq={faq}
                index={i}
                open={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
