export default function ReportsPage() {
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-bold text-gu-navy">Reports &amp; Exports</h1>

      <div className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold text-slate-700">Check-in report</h2>
          <p className="mb-2 text-sm text-slate-500">
            Full audit log of every gate action (valid entries, duplicates, manual check-ins,
            undos, cancellations).
          </p>
          <div className="flex gap-2">
            <a className="btn-primary" href="/api/admin/export?type=checkins&format=xlsx">
              Download Excel
            </a>
            <a className="btn-ghost" href="/api/admin/export?type=checkins&format=csv">
              Download CSV
            </a>
          </div>
        </div>

        <hr className="border-slate-200" />

        <div>
          <h2 className="font-semibold text-slate-700">All tickets</h2>
          <p className="mb-2 text-sm text-slate-500">
            Every ticket with its current status and check-in details.
          </p>
          <div className="flex gap-2">
            <a className="btn-primary" href="/api/admin/export?type=tickets&format=xlsx">
              Download Excel
            </a>
            <a className="btn-ghost" href="/api/admin/export?type=tickets&format=csv">
              Download CSV
            </a>
          </div>
        </div>

        <hr className="border-slate-200" />

        <div>
          <h2 className="font-semibold text-slate-700">E-Tickets (PDF)</h2>
          <p className="mb-2 text-sm text-slate-500">
            Generate printable QR e-tickets for all students.
          </p>
          <a className="btn-gold" href="/api/admin/tickets/pdf?all=1">
            Download all e-tickets (PDF)
          </a>
        </div>
      </div>
    </div>
  );
}
