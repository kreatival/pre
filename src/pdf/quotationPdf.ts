import fs from "fs";
import path from "path";
import { Writable } from "stream";
import PDFDocument from "pdfkit";
import { env } from "../config/env";
import { ItemDto, QuotationDto } from "../modules/quotations/dto";
import { LABELS } from "./labels";
import { drawSchematic } from "./schematic";

type Doc = InstanceType<typeof PDFDocument>;

const W = 595.28;
const H = 841.89;
const M = 36;
const CW = W - 2 * M;
const BLUE = "#4472C4";
const STRIP = "#cbd3e3";
const LINE = "#7f8aa3";
const ITEM_H = 140;
const PAGE_BOTTOM = 790;

const COLS = [
  { w: 24 }, { w: 235 }, { w: 48 }, { w: 48 }, { w: 48 }, { w: 60 }, { w: 60 },
];
const colX = (i: number) => M + COLS.slice(0, i).reduce((a, c) => a + c.w, 0);

interface TOpts { w?: number; align?: "left" | "center" | "right"; size?: number; bold?: boolean; italic?: boolean; color?: string }

function t(doc: Doc, s: string, x: number, y: number, o: TOpts = {}) {
  doc
    .font(o.bold ? "Helvetica-Bold" : o.italic ? "Helvetica-Oblique" : "Helvetica")
    .fontSize(o.size ?? 9)
    .fillColor(o.color ?? "#111");
  doc.text(s, x, y, { width: o.w, align: o.align ?? "left", lineBreak: false, ellipsis: true });
}

const cm = (mm: number) => String(Number((mm / 10).toFixed(1)));
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
};
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function box(doc: Doc, x: number, y: number, w: number, h: number, fill?: string) {
  doc.lineWidth(0.6);
  if (fill) doc.rect(x, y, w, h).fillAndStroke(fill, LINE);
  else doc.rect(x, y, w, h).stroke(LINE);
}

function tableHeader(doc: Doc, y: number, L: ReturnType<typeof labelsFor>) {
  doc.rect(M, y, CW, 18).fill(BLUE);
  const heads = [L.nr, L.name, L.qty, L.width, L.height, L.price, L.lineTotal];
  heads.forEach((h, i) => {
    const left = i < 2;
    t(doc, h, colX(i) + (left ? 4 : 0), y + 5, { w: COLS[i].w - (left ? 4 : 0), align: left ? "left" : "center", size: 8.5, bold: true, color: "#fff" });
  });
}

const labelsFor = () => LABELS[env.PDF_LANG];

function drawItem(doc: Doc, it: ItemDto, y: number, L: ReturnType<typeof labelsFor>, sym: string) {
  // strip
  doc.rect(M, y, CW, 16).fillAndStroke(STRIP, LINE);
  for (let i = 2; i < COLS.length; i++) doc.moveTo(colX(i), y).lineTo(colX(i), y + 16).lineWidth(0.4).stroke(LINE);
  doc.moveTo(colX(1), y).lineTo(colX(1), y + 16).lineWidth(0.4).stroke(LINE);
  const vals = [String(it.position), it.title, it.quantity.toFixed(2), cm(it.widthMm), cm(it.heightMm), it.unitPrice.toFixed(2), it.lineTotal.toFixed(2)];
  vals.forEach((v, i) => {
    const left = i < 2;
    t(doc, v, colX(i) + (left ? 4 : 0), y + 4.5, { w: COLS[i].w - (left ? 6 : 0), align: left ? "left" : "center", size: 8.5 });
  });

  const by = y + 20;
  drawSchematic(doc, it, M + 6, by, 112, 112);

  // measurement boxes
  const bx = M + 128;
  const stats = [`${it.unitPrice.toFixed(2)}${sym}`, `${cm(it.widthMm)} X ${cm(it.heightMm)}`, `${it.unitArea.toFixed(2)} m²`, `${it.totalArea.toFixed(2)} m²`];
  stats.forEach((s, i) => {
    const sy = by + 4 + i * 28;
    box(doc, bx, sy, 78, 16, "#f3f5fa");
    t(doc, s, bx, sy + 4.5, { w: 78, align: "center", size: 8.5 });
  });

  // properties
  const px = M + 222;
  const props: [string, string][] = [
    [L.profile, it.series ?? ""],
    [L.color, it.color ?? ""],
    [L.glass, it.glass ?? ""],
    [L.mechanism, it.mechanism ?? ""],
    [L.shutter, it.shutter ? L.shutterYes : ""],
    [L.net, it.mosquitoNet ? L.netYes : ""],
    [L.motor, it.motor ? L.motorYes : ""],
  ];
  if (it.notes) props.push([L.note, it.notes]);
  props.forEach(([k, v], i) => {
    const ry = by + 2 + i * 14.5;
    t(doc, k, px, ry, { w: 100, size: 7.5, bold: true, color: BLUE });
    t(doc, v, px + 108, ry - 0.5, { w: CW - (px - M) - 110, size: 8.5 });
  });

  doc.moveTo(M, y + ITEM_H - 4).lineTo(W - M, y + ITEM_H - 4).lineWidth(0.4).stroke("#d1d5db");
}

export function renderQuotationPdf(q: QuotationDto, out: Writable) {
  const L = labelsFor();
  const sym = q.currency === "EUR" ? "€" : ` ${q.currency}`;
  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    bufferPages: true,
    info: { Title: `${L.offer} ${q.number}`, Author: env.COMPANY_NAME },
  });
  doc.pipe(out);

  // ---- header (first page) ----
  const ox = W - M - 190;
  box(doc, ox, M, 190, 16);
  box(doc, ox, M + 16, 190, 16);
  t(doc, L.offer, ox + 4, M + 4, { size: 8, bold: true });
  t(doc, String(q.number), ox + 70, M + 4, { size: 9 });
  t(doc, L.date, ox + 4, M + 20, { size: 8, bold: true });
  t(doc, fmtDate(q.date), ox + 70, M + 20, { size: 9 });

  const hy = M + 52;
  const leftW = 236;
  t(doc, env.COMPANY_NAME, M, hy, { w: leftW, size: 13, bold: true });
  box(doc, M, hy + 20, leftW, 16);
  t(doc, env.COMPANY_ADDRESS, M + 4, hy + 24, { w: leftW - 8, size: 8.5 });
  box(doc, M, hy + 36, leftW, 16);
  t(doc, env.COMPANY_PHONE, M + 4, hy + 40, { w: leftW - 8, size: 8.5 });

  const cx = M + leftW + 10;
  const cw = CW - leftW - 10;
  box(doc, cx, hy, cw, 20, "#eef1f8");
  t(doc, q.client.name, cx + 5, hy + 5, { w: cw - 10, size: 11 });
  box(doc, cx, hy + 20, cw, 16);
  t(doc, [q.client.phone, q.client.email].filter(Boolean).join("  ·  "), cx + 5, hy + 24, { w: cw - 10, size: 8.5 });
  box(doc, cx, hy + 36, cw, 16);
  t(doc, [q.client.address, q.client.city].filter(Boolean).join(", "), cx + 5, hy + 40, { w: cw - 10, size: 8.5 });

  const by = hy + 62;
  doc.rect(M, by, CW, 18).fill(BLUE);
  t(doc, L.total, M, by + 5, { w: CW - 90, align: "right", size: 9, bold: true, color: "#fff" });
  t(doc, `${q.totals.total.toFixed(2)}${sym}`, W - M - 84, by + 5, { w: 80, align: "right", size: 9.5, bold: true, color: "#fff" });

  let y = by + 22;
  tableHeader(doc, y, L);
  y += 26;

  for (const it of q.items) {
    if (y + ITEM_H > PAGE_BOTTOM) {
      doc.addPage();
      y = M;
      tableHeader(doc, y, L);
      y += 26;
    }
    drawItem(doc, it, y, L, sym);
    y += ITEM_H;
  }

  // ---- summary ----
  const noteH = q.notes ? 60 : 0;
  if (y + 200 + noteH > PAGE_BOTTOM) {
    doc.addPage();
    y = M;
  }
  y += 4;
  box(doc, M, y, CW, 96);
  t(doc, `${q.totals.pieces.toFixed(2)} ${L.pieces}`, M + CW - 330, y + 6, { w: 70, align: "right", size: 8.5 });
  t(doc, `${q.totals.area.toFixed(2)} m²`, M + CW - 255, y + 6, { w: 55, size: 8.5 });

  // optional profile photos: drop PNG/JPG named after the series slug into backend/assets/series
  const seen = new Set<string>();
  let imgX = M + 8;
  for (const it of q.items) {
    if (!it.series || seen.has(it.series) || seen.size >= 3) continue;
    seen.add(it.series);
    for (const ext of ["png", "jpg", "jpeg"]) {
      const f = path.resolve(process.cwd(), "assets", "series", `${slug(it.series)}.${ext}`);
      if (fs.existsSync(f)) {
        try {
          doc.image(f, imgX, y + 8, { fit: [80, 80] });
          imgX += 90;
        } catch {
          /* ignore unreadable image */
        }
        break;
      }
    }
  }

  const sx = W - M - 190;
  const rows: [string, string, boolean][] = [
    [L.value, q.totals.subtotal.toFixed(2), false],
    [L.discount, `${q.discountPct.toFixed(2)}%`, false],
    [L.afterDiscount, q.totals.net.toFixed(2), false],
    [L.vat, `${q.vatPct.toFixed(2)}%`, false],
    [L.total, `${q.totals.total.toFixed(2)}${sym}`, true],
  ];
  rows.forEach(([k, v, strong], i) => {
    const ry = y + 22 + i * 14.5;
    box(doc, sx, ry, 190, 14.5, strong ? BLUE : undefined);
    const c = strong ? "#fff" : "#111";
    t(doc, k, sx + 4, ry + 3.5, { w: 90, size: 8.5, color: c, bold: strong });
    t(doc, v, sx + 94, ry + 3.5, { w: 92, align: "right", size: 8.5, color: c, bold: strong });
  });
  y += 104;

  if (q.validUntil) {
    t(doc, `${L.validUntil} ${fmtDate(q.validUntil)}`, M, y, { size: 8.5, italic: true });
    y += 14;
  }
  if (q.notes) {
    t(doc, L.notes, M, y, { size: 8.5, bold: true, color: BLUE });
    doc.font("Helvetica").fontSize(8.5).fillColor("#111").text(q.notes, M, y + 12, { width: CW });
    y = doc.y + 8;
  }

  y += 40;
  doc.moveTo(M + 60, y).lineTo(M + 170, y).lineWidth(0.6).stroke("#111");
  doc.moveTo(W - M - 170, y).lineTo(W - M - 60, y).lineWidth(0.6).stroke("#111");
  t(doc, L.issued, M + 60, y + 4, { w: 110, align: "center", size: 8, bold: true });
  t(doc, L.received, W - M - 170, y + 4, { w: 110, align: "center", size: 8, bold: true });

  // ---- footer on every page ----
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.moveTo(M, 805).lineTo(W - M, 805).lineWidth(0.6).stroke("#111");
    t(doc, env.COMPANY_NAME, M, 810, { w: 190, size: 8.5, bold: true, italic: false });
    t(doc, env.COMPANY_ADDRESS, M, 821, { w: 190, size: 8, italic: true });
    t(doc, env.COMPANY_PHONE, M + 200, 810, { w: 140, size: 8, italic: true });
    t(doc, env.COMPANY_EMAIL, M + 340, 810, { w: 140, size: 8, italic: true });
    t(doc, `${i + 1} / ${range.count}`, W - M - 50, 810, { w: 50, align: "right", size: 8.5, bold: true, italic: false });
  }

  doc.end();
}
