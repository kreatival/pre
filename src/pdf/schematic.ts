import PDFDocument from "pdfkit";
import { ItemDto } from "../modules/quotations/dto";

type Doc = InstanceType<typeof PDFDocument>;

const cm = (mm: number) => String(Number((mm / 10).toFixed(1)));

function arrow(doc: Doc, x1: number, y: number, x2: number) {
  const dir = x2 > x1 ? 1 : -1;
  doc.lineWidth(0.6).moveTo(x1, y).lineTo(x2, y).stroke("#1f2937");
  doc.polygon([x2, y], [x2 - 4 * dir, y - 2], [x2 - 4 * dir, y + 2]).fill("#1f2937");
}

/** Draws a simple technical elevation of the unit inside the box (x, y, bw, bh). */
export function drawSchematic(doc: Doc, it: ItemDto, x: number, y: number, bw: number, bh: number) {
  const padL = 14;
  const padB = 14;
  const aw = bw - padL;
  const ah = bh - padB;
  const shutterMm = it.shutter ? 185 : 0;
  const s = Math.min(aw / it.widthMm, ah / (it.heightMm + shutterMm));
  const dw = it.widthMm * s;
  const dh = it.heightMm * s;
  const sh = shutterMm * s;
  const ox = x + padL + (aw - dw) / 2;
  const oy = y + (ah - (dh + sh)) / 2;

  if (sh > 0) {
    doc.lineWidth(0.5).rect(ox, oy, dw, sh).fillAndStroke("#e7e2d8", "#8c8c8c");
    for (let ly = oy + 2; ly < oy + sh - 1; ly += 2.5) {
      doc.lineWidth(0.3).moveTo(ox + 1, ly).lineTo(ox + dw - 1, ly).stroke("#b5b0a5");
    }
  }

  const fy = oy + sh;
  const frame = Math.max(2, Math.min(dw, dh) * 0.05);
  const panel = it.type === "PANEL_DOOR";
  doc.lineWidth(0.6).rect(ox, fy, dw, dh).fillAndStroke(panel ? "#2f3338" : "#6b7075", "#44484c");
  const gx = ox + frame;
  const gy = fy + frame;
  const gw = dw - 2 * frame;
  const gh = dh - 2 * frame;
  doc.rect(gx, gy, gw, gh).fill(panel ? "#454a50" : "#bfe4fb");

  const n = it.type === "SLIDING" || it.type === "TILT_TURN" ? Math.max(1, it.leaves) : 1;
  const lw = gw / n;
  for (let i = 1; i < n; i++) doc.rect(gx + lw * i - 1, gy, 2, gh).fill("#6b7075");

  switch (it.type) {
    case "SLIDING":
      for (let i = 0; i < n; i++) {
        const cx = gx + lw * i + lw / 2;
        const d = i % 2 === 0 ? 1 : -1;
        arrow(doc, cx - 9 * d, gy + gh / 2, cx + 9 * d);
      }
      break;
    case "TILT_TURN": {
      const x0 = gx + lw * (n - 1);
      const x1 = x0 + lw;
      doc.lineWidth(0.5).strokeColor("#1f2937");
      doc.moveTo(x1, gy).lineTo(x0, gy + gh / 2).lineTo(x1, gy + gh).stroke();
      doc.moveTo(x0, gy + gh).lineTo(x0 + lw / 2, gy).lineTo(x1, gy + gh).stroke();
      break;
    }
    case "DOOR":
      doc.rect(gx + gw - 6, gy + gh / 2 - 6, 2.5, 12).fill("#374151");
      break;
    case "PANEL_DOOR":
      for (const f of [0.3, 0.5, 0.7]) {
        doc.lineWidth(0.6).moveTo(gx + gw * 0.15, gy + gh * f).lineTo(gx + gw * 0.85, gy + gh * (f - 0.04)).stroke("#d9d9d9");
      }
      doc.rect(gx + gw * 0.12, gy + gh * 0.45, 2, gh * 0.2).fill("#e5e7eb");
      break;
    default:
      break;
  }

  // dimension labels
  doc.font("Helvetica").fontSize(7).fillColor("#111");
  doc.text(cm(it.widthMm), ox, fy + dh + 3, { width: dw, align: "center", lineBreak: false });
  doc.save();
  doc.translate(x + 7, fy + dh / 2).rotate(90);
  doc.font("Helvetica").fontSize(7).fillColor("#111").text(cm(it.heightMm), -20, -3, { width: 40, align: "center", lineBreak: false });
  doc.restore();
}
