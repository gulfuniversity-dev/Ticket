"use client";

import { useEffect, useState, useCallback } from "react";

interface Dashboard {
  stats: {
    total_students: number;
    total_tickets: number;
    used: number;
    unused: number;
    cancelled: number;
    attendance: number;
    duplicateAttempts: number;
  };
  recent: any[];
  duplicates: any[];
}

const actionLabel: Record<string, { text: string; cls: string }> = {
  valid_entry: { text: "Valid entry", cls: "text-emerald-700" },
  manual_checkin: { text: "Manual check-in", cls: "text-blue-700" },
  already_used: { text: "Duplicate scan", cls: "text-red-700" },
  undo_checkin: { text: "Undo check-in", cls: "text-amber-700" },
};

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${tone ?? "text-gu-navy"}`}>{value}</div>
    </div>
  );
}

function fmt(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load");
      setData(await res.json());
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000); // live refresh
    return () => clearInterval(id);
  }, [load]);

  if (error) return <div className="card p-4 text-red-700">{error}</div>;
  if (!data) return <div className="text-slate-500">Loading dashboard…</div>;

  const s = data.stats;
  const pct = s.total_tickets ? Math.round((s.attendance / s.total_tickets) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gu-navy">Dashboard</h1>
        <span className="text-xs text-slate-400">Auto-refreshing every 10s</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Students" value={s.total_students} />
        <StatCard label="Total Tickets" value={s.total_tickets} />
        <StatCard label="Used / Attendance" value={s.attendance} tone="text-emerald-600" />
        <StatCard label="Unused" value={s.unused} tone="text-blue-600" />
        <StatCard label="Cancelled" value={s.cancelled} tone="text-slate-500" />
        <StatCard label="Duplicate Scans" value={s.duplicateAttempts} tone="text-red-600" />
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Live attendance</span>
          <span className="text-slate-500">
            {s.attendance} / {s.total_tickets} ({pct}%)
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-gu-gold" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-700">
            Recent check-ins
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Time</th>
                  <th className="th">Student</th>
                  <th className="th">Ticket</th>
                  <th className="th">Action</th>
                  <th className="th">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent.map((r, i) => (
                  <tr key={i}>
                    <td className="td whitespace-nowrap">{fmt(r.scanned_at)}</td>
                    <td className="td">{r.student_name || r.student_id || "—"}</td>
                    <td className="td">{r.ticket_id || "—"}</td>
                    <td className={`td font-medium ${actionLabel[r.action]?.cls ?? ""}`}>
                      {actionLabel[r.action]?.text ?? r.action}
                    </td>
                    <td className="td">{r.staff_name || "—"}</td>
                  </tr>
                ))}
                {data.recent.length === 0 && (
                  <tr>
                    <td className="td text-slate-400" colSpan={5}>
                      No check-ins yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold text-red-700">
            Duplicate scan attempts
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Time</th>
                  <th className="th">Student</th>
                  <th className="th">Ticket</th>
                  <th className="th">Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.duplicates.map((r, i) => (
                  <tr key={i}>
                    <td className="td whitespace-nowrap">{fmt(r.scanned_at)}</td>
                    <td className="td">{r.student_name || r.student_id || "—"}</td>
                    <td className="td">{r.ticket_id || "—"}</td>
                    <td className="td">{r.staff_name || "—"}</td>
                  </tr>
                ))}
                {data.duplicates.length === 0 && (
                  <tr>
                    <td className="td text-slate-400" colSpan={4}>
                      No duplicate attempts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
