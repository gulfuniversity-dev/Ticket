"use client";

import { useCallback, useState } from "react";

interface Ticket {
  id: string;
  ticket_id: string;
  qr_token: string;
  student_id: string;
  student_name: string;
  ticket_number: number;
  total_tickets: number;
  status: "unused" | "used" | "cancelled";
  used_at: string | null;
  checked_in_by_name: string | null;
}

const badgeClass: Record<string, string> = {
  unused: "badge-unused",
  used: "badge-used",
  cancelled: "badge-cancelled",
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true);
    setMsg("");
    const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setRows(data.tickets || []);
    setSearched(true);
    setLoading(false);
  }, [q]);

  async function checkIn(t: Ticket) {
    setMsg("");
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t.qr_token }),
    });
    const data = await res.json();
    if (data.result === "valid") setMsg(`✓ ${data.message} — ${t.student_name}`);
    else setMsg(`✕ ${data.message} — ${t.student_name}`);
    await search();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gu-navy">Manual Search</h1>
      <p className="text-sm text-slate-500">
        Search by Ticket ID, Student ID, or Student Name when the camera cannot be used.
      </p>

      <form onSubmit={search} className="flex gap-2">
        <input
          className="input"
          placeholder="Ticket ID / Student ID / Name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "…" : "Search"}
        </button>
      </form>

      {msg && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200">
          {msg}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Ticket ID</th>
              <th className="th">Student</th>
              <th className="th">No.</th>
              <th className="th">Status</th>
              <th className="th">Checked-in</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="td font-mono text-xs">{t.ticket_id}</td>
                <td className="td">
                  <div className="font-medium text-slate-800">{t.student_name}</div>
                  <div className="font-mono text-xs text-slate-400">{t.student_id}</div>
                </td>
                <td className="td">
                  {t.ticket_number}/{t.total_tickets}
                </td>
                <td className="td">
                  <span className={badgeClass[t.status]}>{t.status}</span>
                </td>
                <td className="td whitespace-nowrap text-xs">
                  {t.used_at ? new Date(t.used_at).toLocaleString() : "—"}
                  {t.checked_in_by_name ? ` · ${t.checked_in_by_name}` : ""}
                </td>
                <td className="td text-right">
                  {t.status === "unused" ? (
                    <button className="btn-primary px-3 py-1 text-xs" onClick={() => checkIn(t)}>
                      Check in
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {searched && !loading && rows.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={6}>
                  No matching tickets.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
