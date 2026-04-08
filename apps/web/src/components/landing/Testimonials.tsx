import { Star } from "lucide-react";

const quotes = [
  {
    name: "شركة أركان العقارية",
    role: "مدير العمليات",
    text: "لوحة التحكم وضعت لنا صورة واحدة للإشغال والتحصيل. قرارات أسرع وأقل اجتماعات.",
  },
  {
    name: "مجموعة نخبة المسكن",
    role: "الرئيس التنفيذي",
    text: "تجربة المستخدم راقية وتناسب عملاءنا — والفريق اعتاد النظام خلال أيام.",
  },
  {
    name: "مؤسسة درب الاستثمار",
    role: "رئيس المالية",
    text: "التقارير جاهزة للعرض على المستثمرين. شفافية أعلى دون تعقيد إضافي.",
  },
];

export function Testimonials() {
  return (
    <section
      id="testimonials"
      className="scroll-mt-24 py-20 sm:py-24"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="testimonials-heading"
            className="text-3xl font-bold tracking-tight text-primary sm:text-4xl"
          >
            ماذا يقول شركاؤنا
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            شركات عقارية في السعودية تثق بعقار بلس لتبسيط التشغيل اليومي.
          </p>
        </div>
        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {quotes.map((q) => (
            <li key={q.name}>
              <figure className="flex h-full flex-col rounded-2xl border border-border/80 bg-white/80 p-6 shadow-md backdrop-blur-lg transition hover:shadow-xl dark:bg-background/80">
                <div className="flex gap-1" role="img" aria-label="تقييم 5 من 5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 fill-accent text-accent"
                      aria-hidden
                    />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  «{q.text}»
                </blockquote>
                <figcaption className="mt-6 border-t border-border/60 pt-4">
                  <p className="font-semibold text-primary">{q.name}</p>
                  <p className="text-sm text-muted-foreground">{q.role}</p>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
