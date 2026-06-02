"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";

interface Ticket {
  id: string;
  ticket_id: string;
  ticket_number: number;
  total_tickets: number;
  status: "unused" | "used" | "cancelled";
  used_at: string | null;
  checked_in_by_name: string | null;
}
interface Student {
  student_id: string;
  student_name: string;
  email: string | null;
  phone: string | null;
  tickets_purchased: number;
}

const badgeClass: Record<string, string> = {
  unused: "badge-unused",
  used: "badge-used",
  cancelled: "badge-cancelled",
};

function fmt(ts: string | null) {
  return ts ? new Date(ts).toLocaleString() : "—";
}

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const [student, setStudent] = useState<Student | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/students/${studentId}`, { cache: "no-store" });
    const data = await res.json();
    setStudent(data.student);
    setTickets(data.tickets || []);
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(ticketId: string, action: string) {
    setBusy(ticketId + action);
    setMsg("");
    const res = await fetch(`/api/admin/tickets/${ticketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Action failed");
    await load();
    setBusy("");
  }

  if (!student) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="space-y-5">
      <Link href="/admin/students" className="text-sm text-gu-blue hover:underline">
        ← Back to students
      </Link>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-xl font-bold text-gu-navy">{student.student_name}</h1>
          <p className="font-mono text-sm text-slate-500">{student.student_id}</p>
          <p className="text-sm text-slate-500">
            {student.email || "no email"} · {student.phone || "no phone"} ·{" "}
            {student.tickets_purchased} ticket(s)
          </p>
        </div>
        <a className="btn-gold" href={`/api/admin/tickets/pdf?studentId=${student.student_id}`}>
          Download tickets (PDF)
        </a>
      </div>

      {msg && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {msg}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Ticket ID</th>
              <th className="th">No.</th>
              <th className="th">Status</th>
              <th className="th">Checked-in</th>
              <th className="th">By</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tickets.map((t) => (
              <tr key={t.id}>
                <td className="td font-mono text-xs">{t.ticket_id}</td>
                <td className="td">
                  {t.ticket_number}/{t.total_tickets}
                </td>
                <td className="td">
                  <span className={badgeClass[t.status]}>{t.status}</span>
                </td>
                <td className="td whitespace-nowrap">{fmt(t.used_at)}</td>
                <td className="td">{t.checked_in_by_name || "—"}</td>
                <td className="td">
                  <div className="flex flex-wrap gap-1">
                    {t.status === "unused" && (
                      <>
                        <button
                          className="btn-ghost px-2 py-1 text-xs"
                          disabled={!!busy}
                          onClick={() => act(t.id, "mark_used")}
                        >
                          Mark used
                        </button>
                        <button
                          className="btn-danger px-2 py-1 text-xs"
                          disabled={!!busy}
                          onClick={() => act(t.id, "cancel")}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {t.status === "used" && (
                      <>
                        <button
                          className="btn-ghost px-2 py-1 text-xs"
                          disabled={!!busy}
                          onClick={() => act(t.id, "undo")}
                        >
                          Undo check-in
                        </button>
                        <button
                          className="btn-danger px-2 py-1 text-xs"
                          disabled={!!busy}
                          onClick={() => act(t.id, "cancel")}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {t.status === "cancelled" && (
                      <button
                        className="btn-primary px-2 py-1 text-xs"
                        disabled={!!busy}
                        onClick={() => act(t.id, "reactivate")}
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
