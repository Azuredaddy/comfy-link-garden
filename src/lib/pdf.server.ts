// Server-side PDF generation for quotes, invoices, and the yearly expenses
// report. Uses pdf-lib (pure JS, no native deps — safe in the serverless
// runtime). Layout is deliberately simple and print-clean: a dark header band
// with a lime accent, black body text on white, a line-item table and totals.
import { PDFDocument, StandardFonts, PDFString, PDFName, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Make a rectangle on a page a clickable link to `url` (for PDF viewers).
function addLink(pdf: PDFDocument, page: PDFPage, x1: number, y1: number, x2: number, y2: number, url: string) {
  const annot = pdf.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [x1, y1, x2, y2], Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  });
  const ref = pdf.context.register(annot);
  const existing = page.node.Annots();
  if (existing) existing.push(ref);
  else page.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
}

// ---- palette (matches the site brand, tuned for print on white) -----------
const INK = rgb(0.07, 0.09, 0.06);
const MUTED = rgb(0.42, 0.45, 0.4);
const LIME = rgb(0.35, 0.68, 0.09);
const HEADER_BG = rgb(0.04, 0.05, 0.04);
const HEADER_INK = rgb(0.95, 0.97, 0.94);
const LINE = rgb(0.85, 0.87, 0.83);
const ZEBRA = rgb(0.96, 0.97, 0.95);

const A4 = { w: 595.28, h: 841.89 };
const M = 50; // page margin

export type PdfSettings = {
  business_name: string;
  abn?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gst_registered: boolean;
  gst_rate: number;
  bank_name?: string | null;
  bank_bsb?: string | null;
  bank_account?: string | null;
};

export type PdfDoc = {
  number?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  suburb?: string | null;
  issue_date: string;
  expiry_date?: string | null;
  due_date?: string | null;
  subtotal: number;
  gst_amount: number;
  total: number;
  discount_percent?: number | null;
  discount_amount?: number | null;
  customer_notes?: string | null;
};

export type PdfItem = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type PdfExpense = {
  expense_date: string;
  category: string;
  description?: string | null;
  supplier?: string | null;
  amount: number;
  gst_amount?: number | null;
};

const money = (n: number) =>
  "$" + Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateAu = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
};

// pdf-lib's standard fonts use WinAnsi (CP1252) and throw on anything they
// can't encode. Map common smart punctuation to ASCII and drop any remaining
// out-of-range/control characters so customer-entered text never crashes a PDF.
function s(value: unknown): string {
  return String(value ?? "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E¡-ÿ]/g, "");
}

// simple greedy word wrap to a max width
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = s(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

type Fonts = { reg: PDFFont; bold: PDFFont };

function drawRight(page: PDFPage, text: string, right: number, y: number, font: PDFFont, size: number, color = INK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: right - w, y, size, font, color });
}

async function makeDoc() {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    reg: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  return { pdf, fonts };
}

function header(page: PDFPage, fonts: Fonts, settings: PdfSettings, title: string) {
  // dark band
  page.drawRectangle({ x: 0, y: A4.h - 90, width: A4.w, height: 90, color: HEADER_BG });
  page.drawRectangle({ x: 0, y: A4.h - 94, width: A4.w, height: 4, color: LIME });
  page.drawText(s(settings.business_name || "Lanky Services"), {
    x: M, y: A4.h - 46, size: 20, font: fonts.bold, color: HEADER_INK,
  });
  const sub = [settings.phone, settings.email].filter(Boolean).map(s).join("   -   ");
  if (sub) page.drawText(sub, { x: M, y: A4.h - 66, size: 9, font: fonts.reg, color: rgb(0.7, 0.75, 0.68) });
  if (settings.abn) page.drawText("ABN " + s(settings.abn), { x: M, y: A4.h - 80, size: 9, font: fonts.reg, color: rgb(0.7, 0.75, 0.68) });
  drawRight(page, title, A4.w - M, A4.h - 50, fonts.bold, 22, LIME);
}

/** Quote or tax-invoice PDF. Returns raw PDF bytes. */
export async function renderDocumentPdf(
  kind: "quote" | "invoice",
  doc: PdfDoc,
  items: PdfItem[],
  settings: PdfSettings,
  acceptUrl?: string,
): Promise<Uint8Array> {
  const { pdf, fonts } = await makeDoc();
  let page = pdf.addPage([A4.w, A4.h]);
  const gst = settings.gst_registered;
  const title = kind === "invoice" ? (gst ? "TAX INVOICE" : "INVOICE") : "QUOTE";
  header(page, fonts, settings, title);

  let y = A4.h - 120;

  // meta (number / dates) on the right, bill-to on the left
  const metaRows: Array<[string, string]> = [];
  if (doc.number) metaRows.push([kind === "invoice" ? "Invoice #" : "Quote #", doc.number]);
  metaRows.push(["Date", dateAu(doc.issue_date)]);
  if (kind === "invoice" && doc.due_date) metaRows.push(["Due", dateAu(doc.due_date)]);
  if (kind === "quote" && doc.expiry_date) metaRows.push(["Valid until", dateAu(doc.expiry_date)]);

  page.drawText("TO", { x: M, y, size: 9, font: fonts.bold, color: MUTED });
  page.drawText(s(doc.customer_name), { x: M, y: y - 16, size: 13, font: fonts.bold, color: INK });
  const toLines = ([doc.customer_address, doc.suburb, doc.customer_phone, doc.customer_email].filter(Boolean) as string[]).map(s);
  let ty = y - 32;
  for (const line of toLines) {
    page.drawText(line, { x: M, y: ty, size: 10, font: fonts.reg, color: INK });
    ty -= 14;
  }

  let my = y;
  for (const [label, value] of metaRows) {
    drawRight(page, label, A4.w - M - 90, my, fonts.reg, 9, MUTED);
    drawRight(page, value, A4.w - M, my, fonts.bold, 10, INK);
    my -= 16;
  }

  y = Math.min(ty, my) - 20;

  // ---- items table --------------------------------------------------------
  const colDesc = M;
  const colQty = A4.w - M - 210;
  const colUnit = A4.w - M - 120;
  const colAmt = A4.w - M;
  const descWidth = colQty - colDesc - 12;

  page.drawRectangle({ x: M, y: y - 4, width: A4.w - 2 * M, height: 22, color: rgb(0.93, 0.95, 0.9) });
  page.drawText("Description", { x: colDesc + 6, y: y + 3, size: 9, font: fonts.bold, color: INK });
  drawRight(page, "Qty", colQty + 30, y + 3, fonts.bold, 9, INK);
  drawRight(page, "Unit", colUnit + 40, y + 3, fonts.bold, 9, INK);
  drawRight(page, "Amount", colAmt - 4, y + 3, fonts.bold, 9, INK);
  y -= 8;

  const ensureSpace = (needed: number) => {
    if (y - needed < 90) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - 60;
    }
  };

  let zebra = false;
  for (const it of items) {
    const lines = wrap(it.description || "", fonts.reg, 10, descWidth);
    const rowH = Math.max(20, lines.length * 13 + 7);
    ensureSpace(rowH);
    if (zebra) page.drawRectangle({ x: M, y: y - rowH + 4, width: A4.w - 2 * M, height: rowH, color: ZEBRA });
    zebra = !zebra;
    let ly = y - 8;
    for (const l of lines) {
      page.drawText(l, { x: colDesc + 6, y: ly, size: 10, font: fonts.reg, color: INK });
      ly -= 13;
    }
    const midY = y - 8;
    drawRight(page, String(+Number(it.quantity).toFixed(2)), colQty + 30, midY, fonts.reg, 10);
    drawRight(page, money(it.unit_price), colUnit + 40, midY, fonts.reg, 10);
    drawRight(page, money(it.line_total), colAmt - 4, midY, fonts.reg, 10);
    y -= rowH;
    page.drawLine({ start: { x: M, y: y + 3 }, end: { x: A4.w - M, y: y + 3 }, thickness: 0.5, color: LINE });
  }

  // ---- totals -------------------------------------------------------------
  ensureSpace(90);
  y -= 12;
  const totalsRight = A4.w - M;
  const totalsLabelX = A4.w - M - 200;
  const totalRow = (label: string, value: string, bold = false) => {
    page.drawText(label, { x: totalsLabelX, y, size: bold ? 12 : 10, font: bold ? fonts.bold : fonts.reg, color: bold ? INK : MUTED });
    drawRight(page, value, totalsRight, y, bold ? fonts.bold : fonts.reg, bold ? 12 : 10, bold ? INK : INK);
    y -= bold ? 20 : 16;
  };
  const hasDiscount = Number(doc.discount_amount) > 0;
  if (gst || hasDiscount) {
    totalRow("Subtotal", money(doc.subtotal));
    if (hasDiscount) totalRow(`Discount (${+Number(doc.discount_percent || 0).toFixed(2)}%)`, "-" + money(doc.discount_amount || 0));
    if (gst) totalRow(`GST (${+Number(settings.gst_rate).toFixed(0)}%)`, money(doc.gst_amount));
    page.drawLine({ start: { x: totalsLabelX, y: y + 6 }, end: { x: totalsRight, y: y + 6 }, thickness: 0.5, color: LINE });
    totalRow(gst ? "Total (inc. GST)" : "Total", money(doc.total), true);
  } else {
    totalRow("Total", money(doc.total), true);
  }

  // ---- clickable "Accept this quote" button (quotes only) ----------------
  if (kind === "quote" && acceptUrl) {
    ensureSpace(50);
    y -= 18;
    const bw = 230, bh = 30, bx = M, by = y - bh + 10;
    page.drawRectangle({ x: bx, y: by, width: bw, height: bh, color: LIME });
    page.drawText("Accept this quote online", { x: bx + 16, y: by + 10, size: 12, font: fonts.bold, color: rgb(0.06, 0.09, 0.04) });
    addLink(pdf, page, bx, by, bx + bw, by + bh, acceptUrl);
    page.drawText("Tap to accept — we'll be in touch to book you in.", { x: bx + bw + 12, y: by + 11, size: 9, font: fonts.reg, color: MUTED });
    y -= bh + 8;
  }

  // ---- notes / payment footer --------------------------------------------
  y -= 16;
  if (doc.customer_notes) {
    ensureSpace(60);
    page.drawText("Notes", { x: M, y, size: 9, font: fonts.bold, color: MUTED });
    y -= 14;
    for (const l of wrap(doc.customer_notes, fonts.reg, 10, A4.w - 2 * M)) {
      ensureSpace(16);
      page.drawText(l, { x: M, y, size: 10, font: fonts.reg, color: INK });
      y -= 13;
    }
    y -= 8;
  }

  if (kind === "invoice" && (settings.bank_name || settings.bank_account)) {
    ensureSpace(60);
    page.drawText("Payment", { x: M, y, size: 9, font: fonts.bold, color: MUTED });
    y -= 14;
    const pay = [
      settings.bank_name ? `Bank: ${settings.bank_name}` : null,
      settings.bank_bsb ? `BSB: ${settings.bank_bsb}` : null,
      settings.bank_account ? `Account: ${settings.bank_account}` : null,
      doc.number ? `Reference: ${doc.number}` : null,
    ].filter(Boolean) as string[];
    for (const l of pay) {
      page.drawText(l, { x: M, y, size: 10, font: fonts.reg, color: INK });
      y -= 13;
    }
  }

  // footer line
  page.drawText(
    kind === "quote" ? "Thanks for considering Lanky Services — only an arm's length away." : "Thank you for your business.",
    { x: M, y: 40, size: 9, font: fonts.reg, color: MUTED },
  );

  return pdf.save();
}

/** Yearly expenses report grouped by category. */
export async function renderExpensesReportPdf(
  fyStart: number,
  expenses: PdfExpense[],
  settings: PdfSettings,
): Promise<Uint8Array> {
  const { pdf, fonts } = await makeDoc();
  let page = pdf.addPage([A4.w, A4.h]);
  header(page, fonts, settings, "EXPENSES");

  let y = A4.h - 120;
  page.drawText(`Financial year ${fyStart}–${(fyStart + 1) % 100}`, { x: M, y, size: 13, font: fonts.bold, color: INK });
  page.drawText("1 Jul " + fyStart + " – 30 Jun " + (fyStart + 1), { x: M, y: y - 15, size: 9, font: fonts.reg, color: MUTED });
  y -= 44;

  // group by category
  const byCat = new Map<string, PdfExpense[]>();
  for (const e of expenses) {
    const k = e.category || "Other";
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(e);
  }
  const cats = [...byCat.keys()].sort();

  let grand = 0;
  let grandGst = 0;

  const ensureSpace = (needed: number) => {
    if (y - needed < 70) {
      page = pdf.addPage([A4.w, A4.h]);
      y = A4.h - 60;
    }
  };

  for (const cat of cats) {
    const rows = byCat.get(cat)!;
    const catTotal = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const catGst = rows.reduce((s, r) => s + Number(r.gst_amount || 0), 0);
    grand += catTotal;
    grandGst += catGst;

    ensureSpace(40);
    page.drawRectangle({ x: M, y: y - 4, width: A4.w - 2 * M, height: 20, color: rgb(0.93, 0.95, 0.9) });
    page.drawText(s(cat), { x: M + 6, y: y + 2, size: 11, font: fonts.bold, color: INK });
    drawRight(page, money(catTotal), A4.w - M - 4, y + 2, fonts.bold, 11, INK);
    y -= 24;

    for (const r of rows) {
      ensureSpace(16);
      const left = `${dateAu(r.expense_date)}   ${r.supplier ? r.supplier + " — " : ""}${r.description ?? ""}`.trim();
      for (const l of wrap(left, fonts.reg, 9, A4.w - 2 * M - 90).slice(0, 1)) {
        page.drawText(l, { x: M + 10, y, size: 9, font: fonts.reg, color: INK });
      }
      drawRight(page, money(r.amount), A4.w - M - 4, y, fonts.reg, 9, INK);
      y -= 14;
    }
    y -= 6;
  }

  ensureSpace(60);
  y -= 6;
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: A4.w - M, y: y + 8 }, thickness: 1, color: INK });
  page.drawText("Total expenses", { x: M, y: y - 8, size: 13, font: fonts.bold, color: INK });
  drawRight(page, money(grand), A4.w - M - 4, y - 8, fonts.bold, 13, INK);
  y -= 28;
  if (settings.gst_registered) {
    page.drawText("GST included (input tax credits)", { x: M, y, size: 10, font: fonts.reg, color: MUTED });
    drawRight(page, money(grandGst), A4.w - M - 4, y, fonts.reg, 10, MUTED);
    y -= 18;
  }

  page.drawText("Generated " + new Date().toLocaleDateString("en-AU"), { x: M, y: 40, size: 8, font: fonts.reg, color: MUTED });
  return pdf.save();
}
