// Verifies the Office 365 SMTP login and sends ONE test email (with the sample
// ticket PDF attached) so we can confirm delivery before mailing students.
//
// Usage: node scripts/test-email.mjs <recipient>
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import nodemailer from "nodemailer";
import "./db.mjs"; // side-effect: loads .env.local into process.env

const to = process.argv[2];
if (!to) {
  console.error("Usage: node scripts/test-email.mjs <recipient-email>");
  process.exit(1);
}

const { SMTP_HOST = "smtp.office365.com", SMTP_PORT = "587", SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_FROM_NAME } = process.env;
console.log(`Host ${SMTP_HOST}:${SMTP_PORT}  user ${SMTP_USER}`);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  requireTLS: Number(SMTP_PORT) === 587,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

const attachments = [];
const sample = resolve(process.cwd(), "data", "sample-ticket-preview.pdf");
if (existsSync(sample)) {
  attachments.push({ filename: "sample-ticket.pdf", content: readFileSync(sample), contentType: "application/pdf" });
}

try {
  console.log("Verifying SMTP login…");
  await transporter.verify();
  console.log("✓ SMTP login OK");

  console.log(`Sending test email to ${to}…`);
  const AR_LINES = [
    "خريجينا الأعزاء،",
    "تحية طيبة وبعد،",
    "مرفق لكم تذاكر حفل التخرج الإلكترونية الخاصة بكم (QR Code)، يرجى التكرم بإبراز التذكرة عند بوابة الدخول يوم الحفل.",
    "نتمنى لكم حفلة تخرج سعيدة ومميزة، ومزيداً من النجاح والتوفيق في مسيرتكم القادمة.",
    "مع خالص التحية والتقدير،",
    "الجامعة الخليجية",
  ];
  const info = await transporter.sendMail({
    from: { address: MAIL_FROM || SMTP_USER, name: MAIL_FROM_NAME || "Gulf University Graduation" },
    to,
    subject: "تذاكر حفل التخرج | Gulf University Graduation Tickets",
    text: AR_LINES.join("\n\n"),
    html:
      `<div dir="rtl" style="font-family:Arial,'Segoe UI',Tahoma,sans-serif;color:#0b2447;line-height:1.9;font-size:15px;text-align:right">` +
      AR_LINES.map((l) => `<p style="margin:0 0 14px">${l}</p>`).join("") +
      `</div>`,
    attachments,
  });
  console.log("✓ Sent. messageId:", info.messageId, "| response:", info.response);
} catch (e) {
  console.error("✗ FAILED:", e.message);
  if (e.code) console.error("  code:", e.code, " command:", e.command || "");
  process.exitCode = 1;
}
