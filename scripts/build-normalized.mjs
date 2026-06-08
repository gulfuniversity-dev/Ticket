// One-off: merge "Registered Students" + "Additional Tickets" into a single
// normalized import file (StudentID, StudentName, Email, Phone, TicketsPurchased).
//
// Rules (confirmed with registrar 2026-06-08):
//   * Every student gets 1 base ticket (from registration).
//   * Additional file's "TotalTickets" = EXTRA tickets on top of the base.
//   * total = 1 + extra, applied uniformly (incl. additional-only students).
//   * Registered (Arabic) name wins when a student is in both files.
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import xlsx from "xlsx";

const s = (v) => (v == null ? "" : String(v).trim());
const REG = "C:/Users/Bashar/Downloads/Registered Students.xlsx";
const ADD = "C:/Users/Bashar/Downloads/AdditionalTicketsReport2 (1).xlsx";
const readWb = (p) => xlsx.read(readFileSync(p), { type: "buffer" });

// Registered: NO header row. cols = [seq, StudentID, Name, Program, GPA]
const wbR = readWb(REG);
const R = xlsx.utils.sheet_to_json(wbR.Sheets[wbR.SheetNames[0]], { header: 1, defval: null });
const regName = new Map();
for (const r of R) {
  const id = s(r[1]);
  if (!/^\d{6,}$/.test(id)) continue;
  regName.set(id, s(r[2]));
}

// Additional: header StudentID, StudentName, TotalTickets
const wbA = readWb(ADD);
const A = xlsx.utils.sheet_to_json(wbA.Sheets[wbA.SheetNames[0]], { defval: null });
const addInfo = new Map();
for (const r of A) {
  const id = s(r.StudentID);
  if (!/^\d{6,}$/.test(id)) continue;
  const extra = Math.max(0, parseInt(s(r.TotalTickets).replace(/\D/g, "") || "0", 10));
  addInfo.set(id, { name: s(r.StudentName), extra });
}

// Build union roster.
const roster = new Map();
for (const [id, name] of regName) {
  const extra = addInfo.get(id)?.extra || 0;
  roster.set(id, { StudentID: id, StudentName: name, Email: "", Phone: "", TicketsPurchased: 1 + extra });
}
for (const [id, info] of addInfo) {
  if (roster.has(id)) continue; // already counted (registered name wins)
  roster.set(id, { StudentID: id, StudentName: info.name, Email: "", Phone: "", TicketsPurchased: 1 + info.extra });
}

const rows = [...roster.values()];
const grand = rows.reduce((a, r) => a + r.TicketsPurchased, 0);
const addOnly = rows.filter((r) => !regName.has(r.StudentID));

console.log("Students (union):", rows.length);
console.log("  - registered:", regName.size, "| additional-only:", addOnly.length, addOnly.map((r) => r.StudentID).join(", "));
console.log("Grand total tickets:", grand);
console.log("Sample rows:");
rows.slice(0, 4).forEach((r) => console.log("  ", JSON.stringify(r)));

const out = resolve(process.cwd(), "data", "normalized-import-2026-06-08.xlsx");
const ws = xlsx.utils.json_to_sheet(rows, { header: ["StudentID", "StudentName", "Email", "Phone", "TicketsPurchased"] });
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, "Students");
writeFileSync(out, xlsx.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log("Wrote:", out);
