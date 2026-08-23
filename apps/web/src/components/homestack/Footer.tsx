import Image from "next/image";
import Link from "next/link";
import { SocialLinks } from "./SocialLinks";

const COLUMNS = [
  {
    title: "المنتج",
    links: [
      { href: "/#features", label: "الميزات" },
      { href: "/#benefits", label: "لماذا نحن" },
      { href: "/#pricing", label: "الأسعار" },
    ],
  },
  {
    title: "الشركة",
    links: [
      { href: "/#faq", label: "أسئلة شائعة" },
      { href: "/#cta", label: "ابدأ الآن" },
    ],
  },
  {
    title: "قانوني",
    links: [
      { href: "/privacy", label: "الخصوصية" },
      { href: "/terms", label: "الشروط" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              aria-label="عقار بلس — الصفحة الرئيسية"
            >
              <Image
                src="/logo.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl object-contain"
              />
              <span className="text-lg font-bold text-primary">عقار بلس</span>
            </Link>
            <p className="mt-4 max-w-xs leading-relaxed text-muted-foreground">
              منصة إدارة عقارات ذكية للشركات في السعودية — فخامة في التجربة وثقة
              في التشغيل.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={`روابط ${column.title}`}>
              <h3 className="text-sm font-semibold text-primary">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-muted-foreground transition hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-border/60 pt-8 text-center text-sm text-muted-foreground sm:flex-row sm:text-start">
          <p>© {new Date().getFullYear()} عقار بلس. جميع الحقوق محفوظة.</p>
          <SocialLinks />
          <p>صُنع بعناية للسوق العقاري السعودي</p>
        </div>
      </div>
    </footer>
  );
}
