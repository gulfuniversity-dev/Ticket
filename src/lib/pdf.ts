import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import QRCode from "qrcode";

export interface PdfTicket {
  ticket_id: string;
  student_id: string;
  student_name: string;
  ticket_number: number;
  total_tickets: number;
  qr_token: string;
  status?: string;
}

const navy = rgb(0.043, 0.141, 0.278); // #0b2447
const blue = rgb(0.098, 0.216, 0.427); // #19376d
const gold = rgb(0.788, 0.635, 0.153); // #c9a227
const slate = rgb(0.28, 0.33, 0.4);
const lightGray = rgb(0.93, 0.95, 0.97);

const CEREMONY =
  process.env.NEXT_PUBLIC_CEREMONY_TITLE ||
  "Gulf University Graduation Ceremony — Spring 2025/2026";

function safe(text: string, font: PDFFont): string {
  // pdf-lib StandardFonts (WinAnsi) cannot encode some characters; strip them.
  let out = "";
  for (const ch of text) {
    try {
      font.widthOfTextAtSize(ch, 10);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

async function drawTicket(
  doc: PDFDocument,
  t: PdfTicket,
  fonts: { reg: PDFFont; bold: PDFFont }
) {
  const W = 600;
  const H = 300;
  const page = doc.addPage([W, H]);

  // Card background + border
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
  page.drawRectangle({
    x: 8,
    y: 8,
    width: W - 16,
    height: H - 16,
    borderColor: blue,
    borderWidth: 1.5,
    color: rgb(1, 1, 1),
  });

  // Top band
  page.drawRectangle({ x: 8, y: H - 70, width: W - 16, height: 62, color: navy });
  // GU badge
  page.drawCircle({ x: 48, y: H - 39, size: 22, color: gold });
  page.drawText("GU", {
    x: 36,
    y: H - 45,
    size: 16,
    font: fonts.bold,
    color: navy,
  });
  page.drawText("GULF UNIVERSITY", {
    x: 82,
    y: H - 32,
    size: 16,
    font: fonts.bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(safe(CEREMONY, fonts.reg), {
    x: 82,
    y: H - 50,
    size: 9,
    font: fonts.reg,
    color: rgb(0.78, 0.86, 0.95),
  });

  // QR code (right side)
  const qrPng = await QRCode.toBuffer(t.qr_token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
  const qrImg = await doc.embedPng(qrPng);
  const qrSize = 150;
  const qrX = W - qrSize - 36;
  const qrY = 60;
  page.drawRectangle({
    x: qrX - 8,
    y: qrY - 8,
    width: qrSize + 16,
    height: qrSize + 16,
    color: lightGray,
    borderColor: blue,
    borderWidth: 1,
  });
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // Left details
  let y = H - 100;
  const leftX = 36;
  page.drawText("ADMIT ONE — GRADUATE GUEST", {
    x: leftX,
    y,
    size: 9,
    font: fonts.bold,
    color: gold,
  });
  y -= 26;
  page.drawText(safe(t.student_name || "", fonts.bold), {
    x: leftX,
    y,
    size: 17,
    font: fonts.bold,
    color: navy,
  });
  y -= 22;
  page.drawText(`Student ID: ${t.student_id}`, {
    x: leftX,
    y,
    size: 11,
    font: fonts.reg,
    color: slate,
  });
  y -= 30;
  page.drawText(`Ticket ${t.ticket_number} of ${t.total_tickets}`, {
    x: leftX,
    y,
    size: 14,
    font: fonts.bold,
    color: blue,
  });
  y -= 20;
  page.drawText(`Ticket ID: ${t.ticket_id}`, {
    x: leftX,
    y,
    size: 10,
    font: fonts.reg,
    color: slate,
  });

  // Bottom instruction band
  page.drawRectangle({ x: 8, y: 8, width: W - 16, height: 30, color: lightGray });
  page.drawText("This QR code is valid for ONE entry only. Please present it at the gate.", {
    x: leftX,
    y: 18,
    size: 10,
    font: fonts.bold,
    color: navy,
  });
}

export async function buildTicketsPdf(
  tickets: PdfTicket[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Gulf University Graduation E-Tickets");
  for (const t of tickets) {
    await drawTicket(doc, t, { reg, bold });
  }
  return doc.save();
}
