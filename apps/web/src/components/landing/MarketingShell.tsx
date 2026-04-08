import { Footer } from "./Footer";

type MarketingShellProps = {
  children: React.ReactNode;
  mainId?: string;
  variant?: "marketing" | "auth";
};

/**
 * هيكل الصفحة التسويقية الموحّد: شريط علوي + محتوى + تذييل.
 * يُستخدم في الصفحة الرئيسية وصفحات المصادقة ليبقى الشكل والهوية متسقين.
 */
export function MarketingShell({
  children,
  mainId = "main-content",
  variant = "marketing",
}: MarketingShellProps) {
  const isAuth = variant === "auth";

  return (
    <div
      className={
        isAuth
          ? "relative flex min-h-screen flex-col bg-gray-50 dark:bg-black"
          : "relative flex min-h-screen flex-col bg-gradient-to-br from-primary/[0.08] via-background to-secondary/[0.12] dark:from-primary/20 dark:via-background dark:to-secondary/15"
      }
    >
      {!isAuth ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(197,160,33,0.1),transparent_55%)]"
          aria-hidden
        />
      ) : null}
      <a
        href={`#${mainId}`}
        className="fixed start-4 top-4 z-[100] -translate-y-20 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground opacity-0 transition focus:translate-y-0 focus:opacity-100"
      >
        تخطي إلى المحتوى
      </a>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
      <Footer />
    </div>
  );
}
