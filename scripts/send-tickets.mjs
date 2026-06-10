// ============================================================
// Bulk-emails every student their graduation tickets.
//
// It drives the running app's per-student email endpoint over HTTP
// (so it reuses the exact same PDF + SMTP logic and never hits the
// serverless time limit). The app must be running, e.g. `npm run start`.
//
// Required env (.env.local):
//   APP_URL            base url of the running app (default http://localhost:3000)
//   EMAIL_BULK_SECRET  shared secret; must match the app's env
//   SMTP_USER / SMTP_PASS / ...   (used by the app, not this script)
//
// Usage:
//   node scripts/send-tickets.mjs            send to everyone not yet emailed
//   node scripts/send-tickets.mjs --force    resend to everyone
//   node scripts/send-tickets.mjs --limit 3  only the first 3 (smoke test)
//   node scripts/send-tickets.mjs --dry-run  list who would be emailed, send nothing
// ============================================================
import { getPool } from "./db.mjs";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const DRY = args.includes("--dry-run");
const limIdx = args.indexOf("--limit");
const LIMIT = limIdx >= 0 ? parseInt(args[limIdx + 1], 10) : Infinity;

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.EMAIL_BULK_SECRET;
// Office 365 caps a mailbox at ~30 messages/min; 2.5s ≈ 24/min keeps margin.
const DELAY = Number(process.env.SEND_DELAY_MS || 2500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!DRY && !SECRET) {
    console.error("✗ EMAIL_BULK_SECRET is not set (.env.local). Aborting.");
    process.exitCode = 1;
    return;
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `select s.student_id, s.last_emailed_at, count(t.*)::int as n
       from students s
       join tickets t on t.student_id = s.student_id and t.status <> 'cancelled'
      group by s.student_id, s.last_emailed_at
      order by s.student_id`
  );
  await pool.end();

  let queue = rows.filter((r) => FORCE || !r.last_emailed_at);
  const skipped = rows.length - queue.length;
  if (Number.isFinite(LIMIT)) queue = queue.slice(0, LIMIT);

  console.log(
    `Students with active tickets: ${rows.length} | to send: ${queue.length} | already sent (skipped): ${skipped}`
  );
  console.log(`Target: ${APP_URL}  ·  throttle: ${DELAY}ms` + (DRY ? "  ·  DRY RUN" : ""));

  if (DRY) {
    queue.forEach((r) => console.log(`  would email ${r.student_id} (${r.n} tickets)`));
    return;
  }

  let sent = 0;
  const failures = [];
  for (let i = 0; i < queue.length; i++) {
    const { student_id, n } = queue[i];
    const tag = `[${i + 1}/${queue.length}] ${student_id} (${n})`;
    try {
      const res = await fetch(`${APP_URL}/api/admin/students/${student_id}/email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SECRET}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        sent++;
        console.log(`✓ ${tag} → ${data.recipient}`);
      } else {
        failures.push({ student_id, error: data.error || `HTTP ${res.status}` });
        console.log(`✗ ${tag} → ${data.error || res.status}`);
      }
    } catch (e) {
      const error = e?.cause?.code === "ECONNREFUSED" ? "app not reachable (is it running?)" : e.message;
      failures.push({ student_id, error });
      console.log(`✗ ${tag} → ${error}`);
      if (e?.cause?.code === "ECONNREFUSED") break; // no point continuing
    }
    if (i < queue.length - 1) await sleep(DELAY);
  }

  console.log(`\nDone. Sent ${sent}, failed ${failures.length}.`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach((f) => console.log(`  ${f.student_id}: ${f.error}`));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("✗ Bulk send failed:", e.message);
  process.exitCode = 1;
});
