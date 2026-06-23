function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateAr(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const str = value instanceof Date ? value.toISOString() : String(value);
  const date = str.includes("T") ? new Date(str) : new Date(`${str}T00:00:00`);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

function formatCurrencyAr(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getContractNumber(contract: any): string {
  if (contract?.extra && typeof contract.extra === "object") {
    return String((contract.extra as any).contract_number ?? "");
  }
  return "";
}

export type ReceiptData = {
  payment: any;
  contract: any;
  receiptNumber: string;
  company: {
    nameAr: string;
    nameEn: string;
    descAr: string;
    descEn: string;
    phone: string;
    cr: string;
    vat: string;
    addressAr: string;
    addressEn: string;
    logoUrl: string | null;
  };
};

export function generateReceiptHtml(data: ReceiptData): string {
  const { payment, contract, receiptNumber, company } = data;
  const contact = (contract as any)?.contact;
  const property = (contract as any)?.property;
  const unit = (contract as any)?.unit;
  const contractNumber = getContractNumber(contract);
  const payerName = escapeHtml(contact?.name ?? "");
  const amount = formatCurrencyAr((payment as any)?.amount_sar);
  const rawAmount = Number((payment as any)?.amount_sar) || 0;
  const vatRate = 15;
  const vatAmount = rawAmount * (vatRate / 100);
  const totalWithVat = rawAmount + vatAmount;
  const subtotalFormatted = formatCurrencyAr(rawAmount);
  const vatFormatted = formatCurrencyAr(vatAmount);
  const totalFormatted = formatCurrencyAr(totalWithVat);
  const dueDate = formatDateAr((payment as any)?.due_date);
  const paidAt = formatDateAr((payment as any)?.paid_at);
  const paymentStatus = (payment as any)?.status === "paid" ? "مدفوع" : "غير مدفوع";
  const purpose = escapeHtml(
    `إيجار ${escapeHtml(property?.name ?? "")}${unit?.label ? ` - ${escapeHtml(unit.label)}` : ""}`
  );
  const notes = escapeHtml((payment as any)?.notes ?? "");
  const today = formatDateAr(new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>سند قبض - ${receiptNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
    background: #f0f2f5;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 100vh;
    padding: 20px;
    color: #1a202c;
  }
  .receipt-container {
    width: 210mm;
    min-height: 297mm;
    background: #FFFFFF;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    position: relative;
    overflow: hidden;
    padding: 30px 40px 0 40px;
  }
  .top-border {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 6px;
    background: #1a365d;
  }
  .watermark {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 80px;
    font-weight: 800;
    color: rgba(26, 54, 93, 0.03);
    z-index: 0;
    pointer-events: none;
    white-space: nowrap;
  }
  .content { position: relative; z-index: 1; }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }
  .company-info { text-align: right; }
  .company-name {
    font-size: 26px;
    font-weight: 800;
    color: #1a365d;
    line-height: 1.3;
  }
  .company-name-en {
    font-size: 16px;
    color: #4a5568;
    margin-top: 2px;
    direction: ltr;
    text-align: right;
  }
  .company-desc {
    font-size: 14px;
    color: #718096;
    margin-top: 4px;
  }
  .company-desc-en {
    font-size: 14px;
    color: #718096;
    direction: ltr;
    text-align: right;
  }
  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
  }
  .logo-placeholder {
    width: 100px;
    height: 100px;
    border-radius: 12px;
    background: #1a365d;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 18px;
    font-weight: 700;
    overflow: hidden;
  }
  .logo-placeholder img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .receipt-number-box {
    background: #fff5f5;
    border: 2px solid #c53030;
    border-radius: 8px;
    padding: 8px 20px;
    text-align: center;
  }
  .receipt-number-label {
    font-size: 11px;
    color: #c53030;
    font-weight: 500;
  }
  .receipt-number {
    font-size: 22px;
    font-weight: 800;
    color: #c53030;
    letter-spacing: 3px;
  }

  /* Title */
  .title-section {
    background: #f7fafc;
    border-right: 5px solid #1a365d;
    border-radius: 8px;
    padding: 15px 25px;
    text-align: center;
    margin-bottom: 25px;
  }
  .title-ar {
    font-size: 28px;
    font-weight: 800;
    color: #1a365d;
  }
  .title-en {
    font-size: 14px;
    color: #718096;
    direction: ltr;
    margin-top: 2px;
  }

  /* Form fields */
  .form-fields { margin-bottom: 20px; }
  .field-row {
    background: #fafafa;
    border-right: 3px solid #cbd5e0;
    border-radius: 6px;
    padding: 12px 18px;
    margin-bottom: 10px;
    transition: all 0.2s;
  }
  .field-row:hover {
    border-right-color: #1a365d;
    background: #f0f0f0;
  }
  .field-label {
    font-size: 14px;
    font-weight: 700;
    color: #2d3748;
    margin-bottom: 4px;
  }
  .field-label-en {
    font-size: 12px;
    color: #a0aec0;
    direction: ltr;
    text-align: right;
  }
  .field-value {
    font-size: 16px;
    color: #1a202c;
    border-bottom: 2px dashed #cbd5e0;
    padding-bottom: 4px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .field-badge {
    background: #edf2f7;
    color: #2d3748;
    font-size: 12px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
    white-space: nowrap;
  }

  /* VAT Summary */
  .vat-summary {
    background: #f7fafc;
    border: 2px solid #1a365d;
    border-radius: 8px;
    padding: 15px 20px;
    margin-bottom: 20px;
  }
  .vat-summary-title {
    font-size: 14px;
    font-weight: 700;
    color: #1a365d;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #cbd5e0;
  }
  .vat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 14px;
  }
  .vat-row.total {
    border-top: 2px solid #1a365d;
    margin-top: 6px;
    padding-top: 10px;
    font-size: 18px;
    font-weight: 800;
    color: #1a365d;
  }
  .vat-label { color: #4a5568; }
  .vat-label-en { font-size: 11px; color: #a0aec0; direction: ltr; }
  .vat-amount { font-weight: 700; color: #2d3748; }
  .vat-amount.total { color: #1a365d; font-size: 18px; }

  /* Legal section */
  .legal-section { margin-bottom: 20px; }
  .legal-title {
    font-size: 14px;
    font-weight: 700;
    color: #c53030;
    border-right: 4px solid #c53030;
    padding-right: 15px;
    margin-bottom: 12px;
  }
  .legal-field {
    background: #fff5f5;
    border-right: 3px solid #c53030;
    border-radius: 6px;
    padding: 12px 18px;
    margin-bottom: 10px;
  }
  .legal-field .field-label { color: #c53030; }
  .legal-field .field-value { border-bottom-color: #fc8181; }
  .legal-badge {
    background: #fed7d7;
    color: #c53030;
    font-size: 12px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
    white-space: nowrap;
  }
  .legal-note {
    font-size: 11px;
    color: #a0aec0;
    font-style: italic;
    text-align: right;
    margin-top: 8px;
  }
  .legal-note-en {
    font-size: 11px;
    color: #a0aec0;
    font-style: italic;
    direction: ltr;
    text-align: right;
  }

  /* Signatures */
  .signatures {
    display: flex;
    justify-content: space-between;
    gap: 30px;
    border-top: 2px solid #cbd5e0;
    padding-top: 30px;
    margin-top: 20px;
    margin-bottom: 20px;
  }
  .sig-box {
    flex: 1;
    text-align: center;
  }
  .sig-line {
    border-bottom: 2px solid #4a5568;
    height: 50px;
    margin-bottom: 8px;
  }
  .sig-label {
    font-size: 13px;
    color: #718096;
  }
  .sig-label-en {
    font-size: 11px;
    color: #a0aec0;
    direction: ltr;
  }

  /* Footer */
  .footer {
    background: #1a365d;
    color: white;
    border-radius: 8px;
    padding: 20px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 -40px;
    margin-top: auto;
  }
  .footer-info { flex: 1; }
  .footer-address {
    font-size: 13px;
    margin-bottom: 4px;
  }
  .footer-address-en {
    font-size: 12px;
    color: #a0aec0;
    direction: ltr;
    text-align: right;
    margin-bottom: 8px;
  }
  .footer-legal {
    background: rgba(252, 231, 231, 0.15);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.8;
  }
  .footer-legal .legal-item {
    display: inline-block;
    margin-left: 15px;
  }
  .qr-placeholder {
    width: 80px;
    height: 80px;
    background: white;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #1a365d;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    flex-shrink: 0;
  }

  /* Print */
  @media print {
    body { background: white; padding: 0; }
    .receipt-container {
      box-shadow: none;
      width: 100%;
      border-radius: 0;
    }
    .field-row:hover { border-right-color: #cbd5e0; background: #fafafa; }
  }
</style>
</head>
<body>
<div class="receipt-container">
  <div class="top-border"></div>
  <div class="watermark">سند قبض</div>
  <div class="content">

    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <div class="company-name">${escapeHtml(company.nameAr)}</div>
        <div class="company-name-en">${escapeHtml(company.nameEn)}</div>
        <div class="company-desc">${escapeHtml(company.descAr)}</div>
        <div class="company-desc-en">${escapeHtml(company.descEn)}</div>
      </div>
      <div class="header-right">
        <div class="logo-placeholder">
          ${company.logoUrl ? `<img src="${escapeHtml(company.logoUrl)}" alt="logo" />` : "شعار"}
        </div>
        <div class="receipt-number-box">
          <div class="receipt-number-label">رقم السند / Receipt No.</div>
          <div class="receipt-number">${escapeHtml(receiptNumber)}</div>
        </div>
      </div>
    </div>

    <!-- Title -->
    <div class="title-section">
      <div class="title-ar">سند قبض</div>
      <div class="title-en">Payment Receipt</div>
    </div>

    <!-- Form Fields -->
    <div class="form-fields">
      <div class="field-row">
        <div class="field-label">استلمنا من السيد / السيدة</div>
        <div class="field-label-en">We received payment from Mr./Ms.</div>
        <div class="field-value">${payerName}</div>
      </div>

      <div class="field-row">
        <div class="field-label">مبلغ وقدره</div>
        <div class="field-label-en">The sum of</div>
        <div class="field-value">
          <span>${amount}</span>
          <span class="field-badge">ريال سعودي</span>
        </div>
      </div>

      <div class="field-row">
        <div class="field-label">نقداً / تحويل / بموجب شيك رقم</div>
        <div class="field-label-en">Cash / Transfer / Check No.</div>
        <div class="field-value">${notes || "تحويل بنكي"}</div>
      </div>

      <div class="field-row">
        <div class="field-label">وذلك عن</div>
        <div class="field-label-en">For</div>
        <div class="field-value">${purpose}</div>
      </div>

      <div class="field-row">
        <div class="field-label">تاريخ الاستحقاق</div>
        <div class="field-label-en">Due Date</div>
        <div class="field-value">${dueDate}</div>
      </div>

      <div class="field-row">
        <div class="field-label">تاريخ السداد</div>
        <div class="field-label-en">Payment Date</div>
        <div class="field-value">${paidAt}</div>
      </div>

      <div class="field-row">
        <div class="field-label">الحالة</div>
        <div class="field-label-en">Status</div>
        <div class="field-value">
          <span style="font-weight: 700; color: ${(payment as any)?.status === "paid" ? "#2f855a" : "#c53030"}">${paymentStatus}</span>
        </div>
      </div>
    </div>

    <!-- VAT Summary -->
    <div class="vat-summary">
      <div class="vat-summary-title">ملخص الفاتورة / Invoice Summary</div>
      <div class="vat-row">
        <div>
          <span class="vat-label">المبلغ قبل الضريبة</span>
          <div class="vat-label-en">Subtotal (excl. VAT)</div>
        </div>
        <span class="vat-amount">${subtotalFormatted} ر.س</span>
      </div>
      <div class="vat-row">
        <div>
          <span class="vat-label">ضريبة القيمة المضافة (${vatRate}%)</span>
          <div class="vat-label-en">VAT (${vatRate}%)</div>
        </div>
        <span class="vat-amount">${vatFormatted} ر.س</span>
      </div>
      <div class="vat-row total">
        <div>
          <span>الإجمالي شامل الضريبة</span>
          <div class="vat-label-en">Total (incl. VAT)</div>
        </div>
        <span class="vat-amount total">${totalFormatted} ر.س</span>
      </div>
    </div>

    <!-- Legal Information -->
    <div class="legal-section">
      <div class="legal-title">البيانات القانونية / Legal Information</div>

      <div class="legal-field">
        <div class="field-label">رقم الجوال</div>
        <div class="field-label-en">Phone Number</div>
        <div class="field-value">
          <span dir="ltr">${escapeHtml(company.phone)}</span>
          <span class="legal-badge">05XXXXXXXX</span>
        </div>
      </div>

      <div class="legal-field">
        <div class="field-label">السجل التجاري</div>
        <div class="field-label-en">Commercial Registration (CR)</div>
        <div class="field-value">
          <span dir="ltr">${escapeHtml(company.cr)}</span>
          <span class="legal-badge">10 أرقام</span>
        </div>
      </div>

      <div class="legal-field">
        <div class="field-label">الرقم الضريبي</div>
        <div class="field-label-en">VAT Number</div>
        <div class="field-value">
          <span dir="ltr">${escapeHtml(company.vat)}</span>
          <span class="legal-badge">15 رقم</span>
        </div>
      </div>

      <div class="legal-note">يجب إدراج البيانات القانونية المكونة من 15 رقماً للرقم الضريبي، و10 أرقام للسجل التجاري</div>
      <div class="legal-note-en">Legal data required: 15-digit VAT, 10-digit CR</div>
    </div>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">المستلم</div>
        <div class="sig-label-en">Receiver</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">المدير</div>
        <div class="sig-label-en">Manager</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">التاريخ</div>
        <div class="sig-label-en">Date</div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-info">
      <div class="footer-address">العنوان: ${escapeHtml(company.addressAr)}</div>
      <div class="footer-address-en">Address: ${escapeHtml(company.addressEn)}</div>
      <div class="footer-legal">
        <span class="legal-item">📞 الجوال: ${escapeHtml(company.phone)}</span>
        <span class="legal-item">📋 السجل التجاري: ${escapeHtml(company.cr)}</span>
        <span class="legal-item">🧾 الرقم الضريبي: ${escapeHtml(company.vat)}</span>
      </div>
    </div>
    <div class="qr-placeholder">QR<br>Code</div>
  </div>

</div>

<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 500); };
</script>
</body>
</html>`;
}
