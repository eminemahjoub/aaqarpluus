import { readFileSync } from "fs";
import { join } from "path";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

type ReceiptPdfInput = {
  contract: any;
  payment: any;
};

function loadFont(doc: PDFDocument): Promise<PDFFont> {
  const fontPaths = [
    process.env.ARABIC_FONT_PATH,
    "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf",
  ].filter(Boolean) as string[];
  for (const fontPath of fontPaths) {
    try {
      const fontBytes = readFileSync(fontPath);
      return doc.embedFont(fontBytes, { customName: "NotoArabic" });
    } catch {
      // try next path
    }
  }
  return doc.embedFont(StandardFonts.Helvetica);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toLocaleString("ar-SA")} ر.س`;
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  maxWidth: number,
  color = rgb(0.08, 0.1, 0.09),
) {
  const lines: string[] = [];
  for (const rawLine of String(text ?? "").split("\n")) {
    let line = "";
    for (const word of String(rawLine).split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  let currentY = y;
  for (const line of lines) {
    page.drawText(line, { x, y: currentY, size, font, color });
    currentY -= size * 1.55;
  }
  return currentY;
}

function drawLabelValue(page: PDFPage, font: PDFFont, label: string, value: string, x: number, y: number) {
  page.drawText(`${label}:`, { x, y, size: 11, font, color: rgb(0.2, 0.25, 0.22) });
  page.drawText(value, { x: x + 115, y, size: 11, font, color: rgb(0.08, 0.1, 0.09) });
}

export async function createPaymentReceiptPdfBytes(input: ReceiptPdfInput) {
  const { contract, payment } = input;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await loadFont(pdfDoc);
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 42;
  let y = height - margin;

  page.drawRectangle({
    x: 0,
    y: height - 92,
    width,
    height: 92,
    color: rgb(0.07, 0.31, 0.2),
  });

  page.drawText("وصل سداد إيجار", {
    x: margin,
    y: height - 42,
    size: 24,
    font,
    color: rgb(1, 1, 1),
  });

  const contractNumber = contract?.extra && typeof contract.extra === "object"
    ? String((contract.extra as { contract_number?: unknown }).contract_number ?? "")
    : "";

  page.drawText(contractNumber ? `رقم العقد: ${contractNumber}` : "رقم العقد: —", {
    x: margin,
    y: height - 68,
    size: 12,
    font,
    color: rgb(0.95, 0.97, 0.96),
  });

  y -= 124;

  drawLabelValue(page, font, "المستأجر", String(contract?.contact?.name ?? "—"), margin, y);
  y -= 28;
  drawLabelValue(page, font, "رقم الجوال", String(contract?.contact?.phone ?? "—"), margin, y);
  y -= 28;
  drawLabelValue(page, font, "العقار", String(contract?.property?.name ?? "—"), margin, y);
  y -= 28;
  drawLabelValue(page, font, "الوحدة", String(contract?.unit?.label ?? "—"), margin, y);
  y -= 42;

  page.drawRectangle({
    x: margin,
    y: y - 152,
    width: width - margin * 2,
    height: 152,
    borderColor: rgb(0.75, 0.82, 0.78),
    color: rgb(0.96, 0.98, 0.97),
    borderWidth: 1,
  });

  let tableY = y - 28;
  drawLabelValue(page, font, "رقم القسط", String(payment?.notes ?? "—"), margin + 20, tableY);
  tableY -= 30;
  drawLabelValue(page, font, "المبلغ", formatCurrency(payment?.amount_sar), margin + 20, tableY);
  tableY -= 30;
  drawLabelValue(page, font, "تاريخ الاستحقاق", formatDate(payment?.due_date), margin + 20, tableY);
  tableY -= 30;
  drawLabelValue(page, font, "تاريخ السداد", formatDate(payment?.paid_at), margin + 20, tableY);
  tableY -= 30;
  drawLabelValue(page, font, "الحالة", payment?.status === "paid" ? "مدفوع" : "غير مدفوع", margin + 20, tableY);

  y -= 190;
  page.drawText("تم إنشاء هذا الوصل تلقائياً عند تسجيل الدفعة.", {
    x: margin,
    y,
    size: 11,
    font,
    color: rgb(0.25, 0.3, 0.27),
  });

  return pdfDoc.save();
}
