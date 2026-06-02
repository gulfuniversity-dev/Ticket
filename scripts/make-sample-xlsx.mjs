// Generates a sample import template in the normalized single-file format:
//   StudentID | StudentName | Email | Phone | TicketsPurchased
// Output: data/sample-import.xlsx
import xlsx from "xlsx";
import { resolve } from "node:path";
import { __dirname } from "./db.mjs";

// Fictional placeholder data — safe to commit as a public template.
const rows = [
  { StudentID: "200000000001", StudentName: "Sample Student One", Email: "student1@example.com", Phone: "+97333000001", TicketsPurchased: 5 },
  { StudentID: "200000000002", StudentName: "Sample Student Two", Email: "student2@example.com", Phone: "+97333000002", TicketsPurchased: 3 },
  { StudentID: "200000000003", StudentName: "Sample Student Three", Email: "", Phone: "+97333000003", TicketsPurchased: 1 },
  { StudentID: "200000000004", StudentName: "Sample Student Four", Email: "student4@example.com", Phone: "", TicketsPurchased: 2 },
];

const ws = xlsx.utils.json_to_sheet(rows, {
  header: ["StudentID", "StudentName", "Email", "Phone", "TicketsPurchased"],
});
ws["!cols"] = [{ wch: 16 }, { wch: 42 }, { wch: 26 }, { wch: 16 }, { wch: 16 }];
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, "Students");

const out = resolve(__dirname, "..", "data", "sample-import.xlsx");
xlsx.writeFile(wb, out);
console.log("✓ Wrote", out);
