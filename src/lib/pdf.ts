import "server-only";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFEmbeddedPage,
} from "pdf-lib";
import QRCode from "qrcode";
import { INVITATION_PDF_BASE64 } from "./invitation-asset";

export interface PdfTicket {
  ticket_id: string;
  student_id: string;
  student_name: string;
  ticket_number: number;
  total_tickets: number;
  qr_token: string;
  status?: string;
}

// Palette sampled from the invitation artwork.
const navy = rgb(0.043, 0.106, 0.255); // deep navy of the invite interior
const gold = rgb(0.804, 0.663, 0.42); // bronze-gold of the frame
const cream = rgb(0.95, 0.93, 0.88);
const muted = rgb(0.62, 0.69, 0.82);

const STRIP_H = 132; // personalization strip height (pts) below the invitation

// Returns true if every char of `text` is encodable by the standard (WinAnsi)
// font. Arabic names are not, so we fall back to ID-only identification.
function isEncodable(text: string, font: PDFFont): boolean {
  if (!text) return false;
  for (const ch of text) {
    try {
      font.widthOfTextAtSize(ch, 10);
    } catch {
      return false;
    }
  }
  return true;
}

async function drawTicket(
  doc: PDFDocument,
  t: PdfTicket,
  ctx: { reg: PDFFont; bold: PDFFont; invite: PDFEmbeddedPage }
) {
  const { reg, bold, invite } = ctx;
  const W = invite.width; // invitation is square (425.197 pt)
  const artH = invite.height;
  const H = artH + STRIP_H;
  const page = doc.addPage([W, H]);

  // Navy backdrop (covers the strip and any sub-pixel gaps behind the frame).
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: navy });

  // The invitation artwork sits on top.
  page.drawPage(invite, { x: 0, y: STRIP_H, width: W, height: artH });

  // Dashed gold "perforation" line dividing the invite from the ticket stub.
  page.drawLine({
    start: { x: 16, y: STRIP_H },
    end: { x: W - 16, y: STRIP_H },
    thickness: 1,
    color: gold,
    dashArray: [5, 4],
  });

  // ---- QR code (right side of the strip) ----
  const qrPng = await QRCode.toBuffer(t.qr_token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
  });
  const qrImg = await doc.embedPng(qrPng);
  const qrSize = 92;
  const qrX = W - qrSize - 24;
  const qrY = (STRIP_H - qrSize) / 2;
  page.drawRectangle({
    x: qrX - 7,
    y: qrY - 7,
    width: qrSize + 14,
    height: qrSize + 14,
    color: rgb(1, 1, 1),
    borderColor: gold,
    borderWidth: 1,
  });
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // ---- Left details ----
  const leftX = 28;
  page.drawText("GRADUATE GUEST PASS", {
    x: leftX,
    y: STRIP_H - 26,
    size: 9,
    font: bold,
    color: gold,
  });

  // Optional name line (only when the font can render it — i.e. Latin names).
  let cursor = STRIP_H - 50;
  if (isEncodable(t.student_name, bold)) {
    page.drawText(t.student_name, {
      x: leftX,
      y: cursor,
      size: 12,
      font: bold,
      color: cream,
    });
    cursor -= 22;
  }

  page.drawText(`Ticket ${t.ticket_number} of ${t.total_tickets}`, {
    x: leftX,
    y: cursor,
    size: 15,
    font: bold,
    color: rgb(1, 1, 1),
  });
  cursor -= 19;
  page.drawText(`Ticket No: ${t.ticket_id}`, {
    x: leftX,
    y: cursor,
    size: 9.5,
    font: reg,
    color: muted,
  });
  cursor -= 15;
  page.drawText(`Student No: ${t.student_id}`, {
    x: leftX,
    y: cursor,
    size: 9.5,
    font: reg,
    color: muted,
  });

  // Footer micro-instruction.
  page.drawText("Valid for ONE entry  ·  Please present this QR code at the gate.", {
    x: leftX,
    y: 12,
    size: 8,
    font: reg,
    color: muted,
  });
}

export async function buildTicketsPdf(
  tickets: PdfTicket[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Embed the invitation artwork once; reused as a shared XObject on every page.
  const inviteBytes = Buffer.from(INVITATION_PDF_BASE64, "base64");
  const [invite] = await doc.embedPdf(inviteBytes, [0]);

  doc.setTitle("Gulf University Graduation E-Tickets");
  for (const t of tickets) {
    await drawTicket(doc, t, { reg, bold, invite });
  }
  return doc.save();
}
