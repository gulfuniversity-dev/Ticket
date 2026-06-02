// End-to-end smoke test against the running server (http://localhost:3000).
import { getPool } from "./db.mjs";

const BASE = "http://localhost:3000";
const pool = getPool();
let pass = 0,
  fail = 0;

function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

// tiny cookie jar
function makeClient() {
  let cookie = "";
  return async (path, opts = {}) => {
    const res = await fetch(BASE + path, {
      ...opts,
      headers: {
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(opts.headers || {}),
      },
      redirect: "manual",
    });
    const setc = res.headers.get("set-cookie");
    if (setc) cookie = setc.split(";")[0];
    return res;
  };
}

async function main() {
  // grab test tokens directly from DB
  const unused = (
    await pool.query(
      "select qr_token, ticket_id, student_id from tickets where status='unused' order by ticket_id limit 2"
    )
  ).rows;
  const testToken = unused[0].qr_token;
  const cancelTicket = unused[1];

  // cancel one ticket via DB so we can test the cancelled path
  await pool.query("update tickets set status='cancelled' where ticket_id=$1", [
    cancelTicket.ticket_id,
  ]);

  console.log("\n[1] Auth");
  const anon = makeClient();
  let r = await anon("/api/admin/dashboard");
  check("unauthenticated dashboard blocked", r.status === 401, `(got ${r.status})`);

  const admin = makeClient();
  r = await admin("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@gulfuniversity.edu.bh", password: "Admin@2026" }),
  });
  check("admin login", r.status === 200);

  const gate = makeClient();
  r = await gate("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "gate@gulfuniversity.edu.bh", password: "Gate@2026" }),
  });
  check("gate login", r.status === 200);

  r = await gate("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "gate@gulfuniversity.edu.bh", password: "wrong" }),
  });
  check("wrong password rejected", r.status === 401);

  console.log("\n[2] Role enforcement");
  r = await gate("/api/admin/dashboard");
  check("gate staff cannot access admin API", r.status === 403, `(got ${r.status})`);

  console.log("\n[3] Dashboard stats");
  r = await admin("/api/admin/dashboard");
  const dash = await r.json();
  check("174 students", dash.stats.total_students === 174, `(got ${dash.stats.total_students})`);
  check("632 tickets", dash.stats.total_tickets === 632, `(got ${dash.stats.total_tickets})`);

  console.log("\n[4] Scan flow");
  r = await gate("/api/scan", { method: "POST", body: JSON.stringify({ token: testToken }) });
  let scan = await r.json();
  check("valid ticket → entry allowed", scan.result === "valid", `(got ${scan.result})`);
  check("returns student name", !!scan.ticket?.student_name);

  r = await gate("/api/scan", { method: "POST", body: JSON.stringify({ token: testToken }) });
  scan = await r.json();
  check("second scan → already_used", scan.result === "already_used", `(got ${scan.result})`);
  check("already_used shows previous time", !!scan.ticket?.used_at);

  r = await gate("/api/scan", { method: "POST", body: JSON.stringify({ token: "totally-fake-token" }) });
  scan = await r.json();
  check("fake token → invalid", scan.result === "invalid", `(got ${scan.result})`);

  r = await gate("/api/scan", {
    method: "POST",
    body: JSON.stringify({ token: cancelTicket.qr_token }),
  });
  scan = await r.json();
  check("cancelled ticket → cancelled", scan.result === "cancelled", `(got ${scan.result})`);

  console.log("\n[5] Manual search");
  r = await gate(`/api/search?q=${encodeURIComponent(unused[0].student_id)}`);
  const sr = await r.json();
  check("search finds tickets", Array.isArray(sr.tickets) && sr.tickets.length > 0);

  console.log("\n[6] PDF generation");
  r = await admin(`/api/admin/tickets/pdf?studentId=${unused[0].student_id}`);
  const pdfBuf = Buffer.from(await r.arrayBuffer());
  check(
    "student PDF is a valid PDF",
    r.status === 200 && pdfBuf.subarray(0, 4).toString() === "%PDF",
    `(status ${r.status}, ${pdfBuf.length} bytes)`
  );

  console.log("\n[7] Excel export");
  r = await admin("/api/admin/export?type=checkins&format=xlsx");
  const xlBuf = Buffer.from(await r.arrayBuffer());
  check(
    "checkin report xlsx (PK header)",
    r.status === 200 && xlBuf[0] === 0x50 && xlBuf[1] === 0x4b,
    `(status ${r.status}, ${xlBuf.length} bytes)`
  );

  console.log("\n[8] Admin ticket actions (undo restores)");
  // undo the check-in we made, so DB returns to clean state
  const used = (
    await pool.query("select id from tickets where qr_token=$1", [testToken])
  ).rows[0];
  r = await admin(`/api/admin/tickets/${used.id}`, {
    method: "POST",
    body: JSON.stringify({ action: "undo" }),
  });
  check("undo check-in", r.status === 200);

  // reactivate the cancelled ticket
  const canc = (
    await pool.query("select id from tickets where ticket_id=$1", [cancelTicket.ticket_id])
  ).rows[0];
  r = await admin(`/api/admin/tickets/${canc.id}`, {
    method: "POST",
    body: JSON.stringify({ action: "reactivate" }),
  });
  check("reactivate cancelled ticket", r.status === 200);

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Test harness error:", e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
