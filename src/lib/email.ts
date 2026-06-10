import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

// Domain used to derive a student's email from their ID.
export const STUDENT_EMAIL_DOMAIN =
  process.env.STUDENT_EMAIL_DOMAIN || "gulfuniversity.edu.bh";

export function studentEmail(studentId: string): string {
  return `${studentId}@${STUDENT_EMAIL_DOMAIN}`;
}

let transporter: Transporter | null = null;

/** Lazily build (and cache) the Office 365 SMTP transport from env. */
function getTransport(): Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST || "smtp.office365.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error(
      "Email not configured: set SMTP_USER and SMTP_PASS in .env.local"
    );
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 587 uses STARTTLS
    requireTLS: port === 587,
    auth: { user, pass },
  });
  return transporter;
}

export interface TicketEmail {
  to: string;
  studentName: string;
  studentId: string;
  ticketCount: number;
  pdf: Uint8Array;
}

// Arabic body sent to every graduate (plain-text and HTML versions).
const AR_LINES = [
  "خريجينا الأعزاء،",
  "تحية طيبة وبعد،",
  "مرفق لكم تذاكر حفل التخرج الإلكترونية الخاصة بكم (QR Code)، يرجى التكرم بإبراز التذكرة عند بوابة الدخول يوم الحفل.",
  "نتمنى لكم حفلة تخرج سعيدة ومميزة، ومزيداً من النجاح والتوفيق في مسيرتكم القادمة.",
  "مع خالص التحية والتقدير،",
  "الجامعة الخليجية",
];

export async function sendTicketEmail(msg: TicketEmail): Promise<void> {
  const t = getTransport();
  const fromAddr = process.env.MAIL_FROM || process.env.SMTP_USER!;
  const fromName = process.env.MAIL_FROM_NAME || "Gulf University Graduation";

  await t.sendMail({
    from: { address: fromAddr, name: fromName },
    to: msg.to,
    subject: "تذاكر حفل التخرج | Gulf University Graduation Tickets",
    text: AR_LINES.join("\n\n"),
    html:
      `<div dir="rtl" style="font-family:Arial,'Segoe UI',Tahoma,sans-serif;color:#0b2447;line-height:1.9;font-size:15px;text-align:right">` +
      AR_LINES.map((l) => `<p style="margin:0 0 14px">${l}</p>`).join("") +
      `</div>`,
    attachments: [
      {
        filename: `graduation-tickets-${msg.studentId}.pdf`,
        content: Buffer.from(msg.pdf),
        contentType: "application/pdf",
      },
    ],
  });
}
