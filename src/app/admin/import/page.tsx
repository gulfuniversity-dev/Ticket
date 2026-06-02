"use client";

import { useState } from "react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-bold text-gu-navy">Import Student Data</h1>

      <div className="card space-y-3 p-4 text-sm text-slate-600">
        <p>
          Upload an <strong>Excel (.xlsx)</strong> or <strong>CSV</strong> file. The system
          generates the correct number of unique QR tickets for each student automatically.
        </p>
        <p className="font-medium text-slate-700">Required columns:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">StudentID</th>
                <th className="th">StudentName</th>
                <th className="th">Email</th>
                <th className="th">Phone</th>
                <th className="th">TicketsPurchased</th>
              </tr>
            </thead>
            <tbody>
              <tr className="divide-x divide-slate-100">
                <td className="td">200104115176</td>
                <td className="td">AYSHA MOHAMED ...</td>
                <td className="td">aysha@example.com</td>
                <td className="td">+97333000001</td>
                <td className="td">5</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          <code>Email</code> and <code>Phone</code> are optional. Re-importing the same student
          tops up to the new ticket count without creating duplicates.
        </p>
      </div>

      <form onSubmit={upload} className="card space-y-4 p-4">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gu-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gu-navy"
        />
        <button type="submit" className="btn-primary" disabled={!file || busy}>
          {busy ? "Importing…" : "Upload & generate tickets"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <p className="font-semibold">Import complete ✓</p>
          <ul className="mt-1 list-inside list-disc">
            <li>Students processed: {result.studentsProcessed}</li>
            <li>New students added: {result.newStudents}</li>
            <li>New tickets created: {result.ticketsCreated}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
