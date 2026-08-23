import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** عقار بلس wordmark using the real app logo. */
export function AqarPlusLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2.5 rounded-md text-lg font-bold tracking-tight text-primary transition hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent",
        className,
      )}
      aria-label="عقار بلس — الصفحة الرئيسية"
    >
      <Image
        src="/logo.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 rounded-xl object-contain"
        priority
      />
      <span className="hidden sm:inline">عقار بلس</span>
    </Link>
  );
}
