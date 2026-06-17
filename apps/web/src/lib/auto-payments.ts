/**
 * Auto-generates a payment schedule for a rental contract.
 */

export type PaymentScheduleItem = {
  amount_sar: number;
  due_date: string; // ISO date string
  status: "pending";
  notes: string | null;
};

export function generatePaymentSchedule(args: {
  rent_total_sar: number;
  start_date: string;
  end_date: string;
  payment_frequency: string | null;
  installments_count: number | null;
}): PaymentScheduleItem[] {
  const { rent_total_sar, start_date, end_date, payment_frequency, installments_count } = args;

  if (!rent_total_sar || rent_total_sar <= 0) return [];
  if (!start_date || !end_date) return [];

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

  let count = installments_count ? Math.max(1, installments_count) : 1;
  const freq = String(payment_frequency ?? "").trim().toLowerCase();

  // Infer count from frequency if not provided
  if (!installments_count && freq) {
    const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));
    switch (freq) {
      case "monthly":
      case "شهري":
        count = Math.max(1, months);
        break;
      case "quarterly":
      case "ربع سنوي":
      case "ربع_سنوي":
        count = Math.max(1, Math.ceil(months / 3));
        break;
      case "half-yearly":
      case "semiannual":
      case "half yearly":
      case "نصف سنوي":
      case "نصف_سنوي":
        count = Math.max(1, Math.ceil(months / 6));
        break;
      case "yearly":
      case "annual":
      case "سنوي":
        count = Math.max(1, Math.ceil(months / 12));
        break;
      case "weekly":
      case "أسبوعي":
        count = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
        break;
      case "one_time":
      case "one time":
      case "مرة واحدة":
      case "لمرة واحدة":
        count = 1;
        break;
      default:
        count = Math.max(1, months);
    }
  }

  const amountPer = Math.round((rent_total_sar / count) * 100) / 100;

  const items: PaymentScheduleItem[] = [];
  for (let i = 0; i < count; i++) {
    const due = new Date(start);
    switch (freq) {
      case "monthly":
      case "شهري":
        due.setMonth(start.getMonth() + i);
        break;
      case "quarterly":
      case "ربع سنوي":
      case "ربع_سنوي":
        due.setMonth(start.getMonth() + i * 3);
        break;
      case "half-yearly":
      case "semiannual":
      case "half yearly":
      case "نصف سنوي":
      case "نصف_سنوي":
        due.setMonth(start.getMonth() + i * 6);
        break;
      case "yearly":
      case "annual":
      case "سنوي":
        due.setFullYear(start.getFullYear() + i);
        break;
      case "weekly":
      case "أسبوعي":
        due.setDate(start.getDate() + i * 7);
        break;
      default:
        // Linear split between start and end
        const fraction = count <= 1 ? 0 : i / (count - 1);
        const ms = start.getTime() + fraction * (end.getTime() - start.getTime());
        due.setTime(ms);
    }
    items.push({
      amount_sar: amountPer,
      due_date: due.toISOString().split("T")[0],
      status: "pending",
      notes: i === count - 1 && count > 1 ? "القسط الأخير" : `قسط ${i + 1}/${count}`,
    });
  }

  // Adjust last item to absorb rounding errors
  if (items.length > 1) {
    const sum = items.reduce((a, b) => a + b.amount_sar, 0);
    const diff = Math.round((rent_total_sar - sum) * 100) / 100;
    items[items.length - 1].amount_sar = Math.round((items[items.length - 1].amount_sar + diff) * 100) / 100;
  }

  return items;
}
