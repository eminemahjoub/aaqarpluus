import { MotionConfig } from "framer-motion";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div dir="rtl" lang="ar" className="scroll-smooth">
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </div>
  );
}
