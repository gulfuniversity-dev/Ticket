import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { handle } from "@/lib/guard";

export const runtime = "nodejs";

export const POST = handle(async () => {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
