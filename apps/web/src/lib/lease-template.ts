function escapeHtml(s: string): string {
  return String(s ?? "")
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
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hijriDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const str = value instanceof Date ? value.toISOString() : String(value);
  const date = str.includes("T") ? new Date(str) : new Date(`${str}T00:00:00`);
  if (Number.isNaN(date.getTime())) return str;
  const fmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return fmt.format(date);
}

function toArabicFrequency(f: string | null): string {
  switch (f) {
    case "monthly": return "شهرياً";
    case "quarterly": return "ربع سنوي";
    case "half-yearly": return "نصف سنوي";
    case "yearly": return "سنوي";
    case "weekly": return "أسبوعياً";
    case "one-time": return "دفعة واحدة";
    default: return f ?? "—";
  }
}

export type LeaseData = {
  contract: any;
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
  contractNumber: string;
};

export function generateLeaseHtml(data: LeaseData): string {
  const { contract, company, contractNumber } = data;
  const contact = (contract as any)?.contact;
  const property = (contract as any)?.property;
  const unit = (contract as any)?.unit;

  const tenantName = escapeHtml(contact?.name ?? "—");
  const tenantPhone = escapeHtml(contact?.phone ?? "—");
  const tenantIdNumber = escapeHtml(contact?.id_number ?? "—");
  const tenantSex = contact?.sex === "male" ? "ذكر" : contact?.sex === "female" ? "أنثى" : "—";

  const propertyName = escapeHtml(property?.name ?? "—");
  const propertyRegion = escapeHtml(property?.region ?? "—");
  const propertyCity = escapeHtml(property?.city ?? "—");
  const propertyNeighborhood = escapeHtml(property?.neighborhood ?? "—");
  const propertyAddress = escapeHtml(property?.address ?? "—");
  const unitLabel = escapeHtml(unit?.label ?? "—");

  const startDate = formatDateAr((contract as any)?.start_date);
  const endDate = formatDateAr((contract as any)?.end_date);
  const startDateHijri = hijriDate((contract as any)?.start_date);
  const endDateHijri = hijriDate((contract as any)?.end_date);

  const rentTotal = formatCurrencyAr((contract as any)?.rent_total_sar);
  const rentAmount = formatCurrencyAr((contract as any)?.rent_amount_sar);
  const paymentFrequency = toArabicFrequency((contract as any)?.payment_frequency);
  const installmentsCount = (contract as any)?.installments_count ?? "—";
  const notes = escapeHtml((contract as any)?.notes ?? "");

  const today = formatDateAr(new Date().toISOString());
  const todayHijri = hijriDate(new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>عقد إيجار - ${contractNumber}</title>
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
    line-height: 1.8;
  }
  .lease-container {
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
    font-size: 24px;
    font-weight: 800;
    color: #1a365d;
    line-height: 1.3;
  }
  .company-name-en {
    font-size: 14px;
    color: #4a5568;
    margin-top: 2px;
    direction: ltr;
    text-align: right;
  }
  .company-desc {
    font-size: 13px;
    color: #718096;
    margin-top: 4px;
  }
  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
  }
  .logo-placeholder {
    width: 90px;
    height: 90px;
    border-radius: 12px;
    background: #1a365d;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 16px;
    font-weight: 700;
    overflow: hidden;
  }
  .logo-placeholder img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .contract-number-box {
    background: #fff5f5;
    border: 2px solid #c53030;
    border-radius: 8px;
    padding: 8px 20px;
    text-align: center;
  }
  .contract-number-label {
    font-size: 11px;
    color: #c53030;
    font-weight: 500;
  }
  .contract-number {
    font-size: 20px;
    font-weight: 800;
    color: #c53030;
    letter-spacing: 2px;
  }

  /* Title */
  .title-section {
    background: #1a365d;
    color: white;
    border-radius: 8px;
    padding: 15px 25px;
    text-align: center;
    margin-bottom: 25px;
  }
  .title-ar {
    font-size: 26px;
    font-weight: 800;
  }
  .title-en {
    font-size: 13px;
    color: #a0aec0;
    direction: ltr;
    margin-top: 2px;
  }

  /* Preamble */
  .preamble {
    background: #f7fafc;
    border-right: 4px solid #1a365d;
    border-radius: 8px;
    padding: 15px 20px;
    margin-bottom: 20px;
    font-size: 14px;
    color: #2d3748;
  }
  .preamble strong { color: #1a365d; }

  /* Sections */
  .section {
    margin-bottom: 18px;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 15px;
    font-weight: 700;
    color: #1a365d;
    background: #edf2f7;
    border-right: 4px solid #1a365d;
    border-radius: 6px;
    padding: 8px 15px;
    margin-bottom: 10px;
  }
  .section-title .num {
    display: inline-block;
    width: 28px;
    height: 28px;
    line-height: 28px;
    text-align: center;
    background: #1a365d;
    color: white;
    border-radius: 50%;
    font-size: 13px;
    margin-left: 8px;
  }
  .section-body {
    padding: 0 15px;
    font-size: 14px;
    color: #2d3748;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 20px;
  }
  .info-item {
    background: #fafafa;
    border-radius: 6px;
    padding: 8px 14px;
    border-right: 3px solid #cbd5e0;
  }
  .info-label {
    font-size: 12px;
    font-weight: 700;
    color: #4a5568;
    margin-bottom: 2px;
  }
  .info-label-en {
    font-size: 10px;
    color: #a0aec0;
    direction: ltr;
    text-align: right;
  }
  .info-value {
    font-size: 14px;
    color: #1a202c;
    font-weight: 500;
  }
  .clause {
    font-size: 13px;
    color: #2d3748;
    margin-bottom: 8px;
    padding-right: 10px;
  }
  .clause strong { color: #1a365d; }

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
    font-weight: 600;
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
    padding: 18px 25px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 -40px;
    margin-top: auto;
  }
  .footer-info { flex: 1; }
  .footer-address {
    font-size: 12px;
    margin-bottom: 4px;
  }
  .footer-legal {
    font-size: 11px;
    color: #a0aec0;
  }
  .footer-legal span { margin-left: 12px; }

  /* Print */
  @media print {
    body { background: white; padding: 0; }
    .lease-container {
      box-shadow: none;
      width: 100%;
      border-radius: 0;
    }
  }
</style>
</head>
<body>
<div class="lease-container">
  <div class="top-border"></div>
  <div class="content">

    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <div class="company-name">${escapeHtml(company.nameAr)}</div>
        <div class="company-name-en">${escapeHtml(company.nameEn)}</div>
        <div class="company-desc">${escapeHtml(company.descAr)}</div>
      </div>
      <div class="header-right">
        <div class="logo-placeholder">
          ${company.logoUrl ? `<img src="${escapeHtml(company.logoUrl)}" alt="logo" />` : "شعار"}
        </div>
        <div class="contract-number-box">
          <div class="contract-number-label">رقم العقد / Contract No.</div>
          <div class="contract-number">${escapeHtml(contractNumber)}</div>
        </div>
      </div>
    </div>

    <!-- Title -->
    <div class="title-section">
      <div class="title-ar">عقد إيجار</div>
      <div class="title-en">Lease Agreement</div>
    </div>

    <!-- Preamble -->
    <div class="preamble">
      <p>إنه في يوم <strong>${today}</strong> الموافق <strong>${todayHijri}</strong>، تم الاتفاق بين الطرفين الموقعين أدناه على ما يلي:</p>
    </div>

    <!-- Section 1: Parties -->
    <div class="section">
      <div class="section-title"><span class="num">١</span> أطراف العقد / Parties</div>
      <div class="section-body">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">المؤجر (الطرف الأول)</div>
            <div class="info-label-en">Lessor (First Party)</div>
            <div class="info-value">${escapeHtml(company.nameAr)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">رقم الجوال</div>
            <div class="info-label-en">Phone</div>
            <div class="info-value" dir="ltr">${escapeHtml(company.phone)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">السجل التجاري</div>
            <div class="info-label-en">CR Number</div>
            <div class="info-value" dir="ltr">${escapeHtml(company.cr)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">الرقم الضريبي</div>
            <div class="info-label-en">VAT Number</div>
            <div class="info-value" dir="ltr">${escapeHtml(company.vat)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">المستأجر (الطرف الثاني)</div>
            <div class="info-label-en">Lessee (Second Party)</div>
            <div class="info-value">${tenantName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">رقم الجوال</div>
            <div class="info-label-en">Phone</div>
            <div class="info-value" dir="ltr">${tenantPhone}</div>
          </div>
          <div class="info-item">
            <div class="info-label">رقم الهوية</div>
            <div class="info-label-en">ID Number</div>
            <div class="info-value" dir="ltr">${tenantIdNumber}</div>
          </div>
          <div class="info-item">
            <div class="info-label">الجنس</div>
            <div class="info-label-en">Gender</div>
            <div class="info-value">${tenantSex}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 2: Property -->
    <div class="section">
      <div class="section-title"><span class="num">٢</span> العقار المؤجر / Leased Property</div>
      <div class="section-body">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">اسم العقار</div>
            <div class="info-label-en">Property Name</div>
            <div class="info-value">${propertyName}</div>
          </div>
          <div class="info-item">
            <div class="info-label">الوحدة</div>
            <div class="info-label-en">Unit</div>
            <div class="info-value">${unitLabel}</div>
          </div>
          <div class="info-item">
            <div class="info-label">المنطقة</div>
            <div class="info-label-en">Region</div>
            <div class="info-value">${propertyRegion}</div>
          </div>
          <div class="info-item">
            <div class="info-label">المدينة</div>
            <div class="info-label-en">City</div>
            <div class="info-value">${propertyCity}</div>
          </div>
          <div class="info-item">
            <div class="info-label">الحي</div>
            <div class="info-label-en">Neighborhood</div>
            <div class="info-value">${propertyNeighborhood}</div>
          </div>
          <div class="info-item">
            <div class="info-label">العنوان</div>
            <div class="info-label-en">Address</div>
            <div class="info-value">${propertyAddress}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 3: Lease Terms -->
    <div class="section">
      <div class="section-title"><span class="num">٣</span> مدة الإيجار / Lease Duration</div>
      <div class="section-body">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">تاريخ البداية</div>
            <div class="info-label-en">Start Date</div>
            <div class="info-value">${startDate} (${startDateHijri})</div>
          </div>
          <div class="info-item">
            <div class="info-label">تاريخ النهاية</div>
            <div class="info-label-en">End Date</div>
            <div class="info-value">${endDate} (${endDateHijri})</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 4: Rent -->
    <div class="section">
      <div class="section-title"><span class="num">٤</span> الأجرة وطريقة الدفع / Rent & Payment</div>
      <div class="section-body">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">الإيجار السنوي</div>
            <div class="info-label-en">Annual Rent</div>
            <div class="info-value">${rentTotal} ر.س</div>
          </div>
          <div class="info-item">
            <div class="info-label">قيمة القسط</div>
            <div class="info-label-en">Installment Amount</div>
            <div class="info-value">${rentAmount} ر.س</div>
          </div>
          <div class="info-item">
            <div class="info-label">طريقة الدفع</div>
            <div class="info-label-en">Payment Frequency</div>
            <div class="info-value">${paymentFrequency}</div>
          </div>
          <div class="info-item">
            <div class="info-label">عدد الأقساط</div>
            <div class="info-label-en">Installments Count</div>
            <div class="info-value">${installmentsCount}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 5: Clauses -->
    <div class="section">
      <div class="section-title"><span class="num">٥</span> الشروط والأحكام / Terms & Conditions</div>
      <div class="section-body">
        <div class="clause"><strong>٥-١</strong> يلتزم المستأجر بدفع الأجرة في موعدها المحدد، وفي حالة التأخر يحق للمؤجر اتخاذ الإجراءات النظامية.</div>
        <div class="clause"><strong>٥-٢</strong> يلتزم المستأجر بالمحافظة على العقار واستخدامه الاستخدام السليم، ولا يجوز له إجراء أي تعديلات دون موافقة كتابية من المؤجر.</div>
        <div class="clause"><strong>٥-٣</strong> لا يجوز للمستأجر تأجير العقار من الباطن أو التنازل عن العقد لطرف ثالث دون موافقة كتابية من المؤجر.</div>
        <div class="clause"><strong>٥-٤</strong> يتحمل المستأجر فواتير الكهرباء والمياه والاتصالات خلال فترة الإيجار.</div>
        <div class="clause"><strong>٥-٥</strong> في حالة الرغبة في إنهاء العقد قبل انتهاء مدته، يجب إخطار الطرف الآخر قبل <strong>٣٠ يوماً</strong> على الأقل.</div>
        <div class="clause"><strong>٥-٦</strong> تخضع جميع المسائل الخلافية للأنظمة المعمول بها في المملكة العربية السعودية ولائحتها التنفيذية.</div>
        ${notes ? `<div class="clause"><strong>٥-٧</strong> ملاحظات إضافية: ${notes}</div>` : ""}
      </div>
    </div>

    <!-- Signatures -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">المؤجر (الطرف الأول)</div>
        <div class="sig-label-en">Lessor</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">المستأجر (الطرف الثاني)</div>
        <div class="sig-label-en">Lessee</div>
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
      <div class="footer-address">${escapeHtml(company.addressAr)}</div>
      <div class="footer-legal">
        <span>الجوال: ${escapeHtml(company.phone)}</span>
        <span>السجل التجاري: ${escapeHtml(company.cr)}</span>
        <span>الرقم الضريبي: ${escapeHtml(company.vat)}</span>
      </div>
    </div>
  </div>

</div>

<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 500); };
</script>
</body>
</html>`;
}
