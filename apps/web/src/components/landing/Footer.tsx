import Link from "next/link";

const columns = [
  {
    title: "المنتج",
    links: [
      { href: "/#features", label: "الميزات" },
      { href: "/#dashboard", label: "لوحة التحكم" },
      { href: "/#pricing", label: "الأسعار" },
    ],
  },
  {
    title: "الشركة",
    links: [
      { href: "/#testimonials", label: "آراء العملاء" },
      { href: "/#benefits", label: "لماذا نحن" },
      { href: "/#cta", label: "ابدأ الآن" },
    ],
  },
  {
    title: "قانوني",
    links: [
      { href: "#", label: "الخصوصية" },
      { href: "#", label: "الشروط" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-bold text-primary">عقار بلس</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              منصة إدارة عقارات ذكية للشركات في السعودية — فخامة في التجربة وثقة في
              التشغيل.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-primary">{col.title}</p>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition hover:text-secondary"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-center text-sm text-muted-foreground sm:flex-row sm:text-start">
          <p>© {new Date().getFullYear()} عقار بلس. جميع الحقوق محفوظة.</p>
          <p>صُنع بعناية للسوق العقاري السعودي</p>
        </div>
      </div>
    </footer>
  );
}
