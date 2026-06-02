# `data/` folder

This folder holds the spreadsheets used to import students and generate tickets.

**Committed (safe):**
- `sample-import.xlsx` — the import template with **fictional** placeholder data.
  Columns: `StudentID, StudentName, Email, Phone, TicketsPurchased`.

**Git-ignored (sensitive — keep local only):**
- `GraduationFeesReport.xlsx`, `AdditionalTickets.xlsx` — real student PII.
- `sample-etickets.pdf` and any generated PDFs — contain **live, valid QR tokens**.

> Do not commit real student data or generated tickets. Place the source
> spreadsheets here locally and run `npm run db:import` to load them.

## Import formats

- **Two-file merge (this dataset):** `node scripts/import-data.mjs`
  reads `GraduationFeesReport.xlsx` (1 base ticket each) + `AdditionalTickets.xlsx` (extras).
- **Single normalized file:** upload via **Admin → Import**, or
  `node scripts/import-data.mjs --single <file.xlsx>` using the `sample-import.xlsx` layout.
