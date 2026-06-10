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
  const [busyId, setBusyId] = useState("");
  const [sentMap, setSentMap] = useState<Record<string, "sent" | "failed">>({});
  const [bulk, setBulk] = useState({ running: false, done: 0, total: 0, sent: 0, failed: 0 });
  const [banner, setBanner] = useState("");

  const load = useCallback(async (term: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/students?q=${encodeURIComponent(term)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setRows(data.students || []);
    setLoading(false);
  }, []);

  async function postEmail(studentId: string) {
    const res = await fetch(`/api/admin/students/${studentId}/email`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  async function emailOne(studentId: string) {
    setBusyId(studentId);
    setBanner("");
    const { ok, data } = await postEmail(studentId);
    setSentMap((p) => ({ ...p, [studentId]: ok ? "sent" : "failed" }));
    setBanner(ok ? `✓ Sent to ${data.recipient}` : `✗ ${studentId}: ${data.error || "failed"}`);
    setBusyId("");
  }

  async function emailAll() {
    const targets = rows.filter((r) => r.used + r.unused > 0);
    if (targets.length === 0) return;
    if (
      !confirm(
        `Email tickets to ${targets.length} students?\n\nKeep this tab open and your computer awake until it finishes (about ${Math.ceil((targets.length * 2.2) / 60)} min).`
      )
    )
      return;
    setBanner("");
    setBulk({ running: true, done: 0, total: targets.length, sent: 0, failed: 0 });
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const id = targets[i].student_id;
      setBusyId(id);
      const { ok } = await postEmail(id);
      if (ok) sent++;
      else failed++;
      setSentMap((p) => ({ ...p, [id]: ok ? "sent" : "failed" }));
      setBulk({ running: true, done: i + 1, total: targets.length, sent, failed });
      if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 2200));
    }
    setBusyId("");
    setBulk((b) => ({ ...b, running: false }));
    setBanner(`Done. Sent ${sent}, failed ${failed}.`);
    load(q);
  }

  useEffect(() => {
    const id = setTimeout(() => load(q), 250);
    return () => clearTimeout(id);
  }, [q, load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gu-navy">Students &amp; Tickets</h1>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={bulk.running} onClick={emailAll}>
            {bulk.running
              ? `Emailing ${bulk.done}/${bulk.total}…`
              : "Email all tickets"}
          </button>
          <a className="btn-gold" href="/api/admin/tickets/pdf?all=1">
            Download all tickets (PDF)
          </a>
          <a className="btn-ghost" href="/api/admin/export?type=tickets&format=xlsx">
            Export tickets (Excel)
          </a>
        </div>
      </div>

      {(bulk.running || banner) && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ring-1 ${
            banner.startsWith("✗") || bulk.failed > 0
              ? "bg-amber-50 text-amber-800 ring-amber-200"
              : "bg-green-50 text-green-700 ring-green-200"
          }`}
        >
          {bulk.running
            ? `Sending ${bulk.done} of ${bulk.total} — sent ${bulk.sent}, failed ${bulk.failed}. Keep this tab open…`
            : banner}
        </div>
      )}

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
                  <div className="flex items-center justify-end gap-2">
                    {sentMap[r.student_id] === "sent" && (
                      <span className="text-xs text-green-600">✓ sent</span>
                    )}
                    {sentMap[r.student_id] === "failed" && (
                      <span className="text-xs text-amber-600">✗ failed</span>
                    )}
                    <button
                      className="btn-ghost px-3 py-1 text-xs"
                      disabled={bulk.running || busyId === r.student_id || r.used + r.unused === 0}
                      title={r.used + r.unused === 0 ? "No active tickets" : "Email this student"}
                      onClick={() => emailOne(r.student_id)}
                    >
                      {busyId === r.student_id ? "Sending…" : "Email"}
                    </button>
                    <Link className="btn-primary px-3 py-1 text-xs" href={`/admin/students/${r.student_id}`}>
                      Manage
                    </Link>
                  </div>
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
