import { Reveal } from "./Reveal";

const CLIENTS = [
  "شركة أركان العقارية",
  "مجموعة نخبة المسكن",
  "مؤسسة درب الاستثمار",
];

const ROW = [...CLIENTS, ...CLIENTS, ...CLIENTS];

export function SocialProof() {
  return (
    <section aria-label="عملاء يثقون بعقار بلس" className="overflow-hidden bg-white py-12">
      <Reveal>
        <p className="text-center text-[13px] font-semibold tracking-wide text-muted-foreground">
          شركات عقارية في السعودية تثق بعقار بلس
        </p>
      </Reveal>

      <div
        className="group relative mt-8"
        dir="ltr"
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-white to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-white to-transparent"
          aria-hidden
        />
        <div className="marquee-track flex w-max items-center gap-16 pr-16">
          {ROW.map((client, i) => (
            <span
              key={`${client}-${i}`}
              className="select-none whitespace-nowrap text-lg font-bold text-primary opacity-40 transition-opacity hover:opacity-70"
            >
              {client}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
