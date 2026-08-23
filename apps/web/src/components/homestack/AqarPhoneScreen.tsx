"use client";

import { motion } from "framer-motion";
import { Bell, CheckCircle2, FileText, Home, Wallet } from "lucide-react";

const KPIS = [
  { label: "الإشغال", value: "94٪", tone: "text-primary" },
  { label: "التحصيل الشهري", value: "٢.٤م", tone: "text-accent" },
  { label: "عقود تنتهي قريباً", value: "١٢", tone: "text-secondary" },
];

const ALERTS = [
  { text: "تجديد عقد — برج النخيل", tone: "bg-primary" },
  { text: "دفعة متأخرة — وحدة ١٢B", tone: "bg-accent" },
  { text: "طلب صيانة — مجمع الواحة", tone: "bg-secondary" },
];

/** عقار بلس mobile dashboard mockup — rendered inside a PhoneFrame. */
export function AqarPhoneScreen() {
  return (
    <div className="relative flex h-full flex-col bg-[#f6f6f4]">
      <div className="flex items-center justify-between px-5 pb-1 pt-3 text-white">
        <span className="text-[10px] font-semibold">9:41</span>
        <span className="flex items-center gap-1" aria-hidden>
          <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
            <rect x="0" y="6" width="3" height="4" rx="1" />
            <rect x="4" y="4" width="3" height="6" rx="1" />
            <rect x="8" y="2" width="3" height="8" rx="1" />
          </svg>
          <svg width="15" height="10" viewBox="0 0 15 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="0.5" y="0.5" width="12" height="9" rx="2.5" />
            <rect x="1.5" y="1.5" width="9" height="7" rx="1.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
      </div>

      <header className="bg-gradient-to-br from-primary to-secondary px-4 pb-3 text-white">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-bold">عقار بلس</p>
          <span className="relative">
            <Bell className="h-4 w-4" aria-hidden />
            <span className="absolute -left-1.5 -top-1 h-2 w-2 rounded-full bg-accent" aria-hidden />
          </span>
        </div>
        <p className="mt-2 text-[10px] text-white/75">مساء الخير، مدير المحفظة</p>
      </header>

      <div className="flex-1 space-y-2.5 overflow-hidden px-3 py-3">
        <div className="grid grid-cols-3 gap-1.5">
          {KPIS.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-primary/10 bg-white p-2 shadow-sm">
              <p className="text-[8px] text-muted-foreground">{kpi.label}</p>
              <p className={`mt-0.5 text-[13px] font-bold ${kpi.tone}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-primary/10 bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-primary">اتجاه الإيرادات</p>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">
              +12٪
            </span>
          </div>
          <div className="mt-2 flex h-12 items-end gap-1">
            {[40, 55, 48, 70, 62, 80, 75, 90].map((h, i) => (
              <span
                key={i}
                className="w-full rounded-t-sm bg-gradient-to-t from-primary to-secondary"
                style={{ height: `${h}%` }}
                aria-hidden
              />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-primary/10 bg-white p-2.5 shadow-sm">
          <p className="text-[10px] font-semibold text-primary">تنبيهات اليوم</p>
          <ul className="mt-1.5 space-y-1.5">
            {ALERTS.map((alert) => (
              <li key={alert.text} className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${alert.tone}`} aria-hidden />
                {alert.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-16 left-1/2 z-20 flex w-[86%] -translate-x-1/2 items-center gap-2 rounded-xl border border-primary/10 bg-white/95 p-2.5 shadow-[0_12px_28px_-8px_rgba(27,94,60,0.35)] backdrop-blur-sm"
        role="status"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
        <p className="text-[9px] leading-snug text-muted-foreground">
          تم استلام دفعة <span className="font-bold text-primary">١٢٬٥٠٠ ر.س</span> — وحدة ٨A
        </p>
      </motion.div>

      <nav className="flex items-center justify-around border-t border-primary/10 bg-white py-1.5" aria-hidden>
        {[
          { icon: Home, label: "الرئيسية", active: true },
          { icon: Wallet, label: "المحفظة", active: false },
          { icon: FileText, label: "العقود", active: false },
        ].map((item) => (
          <span key={item.label} className="flex flex-col items-center gap-0.5">
            <item.icon
              className={`h-4 w-4 ${item.active ? "text-primary" : "text-muted-foreground/50"}`}
            />
            <span className={`text-[7px] ${item.active ? "font-bold text-primary" : "text-muted-foreground/50"}`}>
              {item.label}
            </span>
          </span>
        ))}
      </nav>
    </div>
  );
}
