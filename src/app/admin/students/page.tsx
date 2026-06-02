"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface StudentRow {
  student_id: string;
  student_name: string;
  email: string | null;
  phone: string | null;
  tickets_purchased: number;
  total_tickets: number;
  used: number;
  unused: number;
  cancelled: number;
}

export default function StudentsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/students?q=${encodeURIComponent(term)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setRows(data.students || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(q), 250);
    return () => clearTimeout(id);
  }, [q, load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gu-navy">Students &amp; Tickets</h1>
        <div className="flex flex-wrap gap-2">
          <a className="btn-gold" href="/api/admin/tickets/pdf?all=1">
            Download all tickets (PDF)
          </a>
          <a className="btn-ghost" href="/api/admin/export?type=tickets&format=xlsx">
            Export tickets (Excel)
          </a>
        </div>
      </div>

      <input
        className="input max-w-md"
        placeholder="Search by student ID or name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Student ID</th>
              <th className="th">Name</th>
              <th className="th">Tickets</th>
              <th className="th">Used</th>
              <th className="th">Unused</th>
              <th className="th">Cancelled</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.student_id} className="hover:bg-slate-50">
                <td className="td font-mono text-xs">{r.student_id}</td>
                <td className="td font-medium text-slate-800">{r.student_name}</td>
                <td className="td">{r.total_tickets}</td>
                <td className="td text-emerald-600">{r.used}</td>
                <td className="td text-blue-600">{r.unused}</td>
                <td className="td text-slate-400">{r.cancelled}</td>
                <td className="td text-right">
                  <Link className="btn-primary px-3 py-1 text-xs" href={`/admin/students/${r.student_id}`}>
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={7}>
                  No students found.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td className="td text-slate-400" colSpan={7}>
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">{rows.length} students shown.</p>
    </div>
  );
}
