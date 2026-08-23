import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PhoneFrameProps = {
  children?: ReactNode;
  className?: string;
  screenClassName?: string;
  label: string;
};

/**
 * A CSS-only iPhone 15 Pro style device frame used to showcase
 * عقار بلس screens on the landing page.
 */
export function PhoneFrame({
  children,
  className,
  screenClassName,
  label,
}: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative w-[270px] shrink-0 rounded-[3.2rem] bg-[#0c0c0c] p-[9px] shadow-[0_40px_80px_-20px_rgba(27,94,60,0.35)] ring-1 ring-black/10 sm:w-[300px]",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <div className="absolute -left-1 top-24 h-16 w-[3px] rounded-l-md bg-[#2a2a2a]" aria-hidden />
      <div className="absolute -left-1 top-40 h-9 w-[3px] rounded-l-md bg-[#2a2a2a]" aria-hidden />
      <div className="absolute -right-1 top-32 h-14 w-[3px] rounded-r-md bg-[#2a2a2a]" aria-hidden />

      <div
        className={cn(
          "relative aspect-[9/19] overflow-hidden rounded-[2.6rem] bg-white",
          screenClassName,
        )}
      >
        {children}
        <div className="absolute left-1/2 top-2.5 z-30 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
        <div className="absolute right-4 top-5 z-30 h-2.5 w-2.5 rounded-full bg-black/30" aria-hidden />
      </div>
    </div>
  );
}
