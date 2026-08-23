"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Reveal } from "./Reveal";

export function DemoRequest() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `طلب نسخة تجريبية — ${company || name}`;
    const body =
      `الاسم: ${name}\n` +
      `الشركة: ${company}\n` +
      `رقم الجوال: ${phone}\n\n` +
      `أرغب في تجربة منصة عقار بلس.`;
    window.location.href = `mailto:sales@aaqarplus.sa?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <section id="demo" aria-labelledby="demo-heading" className="scroll-mt-24 border-t border-border/60 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div>
              <h2 id="demo-heading" className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                جرّب المنصة بنفسك
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                اترك بياناتك وسيتواصل معك فريقنا لتجهيز نسخة تجريبية كاملة لمنصة عقار بلس، مع جلسة شرح مخصصة لطبيعة أعمالك.
              </p>
              <ul className="mt-8 space-y-3">
                {["إعداد حساب تجريبي كامل خلال ٢٤ ساعة", "جلسة شرح عبر الإنترنت مع خبير المنصة", "مساعدة في ترحيل بياناتك عند الاقتناع"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <form onSubmit={handleSubmit} className="rounded-3xl border border-border/70 bg-muted/30 p-8 shadow-sm">
              <div className="space-y-5">
                <div>
                  <label htmlFor="demo-name" className="mb-1.5 block text-sm font-semibold text-foreground">
                    الاسم
                  </label>
                  <input
                    id="demo-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: خالد العتيبي"
                    className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label htmlFor="demo-company" className="mb-1.5 block text-sm font-semibold text-foreground">
                    اسم الشركة
                  </label>
                  <input
                    id="demo-company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="مثال: شركة أركان العقارية"
                    className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label htmlFor="demo-phone" className="mb-1.5 block text-sm font-semibold text-foreground">
                    رقم الجوال
                  </label>
                  <input
                    id="demo-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Send className="h-4 w-4 -scale-x-100" aria-hidden />
                  اطلب نسخة تجريبية
                </button>
                {sent && (
                  <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-center text-sm font-semibold text-primary" role="status">
                    تم فتح بريدك الإلكتروني — أكمل الإرسال وسنتواصل معك قريباً
                  </p>
                )}
              </div>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
