"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Result = "valid" | "already_used" | "cancelled" | "invalid";
interface ScanResponse {
  result: Result;
  message: string;
  ticket?: {
    ticket_id?: string;
    student_id?: string;
    student_name?: string;
    ticket_number?: number;
    total_tickets?: number;
    used_at?: string | null;
    checked_in_by_name?: string | null;
  };
}

const COOLDOWN_MS = 3000; // ignore camera detections for this long after a scan

const theme: Record<Result, { bg: string; ring: string; icon: string }> = {
  valid: { bg: "bg-emerald-500", ring: "ring-emerald-300", icon: "✓" },
  already_used: { bg: "bg-red-600", ring: "ring-red-300", icon: "✕" },
  cancelled: { bg: "bg-red-600", ring: "ring-red-300", icon: "✕" },
  invalid: { bg: "bg-amber-500", ring: "ring-amber-300", icon: "!" },
};

export default function ScanPage() {
  const [running, setRunning] = useState(false);
  const [camError, setCamError] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const scannerRef = useRef<any>(null);
  const pausedUntil = useRef(0);
  const lastToken = useRef<{ token: string; t: number }>({ token: "", t: 0 });
  const containerId = "qr-reader";

  const submitToken = useCallback(async (token: string) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data: ScanResponse = await res.json();
      setResult(data);
      // beep / vibrate feedback
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(data.result === "valid" ? 120 : [80, 60, 80]);
      }
    } catch {
      setResult({ result: "invalid", message: "Network error — try again" });
    } finally {
      setSubmitting(false);
    }
  }, []);

  const onDecoded = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      if (now < pausedUntil.current) return; // global cooldown
      // de-dupe the same QR seen repeatedly by the camera
      if (
        decodedText === lastToken.current.token &&
        now - lastToken.current.t < COOLDOWN_MS
      )
        return;
      lastToken.current = { token: decodedText, t: now };
      pausedUntil.current = now + COOLDOWN_MS;
      submitToken(decodedText.trim());
    },
    [submitToken]
  );

  const start = useCallback(async () => {
    setCamError("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onDecoded,
        () => {}
      );
      setRunning(true);
    } catch (e: any) {
      setCamError(
        "Could not access camera. Grant camera permission, or use Manual Search. " +
          (e?.message || "")
      );
      setRunning(false);
    }
  }, [onDecoded]);

  const stop = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => {
    start();
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = result ? theme[result.result] : null;

  return (
    <div className="space-y-4">
      <h1 className="text-center text-xl font-bold text-gu-navy">Gate Scanner</h1>

      <div className="card overflow-hidden">
        <div id={containerId} className="mx-auto w-full max-w-md bg-black" />
        {!running && (
          <div className="p-4 text-center">
            <button className="btn-primary" onClick={start}>
              Start camera
            </button>
          </div>
        )}
      </div>

      {camError && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          {camError}
        </div>
      )}

      <div className="flex justify-center gap-2">
        {running ? (
          <button className="btn-ghost" onClick={stop}>
            Stop camera
          </button>
        ) : (
          <button className="btn-ghost" onClick={start}>
            Restart camera
          </button>
        )}
        <a className="btn-ghost" href="/search">
          Manual search
        </a>
      </div>

      {/* Big colored result */}
      {result && t && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 ${t.bg} text-white shadow-2xl`}
          onClick={() => setResult(null)}
        >
          <div className="mx-auto max-w-md p-6 text-center">
            <div
              className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-4xl ring-4 ${t.ring}`}
            >
              {t.icon}
            </div>
            <div className="text-2xl font-extrabold uppercase tracking-wide">{result.message}</div>
            {result.ticket?.student_name && (
              <div className="mt-2 text-lg font-semibold">{result.ticket.student_name}</div>
            )}
            {result.ticket?.student_id && (
              <div className="text-sm opacity-90">
                {result.ticket.student_id}
                {result.ticket.ticket_number
                  ? ` · Ticket ${result.ticket.ticket_number} of ${result.ticket.total_tickets}`
                  : ""}
              </div>
            )}
            {result.result === "already_used" && result.ticket?.used_at && (
              <div className="mt-2 rounded-lg bg-black/20 px-3 py-2 text-sm">
                Previously checked in: {new Date(result.ticket.used_at).toLocaleString()}
                {result.ticket.checked_in_by_name ? ` by ${result.ticket.checked_in_by_name}` : ""}
              </div>
            )}
            <button className="mt-4 rounded-lg bg-white/20 px-5 py-2 font-semibold">
              Tap to scan next
            </button>
          </div>
        </div>
      )}

      {submitting && (
        <p className="text-center text-sm text-slate-500">Checking ticket…</p>
      )}
    </div>
  );
}
